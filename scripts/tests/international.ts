/**
 * Stores outside Pakistan (real database): a store's country brings its currency and time zone; prices keep their
 * cents; orders keep the currency they were placed in; a store's own payment methods get stable ids, their names and
 * "paid before shipping / on delivery" reach the order; shipping zones match typed cities and postcodes; the original
 * shop stays PKR. Creates its own store, settings, products and orders and removes them afterwards.
 *
 *   node --conditions=react-server node_modules/payload/bin.js run scripts/tests/international.ts
 */
import { randomUUID } from "node:crypto";
import { getPayload } from "payload";
import config from "@payload-config";
import { placeOrderCms } from "../../src/lib/cms/sales";
import { loadCommerceSettings } from "../../src/lib/cms/commerce";
import { checkoutMethods } from "../../src/lib/payments/methods";
import { deliveryCharge } from "../../src/lib/cities";
import { generateOrderNumber } from "../../src/lib/repo/orders";
import { storeLocaleOf, storeMoneyOf } from "../../src/payload/store-locale";
import type { Order, StoreSettings } from "../../src/lib/types";

const payload = await getPayload({ config });
const sys = { overrideAccess: true, depth: 0, context: { system: true, skipRevalidate: true } } as const;
let failed = 0;
const check = (ok: boolean, what: string) => {
  console.log(`${ok ? "✓" : "✗"} ${what}`);
  if (!ok) failed++;
};
const refused = async (fn: () => Promise<unknown>) => {
  try {
    await fn();
    return false;
  } catch {
    return true;
  }
};
type Doc = Record<string, unknown>;
const tag = `intl${Date.now().toString(36)}`;
const created: { collection: string; id: number }[] = [];
async function make<T extends Doc>(collection: string, data: Doc, context: Doc = {}): Promise<T> {
  const doc = (await payload.create({ collection: collection as never, data: data as never, ...sys, context: { ...sys.context, ...context } })) as unknown as T;
  created.push({ collection, id: Number(doc.id) });
  return doc;
}

// what an interrupted earlier run left behind
for (const [collection, field, prefix] of [["products", "slug", "mug-intl"], ["brands", "slug", "intl-brand-intl"], ["categories", "slug", "intl-cat-intl"]] as const) {
  const old = await payload.find({ collection, where: { [field]: { like: prefix } }, limit: 50, depth: 0, overrideAccess: true });
  for (const d of old.docs) await payload.delete({ collection, id: Number(d.id), ...sys, context: { ...sys.context, migrating: true } }).catch(() => undefined);
}

try {
  // ── the store's region ──
  const store = await make<Doc>("stores", { name: `US ${tag}`, slug: `us-${tag}`, subdomain: `us-${tag}`, country: "United States", status: "active", subscriptionStatus: "active" });
  const storeId = Number(store.id);
  check(store.country === "US" && store.currency === "USD" && store.timezone === "America/New_York", `a country name becomes its code and brings its currency and time zone (${store.country} ${store.currency} ${store.timezone})`);
  const plain = await make<Doc>("stores", { name: `Plain ${tag}`, slug: `plain-${tag}`, subdomain: `plain-${tag}` });
  check(plain.country === "PK" && plain.currency === "PKR" && plain.timezone === "Asia/Karachi", `a store without a country starts in Pakistan (as before): ${plain.country} ${plain.currency} ${plain.timezone}`);
  const moved = (await payload.update({ collection: "stores", id: Number(plain.id), data: { country: "AE" } as never, ...sys })) as unknown as Doc;
  check(moved.currency === "AED" && moved.timezone === "Asia/Dubai", "changing only the country moves the currency and time zone with it");
  const kept = (await payload.update({ collection: "stores", id: Number(plain.id), data: { country: "GB", currency: "USD" } as never, ...sys })) as unknown as Doc;
  check(kept.currency === "USD" && kept.timezone === "Europe/London", `…unless a currency was chosen at the same time (${kept.currency} ${kept.timezone})`);
  check(await refused(() => payload.update({ collection: "stores", id: storeId, data: { currency: "XYZ" } as never, ...sys })), "an unknown currency is refused");
  check(await refused(() => payload.update({ collection: "stores", id: storeId, data: { timezone: "Mars/Olympus" } as never, ...sys })), "an unknown time zone is refused");
  check(await refused(() => payload.update({ collection: "stores", id: storeId, data: { country: "Atlantis" } as never, ...sys })), "an unknown country is refused");

  const loc = await storeLocaleOf(payload, storeId);
  check(loc.currency === "USD" && loc.locale === "en-US", "the store's locale for messages and admin screens");
  check((await storeMoneyOf(payload, storeId))(1234.5) === "$1,234.50", "money in the store's currency, with cents");
  const original = await storeLocaleOf(payload, null);
  check(original.currency === "PKR" && (await storeMoneyOf(payload, null))(145000) === "Rs 145,000", "the original shop stays Rs");

  // ── the store's own payment methods and zones ──
  const pay = await make<Doc>(
    "store-payments",
    {
      store: storeId,
      cod: { enabled: true },
      jazzcash: { enabled: true, title: "Should not show", number: "0300-1234567" },
      bank: { enabled: true, bankName: "Chase", accountTitle: "US Shop", accountNumber: "000123456789", iban: "" },
      card: { enabled: false },
      manualMethods: [
        { name: "Zelle", enabled: true, due: "upfront", details: [{ label: "Zelle", value: "pay@usshop.test" }], instructions: "Put your order number in the memo." },
        { name: "Card on delivery", enabled: true, due: "on-delivery" },
        { name: "Zelle", enabled: true, due: "upfront", details: [{ label: "Zelle", value: "second@usshop.test" }] },
        { name: "Bank", enabled: true, due: "upfront", details: [{ label: "Account", value: "1" }] },
      ],
    },
    { storeId },
  );
  const rows = (pay.manualMethods as Doc[]).map((m) => m.methodId);
  check(JSON.stringify(rows) === JSON.stringify(["zelle", "card-on-delivery", "zelle-2", "bank-own"]), `each own method gets a stable, unique id that never clashes with a built-in one (${rows.join(", ")})`);
  const renamed = (await payload.update({ collection: "store-payments" as never, id: Number(pay.id), data: { manualMethods: (pay.manualMethods as Doc[]).map((m, i) => (i === 0 ? { ...m, name: "Zelle (instant)" } : m)) } as never, ...sys })) as unknown as Doc;
  check((renamed.manualMethods as Doc[])[0].methodId === "zelle", "renaming a method keeps its id (old orders still point at it)");
  check(await refused(() => make("store-shipping", { store: storeId, shipTo: ["Atlantis"] }, { storeId })), "an unknown delivery country is refused");
  const ship = await make<Doc>("store-shipping", { store: storeId, freeDeliveryThreshold: 0, defaultCharge: 9.99, shipTo: ["Canada", "uk"], zones: [{ name: "NYC", places: ["New York", "100*"], charge: 4.5 }, { name: "Rest", rest: true, charge: 7.25 }, { name: "Canada", countries: ["canada"], rest: true, charge: 19.5 }] }, { storeId });
  check(JSON.stringify(ship.shipTo) === JSON.stringify(["CA", "GB"]) && JSON.stringify((ship.zones as Doc[])[2].countries) === JSON.stringify(["CA"]), `delivery countries typed as names are kept as codes (${JSON.stringify(ship.shipTo)})`);

  const settings = { freeDeliveryThreshold: 0, defaultDeliveryCharge: 0, cityCharges: {}, advanceThreshold: 0, advanceAmount: 0, bank: { bankName: "", accountTitle: "", accountNumber: "", iban: "" }, jazzcash: { title: "", number: "" }, easypaisa: { title: "", number: "" }, ...(await loadCommerceSettings(storeId)) } as StoreSettings;
  check(settings.country === "US" && settings.currency === "USD", "checkout settings carry the store's country and currency");
  const offered = checkoutMethods(settings).map((m) => m.id);
  check(JSON.stringify(offered) === JSON.stringify(["cod", "bank", "zelle", "card-on-delivery", "zelle-2", "bank-own"]), `checkout offers COD, bank and the store's own methods – no JazzCash outside Pakistan (${offered.join(", ")})`);
  check(deliveryCharge("Brooklyn", 30, settings, "10001") === 4.5 && deliveryCharge("New York", 30, settings) === 4.5 && deliveryCharge("Austin", 30, settings, "78701") === 7.25, "zones match typed cities and postcode starts; cents kept");
  check(deliveryCharge("Toronto", 30, settings, "M5V", "CA") === 19.5 && deliveryCharge("Manchester", 30, settings, "", "GB") === 9.99 && deliveryCharge("Rochester", 30, settings, "", "US") === 7.25, "an address abroad uses its country's zone (else the default charge), never a home zone");

  // ── orders keep cents and their currency ──
  const inStore = { ...sys, context: { ...sys.context, storeId } };
  const category = (await payload.create({ collection: "categories", data: { store: storeId, name: `Intl ${tag}`, slug: `intl-cat-${tag}` } as never, ...inStore })) as unknown as Doc;
  created.push({ collection: "categories", id: Number(category.id) });
  const brand = (await payload.create({ collection: "brands", data: { store: storeId, name: `Intl ${tag}`, slug: `intl-brand-${tag}` } as never, ...inStore })) as unknown as Doc;
  created.push({ collection: "brands", id: Number(brand.id) });
  const product = (await payload.create({ collection: "products", data: { store: storeId, title: `Mug ${tag}`, slug: `mug-${tag}`, sku: `MUG-${tag}`, price: 19.99, stock: 10, status: "draft", category: category.id, brand: brand.id } as never, ...inStore })) as unknown as Doc;
  created.push({ collection: "products", id: Number(product.id) });
  check(Number(product.price) === 19.99, "a price keeps its cents");

  const now = new Date("2026-10-15T02:30:00Z");
  const number = generateOrderNumber(now, "US", loc.timezone);
  check(/^US-261014-\d{6}$/.test(number), `order numbers use the store's date (2:30 UTC is still the 14th in New York: ${number})`);

  const order: Order = {
    id: randomUUID(),
    orderNumber: `${number.slice(0, 10)}${String(Date.now()).slice(-6)}`,
    createdAt: now.toISOString(),
    status: "awaiting-confirmation",
    customer: { name: "Intl Test", phone: "+12125550123", city: "Brooklyn", region: "NY", postalCode: "11201", country: "US", address: "1 Main St" },
    items: [{ productId: String(product.id), slug: String(product.slug), name: String(product.title), image: "", url: "/", unitPrice: 19.99, qty: 2, upgrades: [] }],
    subtotal: 39.98,
    discount: 0,
    couponCode: null,
    deliveryCharge: 4.5,
    total: 44.48,
    paymentMethod: "zelle",
    paymentMethodLabel: "Zelle (instant)",
    paymentDue: "upfront",
    currency: "USD",
    paymentStatus: "awaiting-verification",
    paymentReference: `ZEL-${tag}`.toUpperCase(),
    paymentScreenshotUrl: null,
    courier: null,
    trackingNumber: null,
    notes: null,
    history: [{ status: "awaiting-confirmation", at: now.toISOString() }],
    confirmation: null,
    risk: null,
    userId: null,
    storeId,
  } as Order;
  const placed = await placeOrderCms(order, [{ id: String(product.id), qty: 2, title: String(product.title) }], { attemptId: `intl-${tag}`, couponCode: null });
  check(placed.ok === true, "a dollar order is placed through the checkout code");
  if (placed.ok) {
    const id = Number(placed.order.id);
    created.push({ collection: "orders", id });
    const saved = (await payload.findByID({ collection: "orders", id, depth: 0, overrideAccess: true })) as unknown as Doc;
    const c = saved.customer as Doc;
    check(Number(saved.total) === 44.48 && Number(saved.subtotal) === 39.98 && saved.currency === "USD", `amounts keep their cents and the order keeps its currency (${saved.total} ${saved.currency})`);
    check(saved.paymentMethodLabel === "Zelle (instant)" && saved.paymentDue === "upfront", "the order keeps its method's name and when it is paid");
    check(c.region === "NY" && c.postalCode === "11201" && c.country === "US", "the address keeps state, postcode and country");
    check(await refused(() => payload.update({ collection: "orders", id, data: { status: "confirmed" } as never, overrideAccess: true, depth: 0 })), "a method paid before shipping holds the order until the payment is approved");
  }

  // an order made in the admin: currency, name and due time come from the store; totals keep cents
  const admin = (await payload.create({
    collection: "orders",
    data: { store: storeId, orderNumber: `US-ADM-${tag}`.toUpperCase().slice(0, 30), placedAt: new Date().toISOString(), status: "pending", customer: { name: "Walk In", phone: "+12125550124", city: "Austin", address: "2 Side St" }, items: [{ product: product.id, title: String(product.title), unitPrice: 19.99, qty: 3 }], paymentMethod: "card-on-delivery", paymentStatus: "unpaid", deliveryCharge: 0 } as never,
    overrideAccess: true,
    depth: 0,
    context: { skipNotify: true },
  })) as unknown as Doc;
  created.push({ collection: "orders", id: Number(admin.id) });
  check(Number(admin.subtotal) === 59.97 && Number(admin.total) === 59.97, `admin order totals keep cents (${admin.total}, was rounded to whole units before)`);
  check(admin.currency === "USD" && admin.paymentMethodLabel === "Card on delivery" && admin.paymentDue === "on-delivery", "an admin order gets the store's currency and the method's name / due time from the store's settings");
  const confirmed = (await payload.update({ collection: "orders", id: Number(admin.id), data: { status: "confirmed" } as never, overrideAccess: true, depth: 0, context: { skipNotify: true } })) as unknown as Doc;
  check(confirmed.status === "confirmed", "an 'on delivery' method can be confirmed before it is paid (like cash on delivery)");
  const switched = (await payload.update({ collection: "orders", id: Number(admin.id), data: { paymentMethod: "bank" } as never, overrideAccess: true, depth: 0, context: { skipNotify: true } })) as unknown as Doc;
  check(switched.paymentMethodLabel === "Bank Transfer" && switched.paymentDue === "upfront", "switching the method updates its name and due time");
} finally {
  for (const c of created.reverse())
    await payload.delete({ collection: c.collection as never, id: c.id, ...sys, context: { ...sys.context, migrating: true, skipStock: true } }).catch((e) => console.warn(`cleanup ${c.collection} ${c.id}: ${(e as Error).message}`));
}
console.log(failed ? `International test FAILED (${failed})` : "International test passed");
process.exit(failed ? 1 : 0);
