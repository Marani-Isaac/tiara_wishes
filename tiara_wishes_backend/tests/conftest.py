import os
from decimal import Decimal

import pymysql
import pytest

TEST_DB = os.environ.get("DATABASE_NAME_TEST", "tiara_wishes_test")
DB_HOST = os.environ.get("DATABASE_HOST", "127.0.0.1")
DB_PORT = int(os.environ.get("DATABASE_PORT", "3306"))
DB_USER = os.environ.get("DATABASE_USER", "root")
DB_PASSWORD = os.environ.get("DATABASE_PASSWORD", "")


def _overrides():
    return {
        "FLASK_ENV": "testing",
        "TESTING": True,
        "DEBUG": False,
        "FLASK_DEBUG": False,
        "SECRET_KEY": "test-secret-key-for-tiara-wishes",
        "DATABASE_HOST": DB_HOST,
        "DATABASE_PORT": DB_PORT,
        "DATABASE_NAME": TEST_DB,
        "DATABASE_USER": DB_USER,
        "DATABASE_PASSWORD": DB_PASSWORD,
        "PAYMENT_MOCK_ENABLED": True,
        "PAYMENT_PROVIDER": "mock",
        "PAYMENT_WEBHOOK_SECRET": "test-webhook-secret",
        "PASSWORD_HASH_METHOD": "pbkdf2:sha256:10000",
        "RATE_LIMIT_ENABLED": False,
        "RATELIMIT_ENABLED": False,
        "PROPAGATE_EXCEPTIONS": False,
        "STOCK_RESERVATION_MINUTES": 30,
        "DELIVERY_FEE_KES": Decimal("250.00"),
        "FREE_DELIVERY_THRESHOLD_KES": Decimal("5000.00"),
        "TAX_RATE": Decimal("0"),
        "CURRENCY": "KES",
        "CORS_ORIGINS": ["http://localhost:5173"],
        "BUSINESS_TIMEZONE": "Africa/Nairobi",
    }


def _mysql_available():
    try:
        connection = pymysql.connect(
            host=DB_HOST,
            port=DB_PORT,
            user=DB_USER,
            password=DB_PASSWORD,
            connect_timeout=3,
        )
        connection.close()
        return True
    except Exception:
        return False


@pytest.fixture(scope="session")
def schema_app():
    if "test" not in TEST_DB.lower():
        pytest.fail("DATABASE_NAME_TEST must contain 'test'")
    if not _mysql_available():
        pytest.skip("MySQL is not reachable. Start MySQL and set DATABASE_HOST, DATABASE_USER, and DATABASE_PASSWORD.")
    from app import create_app
    from app.db.migrate import apply_migrations

    application = create_app(_overrides())
    with application.app_context():
        apply_migrations()
    return application


@pytest.fixture
def app(schema_app):
    from app.db.migrate import reset_database

    with schema_app.app_context():
        reset_database()
    yield schema_app


@pytest.fixture
def client(app):
    return app.test_client()


def clear_cookies(client):
    """Drop the browser session so later calls authenticate only with Bearer tokens."""
    client._cookies.clear()


@pytest.fixture
def customer(client):
    clear_cookies(client)
    response = client.post(
        "/api/v1/auth/register",
        json={
            "first_name": "Amina",
            "last_name": "Wanjiku",
            "email": "amina@example.com",
            "phone": "0712000001",
            "password": "Secret123",
            "role": "admin",
        },
    )
    assert response.status_code == 201, response.get_data(as_text=True)
    body = response.get_json()["data"]
    clear_cookies(client)
    return body


@pytest.fixture
def other_customer(client):
    clear_cookies(client)
    response = client.post(
        "/api/v1/auth/register",
        json={
            "first_name": "Brian",
            "last_name": "Otieno",
            "email": "brian@example.com",
            "phone": "0712000002",
            "password": "Secret123",
        },
    )
    assert response.status_code == 201, response.get_data(as_text=True)
    body = response.get_json()["data"]
    clear_cookies(client)
    return body


@pytest.fixture
def admin(client, app):
    from app.auth.service import create_staff_user

    with app.app_context():
        create_staff_user("Store", "Admin", "admin@example.com", None, "Adminpass123", "admin")
    clear_cookies(client)
    response = client.post(
        "/api/v1/auth/login",
        json={"email": "admin@example.com", "password": "Adminpass123"},
    )
    assert response.status_code == 200, response.get_data(as_text=True)
    body = response.get_json()["data"]
    clear_cookies(client)
    return body


def auth_header(token):
    return {"Authorization": f"Bearer {token}"}


def sample_address():
    return {
        "recipient_name": "Amina Wanjiku",
        "recipient_phone": "0712345678",
        "county": "Nairobi",
        "town": "Nairobi",
        "area_or_estate": "Kilimani",
        "building": "Block A",
        "house_or_unit": "12",
    }
