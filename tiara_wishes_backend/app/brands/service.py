import threading
import time

from flask import current_app

from app.audit.service import write_audit
from app.common.errors import Conflict, NotFound, ValidationError
from app.common.serializers import brand_public
from app.common.slugs import unique_slug
from app.common.transactions import run_transaction
from app.common.validation import clean_text, slugify, validate_slug
from app.db.connection import db_session


_PUBLIC_CACHE = {"at": 0.0, "value": None}
_PUBLIC_LOCK = threading.Lock()


def list_public():
    testing = bool(current_app.config.get("TESTING"))
    now = time.monotonic()
    with _PUBLIC_LOCK:
        if not testing and _PUBLIC_CACHE["value"] is not None and now - _PUBLIC_CACHE["at"] < 15:
            return _PUBLIC_CACHE["value"]
    with db_session() as db:
        rows = db.all("SELECT * FROM brands WHERE is_active = 1 ORDER BY name, id")
    value = [brand_public(row) for row in rows]
    if not testing:
        with _PUBLIC_LOCK:
            _PUBLIC_CACHE["value"] = value
            _PUBLIC_CACHE["at"] = time.monotonic()
    return value


def list_admin():
    with db_session() as db:
        rows = db.all("SELECT * FROM brands ORDER BY name, id")
    return [brand_public(row, include_admin=True) for row in rows]


def create_brand(actor, data):
    cleaned = _clean(data, partial=False)

    def work(db):
        slug = unique_slug(db, "brands", cleaned["slug"])
        brand_id, _ = db.execute(
            """
            INSERT INTO brands (name, slug, description, logo_url, is_active)
            VALUES (%s, %s, %s, %s, %s)
            """,
            (cleaned["name"], slug, cleaned["description"], cleaned["logo_url"], 1 if cleaned["is_active"] else 0),
        )
        row = db.one("SELECT * FROM brands WHERE id = %s", (brand_id,))
        write_audit(db, actor["id"], "brand.created", "brand", brand_id, after={"slug": slug})
        return brand_public(row, include_admin=True)

    return run_transaction(work)


def update_brand(actor, brand_id, data):
    cleaned = _clean(data, partial=True)

    def work(db):
        existing = db.one("SELECT * FROM brands WHERE id = %s FOR UPDATE", (brand_id,))
        if not existing:
            raise NotFound("Brand not found")
        merged = dict(existing)
        merged.update(cleaned)
        slug = existing["slug"]
        if "slug" in cleaned or "name" in cleaned:
            slug = unique_slug(db, "brands", cleaned.get("slug") or slugify(merged["name"]), ignore_id=brand_id)
        db.execute(
            """
            UPDATE brands SET name = %s, slug = %s, description = %s, logo_url = %s, is_active = %s
            WHERE id = %s
            """,
            (
                merged["name"],
                slug,
                merged["description"],
                merged["logo_url"],
                1 if merged["is_active"] else 0,
                brand_id,
            ),
        )
        row = db.one("SELECT * FROM brands WHERE id = %s", (brand_id,))
        write_audit(db, actor["id"], "brand.updated", "brand", brand_id, after={"slug": slug})
        return brand_public(row, include_admin=True)

    return run_transaction(work)


def delete_brand(actor, brand_id):
    def work(db):
        existing = db.one("SELECT * FROM brands WHERE id = %s", (brand_id,))
        if not existing:
            raise NotFound("Brand not found")
        used = db.one("SELECT id FROM products WHERE brand_id = %s LIMIT 1", (brand_id,))
        if used:
            raise Conflict("Deactivate this brand instead. Products are still linked to it.")
        db.execute("DELETE FROM brands WHERE id = %s", (brand_id,))
        write_audit(db, actor["id"], "brand.deleted", "brand", brand_id, before={"slug": existing["slug"]})
        return {"id": brand_id}

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
    if not partial or "logo_url" in data:
        logo = data.get("logo_url")
        if logo in (None, ""):
            cleaned["logo_url"] = None
        else:
            text = clean_text(logo, "logo_url", 255)
            if text.startswith("http://") or text.startswith("https://") or ".." in text:
                raise ValidationError(details={"logo_url": "Upload the logo instead of linking to an external URL"})
            cleaned["logo_url"] = text
    if not partial or "is_active" in data:
        if "is_active" not in data and not partial:
            cleaned["is_active"] = True
        elif not isinstance(data.get("is_active"), bool):
            raise ValidationError(details={"is_active": "Must be true or false"})
        else:
            cleaned["is_active"] = data["is_active"]
    if not partial:
        cleaned.setdefault("description", None)
        cleaned.setdefault("logo_url", None)
    return cleaned
