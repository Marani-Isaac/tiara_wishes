import hmac
import logging
from datetime import date, datetime
from decimal import Decimal
from pathlib import Path

import pymysql
from dotenv import load_dotenv
from flask import Flask, g, jsonify, request, send_from_directory
from flask.json.provider import DefaultJSONProvider
from flask_cors import CORS
from werkzeug.exceptions import HTTPException
from werkzeug.middleware.proxy_fix import ProxyFix

from app.addresses.routes import bp as addresses_bp
from app.admin.routes import bp as admin_bp
from app.auth.routes import bp as auth_bp
from app.auth.service import authenticate_request
from app.brands.routes import bp as brands_bp
from app.cart.routes import bp as cart_bp
from app.catalog.routes import bp as catalog_bp
from app.categories.routes import bp as categories_bp
from app.common.errors import AppError, Forbidden
from app.common.paths import media_root
from app.common.responses import error_body
from app.config import load_config, validate_config
from app.content.routes import bp as content_bp
from app.db.connection import db_session
from app.deliveries.public_routes import bp as delivery_places_bp
from app.extensions import limiter
from app.orders.routes import bp as orders_bp
from app.payments.routes import bp as payments_bp
from app.reports.routes import bp as reports_bp
from app.users.routes import bp as users_bp


class AppJSONProvider(DefaultJSONProvider):
    ensure_ascii = False

    def default(self, o):
        if isinstance(o, Decimal):
            return format(o, "f")
        if isinstance(o, datetime):
            return o.isoformat(sep="T", timespec="seconds") + "Z"
        if isinstance(o, date):
            return o.isoformat()
        return super().default(o)


def _cache_control(path, method):
    if method != "GET":
        return "no-store"
    if path.startswith("/media/"):
        return "public, max-age=86400"
    public_prefixes = (
        "/api/v1/products",
        "/api/v1/categories",
        "/api/v1/brands",
        "/api/v1/site-content/",
    )
    if path.startswith(public_prefixes):
        return "private, max-age=20"
    return "no-store"


def create_app(overrides=None):
    load_dotenv(Path(__file__).resolve().parents[1] / ".env")
    config = load_config()
    if overrides:
        config.update(overrides)
    testing = config.get("FLASK_ENV") == "testing" or config.get("TESTING")
    if testing:
        config["TESTING"] = True
        config["FLASK_ENV"] = "testing"
        config.setdefault("SECRET_KEY", "test-only-secret")
    else:
        validate_config(config)

    app = Flask(__name__)
    app.json = AppJSONProvider(app)
    app.config.update(config)
    app.config["PROPAGATE_EXCEPTIONS"] = False
    app.config["RATELIMIT_ENABLED"] = False if testing else bool(config.get("RATE_LIMIT_ENABLED", True))
    app.debug = bool(config.get("FLASK_DEBUG")) and not testing

    if config.get("TRUST_PROXY"):
        app.wsgi_app = ProxyFix(app.wsgi_app, x_for=1, x_proto=1, x_host=1)

    _configure_logging(app)
    CORS(
        app,
        resources={r"/api/*": {"origins": config["CORS_ORIGINS"]}},
        supports_credentials=True,
        allow_headers=[
            "Content-Type",
            "Authorization",
            "X-CSRF-Token",
            "X-Cart-Key",
            "Idempotency-Key",
            "X-Tiara-Signature",
        ],
    )
    limiter.init_app(app)

    for blueprint in (
        auth_bp,
        users_bp,
        addresses_bp,
        categories_bp,
        brands_bp,
        catalog_bp,
        cart_bp,
        orders_bp,
        payments_bp,
        content_bp,
        delivery_places_bp,
        admin_bp,
        reports_bp,
    ):
        app.register_blueprint(blueprint)

    @app.get("/api/v1/health")
    def health():
        try:
            with db_session() as database:
                database.one("SELECT 1 AS ok")
        except Exception:
            app.logger.error("Database health check failed")
            return jsonify(error_body("SERVICE_UNAVAILABLE", "Database is unavailable")), 503
        return jsonify(
            {
                "success": True,
                "data": {"service": "ok", "database": "ok"},
                "message": "Request completed",
                "meta": {},
            }
        )

    @app.get("/media/<path:filename>")
    def media(filename):
        root = media_root()
        target = (root / filename).resolve()
        if root != target and root not in target.parents:
            return jsonify(error_body("NOT_FOUND", "Resource not found")), 404
        if not target.is_file():
            return jsonify(error_body("NOT_FOUND", "Resource not found")), 404
        return send_from_directory(root, filename)

    @app.before_request
    def protect_request():
        if request.method in {"GET", "HEAD", "OPTIONS"}:
            authenticate_request()
            return
        if request.path.startswith("/api/v1/payments/webhooks/"):
            return
        if not request.headers.get("Authorization", "").startswith("Bearer "):
            if request.cookies.get("access_token"):
                cookie = request.cookies.get("csrf_token", "")
                header = request.headers.get("X-CSRF-Token", "")
                if not cookie or not header or not hmac.compare_digest(cookie, header):
                    raise Forbidden("CSRF token missing or invalid")
        authenticate_request()

    @app.after_request
    def secure_headers(response):
        response.headers["X-Content-Type-Options"] = "nosniff"
        response.headers["X-Frame-Options"] = "DENY"
        response.headers["Referrer-Policy"] = "no-referrer"
        response.headers["Cache-Control"] = _cache_control(request.path, request.method)
        app.logger.info("%s %s %s", request.method, request.path, response.status_code)
        return response

    @app.errorhandler(AppError)
    def handle_app_error(error):
        return jsonify(error_body(error.code, error.message, error.details)), error.status

    @app.errorhandler(HTTPException)
    def handle_http(error):
        codes = {404: "NOT_FOUND", 405: "METHOD_NOT_ALLOWED", 413: "PAYLOAD_TOO_LARGE", 429: "RATE_LIMITED"}
        return jsonify(error_body(codes.get(error.code, "HTTP_ERROR"), error.description or "Request failed")), error.code

    @app.errorhandler(pymysql.err.IntegrityError)
    def handle_integrity(_error):
        app.logger.info("Request conflicted with existing data")
        return jsonify(error_body("CONFLICT", "The request conflicts with existing data")), 409

    @app.errorhandler(Exception)
    def handle_unexpected(error):
        if isinstance(error, HTTPException):
            return handle_http(error)
        app.logger.exception("Unhandled error")
        return jsonify(error_body("INTERNAL_ERROR", "Something went wrong")), 500

    return app


def _configure_logging(app):
    handler = logging.StreamHandler()
    handler.setFormatter(logging.Formatter("%(asctime)s %(levelname)s %(message)s"))
    app.logger.handlers.clear()
    app.logger.addHandler(handler)
    app.logger.setLevel(app.config.get("LOG_LEVEL", "INFO"))
    app.logger.propagate = False
    # g is referenced so auth state stays explicit in this module's request cycle.
    _ = g
