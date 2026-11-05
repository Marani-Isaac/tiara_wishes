from decimal import Decimal, ROUND_HALF_UP

TWOPLACES = Decimal("0.01")


def to_money(value):
    if value is None:
        return None
    amount = value if isinstance(value, Decimal) else Decimal(str(value))
    return amount.quantize(TWOPLACES, rounding=ROUND_HALF_UP)


def money_str(value):
    if value is None:
        return None
    return format(to_money(value), "f")


def calculate_totals(lines, discount, delivery_fee, tax_rate):
    """lines: sequence of (unit_price, quantity). All outputs are Decimal."""
    priced = []
    subtotal = Decimal("0.00")
    for unit_price, quantity in lines:
        unit = to_money(unit_price)
        line_subtotal = to_money(unit * quantity)
        subtotal = to_money(subtotal + line_subtotal)
        priced.append(
            {
                "unit_price": unit,
                "quantity": quantity,
                "line_subtotal": line_subtotal,
            }
        )
    discount = to_money(discount or 0)
    if discount > subtotal:
        discount = subtotal
    allocations = _allocate(priced, discount)
    delivery_fee = to_money(delivery_fee or 0)
    rate = Decimal(str(tax_rate or 0))
    taxable = to_money(subtotal - discount)
    tax_total = to_money(taxable * rate)
    grand_total = to_money(taxable + delivery_fee + tax_total)
    for line, allocated in zip(priced, allocations):
        line["discount_amount"] = allocated
        line["line_total"] = to_money(line["line_subtotal"] - allocated)
    return {
        "lines": priced,
        "subtotal": subtotal,
        "discount_total": discount,
        "delivery_fee": delivery_fee,
        "tax_total": tax_total,
        "grand_total": grand_total,
    }


def _allocate(lines, discount):
    if not lines or discount == 0:
        return [Decimal("0.00") for _ in lines]
    subtotal = sum((line["line_subtotal"] for line in lines), Decimal("0.00"))
    if subtotal == 0:
        return [Decimal("0.00") for _ in lines]
    allocated = []
    running = Decimal("0.00")
    for index, line in enumerate(lines):
        if index == len(lines) - 1:
            amount = to_money(discount - running)
        else:
            amount = to_money(discount * line["line_subtotal"] / subtotal)
            running = to_money(running + amount)
        allocated.append(amount)
    return allocated


def percentage_discount(subtotal, percent):
    return to_money(to_money(subtotal) * Decimal(str(percent)) / Decimal("100"))


def delivery_fee_for(merchandise_after_discount, fee, threshold):
    if to_money(merchandise_after_discount) >= to_money(threshold):
        return Decimal("0.00")
    return to_money(fee)
