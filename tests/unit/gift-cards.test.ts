import { describe, expect, it } from "vitest";
import { maskGiftCardCode, newGiftCardCode, normalizeGiftCardCode } from "@/payload/collections/gift-cards";
import { amountToCollect, dueAfterGiftCard, giftCardPaid } from "@/lib/order-money";
import { giftCardProblem } from "@/payload/gift-cards";

describe("gift card codes", () => {
  it("16 characters in groups of 4, without look-alike letters and digits", () => {
    const codes = Array.from({ length: 200 }, newGiftCardCode);
    for (const c of codes) expect(c).toMatch(/^[A-HJKMNP-Z2-9]{4}(-[A-HJKMNP-Z2-9]{4}){3}$/);
    expect(new Set(codes).size).toBe(codes.length);
  });
  it("however a shopper types it", () => {
    expect(normalizeGiftCardCode("abcd efgh jkmn pqrs")).toBe("ABCD-EFGH-JKMN-PQRS");
    expect(normalizeGiftCardCode(" ABCDEFGHJKMNPQRS ")).toBe("ABCD-EFGH-JKMN-PQRS");
    expect(normalizeGiftCardCode("abcd-efgh-jkmn-pqrs")).toBe("ABCD-EFGH-JKMN-PQRS");
    // a store's own shorter codes stay as typed (upper case)
    expect(normalizeGiftCardCode(" welcome50 ")).toBe("WELCOME50");
  });
  it("lists show only the last 4", () => {
    expect(maskGiftCardCode("ABCD-EFGH-JKMN-PQRS")).toBe("••••-••••-••••-PQRS");
  });
});

describe("what is left to pay", () => {
  const order = { total: 100, giftCardAmount: 40, paymentMethod: "cod", paymentDue: "on-delivery" as const, paymentStatus: "unpaid" as const };
  it("the gift card's part is paid; online payments and the rider take the rest", () => {
    expect(giftCardPaid(order)).toBe(40);
    expect(dueAfterGiftCard(order)).toBe(60);
    expect(amountToCollect(order)).toBe(60);
  });
  it("orders without a gift card are unchanged", () => {
    expect(dueAfterGiftCard({ total: 100 })).toBe(100);
    expect(amountToCollect({ ...order, giftCardAmount: undefined })).toBe(100);
  });
  it("never below zero, nothing to collect once paid", () => {
    expect(dueAfterGiftCard({ total: 30, giftCardAmount: 40 })).toBe(0);
    expect(amountToCollect({ ...order, paymentStatus: "paid" })).toBe(0);
  });
});

describe("can the card pay?", () => {
  const card = { id: 1, code: "ABCD-EFGH-JKMN-PQRS", balance: 50, status: "active", expiresAt: null };
  it("active, not expired, with a balance", () => {
    expect(giftCardProblem(card)).toBeNull();
    expect(giftCardProblem({ ...card, expiresAt: new Date(Date.now() + 86_400_000).toISOString() })).toBeNull();
  });
  it("a reason for the shopper otherwise", () => {
    expect(giftCardProblem(null)).toMatch(/can't find/);
    expect(giftCardProblem({ ...card, status: "disabled" })).toMatch(/switched off/);
    expect(giftCardProblem({ ...card, expiresAt: new Date(Date.now() - 1000).toISOString() })).toMatch(/expired/);
    expect(giftCardProblem({ ...card, balance: 0 })).toMatch(/no balance/);
  });
});
