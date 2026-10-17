import { describe, expect, it } from "vitest";
import { stockValueReport, type StockRow } from "@/lib/stock-value";

const now = Date.parse("2026-10-17T12:00:00Z");
const ago = (days: number) => new Date(now - days * 86_400_000).toISOString();
const row = (o: Partial<StockRow>): StockRow => ({ id: 1, title: "X", sku: "X", stock: 1, costPrice: 100, price: 150, lastSoldAt: ago(1), createdAt: ago(400), ...o });

describe("stock value", () => {
  it("adds up what is on the shelves at cost and at today's prices", () => {
    const r = stockValueReport([row({ id: 1, stock: 3, costPrice: 100, price: 150 }), row({ id: 2, stock: 2, costPrice: 40.5, price: 60 })], now);
    expect(r.totals).toMatchObject({ products: 2, units: 5, costValue: 381, retailValue: 570, missingCost: 0, owed: 0 });
  });
  it("products without a cost price are counted (units, retail) but flagged", () => {
    const r = stockValueReport([row({ costPrice: null, stock: 4 }), row({ id: 2, costPrice: 0, stock: 1 })], now);
    expect(r.totals).toMatchObject({ units: 5, costValue: 0, missingCost: 2 });
  });
  it("below 0 (pre-orders / backorders owed) is not on the shelf", () => {
    const r = stockValueReport([row({ stock: -3 }), row({ id: 2, stock: 0 })], now);
    expect(r.totals).toMatchObject({ products: 0, units: 0, costValue: 0, owed: 3 });
  });
});

describe("stock ageing", () => {
  it("sorts stock by the days since it last sold (never sold: since it was added)", () => {
    const r = stockValueReport(
      [
        row({ id: 1, lastSoldAt: ago(5) }),
        row({ id: 2, lastSoldAt: ago(45) }),
        row({ id: 3, lastSoldAt: ago(120) }),
        row({ id: 4, lastSoldAt: null, createdAt: ago(300) }),
        row({ id: 5, lastSoldAt: null, createdAt: ago(10) }),
      ],
      now,
    );
    expect(r.buckets.map((b) => b.products)).toEqual([2, 1, 1, 1]);
  });
  it("slow movers: over 90 days, the most money tied up first", () => {
    const r = stockValueReport(
      [
        row({ id: 1, title: "Cheap", lastSoldAt: ago(200), stock: 1, costPrice: 10 }),
        row({ id: 2, title: "Dear", lastSoldAt: null, createdAt: ago(100), stock: 2, costPrice: 500 }),
        row({ id: 3, title: "Fresh", lastSoldAt: ago(20), stock: 9, costPrice: 999 }),
      ],
      now,
    );
    expect(r.slow.map((s) => [s.title, s.costValue, s.days, s.neverSold])).toEqual([
      ["Dear", 1000, 100, true],
      ["Cheap", 10, 200, false],
    ]);
  });
});
