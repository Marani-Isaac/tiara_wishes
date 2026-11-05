from flask import Blueprint, current_app, g, request

from app.cart.service import add_item, delete_item, get_cart, merge_guest_cart, update_item
from app.common.responses import success
from app.common.security import require_auth
from app.common.validation import json_body

bp = Blueprint("cart", __name__, url_prefix="/api/v1")


def _cookie(response, session_key):
    if not session_key:
        return response
    response.set_cookie(
        "cart_session",
        session_key,
        httponly=True,
        secure=current_app.config["SESSION_COOKIE_SECURE"],
        samesite=current_app.config["SESSION_COOKIE_SAMESITE"],
        max_age=60 * 60 * 24 * 30,
        path="/",
    )
    return response


@bp.get("/cart")
def get_route():
    data, session_key = get_cart()
    response, status = success(data)
    return _cookie(response, session_key), status


@bp.post("/cart/items")
def add_route():
    data, session_key = add_item(json_body())
    response, status = success(data, "Item added", status=201)
    return _cookie(response, session_key), status


@bp.patch("/cart/items/<int:item_id>")
def update_route(item_id):
    return success(update_item(item_id, json_body()), "Cart updated")


@bp.delete("/cart/items/<int:item_id>")
def delete_route(item_id):
    return success(delete_item(item_id), "Item removed")


@bp.post("/cart/merge")
@require_auth
def merge_route():
    payload = json_body()
    session_key = payload.get("session_key") or request.cookies.get("cart_session")
    return success(merge_guest_cart(g.current_user, session_key), "Cart merged")
