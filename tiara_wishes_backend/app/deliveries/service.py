import json

from app.audit.service import write_audit
from app.common.errors import NotFound, ValidationError
from app.common.money import money_str
from app.common.serializers import iso
from app.common.transactions import run_transaction
from app.common.validation import clean_text
from app.db.connection import db_session
from app.notifications.service import notify_user

DELIVERY_STATUSES = {
    "pending",
    "processing",
    "packed",
    "dispatched",
    "in_transit",
    "delivered",
    "failed",
    "returned",
}
ORDER_FULFILMENT = {
    "pending": "unfulfilled",
    "processing": "processing",
    "packed": "packed",
    "dispatched": "dispatched",
    "in_transit": "dispatched",
    "delivered": "delivered",
    "failed": "failed_delivery",
    "returned": "returned",
}
ORDER_STATUS = {
    "dispatched": "dispatched",
    "in_transit": "dispatched",
    "delivered": "delivered",
}


def delivery_events(value):
    if not value:
        return []
    if isinstance(value, (bytes, str)):
        value = json.loads(value)
    if not isinstance(value, list):
        return []
    return value


def append_delivery_event(db, delivery_id, status, note, created_by):
    row = db.one("SELECT events_json FROM deliveries WHERE id = %s FOR UPDATE", (delivery_id,))
    events = delivery_events(row["events_json"] if row else None)
    now = db.one(
        "SELECT DATE_FORMAT(UTC_TIMESTAMP(), '%%Y-%%m-%%dT%%H:%%i:%%sZ') AS now_utc"
    )["now_utc"]
    events.append(
        {
            "id": len(events) + 1,
            "status": status,
            "note": note,
            "created_by": created_by,
            "created_at": now,
        }
    )
    db.execute(
        "UPDATE deliveries SET events_json = %s WHERE id = %s",
        (json.dumps(events), delivery_id),
    )


def list_deliveries(page, per_page, offset, status=None):
    where = "1=1"
    params = []
    if status:
        if status not in DELIVERY_STATUSES:
            raise ValidationError(details={"status": "Unknown delivery status"})
        where = "d.status = %s"
        params.append(status)
    with db_session() as db:
        total = db.one(f"SELECT COUNT(*) AS total FROM deliveries d WHERE {where}", params)["total"]
        rows = db.all(
            f"""
            SELECT d.*, o.order_number
            FROM deliveries d
            JOIN orders o ON o.id = d.order_id
            WHERE {where}
            ORDER BY d.id DESC
            LIMIT %s OFFSET %s
            """,
            [*params, per_page, offset],
        )
    return [_present(row) for row in rows], total


def update_delivery(actor, delivery_id, data):
    status = data.get("status")
    if status not in DELIVERY_STATUSES:
        raise ValidationError(details={"status": "Unknown delivery status"})
    note = clean_text(data.get("note"), "note", 255, required=False)
    provider = clean_text(data.get("provider"), "provider", 80, required=False) if "provider" in data else None
    tracking = clean_text(data.get("tracking_number"), "tracking_number", 80, required=False) if "tracking_number" in data else None
    failure = clean_text(data.get("failure_reason"), "failure_reason", 255, required=False) if "failure_reason" in data else None

    def work(db):
        delivery = db.one("SELECT * FROM deliveries WHERE id = %s FOR UPDATE", (delivery_id,))
        if not delivery:
            raise NotFound("Delivery not found")
        order = db.one("SELECT * FROM orders WHERE id = %s FOR UPDATE", (delivery["order_id"],))
        db.execute(
            """
            UPDATE deliveries
            SET status = %s,
                provider = COALESCE(%s, provider),
                tracking_number = COALESCE(%s, tracking_number),
                failure_reason = %s,
                dispatched_at = CASE
                  WHEN %s IN ('dispatched', 'in_transit', 'delivered') THEN COALESCE(dispatched_at, UTC_TIMESTAMP())
                  ELSE dispatched_at
                END,
                delivered_at = CASE
                  WHEN %s = 'delivered' THEN COALESCE(delivered_at, UTC_TIMESTAMP())
                  ELSE delivered_at
                END
            WHERE id = %s
            """,
            (status, provider, tracking, failure, status, status, delivery_id),
        )
        append_delivery_event(db, delivery_id, status, note, actor["id"])
        fulfilment = ORDER_FULFILMENT[status]
        db.execute(
            "UPDATE orders SET fulfilment_status = %s WHERE id = %s",
            (fulfilment, order["id"]),
        )
        next_status = ORDER_STATUS.get(status)
        if next_status and order["status"] not in {"cancelled", "refunded", "refund_pending"}:
            db.execute("UPDATE orders SET status = %s WHERE id = %s", (next_status, order["id"]))
        write_audit(
            db,
            actor["id"],
            "delivery.updated",
            "delivery",
            delivery_id,
            before={"status": delivery["status"]},
            after={"status": status, "note": note},
        )
        notify_user(
            db,
            order["user_id"],
            "delivery_updated",
            f"Delivery update for {order['order_number']}",
            f"Delivery for order {order['order_number']} is now {status.replace('_', ' ')}.",
            "delivery",
            delivery_id,
        )
        updated = db.one(
            """
            SELECT d.*, o.order_number
            FROM deliveries d JOIN orders o ON o.id = d.order_id
            WHERE d.id = %s
            """,
            (delivery_id,),
        )
        return _present(updated)

    return run_transaction(work)


def _present(row):
    return {
        "id": row["id"],
        "order_id": row["order_id"],
        "order_number": row.get("order_number"),
        "provider": row["provider"],
        "tracking_number": row["tracking_number"],
        "status": row["status"],
        "delivery_fee": money_str(row["delivery_fee"]),
        "estimated_delivery_at": iso(row["estimated_delivery_at"]),
        "dispatched_at": iso(row["dispatched_at"]),
        "delivered_at": iso(row["delivered_at"]),
        "failure_reason": row["failure_reason"],
        "updated_at": iso(row["updated_at"]),
    }
