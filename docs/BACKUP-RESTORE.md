# Backups and restore

Your shop has **two kinds of backups** of the database (products, orders, customers, settings):

| Backup | When | Where | Kept for |
|---|---|---|---|
| **Nightly backup** (backup service) | Every night at **02:00 Pakistan time** | The **backup bucket**, folder **`backups/`**, one file per day: `2026-10-05.sql.gz` (`.sql.gz.enc` when encrypted) | 30 days (`BACKUP_RETENTION_DAYS`) |
| **Nightly private uploads** (backup service) | Every night | The backup bucket, folder **`backups-private/`**, one archive per day: payment screenshots, return / warranty / trade-in photos, reviews waiting for approval | 30 days |
| **Weekly photo copy** (backup service) | Sunday nights | The backup bucket, folder **`backups-media/`** (a copy of the website's public photo folders) | Always the latest copy |
| **Railway Postgres backups** | Depends on your Railway plan / settings | Railway → Postgres service → **Backups** tab | Railway's setting |

**The backup bucket** should be a *different* bucket from the website's – ideally in another account (for example a free Cloudflare R2 or Backblaze B2 bucket). Then a leaked website key, or a deleted website bucket, can't take the backups too. Set it on the backup service with `BACKUP_S3_ENDPOINT`, `BACKUP_S3_BUCKET`, `BACKUP_S3_ACCESS_KEY_ID`, `BACKUP_S3_SECRET_ACCESS_KEY`. Without these, backups go to the website's own bucket (works, but less safe).

**Photos** on the website live in its bucket (folder `media/`) and are not touched when you restore the database.

> Settings only: on the `/cms` **Home** screen the Owner also has a **Settings backup** card – **Download settings** saves theme, menus, pages, collections, redirects and settings as a file. Do this before big design changes. It does **not** include products or orders.

---

## 1. Check that backups are running (weekly)

1. Open **Railway → backup service**.
2. Look at the latest run (the **Cron Runs** / **Deployments** list). It should be from last night and **successful**.
3. Open its **logs**. A good run ends with lines like:
   - `[backup] dump size: … bytes` (should grow slowly over time – a sudden drop is a warning sign)
   - `[backup] uploading → s3://…/backups/2026-10-05.sql.gz`
   - `[backup] pruning backups older than …`
4. Optional: in **Railway → Bucket**, open the file browser and check the `backups/` folder has today's file.
5. If the last run **failed** or is missing, tell your developer the same day.

**Missed-night alert (heartbeat).** Create a free check at [healthchecks.io](https://healthchecks.io) (period 1 day, grace 2 hours) and put its ping URL in `BACKUP_HEARTBEAT_URL` on the backup service. Every good backup pings it; when a night is missed – the service stopped, Railway's cron didn't run – healthchecks.io emails / WhatsApps you. A failed run also pings its `/fail` address straight away.

**Encryption.** Set `BACKUP_ENCRYPTION_KEY` on the backup service to a long random passphrase (for example 40+ random characters from a password manager) and the database dump and the private-uploads archive are encrypted before they leave Railway. **Keep the passphrase outside Railway too** (password manager / printed in the safe) – without it the backups can't be restored, and if Railway is the thing that's lost, the copy in Railway is gone with it.

**Failure alerts.** When a backup fails the service emails `ALERT_EMAILS` (through the same `SMTP_*` or `RESEND_API_KEY` settings as the website) and/or posts to `ALERT_WEBHOOK_URL` (an SMS / WhatsApp gateway or a Zapier / Make / n8n webhook). Set at least one, so a failure never goes unnoticed. The weekly check above is still worth doing – an alert can't tell you the service stopped running altogether.

## 2. Make a backup right now (before a risky change)

Pick one:
- **Railway → Postgres service → Backups → Create backup** (if your plan has it). Quickest.
- Ask your developer to run the nightly backup once by hand, or to take a `pg_dump`.

Always do this before: database updates (migrations), big CSV imports, bulk edits, or the launch cutover.

## 3. Restore (when data was lost or damaged)

Restoring **replaces the whole database** with the copy from that day. Orders, customers and changes made **after** the backup are lost. So:

### Before you restore
1. Decide **which day** to restore (the last good one).
2. **Write down every order since then** (Orders → All orders, sort by date) – you'll re-enter them by hand.
3. Tell staff to stop working in `/cms`.

### Option A – Railway backup (simplest)
1. **Railway → Postgres service → Backups**.
2. Pick the backup → **Restore**. Railway may restore into a new volume and ask you to confirm the switch.
3. When done, open `https://<your-site>/api/health` – it should say `"db":"up","cms":"up"`.
4. Check the latest orders and a few products in `/cms`.

### Option B – Nightly backup file (needs your developer, about 30 minutes)
1. Download the file from the bucket: `backups/<date>.sql.gz` (or `.sql.gz.enc`).
2. **First restore into a new, empty database** (a new Railway Postgres service) – never straight over the live one on the first try:
   ```
   gunzip -c 2026-10-05.sql.gz | psql "<NEW_DATABASE_URL>" -v ON_ERROR_STOP=1
   ```
   An encrypted file (`.enc`) is decrypted on the way – the passphrase is read from the variable, never typed on the command line:
   ```
   export BACKUP_ENCRYPTION_KEY='…'   # the passphrase from the password manager
   openssl enc -d -aes-256-cbc -pbkdf2 -iter 200000 -in 2026-10-05.sql.gz.enc -pass env:BACKUP_ENCRYPTION_KEY \
     | gunzip | psql "<NEW_DATABASE_URL>" -v ON_ERROR_STOP=1
   ```
   (Use a `psql` of the same version as your Postgres or newer, e.g. `docker run --rm -i postgres:17 psql "<url>"`.)
3. Check the data in the new database (products, last orders).
4. In **Railway → web service → Variables**, point `DATABASE_URL` (and `DATABASE_BUILD_URL`) to the new database. The site restarts.
5. Open `/api/health`, sign in to `/cms`, check orders.
6. Re-enter the orders you wrote down.
7. Keep the old database for a week, then delete it.

### After any restore
- Purge the Cloudflare cache (DEPLOYMENT.md → Cloudflare, step 6).
- Place one test order and cancel it.
- Note what happened and why, so it doesn't happen again.

## 4. Practise once

Before launch, and then every 3 months, ask your developer to do **Option B into a test database** and confirm it works. A backup you've never restored is only a hope.

## 5. Good to know

- The `backups/` folder is **private** – the website never serves it.
- Give the backup service its **own** bucket and keys (see the top of this page). Keep all keys secret (see [SECURITY.md](SECURITY.md)).
- `PG_MAJOR` (backup service build variable, default `17`) must match your Railway Postgres major version – `pg_dump` refuses to back up a newer server. Railway shows the version on the Postgres service.
- **Restoring photos:** copy `backups-media/` back into the website bucket's `media/` folder (your developer: `aws s3 sync s3://<backup-bucket>/backups-media/ s3://<site-bucket>/media/` – skipping the `products/`, `banners/`, `blog/`, `reviews/` sub-folders, which go back to the folders of the same name).
- **Restoring private uploads** (payment screenshots, return photos …): download `backups-private/<date>.tar.gz(.enc)`, decrypt like the database file (`openssl enc -d … | tar -xz`), then `aws s3 sync` each folder (`payments/`, `returns/`, `warranty/`, `tradein/`, `reviews-pending/`) back into the website bucket.
- Settings backup file (from the Home screen) restores with **Restore from file…** on the same card – Owner only.
