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

When you (or your developer) **push to the `main` branch on GitHub**, Railway builds a new version, checks it is healthy, and only then switches visitors to it. If the new version is not healthy, the old one keeps running.

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
| `EMAIL_FROM` | The sender customers see, e.g. `Urko Tech Store <info@urkotechstore.com>`. Not set → `ShopEngine <no-reply@<site domain>>`, so set it. |
| `ADMIN_ALERT_EMAIL` | Inbox for new-order alerts if none is set in **Settings → Notifications**. |

### Optional
| Name | What it is for |
|---|---|
| `WHATSAPP_TOKEN`, `WHATSAPP_PHONE_NUMBER_ID`, `WHATSAPP_TEMPLATE_ORDER`, `WHATSAPP_TEMPLATE_STATUS`, `WHATSAPP_TEMPLATE_CONFIRM`, `WHATSAPP_TEMPLATE_ORDER_LOOKUP`, `WHATSAPP_TEMPLATE_CART`, `WHATSAPP_TEMPLATE_BACK_IN_STOCK`, `WHATSAPP_TEMPLATE_PRICE_DROP`, `WHATSAPP_TEMPLATE_LANG` | Automatic WhatsApp messages (WhatsApp Cloud API). |
| `SMS_WEBHOOK_URL` | SMS gateway for order messages. |
| `NEXT_PUBLIC_TURNSTILE_SITE_KEY`, `TURNSTILE_SECRET_KEY` | Cloudflare "are you human" check on checkout and forms. Set **both**, then **redeploy** (the site key is built into the pages). With only one of them the check is skipped and `/api/health` shows a warning. |
| `SENTRY_DSN`, `NEXT_PUBLIC_SENTRY_DSN`, `SENTRY_ENVIRONMENT`, `NEXT_PUBLIC_SENTRY_ENVIRONMENT` | Error alerts (Sentry): `SENTRY_DSN` for the server, `NEXT_PUBLIC_SENTRY_DSN` for visitors' browsers (redeploy after setting it). |
| `SENTRY_TRACES_SAMPLE_RATE`, `NEXT_PUBLIC_SENTRY_TRACES_SAMPLE_RATE` | Share of requests Sentry traces for speed (0–1, default 0 = off). The `NEXT_PUBLIC_` one is built in: change it, then redeploy. |
| `SENTRY_AUTH_TOKEN`, `SENTRY_ORG`, `SENTRY_PROJECT` | Readable stack traces in Sentry: with all three set, the build uploads source maps (and removes them from the site). |
| `PLATFORM_ALERT_EMAILS` | Who at ShopEngine hears about failed plan payments and stores closed by their owner (comma-separated). Not set → every platform admin account. |
| `SHOPPER_SESSION_DAYS` | How long shoppers stay signed in on a storefront (1–90 days, default 14). |
| `CLIENT_IP_HEADER` | Only if Cloudflare's orange cloud (proxy) is on **and the site can't be reached any other way**: set to `cf-connecting-ip`, so limits like "5 orders per 10 minutes" count real visitors, not Cloudflare. Remove (or lock down) the public `*.up.railway.app` address first, and note that merchants' own domains pointed straight at Railway are not behind Cloudflare – anyone reaching the site directly can send a made-up `cf-connecting-ip` and get past the sign-in, checkout and 2-step limits. Leave unset otherwise. |
| `NEXT_PUBLIC_GA_ID`, `NEXT_PUBLIC_META_PIXEL_ID`, `NEXT_PUBLIC_GOOGLE_SITE_VERIFICATION` … | Fallbacks only – normally set these in **Settings → Google & SEO** instead. |
| `CRON_SECRET` | Lets an outside scheduler run the background jobs. Not needed – the site runs them itself. |
| `HOUSEKEEPING`, `HOUSEKEEPING_MINUTES` | Background jobs (auto-cancel unconfirmed orders, reminders). Leave unset. `HOUSEKEEPING=off` turns them off on a copy completely. |
| `TWO_FACTOR_REQUIRED` | Leave unset. `false` turns off forced 2-step verification – emergencies only. |
| `PAYLOAD_CSRF_ORIGINS`, `DB_POOL_MAX` | Advanced – leave unset. |
| `SKIP_MIGRATIONS` | `true` = the server does **not** apply pending database changes when it starts (run `npx payload migrate` yourself first). Leave unset. |
| `MIGRATE_DURING_BUILD` | `true` applies database changes during the build (the old way). Default: when the server starts (see §4). |

### Multi-store (ShopEngine)
| Name | What it is for |
|---|---|
| `PLATFORM_ROOT_DOMAIN` | The domain merchants' shops live under, e.g. `shopengine.app` → `myshop.shopengine.app`. Needs a wildcard DNS record and certificate for `*.shopengine.app`. Without it every address shows the original (default) store. |
| `DEFAULT_STORE_NAME`, `DEFAULT_STORE_SLUG`, `DEFAULT_STORE_ORDER_PREFIX` | Only read once, by the first multi-store migration, to name the original shop's store (defaults: the shop's Store details name, `main`, `UTS`). |
| `STRIPE_SECRET_KEY` | Card payments (customers pay each shop's own Stripe account) and ShopEngine's own plan billing. |
| `STRIPE_WEBHOOK_SECRET`, `STRIPE_CONNECT_WEBHOOK_SECRET` | Signing secrets of the two Stripe webhook endpoints, both pointing at `/api/webhooks/stripe` – one for the platform account, one for connected accounts. Orders are only marked paid from these. The connected-accounts endpoint needs the events `checkout.session.completed`, `checkout.session.async_payment_succeeded`, `checkout.session.async_payment_failed`, `checkout.session.expired`, `account.updated` and – so a refund that fails later is noticed – `charge.refund.updated` (or `refund.updated` / `refund.failed`). |
| `PLATFORM_FEE_PERCENT` | Optional commission ShopEngine keeps on each card order (e.g. `1.5`). |
| `BILLING_GRACE_DAYS` | Days a shop stays open after a failed plan payment (default 7). |
| `MAX_STORES_PER_USER` | How many stores one account may own (default 3). |

After setting up Stripe, open `/cms` → Plans and enter each paid plan's Stripe price ids; check the starter plans' prices.

### Integrations signed in with the provider's page
Stores connect most integrations (couriers, their own payment gateways, WhatsApp, SMS, email, pixels) with their own
keys in `/cms` → Integrations – nothing to set here. Four use ShopEngine's own app with the provider instead; each
store then signs in with its own account. Register the redirect URL
`https://<admin address>/cms-api/integration-tools/oauth/callback` with every app. Details: `docs/INTEGRATIONS.md`.

| Name | What it is for |
|---|---|
| `QUICKBOOKS_CLIENT_ID`, `QUICKBOOKS_CLIENT_SECRET` | QuickBooks Online app (developer.intuit.com). `QUICKBOOKS_SANDBOX=true` while using its development keys. |
| `XERO_CLIENT_ID`, `XERO_CLIENT_SECRET` | Xero app (developer.xero.com, granular scopes). Xero charges apps per connected organisation – check its pricing. |
| `DARAZ_APP_KEY`, `DARAZ_APP_SECRET` | Daraz Open Platform app ("ERP System" category so any seller can authorise). |
| `AMAZON_SPAPI_APP_ID`, `AMAZON_LWA_CLIENT_ID`, `AMAZON_LWA_CLIENT_SECRET` | Amazon Selling Partner API – needs a **public developer** registration (Amazon's review takes weeks). `AMAZON_SPAPI_DRAFT=true` while the app is a draft. |
| `INTEGRATIONS_OAUTH_BASE_URL` | Optional: the address registered as the apps' redirect, if it isn't the admin's own address. |

Payment gateways a store connects itself send shoppers back to `https://<store address>/api/integrations/<provider>/<key>/return`
– the store's own domain must be reachable over HTTPS (JazzCash also needs that address registered on the store's account).

### ShopEngine's marketing website
| Name | What it is for |
|---|---|
| `MARKETING_HOSTS` | Comma-separated addresses that show ShopEngine's own website instead of a store, e.g. `shopengine.app,www.shopengine.app`. On these addresses `/`, `/features`, `/pricing` … are the marketing pages, and `/account/*` (merchant sign-up, sign-in, “Your stores”), `/cms` and the APIs keep working under ShopEngine's name. Unset = no marketing site (every address resolves its store as before). Never list the original shop's own domain here. |
| `MARKETING_SITE_URL` | Optional. The one address used in canonical links, the sitemap and structured data, e.g. `https://shopengine.app` (default: `https://` + the first of `MARKETING_HOSTS`). |
| `PLATFORM_CONTACT_EMAIL` | Optional. Where messages from the marketing site's contact form are emailed (they are always saved in `/cms` → Contact messages, with no store – visible to platform admins with no single store selected). Needs an email provider (SMTP or Resend). |

DNS: point the marketing address (apex and/or `www`) at the site like the platform domain. With `PLATFORM_ROOT_DOMAIN=shopengine.app`,
`shopengine.app` can be the marketing site while `myshop.shopengine.app` stays a store. Pages: `src/app/(marketing)/shopengine/*`;
copy: `src/lib/marketing/content.ts`; prices come from the active plans in `/cms` → Plans (refreshed every 5 minutes).
The marketing pages are pre-rendered when the site is built, so set `MARKETING_HOSTS` / `MARKETING_SITE_URL` for the **build**
too (Railway passes service variables to builds), or canonical links will point at the wrong address until the next deploy.

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
2. Your developer pushes the change to the `main` branch on GitHub.
3. Open **Railway → web service → Deployments**. A new deployment appears: *Building* → *Deploying* → *Active*. This usually takes 5–10 minutes.
4. When it says **Active**, check the site (section 5).
5. If the deployment shows **Failed**, nothing changed for customers – the previous version is still running. Send the build log to your developer.

> Tip: deploy in quiet hours (early morning). Avoid deploying during a sale.

---

### Run exactly ONE copy of the web service (for now)

Some things are still kept inside each running copy:
- the page/catalogue cache: a price change saved on one copy reaches the other copies only after up to 5 minutes, so they could charge old prices meanwhile;
- the request limits (sign-in, checkout, 2-step codes): they would multiply by the number of copies;
- and the timers of the hourly and daily jobs.

Database changes also run when a copy starts, with no lock between copies. So keep **Replicas = 1** on the web service until these move to shared storage (audit report 13, OPS-5). One copy with more CPU and memory is fine.

**Build-time variables:** `NEXT_PUBLIC_*`, `STAGING` and `PLATFORM_ROOT_DOMAIN` are built into the site. `PLATFORM_ROOT_DOMAIN` also decides which hosts get the strict HTTPS header (`includeSubDomains; preload`); merchants' own domains get plain HSTS. Changing any of them needs a redeploy.

## 4. Database changes ("migrations")

Some updates change the database (for example, adding a new field). You don't run anything by hand:

1. **Before** pushing an update that includes a database change, make a fresh backup (see [BACKUP-RESTORE.md](BACKUP-RESTORE.md) → "Make a backup right now"). Your developer should tell you when an update contains one.
2. Push the update. Railway **builds** the new version without touching the database, then **starts** it: the new version applies the database changes first (Payload's pending migrations), then answers the health check, and only then does Railway switch visitors over. Changes only ever *add* things (CI checks this), so the old version keeps working meanwhile.
3. If a change fails, the new version **doesn't start**: Railway keeps the old version running and you'll see the failure in **Deployments**. Send the log to your developer.
   - Run several copies of the site? Deploy with one copy first (or set `MIGRATE_DURING_BUILD=true`, which applies the changes during the build instead – the previous behaviour).

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
3. **Caching → Cache Rules:** cache only addresses starting with `/media/`, `/_next/static/` and `/_next/image` (the resized photos – the shop's server makes each size once, keep the query string in the cache key). **Never** cache pages, `/api`, `/cms` or `/cms-api`.
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
4. **Deploy** the tested version to production (push to `main`, or "Redeploy" the tested build).
5. **Wait** for **Active**, then open `/api/health` (section 5).
6. **Data:** if old data must be copied into the new admin, your developer runs `node migrate-data.mjs` in the Railway console and checks it ends with "All checks passed".
7. **Check:** sign in to `/cms` (set up 2-step verification when asked), open a few products and orders, and place **one real COD test order**, then cancel it in **Orders**.
8. **Cloudflare:** purge the cache (section 7, step 6).
9. **Google:** in Search Console, submit `https://<your-site>/sitemap.xml`.
10. Tell staff they can work normally again.

If anything in steps 5–7 fails and can't be fixed quickly, **roll back** (section 6) and try again another day.
