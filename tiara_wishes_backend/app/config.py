"""Environment configuration.

Business rules that the client has not closed are read from the environment
instead of being buried in checkout code. See README for the assumptions.
"""

import os
from decimal import Decimal


def _bool(name, default=False):
    raw = os.getenv(name)
    if raw is None:
        return default
    return raw.strip().lower() in {"1", "true", "yes", "on"}


def _int(name, default):
    raw = os.getenv(name)
    if raw is None or raw.strip() == "":
        return default
    return int(raw)


def _decimal(name, default):
    raw = os.getenv(name)
    if raw is None or raw.strip() == "":
        return Decimal(default)
    return Decimal(raw)


def load_config():
    environment = os.getenv("FLASK_ENV", "development").strip().lower()
    cors_raw = os.getenv("CORS_ORIGINS", "")
    origins = [item.strip() for item in cors_raw.split(",") if item.strip()]
    config = {
        "FLASK_ENV": environment,
        "ENV": environment,
        "DEBUG": _bool("FLASK_DEBUG", False),
        "FLASK_DEBUG": _bool("FLASK_DEBUG", False),
        "TESTING": environment == "testing",
        "SECRET_KEY": os.getenv("SECRET_KEY", ""),
        "DATABASE_HOST": os.getenv("DATABASE_HOST", "127.0.0.1"),
        "DATABASE_PORT": _int("DATABASE_PORT", 3306),
        "DATABASE_NAME": os.getenv("DATABASE_NAME", "tiara_wishes"),
        "DATABASE_USER": os.getenv("DATABASE_USER", "root"),
        "DATABASE_PASSWORD": os.getenv("DATABASE_PASSWORD", ""),
        "CORS_ORIGINS": origins,
        "SESSION_COOKIE_SECURE": _bool("SESSION_COOKIE_SECURE", environment == "production"),
        "SESSION_COOKIE_SAMESITE": os.getenv("SESSION_COOKIE_SAMESITE", "Lax"),
        "JWT_ACCESS_MINUTES": _int("JWT_ACCESS_MINUTES", 15),
        "JWT_REFRESH_DAYS": _int("JWT_REFRESH_DAYS", 14),
        "JWT_ISSUER": os.getenv("JWT_ISSUER", "tiara-wishes"),
        "JWT_AUDIENCE": os.getenv("JWT_AUDIENCE", "tiara-wishes-storefront"),
        "STOCK_RESERVATION_MINUTES": _int("STOCK_RESERVATION_MINUTES", 30),
        "DELIVERY_FEE_KES": _decimal("DELIVERY_FEE_KES", "250.00"),
        "FREE_DELIVERY_THRESHOLD_KES": _decimal("FREE_DELIVERY_THRESHOLD_KES", "5000.00"),
        "TAX_RATE": _decimal("TAX_RATE", "0"),
        "CURRENCY": os.getenv("CURRENCY", "KES"),
        "BUSINESS_TIMEZONE": os.getenv("BUSINESS_TIMEZONE", "Africa/Nairobi"),
        "MEDIA_ROOT": os.getenv("MEDIA_ROOT", "media"),
        "MEDIA_URL_PREFIX": os.getenv("MEDIA_URL_PREFIX", "/media"),
        "MAX_UPLOAD_MB": _int("MAX_UPLOAD_MB", 5),
        "PAYMENT_PROVIDER": os.getenv("PAYMENT_PROVIDER", "mock"),
        "PAYMENT_MOCK_ENABLED": _bool("PAYMENT_MOCK_ENABLED", environment != "production"),
        "PAYMENT_WEBHOOK_SECRET": os.getenv("PAYMENT_WEBHOOK_SECRET", ""),
        "MPESA_ENV": os.getenv("MPESA_ENV", "sandbox"),
        "MPESA_CONSUMER_KEY": os.getenv("MPESA_CONSUMER_KEY", ""),
        "MPESA_CONSUMER_SECRET": os.getenv("MPESA_CONSUMER_SECRET", ""),
        "MPESA_SHORTCODE": os.getenv("MPESA_SHORTCODE", ""),
        "MPESA_PASSKEY": os.getenv("MPESA_PASSKEY", ""),
        "MPESA_CALLBACK_URL": os.getenv("MPESA_CALLBACK_URL", ""),
        "MPESA_CALLBACK_SECRET": os.getenv("MPESA_CALLBACK_SECRET", ""),
        "MPESA_PAYBILL": os.getenv("MPESA_PAYBILL", "247247"),
        "MPESA_ACCOUNT": os.getenv("MPESA_ACCOUNT", "7770180121934"),
        "SMTP_HOST": os.getenv("SMTP_HOST", ""),
        "SMTP_PORT": _int("SMTP_PORT", 587),
        "SMTP_USER": os.getenv("SMTP_USER", ""),
        "SMTP_PASSWORD": os.getenv("SMTP_PASSWORD", ""),
        "SMTP_FROM": os.getenv("SMTP_FROM", ""),
        "SMTP_USE_TLS": _bool("SMTP_USE_TLS", True),
        "RATE_LIMIT_ENABLED": _bool("RATE_LIMIT_ENABLED", True),
        "RATE_LIMIT_AUTH": os.getenv("RATE_LIMIT_AUTH", "10 per minute"),
        "RATE_LIMIT_PAYMENT": os.getenv("RATE_LIMIT_PAYMENT", "10 per minute"),
        "LOG_LEVEL": os.getenv("LOG_LEVEL", "INFO"),
        "PASSWORD_HASH_METHOD": os.getenv("PASSWORD_HASH_METHOD", "pbkdf2:sha256:600000"),
        "TRUST_PROXY": _bool("TRUST_PROXY", False),
        "JSON_SORT_KEYS": False,
    }
    config["MAX_CONTENT_LENGTH"] = config["MAX_UPLOAD_MB"] * 1024 * 1024
    return config


def validate_config(config):
    errors = []
    if not config.get("SECRET_KEY"):
        errors.append("SECRET_KEY is required")
    environment = config.get("FLASK_ENV")
    if environment == "production":
        if config.get("DEBUG") or config.get("FLASK_DEBUG"):
            errors.append("FLASK_DEBUG must be false in production")
        if config.get("PAYMENT_MOCK_ENABLED"):
            errors.append("PAYMENT_MOCK_ENABLED must be false in production")
        if len(config.get("SECRET_KEY", "")) < 32:
            errors.append("SECRET_KEY must be at least 32 characters in production")
        if "*" in config.get("CORS_ORIGINS", []):
            errors.append("Wildcard CORS is not allowed in production")
        if not config.get("SESSION_COOKIE_SECURE"):
            errors.append("SESSION_COOKIE_SECURE must be true in production")
        if not config.get("PAYMENT_WEBHOOK_SECRET"):
            errors.append("PAYMENT_WEBHOOK_SECRET is required in production")
    if errors:
        raise RuntimeError("Invalid configuration: " + "; ".join(errors))
