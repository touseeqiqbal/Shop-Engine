# Delivery fees and payments

Under **Delivery & payments** and **Settings → Fake order protection** in the `/cms` sidebar. Only **Owner** and **Manager** accounts can change these.

---

## 1. How the delivery fee is worked out

For each order the website:
1. Looks at the customer's **city**.
2. Finds the **zone** that lists that city. If none does, it uses the zone marked **Rest of Pakistan**. If there is no such zone, it uses **Charge when no zone matches**.
3. Checks **free delivery**: if the cart total (before coupon) is at or above the zone's **Free above** – or, if the zone's Free above is empty, the store-wide **Free delivery above** – delivery is free.
4. Adds the **COD handling fee** if the customer pays cash on delivery.

The cart, checkout, shipping-policy page and the fee tester all use the same rules.

## 2. Set up zones and fees

1. **Delivery & payments → Delivery charges**.
2. **Free delivery above (Rs)** – e.g. `15000`. `0` = no free delivery.
3. **Charge when no zone matches (Rs)** – a safety net, e.g. `350`.
4. Under **Zones** click **Add Zone** for each group of cities. Example:

   | Zone name | Cities | Delivery charge | Free above | Delivery time |
   |---|---|---|---|---|
   | Karachi | Karachi | 200 | 10000 | 1–2 working days |
   | Major cities | Lahore, Islamabad, Rawalpindi, Faisalabad, Multan, Hyderabad, Peshawar | 300 | *(empty = store-wide)* | 2–3 working days |
   | Rest of Pakistan | tick **Rest of Pakistan (all other cities)** | 400 | 25000 | 3–5 working days |

   - **Free above** empty = use the store-wide amount. **0 = never free** in that zone.
   - **Delivery time** empty = automatic estimate.
5. **Always add a "Rest of Pakistan" zone** – so every city gets a sensible fee.
6. **Save**. The **Shipping policy** page updates itself.

## 3. Test the fees (fee tester)

1. Scroll to the bottom of **Delivery & payments → Delivery charges**.
2. Pick a **City** and type a **Cart total (Rs)**.
3. It shows the **fee**, the **zone** it matched, and the **delivery time** – using what's on screen, even before you save.
4. Try at least: Karachi below and above the free amount, a major city, a small town, and a city you didn't list.
5. The tester does **not** add the COD handling fee – remember to add it in your head for COD orders.
6. Finally place a real test order on staging to see the same numbers at checkout.

## 4. Payment methods

**Delivery & payments → Payment methods**. Each method has **Offer …** (on/off) and **Note at checkout**.

**Cash on Delivery**
- **COD handling fee (Rs)** – added to COD orders (0 = none).
- **Max COD order (Rs)** – above this, COD isn't offered (empty = no limit).
- **Ask advance above (Rs)** and **Advance amount (Rs)** – for big COD orders the customer pays a part first (e.g. Rs 5,000 above Rs 100,000) by JazzCash / EasyPaisa / bank and uploads a screenshot. `Advance amount` 0 = never ask.

**JazzCash / EasyPaisa** – **Account title** and **Mobile account number**.
**Bank transfer** – bank name, account title, account number, **IBAN**.

> ⚠️ Check every number twice. These are printed at checkout, in emails and on invoices. The defaults in the system are examples – replace them with your real accounts.

Card payments are shown as "coming soon" – no card gateway is connected.

## 5. COD rules (fake order protection)

**Settings → Fake order protection**:
1. **Customers must confirm cash-on-delivery orders before we ship** – the customer gets a link and a 6-digit code **by email** (email is required at checkout), plus WhatsApp (`WHATSAPP_TEMPLATE_CONFIRM`) and SMS if those are set up. Unconfirmed orders are cancelled automatically and the customer is told.
   - Until email (or WhatsApp / SMS) is set up, orders are **not** held for confirmation – real orders are never auto-cancelled because a message couldn't be sent. Staff confirm by phone instead.
   - After 5 wrong codes the order's code stops working – the customer must contact you.
2. **Only orders of at least (Rs)** – e.g. confirm only orders above Rs 20,000.
3. **Cancel if not confirmed within (hours)** – default 24.
4. **Only for these delivery zones** – e.g. only "Rest of Pakistan".
5. **Skip confirmation when the customer paid an advance** – an advance that is still waiting for your check never gets the order auto-cancelled.
6. **Risk points** – how much a past cancellation / refusal / delivery counts, and the levels for "Some risk" and "High risk".
7. **Advance required** for high-risk (and optionally medium-risk) customers.
8. **Cities that must pay an advance** – for cities with many refused parcels (see **Orders → Refused parcels (RTO)**).

**Orders → Blocked numbers**: phones that can't order, or can order only with an advance. Ticking **Blocked** on a customer also stops checkout with that customer's phone or email, even as a guest.

## 6. Advance payments – daily check

See [ORDERS.md](ORDERS.md) → "Check a payment screenshot". Always check the money arrived in your account before approving. Rejecting an advance clears it automatically – the rider then collects the full amount.

**Free delivery and coupon minimums** are judged on the cart total **before** the coupon discount (policy). Say so in your coupon wording if it matters.

## 7. Checklist after any change

- [ ] Fee tester: 4–5 cities, below and above free delivery.
- [ ] **Shipping policy** page on the website shows the new zones.
- [ ] Checkout on staging: fee shown = fee on the order in `/cms`.
- [ ] COD fee and advance appear when expected.
