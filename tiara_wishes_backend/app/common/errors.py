class AppError(Exception):
    def __init__(self, code, message, status=400, details=None):
        super().__init__(message)
        self.code = code
        self.message = message
        self.status = status
        self.details = details or {}


class ValidationError(AppError):
    def __init__(self, message="Please check the submitted fields", details=None):
        super().__init__("VALIDATION_ERROR", message, 422, details)


class Unauthorized(AppError):
    def __init__(self, message="Authentication required"):
        super().__init__("UNAUTHORIZED", message, 401)


class Forbidden(AppError):
    def __init__(self, message="You do not have permission to perform this action"):
        super().__init__("FORBIDDEN", message, 403)


class NotFound(AppError):
    def __init__(self, message="Resource not found"):
        super().__init__("NOT_FOUND", message, 404)


class Conflict(AppError):
    def __init__(self, message, code="CONFLICT", details=None):
        super().__init__(code, message, 409, details)
