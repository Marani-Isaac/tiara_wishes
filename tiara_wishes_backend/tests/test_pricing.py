from decimal import Decimal

from app.common.money import calculate_totals, percentage_discount, to_money


def test_totals_use_decimal_half_up():
    totals = calculate_totals(
        [(Decimal("199.99"), 2)],
        percentage_discount(Decimal("399.98"), Decimal("10")),
        Decimal("250.00"),
        Decimal("0"),
    )
    assert totals["subtotal"] == Decimal("399.98")
    assert totals["discount_total"] == Decimal("40.00")
    assert totals["delivery_fee"] == Decimal("250.00")
    assert totals["tax_total"] == Decimal("0.00")
    assert totals["grand_total"] == Decimal("609.98")
    assert totals["lines"][0]["line_total"] == Decimal("359.98")
    assert isinstance(totals["grand_total"], Decimal)
    assert to_money("10.005") == Decimal("10.01")
