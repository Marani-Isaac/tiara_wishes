from flask import Blueprint

from app.brands.service import list_public
from app.common.responses import success

bp = Blueprint("brands", __name__, url_prefix="/api/v1")


@bp.get("/brands")
def list_route():
    return success(list_public())
