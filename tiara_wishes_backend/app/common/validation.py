import re

from flask import request

from app.common.errors import ValidationError
from app.common.money import to_money

EMAIL_RE = re.compile(r"^[^@\s]+@[^@\s]+\.[^@\s]+$")
SLUG_RE = re.compile(r"^[a-z0-9]+(?:-[a-z0-9]+)*$")
SKU_RE = re.compile(r"^[A-Za-z0-9][A-Za-z0-9._-]{1,63}$")


def json_body():
    data = request.get_json(silent=True)
    if not isinstance(data, dict):
        raise ValidationError("Request body must be a JSON object")
    return data


def require_fields(data, fields):
    details = {}
    for field in fields:
        value = data.get(field)
        if value is None or (isinstance(value, str) and not value.strip()):
            details[field] = "This field is required"
    if details:
        raise ValidationError(details=details)


def clean_text(value, field, max_length, required=True):
    if value is None or (isinstance(value, str) and not value.strip()):
        if required:
            raise ValidationError(details={field: "This field is required"})
        return None
    if not isinstance(value, str):
        raise ValidationError(details={field: "Must be text"})
    text = " ".join(value.split())
    if len(text) > max_length:
        raise ValidationError(details={field: f"Must be {max_length} characters or fewer"})
    return text


def clean_multiline(value, field, max_length, required=False):
    """Keep paragraph breaks. Each line is trimmed, blank lines are dropped."""
    if value is None or (isinstance(value, str) and not value.strip()):
        if required:
            raise ValidationError(details={field: "This field is required"})
        return None
    if not isinstance(value, str):
        raise ValidationError(details={field: "Must be text"})
    lines = []
    for line in value.replace("\r\n", "\n").replace("\r", "\n").split("\n"):
        compact = " ".join(line.split())
        if compact:
            lines.append(compact)
    text = "\n".join(lines)
    if not text:
        if required:
            raise ValidationError(details={field: "This field is required"})
        return None
    if len(text) > max_length:
        raise ValidationError(details={field: f"Must be {max_length} characters or fewer"})
    return text


def normalize_email(value):
    email = clean_text(value, "email", 255)
    email = email.lower()
    if not EMAIL_RE.match(email):
        raise ValidationError(details={"email": "Enter a valid email address"})
    return email


def normalize_phone(value, field="phone", required=False):
    if value is None or (isinstance(value, str) and not value.strip()):
        if required:
            raise ValidationError(details={field: "This field is required"})
        return None
    if not isinstance(value, str):
        raise ValidationError(details={field: "Must be text"})
    compact = re.sub(r"[\s\-()]+", "", value.strip())
    if compact.startswith("+"):
        digits = compact[1:]
        if digits.startswith("254") and len(digits) == 12 and digits.isdigit():
            return "+" + digits
    elif compact.startswith("254") and len(compact) == 12 and compact.isdigit():
        return "+" + compact
    elif compact.startswith("0") and len(compact) == 10 and compact.isdigit():
        return "+254" + compact[1:]
    elif len(compact) == 9 and compact.isdigit() and compact[0] in {"1", "7"}:
        return "+254" + compact
    raise ValidationError(details={field: "Enter a Kenyan phone number"})


def validate_password(password, field="password"):
    if not isinstance(password, str) or len(password) < 8 or len(password) > 128:
        raise ValidationError(details={field: "Use 8 to 128 characters"})
    if not re.search(r"[A-Za-z]", password) or not re.search(r"\d", password):
        raise ValidationError(details={field: "Include at least one letter and one number"})
    return password


def slugify(value):
    text = clean_text(value, "name", 180).lower()
    text = re.sub(r"[^a-z0-9]+", "-", text).strip("-")
    return text[:180] or "item"


def validate_slug(value, field="slug"):
    slug = clean_text(value, field, 180).lower()
    if not SLUG_RE.match(slug):
        raise ValidationError(details={field: "Use lowercase letters, numbers, and hyphens"})
    return slug


def validate_http_url(value, field, required=False, max_length=500):
    if value is None or (isinstance(value, str) and not value.strip()):
        if required:
            raise ValidationError(details={field: "This field is required"})
        return None
    text = clean_text(value, field, max_length)
    if not (text.startswith("https://") or text.startswith("http://")):
        raise ValidationError(details={field: "Enter a link that starts with http:// or https://"})
    return text


def validate_sku(value):
    sku = clean_text(value, "sku", 64)
    if not SKU_RE.match(sku):
        raise ValidationError(details={"sku": "Use letters, numbers, dots, hyphens, or underscores"})
    return sku.upper()


def parse_positive_int(value, field, minimum=1, maximum=None):
    if isinstance(value, bool) or not isinstance(value, int):
        raise ValidationError(details={field: "Must be a whole number"})
    if value < minimum or (maximum is not None and value > maximum):
        upper = f" and at most {maximum}" if maximum is not None else ""
        raise ValidationError(details={field: f"Must be at least {minimum}{upper}"})
    return value


def parse_money(value, field, allow_zero=True, required=True):
    if value is None or value == "":
        if required:
            raise ValidationError(details={field: "This field is required"})
        return None
    try:
        amount = to_money(value)
    except Exception as exc:
        raise ValidationError(details={field: "Enter a valid amount"}) from exc
    if amount < 0 or (amount == 0 and not allow_zero):
        raise ValidationError(details={field: "Amount must be greater than zero" if not allow_zero else "Amount cannot be negative"})
    return amount


def parse_items(items):
    if not isinstance(items, list) or not items:
        raise ValidationError(details={"items": "Add at least one product"})
    if len(items) > 50:
        raise ValidationError(details={"items": "A checkout can contain at most 50 lines"})
    parsed = []
    seen = set()
    for item in items:
        if not isinstance(item, dict):
            raise ValidationError(details={"items": "Each item must be an object"})
        product_id = parse_positive_int(item.get("product_id"), "product_id")
        quantity = parse_positive_int(item.get("quantity"), "quantity", minimum=1, maximum=99)
        if product_id in seen:
            raise ValidationError(details={"items": "Each product can appear only once"})
        seen.add(product_id)
        parsed.append({"product_id": product_id, "quantity": quantity})
    return parsed


def like_pattern(value):
    text = clean_text(value, "q", 100, required=False)
    if not text:
        return None
    escaped = text.replace("\\", "\\\\").replace("%", "\\%").replace("_", "\\_")
    return f"%{escaped}%"
