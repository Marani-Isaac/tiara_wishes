from app.common.errors import Conflict

SLUG_TABLES = {"categories", "brands", "products", "site_content"}


def unique_slug(db, table, slug, ignore_id=None):
    if table not in SLUG_TABLES:
        raise RuntimeError("Unsupported slug table")
    base = (slug or "item")[:170]
    candidate = base
    number = 2
    while number < 1000:
        row = db.one(f"SELECT id FROM `{table}` WHERE slug = %s", (candidate,))
        if row is None or (ignore_id is not None and row["id"] == ignore_id):
            return candidate
        candidate = f"{base}-{number}"
        number += 1
    raise Conflict("Could not generate a unique slug")
