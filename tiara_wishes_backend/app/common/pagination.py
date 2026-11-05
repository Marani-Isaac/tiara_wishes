from flask import request

from app.common.errors import ValidationError


def get_page_args(default_per_page=20, max_per_page=100):
    page = _positive("page", 1)
    per_page = _positive("per_page", default_per_page)
    if per_page > max_per_page:
        raise ValidationError(details={"per_page": f"Maximum page size is {max_per_page}"})
    offset = (page - 1) * per_page
    return page, per_page, offset


def page_meta(page, per_page, total):
    pages = (total + per_page - 1) // per_page if per_page else 0
    return {"page": page, "per_page": per_page, "total": total, "pages": pages}


def _positive(name, default):
    raw = request.args.get(name, str(default))
    if not str(raw).isdigit():
        raise ValidationError(details={name: "Must be a positive whole number"})
    value = int(raw)
    if value < 1:
        raise ValidationError(details={name: "Must be a positive whole number"})
    return value
