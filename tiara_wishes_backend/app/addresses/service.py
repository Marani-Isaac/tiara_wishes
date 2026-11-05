from app.audit.service import write_audit
from app.common.errors import NotFound, ValidationError
from app.common.serializers import address_public
from app.common.transactions import run_transaction
from app.common.validation import clean_text, normalize_phone
from app.db.connection import db_session

ADDRESS_COLUMNS = (
    "recipient_name",
    "recipient_phone",
    "county",
    "town",
    "area_or_estate",
    "building",
    "house_or_unit",
    "delivery_instructions",
)


def list_addresses(user_id):
    with db_session() as db:
        rows = db.all(
            "SELECT * FROM addresses WHERE user_id = %s ORDER BY is_default DESC, id DESC",
            (user_id,),
        )
    return [address_public(row) for row in rows]


def create_address(user, payload):
    cleaned = clean_address(payload)

    def work(db):
        existing = db.one("SELECT id FROM addresses WHERE user_id = %s LIMIT 1", (user["id"],))
        is_default = cleaned.get("is_default", existing is None)
        if is_default:
            db.execute("UPDATE addresses SET is_default = 0 WHERE user_id = %s", (user["id"],))
        address_id, _ = db.execute(
            """
            INSERT INTO addresses (
              user_id, recipient_name, recipient_phone, county, town, area_or_estate,
              building, house_or_unit, delivery_instructions, is_default
            ) VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s)
            """,
            (
                user["id"],
                cleaned["recipient_name"],
                cleaned["recipient_phone"],
                cleaned["county"],
                cleaned["town"],
                cleaned["area_or_estate"],
                cleaned.get("building"),
                cleaned.get("house_or_unit"),
                cleaned.get("delivery_instructions"),
                1 if is_default else 0,
            ),
        )
        row = db.one("SELECT * FROM addresses WHERE id = %s", (address_id,))
        return address_public(row)

    return run_transaction(work)


def update_address(user, address_id, payload):
    cleaned = clean_address(payload, partial=True)
    if not cleaned:
        raise ValidationError("No changes were submitted")

    def work(db):
        row = db.one(
            "SELECT * FROM addresses WHERE id = %s AND user_id = %s FOR UPDATE",
            (address_id, user["id"]),
        )
        if not row:
            raise NotFound("Address not found")
        if cleaned.get("is_default") is True:
            db.execute("UPDATE addresses SET is_default = 0 WHERE user_id = %s", (user["id"],))
        values = {key: row[key] for key in ADDRESS_COLUMNS}
        values.update({key: cleaned[key] for key in cleaned if key in ADDRESS_COLUMNS})
        is_default = row["is_default"]
        if "is_default" in cleaned:
            is_default = 1 if cleaned["is_default"] else 0
        db.execute(
            """
            UPDATE addresses
            SET recipient_name = %s, recipient_phone = %s, county = %s, town = %s,
                area_or_estate = %s, building = %s, house_or_unit = %s,
                delivery_instructions = %s, is_default = %s
            WHERE id = %s AND user_id = %s
            """,
            (
                values["recipient_name"],
                values["recipient_phone"],
                values["county"],
                values["town"],
                values["area_or_estate"],
                values["building"],
                values["house_or_unit"],
                values["delivery_instructions"],
                is_default,
                address_id,
                user["id"],
            ),
        )
        if not is_default:
            _ensure_default(db, user["id"])
        updated = db.one("SELECT * FROM addresses WHERE id = %s", (address_id,))
        return address_public(updated)

    return run_transaction(work)


def delete_address(user, address_id):
    def work(db):
        row = db.one(
            "SELECT * FROM addresses WHERE id = %s AND user_id = %s",
            (address_id, user["id"]),
        )
        if not row:
            raise NotFound("Address not found")
        db.execute("DELETE FROM addresses WHERE id = %s AND user_id = %s", (address_id, user["id"]))
        _ensure_default(db, user["id"])
        return {"id": address_id}

    return run_transaction(work)


def address_snapshot(db, user_id, payload):
    if payload.get("address_id") is not None:
        from app.common.validation import parse_positive_int

        address_id = parse_positive_int(payload.get("address_id"), "address_id")
        row = db.one(
            "SELECT * FROM addresses WHERE id = %s AND user_id = %s",
            (address_id, user_id),
        )
        if not row:
            raise NotFound("Address not found")
        return {column: row[column] for column in ADDRESS_COLUMNS}
    address = payload.get("address")
    if not isinstance(address, dict):
        raise ValidationError(details={"address": "Choose a saved address or enter a delivery address"})
    return clean_address(address)


def clean_address(data, partial=False):
    if not isinstance(data, dict):
        raise ValidationError(details={"address": "Address must be an object"})
    limits = {
        "recipient_name": 120,
        "county": 80,
        "town": 80,
        "area_or_estate": 120,
        "building": 120,
        "house_or_unit": 80,
        "delivery_instructions": 500,
    }
    required = {"recipient_name", "county", "town", "area_or_estate"}
    cleaned = {}
    fields = list(limits) if not partial else [field for field in limits if field in data]
    if not partial or "recipient_phone" in data:
        cleaned["recipient_phone"] = normalize_phone(
            data.get("recipient_phone"), "recipient_phone", required=True
        )
    for field in fields:
        cleaned[field] = clean_text(data.get(field), field, limits[field], required=field in required)
    if "is_default" in data:
        if not isinstance(data["is_default"], bool):
            raise ValidationError(details={"is_default": "Must be true or false"})
        cleaned["is_default"] = data["is_default"]
    return cleaned


def _ensure_default(db, user_id):
    current = db.one(
        "SELECT id FROM addresses WHERE user_id = %s AND is_default = 1 LIMIT 1",
        (user_id,),
    )
    if current:
        return
    fallback = db.one(
        "SELECT id FROM addresses WHERE user_id = %s ORDER BY id DESC LIMIT 1",
        (user_id,),
    )
    if fallback:
        db.execute("UPDATE addresses SET is_default = 1 WHERE id = %s", (fallback["id"],))


def _unused_audit():
    return write_audit
