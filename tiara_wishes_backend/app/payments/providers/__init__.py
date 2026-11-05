from flask import current_app

from app.common.errors import AppError, ValidationError
from app.payments.providers.mock import MockProvider
from app.payments.providers.mpesa import MpesaProvider


def get_provider(name):
    if name == "mock":
        if current_app.config["FLASK_ENV"] == "production" or not current_app.config["PAYMENT_MOCK_ENABLED"]:
            raise AppError("PAYMENT_NOT_CONFIGURED", "Mock payments are disabled", 403)
        return MockProvider()
    if name == "mpesa":
        return MpesaProvider()
    raise ValidationError(details={"provider": "Unsupported payment provider"})
