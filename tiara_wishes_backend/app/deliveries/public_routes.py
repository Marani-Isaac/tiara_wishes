from flask import Blueprint

from app.common.counties import COUNTIES
from app.common.responses import success
from app.deliveries.places import list_places

bp = Blueprint("delivery_places_public", __name__, url_prefix="/api/v1")


@bp.get("/counties")
def list_counties():
    return success(list(COUNTIES))


@bp.get("/delivery-places")
def list_public():
    return success(list_places(active_only=True))
