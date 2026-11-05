from flask import Blueprint, g, request

from app.common.pagination import get_page_args, page_meta
from app.common.responses import success
from app.common.security import require_auth
from app.common.validation import json_body
from app.orders.service import cancel_order, create_order, get_order_for_actor, list_orders_for_user, quote

bp = Blueprint("orders", __name__, url_prefix="/api/v1")


@bp.post("/checkout/quote")
def quote_route():
    user = getattr(g, "current_user", None)
    return success(quote(user, json_body()))


@bp.post("/orders")
@require_auth
def create_route():
    order = create_order(g.current_user, json_body(), request.headers.get("Idempotency-Key"))
    return success(order, "Order created", status=201)


@bp.get("/account/orders")
@require_auth
def list_route():
    page, per_page, offset = get_page_args()
    rows, total = list_orders_for_user(g.current_user, page, per_page, offset)
    return success(rows, meta=page_meta(page, per_page, total))


@bp.get("/account/orders/<order_number>")
@require_auth
def account_detail(order_number):
    from app.orders.service import get_order_for_user

    return success(get_order_for_user(g.current_user, order_number))


@bp.get("/orders/<order_number>")
@require_auth
def detail_route(order_number):
    return success(get_order_for_actor(g.current_user, order_number))


@bp.post("/orders/<order_number>/cancel")
@require_auth
def cancel_route(order_number):
    payload = request.get_json(silent=True) or {}
    if not isinstance(payload, dict):
        payload = {}
    return success(cancel_order(g.current_user, order_number, payload.get("reason")), "Order cancelled")
