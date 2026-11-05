from app.payments.providers.base import PaymentProvider


class MockProvider(PaymentProvider):
    """Local test adapter. It never marks a payment as paid by itself."""

    name = "mock"

    def initiate(self, payment, phone):
        return {
            "provider_status": "pending",
            "provider_transaction_id": None,
            "response_code": "0",
            "summary": {
                "result_code": "0",
                "result_desc": "Mock payment initiated. A signed webhook must confirm it.",
            },
            "client_payload": {
                "provider": "mock",
                "merchant_reference": payment["merchant_reference"],
                "message": "Submit a signed webhook to /api/v1/payments/webhooks/mock to complete this payment.",
            },
        }
