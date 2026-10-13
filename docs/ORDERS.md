# Orders – daily handling

Everything is under **Orders** in the `/cms` sidebar. The number next to **Orders** shows how many are waiting for you. The **bell** (top right) lists everything that needs attention.

---

## 0. Your daily routine (10 minutes, morning and afternoon)

1. Open **Home** → look at the **To do** tiles.
2. **Orders → To confirm** – confirm or cancel each (section 1).
3. **Orders → Payment to check** – check screenshots (section 2).
4. **Orders → To ship** – pack and book couriers (section 3).
5. **Orders → On the way** – update deliveries (section 3).
6. Check **Customers → Messages** and **Returns**.

## Order statuses

| Status (as shown) | Meaning |
|---|---|
| **Waiting for customer to confirm** | COD order; the customer was sent a link/code to confirm. |
| **To confirm** | New order – you need to check and confirm it. |
| **To ship (confirmed)** | Confirmed – pack and send. |
| **Shipped** | Handed to the courier. |
| **Out for delivery** | Rider has it today. |
| **Delivered** | Done. |
| **Cancelled** | Stock went back automatically. |
| **Refused by customer (RTO)** | Customer refused the parcel; stock goes back. |
| **Returned** | Came back through a return request. |

## 1. Confirm an order

1. **Orders → To confirm** → open the order.
2. Check the **Risk** badge (Low / Some risk / High risk) and the customer card (past orders, refusals).
3. Call or WhatsApp the customer if anything looks wrong (buttons **Call** / **WhatsApp** on the customer card).
4. Click **Confirm order**. The customer is told automatically (if messages are switched on).
5. Fake order? Click **Cancel order** (stock goes back) and optionally **Block this number** – choose *block completely* or *allow only with advance payment*.

**Cash-on-delivery confirmation by the customer** (if switched on in **Settings → Fake order protection**):
- The order starts as **Waiting for customer to confirm**. The customer gets a link + 6-digit code.
- If they confirm, it moves to **To confirm** / **To ship** by itself.
- Buttons: **Send link on WhatsApp** (opens WhatsApp with the link), **Resend automatically**, or **Customer confirmed (by phone)** if they told you on a call.
- Orders not confirmed in time are **cancelled automatically** and stock goes back.

## 2. Check a payment screenshot (JazzCash / EasyPaisa / bank / advance)

1. **Orders → Payment to check** → open the order.
2. In the **payment** box click **See screenshot**.
3. Open your JazzCash / EasyPaisa / bank app and check the money **really arrived**: amount, sender, transaction ID, date. **Never approve from the screenshot alone** – screenshots can be edited.
4. Correct → **Approve**. JazzCash / EasyPaisa / bank orders become **Paid**. COD orders with an advance become **Advance paid** and are confirmed; the rider collects the rest – shown as "Rider collects Rs X".
5. Not received / wrong → **Reject** and type the reason. **The customer is not told automatically** – call or WhatsApp them.
6. Rejecting an advance clears it: the rider collects the **full** amount again. An advance only lowers what the rider collects once you **approve** it.
7. **The payment gate:** a JazzCash / EasyPaisa / bank order **can't be confirmed or shipped** until its payment is **Paid** – the buttons say so, and saving is refused. If the customer wants cash on delivery instead, change the order's payment method to COD first. Packing slips of unpaid online orders print **"PAYMENT NOT VERIFIED – DO NOT SHIP"**.

## 3. Courier and tracking

1. **Orders → To ship** → open the order → **Packing slip** (print and put in the parcel) and **Print invoice** if needed.
2. Book the parcel on your courier's website / app (TCS, Leopards, M&P, Trax, PostEx, Call Courier, BlueEx…). For COD, enter the **amount the rider collects** shown on the order.
3. Back in the order click **Mark as shipped** → choose the **courier** → type the **tracking number** → **Save & mark as shipped**. The customer gets the tracking link.
4. When the rider has it: **Out for delivery**. When delivered (check the courier portal): **Mark as delivered**.
5. Parcel refused: **Refused (RTO)**. Stock (and serial units) go back in stock. See **Orders → Refused parcels (RTO)** for refusal rates by city and courier.

## 4. Cancel an order

1. Open the order → **Cancel order** → confirm.
2. Stock goes back automatically and the customer is told.
3. If they paid in advance, refund them yourself and add a **note** on the order timeline ("Refunded Rs 5,000 by JazzCash, TID …").

## 5. Returns and warranty

**Returns** (**Orders → Returns**):
1. Customers request returns on the website (with photos), or you create one.
2. Open it → **Approve return** or **Reject**.
3. When the item arrives: **Item received** → check it → **Inspection done**.
4. Finish with **Refund** (choose method: cash, bank, JazzCash, EasyPaisa, store credit), **Replaced** or **Repaired**. Tick **Put the items back in stock** if it's sellable. (A return you create already marked Refunded / Replaced is handled the same way.)
5. A refund creates a **credit note** (CN-…) you can print. When **everything** came back, the order becomes **Returned**; a partial return keeps it Delivered with a note. Stock is never put back twice – not when the order is later set to Returned / Cancelled.
6. Laptops come back **one line per serial number**, and a serial only goes back in stock if it really belongs to that order or receipt.

**Warranty claims** (**Orders → Warranty claims**):
1. Enter the serial number or order number – the system checks if it's still under warranty.
2. Move it along with the buttons at the top: **Item received → Start repair → Repaired / Replaced → Given back to customer**, or **Not covered**. Write **What we did**.

## 6. Manual orders (WhatsApp / phone customers)

1. **+ Add → Create order** (top bar), or **Orders → All orders → Create new**.
2. Fill the customer (name, phone, city, address), add items and quantities, delivery charge, payment method.
3. Save. Stock is taken automatically. Then handle it like any other order.
4. Write "WhatsApp order" in the **notes** so you know where it came from (there's no separate "source" field).

> Easier for many WhatsApp customers: send them the product link and let them check out themselves – fees and stock are then calculated for you.

## 7. Walk-in customers (shop counter / POS)

1. **Shop counter → Sell** (press **F2** to search).
2. Scan the barcode / serial, or search. Adjust price or discount if allowed.
3. Choose payment: Cash, Card, Bank, JazzCash, EasyPaisa – or **+ Split payment**.
4. **Complete sale** → **Print receipt**.
5. Mistake? A manager can **Void** the sale (stock goes back) – but only on the **same day before the cash-up**, and only if **nothing from it was returned**. After that, record a **return / refund** instead (Orders → Returns, with the receipt number), so closed days and returns stay correct.
6. End of day: **Shop counter → Cash-ups** → enter opening cash and counted cash → **Save cash-up**. Cash refunds paid out that day (returns refunded in cash) are already taken off the expected cash.

## 8. Print invoices and packing slips

Open the order → **Print invoice** or **Packing slip** → use your browser's print (Ctrl + P). Credit notes print from the return. POS receipts print from the sale.

## 9. Find anything quickly

Press **Ctrl + K** (or **/**) and type an order number, phone number, customer name, product or SKU.

## 10. Customers and their accounts

**Customers → All customers** lists everyone who ordered on the website, not only people who signed up:

- Every website order needs an **email** (the receipt and, for cash on delivery, the confirmation link and code are emailed). The order is attached to the customer with that email; if there is none yet, a customer record is created automatically. For privacy it is never attached to an account whose owner hasn't confirmed that email (anyone can sign up with someone else's address).
- **Has an account** (column and sidebar tick): *off* means the customer ordered as a guest and has no password yet. *On* means they signed up, or set a password with the emailed link.
- Right after ordering, the thank-you page offers **"Create my account"** (like Shopify): one click emails a link to choose a password – no form to fill.
- When a guest later signs up with the same email, the website emails them a **"set your password"** link instead – opening it proves the mailbox is theirs and turns the record (with its order history) into their account.
- Customers who sign up must **confirm their email** before they can check out with their account (the checkout page shows a "send the link again" button). They can still check out as a guest meanwhile.
- A customer's orders are listed at the bottom of their record (**Customer profile → Orders**).
- Tick **Blocked** on a customer to stop orders with their phone or email.
- Customers see each order under **My account → Orders → View**: items, delivery progress, courier tracking, payment, **Download invoice (PDF)** and **Buy again** (puts the same items in the cart at today's price). Guests can download the invoice from the order-confirmation page on the device they ordered from.
