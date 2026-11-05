# Tiara Wishes Admin

Administration interface for the Tiara Wishes store. It uses the same Flask API and MySQL database as the storefront. It does not have its own user store, and it does not simulate saves, payments, or Chama activity.

The customer shop is the sibling project `tiara_wishes_storefront` at `http://localhost:5174`. This admin app stays on port 5173. Both use this same API. Visual tokens in `src/styles/tokens.css` match the storefront: deep plum, cream, soft gold, Fraunces, and Manrope. Change those variables in both apps together.

## Setup

Requirements: Node.js 20 or newer, and the Tiara Wishes API running locally.

```powershell
cd "C:\Users\HP\OneDrive\Desktop\Nuvemite Tech Company\tiara_wishes_admin"
npm install
npm run dev
```

Open `http://localhost:5173/admin/login`.

The Vite dev server proxies `/api` and `/media` to `http://127.0.0.1:5055`, which is the API port from the backend README. Sign-in uses `Authorization: Bearer` plus the API's refresh cookie.

Create the first administrator with the backend CLI. There is no public admin registration.

```powershell
python -m app.cli create-admin --email admin@example.com --password "ChangeMe123" --first-name Store --last-name Admin
```

If you point `VITE_API_BASE_URL` at the API directly instead of the proxy, set the backend `CORS_ORIGINS` to this site (`http://localhost:5173` and/or `http://127.0.0.1:5173`) and restart Flask. Use the same hostname in the browser and the API URL so the refresh cookie is sent.

## Environment

See `.env.example`.

| Variable | Purpose |
| --- | --- |
| `VITE_API_BASE_URL` | API prefix. Default `/api/v1` uses the Vite proxy. |
| `VITE_MEDIA_ORIGIN` | Origin for `/media/...` image paths. Leave empty while using the proxy. |

## Routes

- `/admin/login`
- `/admin` dashboard
- `/admin/products`, `/admin/products/new`, `/admin/products/:id/edit`
- `/admin/categories`
- `/admin/brands`
- `/admin/inventory`
- `/admin/orders`, `/admin/orders/:orderNumber`
- `/admin/customers`, `/admin/customers/:id`
- `/admin/payments`, `/admin/payments/:merchantReference`
- `/admin/deliveries`, `/admin/deliveries/:id`
- `/admin/promotions`
- `/admin/reviews`
- `/admin/content`
- `/admin/settings`
- `/admin/staff`
- `/admin/reports`
- `/admin/audit-logs`
- `/admin/chama` is a non-operational "Coming later" page

The sidebar hides items the signed-in role cannot use. Opening a URL without permission shows an access-denied message. The API still enforces every action.

## Permissions

These are the codes the API already uses:

- `categories.manage`, `brands.manage`, `products.manage`, `inventory.manage`
- `orders.manage`, `deliveries.manage`
- `customers.read`, `customers.manage`
- `payments.manage`, `refunds.manage`
- `promotions.manage`, `content.manage`, `reviews.moderate`
- `reports.read`, `audit.read`, `users.manage`

`admin` and `super_admin` hold all of them. A customer account has none, so it cannot stay signed in here.

Role changes are made from a customer record by someone with `users.manage`. You cannot change your own roles, disable your own account, reset a customer password, or sign in as a customer.

## API assumptions

- Envelope: `{ success, data, message, meta }`
- Money is a decimal string such as `"450.00"`, currency KES
- Lists that are large use `page`, `per_page`, and `meta.total`
- `401` clears the local access token and returns to login. A refresh cookie is tried once first.
- `403` shows access denied. `409` and `422` show the API message and field details. `429` asks the user to wait.
- Product images are multipart field `image` (JPEG, PNG, or WebP, 5 MB). The API stores `/media/...`.
- Stock changes go to `POST /api/v1/admin/inventory/adjustments` with a reason. The form refuses a change that would fall below reserved stock; the API remains the authority.
- Order status choices are only the transitions the API allows.
- Marking a payment succeeded requires a reconciliation note and `PATCH /api/v1/admin/payments/:id`. The screen does not call a payment provider.
- `POST /api/v1/admin/refunds` records a refund only. It does not send money back to M-Pesa.
- Paid sales on the dashboard and reports are the API figures. Pending and failed payments are not added in as revenue.
- Dashboard "today" and empty date ranges follow the API timezone, Africa/Nairobi.

## What the API does not provide yet

The UI does not invent these:

- A review moderation queue. Reviews can be updated by id only.
- A single customer fetch, saved addresses, or that customer's order history.
- A single delivery fetch. Open a delivery from the list. Event history is read from the order when the role can view orders.
- An inventory movement list. Adjustments are audited and can be read under Audit logs.
- Order search, order date filters, or a low-stock filter on the product list. Low stock uses the inventory endpoint.
- CSV export.
- Chama groups, contributions, rotations, or allocations.

## Scripts

```powershell
npm run dev
npm run build
npm run preview
```
