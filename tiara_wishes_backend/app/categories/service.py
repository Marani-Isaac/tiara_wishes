import threading
import time

from flask import current_app

from app.audit.service import write_audit
from app.common.errors import Conflict, NotFound, ValidationError
from app.common.serializers import category_public
from app.common.slugs import unique_slug
from app.common.transactions import run_transaction
from app.catalog.service import _clean_specifications, _dump_specifications
from app.common.validation import clean_text, parse_positive_int, slugify, validate_slug
from app.db.connection import db_session

MAX_DEPTH = 4


_PUBLIC_CACHE = {"at": 0.0, "value": None}
_PUBLIC_LOCK = threading.Lock()


def list_public():
    testing = bool(current_app.config.get("TESTING"))
    now = time.monotonic()
    with _PUBLIC_LOCK:
        if not testing and _PUBLIC_CACHE["value"] is not None and now - _PUBLIC_CACHE["at"] < 15:
            return _PUBLIC_CACHE["value"]
    with db_session() as db:
        rows = db.all(
            "SELECT * FROM categories WHERE is_active = 1 ORDER BY sort_order, name, id"
        )
    value = _tree(rows)
    if not testing:
        with _PUBLIC_LOCK:
            _PUBLIC_CACHE["value"] = value
            _PUBLIC_CACHE["at"] = time.monotonic()
    return value


def get_public(slug):
    with db_session() as db:
        row = db.one("SELECT * FROM categories WHERE slug = %s AND is_active = 1", (slug,))
        if not row:
            raise NotFound("Category not found")
        children = db.all(
            """
            SELECT * FROM categories
            WHERE parent_id = %s AND is_active = 1
            ORDER BY sort_order, name, id
            """,
            (row["id"],),
        )
    data = category_public(row)
    data["children"] = [category_public(child) for child in children]
    return data


def list_admin():
    with db_session() as db:
        rows = db.all("SELECT * FROM categories ORDER BY sort_order, name, id")
    return [category_public(row, include_inactive=True) for row in rows]


def create_category(actor, data):
    cleaned = _clean(data, partial=False)

    def work(db):
        _assert_parent(db, None, cleaned["parent_id"])
        slug = unique_slug(db, "categories", cleaned["slug"])
        category_id, _ = db.execute(
            """
            INSERT INTO categories (
              parent_id, name, slug, description, specifications_json, image_url, sort_order, is_active
            ) VALUES (%s, %s, %s, %s, %s, %s, %s, %s)
            """,
            (
                cleaned["parent_id"],
                cleaned["name"],
                slug,
                cleaned["description"],
                _dump_specifications(cleaned.get("specifications")),
                cleaned["image_url"],
                cleaned["sort_order"],
                1 if cleaned["is_active"] else 0,
            ),
        )
        row = db.one("SELECT * FROM categories WHERE id = %s", (category_id,))
        write_audit(db, actor["id"], "category.created", "category", category_id, after={"slug": slug})
        return category_public(row, include_inactive=True)

    return run_transaction(work)


def update_category(actor, category_id, data):
    cleaned = _clean(data, partial=True)

    def work(db):
        existing = db.one("SELECT * FROM categories WHERE id = %s FOR UPDATE", (category_id,))
        if not existing:
            raise NotFound("Category not found")
        merged = dict(existing)
        merged.update({key: value for key, value in cleaned.items() if key not in {"slug", "specifications"}})
        if "specifications" in cleaned:
            merged["specifications_json"] = _dump_specifications(cleaned.get("specifications"))
        elif merged.get("specifications_json") not in (None, ""):
            merged["specifications_json"] = _dump_specifications(merged.get("specifications_json"))
        if "parent_id" in cleaned:
            _assert_parent(db, category_id, cleaned["parent_id"])
        slug = existing["slug"]
        if "slug" in cleaned or "name" in cleaned:
            slug = unique_slug(
                db,
                "categories",
                cleaned.get("slug") or slugify(merged["name"]),
                ignore_id=category_id,
            )
        db.execute(
            """
            UPDATE categories
            SET parent_id = %s, name = %s, slug = %s, description = %s, specifications_json = %s,
                image_url = %s, sort_order = %s, is_active = %s
            WHERE id = %s
            """,
            (
                merged["parent_id"],
                merged["name"],
                slug,
                merged["description"],
                merged.get("specifications_json"),
                merged["image_url"],
                merged["sort_order"],
                1 if merged["is_active"] else 0,
                category_id,
            ),
        )
        row = db.one("SELECT * FROM categories WHERE id = %s", (category_id,))
        write_audit(db, actor["id"], "category.updated", "category", category_id, after={"slug": slug})
        return category_public(row, include_inactive=True)

    return run_transaction(work)


def delete_category(actor, category_id):
    def work(db):
        existing = db.one("SELECT * FROM categories WHERE id = %s", (category_id,))
        if not existing:
            raise NotFound("Category not found")
        child = db.one("SELECT id FROM categories WHERE parent_id = %s LIMIT 1", (category_id,))
        product = db.one("SELECT id FROM products WHERE category_id = %s LIMIT 1", (category_id,))
        if child or product:
            raise Conflict("Deactivate this category instead. It still has products or subcategories.")
        db.execute("DELETE FROM categories WHERE id = %s", (category_id,))
        write_audit(db, actor["id"], "category.deleted", "category", category_id, before={"slug": existing["slug"]})
        return {"id": category_id}

    return run_transaction(work)


def _clean(data, partial):
    if not isinstance(data, dict):
        raise ValidationError("Request body must be a JSON object")
    cleaned = {}
    if not partial or "name" in data:
        cleaned["name"] = clean_text(data.get("name"), "name", 160)
    if "slug" in data and data.get("slug"):
        cleaned["slug"] = validate_slug(data.get("slug"))
    elif not partial:
        cleaned["slug"] = slugify(cleaned["name"])
    if not partial or "description" in data:
        cleaned["description"] = clean_text(data.get("description"), "description", 4000, required=False)
    if not partial or "specifications" in data:
        cleaned["specifications"] = _clean_specifications(data.get("specifications"))
    if not partial or "image_url" in data:
        cleaned["image_url"] = _media_path(data.get("image_url"))
    if not partial or "parent_id" in data:
        if data.get("parent_id") in (None, ""):
            cleaned["parent_id"] = None
        else:
            cleaned["parent_id"] = parse_positive_int(data.get("parent_id"), "parent_id")
    if not partial or "sort_order" in data:
        cleaned["sort_order"] = parse_positive_int(data.get("sort_order", 0), "sort_order", minimum=0, maximum=100000)
    if not partial or "is_active" in data:
        if "is_active" not in data and not partial:
            cleaned["is_active"] = True
        elif not isinstance(data.get("is_active"), bool):
            raise ValidationError(details={"is_active": "Must be true or false"})
        else:
            cleaned["is_active"] = data["is_active"]
    if not partial:
        cleaned.setdefault("description", None)
        cleaned.setdefault("specifications", None)
        cleaned.setdefault("image_url", None)
        cleaned.setdefault("parent_id", None)
    return cleaned


def _assert_parent(db, category_id, parent_id):
    if parent_id is None:
        return
    if category_id and parent_id == category_id:
        raise ValidationError(details={"parent_id": "A category cannot be its own parent"})
    depth = 1
    current = parent_id
    seen = set()
    while current:
        if current in seen or (category_id and current == category_id):
            raise ValidationError(details={"parent_id": "That parent would create a cycle"})
        seen.add(current)
        row = db.one("SELECT parent_id FROM categories WHERE id = %s", (current,))
        if not row:
            raise ValidationError(details={"parent_id": "Parent category was not found"})
        current = row["parent_id"]
        depth += 1
        if depth > MAX_DEPTH:
            raise ValidationError(details={"parent_id": "Categories can be nested at most 4 levels"})


def _media_path(value):
    if value in (None, ""):
        return None
    text = clean_text(value, "image_url", 255)
    if text.startswith("http://") or text.startswith("https://") or ".." in text:
        raise ValidationError(details={"image_url": "Upload the image instead of linking to an external URL"})
    return text


def _tree(rows):
    nodes = {row["id"]: {**category_public(row), "children": []} for row in rows}
    roots = []
    for row in rows:
        node = nodes[row["id"]]
        parent_id = row["parent_id"]
        if parent_id and parent_id in nodes:
            nodes[parent_id]["children"].append(node)
        else:
            roots.append(node)
    return roots
