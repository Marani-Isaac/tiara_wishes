import secrets
from datetime import datetime, timezone

from flask import current_app

from app.addresses.service import address_snapshot
from app.audit.service import write_audit
from app.common.errors import Conflict, NotFound, ValidationError
from app.common.money import calculate_totals, delivery_fee_for, money_str, to_money
from app.common.security import dumps_redacted
from app.common.serializers import flag, iso
from app.common.transactions import run_transaction
from app.common.validation import clean_text, parse_items
from app.db.connection import db_session
from app.inventory.service import finalize_sale, release_expired_reservations, release_reservation, reserve_stock
from app.notifications.service import notify_user
from app.deliveries.places import fee_for_county
from app.deliveries.service import append_delivery_event, delivery_events
from app.promotions.service import consume_promotion, evaluate_promotion

ORDER_TRANSITIONS = {
    "pending_payment": {"cancelled", "failed"},
    "confirmed": {"processing", "refund_pending"},
    "processing": {"ready_to_dispatch", "refund_pending"},
    "ready_to_dispatch": {"dispatched", "refund_pending"},
    "dispatched": {"delivered"},
    "delivered": set(),
    "cancelled": set(),
    "refund_pending": {"refunded"},
    "refunded": set(),
    "failed": {"cancelled"},
}

FULFILMENT_FOR_STATUS = {
    "processing": "processing",
    "ready_to_dispatch": "packed",
    "dispatched": "dispatched",
    "delivered": "delivered",
}

DELIVERY_FOR_STATUS = {
    "processing": "processing",
    "ready_to_dispatch": "packed",
    "dispatched": "dispatched",
    "delivered": "delivered",
}


def quote(user, payload):
    items = parse_items(payload.get("items"))
    release_expired_reservations()
    with db_session() as db:
        rows = _lock_products(db, items, lock=False)
        ordered = [(_row(rows, item["product_id"]), item["quantity"]) for item in items]
        subtotal = _subtotal(rows, items)
        discount = to_money(0)
        promotion = None
        if payload.get("promotion_code"):
            promotion, discount = evaluate_promotion(
                db,
                payload.get("promotion_code"),
                subtotal,
                user["id"] if user else None,
                lock=False,
            )
        fee, _threshold = _fee_settings(db)
        county = _requested_county(db, user, payload)
        handlings = {row.get("handling") or "normal" for row, _quantity in ordered}
        place_fee, place_name = fee_for_county(db, county, handlings)
        totals = calculate_totals(
            [(row["cash_price"], quantity) for row, quantity in ordered],
            discount,
            delivery_fee_for(subtotal - discount, place_fee if place_fee is not None else fee, _threshold),
            current_app.config["TAX_RATE"],
        )
    return _quote_payload(ordered, totals, promotion, place_name)


def create_order(user, payload, idempotency_key=None):
    items = parse_items(payload.get("items"))
    if idempotency_key is not None:
        idempotency_key = _clean_idempotency_key(idempotency_key)
    note = clean_text(payload.get("customer_note"), "customer_note", 500, required=False)
    release_expired_reservations()

    def work(db):
        if idempotency_key:
            existing = db.one(
                "SELECT * FROM orders WHERE user_id = %s AND idempotency_key = %s",
                (user["id"], idempotency_key),
            )
            if existing:
                return present_order(db, existing, admin=False)
        address = address_snapshot(db, user["id"], payload)
        rows = _lock_products(db, items, lock=True)
        _assert_available(rows, items)
        subtotal = _subtotal(rows, items)
        promotion = None
        discount = to_money(0)
        if payload.get("promotion_code"):
            promotion, discount = evaluate_promotion(
                db, payload.get("promotion_code"), subtotal, user["id"], lock=True
            )
        fee, threshold = _fee_settings(db)
        ordered = [(_row(rows, item["product_id"]), item["quantity"]) for item in items]
        handlings = {row.get("handling") or "normal" for row, _quantity in ordered}
        place_fee, _place_name = fee_for_county(db, address.get("county"), handlings)
        totals = calculate_totals(
            [(row["cash_price"], quantity) for row, quantity in ordered],
            discount,
            delivery_fee_for(subtotal - discount, place_fee if place_fee is not None else fee, threshold),
            current_app.config["TAX_RATE"],
        )
        if totals["grand_total"] <= 0:
            raise ValidationError(details={"items": "Order total must be greater than zero"})
        currencies = {row["currency"] for row, _ in ordered}
        if currencies != {current_app.config["CURRENCY"]}:
            raise ValidationError(details={"items": "This checkout only supports the store currency"})
        order_number = _unique_order_number(db)
        order_id, _ = db.execute(
            """
            INSERT INTO orders (
              order_number, user_id, status, payment_status, fulfilment_status, currency,
              subtotal, discount_total, delivery_fee, tax_total, grand_total,
              recipient_name, recipient_phone, county, town, area_or_estate,
              building, house_or_unit, delivery_instructions, customer_note,
              promotion_id, idempotency_key, reservation_expires_at
            ) VALUES (
              %s, %s, 'pending_payment', 'unpaid', 'unfulfilled', %s,
              %s, %s, %s, %s, %s,
              %s, %s, %s, %s, %s,
              %s, %s, %s, %s,
              %s, %s, DATE_ADD(UTC_TIMESTAMP(), INTERVAL %s MINUTE)
            )
            """,
            (
                order_number,
                user["id"],
                current_app.config["CURRENCY"],
                totals["subtotal"],
                totals["discount_total"],
                totals["delivery_fee"],
                totals["tax_total"],
                totals["grand_total"],
                address["recipient_name"],
                address["recipient_phone"],
                address["county"],
                address["town"],
                address["area_or_estate"],
                address["building"],
                address["house_or_unit"],
                address["delivery_instructions"],
                note,
                promotion["id"] if promotion else None,
                idempotency_key,
                int(current_app.config["STOCK_RESERVATION_MINUTES"]),
            ),
        )
        for (row, quantity), line in zip(ordered, totals["lines"]):
            db.execute(
                """
                INSERT INTO order_items (
                  order_id, product_id, product_name_snapshot, sku_snapshot,
                  unit_price, quantity, line_subtotal, discount_amount, line_total
                ) VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s)
                """,
                (
                    order_id,
                    row["id"],
                    row["name"],
                    row["sku"],
                    line["unit_price"],
                    quantity,
                    line["line_subtotal"],
                    line["discount_amount"],
                    line["line_total"],
                ),
            )
            reserve_stock(db, row["id"], quantity, order_id, user["id"])
        if promotion:
            consume_promotion(db, promotion, order_id, user["id"])
        delivery_id, _ = db.execute(
            "INSERT INTO deliveries (order_id, status, delivery_fee) VALUES (%s, 'pending', %s)",
            (order_id, totals["delivery_fee"]),
        )
        append_delivery_event(db, delivery_id, "pending", "Order placed", user["id"])
        if payload.get("clear_cart") is True:
            db.execute(
                "UPDATE carts SET status = 'converted' WHERE user_id = %s AND status = 'active'",
                (user["id"],),
            )
        order = db.one("SELECT * FROM orders WHERE id = %s", (order_id,))
        write_audit(
            db,
            user["id"],
            "order.created",
            "order",
            order_id,
            after={"order_number": order_number, "grand_total": money_str(totals["grand_total"])},
        )
        notify_user(
            db,
            user["id"],
            "order_created",
            f"Order {order_number} received",
            f"We reserved stock for order {order_number}. Complete payment before the reservation expires.",
            "order",
            order_id,
        )
        return present_order(db, order, admin=False)

    return run_transaction(work)


def get_order_for_user(user, order_number):
    with db_session() as db:
        order = db.one(
            "SELECT * FROM orders WHERE order_number = %s AND user_id = %s",
            (order_number, user["id"]),
        )
        if not order:
            raise NotFound("Order not found")
        return present_order(db, order, admin=False)


def get_order_for_actor(user, order_number):
    with db_session() as db:
        order = db.one("SELECT * FROM orders WHERE order_number = %s", (order_number,))
        if not order:
            raise NotFound("Order not found")
        if order["user_id"] != user["id"] and "orders.manage" not in user.get("permissions", []):
            raise NotFound("Order not found")
        admin = order["user_id"] != user["id"]
        return present_order(db, order, admin=admin or "orders.manage" in user.get("permissions", []))


def list_orders_for_user(user, page, per_page, offset):
    with db_session() as db:
        total = db.one(
            "SELECT COUNT(*) AS total FROM orders WHERE user_id = %s",
            (user["id"],),
        )["total"]
        rows = db.all(
            """
            SELECT * FROM orders WHERE user_id = %s
            ORDER BY id DESC LIMIT %s OFFSET %s
            """,
            (user["id"], per_page, offset),
        )
        return [present_order(db, row, admin=False) for row in rows], total


def list_admin_orders(page, per_page, offset, status=None, payment_status=None):
    where = ["1=1"]
    params = []
    if status:
        _assert_status(status)
        where.append("status = %s")
        params.append(status)
    if payment_status:
        if payment_status not in {"unpaid", "pending", "paid", "failed", "partially_refunded", "refunded"}:
            raise ValidationError(details={"payment_status": "Unknown payment status"})
        where.append("payment_status = %s")
        params.append(payment_status)
    clause = " AND ".join(where)
    with db_session() as db:
        total = db.one(f"SELECT COUNT(*) AS total FROM orders WHERE {clause}", params)["total"]
        rows = db.all(
            f"""
            SELECT * FROM orders WHERE {clause}
            ORDER BY id DESC LIMIT %s OFFSET %s
            """,
            [*params, per_page, offset],
        )
        return [present_order(db, row, admin=True) for row in rows], total


def cancel_order(user, order_number, reason):
    reason = clean_text(reason, "reason", 255, required=False) or "Cancelled by customer"

    def work(db):
        order = db.one(
            "SELECT * FROM orders WHERE order_number = %s FOR UPDATE",
            (order_number,),
        )
        if not order or order["user_id"] != user["id"]:
            raise NotFound("Order not found")
        if order["status"] != "pending_payment" or order["payment_status"] not in {"unpaid", "pending", "failed"}:
            raise Conflict("This order can no longer be cancelled")
        release_reservation(db, order, user["id"], reason)
        db.execute(
            """
            UPDATE orders
            SET status = 'cancelled', cancelled_at = UTC_TIMESTAMP(), cancellation_reason = %s
            WHERE id = %s
            """,
            (reason, order["id"]),
        )
        write_audit(
            db,
            user["id"],
            "order.cancelled",
            "order",
            order["id"],
            before={"status": order["status"]},
            after={"status": "cancelled", "cancellation_reason": reason},
        )
        updated = db.one("SELECT * FROM orders WHERE id = %s", (order["id"],))
        return present_order(db, updated, admin=False)

    return run_transaction(work)


def admin_update_order(actor, order_number, payload):
    new_status = payload.get("status")
    note = clean_text(payload.get("note"), "note", 255, required=False)
    if new_status is None:
        raise ValidationError(details={"status": "This field is required"})
    _assert_status(new_status)

    def work(db):
        order = db.one("SELECT * FROM orders WHERE order_number = %s FOR UPDATE", (order_number,))
        if not order:
            raise NotFound("Order not found")
        if new_status == order["status"]:
            return present_order(db, order, admin=True)
        if new_status not in ORDER_TRANSITIONS.get(order["status"], set()):
            raise Conflict("That status change is not allowed")
        if new_status == "cancelled" and order["payment_status"] == "paid":
            raise Conflict("Paid orders must be moved to refund pending, not cancelled")
        if new_status == "cancelled":
            release_reservation(db, order, actor["id"], note or "Cancelled by staff")
            db.execute(
                """
                UPDATE orders
                SET status = 'cancelled', cancelled_at = UTC_TIMESTAMP(), cancellation_reason = %s
                WHERE id = %s
                """,
                (note or "Cancelled by staff", order["id"]),
            )
        else:
            db.execute("UPDATE orders SET status = %s WHERE id = %s", (new_status, order["id"]))
            if new_status in FULFILMENT_FOR_STATUS:
                db.execute(
                    "UPDATE orders SET fulfilment_status = %s WHERE id = %s",
                    (FULFILMENT_FOR_STATUS[new_status], order["id"]),
                )
            _sync_delivery(db, order["id"], new_status, actor["id"], note)
        write_audit(
            db,
            actor["id"],
            "order.status_changed",
            "order",
            order["id"],
            before={"status": order["status"]},
            after={"status": new_status, "note": note},
        )
        updated = db.one("SELECT * FROM orders WHERE id = %s", (order["id"],))
        notify_user(
            db,
            order["user_id"],
            "order_status",
            f"Order {order['order_number']} updated",
            f"Order {order['order_number']} is now {new_status.replace('_', ' ')}.",
            "order",
            order["id"],
        )
        return present_order(db, updated, admin=True)

    return run_transaction(work)


def present_order(db, order, admin):
    items = db.all("SELECT * FROM order_items WHERE order_id = %s ORDER BY id", (order["id"],))
    payments = db.all("SELECT * FROM payments WHERE order_id = %s ORDER BY id", (order["id"],))
    delivery = db.one(
        "SELECT * FROM deliveries WHERE order_id = %s ORDER BY id DESC LIMIT 1",
        (order["id"],),
    )
    events = delivery_events(delivery["events_json"]) if delivery else []
    data = {
        "id": order["id"],
        "order_number": order["order_number"],
        "status": order["status"],
        "payment_status": order["payment_status"],
        "fulfilment_status": order["fulfilment_status"],
        "currency": order["currency"],
        "subtotal": money_str(order["subtotal"]),
        "discount_total": money_str(order["discount_total"]),
        "delivery_fee": money_str(order["delivery_fee"]),
        "tax_total": money_str(order["tax_total"]),
        "grand_total": money_str(order["grand_total"]),
        "delivery_address": {
            "recipient_name": order["recipient_name"],
            "recipient_phone": order["recipient_phone"],
            "county": order["county"],
            "town": order["town"],
            "area_or_estate": order["area_or_estate"],
            "building": order["building"],
            "house_or_unit": order["house_or_unit"],
            "delivery_instructions": order["delivery_instructions"],
        },
        "customer_note": order["customer_note"],
        "reservation_expires_at": iso(order["reservation_expires_at"]),
        "requires_review": flag(order["requires_review"]),
        "cancelled_at": iso(order["cancelled_at"]),
        "cancellation_reason": order["cancellation_reason"],
        "created_at": iso(order["created_at"]),
        "updated_at": iso(order["updated_at"]),
        "items": [
            {
                "id": item["id"],
                "product_id": item["product_id"],
                "product_name": item["product_name_snapshot"],
                "sku": item["sku_snapshot"],
                "unit_price": money_str(item["unit_price"]),
                "quantity": item["quantity"],
                "line_subtotal": money_str(item["line_subtotal"]),
                "discount_amount": money_str(item["discount_amount"]),
                "line_total": money_str(item["line_total"]),
            }
            for item in items
        ],
        "payments": [_payment_summary(payment, admin) for payment in payments],
        "delivery": _delivery_summary(delivery, events) if delivery else None,
    }
    if order["requires_review"] and not admin:
        data["review_message"] = (
            "Payment needs confirmation from the store before this order can proceed."
        )
    if admin:
        customer = db.one(
            "SELECT id, first_name, last_name, email, phone FROM users WHERE id = %s",
            (order["user_id"],),
        )
        data["user_id"] = order["user_id"]
        data["customer"] = customer
        data["review_reason"] = order["review_reason"]
        data["stock_finalized"] = flag(order["stock_finalized"])
    return data


def mark_payment_state(db, order_id, payment_status):
    if payment_status == "pending":
        db.execute(
            """
            UPDATE orders SET payment_status = 'pending'
            WHERE id = %s AND payment_status = 'unpaid'
            """,
            (order_id,),
        )
    elif payment_status == "failed":
        db.execute(
            """
            UPDATE orders SET payment_status = 'failed'
            WHERE id = %s AND payment_status <> 'paid'
            """,
            (order_id,),
        )


def apply_successful_payment(db, order, actor_id):
    result = finalize_sale(db, order, actor_id)
    if result == "finalized":
        updated = db.one("SELECT * FROM orders WHERE id = %s", (order["id"],))
        notify_user(
            db,
            order["user_id"],
            "payment_succeeded",
            f"Payment received for {order['order_number']}",
            f"Payment for order {order['order_number']} was confirmed.",
            "order",
            order["id"],
        )
        return updated
    return db.one("SELECT * FROM orders WHERE id = %s", (order["id"],))


def _payment_summary(payment, admin):
    data = {
        "id": payment["id"],
        "provider": payment["provider"],
        "merchant_reference": payment["merchant_reference"],
        "amount": money_str(payment["amount"]),
        "currency": payment["currency"],
        "status": payment["status"],
        "initiated_at": iso(payment["initiated_at"]),
        "confirmed_at": iso(payment["confirmed_at"]),
    }
    if admin:
        data["phone_number"] = payment["phone_number"]
        data["provider_transaction_id"] = payment["provider_transaction_id"]
        data["provider_response_code"] = payment["provider_response_code"]
        data["provider_response_summary"] = payment["provider_response_summary"]
    else:
        data["phone_number"] = _mask_phone(payment["phone_number"])
    return data


def _delivery_summary(delivery, events):
    return {
        "id": delivery["id"],
        "provider": delivery["provider"],
        "tracking_number": delivery["tracking_number"],
        "status": delivery["status"],
        "delivery_fee": money_str(delivery["delivery_fee"]),
        "estimated_delivery_at": iso(delivery["estimated_delivery_at"]),
        "dispatched_at": iso(delivery["dispatched_at"]),
        "delivered_at": iso(delivery["delivered_at"]),
        "failure_reason": delivery["failure_reason"],
        "events": [
            {
                "id": event["id"],
                "status": event["status"],
                "note": event["note"],
                "created_at": iso(event["created_at"]),
            }
            for event in events
        ],
    }


def _sync_delivery(db, order_id, order_status, actor_id, note):
    delivery_status = DELIVERY_FOR_STATUS.get(order_status)
    if not delivery_status:
        return
    delivery = db.one(
        "SELECT * FROM deliveries WHERE order_id = %s ORDER BY id DESC LIMIT 1 FOR UPDATE",
        (order_id,),
    )
    if not delivery:
        return
    extra = ""
    params = [delivery_status]
    if delivery_status == "dispatched":
        extra = ", dispatched_at = COALESCE(dispatched_at, UTC_TIMESTAMP())"
    if delivery_status == "delivered":
        extra = ", delivered_at = COALESCE(delivered_at, UTC_TIMESTAMP())"
    params.append(delivery["id"])
    db.execute(f"UPDATE deliveries SET status = %s{extra} WHERE id = %s", params)
    append_delivery_event(db, delivery["id"], delivery_status, note, actor_id)


def _lock_products(db, items, lock):
    product_ids = sorted(item["product_id"] for item in items)
    placeholders = ", ".join(["%s"] * len(product_ids))
    sql = f"""
        SELECT p.id, p.name, p.sku, p.cash_price, p.currency, p.status, p.is_active, p.handling,
               i.on_hand, i.reserved
        FROM products p
        JOIN inventory i ON i.product_id = p.id
        WHERE p.id IN ({placeholders})
        ORDER BY p.id
    """
    if lock:
        sql += " FOR UPDATE"
    rows = db.all(sql, product_ids)
    if len(rows) != len(product_ids):
        raise ValidationError(details={"items": "One or more products are unavailable"})
    for row in rows:
        if row["status"] != "active" or not row["is_active"]:
            raise ValidationError(details={"items": "One or more products are unavailable"})
    return rows


def _assert_available(rows, items):
    quantities = {item["product_id"]: item["quantity"] for item in items}
    for row in rows:
        available = row["on_hand"] - row["reserved"]
        if quantities[row["id"]] > available:
            raise Conflict(
                "Not enough stock for one or more products",
                code="INSUFFICIENT_STOCK",
                details={"product_id": row["id"]},
            )


def _subtotal(rows, items):
    quantities = {item["product_id"]: item["quantity"] for item in items}
    total = to_money(0)
    for row in rows:
        total = to_money(total + to_money(row["cash_price"]) * quantities[row["id"]])
    return total


def _qty(items, product_id):
    for item in items:
        if item["product_id"] == product_id:
            return item["quantity"]
    return 0


def _row(rows, product_id):
    for row in rows:
        if row["id"] == product_id:
            return row
    raise ValidationError(details={"items": "One or more products are unavailable"})


def _requested_county(db, user, payload):
    raw = payload.get("county")
    if isinstance(raw, str) and raw.strip():
        return raw.strip()
    address = payload.get("address")
    if isinstance(address, dict) and isinstance(address.get("county"), str) and address["county"].strip():
        return address["county"].strip()
    if user and payload.get("address_id") not in (None, ""):
        try:
            address_id = int(payload.get("address_id"))
        except (TypeError, ValueError):
            return None
        row = db.one(
            "SELECT county FROM addresses WHERE id = %s AND user_id = %s",
            (address_id, user["id"]),
        )
        return row["county"] if row else None
    return None


def _fee_settings(db):
    fee = current_app.config["DELIVERY_FEE_KES"]
    threshold = current_app.config["FREE_DELIVERY_THRESHOLD_KES"]
    fee_row = db.one(
        """
        SELECT body AS setting_value FROM site_content
        WHERE entry_type = 'setting' AND slug = 'delivery_fee_kes'
        """
    )
    threshold_row = db.one(
        """
        SELECT body AS setting_value FROM site_content
        WHERE entry_type = 'setting' AND slug = 'free_delivery_threshold_kes'
        """
    )
    if fee_row and fee_row["setting_value"]:
        fee = to_money(fee_row["setting_value"])
    if threshold_row and threshold_row["setting_value"]:
        threshold = to_money(threshold_row["setting_value"])
    return fee, threshold


def _quote_payload(ordered, totals, promotion, delivery_place=None):
    lines = []
    for (row, quantity), priced in zip(ordered, totals["lines"]):
        available = row["on_hand"] - row["reserved"]
        line = {
            "product_id": row["id"],
            "name": row["name"],
            "sku": row["sku"],
            "unit_price": money_str(priced["unit_price"]),
            "quantity": quantity,
            "line_subtotal": money_str(priced["line_subtotal"]),
            "discount_amount": money_str(priced["discount_amount"]),
            "line_total": money_str(priced["line_total"]),
            "available_quantity": available,
        }
        if quantity > available:
            line["stock_warning"] = "Not enough stock"
        lines.append(line)
    return {
        "currency": current_app.config["CURRENCY"],
        "items": lines,
        "subtotal": money_str(totals["subtotal"]),
        "discount_total": money_str(totals["discount_total"]),
        "delivery_fee": money_str(totals["delivery_fee"]),
        "tax_total": money_str(totals["tax_total"]),
        "grand_total": money_str(totals["grand_total"]),
        "promotion_code": promotion["code"] if promotion else None,
        "delivery_place": delivery_place,
        "prices_are_server_calculated": True,
    }


def _unique_order_number(db):
    for _ in range(5):
        stamp = datetime.now(timezone.utc).strftime("%Y%m%d")
        number = f"TW-{stamp}-{secrets.token_hex(3).upper()}"
        if not db.one("SELECT id FROM orders WHERE order_number = %s", (number,)):
            return number
    raise Conflict("Could not allocate an order number")


def _clean_idempotency_key(value):
    if not isinstance(value, str) or not value.strip():
        return None
    key = value.strip()
    if len(key) < 8 or len(key) > 80 or any(char.isspace() for char in key):
        raise ValidationError(details={"Idempotency-Key": "Use 8 to 80 characters without spaces"})
    return key


def _assert_status(status):
    if status not in ORDER_TRANSITIONS:
        raise ValidationError(details={"status": "Unknown order status"})


def _mask_phone(phone):
    if not phone or len(phone) < 7:
        return None
    return phone[:6] + "****" + phone[-3:]


def _unused_redacted():
    return dumps_redacted({})
