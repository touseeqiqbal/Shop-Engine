# Security – staff accounts, passwords and what to do if something goes wrong

---

## 1. Roles – who can do what

| Role | Can | Can't |
|---|---|---|
| **Owner** | Everything. Sees **cost prices and profit**. Changes roles. Restores settings backups. | – |
| **Manager** | Orders, products, customers, all settings, staff accounts, deleting, voiding shop sales, correcting stock counts, customer data requests. | See cost/profit, change roles. |
| **Staff** | Products, orders, customers, shop counter. Edit announcement bar, WhatsApp button, page texts, testimonials, FAQs. | Delete core data, change other settings, see cost prices, see the staff list. |
| **Customer** | Only their own account on the website. | Open `/cms`. |

**Give everyone the lowest role that lets them do their job.** Most shop staff should be **Staff**. Keep **one Owner** (you).

## 2. Add a staff member

1. **Settings → Staff → Create new**.
2. Their own email (never a shared one), name, a **temporary password of at least 10 characters**, and the **role**.
3. Save. Give them the password in person; ask them to change it at first login.
4. Managers must turn on 2-step verification at first login (section 4). Ask staff to turn it on too.

## 3. Passwords

- At least **12 characters**; a short sentence is good ("Blue laptop on Saddar road!"). Staff accounts need at least 10.
- **Never reuse** a password from email, Facebook or banking.
- Use a password manager (Google Password Manager, Bitwarden).
- Never send passwords by WhatsApp. Never share one account between people.
- After **10 wrong passwords** an account is **locked for 15 minutes**.
- Forgot password: on the `/cms` login page click **Forgot password?** (needs email to be set up).

## 4. 2-step verification (2FA)

Owners and managers **must** use it; staff can.

**Turn it on:**
1. **Settings → My security (2-step)** → **Set up 2-step verification**.
2. Install **Google Authenticator** or **Microsoft Authenticator** on your phone.
3. Scan the QR code (or type the setup key) → type the 6-digit code → **Turn on**.
4. You get **8 backup codes**. **Print them or write them down** and keep them somewhere safe at home. Each works once if you lose your phone.

**New phone (or new backup codes):** **Settings → My security (2-step)** → type a code from your current app (or a backup code) → **Move to a new phone** → scan the new QR code with the NEW phone → type its code → **Switch to this phone**. The old phone keeps working until you finish. **Get new backup codes** works the same way (the old codes stop working).

**Lost phone:**
- Sign in with one of your **backup codes** instead of the 6-digit code, then use **Move to a new phone**.
- A staff member or manager who lost their phone: the **Owner** opens their user (**Settings → Staff** → the person) → sidebar → **Reset (lost phone)**. They set it up again at next login.
- The Owner can't reset their own 2-step this way – **keep your backup codes safe**. As a last resort your developer can help using the Railway settings.

## 5. When someone leaves

Same day:
1. **Settings → Staff** → open the person → **Delete** (Manager/Owner). Or, as Owner, change their **role** to **Customer** – they can no longer open `/cms`.
2. If they knew any shared passwords (Railway, Cloudflare, courier portals, JazzCash, email) – **change those too**.
3. If they had access to Railway or GitHub, remove them there.

## 6. If an account is compromised (or you suspect it)

Signs: orders or prices you didn't change, a staff member you didn't add, payment numbers changed, emails about password resets you didn't ask for.

Do this **immediately**, in order:
1. **Check the payment numbers**: **Delivery & payments → Payment methods** – JazzCash, EasyPaisa and bank details. Fix them if changed. *(This is what attackers usually change.)*
2. **Lock out the account**: as Owner/Manager open **Settings → Staff** → the account → change its password to a long random one, or delete it. If it's **your** account and you can still sign in, change your password now.
3. **Check staff list**: **Settings → Staff** – delete anyone you don't recognise; check nobody's role was raised.
4. **Turn 2-step on** for the affected account (or reset it if the attacker set it up).
5. **Look at recent changes**: product versions (open a product → **Versions**), recent orders, **Settings → Store details**, **Settings → Notifications** (alert emails), **Settings → Redirects**.
6. **Tell your developer** – they can check the server logs (logins, 2-step events and order changes are logged there) and, if needed, change `PAYLOAD_SECRET` to sign everyone out (this also resets everyone's 2-step setup).
7. If customer data may have been seen, take advice on informing customers.
8. If data was damaged, restore from backup ([BACKUP-RESTORE.md](BACKUP-RESTORE.md)).

## 7. The other keys to your shop

Protect these as carefully as `/cms` – use 2-step on all of them:
- **Railway** (the server, database and all secret keys)
- **Cloudflare** (your domain)
- **GitHub** (the code)
- **Your email account** (password resets go there)
- **Domain registrar**, **Google** (Analytics / Search Console / Merchant Center), **Meta** (WhatsApp Business)

Never paste Railway variable values (keys, passwords) into chats, tickets or screenshots.

## 8. Customer data

- Customer data requests (copy or delete someone's data): **Settings → Customer data requests** – find by phone or email, export, or erase (type DELETE to confirm). Owner / Manager only.
- Payment screenshots are private: only staff can open them, through the order.
- Don't download customer lists to personal devices unless needed; delete exports when done.

See [REPORT.md](REPORT.md) → Part 2 for the technical security review and the fixes still to do.

## 9. Who did what – Activity log

**Reports → Activity log** (owners and managers) lists every change made in `/cms`: who, when, and old → new values – prices, stock, orders and payments, discounts, customers' accounts and roles, settings pages. Filter by person or by record. Passwords and 2-step secrets are never recorded; cost prices are shown to owners only. Entries are kept for 2 years and can't be edited or deleted.

Owners and managers who haven't turned on 2-step can't open invoices, packing slips, labels, payment screenshots or other private files either.
