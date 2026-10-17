import { describe, expect, it } from "vitest";
import { applyFlashSales, flashPrice } from "@/lib/flash-pricing";
import { effectivePrice } from "@/lib/utils";

const ends = new Date(Date.now() + 3600e3).toISOString();
type P = { id: string; price: number; salePrice?: number | null; variantOf?: string | null; flashEndsAt?: string | null; variants?: P[] };

describe("flash sale prices", () => {
  it("whole prices stay whole, cents to the cent", () => {
    expect(flashPrice(1499, 10)).toBe(1349);
    expect(flashPrice(19.99, 15)).toBe(16.99);
    expect(flashPrice(100, 95)).toBe(10); // never more than 90 % off
  });
  it("lowers the sale's products only, and says when the price ends", () => {
    const [a, b] = applyFlashSales<P>([{ id: "a", price: 1000 }, { id: "b", price: 1000 }], [{ productIds: ["a"], percent: 20, endsAt: ends }]);
    expect(effectivePrice(a)).toBe(800);
    expect(a.flashEndsAt).toBe(ends);
    expect(b).toEqual({ id: "b", price: 1000 });
  });
  it("never makes a product dearer than its own sale price", () => {
    const [p] = applyFlashSales<P>([{ id: "a", price: 1000, salePrice: 700 }], [{ productIds: ["a"], percent: 10, endsAt: ends }]);
    expect(effectivePrice(p)).toBe(700);
    expect(p.flashEndsAt).toBeUndefined();
    const [q] = applyFlashSales<P>([{ id: "a", price: 1000, salePrice: 950 }], [{ productIds: ["a"], percent: 10, endsAt: ends }]);
    expect(effectivePrice(q)).toBe(900);
  });
  it("options of a product in the sale are discounted too (listed on their own and inside the product)", () => {
    const main: P = { id: "m", price: 500, variants: [{ id: "v1", price: 500, variantOf: "m" }, { id: "v2", price: 600, variantOf: "m" }] };
    const out = applyFlashSales<P>([main, { id: "v1", price: 500, variantOf: "m" }], [{ productIds: ["m"], percent: 10, endsAt: ends }]);
    expect(out[0].variants!.map(effectivePrice)).toEqual([450, 540]);
    expect(effectivePrice(out[1])).toBe(450);
  });
  it("two sales on one product: the bigger discount", () => {
    const [p] = applyFlashSales<P>([{ id: "a", price: 1000 }], [{ productIds: ["a"], percent: 10, endsAt: ends }, { productIds: ["a"], percent: 25, endsAt: ends }]);
    expect(effectivePrice(p)).toBe(750);
  });
  it("no running sale: the very same products", () => {
    const list: P[] = [{ id: "a", price: 1000 }];
    expect(applyFlashSales(list, [])).toBe(list);
  });
});
