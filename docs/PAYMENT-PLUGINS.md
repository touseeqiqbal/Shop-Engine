# Payments in every country – methods and provider plugins

How ShopEngine stores in different countries take payment, and how a developer adds a new payment provider
(for example Razorpay for India, Paystack for Nigeria or Mercado Pago for Latin America).

---

## 1. What a store owner can offer

Settings → **Payments** (each store has its own):

| Kind | Examples | How it works |
|---|---|---|
| **Cash on Delivery** | built in, every country | The rider collects. Optional fee, maximum order value, advance payment for risky or large orders. |
| **Bank transfer** | built in, every country | The shopper transfers money, uploads the receipt and types its transaction id. Staff approve it (payment "Paid") before the order can ship. |
| **JazzCash / EasyPaisa** | built in, **Pakistan only** | Same as bank transfer. Stores in other countries don't see these settings. |
| **Card (online)** | a **provider plugin** – Stripe for now | The shopper pays on the provider's secure page. The order becomes Paid only when the provider confirms it (signed webhook). The owner connects the store's own provider account in Account → Stores → Online payments. |
| **Other payment methods** | the store's own: UPI, M-Pesa, PIX, bKash, GCash, Zelle, "Card on delivery", "Pay at pickup" … | Added by the owner with a name, account details and instructions. **Before shipping**: works like bank transfer (receipt + transaction id, approved by staff). **On delivery / pickup**: works like cash on delivery. |

The Payments page shows ideas for the store's country (from `LOCAL_METHOD_IDEAS` in `src/lib/payments/catalog.ts`) and
which card providers work there.

Every order keeps the name of its method (`paymentMethodLabel`), when it is paid (`paymentDue`: before shipping or on
delivery) and its currency – so renaming or removing a method, or changing the store's currency later, never changes
old orders.

---

## 2. The rules that keep money right (same for every method and provider)

- A method paid **before shipping** can't be confirmed or shipped until its payment is "Paid"
  (`paymentBlocksShipping` in `src/lib/order-money.ts`). Only an owner or manager can approve a payment.
- One receipt pays for one order: a transaction id can't be used twice in a store.
- An online payment is marked Paid **only** from the provider: a verified webhook, or asking the provider when
  reconciling. Never from the browser coming back from the payment page.
- The amount, currency and the store's own provider account must match the order, or nothing is marked paid.
- Every provider call carries an idempotency key; every webhook event is stored once (`payment-events`, unique per
  provider + event id) – replays and retries change nothing.
- A payment that fails or expires cancels the order, which puts the stock back.

---

## 3. Code map

| File | What it is |
|---|---|
| `src/lib/payments/methods.ts` | Client-safe. Built-in methods, the store's own methods, `checkoutMethods(settings)` – the one list the checkout page and the server both use. |
| `src/lib/payments/catalog.ts` | Client-safe. Every provider plugin's description: id, name, the methods it takes, countries and currencies. |
| `src/lib/payments/gateway-types.ts` | The `PaymentGateway` interface a provider plugin implements. |
| `src/lib/payments/gateways.ts` | The registry: `getGateway(id)`, `storeGateway(store)`, `gatewayReady(id, store)`. Built-in plugins are registered at the bottom. |
| `src/lib/payments/stripe-gateway.ts` | The Stripe plugin (Stripe Connect + hosted Checkout). Uses `index.ts` and `stripe.ts`. |
| `src/lib/payments/webhook.ts` | The shared webhook handler: signature → store the event once → plugin handles it. |
| `src/app/api/webhooks/payments/[provider]/route.ts` | `POST /api/webhooks/payments/<provider id>` for every plugin. (`/api/webhooks/stripe` is kept for existing Stripe set-ups.) |
| `src/payload/collections/payments.ts` | `payment-transactions` (charges and refunds, unique per provider + provider id) and `payment-events` (webhooks). |

---

## 4. Adding a provider plugin

Most providers that serve marketplaces work like Stripe Connect: **the platform** holds one set of API keys, and each
store has a **connected / sub-account** at the provider (Paystack subaccounts, Razorpay Route linked accounts,
Flutterwave subaccounts, Mercado Pago marketplace, PayPal partner referrals). ShopEngine never stores a store's own
secret keys.

1. **Describe it** in `src/lib/payments/catalog.ts` → `GATEWAYS`:
   ```ts
   { id: "paystack", label: "Paystack", methods: ["card"], countries: ["NG", "GH", "ZA", "KE", "CI", "EG"], currencies: ["NGN", "GHS", "ZAR", "KES", "XOF", "EGP", "USD"], description: "Cards, bank transfer and mobile money." }
   ```
   `countries` = where a store can open an account; `currencies` = what it can charge. Stores outside these never see it.

2. **Implement it** in `src/lib/payments/<id>-gateway.ts` (server only) – `PaymentGateway` from `gateway-types.ts`:

   | Function | Must do |
   |---|---|
   | `configured()` | `true` when the platform's keys are set (env vars, e.g. `PAYSTACK_SECRET_KEY`). |
   | `ready(store)` | `true` when the store's connected account can take payments (`store.paymentsAccountId`, `store.paymentsChargesEnabled`, and `store.paymentsProvider === "<id>"`). |
   | `start(payload, input)` | Create the provider's hosted payment for `input.total` in `input.currency` (convert to minor units the provider's way) on the store's account, with an idempotency key / unique reference like `checkout:<orderId>`. Save a `payment-transactions` row (`kind: "charge"`, `status: "pending"`, `provider: "<id>"`, `providerRef`, `amount`, `currency`, `checkoutUrl`, `expiresAt`). Return `{ url }`. |
   | `resumeUrl(payload, orderId)` | The still-open payment page of a pending charge (or `null`). |
   | `verifyWebhook(rawBody, headers)` | Check the provider's signature (HMAC with the webhook secret, timing-safe compare, reject old timestamps if the provider sends one). Throw `GatewayError(message, status)` when it fails. Return `{ id, type, data }` – `id` must be the provider's unique event id. |
   | `handleWebhook(payload, event)` | Paid → check amount, currency and account against the order, then mark the charge `succeeded` and the order `paymentStatus: "paid"` (and `confirmed` if it was `awaiting-payment`) in one transaction, queue the `order-placed` message and the `order.paid` store webhook – see `markCheckoutPaid` in `index.ts`. Failed / expired → `failCheckout`-style cancel. Return `{ status: "processed" | "ignored", store, summary }`. |
   | `refund(payload, req, { orderId, amount, reason })` | Refund through the provider, never more than charged minus earlier refunds; record a `kind: "refund"` row; update the order's payment status. |
   | `reconcile?(payload)` | Optional: ask the provider about pending charges whose page expired (housekeeping runs it). |
   | `connectLink?` / `refreshAccount?` | Optional: onboarding link for the owner (create the sub-account with the store's country) and re-checking whether it can take payments. |

   Reuse the Stripe plugin's structure – the order and payment bookkeeping in `index.ts` is provider-neutral apart
   from the API calls.

3. **Register it** at the bottom of `src/lib/payments/gateways.ts`: `registerGateway(paystackGateway);`

4. **Point the provider's webhook** at `https://<platform domain>/api/webhooks/payments/<id>` and set its secret
   (e.g. `PAYSTACK_WEBHOOK_SECRET`) in the platform's environment variables. Add the env vars to
   `docs/DEPLOYMENT.md`.

5. **Test it** like `scripts/tests/payment-webhooks.mjs` does for Stripe: a forged signature is refused, a replayed
   event changes nothing, a wrong amount / currency / account marks nothing paid, an expired payment cancels the order
   and returns the stock.

A store chooses its provider in Stores → Online payments (`paymentsProvider`); when it hasn't, the first plugin that
works in its country and currency is offered to the owner.

> **Not verified here:** only Stripe exists today and its live API calls were not run (no keys in this environment).
> A new plugin must be tested against the provider's sandbox before stores use it.
