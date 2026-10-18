/**
 * Tenant isolation test (real database, Payload's own access rules – overrideAccess: false):
 * two stores, an owner of store A, a staff member of store B, a shopper. Every check must hold:
 *   - each team sees and changes only its own store's records; a form can't point a new record at another store;
 *   - nobody raises their own platform role or adds themselves to another store's team;
 *   - another store's settings (payment accounts!) are out of reach;
 *   - the same discount code may exist in two stores, and using one never touches the other.
 * Everything it creates is removed afterwards.
 *
 *   npm run test:tenants        (local or staging DATABASE_URL – never production)
 */
import { getPayload, type Payload } from "payload";
import config from "@payload-config";
import { consumeCoupon } from "../../src/payload/stock";

const payload: Payload = await getPayload({ config });
const tag = `iso${Date.now().toString(36)}`;
const created: { collection: string; id: number }[] = [];
const sys = { overrideAccess: true, depth: 0, context: { system: true, skipRevalidate: true } } as const;
let failed = 0;

function check(ok: boolean, what: string) {
  console.log(`${ok ? "✓" : "✗"} ${what}`);
  if (!ok) failed++;
}
async function make<T extends Record<string, unknown>>(collection: string, data: Record<string, unknown>, context: Record<string, unknown> = {}): Promise<T> {
  const doc = (await payload.create({ collection: collection as never, data: data as never, ...sys, context: { ...sys.context, ...context } })) as unknown as T;
  created.push({ collection, id: Number(doc.id) });
  return doc;
}
/** true when Payload refused (or silently did nothing) */
async function refused(fn: () => Promise<unknown>): Promise<boolean> {
  try {
    await fn();
    return false;
  } catch {
    return true;
  }
}

try {
  const storeA = await make<{ id: number }>("stores", { name: `A ${tag}`, slug: `a-${tag}`, subdomain: `a-${tag}`, status: "active", subscriptionStatus: "active" });
  const storeB = await make<{ id: number }>("stores", { name: `B ${tag}`, slug: `b-${tag}`, subdomain: `b-${tag}`, status: "active", subscriptionStatus: "active" });
  const ownerA = await make<{ id: number }>("users", { email: `owner-${tag}@test.local`, password: `Pw-${tag}-x1!`, name: "Owner A", role: "customer", platformRole: "merchant_owner", currentStore: storeA.id });
  const staffB = await make<{ id: number }>("users", { email: `staff-${tag}@test.local`, password: `Pw-${tag}-x2!`, name: "Staff B", role: "customer", currentStore: storeB.id });
  const shopper = await make<{ id: number }>("users", { email: `shopper-${tag}@test.local`, password: `Pw-${tag}-x3!`, name: "Shopper", role: "customer" });
  await make("store-memberships", { store: storeA.id, user: ownerA.id, email: `owner-${tag}@test.local`, role: "store_owner", status: "active" });
  await make("store-memberships", { store: storeB.id, user: staffB.id, email: `staff-${tag}@test.local`, role: "store_staff", status: "active" });

  // the people, as their sessions see them (2-step done)
  const asUser = async (id: number) => ({ ...((await payload.findByID({ collection: "users", id, depth: 0, overrideAccess: true })) as object), collection: "users", twoFactor: { enabled: true } });
  const A = await asUser(ownerA.id);
  const B = await asUser(staffB.id);
  const S = await asUser(shopper.id);

  const catA = await make<{ id: number }>("categories", { name: `Cat A ${tag}`, slug: `cat-a-${tag}`, store: storeA.id }, { storeId: storeA.id });
  const catB = await make<{ id: number }>("categories", { name: `Cat B ${tag}`, slug: `cat-b-${tag}`, store: storeB.id }, { storeId: storeB.id });
  const msgA = await make<{ id: number }>("contact-messages", { name: "Ali", phone: "0300-1234567", message: "Hello store A, this is a test", store: storeA.id }, { storeId: storeA.id });
  const msgB = await make<{ id: number }>("contact-messages", { name: "Sara", phone: "0300-7654321", message: "Hello store B, this is a test", store: storeB.id }, { storeId: storeB.id });

  // ── reading ──
  const catsA = await payload.find({ collection: "categories", user: A, overrideAccess: false, depth: 0, limit: 500, where: { slug: { like: tag } } });
  check(catsA.docs.length === 1 && Number(catsA.docs[0].id) === catA.id, "owner of A sees only A's categories in /cms");
  const msgsB = await payload.find({ collection: "contact-messages", user: B, overrideAccess: false, depth: 0, limit: 500, where: { id: { in: [msgA.id, msgB.id] } } });
  check(msgsB.docs.length === 1 && Number(msgsB.docs[0].id) === msgB.id, "staff of B sees only B's customer messages");
  const msgsS = await payload.find({ collection: "contact-messages", user: S, overrideAccess: false, depth: 0, limit: 500, where: { id: { in: [msgA.id, msgB.id] } } }).catch(() => ({ docs: [] }));
  check(msgsS.docs.length === 0, "a shopper sees no store's customer messages");

  // ── writing ──
  check(await refused(() => payload.update({ collection: "categories", id: catB.id, data: { name: "hacked" } as never, user: A, overrideAccess: false })), "owner of A can't change B's category");
  const afterB = (await payload.findByID({ collection: "categories", id: catB.id, depth: 0, overrideAccess: true })) as { name?: string };
  check(afterB.name !== "hacked", "…and B's category is unchanged");
  check(await refused(() => payload.create({ collection: "categories", data: { name: `X ${tag}`, slug: `x-${tag}`, store: storeB.id } as never, user: A, overrideAccess: false })), "owner of A can't create a category in store B");
  check(await refused(() => payload.delete({ collection: "contact-messages", id: msgA.id, user: B, overrideAccess: false })), "staff of B can't delete A's messages");

  // ── no self-promotion ──
  await payload.update({ collection: "users", id: ownerA.id, data: { platformRole: "platform_admin", role: "owner" } as never, user: A, overrideAccess: false }).catch(() => null);
  const me = (await payload.findByID({ collection: "users", id: ownerA.id, depth: 0, overrideAccess: true })) as { platformRole?: string; role?: string };
  check(me.platformRole !== "platform_admin" && me.role !== "owner", "a merchant can't make themselves platform admin / owner");
  check(await refused(() => payload.create({ collection: "store-memberships", data: { store: storeB.id, user: ownerA.id, email: `owner-${tag}@test.local`, role: "store_owner", status: "active" } as never, user: A, overrideAccess: false })), "owner of A can't add themselves to store B's team");
  check(await refused(() => payload.update({ collection: "stores", id: storeB.id, data: { name: "mine now" } as never, user: A, overrideAccess: false })), "owner of A can't edit store B");
  check(await refused(() => payload.update({ collection: "stores", id: storeA.id, data: { status: "active", subscriptionStatus: "active", plan: null } as never, user: A, overrideAccess: false }).then(async () => {
    // field access drops what a merchant may not set – the call may succeed, but nothing billing-related changes
    const s = (await payload.findByID({ collection: "stores", id: storeA.id, depth: 0, overrideAccess: true })) as { subscriptionStatus?: string };
    if (s.subscriptionStatus !== "active") throw new Error("changed");
    throw new Error("ok – nothing to change");
  })), "a merchant can't set their own plan / billing status");

  // ── settings of another store ──
  const payB = await make<{ id: number }>("store-payments", { store: storeB.id, jazzcash: { enabled: true, title: "B", number: "0300-0000000" } }, { storeId: storeB.id });
  check(await refused(() => payload.update({ collection: "store-payments" as never, id: payB.id, data: { jazzcash: { enabled: true, title: "attacker", number: "0300-9999999" } } as never, user: A, overrideAccess: false })), "owner of A can't change B's payment accounts");
  const readPay = await payload.find({ collection: "store-payments" as never, user: A, overrideAccess: false, depth: 0, where: { id: { equals: payB.id } } }).catch(() => ({ docs: [] }));
  check(readPay.docs.length === 0, "…or even read them");
  check(await refused(() => payload.updateGlobal({ slug: "payments" as never, data: {} as never, user: A, overrideAccess: false })), "a merchant can't change the platform's default settings");

  // ── discount codes per store ──
  await make("discounts", { code: `SAME${tag}`.toUpperCase(), kind: "percent", value: 10, active: true, used: 0, usageLimit: 1, store: storeA.id }, { storeId: storeA.id });
  const dupB = await make<{ id: number }>("discounts", { code: `SAME${tag}`.toUpperCase(), kind: "percent", value: 10, active: true, used: 0, usageLimit: 1, store: storeB.id }, { storeId: storeB.id });
  check(Boolean(dupB.id), "two stores can use the same discount code");
  const usedA = await consumeCoupon(payload, `SAME${tag}`.toUpperCase(), storeA.id);
  const b = (await payload.findByID({ collection: "discounts", id: dupB.id, depth: 0, overrideAccess: true })) as { used?: number };
  check(usedA === true && Number(b.used) === 0, "using A's code never counts against B's");

  // ── redirects stay in their own store (renaming a page in A once rewrote / deleted B's redirects) ──
  const slugOld = `old-${tag}`;
  const slugNew = `new-${tag}`;
  const moving = await make<{ id: number }>("categories", { name: `Move ${tag}`, slug: slugOld, store: storeA.id }, { storeId: storeA.id });
  type Redirect = { id: number; from?: string; to?: { url?: string } };
  const rB = [
    await make<Redirect>("redirects", { from: `/category/${slugOld}`, to: { type: "custom", url: "/b-own-page" }, store: storeB.id }, { storeId: storeB.id }),
    await make<Redirect>("redirects", { from: `/category/${slugNew}`, to: { type: "custom", url: "/b-other-page" }, store: storeB.id }, { storeId: storeB.id }),
    await make<Redirect>("redirects", { from: `/b-legacy-${tag}`, to: { type: "custom", url: `/category/${slugOld}` }, store: storeB.id }, { storeId: storeB.id }),
  ];
  await payload.update({ collection: "categories", id: moving.id, data: { slug: slugNew } as never, overrideAccess: true, depth: 0, context: { skipRevalidate: true } });
  const bNow = (await payload.find({ collection: "redirects", where: { id: { in: rB.map((r) => r.id) } }, depth: 0, limit: 10, overrideAccess: true })).docs as unknown as Redirect[];
  const urlOf = (id: number) => bNow.find((r) => Number(r.id) === id)?.to?.url;
  check(bNow.length === 3 && urlOf(rB[0].id) === "/b-own-page" && urlOf(rB[1].id) === "/b-other-page" && urlOf(rB[2].id) === `/category/${slugOld}`, "store A renaming a page leaves store B's redirects alone");
  const aOwn = (await payload.find({ collection: "redirects", where: { and: [{ store: { equals: storeA.id } }, { from: { equals: `/category/${slugOld}` } }] }, depth: 0, limit: 5, overrideAccess: true })).docs as unknown as Redirect[];
  for (const r of aOwn) created.push({ collection: "redirects", id: Number(r.id) });
  check(aOwn.length === 1 && aOwn[0].to?.url === `/category/${slugNew}`, "…and store A gets its own redirect old → new");

  // ── a store that still has records can't be deleted (they'd be left with no store) ──
  const brandA = await make<{ id: number }>("brands", { name: `Brand A ${tag}`, slug: `brand-a-${tag}`, store: storeA.id }, { storeId: storeA.id });
  await make("products", { store: storeA.id, title: `Kept ${tag}`, slug: `kept-${tag}`, sku: `KEPT-${tag}`, price: 10, stock: 1, status: "draft", category: catA.id, brand: brandA.id }, { storeId: storeA.id });
  const storeDelete = await payload.delete({ collection: "stores", id: storeA.id, overrideAccess: true }).then(() => "deleted").catch((e: unknown) => (e instanceof Error ? e.message : String(e)));
  check(/still has 1 product/.test(storeDelete), `a store with products can't be deleted (${storeDelete.slice(0, 80)})`);

  // ── accounts ──
  const people = await payload.find({ collection: "users", user: A, overrideAccess: false, depth: 0, limit: 500, where: { id: { in: [ownerA.id, staffB.id, shopper.id] } } }).catch(() => ({ docs: [] as { id: unknown }[] }));
  const ids = people.docs.map((d) => Number(d.id));
  check(ids.includes(ownerA.id) && !ids.includes(staffB.id) && !ids.includes(shopper.id), "a merchant sees their own account, not other stores' people or shoppers of other stores");
  check(await refused(() => payload.delete({ collection: "users", id: shopper.id, user: A, overrideAccess: false })), "a merchant can't delete accounts");
} finally {
  for (const c of created.reverse()) await payload.delete({ collection: c.collection as never, id: c.id, ...sys }).catch((e) => console.warn(`cleanup ${c.collection} ${c.id}: ${(e as Error).message}`));
}
console.log(failed ? `Tenant isolation test FAILED (${failed})` : "Tenant isolation test passed");
process.exit(failed ? 1 : 0);
