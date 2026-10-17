import { describe, expect, it } from "vitest";
import { availabilityLabel, buyLimit, canOrder, isPreorder, shipsLater } from "@/lib/utils";
import { MAX_QTY_PER_ITEM } from "@/lib/cart-limits";

const day = 86_400_000;
const later = new Date(Date.now() + 10 * day).toISOString();
const earlier = new Date(Date.now() - day).toISOString();
const fmt = () => "27 Oct";

describe("when sold out", () => {
  it("stop selling (default): only what is in stock", () => {
    expect(canOrder({ stock: 0 })).toBe(false);
    expect(canOrder({ stock: 2 })).toBe(true);
    expect(buyLimit({ stock: 2 })).toBe(2);
    expect(buyLimit({ stock: -1 })).toBe(0);
    expect(availabilityLabel({ stock: 0 }).label).toBe("Out of stock");
    expect(availabilityLabel({ stock: 2 }).label).toBe("Only 2 left");
  });
  it("keep selling: orderable at 0 or below, up to the cart's own limit", () => {
    const p = { stock: -3, backorders: "backorder" as const };
    expect(canOrder(p)).toBe(true);
    expect(buyLimit(p)).toBe(MAX_QTY_PER_ITEM);
    expect(availabilityLabel(p)).toMatchObject({ kind: "backorder", label: "On backorder", note: "Ships when back in stock" });
    expect(availabilityLabel({ ...p, backorderNote: "Ships in 2 weeks" }).note).toBe("Ships in 2 weeks");
    // with stock it is an ordinary product
    expect(availabilityLabel({ stock: 8, backorders: "backorder" }).label).toBe("In stock");
  });
  it("pre-order: before its ship date always, afterwards only when none are in stock", () => {
    expect(isPreorder({ stock: 5, backorders: "preorder", releaseDate: later })).toBe(true);
    expect(isPreorder({ stock: 5, backorders: "preorder", releaseDate: earlier })).toBe(false);
    expect(isPreorder({ stock: 0, backorders: "preorder", releaseDate: earlier })).toBe(true);
    expect(isPreorder({ stock: 0, backorders: "preorder" })).toBe(true);
    expect(availabilityLabel({ stock: 5, backorders: "preorder", releaseDate: later }, fmt).label).toBe("Pre-order · ships from 27 Oct");
    expect(availabilityLabel({ stock: 0, backorders: "preorder", releaseDate: earlier }, fmt).label).toBe("Pre-order");
  });
  it("order lines that ship later say so", () => {
    expect(shipsLater({ availability: "preorder", qty: 1 })).toBe("Pre-order – ships when released");
    expect(shipsLater({ availability: "backorder", qty: 3, owedQty: 2 })).toBe("2 of 3 on backorder – they ship when back in stock");
    expect(shipsLater({ availability: "backorder", qty: 2, owedQty: 2 })).toBe("On backorder – ships when back in stock");
    expect(shipsLater({ qty: 1 })).toBe("");
  });
});
