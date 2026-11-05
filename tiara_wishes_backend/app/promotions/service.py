from flask import current_app

from app.audit.service import write_audit
from app.common.errors import Conflict, NotFound, ValidationError
from app.common.money import money_str, percentage_discount, to_money
from app.common.serializers import iso
from app.common.transactions import run_transaction
from app.common.uploads import media_path
from app.common.validation import clean_text, validate_slug
from app.db.connection import db_session


def evaluate_promotion(db, code, subtotal, user_id=None, lock=False):
    if code is None or str(code).strip() == "":
        return None, to_money(0)
    normalized = str(code).strip().upper()
    if len(normalized) > 64:
        raise ValidationError(details={"promotion_code": "Promotion code is not valid"})
    sql = "SELECT * FROM promotions WHERE code = %s"
    if lock:
        sql += " FOR UPDATE"
    promo = db.one(sql, (normalized,))
    if not promo or not promo["is_active"]:
        raise ValidationError(details={"promotion_code": "Promotion code is not valid"})
    now = db.one("SELECT UTC_TIMESTAMP() AS now_utc")["now_utc"]
    if (promo["starts_at"] and promo["starts_at"] > now) or (promo["ends_at"] and promo["ends_at"] < now):
        raise ValidationError(details={"promotion_code": "Promotion code is not valid"})
    minimum = promo["minimum_order_amount"]
    if minimum is not None and subtotal < minimum:
        raise ValidationError(
            details={
                "promotion_code": (
                    f"This code requires a minimum order of {money_str(minimum)} "
                    f"{current_app.config['CURRENCY']}"
                )
            }
        )
    if promo["usage_limit"] is not None and promo["usage_count"] >= promo["usage_limit"]:
        raise ValidationError(details={"promotion_code": "Promotion code is not valid"})
    if user_id is not None:
        used = db.one(
            "SELECT id FROM orders WHERE promotion_id = %s AND user_id = %s",
            (promo["id"], user_id),
        )
        if used:
            raise ValidationError(details={"promotion_code": "You have already used this promotion code"})
    if promo["type"] == "percentage":
        discount = percentage_discount(subtotal, promo["value"])
    else:
        discount = to_money(promo["value"])
    if discount > subtotal:
        discount = subtotal
    return promo, discount


def consume_promotion(db, promo, order_id, user_id):
    _, count = db.execute(
        """
        UPDATE promotions
        SET usage_count = usage_count + 1
        WHERE id = %s AND is_active = 1
          AND (usage_limit IS NULL OR usage_count < usage_limit)
        """,
        (promo["id"],),
    )
    if count != 1:
        raise ValidationError(details={"promotion_code": "Promotion code is not valid"})


def list_hovering():
    with db_session() as db:
        rows = db.all(
            """
            SELECT * FROM promotions
            WHERE is_active = 1 AND hover_in_empty_space = 1
              AND (starts_at IS NULL OR starts_at <= UTC_TIMESTAMP())
              AND (ends_at IS NULL OR ends_at >= UTC_TIMESTAMP())
            ORDER BY id DESC
            """
        )
    return [_present(row) for row in rows]


def list_promotions():
    with db_session() as db:
        rows = db.all("SELECT * FROM promotions ORDER BY id DESC")
    return [_present(row) for row in rows]


def get_promotion(promotion_id):
    with db_session() as db:
        row = db.one("SELECT * FROM promotions WHERE id = %s", (promotion_id,))
    if not row:
        raise NotFound("Promotion not found")
    return _present(row)


def create_promotion(actor, data):
    cleaned = _clean(data, partial=False)

    def work(db):
        promo_id, _ = db.execute(
            """
            INSERT INTO promotions (
              name, code, type, value, starts_at, ends_at,
              minimum_order_amount, usage_limit, is_active, hover_in_empty_space, image_url
            ) VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s)
            """,
            (
                cleaned["name"],
                cleaned["code"],
                cleaned["type"],
                cleaned["value"],
                cleaned["starts_at"],
                cleaned["ends_at"],
                cleaned["minimum_order_amount"],
                cleaned["usage_limit"],
                1 if cleaned["is_active"] else 0,
                1 if cleaned["hover_in_empty_space"] else 0,
                cleaned["image_url"],
            ),
        )
        row = db.one("SELECT * FROM promotions WHERE id = %s", (promo_id,))
        write_audit(db, actor["id"], "promotion.created", "promotion", promo_id, after=_present(row))
        return _present(row)

    try:
        return run_transaction(work)
    except Exception as exc:
        _reraise_duplicate(exc)


def update_promotion(actor, promotion_id, data):
    cleaned = _clean(data, partial=True)

    def work(db):
        existing = db.one("SELECT * FROM promotions WHERE id = %s FOR UPDATE", (promotion_id,))
        if not existing:
            raise NotFound("Promotion not found")
        merged = _present_raw(existing)
        merged.update(cleaned)
        db.execute(
            """
            UPDATE promotions
            SET name = %s, code = %s, type = %s, value = %s, starts_at = %s, ends_at = %s,
                minimum_order_amount = %s, usage_limit = %s, is_active = %s, hover_in_empty_space = %s,
                image_url = %s
            WHERE id = %s
            """,
            (
                merged["name"],
                merged["code"],
                merged["type"],
                merged["value"],
                merged["starts_at"],
                merged["ends_at"],
                merged["minimum_order_amount"],
                merged["usage_limit"],
                1 if merged["is_active"] else 0,
                1 if merged.get("hover_in_empty_space", True) else 0,
                merged.get("image_url"),
                promotion_id,
            ),
        )
        row = db.one("SELECT * FROM promotions WHERE id = %s", (promotion_id,))
        write_audit(
            db,
            actor["id"],
            "promotion.updated",
            "promotion",
            promotion_id,
            before=_present(existing),
            after=_present(row),
        )
        return _present(row)

    try:
        return run_transaction(work)
    except Exception as exc:
        _reraise_duplicate(exc)


def deactivate_promotion(actor, promotion_id):
    def work(db):
        existing = db.one("SELECT * FROM promotions WHERE id = %s FOR UPDATE", (promotion_id,))
        if not existing:
            raise NotFound("Promotion not found")
        db.execute("UPDATE promotions SET is_active = 0 WHERE id = %s", (promotion_id,))
        row = db.one("SELECT * FROM promotions WHERE id = %s", (promotion_id,))
        write_audit(
            db,
            actor["id"],
            "promotion.deactivated",
            "promotion",
            promotion_id,
            before={"is_active": bool(existing["is_active"])},
            after={"is_active": False},
        )
        return _present(row)

    return run_transaction(work)


def _clean(data, partial):
    from datetime import datetime

    if not isinstance(data, dict):
        raise ValidationError("Request body must be a JSON object")
    cleaned = {}
    if not partial or "name" in data:
        cleaned["name"] = clean_text(data.get("name"), "name", 160, required=True)
    if not partial or "code" in data:
        if data.get("code") in (None, ""):
            cleaned["code"] = None
        else:
            code = clean_text(data.get("code"), "code", 64).upper()
            if not code.replace("-", "").isalnum():
                raise ValidationError(details={"code": "Use letters, numbers, and hyphens"})
            cleaned["code"] = code
    if not partial or "type" in data:
        promo_type = data.get("type")
        if promo_type not in {"percentage", "fixed_amount"}:
            raise ValidationError(details={"type": "Type must be percentage or fixed_amount"})
        cleaned["type"] = promo_type
    if not partial or "value" in data:
        from app.common.validation import parse_money

        cleaned["value"] = parse_money(data.get("value"), "value", allow_zero=False)
    promo_type = cleaned.get("type")
    if promo_type == "percentage" and "value" in cleaned and cleaned["value"] > 100:
        raise ValidationError(details={"value": "Percentage cannot exceed 100"})
    for field in ("starts_at", "ends_at"):
        if not partial or field in data:
            cleaned[field] = _parse_dt(data.get(field), field)
    if not partial or "minimum_order_amount" in data:
        from app.common.validation import parse_money

        cleaned["minimum_order_amount"] = parse_money(
            data.get("minimum_order_amount"),
            "minimum_order_amount",
            allow_zero=True,
            required=False,
        )
    if not partial or "usage_limit" in data:
        limit = data.get("usage_limit")
        if limit in (None, ""):
            cleaned["usage_limit"] = None
        else:
            from app.common.validation import parse_positive_int

            cleaned["usage_limit"] = parse_positive_int(limit, "usage_limit", minimum=1, maximum=1000000)
    if not partial or "is_active" in data:
        if "is_active" not in data and not partial:
            cleaned["is_active"] = True
        elif not isinstance(data.get("is_active"), bool):
            raise ValidationError(details={"is_active": "Must be true or false"})
        else:
            cleaned["is_active"] = data["is_active"]
    if not partial or "hover_in_empty_space" in data:
        if "hover_in_empty_space" not in data and not partial:
            cleaned["hover_in_empty_space"] = True
        elif not isinstance(data.get("hover_in_empty_space"), bool):
            raise ValidationError(details={"hover_in_empty_space": "Must be true or false"})
        else:
            cleaned["hover_in_empty_space"] = data["hover_in_empty_space"]
    if not partial or "image_url" in data:
        cleaned["image_url"] = media_path(data.get("image_url"))
    if not partial:
        cleaned.setdefault("starts_at", None)
        cleaned.setdefault("ends_at", None)
        cleaned.setdefault("minimum_order_amount", None)
        cleaned.setdefault("usage_limit", None)
        cleaned.setdefault("code", cleaned.get("code"))
        cleaned.setdefault("hover_in_empty_space", True)
        cleaned.setdefault("image_url", None)
    return cleaned


def _parse_dt(value, field):
    from datetime import datetime

    if value in (None, ""):
        return None
    if not isinstance(value, str):
        raise ValidationError(details={field: "Use an ISO date time"})
    text = value.replace("Z", "")
    try:
        return datetime.fromisoformat(text)
    except ValueError as exc:
        raise ValidationError(details={field: "Use an ISO date time"}) from exc


def _present_raw(row):
    return {
        "name": row["name"],
        "code": row["code"],
        "type": row["type"],
        "value": row["value"],
        "starts_at": row["starts_at"],
        "ends_at": row["ends_at"],
        "minimum_order_amount": row["minimum_order_amount"],
        "usage_limit": row["usage_limit"],
        "is_active": bool(row["is_active"]),
        "hover_in_empty_space": bool(row.get("hover_in_empty_space", 1)),
        "image_url": row.get("image_url"),
    }


def _present(row):
    return {
        "id": row["id"],
        "name": row["name"],
        "code": row["code"],
        "type": row["type"],
        "value": money_str(row["value"]),
        "starts_at": iso(row["starts_at"]),
        "ends_at": iso(row["ends_at"]),
        "minimum_order_amount": money_str(row["minimum_order_amount"]),
        "usage_limit": row["usage_limit"],
        "usage_count": row["usage_count"],
        "is_active": bool(row["is_active"]),
        "hover_in_empty_space": bool(row.get("hover_in_empty_space", 1)),
        "image_url": row.get("image_url"),
        "created_at": iso(row["created_at"]),
        "updated_at": iso(row["updated_at"]),
    }


def _reraise_duplicate(exc):
    import pymysql

    if isinstance(exc, pymysql.err.IntegrityError) and exc.args and exc.args[0] == 1062:
        raise Conflict("A promotion with this code already exists") from exc
    raise exc


def _unused():
    validate_slug("unused")
