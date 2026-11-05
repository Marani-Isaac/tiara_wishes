from flask import Blueprint

from app.common.responses import success
from app.content.service import home

bp = Blueprint("content", __name__, url_prefix="/api/v1")


@bp.get("/site-content/home")
def home_route():
    return success(home())
