import threading
import time
from concurrent.futures import ThreadPoolExecutor

from flask import current_app

from app.audit.service import write_audit
from app.catalog.service import list_products
from app.common.errors import NotFound, ValidationError
from app.common.money import to_money
from app.common.serializers import iso
from app.common.slugs import unique_slug
from app.common.transactions import run_transaction
from app.common.uploads import media_path
from app.common.validation import clean_text, parse_positive_int, slugify, validate_http_url, validate_slug
from app.db.connection import db_session

PUBLIC_SETTING_KEYS = (
    "contact_email",
    "contact_phone",
    "contact_whatsapp",
    "social_facebook",
    "social_instagram",
    "social_tiktok",
    "social_youtube",
    "currency",
)
SOCIAL_SETTING_KEYS = {
    "social_facebook",
    "social_instagram",
    "social_tiktok",
    "social_youtube",
}
EDITABLE_SETTINGS = set(PUBLIC_SETTING_KEYS) | {"delivery_fee_kes", "free_delivery_threshold_kes"}


_HOME_CACHE = {"at": 0.0, "payload": None}
_HOME_LOCK = threading.Lock()


def home():
    testing = current_app.config.get("TESTING")
    now = time.monotonic()
    with _HOME_LOCK:
        if not testing and _HOME_CACHE["payload"] is not None and now - _HOME_CACHE["at"] < 15:
            return _HOME_CACHE["payload"]
    app = current_app._get_current_object()

    def load_content():
        with app.app_context():
            with db_session() as db:
                rows = db.all("SELECT * FROM site_content ORDER BY sort_order, id")
        blocks = [row for row in rows if row["entry_type"] == "content" and row["is_active"]]
        settings = {
            row["slug"]: row["body"]
            for row in rows
            if row["entry_type"] == "setting" and row["slug"] in PUBLIC_SETTING_KEYS
        }
        return blocks, settings

    def load_featured():
        with app.app_context():
            featured, _total = list_products(
                {"page": 1, "per_page": 8, "offset": 0, "featured": True, "sort": "newest"},
                admin=False,
            )
        return featured

    def load_promotions():
        with app.app_context():
            return _hovering_promotions()

    with ThreadPoolExecutor(max_workers=3) as pool:
        content_task = pool.submit(load_content)
        featured_task = pool.submit(load_featured)
        promotion_task = pool.submit(load_promotions)
        blocks, settings = content_task.result()
        featured = featured_task.result()
        hovering = promotion_task.result()
    payload = {
        "blocks": [_block(row) for row in blocks],
        "settings": settings,
        "featured_products": featured,
        "hovering_promotions": hovering,
        "chama": {
            "implemented": False,
            "message": "Digital Chamas are not available. Cash purchase is the only checkout in this release.",
        },
    }
    if not testing:
        with _HOME_LOCK:
            _HOME_CACHE["payload"] = payload
            _HOME_CACHE["at"] = time.monotonic()
    return payload


def _hovering_promotions():
    from app.promotions.service import list_hovering

    return list_hovering()


def list_content():
    with db_session() as db:
        rows = db.all(
            "SELECT * FROM site_content WHERE entry_type = 'content' ORDER BY sort_order, id"
        )
    return [_block(row, admin=True) for row in rows]


def create_content(actor, data):
    cleaned = _clean(data, partial=False)

    def work(db):
        slug = unique_slug(db, "site_content", cleaned["slug"])
        content_id, _ = db.execute(
            """
            INSERT INTO site_content (slug, title, body, image_url, link_url, kind, sort_order, is_active)
            VALUES (%s, %s, %s, %s, %s, %s, %s, %s)
            """,
            (
                slug,
                cleaned["title"],
                cleaned["body"],
                cleaned["image_url"],
                cleaned["link_url"],
                cleaned["kind"],
                cleaned["sort_order"],
                1 if cleaned["is_active"] else 0,
            ),
        )
        row = db.one("SELECT * FROM site_content WHERE id = %s", (content_id,))
        write_audit(db, actor["id"], "content.created", "site_content", content_id, after={"slug": slug})
        return _block(row, admin=True)

    return run_transaction(work)


def update_content(actor, content_id, data):
    cleaned = _clean(data, partial=True)

    def work(db):
        existing = db.one("SELECT * FROM site_content WHERE id = %s FOR UPDATE", (content_id,))
        if not existing or existing["entry_type"] != "content":
            raise NotFound("Content not found")
        merged = dict(existing)
        merged.update(cleaned)
        slug = existing["slug"]
        if "slug" in cleaned or "title" in cleaned:
            slug = unique_slug(
                db,
                "site_content",
                cleaned.get("slug") or slugify(merged["title"]),
                ignore_id=content_id,
            )
        db.execute(
            """
            UPDATE site_content
            SET slug = %s, title = %s, body = %s, image_url = %s, link_url = %s, kind = %s,
                sort_order = %s, is_active = %s
            WHERE id = %s
            """,
            (
                slug,
                merged["title"],
                merged["body"],
                merged["image_url"],
                merged.get("link_url"),
                merged.get("kind") or "announcement",
                merged["sort_order"],
                1 if merged["is_active"] else 0,
                content_id,
            ),
        )
        row = db.one("SELECT * FROM site_content WHERE id = %s", (content_id,))
        write_audit(db, actor["id"], "content.updated", "site_content", content_id, after={"slug": slug})
        return _block(row, admin=True)

    return run_transaction(work)


def delete_content(actor, content_id):
    def work(db):
        existing = db.one("SELECT * FROM site_content WHERE id = %s", (content_id,))
        if not existing or existing["entry_type"] != "content":
            raise NotFound("Content not found")
        db.execute("DELETE FROM site_content WHERE id = %s AND entry_type = 'content'", (content_id,))
        write_audit(db, actor["id"], "content.deleted", "site_content", content_id, before={"slug": existing["slug"]})
        return {"id": content_id}

    return run_transaction(work)


def list_settings():
    with db_session() as db:
        rows = db.all(
            """
            SELECT slug AS setting_key, body AS setting_value
            FROM site_content WHERE entry_type = 'setting' ORDER BY slug
            """
        )
    return {row["setting_key"]: row["setting_value"] for row in rows if row["setting_key"] in EDITABLE_SETTINGS}


def update_settings(actor, data):
    if not isinstance(data, dict) or not data:
        raise ValidationError("No settings were submitted")
    unknown = set(data) - EDITABLE_SETTINGS
    if unknown:
        raise ValidationError(details={"settings": "One or more settings cannot be edited"})
    cleaned = {}
    for key, value in data.items():
        if key in {"delivery_fee_kes", "free_delivery_threshold_kes"}:
            if value in (None, ""):
                cleaned[key] = ""
            else:
                cleaned[key] = format(to_money(value), "f")
        elif key in SOCIAL_SETTING_KEYS:
            cleaned[key] = "" if value in (None, "") else validate_http_url(str(value), key) or ""
        elif key == "currency":
            text = clean_text(value, key, 3)
            if len(text) != 3 or not text.isalpha():
                raise ValidationError(details={key: "Use a 3-letter currency code"})
            cleaned[key] = text.upper()
        else:
            cleaned[key] = "" if value in (None, "") else clean_text(str(value), key, 255, required=False) or ""

    def work(db):
        before = {}
        for key, value in cleaned.items():
            current = db.one(
                "SELECT body AS setting_value FROM site_content WHERE entry_type = 'setting' AND slug = %s",
                (key,),
            )
            before[key] = None if not current else current["setting_value"]
            db.execute(
                """
                INSERT INTO site_content (slug, entry_type, title, body, sort_order, is_active)
                VALUES (%s, 'setting', %s, %s, 0, 1)
                ON DUPLICATE KEY UPDATE body = VALUES(body), entry_type = 'setting'
                """,
                (key, key, value),
            )
        write_audit(db, actor["id"], "settings.updated", "site_content", "settings", before=before, after=cleaned)
        return cleaned

    return run_transaction(work)


def _clean(data, partial):
    if not isinstance(data, dict):
        raise ValidationError("Request body must be a JSON object")
    cleaned = {}
    if not partial or "title" in data:
        cleaned["title"] = clean_text(data.get("title"), "title", 200)
    if "slug" in data and data.get("slug"):
        cleaned["slug"] = validate_slug(data.get("slug"))
    elif not partial:
        cleaned["slug"] = slugify(cleaned["title"])
    if not partial or "body" in data:
        cleaned["body"] = clean_text(data.get("body"), "body", 8000)
    if not partial or "image_url" in data:
        cleaned["image_url"] = media_path(data.get("image_url"))
    if not partial or "link_url" in data:
        kind_for_link = cleaned.get("kind") or data.get("kind") or "announcement"
        cleaned["link_url"] = validate_http_url(
            data.get("link_url"),
            "link_url",
            required=kind_for_link == "video",
        )
    if not partial or "kind" in data:
        kind = data.get("kind", "announcement" if not partial else None)
        if kind not in {"announcement", "ad", "video"}:
            raise ValidationError(details={"kind": "Kind must be announcement, ad, or video"})
        cleaned["kind"] = kind
        if kind == "video" and "link_url" not in cleaned:
            cleaned["link_url"] = validate_http_url(data.get("link_url"), "link_url", required=True)
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
        cleaned.setdefault("image_url", None)
        cleaned.setdefault("link_url", None)
        cleaned.setdefault("kind", "announcement")
    return cleaned


def _block(row, admin=False):
    data = {
        "id": row["id"],
        "slug": row["slug"],
        "title": row["title"],
        "body": row["body"],
        "image_url": row["image_url"],
        "link_url": row.get("link_url"),
        "kind": row.get("kind") or "announcement",
        "sort_order": row["sort_order"],
        "is_active": bool(row["is_active"]),
    }
    if admin:
        data["created_at"] = iso(row["created_at"])
        data["updated_at"] = iso(row["updated_at"])
    return data
