# Store API (v1)

For a store's own systems: an ERP or warehouse app keeping stock and prices in step, an accounting tool reading
orders, or Zapier / Make / n8n. Each key belongs to **one store** and can only do what its permissions allow.

- Keys are made by the **store owner** in `/cms` → Integrations → **Store API**. A new key is shown once; ShopEngine
  keeps only its SHA-256 hash. The owner or a manager can remove a key, which stops it at once.
- Base address: `https://<your store domain>/api/v1` (any of the store's addresses works – the key decides the store).
- Send the key in every request: `Authorization: Bearer se_live_…`
- At most **120 requests a minute per key** (`429` when exceeded).
- `stockStatus` is `in`, `low` or `out`. Answers are JSON. Errors: `{ "error": { "status": 403, "message": "…" } }`.
- Changes (`products:write`, `orders:write`) are refused with `403` while the store is read-only (suspended, closed, or
  its plan ended).

| Permission       | Shown in /cms as               | Allows                                         |
| ---------------- | ------------------------------ | ---------------------------------------------- |
| `products:read`  | Read products                  | `GET /products`, `GET /products/{id}`          |
| `products:write` | Update stock & prices          | `PATCH /products/{id}`                         |
| `orders:read`    | Read orders                    | `GET /orders`, `GET /orders/{orderNumber}`     |
| `orders:write`   | Update order status & tracking | `POST /orders/{orderNumber}/status`            |

## Products

### `GET /products`

Query: `page` (from 1), `limit` (1–100, default 50), `updated_since` (ISO date-time), `sku`.
Newest change first.

```json
{
  "data": [
    { "id": 12, "sku": "HP-200", "title": "Studio Headphones", "slug": "studio-headphones", "status": "published",
      "price": 89, "compareAtPrice": 99, "stock": 8, "stockStatus": "in", "variantOf": null,
      "backorders": "no", "releaseDate": null, "updatedAt": "2026-10-16T03:59:00.000Z" }
  ],
  "page": 1, "totalPages": 1, "total": 1
}
```

`backorders` is `"no"`, `"backorder"` (keeps selling when sold out) or `"preorder"` (`releaseDate` = the day it ships
from). A product that keeps selling can have a `stock` below 0: the units sold that are still owed to customers.

### `GET /products/{id or SKU}`

One product (`404` if it isn't in this store).

### `PATCH /products/{id or SKU}`

Body – any of:

```json
{ "stock": 12, "price": 2499, "compareAtPrice": 2999 }
```

- `stock` is a whole number ≥ 0. The change is written to **Stock history** as "Other – Store API (key name)".
- A product with options keeps stock per option: update the option's own id or SKU (the parent is refused with `400`).
- A product whose stock comes from serial numbers (unit tracking) is refused – add units in `/cms`.
- `compareAtPrice` must be higher than the price; `null` removes it.

## Orders

### `GET /orders`

Query: `page`, `limit`, `status`, `updated_since`. Newest change first.

```json
{
  "data": [
    { "id": 56, "orderNumber": "BKG-261016-482913", "status": "pending", "paymentStatus": "unpaid",
      "paymentMethod": "card-on-delivery", "currency": "USD", "subtotal": 89, "discount": 0, "deliveryCharge": 10,
      "tax": 0, "total": 99, "giftCard": null, "shippingMethod": null, "couponCode": null, "courier": null, "trackingNumber": null,
      "placedAt": "…", "updatedAt": "…",
      "customer": { "name": "…", "phone": "…", "email": "…", "address": "…", "area": null, "city": "…",
                    "postalCode": "…", "country": "US" },
      "items": [{ "productId": 12, "sku": "HP-200", "title": "Studio Headphones", "options": null, "qty": 1, "unitPrice": 89 }],
      "shipments": [] }
  ],
  "page": 1, "totalPages": 1, "total": 1
}
```

Internal notes and the order's history are not included. `giftCard` is `{ "amount": 25, "last4": "7KQ2" }` when a gift
card paid part or all of the order (the full code is never shown); `shippingMethod` is the delivery method the shopper
chose ("Express" …) in stores that offer more than one.

### `GET /orders/{orderNumber}`

One order.

### `POST /orders/{orderNumber}/status`

```json
{ "status": "dispatched", "courier": "TCS", "trackingNumber": "779412326902", "note": "Packed at warehouse 2" }
```

The same moves a member of staff may make in `/cms`:

| From                    | To                                              |
| ----------------------- | ----------------------------------------------- |
| `awaiting-payment`      | `cancelled`                                     |
| `awaiting-confirmation` | `pending`, `confirmed`, `cancelled`             |
| `pending`               | `awaiting-confirmation`, `confirmed`, `cancelled` |
| `confirmed`             | `pending`, `dispatched`, `cancelled`            |
| `dispatched`            | `out-for-delivery`, `delivered`, `refused`      |
| `out-for-delivery`      | `dispatched`, `delivered`, `refused`            |
| `delivered`, `refused`  | `returned`                                      |

Anything else answers `409` with the allowed moves (`error.allowed`). The order's usual rules still apply (an online
payment must be approved before confirming or shipping; if the order changed meanwhile the answer is `409`). The
customer gets the usual status message, and the order's history shows "Store API (key name)".

## Getting events pushed

The API is for asking. To have new orders, payments and status changes **sent** to Zapier, Make, n8n or your own
server as they happen, add a webhook in `/cms` → Webhooks (signed with the endpoint's secret).

## Code

- Routes: `src/app/api/v1/**/route.ts`
- Authentication, rate limit and the shapes above: `src/lib/store-api.ts`
- Keys: collection `api-keys` (`src/payload/collections/api-keys.ts`), managed by `src/payload/endpoints/api-keys.ts`
- Admin screen: `src/payload/admin/integrations/StoreApiPanel.tsx`
