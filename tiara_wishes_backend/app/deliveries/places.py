from app.audit.service import write_audit
from app.common.counties import canonical_county
from app.common.errors import Conflict, NotFound, ValidationError
from app.common.money import money_str, to_money
from app.common.transactions import run_transaction
from app.common.validation import clean_text, parse_money, parse_positive_int
from app.db.connection import db_session


def fee_for_county(db, county, handlings):
    """Return (fee, county name) for an active place, or (None, None)."""
    name = canonical_county(county)
    if not name:
        return None, None
    row = db.one(
        "SELECT * FROM delivery_places WHERE is_active = 1 AND name = %s",
        (name,),
    )
    if not row:
        return None, None
    columns = {
        "normal": "normal_fee",
        "delicate": "delicate_fee",
        "perishable": "perishable_fee",
    }
    chosen = [to_money(row[columns.get(kind, "normal_fee")]) for kind in (handlings or {"normal"})]
    if not chosen:
        chosen = [to_money(row["normal_fee"])]
    return max(chosen), name


def list_places(active_only=False):
    where = "is_active = 1" if active_only else "1=1"
    with db_session() as db:
        rows = db.all(f"SELECT * FROM delivery_places WHERE {where} ORDER BY sort_order, name, id")
    return [_present(row) for row in rows]


def create_place(actor, data):
    cleaned = _clean(data, partial=False)

    def work(db):
        place_id, _ = db.execute(
            """
            INSERT INTO delivery_places (
              name, normal_fee, delicate_fee, perishable_fee, is_active, sort_order
            ) VALUES (%s, %s, %s, %s, %s, %s)
            """,
            (
                cleaned["name"],
                cleaned["normal_fee"],
                cleaned["delicate_fee"],
                cleaned["perishable_fee"],
                1 if cleaned["is_active"] else 0,
                cleaned["sort_order"],
            ),
        )
        row = db.one("SELECT * FROM delivery_places WHERE id = %s", (place_id,))
        write_audit(db, actor["id"], "delivery_place.created", "delivery_place", place_id, after={"name": cleaned["name"]})
        return _present(row)

    try:
        return run_transaction(work)
    except Exception as exc:
        _duplicate(exc)


def update_place(actor, place_id, data):
    cleaned = _clean(data, partial=True)

    def work(db):
        existing = db.one("SELECT * FROM delivery_places WHERE id = %s FOR UPDATE", (place_id,))
        if not existing:
            raise NotFound("Delivery place not found")
        merged = dict(existing)
        merged.update(cleaned)
        db.execute(
            """
            UPDATE delivery_places
            SET name = %s, normal_fee = %s, delicate_fee = %s, perishable_fee = %s,
                is_active = %s, sort_order = %s
            WHERE id = %s
            """,
            (
                merged["name"],
                merged["normal_fee"],
                merged["delicate_fee"],
                merged["perishable_fee"],
                1 if merged["is_active"] else 0,
                merged["sort_order"],
                place_id,
            ),
        )
        row = db.one("SELECT * FROM delivery_places WHERE id = %s", (place_id,))
        write_audit(db, actor["id"], "delivery_place.updated", "delivery_place", place_id, after={"name": row["name"]})
        return _present(row)

    try:
        return run_transaction(work)
    except Exception as exc:
        _duplicate(exc)


def delete_place(actor, place_id):
    def work(db):
        existing = db.one("SELECT * FROM delivery_places WHERE id = %s", (place_id,))
        if not existing:
            raise NotFound("Delivery place not found")
        db.execute("DELETE FROM delivery_places WHERE id = %s", (place_id,))
        write_audit(db, actor["id"], "delivery_place.deleted", "delivery_place", place_id, before={"name": existing["name"]})
        return {"id": place_id}

    return run_transaction(work)


def _present(row):
    return {
        "id": row["id"],
        "name": row["name"],
        "normal_fee": money_str(row["normal_fee"]),
        "delicate_fee": money_str(row["delicate_fee"]),
        "perishable_fee": money_str(row["perishable_fee"]),
        "is_active": bool(row["is_active"]),
        "sort_order": row["sort_order"],
    }


def _clean(data, partial):
    if not isinstance(data, dict):
        raise ValidationError("Request body must be a JSON object")
    cleaned = {}
    if not partial or "name" in data:
        cleaned["name"] = _county_name(data.get("name"))
    for field in ("normal_fee", "delicate_fee", "perishable_fee"):
        if not partial or field in data:
            cleaned[field] = parse_money(data.get(field), field, allow_zero=True)
    if not partial or "sort_order" in data:
        cleaned["sort_order"] = parse_positive_int(data.get("sort_order", 0), "sort_order", minimum=0, maximum=100000)
    if not partial or "is_active" in data:
        if "is_active" not in data and not partial:
            cleaned["is_active"] = True
        elif not isinstance(data.get("is_active"), bool):
            raise ValidationError(details={"is_active": "Must be true or false"})
        else:
            cleaned["is_active"] = data["is_active"]
    return cleaned


def _county_name(value):
    county = canonical_county(clean_text(value, "name", 160) if value not in (None, "") else "")
    if not county:
        raise ValidationError(details={"name": "Choose a county from the checkout list"})
    return county


def _duplicate(exc):
    import pymysql

    if isinstance(exc, pymysql.err.IntegrityError) and exc.args and exc.args[0] == 1062:
        raise Conflict("A fee for this county already exists") from exc
    raise exc
