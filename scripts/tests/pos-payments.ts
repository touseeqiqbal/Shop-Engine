/**
 * Shop counter payments (real database, the /cms-api/pos/sale endpoint):
 *  - change can't be more than the cash handed over (card 1000 + cash 200 on a 900 sale is refused);
 *  - two cash lines are one cash payment: the change is taken off once (cash 500 + cash 600 on 1000 keeps 1000);
 *  - card + cash: the card as paid, the cash minus change – what is kept adds up to the total.
 * Creates its own product and sales and removes them afterwards.
 *
 *   node --conditions=react-server node_modules/payload/bin.js run scripts/tests/pos-payments.ts
 */
import { getPayload, type PayloadRequest } from "payload";
import config from "@payload-config";
import { posEndpoints } from "../../src/payload/endpoints/pos";

const payload = await getPayload({ config });
const sys = { overrideAccess: true, depth: 0, context: { system: true, skipRevalidate: true } } as const;
let failed = 0;
const check = (ok: boolean, what: string) => {
  console.log(`${ok ? "✓" : "✗"} ${what}`);
  if (!ok) failed++;
};
type Doc = Record<string, unknown>;
const tag = Date.now().toString(36).toUpperCase();
const store = Number(((await payload.find({ collection: "stores", where: { isDefault: { equals: true } }, limit: 1, depth: 0, overrideAccess: true })).docs[0] as unknown as Doc).id);
const staffId = Number(((await payload.find({ collection: "users", limit: 1, depth: 0, overrideAccess: true, sort: "id" })).docs[0] as unknown as Doc).id);
const sale = posEndpoints.find((e) => e.path === "/pos/sale" && e.method === "post")!;
const asStaff = (body: unknown) =>
  ({
    payload,
    user: { id: staffId, collection: "users", email: "staff@test.local", twoFactor: { enabled: true } },
    url: "http://x/",
    json: async () => body,
    context: { __shopengineTenant: { userId: staffId, tenant: { userId: staffId, platformAdmin: false, roles: new Map([[store, "store_staff"]]), activeStoreId: store, defaultStoreId: store, readOnly: new Set() } } },
  }) as unknown as PayloadRequest;
const call = async (body: Doc) => {
  const res = (await sale.handler(asStaff(body))) as Response;
  return { status: res.status, json: (await res.json()) as Doc };
};

const inStore = { ...sys, context: { ...sys.context, storeId: store } };
const category = (await payload.create({ collection: "categories", data: { store, name: `POS ${tag}`, slug: `pos-cat-${tag.toLowerCase()}` } as never, ...inStore })) as unknown as Doc;
const brand = (await payload.create({ collection: "brands", data: { store, name: `POS ${tag}`, slug: `pos-brand-${tag.toLowerCase()}` } as never, ...inStore })) as unknown as Doc;
const product = (await payload.create({ collection: "products", data: { store, title: `POS ${tag}`, slug: `pos-${tag.toLowerCase()}`, sku: `POS-${tag}`, price: 900, stock: 10, status: "draft", category: category.id, brand: brand.id } as never, ...inStore })) as unknown as Doc;
const sales: number[] = [];
const kept = (s: Doc) => ((s.payments as Doc[]) ?? []).map((p) => `${String(p.method)} ${Number(p.amount)}`).sort().join(" + ");

try {
  const line = (price: number) => [{ productId: Number(product.id), qty: 1, unitPrice: price }];

  const tooMuch = await call({ lines: line(900), payments: [{ method: "card", amount: 1000 }, { method: "cash", amount: 200 }] });
  check(tooMuch.status === 400 && /can't be more than the cash/.test(String(tooMuch.json.error)), `change larger than the cash received is refused (${tooMuch.status}: ${String(tooMuch.json.error ?? "")})`);

  const twoCash = await call({ lines: line(1000), payments: [{ method: "cash", amount: 500 }, { method: "cash", amount: 600 }] });
  const s1 = (twoCash.json.sale ?? {}) as Doc;
  if (s1.id) sales.push(Number(s1.id));
  check(twoCash.status === 200 && kept(s1) === "cash 1000" && Number(s1.change) === 100, `two cash lines: change taken off once (kept ${kept(s1)}, change ${String(s1.change)})`);

  const mixed = await call({ lines: line(900), payments: [{ method: "card", amount: 400 }, { method: "cash", amount: 600 }] });
  const s2 = (mixed.json.sale ?? {}) as Doc;
  if (s2.id) sales.push(Number(s2.id));
  const keptSum = ((s2.payments as Doc[]) ?? []).reduce((n, p) => n + Number(p.amount), 0);
  check(mixed.status === 200 && kept(s2) === "card 400 + cash 500" && keptSum === 900, `card + cash: what is kept adds up to the total (${kept(s2)} = ${keptSum})`);
} catch (e) {
  console.error(e);
  failed++;
} finally {
  for (const id of sales) await payload.delete({ collection: "pos-sales", id, ...sys }).catch((e) => console.warn(`cleanup sale: ${(e as Error).message}`));
  await payload.delete({ collection: "products", id: Number(product.id), ...sys }).catch((e) => console.warn(`cleanup product: ${(e as Error).message}`));
  await payload.delete({ collection: "brands", id: Number(brand.id), ...sys }).catch((e) => console.warn(`cleanup brand: ${(e as Error).message}`));
  await payload.delete({ collection: "categories", id: Number(category.id), ...sys }).catch((e) => console.warn(`cleanup category: ${(e as Error).message}`));
}
console.log(failed ? `\n${failed} check(s) failed` : "\nAll shop counter payment checks passed");
process.exit(failed ? 1 : 0);
