# Tiara Wishes Storefront

Customer shop for Tiara Wishes. It uses the same Flask API and MySQL database as the admin app. It does not include admin tools, and Chamas are not operational.

Colours and type follow the Figma frames: plum, cream, and soft gold, with Fraunces and Manrope. Catalogue, prices, and contact details still come from the API. Rewards and Chama stay informational. A “save up to” note appears only when a featured product has a higher compare-at price.

## The three projects

| Project | Folder | Local address |
| --- | --- | --- |
| Storefront | `tiara_wishes_storefront` | `http://localhost:5174` |
| Admin | `tiara_wishes_admin` | `http://localhost:5173/admin/login` |
| API | `tiara_wishes_backend` | `http://127.0.0.1:5055` |

Catalogue, cart, checkout, accounts, and orders are the API. The admin publishes products, prices, categories, images, and homepage copy. This shop reads them.

## Setup

Requirements: Node.js 20 or newer, and the Tiara Wishes API running.

```powershell
cd "C:\Users\HP\OneDrive\Desktop\Nuvemite Tech Company\tiara_wishes_storefront"
npm install
npm run dev
```

Open `http://localhost:5174`.

The Vite dev server proxies `/api` and `/media` to `http://127.0.0.1:5055`. Sign-in uses `Authorization: Bearer` plus the API refresh cookie. The access token is kept in `sessionStorage` for the tab only. The refresh token stays in an HttpOnly cookie.

If you point `VITE_API_BASE_URL` at the API directly, set the backend `CORS_ORIGINS` to this site (`http://localhost:5174` and `http://127.0.0.1:5174`) as well as the admin origins, then restart Flask. Use the same hostname in the browser and the API URL so the cookies are sent.

## Environment

See `.env.example`.

| Variable | Purpose |
| --- | --- |
| `VITE_API_BASE_URL` | API prefix. Default `/api/v1` uses the Vite proxy. |
| `VITE_MEDIA_ORIGIN` | Origin for `/media/...` image paths. Leave empty while using the proxy. |
| `VITE_PAYMENT_PROVIDER` | `mock` or `mpesa`. Must match the provider the API is actually running. |

## Routes

- `/` home
- `/shop` catalogue, with search, filters, sort, and pagination in the query string
- `/categories/:slug`
- `/products/:slug`
- `/cart`
- `/checkout` cash purchase only
- `/login`, `/register`, `/forgot-password`, `/reset-password`
- `/account`, `/account/addresses`, `/account/orders`, `/account/orders/:orderNumber`
- `/chamas` coming soon. No contributions, groups, or wallet
- `/about`, `/contact`, `/delivery-returns`, `/privacy`, `/terms`

Account pages require a signed-in customer. After login, the shop returns to the page that was requested.

## API assumptions

- Envelope: `{ success, data, message, meta }`
- Money is a decimal string such as `"450.00"`, shown as `KSh 450.00`
- `GET /api/v1/products` supports `q`, `category`, `brand`, `min_price`, `max_price`, `featured`, `sort` (`newest`, `price_asc`, `price_desc`, `name`), `page`, and `per_page`
- Guest carts use the `cart_session` cookie. A local copy of product ids and quantities is kept so a lost cookie can be rebuilt. Prices in the browser are not used at checkout
- `POST /api/v1/checkout/quote` and `POST /api/v1/orders` recalculate totals. The order request sends `Idempotency-Key`
- Placing an order requires an account. Browsing and the cart do not
- Payment status is read from `GET /api/v1/payments/:merchantReference` and the order. A redirect or query string never marks a payment paid
- `VITE_PAYMENT_PROVIDER=mock` starts a pending test payment. The API confirms it only through a signed webhook or an admin reconciliation
- `VITE_PAYMENT_PROVIDER=mpesa` asks for a Kenyan phone and starts an STK push. The prompt is the provider's, not a card form on this site
- Customers can open only their own orders and addresses
- Homepage announcement, Chama note, featured products, and contact details come from `GET /api/v1/site-content/home`
- Approved reviews are shown only when the product has them. There is no invented rating
- About, delivery, privacy, and terms use short placeholder copy until the owner replaces it in the admin content blocks or this page

## What this shop does not do

- Chama membership, contributions, rotation, allocation, or Chama payments
- A customer wallet
- Admin catalogue, stock, or staff tools
- Collecting a contact-form or newsletter submission. There is no API for that
- Marking a payment successful from the browser

## Scripts

```powershell
npm run dev
npm run build
npm run preview
```
