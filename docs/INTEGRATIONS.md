# Integrations

Store owners connect the services they already use in `/cms` → **Integrations**: couriers, their own online payment
gateways, WhatsApp / SMS / email senders, ad pixels, email marketing, accounting, live chat and marketplaces – each
with the **store's own account**. Plus the **Store API** for the store's own systems (`docs/STORE-API.md`).

> **Status:** every integration was built from the provider's published documentation. None has been run against a
> real provider account yet. That is why each shows a **"New"** badge and its connect window asks owners to test first
> (test mode where the provider has one). What *was* checked is listed under [Testing](#testing).

## How it fits together

| Part | Where |
|---|---|
| Catalog – names, fields, steps, countries (client-safe) | `src/lib/integrations/catalog/*.ts` |
| Provider code, loaded only when used | `src/lib/integrations/providers/*.ts` (`providers/index.ts` maps id → module) |
| A store's connections (one per provider) | collection `integrations` – keys **AES-256-GCM encrypted** with a key derived from `PAYLOAD_SECRET` (`secrets.ts`); the admin only ever sees the last 4 characters |
| Admin screen and its endpoints | `src/payload/admin/integrations/*`, `src/payload/endpoints/integrations.ts` (`/cms-api/integration-tools/*`) |
| Provider → store (webhooks, payment returns) | `/api/integrations/<provider>/<random key per store>[/<action>]` |
| Store events → integrations (orders, payments, carts) | `emitStoreEvent` → outbox `integration.event` → `ProviderImpl.onEvent` (retried) |
| Periodic work | housekeeping: couriers every 15 min, `sync()` (marketplaces) every 30 min, expired payment pages |

Rules for every integration:

- **Who can connect:** the owner for money and sending identity (payments, WhatsApp, SMS, email, accounting, marketplaces); the owner or a manager for the rest.
- **Plans:** payment gateways need the `online_payments` plan feature.
- **Countries:** some integrations only appear for stores in their countries.
- **One per group:** only one of each kind can be on (one email sender, one SMS sender, one chat widget …).
- **Checks:** saving runs the provider's own check (`test()`). A failing check marks the connection "Needs attention", and a payment gateway in that state is not offered at checkout.
- **Changing PAYLOAD_SECRET** makes saved keys unreadable: stores then connect again.

## The integrations

### Couriers (`shipping`)
PostEx, Leopards, TCS, Trax, M&P, Call Courier (Pakistan); Shippo, EasyPost, DHL Express (international).
- **Booking:** from the order (Shipments → book with a connected courier). The tracking number and label come back; DHL labels are kept privately and served through `/cms-api`.
- **Tracking:** followed automatically; parcels move to delivered or returned by themselves.
- **COD payouts:** checked every 12 h.
- **Not built:** BlueEx (its API host does not resolve).

### Online payments (`payments`) – the store's own merchant account

| Provider | Countries | Opened with | Settled when ShopEngine asks… | Provider updates | Refund from /cms |
|---|---|---|---|---|---|
| Safepay | PK | redirect (tracker + 1 h token) | reporter API: `TRACKER_ENDED` | HMAC-SHA512 (optional secret) | no – Safepay dashboard |
| JazzCash | PK | **form POST** (pp_SecureHash) | Inquire API: payment code 000/121 | treated as a trigger only | no – JazzCash portal |
| Easypaisa | PK | **form POST** (AES merchantHashedReq) + confirm step | inquiry v4: `PAID` with the amount | IPN = trigger only (its URL is never fetched) | no – Easypay portal |
| PayFast (PK) | PK | **form POST** (access token) | status API, else signed `validation_hash` | trigger | no – PayFast portal |
| PayPal | any (PayPal currencies) | redirect | order captured, capture `COMPLETED` | verify-webhook-signature (optional Webhook ID) | yes |
| Razorpay | IN | payment link | link `paid` in full | HMAC-SHA256 (optional secret) | yes |
| Paystack | NG GH KE ZA CI | redirect | verify: `success` | HMAC-SHA512 (secret key) | yes |
| Flutterwave | Africa | hosted link | verify by **our** tx_ref: `successful` | verif-hash / v4 HMAC (optional) | yes |
| Mercado Pago | AR BR MX CL CO PE UY | Checkout Pro preference | approved payment with **our** external_reference | x-signature when sent (optional secret) | yes |
| Tap | Gulf, EG, JO | charge `src_all` | charge `CAPTURED` | re-read only | yes |
| PayTabs | MENA | hosted page | query: `A` on a sale | HMAC-SHA256 (server key) | yes |

The flow (`src/lib/integrations/payments.ts`, same rules as Stripe in `src/lib/payments/index.ts`):

1. **Checkout.**
   - The gateway is a checkout method (`settings.onlineGateways`). The order is placed as `awaiting-payment` with its stock held.
   - A pending payment is recorded with a unique attempt reference.
   - The shopper goes to the provider's page. Providers opened with a POST get a small page of ours that posts the form; the form is sealed in the address and the page's CSP allows posting only to that provider.
2. **Paid only from the provider, never from the browser.**
   - When the shopper comes back, an update arrives, or housekeeping runs, ShopEngine asks the provider itself, with the store's keys and for **our** reference.
   - It settles only if the amount and currency match the order (`markCheckoutPaid`, which every provider shares).
   - A wrong amount is never marked paid: the payment is marked failed and logged.
3. **Not paid.**
   - A failed payment cancels the order and its stock goes back.
   - Housekeeping gives up on a page 30 minutes after it expired (pages last 60 minutes). Pay-at-a-shop vouchers wait 3 days.
4. **Refunds** go from the order in `/cms` (managers), never more than was paid. Providers without a refund API show a note to refund in their own dashboard.

The "order received" message goes out once the order is paid. If a payment arrives after its order was cancelled, it is logged as `payments.paid_after_cancel` and the money must be refunded.

### WhatsApp, SMS & email (`messaging`)
- **Channels:** WhatsApp Cloud API with the store's own number and templates; SMS through Twilio, Africa's Talking, Pakistani branded SMS or any HTTP gateway; email through Resend, Brevo or SMTP.
- **Fallback:** when connected, a store's messages use them, otherwise the platform's (`lib/notify.ts`, `channels.ts`).

### Ads & analytics (`marketing`), email marketing, live chat
- **Ads and analytics:** Google Tag Manager, Google Ads, Meta Conversions API and TikTok (pixel plus Events API) are on the storefront. Purchases are sent server-side with the same event id as the pixel, so they aren't counted twice.
- **Email marketing:** Mailchimp and Klaviyo get customers and orders. Klaviyo also gets "Started Checkout" from abandoned carts that have an email.
- **Live chat:** the tawk.to or Crisp widget.

### Accounting (`accounting`) – signed in with ShopEngine's app
- **QuickBooks Online:** a SalesReceipt numbered with the order number, booked to a service item (created if missing).
- **Xero:** an approved invoice with the order number as its reference, plus its payment when a bank account code is set.
- **When:** once the money is in, i.e. paid online (`order.paid`) or delivered (`order.updated` → delivered). Never twice, because each sale is looked up first.
- **Not sent:** refunds, returns, and orders from before connecting.
- **Totals:** item lines, delivery and a "Tax and charges" line where needed, minus the discount, always add up to the order total.

### Marketplaces (`marketplaces`) – signed in with ShopEngine's app
Both are matched by **SKU**. Every ~30 minutes:

1. New marketplace orders take their items off this store's stock, recorded in Stock history as "Other – Daraz/Amazon order …". Cancelled orders are put back.
2. Then this store's stock (and prices, if chosen) is sent for SKUs that changed. ShopEngine's stock is the master.

Platform-specific notes:

- **Daraz** (PK, BD, LK, NP, MM):
  - Every call is signed; the signing matches Daraz's published test vector.
  - **Not confirmed:**
    - whether a plain `<Quantity>` is accepted, or a warehouse code is needed (there is a setting for it);
    - `limit` vs `limt` on order lists;
    - real token lifetimes.
- **Amazon:**
  - Covers merchant-fulfilled stock only; FBA stock is left alone.
  - Needs ShopEngine registered as a **public SP-API developer** (Amazon's review takes weeks).
  - Orders are read through Orders API v0, which Amazon marks deprecated (no removal date announced). Move to v2026-01-01 when its response shape is confirmed.
  - The marketplace IDs and Seller Central addresses come from established references, not re-checked against Amazon's pages.

## Platform settings
OAuth apps (QuickBooks, Xero, Daraz, Amazon): see `docs/DEPLOYMENT.md` → "Integrations signed in with the provider's page"
and `.env.example`. Everything else is entered per store.

## Testing

| What | How | Result when written |
|---|---|---|
| Unit: encryption, signatures (official test vectors: JazzCash, Razorpay, Daraz; computed examples: Easypaisa, PayFast), amounts, references, CSP of the form page, catalog completeness, accounting totals, Store API helpers | `npm test` (`tests/unit/integrations.test.ts`) | passed |
| Payment engine on a real database, providers simulated (start, return, capture, wrong amount, failed payment, signed / forged update, other store's address, abandoned page, refund) | `npm run test:integration-payments` | passed |
| Store API against the dev server (keys, scopes, isolation, stock/price/status changes) | manual script | passed |
| Admin screens (Integrations, Store API tab, gateway at checkout) | headless Chrome | checked |
| **Each provider against its real sandbox / live API** | needs the providers' accounts | **NOT VERIFIED** |

Before switching a provider on for real customers:
1. Connect it in test mode, if it has one.
2. Place a small order and check that it becomes Paid / booked / synced.
3. Refund it.
4. Then switch the integration's catalog entry to `verified: true`.
