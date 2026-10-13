# Monthly maintenance checklist

About **1 hour, once a month** (first Monday is a good habit). Tick each item. Anything marked 🧑‍💻 is for your developer.

---

## Weekly (5 minutes)

- [ ] **Backups ran** every night this week – Railway → backup service → recent runs all successful ([BACKUP-RESTORE.md](BACKUP-RESTORE.md) → section 1).
- [ ] `/cms` **Home** → **To do** tiles are not piling up (old orders "to confirm", payments to check).
- [ ] **Orders → Refused parcels (RTO)** – any city or courier getting worse?

## Monthly

### 1. Site health (10 min)
- [ ] Open `https://<your-site>/api/health` → `"ok":true`.
- [ ] Place a **test order** on staging (COD) and cancel it. Check the emails/WhatsApp arrived.
- [ ] On your phone: home page, a category, a product, cart, checkout page – all look right.
- [ ] **Uptime alerts**: any "site down" emails/SMS this month? If yes, ask 🧑‍💻 why.

### 2. Errors (5 min)
- [ ] If Sentry is connected: open Sentry → **Issues** for the last 30 days. Anything new or happening often → send to 🧑‍💻.
- [ ] Otherwise ask 🧑‍💻 to glance at Railway → web service → **Logs** for errors.

### 3. Google Search Console (10 min)
- [ ] **Pages** report: "Not indexed" count not jumping up. Any **404** for products you still sell?
- [ ] **Performance**: clicks and impressions trend; note top search terms – use them in product titles.
- [ ] **Core Web Vitals**: mobile "Poor" URLs = 0 ideally.
- [ ] **Merchant Center** (if used): any disapproved products? (Feed: **Settings → Sales channels**.)

### 4. Speed check – Lighthouse (10 min)
1. Open Chrome → your home page → right-click → **Inspect** → **Lighthouse** tab.
2. Choose **Mobile**, tick Performance, Accessibility, Best practices, SEO → **Analyze page load**.
3. Do the same for one **category** page and one **product** page.
- [ ] Performance ≥ 70 on mobile, others ≥ 90. Write the numbers down each month; a big drop usually means a huge photo or a new script (ask 🧑‍💻).

### 5. Store content (15 min)
- [ ] **Products → Inventory**: restock or hide out-of-stock items.
- [ ] **Products → All products → Drafts**: finish or delete old drafts.
- [ ] Products missing photos/details (Home → To do).
- [ ] **Marketing → Reviews** and **Products → Questions**: approve / answer.
- [ ] **Online store → Announcement bar** and home page banners: remove expired offers.
- [ ] **Marketing → Discount codes** / **Flash sales**: delete expired ones.
- [ ] Policy pages still correct (prices, delivery times, warranty).

### 6. Security (5 min)
- [ ] **Settings → Staff**: everyone listed still works for you; roles are right.
- [ ] Everyone with Owner/Manager has 2-step on.
- [ ] **Delivery & payments → Payment methods**: account numbers are still yours.

### 7. Updates 🧑‍💻 (monthly, on staging first)
- [ ] `npm audit` – fix security updates.
- [ ] Update Payload, Next.js and other packages (minor versions) → test on staging → then production.
- [ ] Check Railway / Postgres / Node versions for end-of-life notices.

## Every 3 months
- [ ] 🧑‍💻 **Practise a restore** into a test database ([BACKUP-RESTORE.md](BACKUP-RESTORE.md) → section 4).
- [ ] Change shared passwords (courier portals, shop email) if staff changed.
- [ ] Download a **Settings backup** (Home screen → Settings backup → **Download settings**).
- [ ] Review delivery fees against your courier costs (**Delivery & payments → Delivery charges** + fee tester).

## Every year
- [ ] Renew the **domain** (registrar) – set auto-renew.
- [ ] Review privacy policy, terms, returns policy (lawyer if laws changed).
- [ ] Check WhatsApp Business templates still approved.

## One-off: correct ratings and "sold" numbers (after the October 2026 update)

Older products carry demo ratings, review counts and "sold" numbers from the seed catalog. Since this update the shop only **shows** stars from approved reviews, but the stored numbers should still be corrected once. Your developer does this from their computer (it is not part of the live server):

1. Make a backup ([BACKUP-RESTORE.md](BACKUP-RESTORE.md) → "Make a backup right now").
2. With `DATABASE_URL` set to the Postgres service's **public** address and the production `PAYLOAD_SECRET`:
   `npm run stats:recompute` – only **reports** what would change.
3. If the report looks right: `npm run stats:recompute -- --apply`.

Ratings and review counts are rebuilt from approved reviews; sold counts from delivered website orders and completed shop-counter sales.

## One-off: give older orders their customers (after the October 2026 update)

Orders placed before this update aren't attached to a customer, so **Customers → All customers** only shows people who signed up. Your developer runs this once, the same way as the stats correction above:

1. Make a backup.
2. `npm run customers:link` – only **reports** how many orders would be attached to existing customers and how many new "no account yet" customer records would be created.
3. If it looks right: `npm run customers:link -- --apply`.

For privacy, an order is only attached to an account whose owner has confirmed that email. Orders without an email, or with the email of an account that never confirmed it, are left alone (they are still under **Orders**). Orders that already have a customer are never changed.
