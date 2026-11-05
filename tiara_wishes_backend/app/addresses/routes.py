from flask import Blueprint, g

from app.addresses.service import create_address, delete_address, list_addresses, update_address
from app.common.responses import success
from app.common.security import require_auth
from app.common.validation import json_body

bp = Blueprint("addresses", __name__, url_prefix="/api/v1")


@bp.get("/account/addresses")
@require_auth
def list_route():
    return success(list_addresses(g.current_user["id"]))


@bp.post("/account/addresses")
@require_auth
def create_route():
    return success(create_address(g.current_user, json_body()), "Address saved", status=201)


@bp.patch("/account/addresses/<int:address_id>")
@require_auth
def update_route(address_id):
    return success(update_address(g.current_user, address_id, json_body()), "Address updated")


@bp.delete("/account/addresses/<int:address_id>")
@require_auth
def delete_route(address_id):
    return success(delete_address(g.current_user, address_id), "Address deleted")
