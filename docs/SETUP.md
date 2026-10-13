# First-time store setup

Do these steps in order. Everything is in the admin at **`https://<your-site>/cms`**. Menu names below are exactly what you see in the left sidebar.

The **Home** screen has a **"Finish setting up your store"** checklist that ticks itself off as you go.

> Who can do what: most settings need an **Owner** or **Manager** account. Staff accounts can't open them.

---

## 1. Sign in and secure your account

1. Open `/cms`. On an empty store, the **first account created becomes the Owner**.
2. You'll be asked to turn on **2-step verification**. Follow the steps (see [SECURITY.md](SECURITY.md)) and **save the 8 backup codes** somewhere safe (printed, in a drawer).

## 2. Store details

1. **Settings → Store details**.
2. Fill in the shop name, phone numbers (WhatsApp numbers too), email, full address, opening hours and social links.
3. Click **Save**. These details appear in the header/footer, on the contact page, in emails, and in Google's business information.

## 3. Logo and theme

1. **Online store → Theme**.
2. Tab **Logo & icons**: upload the logo for dark and light backgrounds and the small browser icon (favicon). Adjust **logo height** if needed.
3. Tab **Colours**: background colours, accent colour, and the three gradient colours (use hex codes like `#6366F1`).
4. Tab **Typography & buttons**: pick a font and button style.
5. Tab **Colour mode**: choose dark or light as default, and whether visitors may switch.
6. Click **Save**, then open your store in a new tab to check.

## 4. Menus

1. **Online store → Menus** → **Create new**. Give it a name and a handle (e.g. `main`).
2. Add items: label + link (e.g. `/category/laptops`). Items can have sub-items. Tick **"Show as mega menu (desktop)"** for big dropdowns.
3. Save. Make a second menu for the footer if you like.
4. **Online store → Header**: choose the **main menu** and the **mobile menu**; choose whether to show search and account icons. Save.
5. **Online store → Footer**: write the "about" text, choose up to 4 columns (each a title + menu), payment badges, copyright line. Save.

## 5. Delivery zones and fees

Full details: [DELIVERY-PAYMENTS.md](DELIVERY-PAYMENTS.md).

1. **Delivery & payments → Delivery charges**.
2. Set **Free delivery above (Rs)** and **Charge when no zone matches (Rs)**.
3. Add **Zones** (e.g. "Karachi", "Major cities", "Rest of Pakistan") with cities, charge and delivery time.
4. Use the **fee tester** at the bottom of the page to check a few cities and cart totals. Save.

## 6. Payment methods

1. **Delivery & payments → Payment methods**.
2. **Cash on Delivery**: turn on/off, COD fee, maximum COD order, when to ask for an advance and how much.
3. **JazzCash / EasyPaisa**: your account numbers. **Check these numbers carefully** – customers send money to them.
4. **Bank transfer**: bank name, account title, account number, IBAN. Save.
5. **Settings → Fake order protection**: decide whether COD customers must confirm their order before you ship, and which cities must pay an advance.

## 7. Email

Email is switched on by your developer in Railway (see [DEPLOYMENT.md](DEPLOYMENT.md) → Email). Until then **no emails are sent** (no order confirmations, no password resets).

Then:
1. **Settings → Notifications**.
2. **Send alerts to**: the staff email addresses that should get new-order alerts.
3. Tick which customer messages to send (order confirmation, confirmed, shipped, out for delivery, delivered) and by which channel (email / WhatsApp / SMS). Save.
4. Place a test order with your own email to see the emails arrive (check spam the first time).

## 8. Policy pages

1. **Online store → Page texts**.
2. Click **Add Page**, choose the page in the **Page** list (About us, Shipping policy, Warranty & returns, Privacy policy, Terms & conditions, Installment plans…), and fill in the title, description and **body** (Markdown: `## Heading`, `- bullet`, `**bold**`). Set **Last updated**. Pages you don't add here keep their built-in text.
3. **Settings → Returns & warranty rules**: tab **Returns** (days to ask for a return, restocking fee, return reasons, return rules) and tab **Warranty** (warranty rules and the warranty-by-condition table). These are shown on the Warranty & returns page automatically.
4. The **Shipping policy** page shows your delivery zones automatically.
5. **Have a lawyer read** the privacy policy, terms, and returns policy before launch.

## 9. Staff accounts

1. **Settings → Staff** → **Create new**.
2. Enter email, name, a temporary password (**at least 10 characters**) and **role**:
   - **Owner** – everything, including cost prices and changing roles.
   - **Manager** – everything except cost/profit and roles.
   - **Staff** – products, orders, customers; can't delete or change settings.
3. Save and give them the password in person. Managers must set up 2-step verification at first login.

## 10. Google Analytics, Search Console and Meta

1. **Google Analytics**: create a GA4 property at analytics.google.com → copy the **Measurement ID** (starts with `G-`).
2. **Search Console**: at search.google.com/search-console add your domain → choose **HTML tag** → copy only the code inside `content="…"`.
3. **Settings → Google & SEO** → tab **Verification & analytics**: paste the GA4 ID, the Google verification code, and (optional) the Meta Pixel ID and Facebook verification. Save.
4. Back in Search Console click **Verify**, then **Sitemaps** → add `sitemap.xml`.
5. **Settings → Cookie notice**: keep "Ask visitors before using analytics cookies" on (recommended).
6. **Settings → Google & SEO** → tab **Defaults**: check the default title, description and share image. Make sure **"Hide the whole site from search engines"** is **off** on the live site.

## 11. Before you announce the store

- Add your products ([PRODUCTS.md](PRODUCTS.md)).
- Edit the home page ([STORE-EDITOR.md](STORE-EDITOR.md)).
- Do the test orders in [REPORT.md](REPORT.md) → "Test plan".
