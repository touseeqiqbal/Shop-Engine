/**
 * Puts a test product (with a photo, brand and category) and two gift cards in the default store for the browser test
 * (scripts/tests/e2e-checkout.mjs). Safe to run again: it only refills the stock and the cards. Run BEFORE starting the server
 * (a running server keeps its catalog cached for a while).
 *
 *   node --conditions=react-server node_modules/payload/bin.js run scripts/tests/e2e-seed.ts
 */
import { getPayload } from "payload";
import config from "@payload-config";

const payload = await getPayload({ config });
type Doc = Record<string, unknown>;
const store = Number(((await payload.find({ collection: "stores", where: { isDefault: { equals: true } }, limit: 1, depth: 0, overrideAccess: true })).docs[0] as unknown as Doc).id);
const one = async (collection: string, where: Record<string, unknown>) => ((await payload.find({ collection: collection as never, where: { and: [where, { store: { equals: store } }] } as never, limit: 1, depth: 0, overrideAccess: true })).docs[0] as unknown as Doc | undefined) ?? null;
const ctx = { context: { skipRevalidate: true } };

// a 1×1 PNG
const PNG = Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==", "base64");

const brand = (await one("brands", { slug: { equals: "e2e-brand" } })) ?? ((await payload.create({ collection: "brands", data: { name: "E2E Brand", slug: "e2e-brand", store } as never, overrideAccess: true, depth: 0, ...ctx })) as unknown as Doc);
const category = (await one("categories", { slug: { equals: "e2e-tests" } })) ?? ((await payload.create({ collection: "categories", data: { name: "E2E Tests", slug: "e2e-tests", store } as never, overrideAccess: true, depth: 0, ...ctx })) as unknown as Doc);
let product = await one("products", { slug: { equals: "e2e-test-mouse" } });
if (!product) {
  const media = (await payload.create({ collection: "media", data: { alt: "E2E test mouse", store } as never, file: { data: PNG, mimetype: "image/png", name: "e2e-test-mouse.png", size: PNG.length }, overrideAccess: true, depth: 0, ...ctx })) as unknown as Doc;
  product = (await payload.create({
    collection: "products",
    data: { title: "E2E Test Mouse", slug: "e2e-test-mouse", sku: "E2E-MOUSE", brand: brand.id, category: category.id, price: 1500, stock: 50, status: "active", images: [media.id], store, _status: "published" } as never,
    overrideAccess: true,
    depth: 0,
    ...ctx,
  })) as unknown as Doc;
} else {
  const { setStock } = await import("../../src/payload/stock");
  await setStock(payload, Number(product.id), 50);
}
console.log(`E2E product ${String(product.id)} ready: /e2e-tests/e2e-test-mouse (store ${store})`);

// a pre-order product (nothing in stock, ships in 10 days) for the browser test
const preorder = await one("products", { slug: { equals: "e2e-pre-order-pad" } });
const preData = { backorders: "preorder", releaseDate: new Date(Date.now() + 10 * 86_400_000).toISOString() };
if (preorder) {
  await payload.update({ collection: "products", id: Number(preorder.id), data: preData as never, overrideAccess: true, depth: 0, ...ctx });
  // earlier runs' pre-orders took it below 0 – back to nothing in stock
  const { setStock } = await import("../../src/payload/stock");
  await setStock(payload, Number(preorder.id), 0);
} else
  await payload.create({
    collection: "products",
    data: { title: "E2E Pre-order Pad", slug: "e2e-pre-order-pad", sku: "E2E-PREPAD", brand: brand.id, category: category.id, price: 900, stock: 0, status: "active", images: (product.images as unknown[]) ?? [], store, _status: "published", ...preData } as never,
    overrideAccess: true,
    depth: 0,
    ...ctx,
  });
console.log("E2E pre-order product ready: /e2e-tests/e2e-pre-order-pad");

// two gift cards for the browser test (part of an order / all of it): balances reset, valid for 2 days only –
// this script is for test databases
const expiresAt = new Date(Date.now() + 2 * 86_400_000).toISOString();
for (const [code, balance] of [["E2EP-ART2-CARD-TEST", 500], ["E2EF-ACEV-CARD-TEST", 5000]] as const) {
  const card = await one("gift-cards", { code: { equals: code } });
  const data = { status: "active", initialValue: balance, balance, expiresAt, ledger: [] };
  if (card) await payload.update({ collection: "gift-cards" as never, id: Number(card.id), data: data as never, overrideAccess: true, depth: 0, context: { giftCardServer: true } });
  else await payload.create({ collection: "gift-cards" as never, data: { ...data, code, store, recipientName: "E2E" } as never, overrideAccess: true, depth: 0, context: { giftCardServer: true, storeId: store } });
}
console.log("E2E gift cards ready (500 and 5000)");

// loyalty on for this store, and a customer with 150 points (password from E2E_CUSTOMER_PASSWORD) – test databases only
const conv = (await payload.find({ collection: "store-conversion" as never, where: { store: { equals: store } }, limit: 1, depth: 0, overrideAccess: true })).docs[0] as unknown as Doc | undefined;
const loyalty = { enabled: true, pointsPer100: 1, pointValue: 1, minRedeem: 100 };
if (conv) await payload.update({ collection: "store-conversion" as never, id: Number(conv.id), data: { loyalty } as never, overrideAccess: true, depth: 0, ...ctx });
else await payload.create({ collection: "store-conversion" as never, data: { store, loyalty } as never, overrideAccess: true, depth: 0, context: { skipRevalidate: true, storeId: store } });
const loyalEmail = "e2e.loyal@example.com";
const loyalPassword = process.env.E2E_CUSTOMER_PASSWORD || "E2e-Loyal-2026!";
const found = (await payload.find({ collection: "users", where: { email: { equals: loyalEmail } }, limit: 1, depth: 0, overrideAccess: true })).docs[0] as unknown as Doc | undefined;
const loyal = found
  ? ((await payload.update({ collection: "users", id: Number(found.id), data: { password: loyalPassword, emailVerified: true, name: "E2E Loyal" } as never, overrideAccess: true, depth: 0 })) as unknown as Doc)
  : ((await payload.create({ collection: "users", data: { email: loyalEmail, password: loyalPassword, name: "E2E Loyal", role: "customer", emailVerified: true } as never, overrideAccess: true, depth: 0 })) as unknown as Doc);
const { addPoints, pointsBalance } = await import("../../src/payload/loyalty");
const had = await pointsBalance(payload, store, Number(loyal.id));
if (had !== 150) await addPoints(payload, { storeId: store, userId: Number(loyal.id), points: 150 - had, note: "E2E seed" });
// last run's vouchers go (each run makes one)
await payload.delete({ collection: "gift-cards" as never, where: { customer: { equals: Number(loyal.id) } } as never, overrideAccess: true });
console.log("E2E loyal customer ready (150 points)");

// a digital product (a download, nothing to ship) with its file
let guide = await one("products", { slug: { equals: "e2e-digital-guide" } });
if (!guide) {
  const text = Buffer.from("ShopEngine E2E digital guide\n");
  const file = (await payload.create({ collection: "digital-files" as never, data: { store, title: "E2E Guide (text)" } as never, file: { data: text, mimetype: "text/plain", name: "e2e-guide.txt", size: text.length }, overrideAccess: true, depth: 0, context: { skipRevalidate: true, storeId: store } })) as unknown as Doc;
  guide = (await payload.create({
    collection: "products",
    data: { title: "E2E Digital Guide", slug: "e2e-digital-guide", sku: "E2E-GUIDE", brand: brand.id, category: category.id, price: 300, stock: 1000, status: "active", images: (product.images as unknown[]) ?? [], store, _status: "published", digital: { files: [file.id], noShipping: true, downloadLimit: 3, downloadDays: 30 } } as never,
    overrideAccess: true,
    depth: 0,
    ...ctx,
  })) as unknown as Doc;
}
console.log("E2E digital product ready: /e2e-tests/e2e-digital-guide");
process.exit(0);
