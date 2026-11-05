from flask import jsonify


def success(data=None, message="Request completed", meta=None, status=200):
    body = {
        "success": True,
        "data": {} if data is None else data,
        "message": message,
        "meta": meta or {},
    }
    return jsonify(body), status


def error_body(code, message, details=None):
    return {
        "success": False,
        "error": {
            "code": code,
            "message": message,
            "details": details or {},
        },
    }
