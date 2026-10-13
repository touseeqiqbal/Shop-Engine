import { describe, expect, it } from "vitest";
import { buildInvoicePdf, pdfText } from "@/lib/invoice-pdf";
import { DEFAULT_SITE_INFO } from "@/lib/site-info";
import type { Order } from "@/lib/types";

const order = {
  id: "1",
  orderNumber: "UTS-261010-123456",
  createdAt: "2026-10-10T10:00:00Z",
  status: "delivered",
  customer: { name: "علی Khan", phone: "0300-1234567", email: "ali@example.com", city: "Karachi", address: "House 1, Street 2 – Saddar" },
  items: [{ productId: "7", slug: "m185", name: "Logitech M185 Wireless Mouse – a very long product name that must wrap onto a second line in the invoice table", image: "", url: "", unitPrice: 3500, qty: 2, upgrades: [] }],
  subtotal: 7000,
  discount: 500,
  couponCode: "SAVE",
  deliveryCharge: 200,
  total: 6700,
  paymentMethod: "cod",
  paymentStatus: "partial",
  advancePaid: 1000,
  history: [],
} as unknown as Order;

describe("invoice PDF", () => {
  it("maps text the standard PDF fonts can't draw", () => {
    expect(pdfText("Rs 1,000 – “ok” ×2 é")).toBe('Rs 1,000 - "ok" x2 e');
    expect(pdfText("علی")).toBe("???");
  });
  it("builds a valid PDF for an order", async () => {
    const bytes = await buildInvoicePdf(order, DEFAULT_SITE_INFO);
    expect(Buffer.from(bytes.slice(0, 5)).toString()).toBe("%PDF-");
    expect(bytes.length).toBeGreaterThan(1500);
  });
});
