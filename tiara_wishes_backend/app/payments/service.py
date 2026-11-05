import json
import secrets

import pymysql
from flask import current_app, request

from app.audit.service import write_audit
from app.common.errors import AppError, Conflict, Forbidden, NotFound, ValidationError
from app.common.money import money_str, to_money
from app.common.security import sign_body, signatures_match
from app.common.serializers import iso
from app.common.transactions import run_transaction
from app.common.validation import normalize_phone
from app.db.connection import db_session
from app.orders.service import apply_successful_payment, mark_payment_state, present_order
from app.payments.providers import get_provider

TERMINAL_SUCCESS = {"succeeded", "refunded", "partially_refunded"}


def initiate_payment(user, order_number, payload, idempotency_key=None):
    provider_name = payload.get("provider") or current_app.config["PAYMENT_PROVIDER"]
    if provider_name == "manual":
        raise ValidationError(details={"provider": "Unsupported payment provider"})
    provider = get_provider(provider_name)
    paybill_ready = (
        provider_name == "mpesa"
        and str(current_app.config.get("MPESA_PAYBILL") or "").strip()
        and str(current_app.config.get("MPESA_ACCOUNT") or "").strip()
    )
    phone = None
    if (provider_name == "mpesa" and not paybill_ready) or payload.get("phone_number"):
        phone = normalize_phone(payload.get("phone_number"), "phone_number", required=True)
    if idempotency_key is not None and (not isinstance(idempotency_key, str) or len(idempotency_key.strip()) < 8):
        raise ValidationError(details={"Idempotency-Key": "Use 8 to 80 characters without spaces"})
    idempotency_key = idempotency_key.strip()[:80] if isinstance(idempotency_key, str) else None

    def prepare(db):
        order = db.one(
            "SELECT * FROM orders WHERE order_number = %s FOR UPDATE",
            (order_number,),
        )
        if not order or order["user_id"] != user["id"]:
            raise NotFound("Order not found")
        if order["status"] == "cancelled":
            raise Conflict("This order can no longer be paid")
        if order["payment_status"] in {"paid", "refunded", "partially_refunded"}:
            raise Conflict("This order has already been paid")
        if idempotency_key:
            existing = db.one(
                "SELECT * FROM payments WHERE order_id = %s AND idempotency_key = %s",
                (order["id"], idempotency_key),
            )
            if existing:
                return {"existing": _present(existing, admin=False), "order": None, "payment": None}
        recent = db.one(
            """
            SELECT * FROM payments
            WHERE order_id = %s AND status IN ('initiated', 'pending')
              AND initiated_at > DATE_SUB(UTC_TIMESTAMP(), INTERVAL 2 MINUTE)
            ORDER BY id DESC LIMIT 1
            """,
            (order["id"],),
        )
        if recent and not idempotency_key:
            return {"existing": _present(recent, admin=False), "order": None, "payment": None}
        reference = _reference(db)
        payment_id, _ = db.execute(
            """
            INSERT INTO payments (
              order_id, user_id, provider, merchant_reference, idempotency_key,
              amount, currency, status, phone_number
            ) VALUES (%s, %s, %s, %s, %s, %s, %s, 'initiated', %s)
            """,
            (
                order["id"],
                user["id"],
                provider_name,
                reference,
                idempotency_key,
                order["grand_total"],
                order["currency"],
                phone,
            ),
        )
        payment = db.one("SELECT * FROM payments WHERE id = %s", (payment_id,))
        return {"existing": None, "order": order, "payment": payment}

    prepared = run_transaction(prepare)
    if prepared["existing"]:
        return prepared["existing"]

    payment = prepared["payment"]
    try:
        result = provider.initiate(payment, phone)
    except AppError:
        _mark_provider_failure(payment["id"], "provider_unreachable")
        raise

    def finish(db):
        current = db.one("SELECT * FROM payments WHERE id = %s FOR UPDATE", (payment["id"],))
        summary = json.dumps(result["summary"])[:1000]
        db.execute(
            """
            UPDATE payments
            SET status = %s,
                provider_transaction_id = %s,
                provider_response_code = %s,
                provider_response_summary = %s
            WHERE id = %s
            """,
            (
                result["provider_status"],
                result.get("provider_transaction_id"),
                result.get("response_code"),
                summary,
                payment["id"],
            ),
        )
        if result["provider_status"] == "pending":
            mark_payment_state(db, current["order_id"], "pending")
        elif result["provider_status"] == "failed":
            mark_payment_state(db, current["order_id"], "failed")
        updated = db.one("SELECT * FROM payments WHERE id = %s", (payment["id"],))
        data = _present(updated, admin=False)
        data["next_step"] = result["client_payload"]
        return data

    return run_transaction(finish)


def get_payment(user, merchant_reference):
    with db_session() as db:
        payment = db.one(
            "SELECT * FROM payments WHERE merchant_reference = %s",
            (merchant_reference,),
        )
        if not payment:
            raise NotFound("Payment not found")
        if payment["user_id"] != user["id"] and "payments.manage" not in user.get("permissions", []):
            raise NotFound("Payment not found")
        admin = "payments.manage" in user.get("permissions", [])
        return _present(payment, admin=admin)


def handle_webhook(provider_name, raw_body):
    if provider_name == "mock":
        _verify_mock(raw_body)
        payload = request.get_json(silent=True)
        if not isinstance(payload, dict):
            raise ValidationError("Webhook body must be a JSON object")
        return _apply_mock(payload)
    if provider_name == "mpesa":
        _verify_mpesa()
        return _apply_mpesa(request.get_json(silent=True) or {})
    raise NotFound("Unknown payment provider")


def admin_update_payment(actor, payment_id, payload):
    status = payload.get("status")
    note = payload.get("note")
    if status not in {"succeeded", "failed", "cancelled"}:
        raise ValidationError(details={"status": "Status must be succeeded, failed, or cancelled"})
    if not isinstance(note, str) or len(note.strip()) < 8:
        raise ValidationError(details={"note": "Enter a reconciliation note of at least 8 characters"})

    def work(db):
        payment = db.one("SELECT * FROM payments WHERE id = %s FOR UPDATE", (payment_id,))
        if not payment:
            raise NotFound("Payment not found")
        before = payment["status"]
        _apply_status(
            db,
            payment,
            status,
            payment.get("provider_transaction_id"),
            "MANUAL",
            {"result_code": "MANUAL", "result_desc": note.strip()[:180]},
            actor["id"],
        )
        write_audit(
            db,
            actor["id"],
            "payment.reconciled",
            "payment",
            payment_id,
            before={"status": before},
            after={"status": status, "note": note.strip()},
        )
        updated = db.one("SELECT * FROM payments WHERE id = %s", (payment_id,))
        return _present(updated, admin=True)

    return run_transaction(work)


def list_payments(page, per_page, offset, status=None):
    where = "1=1"
    params = []
    if status:
        where = "status = %s"
        params.append(status)
    with db_session() as db:
        total = db.one(f"SELECT COUNT(*) AS total FROM payments WHERE {where}", params)["total"]
        rows = db.all(
            f"""
            SELECT * FROM payments WHERE {where}
            ORDER BY id DESC LIMIT %s OFFSET %s
            """,
            [*params, per_page, offset],
        )
    return [_present(row, admin=True) for row in rows], total


def record_refund(actor, payload):
    from app.common.validation import parse_money, parse_positive_int

    payment_id = parse_positive_int(payload.get("payment_id"), "payment_id")
    amount = parse_money(payload.get("amount"), "amount", allow_zero=False)
    reason = payload.get("reason")
    if not isinstance(reason, str) or len(reason.strip()) < 3:
        raise ValidationError(details={"reason": "Enter a reason"})

    def work(db):
        payment = db.one("SELECT * FROM payments WHERE id = %s FOR UPDATE", (payment_id,))
        if not payment or payment["status"] not in {"succeeded", "partially_refunded"}:
            raise Conflict("Only a successful payment can have a refund recorded")
        order = db.one("SELECT * FROM orders WHERE id = %s FOR UPDATE", (payment["order_id"],))
        already = db.one(
            """
            SELECT COALESCE(SUM(amount), 0) AS total
            FROM refunds WHERE payment_id = %s AND status = 'recorded'
            """,
            (payment_id,),
        )["total"]
        remaining = to_money(payment["amount"]) - to_money(already)
        if amount > remaining:
            raise ValidationError(details={"amount": "Refund exceeds the remaining payment amount"})
        refund_id, _ = db.execute(
            """
            INSERT INTO refunds (
              payment_id, order_id, amount, reason, status, requested_by, processed_by
            ) VALUES (%s, %s, %s, %s, 'recorded', %s, %s)
            """,
            (payment_id, order["id"], amount, reason.strip()[:255], actor["id"], actor["id"]),
        )
        full = amount == remaining
        payment_status = "refunded" if full else "partially_refunded"
        order_status_sql = "status = 'refunded'," if full else ""
        db.execute(
            f"""
            UPDATE payments SET status = %s WHERE id = %s
            """,
            (payment_status, payment_id),
        )
        db.execute(
            f"""
            UPDATE orders
            SET {order_status_sql} payment_status = %s
            WHERE id = %s
            """,
            (payment_status, order["id"]),
        )
        write_audit(
            db,
            actor["id"],
            "refund.recorded",
            "refund",
            refund_id,
            after={
                "payment_id": payment_id,
                "amount": money_str(amount),
                "provider_refund_sent": False,
                "note": "Tracking only. No provider refund was sent.",
            },
        )
        return {
            "id": refund_id,
            "payment_id": payment_id,
            "order_id": order["id"],
            "amount": money_str(amount),
            "status": "recorded",
            "provider_refund_id": None,
            "provider_refund_sent": False,
        }

    return run_transaction(work)


def _apply_mock(payload):
    event_key = payload.get("event_key")
    reference = payload.get("merchant_reference")
    status = payload.get("status")
    if not isinstance(event_key, str) or not event_key.strip():
        raise ValidationError(details={"event_key": "This field is required"})
    if status not in {"succeeded", "failed", "pending", "cancelled"}:
        raise ValidationError(details={"status": "Unsupported payment status"})
    if not isinstance(reference, str):
        raise ValidationError(details={"merchant_reference": "This field is required"})
    summary = {
        "result_code": str(payload.get("result_code", ""))[:32],
        "result_desc": str(payload.get("result_desc", status))[:180],
    }
    return _apply_reference(
        "mock",
        event_key.strip()[:191],
        reference,
        status,
        payload.get("provider_transaction_id"),
        summary,
    )


def _apply_mpesa(payload):
    callback = {}
    if isinstance(payload, dict):
        callback = payload.get("Body", {}).get("stkCallback", {}) or {}
    checkout_id = callback.get("CheckoutRequestID")
    if not checkout_id:
        raise ValidationError(details={"CheckoutRequestID": "Missing checkout request id"})
    result_code = str(callback.get("ResultCode", ""))
    result_desc = str(callback.get("ResultDesc", ""))[:180]
    receipt = None
    amount = None
    metadata = callback.get("CallbackMetadata") or {}
    for item in metadata.get("Item") or []:
        if not isinstance(item, dict):
            continue
        if item.get("Name") == "MpesaReceiptNumber" and item.get("Value") is not None:
            receipt = str(item.get("Value"))[:128]
        if item.get("Name") == "Amount" and item.get("Value") is not None:
            amount = to_money(item.get("Value"))
    status = "succeeded" if result_code == "0" else "failed"
    event_key = f"{checkout_id}:{result_code}"[:191]

    def work(db):
        if _event_exists(db, "mpesa", event_key):
            return {"idempotent": True}
        payment = db.one(
            """
            SELECT * FROM payments
            WHERE provider = 'mpesa' AND provider_transaction_id = %s
            FOR UPDATE
            """,
            (checkout_id,),
        )
        if not payment:
            raise NotFound("Payment not found")
        if status == "succeeded" and amount is not None and amount != to_money(payment["amount"]):
            _insert_event(db, "mpesa", event_key, payment["id"], {"result_code": result_code, "result_desc": "amount_mismatch"})
            db.execute(
                """
                UPDATE orders
                SET requires_review = 1, review_reason = 'amount_mismatch'
                WHERE id = %s
                """,
                (payment["order_id"],),
            )
            db.execute(
                """
                UPDATE payments
                SET provider_response_code = %s, provider_response_summary = %s
                WHERE id = %s
                """,
                (result_code, json.dumps({"result_code": result_code, "result_desc": "amount_mismatch"}), payment["id"]),
            )
            write_audit(
                db,
                None,
                "payment.amount_mismatch",
                "payment",
                payment["id"],
                after={"expected": money_str(payment["amount"]), "received": money_str(amount)},
            )
            return {"idempotent": False, "requires_review": True}
        _insert_event(db, "mpesa", event_key, payment["id"], {"result_code": result_code, "result_desc": result_desc})
        _apply_status(
            db,
            payment,
            status,
            receipt or checkout_id,
            result_code,
            {"result_code": result_code, "result_desc": result_desc},
            None,
        )
        return {"idempotent": False, "status": status}

    return _run_webhook(work)


def _apply_reference(provider, event_key, reference, status, provider_transaction_id, summary):
    def work(db):
        if _event_exists(db, provider, event_key):
            return {"idempotent": True, "status": status}
        payment = db.one(
            "SELECT * FROM payments WHERE merchant_reference = %s FOR UPDATE",
            (reference,),
        )
        if not payment or payment["provider"] != provider:
            raise NotFound("Payment not found")
        _insert_event(db, provider, event_key, payment["id"], summary)
        _apply_status(db, payment, status, provider_transaction_id, summary.get("result_code"), summary, None)
        return {"idempotent": False, "status": status}

    return _run_webhook(work)


def _run_webhook(work):
    try:
        return run_transaction(work)
    except pymysql.err.IntegrityError as exc:
        if exc.args and exc.args[0] == 1062:
            return {"idempotent": True}
        raise


def _apply_status(db, payment, new_status, provider_transaction_id, response_code, summary, actor_id):
    if payment["status"] in TERMINAL_SUCCESS and new_status != payment["status"]:
        return
    if payment["status"] == "succeeded" and new_status == "succeeded":
        return
    db.execute(
        """
        UPDATE payments
        SET status = %s,
            provider_transaction_id = COALESCE(%s, provider_transaction_id),
            provider_response_code = %s,
            provider_response_summary = %s,
            confirmed_at = CASE WHEN %s = 'succeeded' THEN UTC_TIMESTAMP() ELSE confirmed_at END
        WHERE id = %s
        """,
        (
            new_status,
            provider_transaction_id,
            None if response_code is None else str(response_code)[:32],
            json.dumps(summary)[:1000],
            new_status,
            payment["id"],
        ),
    )
    order = db.one("SELECT * FROM orders WHERE id = %s FOR UPDATE", (payment["order_id"],))
    if new_status == "succeeded":
        apply_successful_payment(db, order, actor_id)
        write_audit(
            db,
            actor_id,
            "payment.succeeded",
            "payment",
            payment["id"],
            before={"status": payment["status"]},
            after={"status": "succeeded", "merchant_reference": payment["merchant_reference"]},
        )
    elif new_status in {"failed", "cancelled"} and order["payment_status"] != "paid":
        mark_payment_state(db, order["id"], "failed")
        write_audit(
            db,
            actor_id,
            "payment.failed",
            "payment",
            payment["id"],
            before={"status": payment["status"]},
            after={"status": new_status},
        )
    elif new_status == "pending":
        mark_payment_state(db, order["id"], "pending")


def _event_exists(db, provider, event_key):
    return db.one(
        "SELECT id FROM payment_webhook_events WHERE provider = %s AND event_key = %s",
        (provider, event_key),
    )


def _insert_event(db, provider, event_key, payment_id, summary):
    db.execute(
        """
        INSERT INTO payment_webhook_events (provider, event_key, payment_id, payload_summary)
        VALUES (%s, %s, %s, %s)
        """,
        (provider, event_key, payment_id, json.dumps(summary)),
    )


def _verify_mock(raw_body):
    secret = current_app.config.get("PAYMENT_WEBHOOK_SECRET") or ""
    if not secret or current_app.config["FLASK_ENV"] == "production" or not current_app.config["PAYMENT_MOCK_ENABLED"]:
        raise AppError("PAYMENT_NOT_CONFIGURED", "Mock payments are disabled", 403)
    provided = request.headers.get("X-Tiara-Signature", "")
    if not signatures_match(provided, sign_body(raw_body, secret)):
        raise Forbidden("Invalid payment signature")


def _verify_mpesa():
    expected = current_app.config.get("MPESA_CALLBACK_SECRET") or ""
    if not expected:
        raise AppError("PAYMENT_NOT_CONFIGURED", "M-Pesa callback secret is not configured", 503)
    provided = request.args.get("token", "")
    if not signatures_match(provided, expected):
        raise Forbidden("Invalid callback token")


def _mark_provider_failure(payment_id, code):
    def work(db):
        payment = db.one("SELECT * FROM payments WHERE id = %s FOR UPDATE", (payment_id,))
        if not payment or payment["status"] in TERMINAL_SUCCESS:
            return
        db.execute(
            """
            UPDATE payments
            SET status = 'failed', provider_response_code = %s,
                provider_response_summary = %s
            WHERE id = %s AND status = 'initiated'
            """,
            (code, json.dumps({"result_code": code, "result_desc": "Provider request failed"}), payment_id),
        )

    run_transaction(work)


def _reference(db):
    for _ in range(5):
        reference = "PAY-" + secrets.token_hex(8).upper()
        if not db.one("SELECT id FROM payments WHERE merchant_reference = %s", (reference,)):
            return reference
    raise Conflict("Could not allocate a payment reference")


def _present(payment, admin):
    order_number = None
    with db_session() as db:
        row = db.one("SELECT order_number FROM orders WHERE id = %s", (payment["order_id"],))
        if row:
            order_number = row["order_number"]
    data = {
        "id": payment["id"],
        "order_number": order_number,
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
    return data
