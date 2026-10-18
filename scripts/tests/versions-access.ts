/**
 * Version history for a store's team (real database, Payload's own access rules): opening a product / post / page in
 * /cms reads its versions – that used to fail for anyone working in a store ("The following path cannot be queried:
 * store" → a blank edit page). Now it works, and only shows the store's own versions.
 * Creates two stores of its own (and their team and documents) and removes them afterwards.
 *
 *   node --conditions=react-server node_modules/payload/bin.js run scripts/tests/versions-access.ts
 */
import { getPayload } from "payload";
import config from "@payload-config";

const payload = await getPayload({ config });
const sys = { overrideAccess: true, depth: 0, context: { system: true, skipRevalidate: true } } as const;
let failed = 0;
const check = (ok: boolean, what: string) => {
  console.log(`${ok ? "✓" : "✗"} ${what}`);
  if (!ok) failed++;
};
type Doc = Record<string, unknown>;
const tag = Date.now().toString(36);
const cleanup: (() => Promise<unknown>)[] = [];

try {
  const store = async (n: string) => {
    const s = (await payload.create({ collection: "stores", data: { name: `V ${n} ${tag}`, slug: `v-${n}-${tag}`, subdomain: `v-${n}-${tag}`, status: "active", subscriptionStatus: "active" } as never, ...sys })) as unknown as Doc;
    cleanup.push(() => payload.delete({ collection: "stores", id: Number(s.id), overrideAccess: true, context: { system: true } }));
    return Number(s.id);
  };
  const A = await store("a");
  const B = await store("b");
  const inA = { ...sys, context: { ...sys.context, storeId: A } };
  const inB = { ...sys, context: { ...sys.context, storeId: B } };

  const email = `v-owner-${tag}@test.local`;
  const u = (await payload.create({ collection: "users", data: { email, password: `Pw-${tag}-v1!`, name: "Version Owner", role: "customer", currentStore: A } as never, ...sys })) as unknown as Doc;
  cleanup.push(() => payload.delete({ collection: "users", id: Number(u.id), overrideAccess: true }));
  const m = (await payload.create({ collection: "store-memberships", data: { store: A, user: u.id, email, role: "store_owner", status: "active" } as never, ...sys })) as unknown as Doc;
  cleanup.unshift(() => payload.delete({ collection: "store-memberships", id: Number(m.id), overrideAccess: true, context: { system: true } }));
  const owner = { ...((await payload.findByID({ collection: "users", id: Number(u.id), depth: 0, overrideAccess: true })) as object), collection: "users", twoFactor: { enabled: true } } as never;

  // a product in each store, each saved twice (two versions)
  const product = async (storeId: number, ctx: typeof inA, n: string) => {
    const cat = (await payload.create({ collection: "categories", data: { store: storeId, name: `V ${n} ${tag}`, slug: `v-cat-${n}-${tag}` } as never, ...ctx })) as unknown as Doc;
    const brand = (await payload.create({ collection: "brands", data: { store: storeId, name: `V ${n} ${tag}`, slug: `v-brand-${n}-${tag}` } as never, ...ctx })) as unknown as Doc;
    const p = (await payload.create({ collection: "products", data: { store: storeId, title: `V ${n} ${tag}`, slug: `v-${n}-${tag}`, sku: `V-${n}-${tag}`, price: 10, stock: 1, status: "draft", _status: "published", category: cat.id, brand: brand.id } as never, ...ctx })) as unknown as Doc;
    await payload.update({ collection: "products", id: Number(p.id), data: { title: `V ${n} ${tag} (2)` } as never, ...ctx });
    cleanup.unshift(() => payload.delete({ collection: "products", id: Number(p.id), overrideAccess: true }));
    cleanup.push(() => payload.delete({ collection: "categories", id: Number(cat.id), overrideAccess: true }), () => payload.delete({ collection: "brands", id: Number(brand.id), overrideAccess: true }));
    return Number(p.id);
  };
  const pa = await product(A, inA, "a");
  const pb = await product(B, inB, "b");

  for (const collection of ["products", "posts", "pages"] as const) {
    let error = "";
    const res = await payload.findVersions({ collection: collection as never, user: owner, overrideAccess: false, limit: 50, depth: 0 }).catch((e: unknown) => ((error = e instanceof Error ? e.message : String(e)), null));
    check(Boolean(res) && !error, `${collection}: the store's team can read the version history${error ? ` (${error})` : ""}`);
  }
  const mine = await payload.findVersions({ collection: "products", user: owner, overrideAccess: false, where: { parent: { in: [pa, pb] } } as never, limit: 50, depth: 0 });
  const parents = new Set((mine.docs as unknown as { parent: unknown }[]).map((d) => Number(typeof d.parent === "object" ? (d.parent as Doc).id : d.parent)));
  check(parents.has(pa) && !parents.has(pb), `…only its own store's versions (${[...parents].join(", ")})`);
} catch (e) {
  console.error(e);
  failed++;
} finally {
  for (const fn of cleanup) await fn().catch((e) => console.error("cleanup:", e instanceof Error ? e.message : e));
}

console.log(failed ? `\n${failed} check(s) failed` : "\nAll version-access checks passed");
process.exit(failed ? 1 : 0);
