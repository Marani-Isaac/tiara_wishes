import json
from datetime import datetime, timezone

from app.common.money import money_str


def iso(value):
    if value is None:
        return None
    if isinstance(value, datetime):
        if value.tzinfo is None:
            return value.isoformat(sep="T", timespec="seconds") + "Z"
        return value.astimezone(timezone.utc).replace(tzinfo=None).isoformat(sep="T", timespec="seconds") + "Z"
    return str(value)


def flag(value):
    return bool(value)


def _specification_rows(value):
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


def user_public(row, roles=None, permissions=None):
    data = {
        "id": row["id"],
        "first_name": row["first_name"],
        "last_name": row["last_name"],
        "email": row["email"],
        "phone": row["phone"],
        "status": row["status"],
        "email_verified_at": iso(row.get("email_verified_at")),
        "phone_verified_at": iso(row.get("phone_verified_at")),
        "last_login_at": iso(row.get("last_login_at")),
        "created_at": iso(row.get("created_at")),
        "updated_at": iso(row.get("updated_at")),
        "roles": roles if roles is not None else row.get("roles", []),
    }
    if permissions is not None:
        data["permissions"] = permissions
    return data


def address_public(row):
    return {
        "id": row["id"],
        "recipient_name": row["recipient_name"],
        "recipient_phone": row["recipient_phone"],
        "county": row["county"],
        "town": row["town"],
        "area_or_estate": row["area_or_estate"],
        "building": row["building"],
        "house_or_unit": row["house_or_unit"],
        "delivery_instructions": row["delivery_instructions"],
        "is_default": flag(row["is_default"]),
        "created_at": iso(row.get("created_at")),
        "updated_at": iso(row.get("updated_at")),
    }


def category_public(row, include_inactive=False):
    data = {
        "id": row["id"],
        "parent_id": row["parent_id"],
        "name": row["name"],
        "slug": row["slug"],
        "description": row["description"],
        "specifications": _specification_rows(row.get("specifications_json")),
        "image_url": row["image_url"],
        "sort_order": row["sort_order"],
        "is_active": flag(row["is_active"]),
    }
    if include_inactive:
        data["created_at"] = iso(row.get("created_at"))
        data["updated_at"] = iso(row.get("updated_at"))
    return data


def brand_public(row, include_admin=False):
    data = {
        "id": row["id"],
        "name": row["name"],
        "slug": row["slug"],
        "description": row["description"],
        "logo_url": row["logo_url"],
        "is_active": flag(row["is_active"]),
    }
    if include_admin:
        data["created_at"] = iso(row.get("created_at"))
        data["updated_at"] = iso(row.get("updated_at"))
    return data


def image_public(row):
    return {
        "id": row["id"],
        "image_url": row["image_url"],
        "alt_text": row["alt_text"],
        "is_primary": flag(row["is_primary"]),
        "sort_order": row["sort_order"],
    }


def product_public(row, images=None, admin=False):
    available = int(row.get("available") if row.get("available") is not None else 0)
    data = {
        "id": row["id"],
        "category_id": row["category_id"],
        "category_slug": row.get("category_slug"),
        "category_name": row.get("category_name"),
        "brand_id": row["brand_id"],
        "brand_slug": row.get("brand_slug"),
        "brand_name": row.get("brand_name"),
        "name": row["name"],
        "slug": row["slug"],
        "sku": row["sku"],
        "short_description": row["short_description"],
        "description": row.get("description") if admin or row.get("description") is not None else row.get("short_description"),
        "usage_video_url": row.get("usage_video_url"),
        "handling": row.get("handling") or "normal",
        "cash_price": money_str(row["cash_price"]),
        "compare_at_price": money_str(row.get("compare_at_price")),
        "currency": row["currency"],
        "available_quantity": available,
        "is_featured": flag(row["is_featured"]),
        "images": images or [],
        "primary_image": next((image for image in (images or []) if image["is_primary"]), (images or [None])[0]),
    }
    if admin:
        data.update(
            {
                "low_stock_threshold": row["low_stock_threshold"],
                "weight": money_str(row["weight"]) if row.get("weight") is not None else None,
                "length": money_str(row["length"]) if row.get("length") is not None else None,
                "width": money_str(row["width"]) if row.get("width") is not None else None,
                "height": money_str(row["height"]) if row.get("height") is not None else None,
                "is_active": flag(row["is_active"]),
                "status": row["status"],
                "meta_title": row.get("meta_title"),
                "meta_description": row.get("meta_description"),
                "model_name": row.get("model_name"),
                "material": row.get("material"),
                "size_label": row.get("size_label"),
                "warranty": row.get("warranty"),
                "key_features": row.get("key_features"),
                "box_contents": row.get("box_contents"),
                "specifications": _specification_rows(row.get("specifications_json")),
                "on_hand": int(row.get("on_hand") or 0),
                "reserved": int(row.get("reserved") or 0),
                "created_at": iso(row.get("created_at")),
                "updated_at": iso(row.get("updated_at")),
            }
        )
    return data
