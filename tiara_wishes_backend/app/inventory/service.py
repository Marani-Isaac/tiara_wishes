from app.audit.service import write_audit
from app.common.errors import Conflict, NotFound, ValidationError
from app.common.transactions import run_transaction
from app.db.connection import db_session


def reserve_stock(db, product_id, quantity, order_id, actor_id):
    _, count = db.execute(
        """
        UPDATE inventory
        SET reserved = reserved + %s
        WHERE product_id = %s AND on_hand - reserved >= %s
        """,
        (quantity, product_id, quantity),
    )
    if count != 1:
        raise Conflict(
            "Not enough stock for one or more products",
            code="INSUFFICIENT_STOCK",
            details={"product_id": product_id},
        )
    db.execute(
        """
        INSERT INTO inventory_movements (
          product_id, movement_type, quantity_change, reference_type,
          reference_id, reason, created_by
        ) VALUES (%s, 'order_reservation', %s, 'order', %s, %s, %s)
        """,
        (product_id, -quantity, order_id, "Reserved for unpaid order", actor_id),
    )


def release_reservation(db, order, actor_id, reason):
    if order["stock_finalized"]:
        return
    items = db.all(
        "SELECT * FROM order_items WHERE order_id = %s ORDER BY product_id",
        (order["id"],),
    )
    for item in items:
        if not item["product_id"]:
            continue
        _, count = db.execute(
            """
            UPDATE inventory
            SET reserved = reserved - %s
            WHERE product_id = %s AND reserved >= %s
            """,
            (item["quantity"], item["product_id"], item["quantity"]),
        )
        if count != 1:
            raise Conflict("Stock reservation could not be released")
        db.execute(
            """
            INSERT INTO inventory_movements (
              product_id, movement_type, quantity_change, reference_type,
              reference_id, reason, created_by
            ) VALUES (%s, 'reservation_release', %s, 'order', %s, %s, %s)
            """,
            (item["product_id"], item["quantity"], order["id"], reason, actor_id),
        )


def finalize_sale(db, order, actor_id):
    """Convert a reservation into a sale exactly once, or flag the order for review."""
    if order["status"] == "cancelled":
        db.execute(
            """
            UPDATE orders
            SET payment_status = 'paid', requires_review = 1,
                review_reason = 'paid_after_reservation_expired'
            WHERE id = %s
            """,
            (order["id"],),
        )
        return "review"
    if order["stock_finalized"]:
        db.execute("UPDATE orders SET payment_status = 'paid' WHERE id = %s", (order["id"],))
        return "already"
    items = db.all(
        "SELECT * FROM order_items WHERE order_id = %s ORDER BY product_id",
        (order["id"],),
    )
    for item in items:
        inventory = db.one(
            "SELECT on_hand, reserved FROM inventory WHERE product_id = %s FOR UPDATE",
            (item["product_id"],),
        )
        if (
            not inventory
            or inventory["reserved"] < item["quantity"]
            or inventory["on_hand"] < item["quantity"]
        ):
            db.execute(
                """
                UPDATE orders
                SET payment_status = 'paid', requires_review = 1, review_reason = 'stock_mismatch'
                WHERE id = %s
                """,
                (order["id"],),
            )
            return "review"
    for item in items:
        _, count = db.execute(
            """
            UPDATE inventory
            SET on_hand = on_hand - %s, reserved = reserved - %s
            WHERE product_id = %s AND reserved >= %s AND on_hand >= %s
            """,
            (
                item["quantity"],
                item["quantity"],
                item["product_id"],
                item["quantity"],
                item["quantity"],
            ),
        )
        if count != 1:
            raise Conflict("Stock could not be finalized", code="STOCK_MISMATCH")
        db.execute(
            """
            INSERT INTO inventory_movements (
              product_id, movement_type, quantity_change, reference_type,
              reference_id, reason, created_by
            ) VALUES (%s, 'sale', %s, 'order', %s, 'Sale finalized after payment', %s)
            """,
            (item["product_id"], -item["quantity"], order["id"], actor_id),
        )
    db.execute(
        """
        UPDATE orders
        SET payment_status = 'paid',
            stock_finalized = 1,
            requires_review = 0,
            review_reason = NULL,
            status = CASE
              WHEN status IN ('pending_payment', 'failed') THEN 'confirmed'
              ELSE status
            END
        WHERE id = %s
        """,
        (order["id"],),
    )
    return "finalized"


def release_expired_reservations():
    released = 0
    with db_session() as db:
        rows = db.all(
            """
            SELECT id FROM orders
            WHERE status = 'pending_payment'
              AND stock_finalized = 0
              AND reservation_expires_at IS NOT NULL
              AND reservation_expires_at < UTC_TIMESTAMP()
            ORDER BY id
            FOR UPDATE
            """
        )
        for row in rows:
            order = db.one("SELECT * FROM orders WHERE id = %s FOR UPDATE", (row["id"],))
            if not order or order["status"] != "pending_payment" or order["stock_finalized"]:
                continue
            paid = db.one(
                """
                SELECT id FROM payments
                WHERE order_id = %s AND status = 'succeeded'
                LIMIT 1
                """,
                (order["id"],),
            )
            if paid:
                continue
            release_reservation(db, order, None, "Reservation expired")
            db.execute(
                """
                UPDATE orders
                SET status = 'cancelled',
                    cancelled_at = UTC_TIMESTAMP(),
                    cancellation_reason = 'reservation_expired'
                WHERE id = %s AND status = 'pending_payment'
                """,
                (order["id"],),
            )
            write_audit(
                db,
                None,
                "order.reservation_expired",
                "order",
                order["id"],
                before={"status": "pending_payment"},
                after={"status": "cancelled", "cancellation_reason": "reservation_expired"},
            )
            released += 1
    return released


def list_inventory(page, per_page, offset, low_stock_only=False):
    where = "1=1"
    if low_stock_only:
        where = "(i.on_hand - i.reserved) <= p.low_stock_threshold"
    with db_session() as db:
        total = db.one(
            f"""
            SELECT COUNT(*) AS total
            FROM inventory i
            JOIN products p ON p.id = i.product_id
            WHERE {where}
            """
        )["total"]
        rows = db.all(
            f"""
            SELECT p.id AS product_id, p.name, p.sku, p.low_stock_threshold, p.status,
                   i.on_hand, i.reserved, (i.on_hand - i.reserved) AS available
            FROM inventory i
            JOIN products p ON p.id = i.product_id
            WHERE {where}
            ORDER BY available ASC, p.name ASC
            LIMIT %s OFFSET %s
            """,
            (per_page, offset),
        )
    return [
        {
            "product_id": row["product_id"],
            "name": row["name"],
            "sku": row["sku"],
            "status": row["status"],
            "low_stock_threshold": row["low_stock_threshold"],
            "on_hand": row["on_hand"],
            "reserved": row["reserved"],
            "available": row["available"],
        }
        for row in rows
    ], total


def adjust_stock(actor, product_id, quantity_change, movement_type, reason):
    allowed = {"opening_stock", "restock", "return", "adjustment"}
    if movement_type not in allowed:
        raise ValidationError(details={"movement_type": "Unsupported adjustment type"})
    if not isinstance(quantity_change, int) or isinstance(quantity_change, bool) or quantity_change == 0:
        raise ValidationError(details={"quantity_change": "Enter a non-zero whole number"})
    if movement_type in {"opening_stock", "restock", "return"} and quantity_change < 0:
        raise ValidationError(details={"quantity_change": "This movement must increase stock"})
    if not isinstance(reason, str) or len(reason.strip()) < 3:
        raise ValidationError(details={"reason": "Enter a short reason"})

    def work(db):
        inventory = db.one(
            "SELECT * FROM inventory WHERE product_id = %s FOR UPDATE",
            (product_id,),
        )
        product = db.one("SELECT id, name, sku FROM products WHERE id = %s", (product_id,))
        if not inventory or not product:
            raise NotFound("Product stock record not found")
        new_on_hand = inventory["on_hand"] + quantity_change
        if new_on_hand < 0 or new_on_hand < inventory["reserved"]:
            raise Conflict("That adjustment would make stock inconsistent")
        db.execute(
            "UPDATE inventory SET on_hand = %s WHERE product_id = %s",
            (new_on_hand, product_id),
        )
        db.execute(
            """
            INSERT INTO inventory_movements (
              product_id, movement_type, quantity_change, reference_type,
              reason, created_by
            ) VALUES (%s, %s, %s, 'adjustment', %s, %s)
            """,
            (product_id, movement_type, quantity_change, reason.strip()[:255], actor["id"]),
        )
        write_audit(
            db,
            actor["id"],
            "inventory.adjusted",
            "product",
            product_id,
            before={"on_hand": inventory["on_hand"], "reserved": inventory["reserved"]},
            after={"on_hand": new_on_hand, "reserved": inventory["reserved"], "reason": reason.strip()},
        )
        return {
            "product_id": product_id,
            "on_hand": new_on_hand,
            "reserved": inventory["reserved"],
            "available": new_on_hand - inventory["reserved"],
        }

    return run_transaction(work)
