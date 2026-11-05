import secrets
from datetime import timedelta

from flask import current_app, g

from app.audit.service import write_audit
from app.common.errors import AppError, Conflict, Unauthorized, ValidationError
from app.common.security import (
    decode_access_token,
    encode_access_token,
    extract_access_token,
    hash_password,
    hash_token,
    verify_password,
)
from app.common.serializers import user_public
from app.common.transactions import run_transaction
from app.common.validation import clean_text, normalize_email, normalize_phone, validate_password
from app.db.connection import db_session
from app.notifications.service import add_notification, dispatch_queued_email

_DUMMY_HASH = None


def register(data):
    first_name = clean_text(data.get("first_name"), "first_name", 80)
    last_name = clean_text(data.get("last_name"), "last_name", 80)
    email = normalize_email(data.get("email"))
    phone = normalize_phone(data.get("phone"), required=False) if data.get("phone") else None
    password = validate_password(data.get("password"))
    password_hash = hash_password(password)

    def work(db):
        if db.one("SELECT id FROM users WHERE email = %s", (email,)):
            raise Conflict("An account with this email already exists", code="ACCOUNT_EXISTS")
        if phone and db.one("SELECT id FROM users WHERE phone = %s", (phone,)):
            raise Conflict("An account with this phone number already exists", code="ACCOUNT_EXISTS")
        user_id, _ = db.execute(
            """
            INSERT INTO users (first_name, last_name, email, phone, password_hash, status)
            VALUES (%s, %s, %s, %s, %s, 'active')
            """,
            (first_name, last_name, email, phone, password_hash),
        )
        _assign_role(db, user_id, "customer")
        user = load_user(db, user_id)
        tokens = issue_tokens(db, user_id)
        write_audit(db, user_id, "user.registered", "user", user_id, after={"email": email, "roles": ["customer"]})
        return user, tokens

    return run_transaction(work)


def login(data):
    email = normalize_email(data.get("email")) if data.get("email") else None
    password = data.get("password")
    if not email or not isinstance(password, str):
        raise Unauthorized("Invalid email or password")

    def work(db):
        row = db.one("SELECT * FROM users WHERE email = %s", (email,))
        valid = verify_password(row["password_hash"], password) if row else verify_password(_dummy(), password)
        if not row or not valid or row["status"] != "active":
            raise Unauthorized("Invalid email or password")
        db.execute("UPDATE users SET last_login_at = UTC_TIMESTAMP() WHERE id = %s", (row["id"],))
        tokens = issue_tokens(db, row["id"])
        user = load_user(db, row["id"])
        return user, tokens

    return run_transaction(work)


def logout(raw_refresh):
    if not raw_refresh:
        return
    token_hash = hash_token(raw_refresh)
    with db_session() as db:
        db.execute(
            """
            UPDATE auth_tokens
            SET revoked_at = UTC_TIMESTAMP()
            WHERE token_hash = %s AND purpose = 'refresh' AND revoked_at IS NULL
            """,
            (token_hash,),
        )


def refresh(raw_refresh):
    if not raw_refresh:
        raise Unauthorized()
    token_hash = hash_token(raw_refresh)

    def work(db):
        row = db.one(
            "SELECT * FROM auth_tokens WHERE token_hash = %s AND purpose = 'refresh' FOR UPDATE",
            (token_hash,),
        )
        now = db.one("SELECT UTC_TIMESTAMP() AS now_utc")["now_utc"]
        if not row or row["revoked_at"] is not None or row["expires_at"] <= now:
            if row and row["replaced_by_id"]:
                db.execute(
                    """
                    UPDATE auth_tokens
                    SET revoked_at = UTC_TIMESTAMP()
                    WHERE user_id = %s AND purpose = 'refresh' AND revoked_at IS NULL
                    """,
                    (row["user_id"],),
                )
            raise Unauthorized()
        user = db.one("SELECT * FROM users WHERE id = %s", (row["user_id"],))
        if not user or user["status"] != "active":
            raise Unauthorized()
        tokens = issue_tokens(db, user["id"])
        db.execute(
            """
            UPDATE auth_tokens
            SET revoked_at = UTC_TIMESTAMP(), replaced_by_id = %s
            WHERE id = %s AND purpose = 'refresh'
            """,
            (tokens["refresh_id"], row["id"]),
        )
        return load_user(db, user["id"]), tokens

    return run_transaction(work)


def forgot_password(data):
    message = "If an account exists for that email, a reset link will be sent shortly."
    email = data.get("email")
    try:
        normalized = normalize_email(email) if email else None
    except ValidationError:
        return message
    if not normalized:
        return message
    raw_token = None
    notification_id = None
    with db_session() as db:
        user = db.one("SELECT * FROM users WHERE email = %s", (normalized,))
        if not user or user["status"] == "disabled":
            return message
        raw_token = secrets.token_urlsafe(32)
        db.execute(
            """
            INSERT INTO auth_tokens (user_id, purpose, token_hash, expires_at)
            VALUES (%s, 'password_reset', %s, DATE_ADD(UTC_TIMESTAMP(), INTERVAL 1 HOUR))
            """,
            (user["id"], hash_token(raw_token)),
        )
        notification_id = add_notification(
            db,
            user["id"],
            "email",
            "password_reset",
            "Reset your Tiara Wishes password",
            "A password reset was requested. The reset link is sent by email and is not stored here.",
            status="queued",
        )
    if current_app.config.get("SMTP_HOST") and raw_token and notification_id:
        _send_reset(normalized, raw_token, notification_id)
    elif not current_app.config.get("SMTP_HOST"):
        current_app.logger.info("Password reset email was not sent because SMTP is not configured")
    return message


def reset_password(data):
    token = data.get("token")
    password = validate_password(data.get("password"), field="password")
    if not isinstance(token, str) or len(token) < 20:
        raise ValidationError("This reset link is invalid or has expired")
    token_hash = hash_token(token)
    password_hash = hash_password(password)

    def work(db):
        row = db.one(
            "SELECT * FROM auth_tokens WHERE token_hash = %s AND purpose = 'password_reset' FOR UPDATE",
            (token_hash,),
        )
        now = db.one("SELECT UTC_TIMESTAMP() AS now_utc")["now_utc"]
        if not row or row["used_at"] is not None or row["expires_at"] <= now:
            raise ValidationError("This reset link is invalid or has expired")
        db.execute("UPDATE users SET password_hash = %s WHERE id = %s", (password_hash, row["user_id"]))
        db.execute(
            "UPDATE auth_tokens SET used_at = UTC_TIMESTAMP() WHERE user_id = %s AND purpose = 'password_reset' AND used_at IS NULL",
            (row["user_id"],),
        )
        db.execute(
            "UPDATE auth_tokens SET revoked_at = UTC_TIMESTAMP() WHERE user_id = %s AND purpose = 'refresh' AND revoked_at IS NULL",
            (row["user_id"],),
        )
        write_audit(db, row["user_id"], "user.password_reset", "user", row["user_id"])

    run_transaction(work)


def issue_reset_token_for_tests(user_id):
    raw = secrets.token_urlsafe(32)
    with db_session() as db:
        db.execute(
            """
            INSERT INTO auth_tokens (user_id, purpose, token_hash, expires_at)
            VALUES (%s, 'password_reset', %s, DATE_ADD(UTC_TIMESTAMP(), INTERVAL 1 HOUR))
            """,
            (user_id, hash_token(raw)),
        )
    return raw


def change_password(user, data):
    current = data.get("current_password")
    new_password = validate_password(data.get("new_password"), field="new_password")
    if not isinstance(current, str):
        raise ValidationError(details={"current_password": "This field is required"})
    new_hash = hash_password(new_password)

    def work(db):
        row = db.one("SELECT * FROM users WHERE id = %s FOR UPDATE", (user["id"],))
        if not row or not verify_password(row["password_hash"], current):
            raise ValidationError(details={"current_password": "Current password is incorrect"})
        db.execute("UPDATE users SET password_hash = %s WHERE id = %s", (new_hash, user["id"]))
        db.execute(
            "UPDATE auth_tokens SET revoked_at = UTC_TIMESTAMP() WHERE user_id = %s AND purpose = 'refresh' AND revoked_at IS NULL",
            (user["id"],),
        )
        write_audit(db, user["id"], "user.password_changed", "user", user["id"])

    run_transaction(work)


def create_staff_user(first_name, last_name, email, phone, password, role_name):
    if role_name == "customer":
        raise ValidationError(details={"role": "Use registration for customers"})
    password_hash = hash_password(password)

    def work(db):
        role = db.one("SELECT id FROM roles WHERE name = %s", (role_name,))
        if not role:
            raise ValidationError(details={"role": "Unknown role"})
        if db.one("SELECT id FROM users WHERE email = %s", (email,)):
            raise Conflict("An account with this email already exists", code="ACCOUNT_EXISTS")
        user_id, _ = db.execute(
            """
            INSERT INTO users (first_name, last_name, email, phone, password_hash, status)
            VALUES (%s, %s, %s, %s, %s, 'active')
            """,
            (first_name, last_name, email, phone, password_hash),
        )
        db.execute(
            "INSERT INTO user_roles (user_id, role_id) VALUES (%s, %s)",
            (user_id, role["id"]),
        )
        write_audit(db, None, "user.staff_created", "user", user_id, after={"email": email, "role": role_name})
        return load_user(db, user_id)

    return run_transaction(work)


def set_password_by_email(email, password):
    password_hash = hash_password(validate_password(password))
    normalized = normalize_email(email)
    with db_session() as db:
        row = db.one("SELECT id FROM users WHERE email = %s", (normalized,))
        if not row:
            raise ValidationError("No account was found for that email")
        db.execute("UPDATE users SET password_hash = %s WHERE id = %s", (password_hash, row["id"]))
        db.execute(
            "UPDATE auth_tokens SET revoked_at = UTC_TIMESTAMP() WHERE user_id = %s AND purpose = 'refresh' AND revoked_at IS NULL",
            (row["id"],),
        )


def authenticate_request():
    g.current_user = None
    token = extract_access_token()
    if not token:
        return
    try:
        user_id = decode_access_token(token)
    except Unauthorized:
        return
    with db_session() as db:
        user = load_user(db, user_id)
    if user and user["status"] == "active":
        g.current_user = user


def load_user(db, user_id):
    row = db.one(
        """
        SELECT u.*,
          (
            SELECT GROUP_CONCAT(r.name ORDER BY r.name SEPARATOR ',')
            FROM roles r
            JOIN user_roles ur ON ur.role_id = r.id
            WHERE ur.user_id = u.id
          ) AS role_names,
          (
            SELECT GROUP_CONCAT(DISTINCT p.code ORDER BY p.code SEPARATOR ',')
            FROM permissions p
            JOIN role_permissions rp ON rp.permission_id = p.id
            JOIN user_roles ur ON ur.role_id = rp.role_id
            WHERE ur.user_id = u.id
          ) AS permission_codes
        FROM users u
        WHERE u.id = %s
        """,
        (user_id,),
    )
    if not row:
        return None
    roles = [item for item in (row.get("role_names") or "").split(",") if item]
    permissions = [item for item in (row.get("permission_codes") or "").split(",") if item]
    return user_public(row, roles=roles, permissions=permissions)


def role_names(db, user_id):
    rows = db.all(
        """
        SELECT r.name FROM roles r
        JOIN user_roles ur ON ur.role_id = r.id
        WHERE ur.user_id = %s
        ORDER BY r.name
        """,
        (user_id,),
    )
    return [row["name"] for row in rows]


def permission_codes(db, user_id):
    rows = db.all(
        """
        SELECT DISTINCT p.code
        FROM permissions p
        JOIN role_permissions rp ON rp.permission_id = p.id
        JOIN user_roles ur ON ur.role_id = rp.role_id
        WHERE ur.user_id = %s
        ORDER BY p.code
        """,
        (user_id,),
    )
    return [row["code"] for row in rows]


def issue_tokens(db, user_id):
    raw_refresh = secrets.token_urlsafe(48)
    csrf_token = secrets.token_urlsafe(32)
    days = int(current_app.config["JWT_REFRESH_DAYS"])
    refresh_id, _ = db.execute(
        """
        INSERT INTO auth_tokens (user_id, purpose, token_hash, expires_at)
        VALUES (%s, 'refresh', %s, DATE_ADD(UTC_TIMESTAMP(), INTERVAL %s DAY))
        """,
        (user_id, hash_token(raw_refresh), days),
    )
    return {
        "access_token": encode_access_token(user_id),
        "refresh_token": raw_refresh,
        "csrf_token": csrf_token,
        "refresh_id": refresh_id,
        "expires_in": int(current_app.config["JWT_ACCESS_MINUTES"]) * 60,
    }


def _assign_role(db, user_id, role_name):
    role = db.one("SELECT id FROM roles WHERE name = %s", (role_name,))
    if not role:
        raise AppError("SERVER_MISCONFIGURED", "Default roles are not seeded", 500)
    db.execute("INSERT INTO user_roles (user_id, role_id) VALUES (%s, %s)", (user_id, role["id"]))


def _dummy():
    global _DUMMY_HASH
    if _DUMMY_HASH is None:
        _DUMMY_HASH = hash_password("dummy-password-not-used")
    return _DUMMY_HASH


def _send_reset(email, raw_token, notification_id):
    from app.db.connection import db_session as session

    try:
        with session() as db:
            row = db.one("SELECT message FROM notifications WHERE id = %s", (notification_id,))
        if not row:
            return
        dispatch_queued_email(notification_id, email)
    except Exception:
        current_app.logger.error("Password reset email could not be sent")


def _unused_timedelta():
    return timedelta
