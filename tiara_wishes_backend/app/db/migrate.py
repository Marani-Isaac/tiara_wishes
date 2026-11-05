from pathlib import Path

from app.db.connection import connect_server, db_session, validate_db_name

SQL_DIR = Path(__file__).resolve().parents[2] / "sql"

MUTABLE_TABLES = [
    "delivery_places",
    "deliveries",
    "refunds",
    "payment_webhook_events",
    "payments",
    "order_items",
    "orders",
    "cart_items",
    "carts",
    "reviews",
    "inventory_movements",
    "inventory",
    "product_images",
    "products",
    "notifications",
    "audit_logs",
    "addresses",
    "auth_tokens",
    "user_roles",
    "role_permissions",
    "users",
    "promotions",
    "categories",
    "brands",
    "site_content",
    "permissions",
    "roles",
]


def split_sql(script):
    statements = []
    buffer = []
    in_single = False
    in_double = False
    index = 0
    length = len(script)
    while index < length:
        char = script[index]
        if not in_single and not in_double and script.startswith("--", index):
            while index < length and script[index] != "\n":
                index += 1
            continue
        if char == "'" and not in_double:
            if in_single and script.startswith("''", index):
                buffer.append("''")
                index += 2
                continue
            in_single = not in_single
            buffer.append(char)
        elif char == '"' and not in_single:
            in_double = not in_double
            buffer.append(char)
        elif char == ";" and not in_single and not in_double:
            statement = "".join(buffer).strip()
            if statement:
                statements.append(statement)
            buffer = []
        else:
            buffer.append(char)
        index += 1
    tail = "".join(buffer).strip()
    if tail:
        statements.append(tail)
    return statements


def ensure_database():
    name = validate_db_name(current_database_name())
    server = connect_server()
    try:
        with server.cursor() as cursor:
            cursor.execute(
                f"CREATE DATABASE IF NOT EXISTS `{name}` "
                "CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci"
            )
        server.commit()
    finally:
        server.close()


def apply_migrations():
    ensure_database()
    with db_session() as database:
        database.execute(
            """
            CREATE TABLE IF NOT EXISTS schema_migrations (
              version VARCHAR(64) NOT NULL PRIMARY KEY,
              applied_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
            ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
            """
        )
    for path in sorted(SQL_DIR.glob("*.sql")):
        with db_session() as database:
            existing = database.one(
                "SELECT version FROM schema_migrations WHERE version = %s",
                (path.name,),
            )
            if existing:
                continue
            if path.name == "003_combine_tables.sql" and not _table_exists(database, "refresh_tokens"):
                database.execute(
                    "INSERT INTO schema_migrations (version) VALUES (%s)",
                    (path.name,),
                )
                continue
            for statement in split_sql(path.read_text(encoding="utf-8")):
                database.execute(statement)
            database.execute(
                "INSERT INTO schema_migrations (version) VALUES (%s)",
                (path.name,),
            )


def apply_seed():
    seed = SQL_DIR / "002_seed_reference_data.sql"
    with db_session() as database:
        for statement in split_sql(seed.read_text(encoding="utf-8")):
            database.execute(statement)


def reset_database():
    name = current_database_name()
    if "test" not in name.lower():
        raise RuntimeError(f"Refusing to reset non-test database {name}")
    with db_session() as database:
        database.execute("SET FOREIGN_KEY_CHECKS = 0")
        for table in MUTABLE_TABLES:
            database.execute(f"TRUNCATE TABLE `{table}`")
        database.execute("SET FOREIGN_KEY_CHECKS = 1")
    apply_seed()


def _table_exists(database, table):
    row = database.one(
        """
        SELECT 1 AS present
        FROM information_schema.tables
        WHERE table_schema = DATABASE() AND table_name = %s
        """,
        (table,),
    )
    return bool(row)


def current_database_name():
    from flask import current_app

    return validate_db_name(current_app.config["DATABASE_NAME"])
