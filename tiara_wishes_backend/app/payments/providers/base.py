class PaymentProvider:
    name = "base"

    def initiate(self, payment, phone):
        raise NotImplementedError
