from flask import Blueprint, g, request

from app.admin.service import dashboard, nav_counts
from app.audit.service import list_audits
from app.brands.service import create_brand, delete_brand, list_admin as list_brands, update_brand
from app.catalog.routes import product_query_args
from app.catalog.service import (
    archive_product,
    create_product,
    delete_image,
    get_admin_product,
    list_products,
    moderate_review,
    reorder_images,
    save_image,
    update_product,
)
from app.categories.service import create_category, delete_category, list_admin as list_categories, update_category
from app.common.pagination import get_page_args, page_meta
from app.common.responses import success
from app.common.errors import Forbidden
from app.common.security import require_auth, require_permission
from app.common.validation import clean_text, json_body, parse_positive_int
from app.common.uploads import store_upload
from app.content.service import create_content, delete_content, list_content, list_settings, update_content, update_settings
from app.deliveries.places import create_place, delete_place, list_places, update_place
from app.deliveries.service import list_deliveries, update_delivery
from app.inventory.service import adjust_stock, list_inventory
from app.orders.service import admin_update_order, list_admin_orders
from app.orders.service import get_order_for_actor
from app.payments.service import admin_update_payment, list_payments, record_refund
from app.promotions.service import create_promotion, deactivate_promotion, get_promotion, list_promotions, update_promotion
from app.users.service import list_customers, set_roles, update_customer_status

bp = Blueprint("admin", __name__, url_prefix="/api/v1/admin")


@bp.get("/dashboard")
@require_permission("reports.read")
def dashboard_route():
    return success(dashboard(request.args.get("from"), request.args.get("to")))


@bp.get("/nav-counts")
@require_auth
def nav_counts_route():
    if not (g.current_user.get("permissions") or []):
        raise Forbidden()
    return success(nav_counts(g.current_user))


@bp.get("/categories")
@require_permission("categories.manage")
def categories_list():
    return success(list_categories())


@bp.post("/categories")
@require_permission("categories.manage")
def categories_create():
    return success(create_category(g.current_user, json_body()), "Category created", status=201)


@bp.patch("/categories/<int:category_id>")
@require_permission("categories.manage")
def categories_update(category_id):
    return success(update_category(g.current_user, category_id, json_body()), "Category updated")


@bp.delete("/categories/<int:category_id>")
@require_permission("categories.manage")
def categories_delete(category_id):
    return success(delete_category(g.current_user, category_id), "Category deleted")


@bp.get("/brands")
@require_permission("brands.manage")
def brands_list():
    return success(list_brands())


@bp.post("/brands")
@require_permission("brands.manage")
def brands_create():
    return success(create_brand(g.current_user, json_body()), "Brand created", status=201)


@bp.patch("/brands/<int:brand_id>")
@require_permission("brands.manage")
def brands_update(brand_id):
    return success(update_brand(g.current_user, brand_id, json_body()), "Brand updated")


@bp.delete("/brands/<int:brand_id>")
@require_permission("brands.manage")
def brands_delete(brand_id):
    return success(delete_brand(g.current_user, brand_id), "Brand deleted")


@bp.get("/products")
@require_permission("products.manage")
def products_list():
    args = product_query_args(admin=True)
    rows, total = list_products(args, admin=True)
    return success(rows, meta=page_meta(args["page"], args["per_page"], total))


@bp.post("/products")
@require_permission("products.manage")
def products_create():
    return success(create_product(g.current_user, json_body()), "Product created", status=201)


@bp.get("/products/<int:product_id>")
@require_permission("products.manage")
def products_detail(product_id):
    return success(get_admin_product(product_id))


@bp.patch("/products/<int:product_id>")
@require_permission("products.manage")
def products_update(product_id):
    return success(update_product(g.current_user, product_id, json_body()), "Product updated")


@bp.delete("/products/<int:product_id>")
@require_permission("products.manage")
def products_archive(product_id):
    return success(archive_product(g.current_user, product_id), "Product archived")


@bp.post("/products/<int:product_id>/images")
@require_permission("products.manage")
def images_create(product_id):
    alt = request.form.get("alt_text")
    if alt:
        alt = clean_text(alt, "alt_text", 180, required=False)
    return success(
        save_image(g.current_user, product_id, request.files.get("image"), alt),
        "Image uploaded",
        status=201,
    )


@bp.delete("/products/<int:product_id>/images/<int:image_id>")
@require_permission("products.manage")
def images_delete(product_id, image_id):
    return success(delete_image(g.current_user, product_id, image_id), "Image deleted")


@bp.patch("/products/<int:product_id>/images/reorder")
@require_permission("products.manage")
def images_reorder(product_id):
    return success(reorder_images(g.current_user, product_id, json_body().get("image_ids")), "Images reordered")


@bp.get("/inventory")
@require_permission("inventory.manage")
def inventory_list():
    page, per_page, offset = get_page_args()
    low_only = (request.args.get("low_stock") or "").lower() in {"1", "true", "yes"}
    rows, total = list_inventory(page, per_page, offset, low_stock_only=low_only)
    return success(rows, meta=page_meta(page, per_page, total))


@bp.post("/inventory/adjustments")
@require_permission("inventory.manage")
def inventory_adjust():
    data = json_body()
    result = adjust_stock(
        g.current_user,
        parse_positive_int(data.get("product_id"), "product_id"),
        data.get("quantity_change"),
        data.get("movement_type"),
        data.get("reason"),
    )
    return success(result, "Stock adjusted", status=201)


@bp.get("/orders")
@require_permission("orders.manage")
def orders_list():
    page, per_page, offset = get_page_args()
    rows, total = list_admin_orders(
        page,
        per_page,
        offset,
        status=request.args.get("status"),
        payment_status=request.args.get("payment_status"),
    )
    return success(rows, meta=page_meta(page, per_page, total))


@bp.get("/orders/<order_number>")
@require_permission("orders.manage")
def orders_detail(order_number):
    return success(get_order_for_actor(g.current_user, order_number))


@bp.patch("/orders/<order_number>")
@require_permission("orders.manage")
def orders_update(order_number):
    return success(admin_update_order(g.current_user, order_number, json_body()), "Order updated")


@bp.get("/customers")
@require_permission("customers.read", "customers.manage")
def customers_list():
    page, per_page, offset = get_page_args()
    rows, total = list_customers(page, per_page, offset, request.args.get("q"))
    return success(rows, meta=page_meta(page, per_page, total))


@bp.patch("/customers/<int:user_id>")
@require_permission("customers.manage")
def customers_update(user_id):
    return success(update_customer_status(g.current_user, user_id, json_body().get("status")), "Customer updated")


@bp.post("/customers/<int:user_id>/roles")
@require_permission("users.manage")
def customers_roles(user_id):
    return success(set_roles(g.current_user, user_id, json_body().get("roles")), "Roles updated")


@bp.get("/payments")
@require_permission("payments.manage")
def payments_list():
    page, per_page, offset = get_page_args()
    rows, total = list_payments(page, per_page, offset, request.args.get("status"))
    return success(rows, meta=page_meta(page, per_page, total))


@bp.patch("/payments/<int:payment_id>")
@require_permission("payments.manage")
def payments_update(payment_id):
    return success(admin_update_payment(g.current_user, payment_id, json_body()), "Payment updated")


@bp.post("/refunds")
@require_permission("refunds.manage")
def refunds_create():
    return success(record_refund(g.current_user, json_body()), "Refund recorded. No provider refund was sent.", status=201)


@bp.get("/deliveries")
@require_permission("deliveries.manage")
def deliveries_list():
    page, per_page, offset = get_page_args()
    rows, total = list_deliveries(page, per_page, offset, request.args.get("status"))
    return success(rows, meta=page_meta(page, per_page, total))


@bp.patch("/deliveries/<int:delivery_id>")
@require_permission("deliveries.manage")
def deliveries_update(delivery_id):
    return success(update_delivery(g.current_user, delivery_id, json_body()), "Delivery updated")


@bp.get("/delivery-places")
@require_permission("deliveries.manage")
def delivery_places_list():
    return success(list_places())


@bp.post("/delivery-places")
@require_permission("deliveries.manage")
def delivery_places_create():
    return success(create_place(g.current_user, json_body()), "Delivery place saved", status=201)


@bp.patch("/delivery-places/<int:place_id>")
@require_permission("deliveries.manage")
def delivery_places_update(place_id):
    return success(update_place(g.current_user, place_id, json_body()), "Delivery place updated")


@bp.delete("/delivery-places/<int:place_id>")
@require_permission("deliveries.manage")
def delivery_places_delete(place_id):
    return success(delete_place(g.current_user, place_id), "Delivery place deleted")


@bp.post("/media")
@require_permission("promotions.manage", "content.manage")
def media_upload():
    purpose = (request.form.get("purpose") or "").strip()
    required = {"promotions": "promotions.manage", "content": "content.manage"}.get(purpose)
    held = set(g.current_user.get("permissions") or [])
    if required not in held:
        raise Forbidden()
    return success(store_upload(request.files.get("image"), purpose), "Image uploaded", status=201)


@bp.get("/promotions")
@require_permission("promotions.manage")
def promotions_list():
    return success(list_promotions())


@bp.post("/promotions")
@require_permission("promotions.manage")
def promotions_create():
    return success(create_promotion(g.current_user, json_body()), "Promotion created", status=201)


@bp.get("/promotions/<int:promotion_id>")
@require_permission("promotions.manage")
def promotions_detail(promotion_id):
    return success(get_promotion(promotion_id))


@bp.patch("/promotions/<int:promotion_id>")
@require_permission("promotions.manage")
def promotions_update(promotion_id):
    return success(update_promotion(g.current_user, promotion_id, json_body()), "Promotion updated")


@bp.delete("/promotions/<int:promotion_id>")
@require_permission("promotions.manage")
def promotions_delete(promotion_id):
    return success(deactivate_promotion(g.current_user, promotion_id), "Promotion deactivated")


@bp.get("/content")
@require_permission("content.manage")
def content_list():
    return success(list_content())


@bp.post("/content")
@require_permission("content.manage")
def content_create():
    return success(create_content(g.current_user, json_body()), "Content created", status=201)


@bp.patch("/content/<int:content_id>")
@require_permission("content.manage")
def content_update(content_id):
    return success(update_content(g.current_user, content_id, json_body()), "Content updated")


@bp.delete("/content/<int:content_id>")
@require_permission("content.manage")
def content_delete(content_id):
    return success(delete_content(g.current_user, content_id), "Content deleted")


@bp.get("/settings")
@require_permission("content.manage")
def settings_get():
    return success(list_settings())


@bp.patch("/settings")
@require_permission("content.manage")
def settings_patch():
    return success(update_settings(g.current_user, json_body()), "Settings updated")


@bp.patch("/reviews/<int:review_id>")
@require_permission("reviews.moderate")
def reviews_moderate(review_id):
    return success(moderate_review(g.current_user, review_id, json_body().get("status")), "Review updated")


@bp.get("/audit-logs")
@require_permission("audit.read")
def audits():
    page, per_page, offset = get_page_args()
    rows, total = list_audits(page, per_page, offset, request.args.get("entity_type"))
    return success(rows, meta=page_meta(page, per_page, total))
