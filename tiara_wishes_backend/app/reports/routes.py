from flask import Blueprint, request

from app.common.responses import success
from app.common.security import require_permission
from app.reports.service import product_report, sales_report

bp = Blueprint("reports", __name__, url_prefix="/api/v1/admin/reports")


@bp.get("/sales")
@require_permission("reports.read")
def sales():
    return success(sales_report(request.args.get("from"), request.args.get("to")))


@bp.get("/products")
@require_permission("reports.read")
def products():
    return success(product_report(request.args.get("from"), request.args.get("to")))
