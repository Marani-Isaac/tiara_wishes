from app.audit.service import write_audit
from app.auth.service import load_user, role_names
from app.common.errors import Conflict, NotFound, ValidationError
from app.common.serializers import user_public
from app.common.transactions import run_transaction
from app.common.validation import clean_text, normalize_phone
from app.db.connection import db_session

ASSIGNABLE_ROLES = {
    "customer",
    "admin",
    "inventory_manager",
    "order_manager",
    "finance_manager",
    "content_manager",
    "super_admin",
}


def update_account(user, data):
    if not isinstance(data, dict) or not data:
        raise ValidationError("No changes were submitted")
    updates = {}
    if "first_name" in data:
        updates["first_name"] = clean_text(data.get("first_name"), "first_name", 80)
    if "last_name" in data:
        updates["last_name"] = clean_text(data.get("last_name"), "last_name", 80)
    if "phone" in data:
        updates["phone"] = normalize_phone(data.get("phone"), required=False) if data.get("phone") else None
    if not updates:
        raise ValidationError("No changes were submitted")

    def work(db):
        if "phone" in updates and updates["phone"]:
            taken = db.one(
                "SELECT id FROM users WHERE phone = %s AND id <> %s",
                (updates["phone"], user["id"]),
            )
            if taken:
                raise Conflict("An account with this phone number already exists", code="ACCOUNT_EXISTS")
        current = db.one("SELECT * FROM users WHERE id = %s FOR UPDATE", (user["id"],))
        db.execute(
            """
            UPDATE users
            SET first_name = %s, last_name = %s, phone = %s
            WHERE id = %s
            """,
            (
                updates.get("first_name", current["first_name"]),
                updates.get("last_name", current["last_name"]),
                updates["phone"] if "phone" in updates else current["phone"],
                user["id"],
            ),
        )
        return load_user(db, user["id"])

    return run_transaction(work)


def list_customers(page, per_page, offset, query):
    where = "r.name = 'customer'"
    params = []
    if query:
        from app.common.validation import like_pattern

        pattern = like_pattern(query)
        where += " AND (u.email LIKE %s ESCAPE '\\\\' OR u.first_name LIKE %s ESCAPE '\\\\' OR u.last_name LIKE %s ESCAPE '\\\\' OR u.phone LIKE %s ESCAPE '\\\\')"
        params.extend([pattern, pattern, pattern, pattern])
    with db_session() as db:
        total = db.one(
            f"""
            SELECT COUNT(DISTINCT u.id) AS total
            FROM users u
            JOIN user_roles ur ON ur.user_id = u.id
            JOIN roles r ON r.id = ur.role_id
            WHERE {where}
            """,
            params,
        )["total"]
        rows = db.all(
            f"""
            SELECT DISTINCT u.*
            FROM users u
            JOIN user_roles ur ON ur.user_id = u.id
            JOIN roles r ON r.id = ur.role_id
            WHERE {where}
            ORDER BY u.id DESC
            LIMIT %s OFFSET %s
            """,
            [*params, per_page, offset],
        )
        result = []
        for row in rows:
            result.append(user_public(row, roles=role_names(db, row["id"])))
    return result, total


def update_customer_status(actor, user_id, status):
    if status not in {"active", "disabled"}:
        raise ValidationError(details={"status": "Status must be active or disabled"})

    def work(db):
        row = db.one("SELECT * FROM users WHERE id = %s FOR UPDATE", (user_id,))
        if not row:
            raise NotFound("Customer not found")
        if user_id == actor["id"] and status == "disabled":
            raise Conflict("You cannot disable your own account")
        db.execute("UPDATE users SET status = %s WHERE id = %s", (status, user_id))
        if status == "disabled":
            db.execute(
                "UPDATE auth_tokens SET revoked_at = UTC_TIMESTAMP() WHERE user_id = %s AND purpose = 'refresh' AND revoked_at IS NULL",
                (user_id,),
            )
        write_audit(
            db,
            actor["id"],
            "user.status_changed",
            "user",
            user_id,
            before={"status": row["status"]},
            after={"status": status},
        )
        return load_user(db, user_id)

    return run_transaction(work)


def set_roles(actor, user_id, roles):
    if not isinstance(roles, list) or not roles:
        raise ValidationError(details={"roles": "Choose at least one role"})
    if any(not isinstance(role, str) or role not in ASSIGNABLE_ROLES for role in roles):
        raise ValidationError(details={"roles": "One or more roles are unknown"})
    if user_id == actor["id"]:
        raise Conflict("You cannot change your own roles")

    def work(db):
        row = db.one("SELECT * FROM users WHERE id = %s FOR UPDATE", (user_id,))
        if not row:
            raise NotFound("Customer not found")
        before = role_names(db, user_id)
        losing_admin = "admin" in before or "super_admin" in before
        gaining_admin = "admin" in roles or "super_admin" in roles
        if losing_admin and not gaining_admin:
            admins = db.one(
                """
                SELECT COUNT(DISTINCT u.id) AS total
                FROM users u
                JOIN user_roles ur ON ur.user_id = u.id
                JOIN roles r ON r.id = ur.role_id
                WHERE r.name IN ('admin', 'super_admin') AND u.status = 'active'
                """
            )["total"]
            if admins <= 1:
                raise Conflict("The last administrator role cannot be removed")
        db.execute("DELETE FROM user_roles WHERE user_id = %s", (user_id,))
        for role in roles:
            role_row = db.one("SELECT id FROM roles WHERE name = %s", (role,))
            db.execute(
                "INSERT INTO user_roles (user_id, role_id) VALUES (%s, %s)",
                (user_id, role_row["id"]),
            )
        write_audit(
            db,
            actor["id"],
            "user.roles_changed",
            "user",
            user_id,
            before={"roles": before},
            after={"roles": sorted(set(roles))},
        )
        return load_user(db, user_id)

    return run_transaction(work)
