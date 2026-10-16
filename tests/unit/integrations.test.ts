import { describe, expect, it } from "vitest";
import { hint, openSecrets, sealSecrets } from "@/lib/integrations/secrets";
import { statusFromText } from "@/lib/integrations/providers/courier-status";
import { badSignature, currencyDigits, hmacHex, major, minor, pkParts, sameAmount, sameSig, splitName } from "@/lib/integrations/providers/pay-common";
import { jazzcashHash } from "@/lib/integrations/providers/jazzcash";
import { easypayHashedReq } from "@/lib/integrations/providers/easypaisa";
import { payfastValidationHash } from "@/lib/integrations/providers/payfast-pk";
import { attemptRef, attemptTime, autoPostPage } from "@/lib/integrations/payments";
import { INTEGRATIONS, integrationInfo, isPaymentIntegration } from "@/lib/integrations/catalog";
import { hasProviderCode } from "@/lib/integrations/providers";
import { checkoutMethods } from "@/lib/payments/methods";
import { getGateway, storeGateway } from "@/lib/payments/gateways";
import { apiError, hashKey, newApiKey, paging, productOut, orderOut, updatedSince } from "@/lib/store-api";
import { API_SCOPES } from "@/payload/collections/api-keys";
import type { StoreSettings } from "@/lib/types";

describe("integration keys are stored encrypted", () => {
  it("seals and opens", () => {
    const sealed = sealSecrets({ apiKey: "sk_live_123456789", other: "x" });
    expect(sealed.startsWith("v1.")).toBe(true);
    expect(sealed).not.toContain("sk_live_123456789");
    expect(openSecrets(sealed)).toEqual({ apiKey: "sk_live_123456789", other: "x" });
  });
  it("a damaged or foreign blob opens to nothing", () => {
    const sealed = sealSecrets({ a: "b" });
    expect(openSecrets(`${sealed.slice(0, -4)}AAAA`)).toEqual({});
    expect(openSecrets("v2.x.y.z")).toEqual({});
    expect(openSecrets(null)).toEqual({});
  });
  it("hints show only the last 4 characters of long keys", () => {
    expect(hint("abcdefghijkl")).toBe("••••ijkl");
    expect(hint("short")).toBe("••••");
    expect(hint("")).toBe("");
  });
});

describe("courier status words", () => {
  it("maps typical courier texts", () => {
    expect(statusFromText("Delivered to consignee")).toBe("delivered");
    expect(statusFromText("Out for Delivery")).toBe("out_for_delivery");
    expect(statusFromText("Returned to shipper")).toBe("returned");
  });
});

describe("payment provider signatures (official test vectors where the provider publishes one)", () => {
  it("JazzCash pp_SecureHash – the example from JazzCash's documentation", () => {
    expect(jazzcashHash({ pp_Amount: "2995", pp_MerchantID: "MER123", pp_OrderInfo: "A48cvE28" }, "0F5DD14AE2")).toBe("C7689CDA7474EB1ADCD343FD0C0B676BAD0BA66361CC46DB589BDB0DA4C1C867");
  });
  it("JazzCash hash skips empty fields, pp_SecureHash and non-pp fields", () => {
    const a = jazzcashHash({ pp_Amount: "2995", pp_MerchantID: "MER123", pp_OrderInfo: "A48cvE28", pp_BankID: "", pp_SecureHash: "X", other: "y" }, "0F5DD14AE2");
    expect(a).toBe("C7689CDA7474EB1ADCD343FD0C0B676BAD0BA66361CC46DB589BDB0DA4C1C867");
  });
  it("Easypaisa merchantHashedReq – AES-128-ECB of the sorted fields", () => {
    const fields = { amount: "10", expiryDate: "20150101 151515", orderRefNum: "11001", postBackURL: "http://localhost:9081/local/status.php", storeId: "28" };
    expect(easypayHashedReq(fields, "0123456789ABCDEF")).toBe("d/Y268/jCvKpzMeyzYpayiB6IOex/L99Y7eBeTv2djBoSgvzrrYReEEaBxrYZ+4ctZnNHDFQucZ1Ts5dsPQv4QGLCHtOB5DiVSKuj2Ph/AfRepupRiwe1wyweqLCe1I8Xozmohp66l1IVELIvcGJsdzzGmADtk9bt5qHaSOlv2g=");
  });
  it("Easypaisa refuses a hash key of the wrong length", () => {
    expect(() => easypayHashedReq({ a: "1" }, "short")).toThrow(/16, 24 or 32/);
  });
  it("PayFast validation_hash", () => {
    expect(payfastValidationHash("ORDER-1001", "PzPx6ut-SVay7tCUMqG", "103", "000")).toBe("c7acb875d7fcb94ec955281fc32ea947ad8fcea7a3f537e7b55cbafb3045089f");
  });
  it("Razorpay payment-link signature – the example from Razorpay's documentation", () => {
    expect(hmacHex("sha256", "EnLs21M47BllR3X8PSFtjtbd", "plink_IH3cNucfVEgV68|TSsd1989|paid|pay_IH3d0ara9bSsjQ")).toBe("07ae18789e35093e51d0a491eb9922646f3f82773547e5b0f67ee3f2d3bf7d5b");
  });
  it("signature compare is exact (or case-insensitive when asked) and refuses missing values", () => {
    expect(sameSig("abc", "abc")).toBe(true);
    expect(sameSig("ABC", "abc")).toBe(false);
    expect(sameSig("ABC", "abc", true)).toBe(true);
    expect(sameSig("abc", null)).toBe(false);
    expect(sameSig("", "")).toBe(false);
    expect(badSignature("X").status).toBe(401);
  });
});

describe("payment amounts and references", () => {
  it("counts minor units per currency", () => {
    expect(minor(1500, "PKR")).toBe(150000);
    expect(minor(10.125, "KWD")).toBe(10125);
    expect(minor(1200, "JPY")).toBe(1200);
    expect(major(150000, "PKR")).toBe(1500);
    expect(currencyDigits("bhd")).toBe(3);
    expect(sameAmount(10.004, 10, "USD")).toBe(true);
    expect(sameAmount(10.01, 10, "USD")).toBe(false);
    expect(sameAmount(null, 10, "USD")).toBe(false);
  });
  it("attempt references are short, unique per moment and give back their time", () => {
    const at = Date.UTC(2026, 9, 16, 4, 30, 0);
    const ref = attemptRef(123456, at);
    expect(ref).toMatch(/^[A-Za-z0-9]{1,20}$/);
    expect(attemptTime(ref)?.getTime()).toBe(at);
    expect(attemptRef(123456, at + 1)).not.toBe(ref);
    expect(attemptRef(99999999, at).length).toBeLessThanOrEqual(20);
    // base-36 times contain letters (also "x"): the reference still reads back for any moment
    for (const t of [Date.UTC(2026, 0, 1), Date.UTC(2027, 5, 15, 12), 1_800_000_000_000, 1_799_999_999_999]) expect(attemptTime(attemptRef(42, t))?.getTime()).toBe(t);
  });
  it("Pakistan time is UTC+5", () => {
    expect(pkParts(new Date(Date.UTC(2026, 9, 16, 20, 15, 5)))).toEqual({ y: "2026", m: "10", d: "17", H: "01", M: "15", S: "05" });
  });
  it("splits names for providers that want first and last name", () => {
    expect(splitName("Ali Raza Khan")).toEqual({ first: "Ali", last: "Raza Khan" });
    expect(splitName("Cher")).toEqual({ first: "Cher", last: "Cher" });
    expect(splitName("")).toEqual({ first: "Customer", last: "Customer" });
  });
});

describe("the page that posts a form to a payment provider", () => {
  it("escapes values and only lets the form go to the provider", async () => {
    const res = autoPostPage("https://sandbox.jazzcash.com.pk/CustomerPortal/transactionmanagement/merchantform/", { pp_Description: 'Order "1" <b>', pp_Amount: "100" });
    const html = await res.text();
    expect(html).toContain('value="Order &quot;1&quot; &lt;b&gt;"');
    expect(html).not.toContain("<b>");
    const csp = res.headers.get("content-security-policy") ?? "";
    expect(csp).toContain("form-action https://sandbox.jazzcash.com.pk");
    expect(csp).toContain("default-src 'none'");
    expect(res.headers.get("cache-control")).toBe("no-store");
  });
  it("refuses a non-https target", () => {
    expect(autoPostPage("http://example.com/pay", {}).status).toBe(400);
    expect(autoPostPage("javascript:alert(1)", {}).status).toBe(400);
  });
});

describe("payment integrations catalog", () => {
  const payments = INTEGRATIONS.filter((i) => i.category === "payments");
  it("every payment provider has code, is owner-only, needs the online-payments plan and says it is untested", () => {
    expect(payments.length).toBeGreaterThanOrEqual(11);
    for (const p of payments) {
      expect(hasProviderCode(p.id), p.id).toBe(true);
      expect(p.minRole, p.id).toBe("store_owner");
      expect(p.planFeature, p.id).toBe("online_payments");
      expect(p.verified, p.id).toBe(false);
      expect(p.payment, p.id).toBeDefined();
    }
  });
  it("online JazzCash / Easypaisa never reuse the manual transfer ids", () => {
    expect(integrationInfo("jazzcash")).toBeNull();
    expect(integrationInfo("easypaisa")).toBeNull();
    expect(isPaymentIntegration("jazzcash-online")).toBe(true);
    expect(isPaymentIntegration("cod")).toBe(false);
  });
  it("each payment integration is a registered gateway, but never the store's platform card provider", () => {
    expect(getGateway("paypal")?.id).toBe("paypal");
    expect(getGateway("safepay")?.methods).toEqual(["safepay"]);
    // a Pakistani store without Stripe still has no platform provider (Stores → Online payments is Stripe Connect)
    expect(storeGateway({ country: "PK", currency: "PKR" })).toBeNull();
    expect(storeGateway({ country: "US", currency: "USD" })?.id).toBe("stripe");
  });
});

describe("checkout offers the store's connected payment providers", () => {
  const base = { country: "PK", currency: "PKR", payments: undefined, bank: { bankName: "", accountTitle: "", accountNumber: "", iban: "" }, jazzcash: { title: "", number: "" }, easypaisa: { title: "", number: "" } } as unknown as StoreSettings;
  it("adds them as online methods after the built-in ones", () => {
    const methods = checkoutMethods({ ...base, onlineGateways: [{ id: "safepay", label: "Card (Safepay)", needsEmail: false, icon: "card" }] });
    const m = methods.find((x) => x.id === "safepay");
    expect(m).toMatchObject({ kind: "gateway", due: "upfront", gateway: "safepay", proof: false, label: "Card (Safepay)" });
    expect(methods[0].id).toBe("cod");
  });
  it("carries whether the provider needs an email", () => {
    const methods = checkoutMethods({ ...base, country: "NG", currency: "NGN", onlineGateways: [{ id: "paystack", label: "Paystack", needsEmail: true, icon: "card" }] });
    expect(methods.find((x) => x.id === "paystack")?.needsEmail).toBe(true);
  });
  it("nothing extra when none are connected", () => {
    expect(checkoutMethods(base).some((m) => m.kind === "gateway")).toBe(false);
  });
});

describe("store API", () => {
  it("keys look like se_live_… and are hashed with SHA-256", () => {
    const k = newApiKey();
    expect(k).toMatch(/^se_live_[A-Za-z0-9_-]{32}$/);
    expect(hashKey(k)).toMatch(/^[0-9a-f]{64}$/);
    expect(hashKey(k)).not.toBe(hashKey(newApiKey()));
  });
  it("paging is limited to 100 a page", () => {
    expect(paging(new URL("https://x/api/v1/products?limit=500&page=0"))).toEqual({ limit: 100, page: 1 });
    expect(paging(new URL("https://x/api/v1/products"))).toEqual({ limit: 50, page: 1 });
  });
  it("updated_since needs a real date", () => {
    expect(updatedSince(new URL("https://x/?updated_since=nonsense"))).toEqual([]);
    expect(updatedSince(new URL("https://x/?updated_since=2026-10-16T00:00:00Z"))).toEqual([{ updatedAt: { greater_than: "2026-10-16T00:00:00.000Z" } }]);
  });
  it("errors are JSON with the status", async () => {
    const r = apiError(403, "No");
    expect(r.status).toBe(403);
    expect(await r.json()).toEqual({ error: { status: 403, message: "No" } });
  });
  it("orders never include internal notes or history", () => {
    const o = orderOut({ id: 1, orderNumber: "A-1", status: "pending", notes: "secret", internalNote: "x", history: [{ note: "y" }], customer: { name: "A", phone: "1", city: "C", address: "Z" }, items: [], shipments: [] });
    expect(JSON.stringify(o)).not.toMatch(/secret|internalNote|history/);
    expect(productOut({ id: 2, title: "T", price: 5, stock: 3 })).toMatchObject({ id: 2, price: 5, stock: 3 });
  });
  it("has the four permissions", () => {
    expect(API_SCOPES.map((s) => s.value)).toEqual(["products:read", "products:write", "orders:read", "orders:write"]);
  });
});

describe("accounting and marketplaces", () => {
  it("Daraz request signature – the example from Daraz's (Lazada) documentation", async () => {
    const { darazSign } = await import("@/lib/integrations/providers/daraz");
    expect(darazSign("/order/get", { app_key: "123456", access_token: "test", timestamp: "1517820392000", sign_method: "sha256", order_id: "1234" }, "helloworld")).toBe("4190D32361CFB9581350222F345CB77F3B19F0E31D162316848A2C1FFD5FAB4A");
  });
  it("Daraz signature leaves out empty values and the sign itself", async () => {
    const { darazSign } = await import("@/lib/integrations/providers/daraz");
    const base = { app_key: "123456", access_token: "test", timestamp: "1517820392000", sign_method: "sha256", order_id: "1234" };
    expect(darazSign("/order/get", { ...base, empty: "", sign: "X" }, "helloworld")).toBe(darazSign("/order/get", base, "helloworld"));
  });
  const order = {
    id: 1,
    orderNumber: "BKG-1",
    status: "delivered",
    paymentMethod: "cod",
    paymentStatus: "paid",
    currency: "PKR",
    subtotal: 3000,
    discount: 250,
    deliveryCharge: 200,
    tax: 0,
    total: 3100,
    placedAt: "2026-10-16T10:00:00.000Z",
    marketingConsent: false,
    customer: { name: "A", email: null, phone: "", address: "", city: "", area: null, postalCode: null, country: "PK" },
    items: [
      { productId: "1", sku: "M1", title: "Mouse", qty: 2, unitPrice: 1000 },
      { productId: "2", sku: null, title: "Pad", qty: 1, unitPrice: 1000 },
    ],
    storeId: 1,
  };
  it("QuickBooks receipt lines add up to the order total (extra charges on their own line)", async () => {
    const { receiptLines } = await import("@/lib/integrations/providers/quickbooks");
    const lines = receiptLines(order, "9");
    const net = lines.reduce((s, l) => s + (l.DetailType === "DiscountLineDetail" ? -Number(l.Amount) : Number(l.Amount)), 0);
    expect(net).toBe(3100);
    expect(lines.find((l) => l.Description === "Tax and charges")?.Amount).toBe(150);
    const exact = receiptLines({ ...order, total: 2950 }, "9");
    expect(exact.some((l) => l.Description === "Tax and charges")).toBe(false);
  });
  it("Xero invoice lines add up to the order total", async () => {
    const { invoiceLines } = await import("@/lib/integrations/providers/xero");
    const lines = invoiceLines(order, "200", "NONE");
    expect(Math.round(lines.reduce((s, l) => s + l.Quantity * l.UnitAmount, 0) * 100) / 100).toBe(3100);
    expect(lines.every((l) => l.AccountCode === "200" && l.TaxType === "NONE")).toBe(true);
  });
  it("sign-in integrations have code, and choices before sign-in are lists", () => {
    for (const i of INTEGRATIONS.filter((x) => x.oauth)) {
      expect(hasProviderCode(i.id), i.id).toBe(true);
      for (const f of i.fields.filter((x) => x.beforeConnect)) expect(f.type, `${i.id}.${f.key}`).toBe("select");
    }
    expect(INTEGRATIONS.filter((x) => x.category === "accounting").map((x) => x.id)).toEqual(["quickbooks", "xero"]);
    expect(INTEGRATIONS.filter((x) => x.category === "marketplaces").map((x) => x.id)).toEqual(["daraz", "amazon"]);
  });
  it("every integration in the catalog has code behind it", () => {
    expect(INTEGRATIONS.filter((i) => !hasProviderCode(i.id)).map((i) => i.id)).toEqual([]);
  });
});
