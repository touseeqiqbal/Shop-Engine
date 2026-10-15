/**
 * LOCAL TEST DATABASE ONLY – a demo store in the United States (dollars, New York time, Zelle + card on delivery,
 * postcode zones) to look at in the browser: http://usdemo.localtest.me:3100 (dev server with
 * PLATFORM_ROOT_DOMAIN=localtest.me). Run again to reset it. Temporary helper, not part of the test suite.
 */
import { getPayload } from "payload";
import config from "@payload-config";

const payload = await getPayload({ config });
const sys = { overrideAccess: true, depth: 0, context: { system: true, skipRevalidate: true } } as const;
type Doc = Record<string, unknown>;

const existing = (await payload.find({ collection: "stores", where: { subdomain: { equals: "usdemo" } }, limit: 1, depth: 0, overrideAccess: true })).docs[0] as unknown as Doc | undefined;
const store = existing ?? ((await payload.create({ collection: "stores", data: { name: "Brooklyn Gadgets", slug: "usdemo", subdomain: "usdemo", country: "US", status: "active", subscriptionStatus: "active", orderPrefix: "BKG" } as never, ...sys })) as unknown as Doc);
const storeId = Number(store.id);
const inStore = { ...sys, context: { ...sys.context, storeId } };
const one = async (collection: string, where: Doc) => (await payload.find({ collection: collection as never, where: where as never, limit: 1, depth: 0, overrideAccess: true })).docs[0] as unknown as Doc | undefined;

const cat = (await one("categories", { and: [{ store: { equals: storeId } }, { slug: { equals: "headphones" } }] })) ?? ((await payload.create({ collection: "categories", data: { store: storeId, name: "Headphones", slug: "headphones" } as never, ...inStore })) as unknown as Doc);
const brand = (await one("brands", { and: [{ store: { equals: storeId } }, { slug: { equals: "acme-audio" } }] })) ?? ((await payload.create({ collection: "brands", data: { store: storeId, name: "Acme Audio", slug: "acme-audio" } as never, ...inStore })) as unknown as Doc);
// a published product needs a photo
const photo = (await one("media", { and: [{ store: { equals: storeId } }, { alt: { equals: "Demo product" } }] })) ?? ((await payload.create({ collection: "media", data: { store: storeId, alt: "Demo product" } as never, filePath: "public/icon-512.png", ...inStore })) as unknown as Doc);
for (const p of [
  { title: "Acme Wireless Earbuds", slug: "acme-wireless-earbuds", sku: "ACM-EB1", price: 79.99, salePrice: 59.99, stock: 25 },
  { title: "Acme Studio Headphones", slug: "acme-studio-headphones", sku: "ACM-HP2", price: 149.5, stock: 8 },
]) {
  const found = await one("products", { and: [{ store: { equals: storeId } }, { slug: { equals: p.slug } }] });
  // published (products have drafts; a draft never shows on the store)
  if (!found) await payload.create({ collection: "products", data: { store: storeId, ...p, status: "active", _status: "published", category: cat.id, brand: brand.id, condition: "new", images: [photo.id] } as never, ...inStore });
  else await payload.update({ collection: "products", id: Number(found.id), data: { ...p, status: "active", _status: "published", images: [photo.id] } as never, ...inStore });
}
const pay = await one("store-payments", { store: { equals: storeId } });
const payData = {
  store: storeId,
  cod: { enabled: false },
  bank: { enabled: true, bankName: "Chase", accountTitle: "Brooklyn Gadgets LLC", accountNumber: "000123456789", iban: "Routing 021000021" },
  card: { enabled: false },
  manualMethods: [
    { name: "Zelle", enabled: true, due: "upfront", note: "Instant from your bank app", details: [{ label: "Zelle", value: "pay@brooklyngadgets.test" }], instructions: "Put your order number in the memo." },
    { name: "Card on delivery", enabled: true, due: "on-delivery", note: "Pay the courier by card" },
  ],
};
if (pay) await payload.update({ collection: "store-payments" as never, id: Number(pay.id), data: payData as never, ...inStore });
else await payload.create({ collection: "store-payments" as never, data: payData as never, ...inStore });
const ship = await one("store-shipping", { store: { equals: storeId } });
const shipData = { store: storeId, freeDeliveryThreshold: 100, defaultCharge: 12.5, zones: [{ name: "New York City", places: ["New York", "Brooklyn", "100*", "112*"], charge: 4.99, estimate: "Next day" }, { name: "Rest of the US", rest: true, charge: 9.99 }] };
if (ship) await payload.update({ collection: "store-shipping" as never, id: Number(ship.id), data: shipData as never, ...inStore });
else await payload.create({ collection: "store-shipping" as never, data: shipData as never, ...inStore });
console.log(`Demo US store #${storeId} ready (${store.country} ${store.currency} ${store.timezone})`);
process.exit(0);
