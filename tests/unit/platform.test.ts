import { describe, expect, it } from "vitest";
import { matchStore, storeAvailability, storeOrigin, type StoreDirectoryEntry } from "@/lib/tenant-shared";
import { encodeForm, fromMinor, signStripePayload, toMinor, verifyStripeWebhook } from "@/lib/payments/stripe";
import { backoffMs, MAX_ATTEMPTS } from "@/lib/outbox";
import { orderTotals } from "@/lib/order-totals";
import { couponDiscount, eligibleSubtotal } from "@/lib/coupons";
import { hasFeature, type Limits } from "@/lib/billing";
import { hashInviteToken } from "@/payload/collections/StoreMemberships";
import type { CatalogProduct, Coupon, StoreSettings } from "@/lib/types";

const store = (s: Partial<StoreDirectoryEntry> & { id: number }): StoreDirectoryEntry => ({
  slug: `s${s.id}`,
  name: `Store ${s.id}`,
  status: "active",
  subscriptionStatus: "active",
  isDefault: false,
  subdomain: null,
  customDomain: null,
  domainVerified: false,
  currency: "PKR",
  country: "Pakistan",
  timezone: "Asia/Karachi",
  language: "en",
  orderPrefix: "",
  trialEndsAt: null,
  graceEndsAt: null,
  ...s,
});

describe("which store a web address belongs to", () => {
  const stores = [store({ id: 1, isDefault: true }), store({ id: 2, subdomain: "acme" }), store({ id: 3, customDomain: "shop.example.com", domainVerified: true }), store({ id: 4, customDomain: "evil.example.org", domainVerified: false })];
  it("verified custom domain (with or without www)", () => {
    expect(matchStore(stores, "shop.example.com", "shopengine.app")?.id).toBe(3);
    expect(matchStore(stores, "WWW.Shop.Example.com:443", "shopengine.app")?.id).toBe(3);
  });
  it("an UNVERIFIED custom domain is not routed to the store", () => {
    expect(matchStore(stores, "evil.example.org", "shopengine.app")?.id).toBe(1);
  });
  it("platform sub-domains; unknown ones belong to nobody", () => {
    expect(matchStore(stores, "acme.shopengine.app", "shopengine.app")?.id).toBe(2);
    expect(matchStore(stores, "nope.shopengine.app", "shopengine.app")).toBeNull();
  });
  it("the main address (and anything else) is the default store", () => {
    expect(matchStore(stores, "shopengine.app", "shopengine.app")?.id).toBe(1);
    expect(matchStore(stores, "localhost:3000", "")?.id).toBe(1);
  });
  it("store addresses", () => {
    expect(storeOrigin(stores[2], "https://main.test", "shopengine.app")).toBe("https://shop.example.com");
    expect(storeOrigin(stores[1], "https://main.test", "shopengine.app")).toBe("https://acme.shopengine.app");
    expect(storeOrigin(stores[0], "https://main.test/", "shopengine.app")).toBe("https://main.test");
  });
});

describe("whether a shop is open", () => {
  const now = Date.parse("2026-10-14T00:00:00Z");
  it("draft = coming soon; suspended / closed = offline", () => {
    expect(storeAvailability(store({ id: 2, status: "draft" }), now)).toEqual({ open: false, reason: "setting-up" });
    expect(storeAvailability(store({ id: 2, status: "suspended" }), now)).toEqual({ open: false, reason: "suspended" });
    expect(storeAvailability(null, now)).toEqual({ open: false, reason: "missing" });
  });
  it("plan ended, or past due beyond the grace date = offline; within grace = open", () => {
    expect(storeAvailability(store({ id: 2, subscriptionStatus: "expired" }), now).open).toBe(false);
    expect(storeAvailability(store({ id: 2, subscriptionStatus: "past_due", graceEndsAt: "2026-10-10T00:00:00Z" }), now).open).toBe(false);
    expect(storeAvailability(store({ id: 2, subscriptionStatus: "past_due", graceEndsAt: "2026-10-20T00:00:00Z" }), now).open).toBe(true);
  });
  it("the default store never goes offline for billing", () => {
    expect(storeAvailability(store({ id: 1, isDefault: true, subscriptionStatus: "expired" }), now).open).toBe(true);
  });
});

describe("Stripe", () => {
  const secret = "whsec_test";
  const body = JSON.stringify({ id: "evt_1", type: "checkout.session.completed", data: { object: { id: "cs_1" } } });
  it("accepts a correctly signed, recent webhook", () => {
    const t = Math.floor(Date.now() / 1000);
    expect(verifyStripeWebhook(body, signStripePayload(body, secret, t), secret).id).toBe("evt_1");
  });
  it("refuses a wrong signature, a changed body and an old (replayed) event", () => {
    const t = Math.floor(Date.now() / 1000);
    expect(() => verifyStripeWebhook(body, signStripePayload(body, "whsec_other", t), secret)).toThrow();
    expect(() => verifyStripeWebhook(body.replace("cs_1", "cs_2"), signStripePayload(body, secret, t), secret)).toThrow();
    expect(() => verifyStripeWebhook(body, signStripePayload(body, secret, t - 3600), secret)).toThrow(/too old/i);
    expect(() => verifyStripeWebhook(body, null, secret)).toThrow();
  });
  it("form encoding and money units", () => {
    expect(encodeForm({ a: { b: [1, 2] }, c: "x y" })).toBe("a%5Bb%5D%5B0%5D=1&a%5Bb%5D%5B1%5D=2&c=x%20y");
    expect(toMinor(1234.5, "PKR")).toBe(123450);
    expect(toMinor(500, "JPY")).toBe(500);
    expect(fromMinor(123450, "pkr")).toBe(1234.5);
  });
});

describe("outbox retries", () => {
  it("wait 1, 2, 4 … minutes, at most 6 hours; give up after a number of tries", () => {
    expect(backoffMs(1)).toBe(60_000);
    expect(backoffMs(3)).toBe(240_000);
    expect(backoffMs(30)).toBe(6 * 3600_000);
    expect(MAX_ATTEMPTS).toBeGreaterThan(3);
  });
});

const settings = (over: Partial<StoreSettings> = {}): StoreSettings =>
  ({
    freeDeliveryThreshold: 10000,
    defaultDeliveryCharge: 300,
    cityCharges: {},
    advanceThreshold: 0,
    advanceAmount: 0,
    bank: { bankName: "", accountTitle: "", accountNumber: "", iban: "" },
    jazzcash: { title: "", number: "" },
    easypaisa: { title: "", number: "" },
    ...over,
  }) as StoreSettings;

describe("order totals (same in the browser and on the server)", () => {
  it("free delivery is judged AFTER the discount", () => {
    expect(orderTotals({ subtotal: 10500, discount: 1000, city: "Karachi", method: "card", settings: settings() }).delivery).toBe(300);
    expect(orderTotals({ subtotal: 12000, discount: 1000, city: "Karachi", method: "card", settings: settings() }).delivery).toBe(0);
  });
  it("a free-delivery discount makes delivery free; the discount never exceeds the items", () => {
    const t = orderTotals({ subtotal: 2000, discount: 5000, city: "Karachi", method: "card", settings: settings(), freeShipping: true });
    expect(t).toMatchObject({ discount: 2000, delivery: 0, total: 0 });
  });
  it("tax included in prices vs added on top", () => {
    const tax = { enabled: true, rate: 18, inclusive: true, label: "GST", taxDelivery: false };
    const incl = orderTotals({ subtotal: 11800, discount: 0, city: "Karachi", method: "card", settings: settings({ tax }) });
    expect(incl).toMatchObject({ tax: 1800, taxAdded: 0, total: 11800 });
    const excl = orderTotals({ subtotal: 10000, discount: 0, city: "Karachi", method: "card", settings: settings({ tax: { ...tax, inclusive: false } }) });
    expect(excl).toMatchObject({ tax: 1800, taxAdded: 1800, total: 11800 });
  });
});

describe("discounts", () => {
  const coupon = (c: Partial<Coupon>): Coupon => ({ code: "X", kind: "percent", value: 10, minOrder: 0, active: true, used: 0, usageLimit: null, expiresAt: null, ...c }) as Coupon;
  it("percent / fixed / free delivery", () => {
    expect(couponDiscount(coupon({ kind: "percent", value: 10 }), 5000)).toBe(500);
    expect(couponDiscount(coupon({ kind: "fixed", value: 9000 }), 5000)).toBe(5000);
    expect(couponDiscount(coupon({ kind: "free_shipping", value: 0 }), 5000)).toBe(0);
  });
  it("a product discount also covers that product's variants – and nothing else", async () => {
    const products = [{ id: "p1" }, { id: "v1", variantOf: "p1" }, { id: "p2" }] as CatalogProduct[];
    const lines = [
      { productId: "v1", unitPrice: 1000, qty: 2 },
      { productId: "p2", unitPrice: 500, qty: 1 },
    ];
    expect(await eligibleSubtotal(coupon({ appliesTo: "products", productIds: ["p1"] }), lines, products)).toBe(2000);
    expect(await eligibleSubtotal(coupon({}), lines, products)).toBe(2500);
  });
});

describe("plans and invitations", () => {
  const limits = (features: string[] | null): Limits => ({ maxProducts: 0, maxStaffMembers: 0, maxStorageGb: 0, features });
  it("no plan = no restrictions; a plan allows only its features", () => {
    expect(hasFeature(limits(null), "pos")).toBe(true);
    expect(hasFeature(limits(["discounts"]), "pos")).toBe(false);
    expect(hasFeature(limits(["pos"]), "pos")).toBe(true);
  });
  it("invitation tokens are stored only as a hash", () => {
    expect(hashInviteToken("abc")).toMatch(/^[0-9a-f]{64}$/);
    expect(hashInviteToken("abc")).not.toContain("abc");
  });
});
