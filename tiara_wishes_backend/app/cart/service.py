import re
import secrets

from flask import g, request

from app.common.errors import NotFound, ValidationError
from app.common.money import money_str, to_money
from app.common.transactions import run_transaction
from app.common.validation import parse_positive_int
from app.db.connection import db_session

KEY_RE = re.compile(r"^[A-Za-z0-9_-]{16,64}$")


def get_cart():
    user = getattr(g, "current_user", None)
    session_key, created = _session_key()
    with db_session() as db:
        cart = _get_or_create(db, user, session_key)
        data = _present(db, cart)
    return data, session_key if created or not user else None


def add_item(payload):
    product_id = parse_positive_int(payload.get("product_id"), "product_id")
    quantity = parse_positive_int(payload.get("quantity"), "quantity", minimum=1, maximum=99)
    user = getattr(g, "current_user", None)
    session_key, _created = _session_key()

    def work(db):
        product = db.one(
            """
            SELECT id FROM products
            WHERE id = %s AND status = 'active' AND is_active = 1
            """,
            (product_id,),
        )
        if not product:
            raise ValidationError(details={"product_id": "That product is unavailable"})
        cart = _get_or_create(db, user, session_key)
        existing = db.one(
            "SELECT * FROM cart_items WHERE cart_id = %s AND product_id = %s",
            (cart["id"], product_id),
        )
        new_quantity = quantity if not existing else min(99, existing["quantity"] + quantity)
        if existing:
            db.execute(
                "UPDATE cart_items SET quantity = %s WHERE id = %s",
                (new_quantity, existing["id"]),
            )
        else:
            db.execute(
                "INSERT INTO cart_items (cart_id, product_id, quantity) VALUES (%s, %s, %s)",
                (cart["id"], product_id, new_quantity),
            )
        return _present(db, cart)

    return run_transaction(work), None if user else session_key


def update_item(item_id, payload):
    quantity = parse_positive_int(payload.get("quantity"), "quantity", minimum=1, maximum=99)
    user = getattr(g, "current_user", None)
    session_key, _created = _session_key()

    def work(db):
        cart = _owned_cart(db, user, session_key)
        item = db.one(
            "SELECT * FROM cart_items WHERE id = %s AND cart_id = %s",
            (item_id, cart["id"]),
        )
        if not item:
            raise NotFound("Cart item not found")
        db.execute("UPDATE cart_items SET quantity = %s WHERE id = %s", (quantity, item_id))
        return _present(db, cart)

    return run_transaction(work)


def delete_item(item_id):
    user = getattr(g, "current_user", None)
    session_key, _created = _session_key()

    def work(db):
        cart = _owned_cart(db, user, session_key)
        _, count = db.execute(
            "DELETE FROM cart_items WHERE id = %s AND cart_id = %s",
            (item_id, cart["id"]),
        )
        if count != 1:
            raise NotFound("Cart item not found")
        return _present(db, cart)

    return run_transaction(work)


def merge_guest_cart(user, session_key):
    if not session_key or not KEY_RE.match(session_key):
        raise ValidationError(details={"session_key": "Invalid cart key"})

    def work(db):
        guest = db.one(
            "SELECT * FROM carts WHERE session_key = %s AND user_id IS NULL AND status = 'active'",
            (session_key,),
        )
        user_cart = _get_or_create(db, user, None)
        if not guest:
            return _present(db, user_cart)
        items = db.all("SELECT * FROM cart_items WHERE cart_id = %s", (guest["id"],))
        for item in items:
            existing = db.one(
                "SELECT * FROM cart_items WHERE cart_id = %s AND product_id = %s",
                (user_cart["id"], item["product_id"]),
            )
            if existing:
                db.execute(
                    "UPDATE cart_items SET quantity = %s WHERE id = %s",
                    (min(99, existing["quantity"] + item["quantity"]), existing["id"]),
                )
            else:
                db.execute(
                    "INSERT INTO cart_items (cart_id, product_id, quantity) VALUES (%s, %s, %s)",
                    (user_cart["id"], item["product_id"], item["quantity"]),
                )
        db.execute("UPDATE carts SET status = 'converted' WHERE id = %s", (guest["id"],))
        return _present(db, user_cart)

    return run_transaction(work)


def _present(db, cart):
    rows = db.all(
        """
        SELECT ci.id, ci.quantity, p.id AS product_id, p.name, p.slug, p.sku, p.cash_price,
               p.currency, p.status, p.is_active,
               COALESCE(i.on_hand, 0) - COALESCE(i.reserved, 0) AS available
        FROM cart_items ci
        JOIN products p ON p.id = ci.product_id
        LEFT JOIN inventory i ON i.product_id = p.id
        WHERE ci.cart_id = %s
        ORDER BY ci.id
        """,
        (cart["id"],),
    )
    items = []
    subtotal = to_money(0)
    for row in rows:
        available = row["status"] == "active" and row["is_active"]
        line = to_money(row["cash_price"]) * row["quantity"] if available else to_money(0)
        if available:
            subtotal = to_money(subtotal + line)
        items.append(
            {
                "id": row["id"],
                "product_id": row["product_id"],
                "name": row["name"],
                "slug": row["slug"],
                "sku": row["sku"],
                "unit_price": money_str(row["cash_price"]),
                "quantity": row["quantity"],
                "line_subtotal": money_str(line) if available else "0.00",
                "available": bool(available),
                "available_quantity": int(row["available"] or 0),
            }
        )
    return {
        "id": cart["id"],
        "items": items,
        "subtotal": money_str(subtotal),
        "currency": "KES",
        "note": "Totals are recalculated from current prices at checkout.",
    }


def _get_or_create(db, user, session_key):
    if user:
        cart = db.one(
            "SELECT * FROM carts WHERE user_id = %s AND status = 'active' ORDER BY id DESC LIMIT 1",
            (user["id"],),
        )
        if cart:
            return cart
        cart_id, _ = db.execute("INSERT INTO carts (user_id, status) VALUES (%s, 'active')", (user["id"],))
        return db.one("SELECT * FROM carts WHERE id = %s", (cart_id,))
    cart = db.one(
        "SELECT * FROM carts WHERE session_key = %s AND status = 'active' ORDER BY id DESC LIMIT 1",
        (session_key,),
    )
    if cart:
        return cart
    cart_id, _ = db.execute(
        "INSERT INTO carts (session_key, status) VALUES (%s, 'active')",
        (session_key,),
    )
    return db.one("SELECT * FROM carts WHERE id = %s", (cart_id,))


def _owned_cart(db, user, session_key):
    if user:
        cart = db.one(
            "SELECT * FROM carts WHERE user_id = %s AND status = 'active' ORDER BY id DESC LIMIT 1",
            (user["id"],),
        )
    else:
        cart = db.one(
            "SELECT * FROM carts WHERE session_key = %s AND status = 'active' ORDER BY id DESC LIMIT 1",
            (session_key,),
        )
    if not cart:
        raise NotFound("Cart not found")
    return cart


def _session_key():
    header = (request.headers.get("X-Cart-Key") or "").strip()
    if header:
        if not KEY_RE.match(header):
            raise ValidationError(details={"cart": "Invalid cart key"})
        return header, False
    cookie = request.cookies.get("cart_session")
    if cookie and KEY_RE.match(cookie):
        return cookie, False
    return secrets.token_urlsafe(24)[:64], True
