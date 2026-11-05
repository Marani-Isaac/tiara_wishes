from flask import Blueprint, current_app, g, request

from app.auth.service import change_password, forgot_password, login, logout, refresh, register, reset_password
from app.common.responses import success
from app.common.security import attach_auth_cookies, clear_auth_cookies, require_auth
from app.common.validation import json_body
from app.extensions import limiter

bp = Blueprint("auth", __name__, url_prefix="/api/v1")


def _limit_auth():
    return current_app.config["RATE_LIMIT_AUTH"]


def _token_response(user, tokens, message, status=200):
    response, code = success(
        {
            "user": user,
            "access_token": tokens["access_token"],
            "token_type": "Bearer",
            "expires_in": tokens["expires_in"],
        },
        message,
        status=status,
    )
    attach_auth_cookies(response, tokens["access_token"], tokens["refresh_token"], tokens["csrf_token"])
    return response, code


@bp.post("/auth/register")
@limiter.limit(_limit_auth)
def register_route():
    user, tokens = register(json_body())
    return _token_response(user, tokens, "Account created", 201)


@bp.post("/auth/login")
@limiter.limit(_limit_auth)
def login_route():
    user, tokens = login(json_body())
    return _token_response(user, tokens, "Signed in")


@bp.post("/auth/logout")
def logout_route():
    logout(request.cookies.get("refresh_token"))
    response, code = success({}, "Signed out")
    clear_auth_cookies(response)
    return response, code


@bp.post("/auth/refresh")
def refresh_route():
    user, tokens = refresh(request.cookies.get("refresh_token"))
    return _token_response(user, tokens, "Session refreshed")


@bp.get("/auth/me")
@require_auth
def me_route():
    return success(g.current_user)


@bp.post("/auth/forgot-password")
@limiter.limit(_limit_auth)
def forgot_route():
    message = forgot_password(json_body())
    return success({}, message)


@bp.post("/auth/reset-password")
@limiter.limit(_limit_auth)
def reset_route():
    reset_password(json_body())
    return success({}, "Password updated")


@bp.post("/account/password")
@require_auth
def password_route():
    change_password(g.current_user, json_body())
    return success({}, "Password updated")
