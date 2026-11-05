from datetime import datetime, timedelta, timezone
from zoneinfo import ZoneInfo

from flask import current_app

from app.common.errors import ValidationError
from app.common.money import money_str
from app.db.connection import db_session


def sales_report(from_date, to_date):
    start, end = period_bounds(from_date, to_date)
    with db_session() as db:
        row = db.one(
            """
            SELECT COALESCE(SUM(
              CASE
                WHEN p.status = 'succeeded' THEN p.amount
                WHEN p.status = 'partially_refunded' THEN p.amount - COALESCE((
                  SELECT SUM(r.amount) FROM refunds r
                  WHERE r.payment_id = p.id AND r.status = 'recorded'
                ), 0)
                ELSE 0
              END
            ), 0) AS sales,
            COUNT(DISTINCT CASE WHEN p.status IN ('succeeded', 'partially_refunded') THEN p.order_id END) AS orders
            FROM payments p
            JOIN orders o ON o.id = p.order_id
            WHERE p.confirmed_at >= %s AND p.confirmed_at < %s
              AND o.status <> 'cancelled'
              AND p.status IN ('succeeded', 'partially_refunded')
            """,
            (start, end),
        )
    return {
        "from": from_date,
        "to": to_date,
        "currency": current_app.config["CURRENCY"],
        "paid_sales": money_str(row["sales"]),
        "paid_orders": int(row["orders"] or 0),
        "rule": (
            "Paid sales are succeeded payments, plus partially refunded payments net of recorded refunds. "
            "Pending, failed, cancelled, and fully refunded payments are excluded. "
            "Recording a refund restates the original payment period. This does not send money to a provider."
        ),
    }


def product_report(from_date, to_date):
    start, end = period_bounds(from_date, to_date)
    with db_session() as db:
        rows = db.all(
            """
            SELECT oi.product_id, oi.sku_snapshot AS sku, oi.product_name_snapshot AS name,
                   SUM(oi.quantity) AS units, SUM(oi.line_total) AS revenue
            FROM order_items oi
            JOIN orders o ON o.id = oi.order_id
            WHERE o.created_at >= %s AND o.created_at < %s
              AND o.payment_status IN ('paid', 'partially_refunded')
              AND o.status NOT IN ('cancelled', 'refunded', 'refund_pending')
            GROUP BY oi.product_id, oi.sku_snapshot, oi.product_name_snapshot
            ORDER BY revenue DESC, sku ASC
            """,
            (start, end),
        )
    return {
        "from": from_date,
        "to": to_date,
        "products": [
            {
                "product_id": row["product_id"],
                "sku": row["sku"],
                "name": row["name"],
                "units": int(row["units"]),
                "revenue": money_str(row["revenue"]),
            }
            for row in rows
        ],
    }


def period_bounds(from_date, to_date):
    try:
        tz = ZoneInfo(current_app.config["BUSINESS_TIMEZONE"])
    except Exception:
        tz = timezone.utc
    if not from_date and not to_date:
        now = datetime.now(tz)
        start_local = now.replace(hour=0, minute=0, second=0, microsecond=0)
        end_local = start_local + timedelta(days=1)
    else:
        try:
            start_local = datetime.strptime(from_date, "%Y-%m-%d").replace(tzinfo=tz)
            end_day = datetime.strptime(to_date, "%Y-%m-%d").replace(tzinfo=tz)
        except (TypeError, ValueError) as exc:
            raise ValidationError(details={"from": "Use YYYY-MM-DD dates"}) from exc
        end_local = end_day + timedelta(days=1)
    if end_local <= start_local or (end_local - start_local).days > 366:
        raise ValidationError(details={"from": "Choose a range of 1 to 366 days"})
    return (
        start_local.astimezone(timezone.utc).replace(tzinfo=None),
        end_local.astimezone(timezone.utc).replace(tzinfo=None),
    )
