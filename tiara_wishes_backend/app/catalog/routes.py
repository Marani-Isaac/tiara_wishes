from flask import Blueprint, g, request

from app.catalog.service import add_review, get_public_product, list_products, list_reviews
from app.common.errors import ValidationError
from app.common.pagination import get_page_args, page_meta
from app.common.responses import success
from app.common.security import require_auth
from app.common.validation import json_body, parse_money

bp = Blueprint("catalog", __name__, url_prefix="/api/v1")


def product_query_args(admin=False):
    page, per_page, offset = get_page_args()
    featured_raw = (request.args.get("featured") or "").lower()
    args = {
        "page": page,
        "per_page": per_page,
        "offset": offset,
        "q": request.args.get("q"),
        "category": request.args.get("category"),
        "brand": request.args.get("brand"),
        "sort": request.args.get("sort") or "newest",
        "featured": featured_raw in {"1", "true", "yes"},
        "status": request.args.get("status") if admin else None,
    }
    if request.args.get("min_price") not in (None, ""):
        args["min_price"] = parse_money(request.args.get("min_price"), "min_price")
    if request.args.get("max_price") not in (None, ""):
        args["max_price"] = parse_money(request.args.get("max_price"), "max_price")
    if args["sort"] not in {"newest", "price_asc", "price_desc", "name"}:
        raise ValidationError(details={"sort": "Sort must be newest, price_asc, price_desc, or name"})
    return args


@bp.get("/products")
def list_route():
    args = product_query_args()
    rows, total = list_products(args, admin=False)
    return success(rows, meta=page_meta(args["page"], args["per_page"], total))


@bp.get("/products/<slug>")
def detail_route(slug):
    return success(get_public_product(slug))


@bp.get("/products/<slug>/reviews")
def reviews_route(slug):
    page, per_page, offset = get_page_args()
    rows, total = list_reviews(slug, page, per_page, offset)
    return success(rows, meta=page_meta(page, per_page, total))


@bp.post("/products/<slug>/reviews")
@require_auth
def add_review_route(slug):
    return success(add_review(g.current_user, slug, json_body()), "Review submitted for moderation", status=201)
