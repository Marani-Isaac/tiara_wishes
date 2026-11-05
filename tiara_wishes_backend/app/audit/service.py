from app.common.security import dumps_redacted, request_client
from app.db.connection import db_session


def write_audit(db, actor_user_id, action, entity_type, entity_id, before=None, after=None):
    ip_address = None
    user_agent = None
    try:
        from flask import has_request_context

        if has_request_context():
            ip_address, user_agent = request_client()
    except RuntimeError:
        ip_address, user_agent = None, None
    db.execute(
        """
        INSERT INTO audit_logs (
          actor_user_id, action, entity_type, entity_id,
          before_json, after_json, ip_address, user_agent
        ) VALUES (%s, %s, %s, %s, %s, %s, %s, %s)
        """,
        (
            actor_user_id,
            action,
            entity_type,
            None if entity_id is None else str(entity_id),
            dumps_redacted(before),
            dumps_redacted(after),
            ip_address,
            user_agent,
        ),
    )


def list_audits(page, per_page, offset, entity_type=None):
    where = "1=1"
    params = []
    if entity_type:
        where = "entity_type = %s"
        params.append(entity_type)
    with db_session() as db:
        total = db.one(f"SELECT COUNT(*) AS total FROM audit_logs WHERE {where}", params)["total"]
        rows = db.all(
            f"""
            SELECT * FROM audit_logs
            WHERE {where}
            ORDER BY id DESC
            LIMIT %s OFFSET %s
            """,
            [*params, per_page, offset],
        )
    return [_present(row) for row in rows], total


def _present(row):
    import json

    from app.common.serializers import iso

    def load(value):
        if value is None or isinstance(value, (dict, list)):
            return value
        try:
            return json.loads(value)
        except (TypeError, ValueError):
            return None

    return {
        "id": row["id"],
        "actor_user_id": row["actor_user_id"],
        "action": row["action"],
        "entity_type": row["entity_type"],
        "entity_id": row["entity_id"],
        "before": load(row["before_json"]),
        "after": load(row["after_json"]),
        "ip_address": row["ip_address"],
        "created_at": iso(row["created_at"]),
    }
