# Deployment guide – how the website runs and how to update it

This guide is for the shop owner. You don't need to write code; you need access to **Railway** (where the site runs), **Cloudflare** (your domain), and **GitHub** (where the code lives).

---

## 1. How the pieces fit together

| Piece | What it does | Where you manage it |
|---|---|---|
| **Web service** (Railway) | The website and the admin (`/cms`). Rebuilt automatically when new code is pushed to GitHub. | Railway → your project → web service |
| **Postgres** (Railway) | The database: products, orders, customers, settings. | Railway → Postgres service |
| **Storage bucket** (Railway) | Photos, payment screenshots, and the nightly backups. **Private** – the website shows photos through its own `/media/…` address. | Railway → Bucket |
| **Backup service** (Railway cron) | Copies the whole database into the bucket every night at 02:00 (Pakistan time). | Railway → backup service |
| **Uptime monitor** (Railway, optional) | Checks the site every minute and emails / texts you if it's down. | Railway → uptime service |
| **Cloudflare** | Your domain name, HTTPS, and caching of photos. | Cloudflare dashboard |

When you (or your developer) **push to the `master` branch on GitHub**, Railway builds a new version, checks it is healthy, and only then switches visitors to it. If the new version is not healthy, the old one keeps running.

---

## 2. Environment variables (settings Railway keeps for the site)

Set these in **Railway → web service → Variables**. Never share their values in chat, email or screenshots. Changing a variable restarts the site.

### Must have (production)
| Name | What it is for |
|---|---|
| `DATABASE_URL` | Connection to the Railway Postgres database (use Railway's "reference variable"). |
| `DATABASE_BUILD_URL` | The *public* database address (`${{Postgres.DATABASE_PUBLIC_URL}}`). While building, the new version applies its database changes and prepares pages with your real products. **Required:** without it (or without `PAYLOAD_SECRET`) the build stops – it never builds pages from demo data. |
| `NEXT_PUBLIC_SITE_URL` | Your real web address, e.g. `https://www.urkotechstore.com`. Used for links in emails, Google, and the admin. ⚠️ Variables starting with `NEXT_PUBLIC_` are built into the site – after changing one, **redeploy** and check `/robots.txt` shows the new address. |
| `PAYLOAD_SECRET` | Secret for admin logins and 2-step codes. **Never change it after launch** (everyone's 2-step setup would stop working). Also used by the build (together with `DATABASE_BUILD_URL`). |
| `AUTH_SECRET` | Secret for customer account logins and the order-confirmation cookie. |

If `DATABASE_URL`, `PAYLOAD_SECRET`, `AUTH_SECRET` or the `S3_*` bucket variables are missing, the new version **refuses to start** (the log says which one). Railway then keeps the previous version running. The site never falls back to "demo mode": no orders kept in memory, no photos or payment screenshots saved on the server's own disk (both would be lost on the next deploy).
| `AUTH_TRUST_HOST` | Set to `true` (the site runs behind Railway / Cloudflare). |
| `S3_ENDPOINT`, `S3_BUCKET`, `S3_ACCESS_KEY_ID`, `S3_SECRET_ACCESS_KEY` | The private storage bucket for photos, screenshots and backups. |
| `S3_REGION` | Usually `auto`. |

### Email (one of the two)
| Name | What it is for |
|---|---|
| `SMTP_HOST`, `SMTP_PORT`, `SMTP_USER`, `SMTP_PASS`, `SMTP_SECURE` | Send email through your mailbox (Gmail / Google Workspace, Zoho, Hostinger…). Used first if set. |
| `RESEND_API_KEY` | Send email through Resend instead. |
| `EMAIL_FROM` | The sender customers see, e.g. `Urko Tech Store <info@urkotechstore.com>`. |
| `ADMIN_ALERT_EMAIL` | Inbox for new-order alerts if none is set in **Settings → Notifications**. |

### Optional
| Name | What it is for |
|---|---|
| `WHATSAPP_TOKEN`, `WHATSAPP_PHONE_NUMBER_ID`, `WHATSAPP_TEMPLATE_ORDER`, `WHATSAPP_TEMPLATE_STATUS`, `WHATSAPP_TEMPLATE_CONFIRM`, `WHATSAPP_TEMPLATE_ORDER_LOOKUP`, `WHATSAPP_TEMPLATE_CART`, `WHATSAPP_TEMPLATE_BACK_IN_STOCK`, `WHATSAPP_TEMPLATE_PRICE_DROP`, `WHATSAPP_TEMPLATE_LANG` | Automatic WhatsApp messages (WhatsApp Cloud API). |
| `SMS_WEBHOOK_URL` | SMS gateway for order messages. |
| `NEXT_PUBLIC_TURNSTILE_SITE_KEY`, `TURNSTILE_SECRET_KEY` | Cloudflare "are you human" check on checkout and forms. Set **both**, then **redeploy** (the site key is built into the pages). With only one of them the check is skipped and `/api/health` shows a warning. |
| `SENTRY_DSN`, `NEXT_PUBLIC_SENTRY_DSN`, `SENTRY_ENVIRONMENT`, `NEXT_PUBLIC_SENTRY_ENVIRONMENT` | Error alerts (Sentry): `SENTRY_DSN` for the server, `NEXT_PUBLIC_SENTRY_DSN` for visitors' browsers (redeploy after setting it). |
| `CLIENT_IP_HEADER` | Only if Cloudflare's orange cloud (proxy) is on: set to `cf-connecting-ip`, so limits like "5 orders per 10 minutes" count real visitors, not Cloudflare. Leave unset otherwise. |
| `NEXT_PUBLIC_GA_ID`, `NEXT_PUBLIC_META_PIXEL_ID`, `NEXT_PUBLIC_GOOGLE_SITE_VERIFICATION` … | Fallbacks only – normally set these in **Settings → Google & SEO** instead. |
| `CRON_SECRET` | Lets an outside scheduler run the background jobs. Not needed – the site runs them itself. |
| `HOUSEKEEPING`, `HOUSEKEEPING_MINUTES` | Background jobs (auto-cancel unconfirmed orders, reminders). Leave unset. With several copies of the site only one runs them at a time (database lock); `HOUSEKEEPING=off` turns them off on a copy completely. |
| `TWO_FACTOR_REQUIRED` | Leave unset. `false` turns off forced 2-step verification – emergencies only. |
| `PAYLOAD_CSRF_ORIGINS`, `DB_POOL_MAX`, `SKIP_MIGRATIONS` | Advanced – leave unset. |

### Staging only
| Name | What it is for |
|---|---|
| `STAGING` | `true` on the test copy: password-protects the whole site, hides it from Google, and stops all customer messages. |
| `STAGING_USER`, `STAGING_PASSWORD` | The username / password for the test copy. |

### Backup service
- `DATABASE_URL` and the website's `S3_*` variables (to read the photos).
- `BACKUP_S3_ENDPOINT`, `BACKUP_S3_BUCKET`, `BACKUP_S3_ACCESS_KEY_ID`, `BACKUP_S3_SECRET_ACCESS_KEY` – a **separate** bucket for the backups (recommended – see [BACKUP-RESTORE.md](BACKUP-RESTORE.md)).
- `ALERT_EMAILS` with `SMTP_*` or `RESEND_API_KEY` (and `ALERT_FROM`), and/or `ALERT_WEBHOOK_URL` – who is told when a backup fails.
- `PG_MAJOR` – your Postgres major version (default `17`; must match Railway's Postgres).
- Optional: `BACKUP_RETENTION_DAYS` (default 30), `BACKUP_PREFIX` (default `backups`), `BACKUP_MEDIA=false` (skip the weekly photo copy), `BACKUP_MEDIA_DAILY=true` (copy photos every night).

### Uptime service
`SITE_URL`, `ALERT_EMAILS`, `ALERT_FROM`, `ALERT_PHONES`, `SMS_WEBHOOK_URL`, and for email either `SMTP_HOST`, `SMTP_PORT`, `SMTP_USER`, `SMTP_PASS` or `RESEND_API_KEY`. Its log warns at start-up if no alert channel is set.

---

## 3. Deploying an update

1. Make sure the change was tested on **staging** first (section 6).
2. Your developer pushes the change to the `master` branch on GitHub.
3. Open **Railway → web service → Deployments**. A new deployment appears: *Building* → *Deploying* → *Active*. This usually takes 5–10 minutes.
4. When it says **Active**, check the site (section 5).
5. If the deployment shows **Failed**, nothing changed for customers – the previous version is still running. Send the build log to your developer.

> Tip: deploy in quiet hours (early morning). Avoid deploying during a sale.

---

## 4. Database changes ("migrations")

Some updates change the database (for example, adding a new field). You don't run anything by hand:

1. **Before** pushing an update that includes a database change, make a fresh backup (see [BACKUP-RESTORE.md](BACKUP-RESTORE.md) → "Make a backup right now"). Your developer should tell you when an update contains one.
2. Push the update. While Railway **builds** the new version it applies the database changes (`payload migrate`, using `DATABASE_BUILD_URL`), then prepares the pages. Changes only ever *add* things, so the old version keeps working until the new one replaces it. Anything still pending is applied when the new version starts.
3. If a change fails, the **build fails**: Railway keeps the old version running and you'll see the failure in **Deployments**. Send the log to your developer.

The command `npm run cms:migrate` does **not** work inside the live server (the tools aren't installed there) – and it isn't needed.

---

## 5. Checking the site is healthy

1. Open `https://<your-site>/api/health`. You should see `{"ok":true,"db":"up","cms":"up"}`. A `warnings` list means a setting needs attention (for example the site address is still a placeholder, or no email provider is set) – the same warnings appear on the `/cms` Home screen for owners and managers.
   - `db: down` → the database is unreachable. Check the Postgres service in Railway.
   - `cms: down` → the admin system couldn't start (often a failed database change or a missing `PAYLOAD_SECRET`). Check **Deployments → logs**.
2. Open the home page, a product page, and add something to the cart.
3. Sign in to `/cms` and open **Orders**.
4. (Optional, technical) In **Railway → web service → ⋯ → Console**, run `node smoke-test.mjs http://localhost:$PORT`. It runs about 38 automatic checks and prints how many passed.

If you set up the **uptime monitor**, you'll also get an email / SMS within ~2 minutes of the site going down.

---

## 6. Rolling back (undoing an update that broke something)

**Code problem (most common):**
1. Railway → web service → **Deployments**.
2. Find the last deployment that worked (before the problem started).
3. Click **⋯ → Redeploy**. In a few minutes the old version is live again.
4. Tell your developer what broke so they can fix it before pushing again.

**Data problem** (orders or products deleted or damaged): follow [BACKUP-RESTORE.md](BACKUP-RESTORE.md). Restoring the database replaces everything since the backup was taken, so first write down any orders that came in since then.

> A rollback of the code does **not** undo database changes. That is usually fine (new columns are simply ignored by the older version). If your developer says an update's database change must be reverted, they will handle it.

---

## 7. Cloudflare settings (one-time)

1. **DNS:** `www` and the root domain point to Railway (CNAME), **Proxied** (orange cloud).
2. **SSL/TLS:** mode **Full (strict)**; turn on **Always Use HTTPS**.
3. **Caching → Cache Rules:** cache only addresses starting with `/media/` and `/_next/static/`. **Never** cache pages, `/api`, `/cms` or `/cms-api`.
4. **Speed:** turn **Rocket Loader off**.
5. **Rules → Redirect:** send the root domain to `www` (or the other way – pick one and keep it).
6. After a big change (like the cutover), **Caching → Configuration → Purge Everything**.

---

## 8. Staging (the test copy)

Staging is a second Railway environment that runs the same code with its own database and bucket. It is password-protected, hidden from Google, and **never sends messages to customers**.

Use it to try updates and to place test orders (see the test plan in [REPORT.md](REPORT.md)).

To set it up: in Railway, **Environments → New environment → "staging"** (duplicate production), then on the staging web service set `STAGING=true`, `STAGING_PASSWORD=<a password>`, and a staging `NEXT_PUBLIC_SITE_URL`. Give it its own Postgres and bucket — never point staging at the production database.

---

## 9. Going live: staging → production cutover

Do this once, at a quiet time (for example 3–4 am). Allow about 30 minutes. Your developer should be available.

1. **Freeze:** tell staff not to change products or settings during the cutover. Note the time.
2. **Backup:** make a fresh backup of the production database ([BACKUP-RESTORE.md](BACKUP-RESTORE.md)).
3. **Variables:** check every "Must have" variable in section 2 is set on the **production** web service, with the real `NEXT_PUBLIC_SITE_URL`. `STAGING` must **not** be set on production.
4. **Deploy** the tested version to production (push to `master`, or "Redeploy" the tested build).
5. **Wait** for **Active**, then open `/api/health` (section 5).
6. **Data:** if old data must be copied into the new admin, your developer runs `node migrate-data.mjs` in the Railway console and checks it ends with "All checks passed".
7. **Check:** sign in to `/cms` (set up 2-step verification when asked), open a few products and orders, and place **one real COD test order**, then cancel it in **Orders**.
8. **Cloudflare:** purge the cache (section 7, step 6).
9. **Google:** in Search Console, submit `https://<your-site>/sitemap.xml`.
10. Tell staff they can work normally again.

If anything in steps 5–7 fails and can't be fixed quickly, **roll back** (section 6) and try again another day.
