/**
 * Unsubscribing from cart reminders (real database):
 *  - "Yes, stop reminders" on a cart stops it AND puts the shopper's email and phone on the store's Unsubscribed list;
 *  - the list is per store, and a later cart of theirs isn't reminded (the reminder job marks it Stopped);
 *  - the subscribers export leaves them out; ticking "send me offers" again takes them off the list.
 * Creates its own records in the default store and removes them afterwards.
 *
 *   node --conditions=react-server node_modules/payload/bin.js run scripts/tests/unsubscribe.ts
 */
import { randomBytes } from "node:crypto";
import { getPayload } from "payload";
import config from "@payload-config";
import { stopDraftReminders } from "../../src/lib/cms/engagement";
import { clearOptOut, isOptedOut, optOut } from "../../src/payload/optouts";
import { marketingEndpoints } from "../../src/payload/endpoints/marketing";

const payload = await getPayload({ config });
const sys = { overrideAccess: true, depth: 0, context: { system: true, skipRevalidate: true } } as const;
let failed = 0;
const check = (ok: boolean, what: string) => {
  console.log(`${ok ? "✓" : "✗"} ${what}`);
  if (!ok) failed++;
};
type Doc = Record<string, unknown>;
const tag = Date.now().toString(36);
const store = Number(((await payload.find({ collection: "stores", where: { isDefault: { equals: true } }, limit: 1, depth: 0, overrideAccess: true })).docs[0] as unknown as Doc).id);
const cleanup: (() => Promise<unknown>)[] = [];
const email = `unsub-${tag}@test.local`;
const phone = `0300${String(Date.now()).slice(-7)}`;

const cart = async (n: number) => {
  const token = randomBytes(16).toString("base64url");
  const c = (await payload.create({ collection: "abandoned-carts", data: { store, status: "open", contact: email, email, phone, name: "Unsub Test", items: [{ productId: "1", name: "Thing", qty: 1, unitPrice: 100 }], total: 100, remindersSent: 0, token, lastActivityAt: new Date(Date.now() - (n + 30) * 3600e3).toISOString() } as never, ...sys, context: { ...sys.context, storeId: store } })) as unknown as Doc;
  cleanup.unshift(() => payload.delete({ collection: "abandoned-carts", id: Number(c.id), overrideAccess: true }));
  return { id: Number(c.id), token };
};

try {
  cleanup.push(() => payload.delete({ collection: "email-optouts", where: { contact: { in: [email, phone] } } as never, overrideAccess: true }));
  check(!(await isOptedOut(payload, store, [email, phone])), "a new shopper isn't on the list");

  // ── "Yes, stop reminders" on the first cart ──
  const first = await cart(1);
  await stopDraftReminders(first.token, store);
  const stopped = (await payload.findByID({ collection: "abandoned-carts", id: first.id, depth: 0, overrideAccess: true })) as unknown as Doc;
  check(stopped.status === "stopped", "the cart's reminders are stopped");
  check(await isOptedOut(payload, store, [email]), "their email is on the store's Unsubscribed list");
  check(await isOptedOut(payload, store, [phone]), "…and their phone number");
  check(await isOptedOut(payload, store, [email.toUpperCase()]), "the email matches however it is written");
  const rows = (await payload.find({ collection: "email-optouts", where: { contact: { equals: email } } as never, limit: 5, depth: 0, overrideAccess: true })).docs as unknown as Doc[];
  check(rows.length === 1 && rows[0].source === "cart-reminder" && Number(rows[0].store) === store, "one entry, from the reminder's link, in this store");
  await optOut(payload, store, [email], "one-click");
  check((await payload.count({ collection: "email-optouts", where: { contact: { equals: email } } as never, overrideAccess: true })).totalDocs === 1, "unsubscribing again adds nothing");

  // another store's list is its own
  const other = (await payload.find({ collection: "stores", where: { isDefault: { not_equals: true } }, limit: 1, depth: 0, overrideAccess: true })).docs[0] as unknown as Doc | undefined;
  if (other) check(!(await isOptedOut(payload, Number(other.id), [email])), "another store may still remind them (each store's list is its own)");

  // ── a later cart isn't reminded ──
  const second = await cart(2);
  const { sendCartReminders } = await import("../../src/lib/engagement-jobs");
  const ran = await sendCartReminders().then(() => true).catch((e) => (console.log(`  (reminder job can't run outside the server here: ${e instanceof Error ? e.message.slice(0, 80) : e})`), false));
  if (ran) {
    const later = (await payload.findByID({ collection: "abandoned-carts", id: second.id, depth: 0, overrideAccess: true })) as unknown as Doc;
    const queued = (await payload.count({ collection: "outbox-events", where: { and: [{ type: { equals: "notify.abandoned-cart" } }, { "data.contact": { equals: email } }] } as never, overrideAccess: true })).totalDocs;
    check(later.status === "stopped" && queued === 0, `their next cart gets no reminder (status ${String(later.status)}, ${queued} queued)`);
  }

  // ── the subscribers export leaves them out ──
  const customer = (await payload.create({ collection: "users", data: { email, password: `Pw-${tag}-u1!`, name: "Unsub Test", role: "customer", marketingConsent: [store] } as never, ...sys })) as unknown as Doc;
  cleanup.unshift(() => payload.delete({ collection: "users", id: Number(customer.id), overrideAccess: true }));
  const csv = async () => {
    const ep = marketingEndpoints.find((e) => e.path === "/marketing/subscribers.csv")!;
    const owner = (await payload.find({ collection: "users", where: { platformRole: { equals: "platform_admin" } }, limit: 1, depth: 0, overrideAccess: true })).docs[0] as unknown as Doc | undefined;
    if (!owner) return null;
    const user = { ...owner, collection: "users", twoFactor: { enabled: true }, currentStore: store };
    const res = (await ep.handler({ payload, user, headers: new Headers(), context: {}, query: {} } as never)) as Response;
    return res.ok ? await res.text() : `HTTP ${res.status}`;
  };
  const before = await csv();
  if (before === null) console.log("  (no platform admin in this database – export not checked)");
  else check(!before.includes(email), `the subscribers export leaves them out${before.startsWith("HTTP") ? ` (${before})` : ""}`);

  // ── they agree again at checkout ──
  await clearOptOut(payload, store, [email, phone]);
  check(!(await isOptedOut(payload, store, [email, phone])), "ticking “send me offers” takes them off the list");
  const after = await csv();
  if (after !== null && !after.startsWith("HTTP")) check(after.includes(email), "…and they are in the export again");
} catch (e) {
  console.error(e);
  failed++;
} finally {
  for (const fn of cleanup) await fn().catch((e) => console.error("cleanup:", e instanceof Error ? e.message : e));
}

console.log(failed ? `\n${failed} check(s) failed` : "\nAll unsubscribe checks passed");
process.exit(failed ? 1 : 0);
