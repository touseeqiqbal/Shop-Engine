/**
 * Digital products on the real database (local file storage):
 *  - an order with a download product has no links until it is PAID; becoming paid queues the "downloads" email once;
 *  - a link downloads the file's exact bytes as an attachment, and counts – the product's limit holds (also with two
 *    clicks at once);
 *  - a changed or expired link, a file that isn't part of the order and an unpaid order are refused;
 *  - a cart of downloads only pays no delivery.
 * Creates its own records in the default store and removes them afterwards.
 *
 *   node --conditions=react-server node_modules/payload/bin.js run scripts/tests/digital.ts
 */
import { randomUUID } from "node:crypto";
import { getPayload } from "payload";
import config from "@payload-config";
import { placeOrderCms } from "../../src/lib/cms/sales";
import { orderDownloads, serveDownload } from "../../src/payload/downloads";
import { downloadToken } from "../../src/lib/downloads";
import { orderTotals } from "../../src/lib/order-totals";
import type { Order, StoreSettings } from "../../src/lib/types";

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
const inStore = { ...sys, context: { ...sys.context, storeId: store } };
const cleanup: (() => Promise<unknown>)[] = [];

try {
  // a file and a product that sells it (2 downloads per file)
  // (Payload checks that real PDFs are PDFs – a text file is enough here)
  const bytes = Buffer.from(`ShopEngine digital test ${tag}\n`);
  const file = (await payload.create({ collection: "digital-files" as never, data: { store, title: `Guide ${tag}` } as never, file: { data: bytes, mimetype: "text/plain", name: `guide-${tag}.txt`, size: bytes.length }, ...inStore })) as unknown as Doc;
  cleanup.push(() => payload.delete({ collection: "digital-files" as never, id: Number(file.id), overrideAccess: true }));
  const other = (await payload.create({ collection: "digital-files" as never, data: { store, title: `Other ${tag}` } as never, file: { data: bytes, mimetype: "text/plain", name: `other-${tag}.txt`, size: bytes.length }, ...inStore })) as unknown as Doc;
  cleanup.push(() => payload.delete({ collection: "digital-files" as never, id: Number(other.id), overrideAccess: true }));
  const category = (await payload.create({ collection: "categories", data: { store, name: `Dig ${tag}`, slug: `dig-cat-${tag}` } as never, ...inStore })) as unknown as Doc;
  const brand = (await payload.create({ collection: "brands", data: { store, name: `Dig ${tag}`, slug: `dig-brand-${tag}` } as never, ...inStore })) as unknown as Doc;
  cleanup.push(() => payload.delete({ collection: "categories", id: Number(category.id), overrideAccess: true }), () => payload.delete({ collection: "brands", id: Number(brand.id), overrideAccess: true }));
  const product = (await payload.create({ collection: "products", data: { store, title: `E-book ${tag}`, slug: `ebook-${tag}`, sku: `EB-${tag}`, price: 500, stock: 100, status: "draft", _status: "published", category: category.id, brand: brand.id, digital: { files: [file.id], noShipping: true, downloadLimit: 2, downloadDays: 30 } } as never, ...inStore })) as unknown as Doc;
  cleanup.unshift(() => payload.delete({ collection: "products", id: Number(product.id), overrideAccess: true }));

  const now = new Date().toISOString();
  const placed = await placeOrderCms(
    { id: randomUUID(), orderNumber: `DIG-${tag}`, createdAt: now, status: "pending", customer: { name: "Reader", phone: "0300-4445551", email: `reader-${tag}@test.local`, city: "Karachi", address: "Street 5, Block 6" }, items: [{ productId: String(product.id), slug: "x", name: "E-book", image: "", url: "/", unitPrice: 500, qty: 1, upgrades: [] }], subtotal: 500, discount: 0, couponCode: null, deliveryCharge: 0, total: 500, paymentMethod: "bank", paymentStatus: "awaiting-verification", paymentScreenshotUrl: null, courier: null, trackingNumber: null, notes: null, history: [{ status: "pending", at: now }], confirmation: null, risk: null, userId: null, storeId: store } as unknown as Order,
    [{ id: String(product.id), qty: 1, title: "E-book" }],
    { attemptId: `dig-${tag}` },
  );
  if (!placed.ok) throw new Error("order not placed");
  const orderId = Number(placed.order.id);
  cleanup.unshift(() => payload.delete({ collection: "orders", id: orderId, overrideAccess: true, context: { system: true } }));
  cleanup.unshift(() => payload.delete({ collection: "outbox-events", where: { "data.orderId": { equals: orderId } } as never, overrideAccess: true }));
  const read = async () => (await payload.findByID({ collection: "orders", id: orderId, depth: 0, overrideAccess: true })) as unknown as Doc;

  // ── not paid yet ──
  let dl = await orderDownloads(payload, await read());
  check(!dl.paid && dl.files.length === 1 && dl.files[0].url === null, "unpaid: the order lists the file, without a link");
  const early = await serveDownload(payload, downloadToken({ order: orderId, file: Number(file.id), exp: Math.floor(Date.now() / 1000) + 600 }));
  check(early.status === 403, `a link made before payment is refused (${early.status})`);

  // ── paid ──
  await payload.update({ collection: "orders", id: orderId, data: { paymentStatus: "paid" } as never, ...sys });
  const queued = (await payload.count({ collection: "outbox-events", where: { and: [{ type: { equals: "notify.downloads" } }, { "data.orderId": { equals: orderId } }] } as never, overrideAccess: true })).totalDocs;
  check(queued === 1, `paid: the downloads email is queued once (${queued})`);
  await payload.update({ collection: "orders", id: orderId, data: { adminNotes: "again" } as never, ...sys });
  check((await payload.count({ collection: "outbox-events", where: { and: [{ type: { equals: "notify.downloads" } }, { "data.orderId": { equals: orderId } }] } as never, overrideAccess: true })).totalDocs === 1, "saving the paid order again sends nothing more");
  dl = await orderDownloads(payload, await read());
  const url = dl.files[0]?.url ?? "";
  check(dl.paid && url.startsWith("/download/") && dl.files[0].limit === 2, "paid: a signed link for the file");
  const token = url.replace("/download/", "");

  const first = await serveDownload(payload, token);
  const got = Buffer.from(await first.arrayBuffer());
  check(first.status === 200 && got.equals(bytes) && /attachment; filename="guide-/.test(first.headers.get("content-disposition") ?? "") && /no-store/.test(first.headers.get("cache-control") ?? ""), `the link downloads the file's exact bytes as an attachment (${first.status}, ${got.length} bytes)`);
  // two clicks at once: one more allowed (limit 2), not two
  const [a, b] = await Promise.all([serveDownload(payload, token), serveDownload(payload, token)]);
  await a.body?.cancel().catch(() => undefined);
  await b.body?.cancel().catch(() => undefined);
  check([a.status, b.status].sort().join(",") === "200,410", `the limit holds with two clicks at once (${a.status}, ${b.status})`);
  const counts = (await read()).downloadCounts as Record<string, number>;
  check(counts?.[String(file.id)] === 2, `the order remembers 2 downloads (${JSON.stringify(counts)})`);
  dl = await orderDownloads(payload, await read());
  check(dl.files[0].url === null && dl.files[0].used === 2, "used up: no more link on the order page");

  // ── refused links ──
  const [body, sig] = token.split(".");
  check((await serveDownload(payload, `${body}.${sig.slice(0, -3)}abc`)).status === 410, "a changed link is refused");
  check((await serveDownload(payload, downloadToken({ order: orderId, file: Number(file.id), exp: Math.floor(Date.now() / 1000) - 5 }))).status === 410, "an expired link is refused");
  check((await serveDownload(payload, downloadToken({ order: orderId, file: Number(other.id), exp: Math.floor(Date.now() / 1000) + 600 }))).status === 404, "a file that isn't part of the order is refused");

  // ── a cart of downloads only pays no delivery ──
  const settings = { freeDeliveryThreshold: 0, defaultDeliveryCharge: 250, cityCharges: {}, advanceThreshold: 0, advanceAmount: 0, bank: { bankName: "", accountTitle: "", accountNumber: "", iban: "" }, jazzcash: { title: "", number: "" }, easypaisa: { title: "", number: "" }, country: "PK", currency: "PKR" } as StoreSettings;
  const withShip = orderTotals({ subtotal: 500, discount: 0, city: "Karachi", method: "bank", settings });
  const noShip = orderTotals({ subtotal: 500, discount: 0, city: "Karachi", method: "bank", settings, noShipping: true });
  check(withShip.delivery === 250 && noShip.delivery === 0 && noShip.total === 500, `downloads only: no delivery charge (${noShip.delivery} vs ${withShip.delivery})`);
} catch (e) {
  console.error(e instanceof Error ? `${e.message} ${JSON.stringify((e as { data?: unknown }).data ?? "")}` : e);
  failed++;
} finally {
  for (const fn of cleanup) await fn().catch((e) => console.error("cleanup:", e instanceof Error ? e.message : e));
}

console.log(failed ? `\n${failed} check(s) failed` : "\nAll digital product checks passed");
process.exit(failed ? 1 : 0);
