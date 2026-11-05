from app.common.money import money_str
from app.common.serializers import iso
from app.db.connection import db_session
from app.reports.service import period_bounds


NAV_COUNT_QUERIES = (
    ("products", ("products.manage",), "SELECT COUNT(*) FROM products"),
    ("categories", ("categories.manage",), "SELECT COUNT(*) FROM categories"),
    ("brands", ("brands.manage",), "SELECT COUNT(*) FROM brands"),
    (
        "inventory",
        ("inventory.manage",),
        "SELECT COUNT(*) FROM inventory i JOIN products p ON p.id = i.product_id",
    ),
    ("orders", ("orders.manage",), "SELECT COUNT(*) FROM orders"),
    (
        "customers",
        ("customers.read", "customers.manage"),
        """
        SELECT COUNT(DISTINCT u.id) FROM users u
        JOIN user_roles ur ON ur.user_id = u.id
        JOIN roles r ON r.id = ur.role_id
        WHERE r.name = 'customer'
        """,
    ),
    ("payments", ("payments.manage",), "SELECT COUNT(*) FROM payments"),
    ("deliveries", ("deliveries.manage",), "SELECT COUNT(*) FROM deliveries"),
    ("promotions", ("promotions.manage",), "SELECT COUNT(*) FROM promotions"),
    ("reviews", ("reviews.moderate",), "SELECT COUNT(*) FROM reviews"),
    (
        "content",
        ("content.manage",),
        "SELECT COUNT(*) FROM site_content WHERE entry_type = 'content'",
    ),
    (
        "settings",
        ("content.manage",),
        "SELECT COUNT(*) FROM site_content WHERE entry_type = 'setting'",
    ),
    (
        "staff",
        ("users.manage",),
        """
        SELECT COUNT(DISTINCT u.id) FROM users u
        JOIN user_roles ur ON ur.user_id = u.id
        JOIN roles r ON r.id = ur.role_id
        WHERE r.name <> 'customer'
        """,
    ),
    ("audit", ("audit.read",), "SELECT COUNT(*) FROM audit_logs"),
)


def nav_counts(user):
    held = set((user or {}).get("permissions") or [])
    selected = [item for item in NAV_COUNT_QUERIES if any(code in held for code in item[1])]
    if not selected:
        return {}
    sql = "SELECT " + ", ".join(f"({query}) AS {key}" for key, _, query in selected)
    with db_session() as db:
        row = db.one(sql)
    return {key: int(row[key] or 0) for key, _, _ in selected}


def dashboard(from_date, to_date):
    start, end = period_bounds(from_date, to_date)
    today_start, today_end = period_bounds(None, None)
    with db_session() as db:
        customers = db.one(
            """
            SELECT COUNT(DISTINCT u.id) AS total
            FROM users u
            JOIN user_roles ur ON ur.user_id = u.id
            JOIN roles r ON r.id = ur.role_id
            WHERE r.name = 'customer' AND u.status = 'active'
            """
        )["total"]
        products = db.one(
            "SELECT COUNT(*) AS total FROM products WHERE status = 'active' AND is_active = 1"
        )["total"]
        orders_today = db.one(
            "SELECT COUNT(*) AS total FROM orders WHERE created_at >= %s AND created_at < %s",
            (today_start, today_end),
        )["total"]
        pending_orders = db.one(
            """
            SELECT COUNT(*) AS total FROM orders
            WHERE status IN ('pending_payment', 'confirmed', 'processing', 'ready_to_dispatch')
            """
        )["total"]
        sales = db.one(
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
            ), 0) AS sales
            FROM payments p
            JOIN orders o ON o.id = p.order_id
            WHERE p.confirmed_at >= %s AND p.confirmed_at < %s
              AND o.status <> 'cancelled'
              AND p.status IN ('succeeded', 'partially_refunded')
            """,
            (start, end),
        )["sales"]
        pending_payments = db.one(
            "SELECT COUNT(*) AS total FROM payments WHERE status IN ('initiated', 'pending')"
        )["total"]
        failed_payments = db.one(
            "SELECT COUNT(*) AS total FROM payments WHERE status = 'failed'"
        )["total"]
        low_stock = db.all(
            """
            SELECT p.id, p.name, p.sku, (i.on_hand - i.reserved) AS available, p.low_stock_threshold
            FROM inventory i
            JOIN products p ON p.id = i.product_id
            WHERE p.status = 'active' AND (i.on_hand - i.reserved) <= p.low_stock_threshold
            ORDER BY available ASC, p.name
            LIMIT 8
            """
        )
        awaiting_dispatch = db.one(
            """
            SELECT COUNT(*) AS total FROM orders
            WHERE payment_status = 'paid'
              AND fulfilment_status IN ('unfulfilled', 'processing', 'packed')
              AND status NOT IN ('cancelled', 'refunded')
            """
        )["total"]
        failed_deliveries = db.one(
            "SELECT COUNT(*) AS total FROM deliveries WHERE status = 'failed'"
        )["total"]
        recent = db.all(
            """
            SELECT order_number, status, payment_status, grand_total, currency, created_at
            FROM orders ORDER BY id DESC LIMIT 8
            """
        )
        exceptions = db.one(
            """
            SELECT
              (SELECT COUNT(*) FROM orders WHERE requires_review = 1) AS review,
              (SELECT COUNT(*) FROM payments WHERE status = 'failed') AS failed_payments,
              (SELECT COUNT(*) FROM deliveries WHERE status = 'failed') AS failed_deliveries
            """
        )
    return {
        "active_customers": int(customers),
        "active_products": int(products),
        "orders_today": int(orders_today),
        "pending_orders": int(pending_orders),
        "paid_sales": money_str(sales),
        "pending_payments": int(pending_payments),
        "failed_payments": int(failed_payments),
        "low_stock_products": [
            {
                "id": row["id"],
                "name": row["name"],
                "sku": row["sku"],
                "available": int(row["available"]),
                "low_stock_threshold": row["low_stock_threshold"],
            }
            for row in low_stock
        ],
        "orders_awaiting_dispatch": int(awaiting_dispatch),
        "failed_deliveries": int(failed_deliveries),
        "recent_orders": [
            {
                "order_number": row["order_number"],
                "status": row["status"],
                "payment_status": row["payment_status"],
                "grand_total": money_str(row["grand_total"]),
                "currency": row["currency"],
                "created_at": iso(row["created_at"]),
            }
            for row in recent
        ],
        "exceptions": {
            "orders_requiring_review": int(exceptions["review"]),
            "failed_payments": int(exceptions["failed_payments"]),
            "failed_deliveries": int(exceptions["failed_deliveries"]),
        },
        "sales_rule": "Pending payments are not revenue. Paid sales follow the sales report rule.",
    }
