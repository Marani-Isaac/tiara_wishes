import base64
import json
from datetime import datetime, timezone
from urllib.error import HTTPError, URLError
from urllib.request import Request, urlopen

from flask import current_app

from app.common.errors import AppError, ValidationError
from app.common.money import to_money
from app.payments.providers.base import PaymentProvider


class MpesaProvider(PaymentProvider):
    name = "mpesa"

    def initiate(self, payment, phone):
        paybill = str(current_app.config.get("MPESA_PAYBILL") or "").strip()
        account = str(current_app.config.get("MPESA_ACCOUNT") or "").strip()
        if paybill and account:
            return {
                "provider_status": "pending",
                "provider_transaction_id": None,
                "response_code": "PAYBILL",
                "summary": {
                    "result_code": "PAYBILL",
                    "result_desc": "Customer pays the M-Pesa paybill. The store confirms the payment.",
                    "paybill": paybill,
                    "account": account,
                },
                "client_payload": {
                    "provider": "mpesa",
                    "mode": "paybill",
                    "paybill": paybill,
                    "account": account,
                    "message": "Pay the order total to the M-Pesa paybill. The order stays unpaid until the store confirms the payment.",
                },
            }
        if not self.configured():
            raise AppError("PAYMENT_NOT_CONFIGURED", "M-Pesa is not configured", 503)
        amount = to_money(payment["amount"])
        if amount != amount.to_integral_value():
            raise ValidationError(
                details={"amount": "M-Pesa payments must be a whole number of shillings"}
            )
        token = self._access_token()
        timestamp = datetime.now(timezone.utc).strftime("%Y%m%d%H%M%S")
        shortcode = current_app.config["MPESA_SHORTCODE"]
        password = base64.b64encode(
            f"{shortcode}{current_app.config['MPESA_PASSKEY']}{timestamp}".encode("utf-8")
        ).decode("ascii")
        msisdn = phone.replace("+", "")
        payload = {
            "BusinessShortCode": shortcode,
            "Password": password,
            "Timestamp": timestamp,
            "TransactionType": "CustomerPayBillOnline",
            "Amount": int(amount),
            "PartyA": msisdn,
            "PartyB": shortcode,
            "PhoneNumber": msisdn,
            "CallBackURL": current_app.config["MPESA_CALLBACK_URL"],
            "AccountReference": payment["merchant_reference"][:12],
            "TransactionDesc": "Tiara Wishes",
        }
        response = self._post(
            "/mpesa/stkpush/v1/processrequest",
            payload,
            {"Authorization": f"Bearer {token}"},
        )
        code = str(response.get("ResponseCode", ""))
        summary = {
            "result_code": code,
            "result_desc": str(response.get("ResponseDescription", ""))[:180],
        }
        if code != "0":
            return {
                "provider_status": "failed",
                "provider_transaction_id": response.get("CheckoutRequestID"),
                "response_code": code,
                "summary": summary,
                "client_payload": {"provider": "mpesa", "message": "M-Pesa did not accept the payment request."},
            }
        return {
            "provider_status": "pending",
            "provider_transaction_id": response.get("CheckoutRequestID"),
            "response_code": code,
            "summary": summary,
            "client_payload": {
                "provider": "mpesa",
                "merchant_reference": payment["merchant_reference"],
                "message": "Approve the M-Pesa prompt on the phone number you submitted.",
            },
        }

    def configured(self):
        config = current_app.config
        return all(
            config.get(key)
            for key in (
                "MPESA_CONSUMER_KEY",
                "MPESA_CONSUMER_SECRET",
                "MPESA_SHORTCODE",
                "MPESA_PASSKEY",
                "MPESA_CALLBACK_URL",
            )
        )

    def _access_token(self):
        raw = f"{current_app.config['MPESA_CONSUMER_KEY']}:{current_app.config['MPESA_CONSUMER_SECRET']}"
        basic = base64.b64encode(raw.encode("utf-8")).decode("ascii")
        url = self._base() + "/oauth/v1/generate?grant_type=client_credentials"
        request = Request(url, headers={"Authorization": f"Basic {basic}"})
        try:
            with urlopen(request, timeout=15) as response:
                payload = json.loads(response.read().decode("utf-8"))
        except (HTTPError, URLError, TimeoutError, json.JSONDecodeError) as exc:
            current_app.logger.error("M-Pesa token request failed")
            raise AppError("PAYMENT_PROVIDER_ERROR", "M-Pesa could not be reached", 502) from exc
        token = payload.get("access_token")
        if not token:
            raise AppError("PAYMENT_PROVIDER_ERROR", "M-Pesa could not be reached", 502)
        return token

    def _post(self, path, payload, headers):
        request = Request(
            self._base() + path,
            data=json.dumps(payload).encode("utf-8"),
            headers={"Content-Type": "application/json", **headers},
            method="POST",
        )
        try:
            with urlopen(request, timeout=20) as response:
                return json.loads(response.read().decode("utf-8"))
        except (HTTPError, URLError, TimeoutError, json.JSONDecodeError) as exc:
            current_app.logger.error("M-Pesa request failed")
            raise AppError("PAYMENT_PROVIDER_ERROR", "M-Pesa could not be reached", 502) from exc

    def _base(self):
        if current_app.config.get("MPESA_ENV") == "production":
            return "https://api.safaricom.co.ke"
        return "https://sandbox.safaricom.co.ke"
