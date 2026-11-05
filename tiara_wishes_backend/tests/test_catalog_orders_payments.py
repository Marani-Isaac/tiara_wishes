import hashlib
import hmac
import json
import threading

import pytest

from app.common.errors import AppError
from app.db.connection import db_session
from app.orders.service import create_order
from tests.conftest import auth_header, clear_cookies, sample_address


def _product_by_sku(client, sku):
    response = client.get("/api/v1/products?per_page=50")
    assert response.status_code == 200
    for product in response.get_json()["data"]:
        if product["sku"] == sku:
            return product
    raise AssertionError(f"{sku} was not in the public catalogue")


def test_public_catalogue_hides_inactive_and_paginates(client):
    first = client.get("/api/v1/products?per_page=2&page=1&sort=name")
    assert first.status_code == 200
    body = first.get_json()
    assert body["meta"]["total"] == 3
    assert body["meta"]["pages"] == 2
    assert len(body["data"]) == 2
    skus = {item["sku"] for item in body["data"]}
    assert "DEMO-BOWL-ARCHIVED" not in skus
    hidden = client.get("/api/v1/products/demo-archived-bowl")
    assert hidden.status_code == 404
    featured = client.get("/api/v1/products?featured=true")
    assert [item["sku"] for item in featured.get_json()["data"]] == ["DEMO-THROW-001"]
    categories = client.get("/api/v1/categories")
    assert categories.status_code == 200
    assert any(item["slug"] == "kitchen" for item in categories.get_json()["data"])


def test_quote_uses_server_prices_and_order_rejects_bad_stock(client, customer):
    plate = _product_by_sku(client, "DEMO-PLATE-001")
    quote = client.post(
        "/api/v1/checkout/quote",
        headers=auth_header(customer["access_token"]),
        json={"items": [{"product_id": plate["id"], "quantity": 2, "unit_price": "1.00"}], "promotion_code": "WELCOME10"},
    )
    assert quote.status_code == 200
    data = quote.get_json()["data"]
    assert data["subtotal"] == "900.00"
    assert data["discount_total"] == "90.00"
    assert data["delivery_fee"] == "250.00"
    assert data["tax_total"] == "0.00"
    assert data["grand_total"] == "1060.00"
    assert data["items"][0]["unit_price"] == "450.00"

    invalid = client.post(
        "/api/v1/orders",
        headers=auth_header(customer["access_token"]),
        json={"items": [{"product_id": plate["id"], "quantity": 0}], "address": sample_address()},
    )
    assert invalid.status_code == 422

    short = client.post(
        "/api/v1/orders",
        headers=auth_header(customer["access_token"]),
        json={"items": [{"product_id": plate["id"], "quantity": 21}], "address": sample_address()},
    )
    assert short.status_code == 409
    assert short.get_json()["error"]["code"] == "INSUFFICIENT_STOCK"
    clear_cookies(client)
    guest = client.post("/api/v1/orders", json={"items": [{"product_id": plate["id"], "quantity": 1}]})
    assert guest.status_code == 401


def test_inactive_product_and_ownership(client, customer, other_customer, admin, app):
    archived = client.get(
        "/api/v1/admin/products?status=archived",
        headers=auth_header(admin["access_token"]),
    )
    assert archived.status_code == 200
    bowl = next(item for item in archived.get_json()["data"] if item["sku"] == "DEMO-BOWL-ARCHIVED")
    rejected = client.post(
        "/api/v1/orders",
        headers=auth_header(customer["access_token"]),
        json={"items": [{"product_id": bowl["id"], "quantity": 1}], "address": sample_address()},
    )
    assert rejected.status_code == 422

    plate = _product_by_sku(client, "DEMO-PLATE-001")
    created = client.post(
        "/api/v1/orders",
        headers=auth_header(customer["access_token"]),
        json={"items": [{"product_id": plate["id"], "quantity": 1}], "address": sample_address()},
    )
    assert created.status_code == 201
    order = created.get_json()["data"]
    assert order["grand_total"] == "700.00"
    hidden = client.get(
        f"/api/v1/orders/{order['order_number']}",
        headers=auth_header(other_customer["access_token"]),
    )
    assert hidden.status_code == 404
    own = client.get(
        f"/api/v1/account/orders/{order['order_number']}",
        headers=auth_header(customer["access_token"]),
    )
    assert own.status_code == 200

    payment = client.post(
        f"/api/v1/orders/{order['order_number']}/payments",
        headers=auth_header(customer["access_token"]),
        json={"provider": "mock"},
    )
    assert payment.status_code == 201
    reference = payment.get_json()["data"]["merchant_reference"]
    assert payment.get_json()["data"]["status"] == "pending"
    stolen = client.get(
        f"/api/v1/payments/{reference}",
        headers=auth_header(other_customer["access_token"]),
    )
    assert stolen.status_code == 404
    visible = client.get(
        f"/api/v1/payments/{reference}",
        headers=auth_header(admin["access_token"]),
    )
    assert visible.status_code == 200


def _sign(body):
    return hmac.new(b"test-webhook-secret", body, hashlib.sha256).hexdigest()


def _webhook(client, payload):
    body = json.dumps(payload, separators=(",", ":")).encode()
    return client.post(
        "/api/v1/payments/webhooks/mock",
        data=body,
        headers={"Content-Type": "application/json", "X-Tiara-Signature": _sign(body)},
    )


def test_payment_states_are_idempotent(client, customer, admin, app):
    plate = _product_by_sku(client, "DEMO-PLATE-001")
    created = client.post(
        "/api/v1/orders",
        headers=auth_header(customer["access_token"]),
        json={"items": [{"product_id": plate["id"], "quantity": 2}], "address": sample_address()},
    )
    order = created.get_json()["data"]
    payment = client.post(
        f"/api/v1/orders/{order['order_number']}/payments",
        headers=auth_header(customer["access_token"]),
        json={"provider": "mock"},
    )
    reference = payment.get_json()["data"]["merchant_reference"]

    pending = _webhook(client, {"event_key": "evt-pending", "merchant_reference": reference, "status": "pending"})
    assert pending.status_code == 200
    failed = _webhook(
        client,
        {"event_key": "evt-failed", "merchant_reference": reference, "status": "failed", "result_code": "1"},
    )
    assert failed.status_code == 200
    with app.app_context():
        with db_session() as database:
            stock = database.one(
                """
                SELECT on_hand, reserved FROM inventory i
                JOIN products p ON p.id = i.product_id
                WHERE p.sku = 'DEMO-PLATE-001'
                """
            )
    assert stock["on_hand"] == 20
    assert stock["reserved"] == 2

    ok = _webhook(
        client,
        {
            "event_key": "evt-ok",
            "merchant_reference": reference,
            "status": "succeeded",
            "provider_transaction_id": "MOCK1",
            "result_code": "0",
        },
    )
    assert ok.status_code == 200
    again = _webhook(
        client,
        {
            "event_key": "evt-ok",
            "merchant_reference": reference,
            "status": "succeeded",
            "provider_transaction_id": "MOCK1",
        },
    )
    other_key = _webhook(
        client,
        {
            "event_key": "evt-ok-again",
            "merchant_reference": reference,
            "status": "succeeded",
            "provider_transaction_id": "MOCK2",
        },
    )
    assert again.get_json()["data"]["idempotent"] is True
    assert other_key.status_code == 200
    with app.app_context():
        with db_session() as database:
            stock = database.one(
                """
                SELECT on_hand, reserved FROM inventory i
                JOIN products p ON p.id = i.product_id
                WHERE p.sku = 'DEMO-PLATE-001'
                """
            )
            sales = database.one(
                """
                SELECT COUNT(*) AS total FROM inventory_movements
                WHERE movement_type = 'sale' AND reference_id = %s
                """,
                (order["id"],),
            )
            paid = database.one("SELECT status, payment_status FROM orders WHERE id = %s", (order["id"],))
    assert stock["on_hand"] == 18
    assert stock["reserved"] == 0
    assert sales["total"] == 1
    assert paid["status"] == "confirmed"
    assert paid["payment_status"] == "paid"
    status = client.get(f"/api/v1/payments/{reference}", headers=auth_header(customer["access_token"]))
    assert status.get_json()["data"]["status"] == "succeeded"


def test_order_rollback_and_concurrent_stock(client, customer, admin, app):
    plate = _product_by_sku(client, "DEMO-PLATE-001")

    def boom(*_args, **_kwargs):
        raise RuntimeError("audit failed")

    monkeypatch = pytest.MonkeyPatch()
    monkeypatch.setattr("app.orders.service.write_audit", boom)
    with pytest.raises(RuntimeError):
        with app.app_context():
            create_order(
                customer["user"],
                {"items": [{"product_id": plate["id"], "quantity": 1}], "address": sample_address()},
            )
    monkeypatch.undo()
    with app.app_context():
        with db_session() as database:
            orders = database.one("SELECT COUNT(*) AS total FROM orders")["total"]
            stock = database.one(
                """
                SELECT on_hand, reserved FROM inventory i
                JOIN products p ON p.id = i.product_id WHERE p.sku = 'DEMO-PLATE-001'
                """
            )
    assert orders == 0
    assert stock["on_hand"] == 20 and stock["reserved"] == 0

    categories = client.get("/api/v1/categories").get_json()["data"]
    kitchen = next(item for item in categories if item["slug"] == "kitchen")
    created = client.post(
        "/api/v1/admin/products",
        headers=auth_header(admin["access_token"]),
        json={
            "name": "Last Mug",
            "sku": "TEST-MUG-1",
            "category_id": kitchen["id"],
            "cash_price": "100.00",
            "status": "active",
            "is_active": True,
            "opening_stock": 1,
        },
    )
    assert created.status_code == 201, created.get_data(as_text=True)
    product_id = created.get_json()["data"]["id"]
    barrier = threading.Barrier(2)
    results = []

    def attempt():
        barrier.wait(timeout=5)
        with app.app_context():
            try:
                create_order(
                    customer["user"],
                    {"items": [{"product_id": product_id, "quantity": 1}], "address": sample_address()},
                )
                results.append("ok")
            except AppError as exc:
                results.append(exc.code)

    threads = [threading.Thread(target=attempt) for _ in range(2)]
    for thread in threads:
        thread.start()
    for thread in threads:
        thread.join(timeout=20)
    assert sorted(results) == ["INSUFFICIENT_STOCK", "ok"]
    with app.app_context():
        with db_session() as database:
            stock = database.one("SELECT on_hand, reserved FROM inventory WHERE product_id = %s", (product_id,))
    assert stock["on_hand"] == 1
    assert stock["reserved"] == 1


def test_admin_adjustment_is_audited(client, admin, customer):
    plate = _product_by_sku(client, "DEMO-CANDLE-001")
    adjusted = client.post(
        "/api/v1/admin/inventory/adjustments",
        headers=auth_header(admin["access_token"]),
        json={
            "product_id": plate["id"],
            "quantity_change": 4,
            "movement_type": "restock",
            "reason": "Supplier delivery",
        },
    )
    assert adjusted.status_code == 201
    assert adjusted.get_json()["data"]["on_hand"] == 6
    forbidden = client.get("/api/v1/admin/audit-logs", headers=auth_header(customer["access_token"]))
    assert forbidden.status_code == 403
    logs = client.get("/api/v1/admin/audit-logs", headers=auth_header(admin["access_token"]))
    assert logs.status_code == 200
    actions = [item["action"] for item in logs.get_json()["data"]]
    assert "inventory.adjusted" in actions
    assert "password_hash" not in json.dumps(logs.get_json()).lower()
