import { inflateSync } from "node:zlib";
import { describe, expect, it } from "vitest";
import { buildInvoicePdf } from "@/lib/invoice-pdf";
import { DEFAULT_SITE_INFO } from "@/lib/site-info";
import type { Order } from "@/lib/types";

/** The text drawn on the pages (pdf-lib writes it as hex strings inside compressed content streams). */
function pdfStrings(bytes: Uint8Array): string {
  const raw = Buffer.from(bytes).toString("latin1");
  let out = "";
  for (const m of raw.matchAll(/stream\r?\n([\s\S]*?)endstream/g)) {
    try {
      const text = inflateSync(Buffer.from(m[1], "latin1")).toString("latin1");
      for (const h of text.matchAll(/<([0-9A-Fa-f]+)>\s*Tj/g)) out += `${Buffer.from(h[1], "hex").toString("latin1")}\n`;
      for (const s of text.matchAll(/\((.*?)\)\s*Tj/g)) out += `${s[1]}\n`;
    } catch {
      /* not a content stream */
    }
  }
  return out;
}

const order = (o: Partial<Order>): Order =>
  ({
    id: "1",
    orderNumber: "INV-1",
    createdAt: "2026-10-17T10:00:00Z",
    status: "confirmed",
    customer: { name: "Sara Khan", phone: "0300 1234567", city: "Lahore", address: "House 5, Street 2" },
    items: [{ productId: "1", slug: "a", name: "Laptop stand", image: "", url: "/", unitPrice: 300, qty: 1, upgrades: [] }],
    subtotal: 300,
    discount: 0,
    couponCode: null,
    deliveryCharge: 100,
    total: 425,
    paymentMethod: "cod",
    paymentStatus: "unpaid",
    paymentScreenshotUrl: null,
    courier: null,
    trackingNumber: null,
    notes: null,
    history: [],
    confirmation: null,
    risk: null,
    userId: null,
    ...o,
  }) as Order;

describe("invoice: company and tax", () => {
  it("a company invoice: BILL TO the company (with its tax number), DELIVER TO the person", async () => {
    const text = pdfStrings(await buildInvoicePdf(order({ billing: { name: "Accounts", company: "Acme Traders", taxId: "NTN-1234567", address: "Plot 9, Industrial Area", city: "Karachi" } }), DEFAULT_SITE_INFO));
    expect(text).toContain("BILL TO");
    expect(text).toContain("DELIVER TO");
    expect(text).toContain("Acme Traders");
    expect(text).toContain("VAT / tax no. NTN-1234567");
    expect(text).toContain("Sara Khan");
  });
  it("one tax line per rate", async () => {
    const text = pdfStrings(await buildInvoicePdf(order({ taxTotal: 25, taxBreakdown: [{ rate: 20, base: 100, tax: 20 }, { rate: 5, base: 100, tax: 5 }] }), DEFAULT_SITE_INFO));
    expect(text).toContain("Tax 20%");
    expect(text).toContain("Tax 5%");
    expect(text).toContain("BILL TO / DELIVER TO");
  });
});
