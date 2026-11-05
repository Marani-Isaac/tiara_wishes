import hashlib
import hmac
import json
from datetime import datetime, timedelta, timezone
from functools import wraps

import jwt
from flask import current_app, g, request
from werkzeug.security import check_password_hash, generate_password_hash

from app.common.errors import Forbidden, Unauthorized

SENSITIVE_KEYS = {
    "password",
    "password_hash",
    "token",
    "access_token",
    "refresh_token",
    "authorization",
    "pin",
    "secret",
    "consumer_secret",
    "passkey",
    "smtp_password",
    "database_password",
}


def hash_password(password):
    method = current_app.config["PASSWORD_HASH_METHOD"]
    return generate_password_hash(password, method=method)


def verify_password(password_hash, password):
    return check_password_hash(password_hash, password)


def hash_token(token):
    return hashlib.sha256(token.encode("utf-8")).hexdigest()


def encode_access_token(user_id):
    now = datetime.now(timezone.utc)
    payload = {
        "sub": str(user_id),
        "iss": current_app.config["JWT_ISSUER"],
        "aud": current_app.config["JWT_AUDIENCE"],
        "iat": now,
        "exp": now + timedelta(minutes=current_app.config["JWT_ACCESS_MINUTES"]),
        "type": "access",
    }
    return jwt.encode(payload, current_app.config["SECRET_KEY"], algorithm="HS256")


def decode_access_token(token):
    try:
        payload = jwt.decode(
            token,
            current_app.config["SECRET_KEY"],
            algorithms=["HS256"],
            issuer=current_app.config["JWT_ISSUER"],
            audience=current_app.config["JWT_AUDIENCE"],
            options={"require": ["exp", "iat", "sub", "iss", "aud"]},
        )
    except jwt.PyJWTError as exc:
        raise Unauthorized() from exc
    if payload.get("type") != "access":
        raise Unauthorized()
    return int(payload["sub"])


def extract_access_token():
    header = request.headers.get("Authorization", "")
    if header.startswith("Bearer "):
        token = header[7:].strip()
        if token:
            return token
    return request.cookies.get("access_token")


def redact(value):
    if isinstance(value, dict):
        cleaned = {}
        for key, item in value.items():
            if str(key).lower() in SENSITIVE_KEYS:
                cleaned[key] = "[redacted]"
            else:
                cleaned[key] = redact(item)
        return cleaned
    if isinstance(value, list):
        return [redact(item) for item in value]
    return value


def dumps_redacted(value):
    if value is None:
        return None
    return json.dumps(redact(value), default=str, separators=(",", ":"))


def request_client():
    ip_address = request.remote_addr if request else None
    user_agent = ""
    if request:
        user_agent = (request.headers.get("User-Agent") or "")[:255]
    return ip_address, user_agent


def require_auth(func):
    @wraps(func)
    def wrapper(*args, **kwargs):
        if not getattr(g, "current_user", None):
            raise Unauthorized()
        return func(*args, **kwargs)

    return wrapper


def require_permission(*codes):
    """Caller must be signed in and hold at least one of the listed permissions."""

    def decorator(func):
        @wraps(func)
        def wrapper(*args, **kwargs):
            user = getattr(g, "current_user", None)
            if not user:
                raise Unauthorized()
            held = set(user.get("permissions") or [])
            if not any(code in held for code in codes):
                raise Forbidden()
            return func(*args, **kwargs)

        return wrapper

    return decorator


def assert_self_or_permission(owner_id, *codes):
    user = getattr(g, "current_user", None)
    if not user:
        raise Unauthorized()
    if user["id"] == owner_id:
        return
    held = set(user.get("permissions") or [])
    if any(code in held for code in codes):
        return
    raise Forbidden()


def sign_body(body, secret):
    return hmac.new(secret.encode("utf-8"), body, hashlib.sha256).hexdigest()


def signatures_match(provided, expected):
    if not provided or not expected:
        return False
    return hmac.compare_digest(provided, expected)


def attach_auth_cookies(response, access_token, refresh_token, csrf_token):
    secure = current_app.config["SESSION_COOKIE_SECURE"]
    samesite = current_app.config["SESSION_COOKIE_SAMESITE"]
    access_age = current_app.config["JWT_ACCESS_MINUTES"] * 60
    refresh_age = current_app.config["JWT_REFRESH_DAYS"] * 86400
    response.set_cookie(
        "access_token",
        access_token,
        httponly=True,
        secure=secure,
        samesite=samesite,
        max_age=access_age,
        path="/",
    )
    response.set_cookie(
        "refresh_token",
        refresh_token,
        httponly=True,
        secure=secure,
        samesite=samesite,
        max_age=refresh_age,
        path="/api/v1/auth",
    )
    response.set_cookie(
        "csrf_token",
        csrf_token,
        httponly=False,
        secure=secure,
        samesite=samesite,
        max_age=refresh_age,
        path="/",
    )
    return response


def clear_auth_cookies(response):
    response.delete_cookie("access_token", path="/")
    response.delete_cookie("refresh_token", path="/api/v1/auth")
    response.delete_cookie("csrf_token", path="/")
    return response
