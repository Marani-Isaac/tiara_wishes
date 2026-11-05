from flask import Blueprint, g

from app.common.pagination import get_page_args, page_meta
from app.common.responses import success
from app.common.security import require_auth
from app.common.validation import json_body
from app.notifications.service import list_for_user, mark_read
from app.users.service import update_account

bp = Blueprint("users", __name__, url_prefix="/api/v1")


@bp.get("/account")
@require_auth
def account():
    return success(g.current_user)


@bp.patch("/account")
@require_auth
def update():
    return success(update_account(g.current_user, json_body()), "Account updated")


@bp.get("/account/notifications")
@require_auth
def notifications():
    page, per_page, offset = get_page_args()
    rows, total = list_for_user(g.current_user["id"], page, per_page, offset)
    return success(rows, meta=page_meta(page, per_page, total))


@bp.patch("/account/notifications/<int:notification_id>/read")
@require_auth
def read_notification(notification_id):
    return success(mark_read(g.current_user["id"], notification_id), "Notification marked read")
