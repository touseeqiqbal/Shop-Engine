/**
 * Plan lifecycle (real database): a trial that ended unpaid → past due with a grace date; past due beyond the grace
 * date → expired (shop offline, /cms read-only); the default store is never touched. Test stores are removed after.
 *
 *   node --conditions=react-server node_modules/payload/bin.js run scripts/tests/billing-lifecycle.ts
 */
import { getPayload } from "payload";
import config from "@payload-config";
import { runBillingLifecycle } from "../../src/lib/billing";
import { storeAvailability, toDirectoryEntry } from "../../src/lib/tenant-shared";

const payload = await getPayload({ config });
const sys = { overrideAccess: true, depth: 0, context: { system: true } } as const;
let failed = 0;
const check = (ok: boolean, what: string) => {
  console.log(`${ok ? "✓" : "✗"} ${what}`);
  if (!ok) failed++;
};
type Doc = Record<string, unknown>;
const tag = Date.now().toString(36);
const day = 86400_000;
const plan = (await payload.find({ collection: "subscription-plans", limit: 1, depth: 0, overrideAccess: true })).docs[0] as unknown as Doc | undefined;
if (!plan) throw new Error("No plans – run the migrations first");
const created: { collection: "stores" | "store-subscriptions"; id: number }[] = [];
const store = async (name: string, sub: Doc) => {
  const s = (await payload.create({ collection: "stores", data: { name, slug: `${name}-${tag}`, subdomain: `${name}-${tag}`, status: "active", subscriptionStatus: sub.status, plan: plan.id, ...(sub.trialEndsAt ? { trialEndsAt: sub.trialEndsAt } : {}), ...(sub.graceEndsAt ? { graceEndsAt: sub.graceEndsAt } : {}) } as never, ...sys })) as unknown as Doc;
  created.push({ collection: "stores", id: Number(s.id) });
  const row = (await payload.create({ collection: "store-subscriptions", data: { store: s.id, plan: plan.id, ...sub } as never, ...sys })) as unknown as Doc;
  created.push({ collection: "store-subscriptions", id: Number(row.id) });
  return Number(s.id);
};
const read = async (id: number) => (await payload.findByID({ collection: "stores", id, depth: 0, overrideAccess: true })) as unknown as Doc;

try {
  const ended = await store("trialend", { status: "trialing", trialEndsAt: new Date(Date.now() - day).toISOString() });
  const lapsed = await store("lapsed", { status: "past_due", graceEndsAt: new Date(Date.now() - day).toISOString() });
  const grace = await store("grace", { status: "past_due", graceEndsAt: new Date(Date.now() + 3 * day).toISOString() });
  const fine = await store("fine", { status: "trialing", trialEndsAt: new Date(Date.now() + 5 * day).toISOString() });

  await runBillingLifecycle(payload);

  const a = await read(ended);
  check(a.subscriptionStatus === "past_due" && Boolean(a.graceEndsAt), `trial ended unpaid → past due with a grace date (${a.subscriptionStatus})`);
  check(storeAvailability(toDirectoryEntry(a)).open, "…and the shop stays open during the grace period");
  const b = await read(lapsed);
  check(b.subscriptionStatus === "expired", `past due beyond grace → expired (${b.subscriptionStatus})`);
  check(!storeAvailability(toDirectoryEntry(b)).open, "…and the shop is offline");
  check((await read(grace)).subscriptionStatus === "past_due", "still within grace → unchanged");
  check((await read(fine)).subscriptionStatus === "trialing", "trial still running → unchanged");
  const def = (await payload.find({ collection: "stores", where: { isDefault: { equals: true } }, limit: 1, depth: 0, overrideAccess: true })).docs[0] as unknown as Doc | undefined;
  check(!def || storeAvailability(toDirectoryEntry(def)).open, "the default store is never taken offline");
} finally {
  for (const c of created.reverse()) await payload.delete({ collection: c.collection, id: c.id, ...sys }).catch((e) => console.warn(`cleanup ${c.collection} ${c.id}: ${(e as Error).message}`));
}
console.log(failed ? `Billing lifecycle FAILED (${failed})` : "Billing lifecycle passed");
process.exit(failed ? 1 : 0);
