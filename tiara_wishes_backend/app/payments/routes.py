from flask import Blueprint, current_app, g, request

from app.common.responses import success
from app.common.security import require_auth
from app.common.validation import json_body
from app.extensions import limiter
from app.payments.service import get_payment, handle_webhook, initiate_payment

bp = Blueprint("payments", __name__, url_prefix="/api/v1")


def _limit_payment():
    return current_app.config["RATE_LIMIT_PAYMENT"]


@bp.post("/orders/<order_number>/payments")
@require_auth
@limiter.limit(_limit_payment)
def initiate_route(order_number):
    payment = initiate_payment(
        g.current_user,
        order_number,
        json_body(),
        request.headers.get("Idempotency-Key"),
    )
    return success(payment, "Payment initiated", status=201)


@bp.get("/payments/<merchant_reference>")
@require_auth
def status_route(merchant_reference):
    return success(get_payment(g.current_user, merchant_reference))


@bp.post("/payments/webhooks/<provider>")
def webhook_route(provider):
    result = handle_webhook(provider, request.get_data())
    return success(result, "Webhook processed")
