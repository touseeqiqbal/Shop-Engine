import { cancelExpiredUnconfirmed } from "@/lib/cms/confirm";
import { log } from "@/lib/log";
import { cleanupOldEngagementData, sendCartReminders, sendStockAndPriceAlerts } from "@/lib/engagement-jobs";
import { payloadClient } from "@/lib/cms/catalog-source";
import { processOutbox } from "@/lib/outbox";
import { allGateways } from "@/lib/payments/gateways";
import { runBillingLifecycle } from "@/lib/billing";

let lastCleanup = 0;
let lastBilling = 0;

/**
 * Background chores, run every few minutes by the server (instrumentation.ts) and on demand via /api/cron.
 * Each task is independent – one failing never stops the others.
 *   - Deliver queued messages (the outbox) and retry failed ones.
 *   - Cancel cash-on-delivery orders the customer didn't confirm in time (stock goes back, customer is told).
 *   - Settle card payments whose webhook never came (paid → order paid; expired → order cancelled).
 *   - Back-in-stock / price-drop alerts and abandoned-cart reminders (each store's own settings).
 *   - Plans: trials that ended unpaid, payment grace periods that ran out (hourly).
 *
 * Only one server runs it at a time: a Postgres advisory lock is held while it works, so with several instances (or
 * the timer and /api/cron at once) the others skip the round – no customer gets the same reminder twice.
 */

let running = false;
/** Any fixed number – the name of the lock in Postgres. */
const LOCK_KEY = 0x75726b6f686b;

interface PgClient {
  query: (sql: string, params?: unknown[]) => Promise<{ rows: Record<string, unknown>[] }>;
  release: () => void;
}

/** Runs `fn` only if no other server holds the housekeeping lock; null when another one is busy. */
async function withJobLock<T>(fn: () => Promise<T>): Promise<T | null> {
  const payload = await payloadClient();
  const pool = (payload.db as unknown as { pool?: { connect: () => Promise<PgClient> } }).pool;
  if (!pool) return fn();
  // a session lock lives on ONE connection – keep that connection until unlocked (it's freed if the process dies)
  const client = await pool.connect();
  try {
    const { rows } = await client.query("select pg_try_advisory_lock($1) as locked", [LOCK_KEY]);
    if (!rows[0]?.locked) return null;
    try {
      return await fn();
    } finally {
      await client.query("select pg_advisory_unlock($1)", [LOCK_KEY]).catch(() => {});
    }
  } finally {
    client.release();
  }
}

export async function runHousekeeping(reason: string): Promise<Record<string, unknown>> {
  if (running) return { skipped: "already running" };
  running = true;
  try {
    return (await withJobLock(() => chores(reason))) ?? { skipped: "another server is running it" };
  } finally {
    running = false;
  }
}

async function chores(reason: string): Promise<Record<string, unknown>> {
  const started = Date.now();
  const report: Record<string, unknown> = {};
  const payload = await payloadClient();
  try {
    // (each cancellation queues its own message to the customer)
    report.autoCancelled = (await cancelExpiredUnconfirmed()).map((o) => o.orderNumber);
  } catch (e) {
    report.autoCancelError = String((e as Error).message ?? e);
    log.error("housekeeping.auto_cancel", e);
  }
  try {
    report.alertsSent = await sendStockAndPriceAlerts();
  } catch (e) {
    report.alertsError = String((e as Error).message ?? e);
    log.error("housekeeping.alerts", e);
  }
  try {
    report.cartReminders = await sendCartReminders();
  } catch (e) {
    report.cartError = String((e as Error).message ?? e);
    log.error("housekeeping.carts", e);
  }
  // online payments whose webhook never came – each provider plugin asks its provider
  for (const gateway of allGateways()) {
    if (!gateway.reconcile || !gateway.configured()) continue;
    try {
      const r = await gateway.reconcile(payload);
      if (r.paid || r.cancelled) report.cardPayments = { ...(report.cardPayments as object | undefined), [gateway.id]: r };
    } catch (e) {
      log.error("housekeeping.card_reconcile", e, { provider: gateway.id });
    }
  }
  if (Date.now() - lastBilling > 3600e3) {
    lastBilling = Date.now();
    try {
      const r = await runBillingLifecycle(payload);
      if (r.pastDue || r.expired) report.plans = r;
    } catch (e) {
      log.error("housekeeping.billing", e);
    }
  }
  try {
    // last: everything queued above goes out now (and anything that failed earlier is retried)
    const r = await processOutbox(payload, 100);
    if (r.sent || r.failed || r.dead) report.outbox = r;
  } catch (e) {
    log.error("housekeeping.outbox", e);
  }
  // once an hour is plenty for clearing out old personal data
  if (Date.now() - lastCleanup > 3600e3) {
    lastCleanup = Date.now();
    try {
      report.oldRecordsRemoved = await cleanupOldEngagementData();
    } catch (e) {
      log.error("housekeeping.cleanup", e);
    }
  }
  const busy = Object.values(report).some((v) => (Array.isArray(v) ? v.length : typeof v === "number" ? v > 0 : Boolean(v)));
  if (busy) log.info("housekeeping", { reason, ms: Date.now() - started, ...report });
  return report;
}
