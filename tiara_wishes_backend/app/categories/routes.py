from flask import Blueprint

from app.categories.service import get_public, list_public
from app.common.responses import success

bp = Blueprint("categories", __name__, url_prefix="/api/v1")


@bp.get("/categories")
def list_route():
    return success(list_public())


@bp.get("/categories/<slug>")
def detail_route(slug):
    return success(get_public(slug))
