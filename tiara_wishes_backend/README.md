# Tiara Wishes API

Cash-purchase backend for the Tiara Wishes storefront and admin app. It is a Flask modular monolith with PyMySQL and MySQL.

Digital Chamas are **not implemented**. There are no Chama tables, membership rules, contributions, rotation, wallets, or Chama checkout. The homepage content may mention Chamas as a future note only.

## What version 1 does

- Public catalogue: categories, brands, search, filters, featured products, and product detail
- Customer registration, login, profile, addresses, and order history
- Server-side cart and a checkout quote
- Authenticated cash checkout with stock reservation
- Payment initiation plus verified, idempotent webhooks
- Admin catalogue, stock, orders, payments, deliveries, promotions, content, reports, and audit logs

Guest shoppers can browse and build a cart. Placing an order requires an account. The API never trusts a price or total sent by the browser.

## Requirements

- Python 3.11 or newer (developed with the Python installed on this machine)
- MySQL 8 or MariaDB 10.5+ with InnoDB

## Windows PowerShell

```powershell
cd "C:\Users\HP\OneDrive\Desktop\Nuvemite Tech Company\tiara_wishes_backend"
python -m venv .venv
.\.venv\Scripts\Activate.ps1
pip install -r requirements.txt
Copy-Item .env.example .env
```

Edit `.env`. Create the MySQL user and database (do not put production passwords in source control):

```sql
CREATE DATABASE tiara_wishes CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
CREATE USER 'tiara'@'localhost' IDENTIFIED BY 'a-strong-password';
GRANT ALL PRIVILEGES ON tiara_wishes.* TO 'tiara'@'localhost';
FLUSH PRIVILEGES;
```

```powershell
python -m app.cli init-db
python -m app.cli create-admin --email admin@example.com --password "ChangeMe123" --first-name Store --last-name Admin
python run.py
```

The API listens on `http://127.0.0.1:5055`. Check `GET /api/v1/health`. Port 5000 is left free for other projects.

## macOS or Linux

```bash
cd tiara_wishes_backend
python3 -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
cp .env.example .env
python -m app.cli init-db
python -m app.cli create-admin --email admin@example.com --password "ChangeMe123" --first-name Store --last-name Admin
python run.py
```

## Tests

Point `DATABASE_USER` and `DATABASE_PASSWORD` at a MySQL account that can create databases. Tests use `tiara_wishes_test` and refuse to reset any database whose name does not contain `test`.

```powershell
$env:DATABASE_USER = "tiara"
$env:DATABASE_PASSWORD = "a-strong-password"
pytest
```

## Storefront integration

The customer shop is `tiara_wishes_storefront` and runs at `http://localhost:5174`. The admin app stays on `http://localhost:5173`. Both proxy `/api` and `/media` to this API in development.

`CORS_ORIGINS` should list both sites when a browser calls the API directly:

`http://localhost:5173,http://127.0.0.1:5173,http://localhost:5174,http://127.0.0.1:5174`

Restart Flask after changing `CORS_ORIGINS`. The proxy path does not need CORS.

- Base path: `/api/v1`
- Send `Authorization: Bearer <access_token>` or call the API with cookies (`credentials: 'include'`)
- Cookie-authenticated writes also send the `csrf_token` cookie value in `X-CSRF-Token`
- Production does not allow `*`
- Money is returned as decimal strings such as `"450.00"`
- Upload product images as multipart field `image` (JPEG, PNG, or WebP). The API stores a relative `/media/...` path, not a remote URL

## Orders, stock, and payments

`inventory.on_hand` and `inventory.reserved` are the stock source. Available stock is `on_hand - reserved`. Products do not store a second stock number.

An unpaid order reserves stock for `STOCK_RESERVATION_MINUTES` (default 30). Run this on a schedule so expired holds are released and those orders are cancelled:

```powershell
python -m app.cli release-reservations
```

Checkout also releases expired reservations before taking a new one. A failed payment does not release stock immediately; the customer can retry until the hold expires. Only a verified webhook, or an audited admin reconciliation, can mark a payment succeeded. Opening a success page does not mark an order paid. A repeated webhook does not sell the stock twice.

If payment arrives after the reservation expired, the payment is recorded and the order is flagged `requires_review` instead of being confirmed automatically.

The mock provider works only when `FLASK_ENV` is not `production` and `PAYMENT_MOCK_ENABLED=true`. Sign mock webhooks with hex HMAC-SHA256 of the raw body using `PAYMENT_WEBHOOK_SECRET`, sent in `X-Tiara-Signature`. M-Pesa callbacks must include the configured `token` query parameter (`MPESA_CALLBACK_SECRET`). Set the Safaricom callback URL to that address. M-Pesa amounts must be whole shillings.

Refunds are internal records only. The API does not send a refund to M-Pesa or any other provider.

## Reporting

Paid sales are payments whose status is `succeeded`, plus `partially_refunded` payments after recorded refunds are subtracted. Pending, failed, cancelled, and fully refunded payments are not revenue. Recording a refund restates the period in which the original payment was confirmed. Dashboard "today" uses `BUSINESS_TIMEZONE` (default `Africa/Nairobi`).

## Assumptions

These are configurable or documented because the business rule was not closed:

- Email is required and unique. Phone is optional, Kenyan format, and unique when present. There are no phone-only accounts.
- Access is stored in `roles`, `permissions`, `user_roles`, and `role_permissions` from the first release. Public registration always creates a customer. Administrators are created with `python -m app.cli create-admin`.
- One promotion code can be used once per customer, and `usage_limit` caps total uses.
- Delivery is a flat `DELIVERY_FEE_KES`, free at or above `FREE_DELIVERY_THRESHOLD_KES`. It is not calculated from weight or county. An admin can override the two amounts in site settings.
- `TAX_RATE` defaults to `0`, so the product price is the amount charged. If you set a rate, tax is added on top of the discounted merchandise subtotal.
- Reviews stay `pending` until an admin approves them. A purchase is not required.
- Categories can be nested up to 4 levels.
- Passwords are hashed with Werkzeug PBKDF2-HMAC-SHA256 (600000 iterations by default).
- Access tokens last `JWT_ACCESS_MINUTES` (default 15). Refresh tokens rotate and are stored only as a hash. Logout revokes the refresh token; a stolen access token expires on its own.
- Email and SMS are not marked sent unless SMTP is actually configured. In-app notifications are the delivered copy.
- Prices are treated as KES. This release does not add a second currency at checkout.

## Backups

```powershell
mysqldump --single-transaction --routines=false -u tiara -p tiara_wishes > tiara_wishes_backup.sql
mysql -u tiara -p tiara_wishes < tiara_wishes_backup.sql
```

Take a backup before applying a new file in `sql/`. `python -m app.cli init-db` runs each SQL file once and records it in `schema_migrations`. Add a new numbered file for later changes; do not edit an already applied file in place.

## Production notes

- Set `FLASK_ENV=production`, `FLASK_DEBUG=false`, `PAYMENT_MOCK_ENABLED=false`, and `SESSION_COOKIE_SECURE=true`
- Serve the app behind HTTPS. `python run.py` is for local development
- Keep `SECRET_KEY`, database passwords, and payment secrets in the environment
- The demo categories, brands, products, and `WELCOME10` code are sample data. Archive them before launch
