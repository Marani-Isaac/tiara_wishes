import json
import threading
import time
import uuid
from pathlib import Path

from flask import current_app

from app.audit.service import write_audit
from app.common.errors import Conflict, NotFound, ValidationError
from app.common.money import money_str
from app.common.serializers import image_public, product_public
from app.common.slugs import unique_slug
from app.common.transactions import run_transaction
from app.common.validation import (
    clean_multiline,
    clean_text,
    parse_money,
    parse_positive_int,
    slugify,
    validate_http_url,
    validate_sku,
    validate_slug,
)
from app.common.paths import media_root
from app.db.connection import db_session

PRODUCT_FROM = """
FROM products p
JOIN categories c ON c.id = p.category_id
LEFT JOIN brands b ON b.id = p.brand_id
LEFT JOIN inventory i ON i.product_id = p.id
"""

PRODUCT_COLUMNS = """
SELECT p.*, c.slug AS category_slug, c.name AS category_name,
       b.slug AS brand_slug, b.name AS brand_name,
       COALESCE(i.on_hand, 0) AS on_hand,
       COALESCE(i.reserved, 0) AS reserved,
       COALESCE(i.on_hand, 0) - COALESCE(i.reserved, 0) AS available
"""

LIST_COLUMNS = """
SELECT p.id, p.category_id, p.brand_id, p.name, p.slug, p.sku,
       p.short_description, p.usage_video_url, p.handling,
       p.cash_price, p.compare_at_price, p.currency, p.is_featured,
       c.slug AS category_slug, c.name AS category_name,
       b.slug AS brand_slug, b.name AS brand_name,
       COALESCE(i.on_hand, 0) - COALESCE(i.reserved, 0) AS available
"""

SORTS = {
    "newest": "p.created_at DESC, p.id DESC",
    "price_asc": "p.cash_price ASC, p.id ASC",
    "price_desc": "p.cash_price DESC, p.id DESC",
    "name": "p.name ASC, p.id ASC",
}


_PUBLIC_LIST_CACHE = {}
_PUBLIC_LIST_LOCK = threading.Lock()
_PUBLIC_LIST_TTL = 15


def _public_reads_cached():
    try:
        return not current_app.config.get("TESTING")
    except RuntimeError:
        return False


def list_products(args, admin=False):
    page = args["page"]
    per_page = args["per_page"]
    offset = args["offset"]
    if args.get("category"):
        args = dict(args)
        args["category_ids"] = category_ids_for_slug(args["category"])
    cache_key = None
    if not admin and _public_reads_cached():
        cache_key = (
            page,
            per_page,
            offset,
            args.get("sort") or "newest",
            args.get("q") or "",
            args.get("category") or "",
            tuple(args.get("category_ids") or ()),
            args.get("brand") or "",
            str(args.get("min_price")),
            str(args.get("max_price")),
            bool(args.get("featured")),
        )
        now = time.monotonic()
        with _PUBLIC_LIST_LOCK:
            hit = _PUBLIC_LIST_CACHE.get(cache_key)
            if hit is not None and now - hit[0] < _PUBLIC_LIST_TTL:
                return hit[1]
    where, params = _filters(args, admin=admin)
    order = SORTS.get(args.get("sort") or "newest", SORTS["newest"])
    if admin:
        select_sql = f"{PRODUCT_COLUMNS}, COUNT(*) OVER() AS filtered_total {PRODUCT_FROM}"
    else:
        select_sql = f"""
            {LIST_COLUMNS},
            COUNT(*) OVER() AS filtered_total,
            pi.id AS image_id, pi.image_url, pi.alt_text, pi.is_primary, pi.sort_order
            {PRODUCT_FROM}
            LEFT JOIN product_images pi ON pi.product_id = p.id AND pi.is_primary = 1
        """
    with db_session() as db:
        rows = db.all(
            f"""
            {select_sql}
            WHERE {where}
            ORDER BY {order}
            LIMIT %s OFFSET %s
            """,
            [*params, per_page, offset],
        )
        if rows:
            total = int(rows[0]["filtered_total"])
        elif offset:
            total = db.one(f"SELECT COUNT(*) AS total {PRODUCT_FROM} WHERE {where}", params)["total"]
        else:
            total = 0
        images = _images_for(db, [row["id"] for row in rows]) if admin else None
    if images is None:
        images = {}
        for row in rows:
            if row.get("image_url"):
                images[row["id"]] = [
                    image_public(
                        {
                            "id": row["image_id"],
                            "image_url": row["image_url"],
                            "alt_text": row["alt_text"],
                            "is_primary": row["is_primary"],
                            "sort_order": row["sort_order"],
                        }
                    )
                ]
            else:
                images[row["id"]] = []
    result = [product_public(row, images.get(row["id"], []), admin=admin) for row in rows], total
    if cache_key is not None:
        with _PUBLIC_LIST_LOCK:
            _PUBLIC_LIST_CACHE[cache_key] = (time.monotonic(), result)
            if len(_PUBLIC_LIST_CACHE) > 40:
                oldest = min(_PUBLIC_LIST_CACHE, key=lambda key: _PUBLIC_LIST_CACHE[key][0])
                _PUBLIC_LIST_CACHE.pop(oldest, None)
    return result


def get_public_product(slug):
    with db_session() as db:
        row = db.one(
            f"""
            {PRODUCT_COLUMNS}
            {PRODUCT_FROM}
            WHERE p.slug = %s AND p.status = 'active' AND p.is_active = 1
            """,
            (slug,),
        )
        if not row:
            raise NotFound("Product not found")
        images = _images_for(db, [row["id"]]).get(row["id"], [])
        path = _category_path(db, row["category_id"])
        rating = db.one(
            """
            SELECT COUNT(*) AS review_count, AVG(rating) AS average_rating
            FROM reviews WHERE product_id = %s AND status = 'approved'
            """,
            (row["id"],),
        )
    data = product_public(row, images, admin=False)
    data["description"] = row["description"]
    data["category_path"] = path
    data["key_features"] = _lines(row.get("key_features"))
    data["box_contents"] = _lines(row.get("box_contents"))
    data["model_name"] = row.get("model_name")
    data["material"] = row.get("material")
    data["size_label"] = row.get("size_label")
    data["warranty"] = row.get("warranty")
    data["specifications"] = specification_rows(row.get("specifications_json"))
    data["weight"] = money_str(row["weight"]) if row.get("weight") is not None else None
    data["length"] = money_str(row["length"]) if row.get("length") is not None else None
    data["width"] = money_str(row["width"]) if row.get("width") is not None else None
    data["height"] = money_str(row["height"]) if row.get("height") is not None else None
    data["review_count"] = int(rating["review_count"] or 0)
    average = rating["average_rating"]
    data["average_rating"] = None if average is None else round(float(average), 2)
    return data


def get_admin_product(product_id):
    with db_session() as db:
        row = _admin_row(db, product_id)
        images = _images_for(db, [product_id]).get(product_id, [])
        path = _category_path(db, row["category_id"])
    data = product_public(row, images, admin=True)
    data["category_path"] = path
    data["specifications"] = specification_rows(row.get("specifications_json"))
    return data


def create_product(actor, data):
    cleaned = _clean_product(data, partial=False)

    def work(db):
        _assert_category(db, cleaned["category_id"])
        if cleaned["brand_id"]:
            _assert_brand(db, cleaned["brand_id"])
        slug = unique_slug(db, "products", cleaned["slug"])
        product_id, _ = db.execute(
            """
            INSERT INTO products (
              category_id, brand_id, name, slug, sku, short_description, description,
              usage_video_url, handling,
              cash_price, compare_at_price, currency, low_stock_threshold,
              weight, length, width, height,
              model_name, material, size_label, warranty, key_features, box_contents,
              specifications_json,
              is_featured, is_active, status,
              meta_title, meta_description
            ) VALUES (
              %s, %s, %s, %s, %s, %s, %s,
              %s, %s,
              %s, %s, %s, %s,
              %s, %s, %s, %s,
              %s, %s, %s, %s, %s, %s,
              %s,
              %s, %s, %s,
              %s, %s
            )
            """,
            (
                cleaned["category_id"],
                cleaned["brand_id"],
                cleaned["name"],
                slug,
                cleaned["sku"],
                cleaned["short_description"],
                cleaned["description"],
                cleaned["usage_video_url"],
                cleaned["handling"],
                cleaned["cash_price"],
                cleaned["compare_at_price"],
                current_app.config["CURRENCY"],
                cleaned["low_stock_threshold"],
                cleaned["weight"],
                cleaned["length"],
                cleaned["width"],
                cleaned["height"],
                cleaned["model_name"],
                cleaned["material"],
                cleaned["size_label"],
                cleaned["warranty"],
                cleaned["key_features"],
                cleaned["box_contents"],
                _dump_specifications(cleaned["specifications"]),
                1 if cleaned["is_featured"] else 0,
                1 if cleaned["is_active"] else 0,
                cleaned["status"],
                cleaned["meta_title"],
                cleaned["meta_description"],
            ),
        )
        opening = cleaned["opening_stock"]
        db.execute(
            "INSERT INTO inventory (product_id, on_hand, reserved) VALUES (%s, %s, 0)",
            (product_id, opening),
        )
        if opening:
            db.execute(
                """
                INSERT INTO inventory_movements (
                  product_id, movement_type, quantity_change, reference_type, reason, created_by
                ) VALUES (%s, 'opening_stock', %s, 'product', 'Opening stock', %s)
                """,
                (product_id, opening, actor["id"]),
            )
        row = _admin_row(db, product_id)
        write_audit(db, actor["id"], "product.created", "product", product_id, after={"sku": cleaned["sku"], "cash_price": str(cleaned["cash_price"])})
        return product_public(row, [], admin=True)

    try:
        return run_transaction(work)
    except Exception as exc:
        _duplicate(exc)


def update_product(actor, product_id, data):
    cleaned = _clean_product(data, partial=True)

    def work(db):
        existing = db.one("SELECT * FROM products WHERE id = %s FOR UPDATE", (product_id,))
        if not existing:
            raise NotFound("Product not found")
        merged = dict(existing)
        merged.update(cleaned)
        if "category_id" in cleaned:
            _assert_category(db, cleaned["category_id"])
        if "brand_id" in cleaned and cleaned["brand_id"]:
            _assert_brand(db, cleaned["brand_id"])
        slug = existing["slug"]
        if "slug" in cleaned or "name" in cleaned:
            slug = unique_slug(db, "products", cleaned.get("slug") or slugify(merged["name"]), ignore_id=product_id)
        db.execute(
            """
            UPDATE products
            SET category_id = %s, brand_id = %s, name = %s, slug = %s, sku = %s,
                short_description = %s, description = %s, usage_video_url = %s, handling = %s,
                cash_price = %s, compare_at_price = %s,
                low_stock_threshold = %s, weight = %s, length = %s, width = %s, height = %s,
                model_name = %s, material = %s, size_label = %s, warranty = %s,
                key_features = %s, box_contents = %s, specifications_json = %s,
                is_featured = %s, is_active = %s, status = %s, meta_title = %s, meta_description = %s
            WHERE id = %s
            """,
            (
                merged["category_id"],
                merged["brand_id"],
                merged["name"],
                slug,
                merged["sku"],
                merged["short_description"],
                merged["description"],
                merged.get("usage_video_url"),
                merged.get("handling") or "normal",
                merged["cash_price"],
                merged["compare_at_price"],
                merged["low_stock_threshold"],
                merged["weight"],
                merged["length"],
                merged["width"],
                merged["height"],
                merged.get("model_name"),
                merged.get("material"),
                merged.get("size_label"),
                merged.get("warranty"),
                merged.get("key_features"),
                merged.get("box_contents"),
                _dump_specifications(merged.get("specifications_json") if "specifications" not in cleaned else cleaned.get("specifications")),
                1 if merged["is_featured"] else 0,
                1 if merged["is_active"] else 0,
                merged["status"],
                merged["meta_title"],
                merged["meta_description"],
                product_id,
            ),
        )
        row = _admin_row(db, product_id)
        write_audit(
            db,
            actor["id"],
            "product.updated",
            "product",
            product_id,
            before={"cash_price": str(existing["cash_price"]), "status": existing["status"]},
            after={"cash_price": str(row["cash_price"]), "status": row["status"]},
        )
        images = _images_for(db, [product_id]).get(product_id, [])
        return product_public(row, images, admin=True)

    try:
        return run_transaction(work)
    except Exception as exc:
        _duplicate(exc)


def archive_product(actor, product_id):
    def work(db):
        existing = db.one("SELECT * FROM products WHERE id = %s FOR UPDATE", (product_id,))
        if not existing:
            raise NotFound("Product not found")
        db.execute(
            "UPDATE products SET status = 'archived', is_active = 0 WHERE id = %s",
            (product_id,),
        )
        write_audit(
            db,
            actor["id"],
            "product.archived",
            "product",
            product_id,
            before={"status": existing["status"]},
            after={"status": "archived"},
        )
        return get_inside(db, product_id)

    return run_transaction(work)


def save_image(actor, product_id, file_storage, alt_text):
    if file_storage is None:
        raise ValidationError(details={"image": "Choose an image file"})
    blob = file_storage.read()
    limit = current_app.config["MAX_UPLOAD_MB"] * 1024 * 1024
    if not blob or len(blob) > limit:
        raise ValidationError(details={"image": "Image is empty or too large"})
    extension = _detect_image(blob)
    if not extension:
        raise ValidationError(details={"image": "Upload a JPEG, PNG, or WebP image"})
    alt = clean_text(alt_text, "alt_text", 180, required=False) if alt_text else None

    def work(db):
        product = db.one("SELECT id, name FROM products WHERE id = %s", (product_id,))
        if not product:
            raise NotFound("Product not found")
        existing = db.one("SELECT id FROM product_images WHERE product_id = %s LIMIT 1", (product_id,))
        is_primary = existing is None
        if is_primary:
            db.execute("UPDATE product_images SET is_primary = 0 WHERE product_id = %s", (product_id,))
        filename = f"{uuid.uuid4().hex}{extension}"
        relative = f"products/{product_id}/{filename}"
        image_url = current_app.config["MEDIA_URL_PREFIX"].rstrip("/") + "/" + relative
        image_id, _ = db.execute(
            """
            INSERT INTO product_images (product_id, image_url, alt_text, is_primary, sort_order)
            VALUES (%s, %s, %s, %s, %s)
            """,
            (product_id, image_url, alt or product["name"], 1 if is_primary else 0, 0 if is_primary else 1),
        )
        write_audit(db, actor["id"], "product.image_added", "product", product_id, after={"image_id": image_id})
        return image_id, relative, image_url

    image_id, relative, image_url = run_transaction(work)
    root = media_root()
    target = root / relative
    target.parent.mkdir(parents=True, exist_ok=True)
    target.write_bytes(blob)
    return {"id": image_id, "image_url": image_url, "is_primary": False}


def delete_image(actor, product_id, image_id):
    def work(db):
        row = db.one(
            "SELECT * FROM product_images WHERE id = %s AND product_id = %s",
            (image_id, product_id),
        )
        if not row:
            raise NotFound("Image not found")
        db.execute("DELETE FROM product_images WHERE id = %s", (image_id,))
        if row["is_primary"]:
            nxt = db.one(
                """
                SELECT id FROM product_images
                WHERE product_id = %s ORDER BY sort_order, id LIMIT 1
                """,
                (product_id,),
            )
            if nxt:
                db.execute("UPDATE product_images SET is_primary = 1 WHERE id = %s", (nxt["id"],))
        write_audit(db, actor["id"], "product.image_deleted", "product", product_id, after={"image_id": image_id})
        return row["image_url"]

    image_url = run_transaction(work)
    _unlink(image_url)
    return {"id": image_id}


def reorder_images(actor, product_id, image_ids):
    if not isinstance(image_ids, list) or not image_ids:
        raise ValidationError(details={"image_ids": "Provide the image ids in the new order"})

    def work(db):
        rows = db.all("SELECT id FROM product_images WHERE product_id = %s ORDER BY id", (product_id,))
        existing = [row["id"] for row in rows]
        if sorted(existing) != sorted(image_ids) or len(image_ids) != len(set(image_ids)):
            raise ValidationError(details={"image_ids": "Image ids do not match this product"})
        db.execute("UPDATE product_images SET is_primary = 0 WHERE product_id = %s", (product_id,))
        for index, image_id in enumerate(image_ids):
            db.execute(
                "UPDATE product_images SET sort_order = %s, is_primary = %s WHERE id = %s AND product_id = %s",
                (index, 1 if index == 0 else 0, image_id, product_id),
            )
        write_audit(db, actor["id"], "product.images_reordered", "product", product_id, after={"image_ids": image_ids})
        return _images_for(db, [product_id]).get(product_id, [])

    return run_transaction(work)


def list_reviews(slug, page, per_page, offset):
    with db_session() as db:
        product = db.one(
            "SELECT id FROM products WHERE slug = %s AND status = 'active' AND is_active = 1",
            (slug,),
        )
        if not product:
            raise NotFound("Product not found")
        total = db.one(
            "SELECT COUNT(*) AS total FROM reviews WHERE product_id = %s AND status = 'approved'",
            (product["id"],),
        )["total"]
        rows = db.all(
            """
            SELECT r.*, u.first_name
            FROM reviews r JOIN users u ON u.id = r.user_id
            WHERE r.product_id = %s AND r.status = 'approved'
            ORDER BY r.id DESC LIMIT %s OFFSET %s
            """,
            (product["id"], per_page, offset),
        )
    return [_review_public(row) for row in rows], total


def add_review(user, slug, data):
    rating = data.get("rating")
    if isinstance(rating, bool) or not isinstance(rating, int) or rating < 1 or rating > 5:
        raise ValidationError(details={"rating": "Choose a rating from 1 to 5"})
    title = clean_text(data.get("title"), "title", 160, required=False)
    comment = clean_text(data.get("comment"), "comment", 2000, required=False)

    def work(db):
        product = db.one(
            "SELECT id FROM products WHERE slug = %s AND status = 'active' AND is_active = 1",
            (slug,),
        )
        if not product:
            raise NotFound("Product not found")
        existing = db.one(
            "SELECT * FROM reviews WHERE product_id = %s AND user_id = %s FOR UPDATE",
            (product["id"], user["id"]),
        )
        if existing and existing["status"] != "rejected":
            raise Conflict("You have already reviewed this product")
        if existing:
            db.execute(
                """
                UPDATE reviews
                SET rating = %s, title = %s, comment = %s, status = 'pending'
                WHERE id = %s
                """,
                (rating, title, comment, existing["id"]),
            )
            review_id = existing["id"]
        else:
            review_id, _ = db.execute(
                """
                INSERT INTO reviews (product_id, user_id, rating, title, comment, status)
                VALUES (%s, %s, %s, %s, %s, 'pending')
                """,
                (product["id"], user["id"], rating, title, comment),
            )
        row = db.one(
            """
            SELECT r.*, u.first_name FROM reviews r
            JOIN users u ON u.id = r.user_id WHERE r.id = %s
            """,
            (review_id,),
        )
        return _review_public(row, include_status=True)

    return run_transaction(work)


def moderate_review(actor, review_id, status):
    if status not in {"approved", "rejected", "pending"}:
        raise ValidationError(details={"status": "Status must be approved, rejected, or pending"})

    def work(db):
        row = db.one("SELECT * FROM reviews WHERE id = %s FOR UPDATE", (review_id,))
        if not row:
            raise NotFound("Review not found")
        db.execute("UPDATE reviews SET status = %s WHERE id = %s", (status, review_id))
        write_audit(
            db,
            actor["id"],
            "review.moderated",
            "review",
            review_id,
            before={"status": row["status"]},
            after={"status": status},
        )
        return {"id": review_id, "status": status}

    return run_transaction(work)


def get_inside(db, product_id):
    row = _admin_row(db, product_id)
    images = _images_for(db, [product_id]).get(product_id, [])
    return product_public(row, images, admin=True)


def _admin_row(db, product_id):
    row = db.one(
        f"{PRODUCT_COLUMNS} {PRODUCT_FROM} WHERE p.id = %s",
        (product_id,),
    )
    if not row:
        raise NotFound("Product not found")
    return row


def _images_for(db, product_ids):
    grouped = {product_id: [] for product_id in product_ids}
    if not product_ids:
        return grouped
    placeholders = ", ".join(["%s"] * len(product_ids))
    rows = db.all(
        f"""
        SELECT * FROM product_images
        WHERE product_id IN ({placeholders})
        ORDER BY is_primary DESC, sort_order, id
        """,
        product_ids,
    )
    for row in rows:
        grouped.setdefault(row["product_id"], []).append(image_public(row))
    return grouped


def _filters(args, admin):
    where = ["1=1"]
    params = []
    if not admin:
        where.append("p.status = 'active' AND p.is_active = 1")
    elif args.get("status"):
        if args["status"] not in {"draft", "active", "archived"}:
            raise ValidationError(details={"status": "Unknown product status"})
        where.append("p.status = %s")
        params.append(args["status"])
    if args.get("q"):
        from app.common.validation import like_pattern

        pattern = like_pattern(args["q"])
        where.append(
            "(p.name LIKE %s ESCAPE '\\\\' OR p.sku LIKE %s ESCAPE '\\\\' OR p.short_description LIKE %s ESCAPE '\\\\')"
        )
        params.extend([pattern, pattern, pattern])
    if args.get("category"):
        category_ids = args.get("category_ids") or []
        if not category_ids:
            where.append("1 = 0")
        else:
            placeholders = ", ".join(["%s"] * len(category_ids))
            where.append(f"p.category_id IN ({placeholders})")
            params.extend(category_ids)
    if args.get("brand"):
        where.append("b.slug = %s")
        params.append(args["brand"])
    if args.get("min_price") is not None:
        where.append("p.cash_price >= %s")
        params.append(args["min_price"])
    if args.get("max_price") is not None:
        where.append("p.cash_price <= %s")
        params.append(args["max_price"])
    if args.get("featured"):
        where.append("p.is_featured = 1")
    return " AND ".join(where), params


def specification_rows(value):
    if not value:
        return []
    if isinstance(value, (bytes, bytearray)):
        value = value.decode()
    if isinstance(value, str):
        try:
            value = json.loads(value)
        except (TypeError, ValueError):
            return []
    if not isinstance(value, list):
        return []
    rows = []
    for item in value:
        if not isinstance(item, dict):
            continue
        label = item.get("label")
        detail = item.get("value")
        if label and detail:
            rows.append({"label": str(label), "value": str(detail)})
    return rows


def _dump_specifications(value):
    rows = specification_rows(value)
    if not rows:
        return None
    return json.dumps(rows, ensure_ascii=False)


def _clean_specifications(value):
    if value in (None, "", []):
        return None
    if not isinstance(value, list):
        raise ValidationError(details={"specifications": "Send a list of label and value rows"})
    rows = []
    for item in value:
        if not isinstance(item, dict):
            raise ValidationError(details={"specifications": "Each specification needs a label and a value"})
        label = clean_text(item.get("label"), "specifications", 80, required=False)
        detail = clean_text(item.get("value"), "specifications", 300, required=False)
        if not label and not detail:
            continue
        if not label or not detail:
            raise ValidationError(details={"specifications": "Each specification needs both a label and a value"})
        rows.append({"label": label, "value": detail})
    if len(rows) > 40:
        raise ValidationError(details={"specifications": "Use 40 specifications or fewer"})
    return rows or None


def _lines(value):
    if not value:
        return []
    return [line.strip() for line in str(value).splitlines() if line.strip()]


def _category_path(db, category_id):
    chain = []
    current = category_id
    seen = set()
    while current and current not in seen and len(chain) < 8:
        seen.add(current)
        row = db.one(
            "SELECT id, parent_id, name, slug FROM categories WHERE id = %s",
            (current,),
        )
        if not row:
            break
        chain.append({"id": row["id"], "name": row["name"], "slug": row["slug"]})
        current = row["parent_id"]
    chain.reverse()
    return chain


def _clean_product(data, partial):
    if not isinstance(data, dict):
        raise ValidationError("Request body must be a JSON object")
    cleaned = {}
    if not partial or "name" in data:
        cleaned["name"] = clean_text(data.get("name"), "name", 200)
    if "slug" in data and data.get("slug"):
        cleaned["slug"] = validate_slug(data.get("slug"))
    elif not partial:
        cleaned["slug"] = slugify(cleaned["name"])
    if not partial or "sku" in data:
        cleaned["sku"] = validate_sku(data.get("sku"))
    if not partial or "category_id" in data:
        cleaned["category_id"] = parse_positive_int(data.get("category_id"), "category_id")
    if not partial or "brand_id" in data:
        if data.get("brand_id") in (None, ""):
            cleaned["brand_id"] = None
        else:
            cleaned["brand_id"] = parse_positive_int(data.get("brand_id"), "brand_id")
    for field, limit, required in (
        ("short_description", 300, False),
        ("meta_title", 180, False),
        ("meta_description", 300, False),
        ("model_name", 160, False),
        ("material", 160, False),
        ("size_label", 160, False),
        ("warranty", 255, False),
    ):
        if not partial or field in data:
            cleaned[field] = clean_text(data.get(field), field, limit, required=required)
    for field, limit in (
        ("description", 20000),
        ("key_features", 4000),
        ("box_contents", 4000),
    ):
        if not partial or field in data:
            cleaned[field] = clean_multiline(data.get(field), field, limit)
    if not partial or "specifications" in data:
        cleaned["specifications"] = _clean_specifications(data.get("specifications"))
    if not partial or "usage_video_url" in data:
        cleaned["usage_video_url"] = validate_http_url(data.get("usage_video_url"), "usage_video_url", required=False)
    if not partial or "handling" in data:
        handling = data.get("handling", "normal" if not partial else None)
        if handling not in {"normal", "delicate", "perishable"}:
            raise ValidationError(details={"handling": "Handling must be normal, delicate, or perishable"})
        cleaned["handling"] = handling
    if not partial or "cash_price" in data:
        cleaned["cash_price"] = parse_money(data.get("cash_price"), "cash_price", allow_zero=True)
    if not partial or "compare_at_price" in data:
        cleaned["compare_at_price"] = parse_money(
            data.get("compare_at_price"), "compare_at_price", allow_zero=True, required=False
        )
    if not partial or "low_stock_threshold" in data:
        value = data.get("low_stock_threshold", 5 if not partial else None)
        if value is None and partial:
            pass
        else:
            cleaned["low_stock_threshold"] = parse_positive_int(value if value is not None else 5, "low_stock_threshold", minimum=0, maximum=100000)
    for field in ("weight", "length", "width", "height"):
        if not partial or field in data:
            cleaned[field] = parse_money(data.get(field), field, allow_zero=True, required=False)
    for field in ("is_featured", "is_active"):
        if not partial or field in data:
            if field not in data and not partial:
                cleaned[field] = False if field == "is_featured" else True
            elif not isinstance(data.get(field), bool):
                raise ValidationError(details={field: "Must be true or false"})
            else:
                cleaned[field] = data[field]
    if not partial or "status" in data:
        status = data.get("status", "draft" if not partial else None)
        if status not in {"draft", "active", "archived"}:
            raise ValidationError(details={"status": "Status must be draft, active, or archived"})
        cleaned["status"] = status
    if not partial or "opening_stock" in data:
        if "opening_stock" not in data and partial:
            pass
        else:
            cleaned["opening_stock"] = parse_positive_int(
                data.get("opening_stock", 0), "opening_stock", minimum=0, maximum=1000000
            )
    if not partial:
        cleaned.setdefault("brand_id", None)
        cleaned.setdefault("short_description", None)
        cleaned.setdefault("description", None)
        cleaned.setdefault("model_name", None)
        cleaned.setdefault("material", None)
        cleaned.setdefault("size_label", None)
        cleaned.setdefault("warranty", None)
        cleaned.setdefault("key_features", None)
        cleaned.setdefault("box_contents", None)
        cleaned.setdefault("specifications", None)
        cleaned.setdefault("usage_video_url", None)
        cleaned.setdefault("handling", "normal")
        cleaned.setdefault("compare_at_price", None)
        cleaned.setdefault("low_stock_threshold", 5)
        cleaned.setdefault("weight", None)
        cleaned.setdefault("length", None)
        cleaned.setdefault("width", None)
        cleaned.setdefault("height", None)
        cleaned.setdefault("meta_title", None)
        cleaned.setdefault("meta_description", None)
        cleaned.setdefault("opening_stock", 0)
        cleaned.setdefault("is_featured", False)
        cleaned.setdefault("is_active", False)
    return cleaned


def _assert_category(db, category_id):
    if not db.one("SELECT id FROM categories WHERE id = %s", (category_id,)):
        raise ValidationError(details={"category_id": "Category was not found"})


def _assert_brand(db, brand_id):
    if not db.one("SELECT id FROM brands WHERE id = %s", (brand_id,)):
        raise ValidationError(details={"brand_id": "Brand was not found"})


def _review_public(row, include_status=False):
    from app.common.serializers import iso

    data = {
        "id": row["id"],
        "rating": row["rating"],
        "title": row["title"],
        "comment": row["comment"],
        "reviewer_first_name": row.get("first_name"),
        "created_at": iso(row["created_at"]),
    }
    if include_status:
        data["status"] = row["status"]
    return data


def _detect_image(blob):
    if blob.startswith(b"\xff\xd8\xff"):
        return ".jpg"
    if blob.startswith(b"\x89PNG\r\n\x1a\n"):
        return ".png"
    if len(blob) >= 12 and blob[:4] == b"RIFF" and blob[8:12] == b"WEBP":
        return ".webp"
    return None


def _unlink(image_url):
    prefix = current_app.config["MEDIA_URL_PREFIX"].rstrip("/") + "/"
    if not image_url or not image_url.startswith(prefix):
        return
    relative = image_url[len(prefix):]
    root = media_root()
    target = (root / relative).resolve()
    if root not in target.parents or not target.is_file():
        return
    target.unlink()


_CATEGORY_CACHE = {"at": 0.0, "rows": None}
_CATEGORY_LOCK = threading.Lock()


def _cached_categories():
    now = time.monotonic()
    with _CATEGORY_LOCK:
        cached = _CATEGORY_CACHE["rows"]
        if cached is not None and _public_reads_cached() and now - _CATEGORY_CACHE["at"] < 30:
            return cached
    with db_session() as db:
        rows = db.all("SELECT id, parent_id, slug FROM categories")
    with _CATEGORY_LOCK:
        _CATEGORY_CACHE["rows"] = rows
        _CATEGORY_CACHE["at"] = time.monotonic()
    return rows


def category_ids_for_slug(slug):
    rows = _cached_categories()
    by_slug = {row["slug"]: row["id"] for row in rows}
    if slug not in by_slug:
        return []
    children = {}
    for row in rows:
        children.setdefault(row["parent_id"], []).append(row["id"])
    found = []
    stack = [by_slug[slug]]
    while stack:
        current = stack.pop()
        found.append(current)
        stack.extend(children.get(current, []))
    return found


def _duplicate(exc):
    import pymysql

    if isinstance(exc, pymysql.err.IntegrityError) and exc.args and exc.args[0] == 1062:
        raise Conflict("A product with this SKU or slug already exists") from exc
    raise exc
