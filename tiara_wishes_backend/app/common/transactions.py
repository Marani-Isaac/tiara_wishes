import pymysql

from app.db.connection import db_session


def run_transaction(work):
    """Run work(db) in a transaction, retrying InnoDB deadlocks."""
    last_error = None
    for attempt in range(3):
        try:
            with db_session() as database:
                return work(database)
        except pymysql.err.OperationalError as exc:
            last_error = exc
            code = exc.args[0] if exc.args else None
            if code in (1213, 1205) and attempt < 2:
                continue
            raise
    raise last_error
