from werkzeug.security import check_password_hash

from app.db.connection import db_session
from tests.conftest import auth_header, clear_cookies, sample_address


def test_register_hashes_password_and_ignores_admin_role(client, app):
    response = client.post(
        "/api/v1/auth/register",
        json={
            "first_name": "Cate",
            "last_name": "Njeri",
            "email": "Cate@Example.com",
            "password": "Secret123",
            "role": "admin",
            "roles": ["super_admin"],
        },
    )
    assert response.status_code == 201
    user = response.get_json()["data"]["user"]
    assert user["roles"] == ["customer"]
    assert user["email"] == "cate@example.com"
    assert "password" not in user and "password_hash" not in user
    with app.app_context():
        with db_session() as database:
            row = database.one("SELECT password_hash FROM users WHERE email = %s", ("cate@example.com",))
            roles = database.all(
                """
                SELECT r.name FROM roles r
                JOIN user_roles ur ON ur.role_id = r.id
                JOIN users u ON u.id = ur.user_id
                WHERE u.email = %s
                """,
                ("cate@example.com",),
            )
    assert row["password_hash"] != "Secret123"
    assert check_password_hash(row["password_hash"], "Secret123")
    assert [item["name"] for item in roles] == ["customer"]


def test_login_and_me(client, customer):
    clear_cookies(client)
    bad = client.post(
        "/api/v1/auth/login",
        json={"email": "amina@example.com", "password": "wrong-password"},
    )
    assert bad.status_code == 401
    me = client.get("/api/v1/auth/me", headers=auth_header(customer["access_token"]))
    assert me.status_code == 200
    assert me.get_json()["data"]["email"] == "amina@example.com"


def test_customer_cannot_open_admin_or_another_account(client, customer, other_customer, admin):
    denied = client.get("/api/v1/admin/products", headers=auth_header(customer["access_token"]))
    assert denied.status_code == 403
    clear_cookies(client)
    missing = client.get("/api/v1/admin/audit-logs")
    assert missing.status_code == 401

    created = client.post(
        "/api/v1/account/addresses",
        headers=auth_header(customer["access_token"]),
        json=sample_address(),
    )
    assert created.status_code == 201
    address_id = created.get_json()["data"]["id"]
    stolen = client.patch(
        f"/api/v1/account/addresses/{address_id}",
        headers=auth_header(other_customer["access_token"]),
        json={"town": "Mombasa"},
    )
    assert stolen.status_code == 404
    own = client.get("/api/v1/account/addresses", headers=auth_header(other_customer["access_token"]))
    assert own.get_json()["data"] == []


def test_password_reset_round_trip(client, app, customer):
    from app.auth.service import issue_reset_token_for_tests

    clear_cookies(client)
    forgot = client.post("/api/v1/auth/forgot-password", json={"email": "missing@example.com"})
    assert forgot.status_code == 200
    assert "if an account exists" in forgot.get_json()["message"].lower()
    with app.app_context():
        token = issue_reset_token_for_tests(customer["user"]["id"])
    reset = client.post(
        "/api/v1/auth/reset-password",
        json={"token": token, "password": "Changed123"},
    )
    assert reset.status_code == 200
    login = client.post(
        "/api/v1/auth/login",
        json={"email": "amina@example.com", "password": "Changed123"},
    )
    assert login.status_code == 200


def test_chama_is_not_implemented(client):
    assert client.get("/api/v1/chamas").status_code == 404
    paths = [rule.rule.lower() for rule in client.application.url_map.iter_rules()]
    assert not any("chama" in path for path in paths)
    home = client.get("/api/v1/site-content/home")
    assert home.status_code == 200
    assert home.get_json()["data"]["chama"]["implemented"] is False
