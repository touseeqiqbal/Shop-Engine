import "server-only";
import { commitTransaction, createLocalReq, initTransaction, killTransaction } from "payload";
import { payloadClient } from "@/lib/cms/catalog-source";
import { loyaltySettings, pointsBalance, takePoints, voucherValue, type LoyaltySettings } from "@/payload/loyalty";

/**
 * Loyalty points on the storefront (account page): the customer's balance in this store, their vouchers, and turning
 * points into a voucher (a gift card in their name – it pays at checkout like any gift card).
 */

type Doc = Record<string, unknown>;

export type LoyaltySummary = {
  settings: LoyaltySettings;
  balance: number;
  /** what the balance is worth as a voucher */
  worth: number;
  vouchers: { code: string; balance: number; value: number; createdAt: string; expiresAt: string | null }[];
};

export async function loyaltySummary(userId: number, storeId: number | null): Promise<LoyaltySummary | null> {
  const payload = await payloadClient();
  const settings = await loyaltySettings(payload, storeId);
  if (!settings.enabled) return null;
  const balance = await pointsBalance(payload, storeId, userId);
  const cards = (await payload.find({ collection: "gift-cards" as never, where: { and: [{ customer: { equals: userId } }, storeId == null ? { store: { exists: false } } : { store: { equals: storeId } }, { status: { equals: "active" } }] } as never, sort: "-createdAt", limit: 10, depth: 0, overrideAccess: true })).docs as unknown as Doc[];
  return {
    settings,
    balance,
    worth: voucherValue(balance, settings),
    vouchers: cards.map((c) => ({ code: String(c.code), balance: Number(c.balance) || 0, value: Number(c.initialValue) || 0, createdAt: String(c.createdAt), expiresAt: c.expiresAt ? String(c.expiresAt) : null })),
  };
}

/**
 * All of the customer's points → one voucher (at least the store's minimum). The points are taken and the voucher made
 * in ONE transaction: two clicks at once can never turn the same points into two vouchers.
 */
export async function pointsToVoucher(user: { id: number; email: string; name?: string | null }, storeId: number | null): Promise<{ ok: true; code: string; value: number } | { ok: false; reason: "off" | "few" | "zero" | "changed"; message: string }> {
  const payload = await payloadClient();
  const settings = await loyaltySettings(payload, storeId);
  if (!settings.enabled) return { ok: false, reason: "off", message: "This shop doesn't have loyalty points." };
  const points = await pointsBalance(payload, storeId, user.id);
  if (points < settings.minRedeem) return { ok: false, reason: "few", message: `You need at least ${settings.minRedeem} points for a voucher – you have ${points}.` };
  const value = voucherValue(points, settings);
  if (!(value > 0)) return { ok: false, reason: "zero", message: "Your points aren't worth a voucher yet." };
  const req = await createLocalReq({}, payload);
  await initTransaction(req);
  try {
    if (!(await takePoints(payload, { storeId, userId: user.id, points, note: "Turned into a voucher" }, req))) {
      await killTransaction(req);
      return { ok: false, reason: "changed", message: "Your points changed meanwhile – please try again." };
    }
    const card = (await payload.create({
      collection: "gift-cards" as never,
      data: { store: storeId, initialValue: value, recipientName: user.name ?? null, recipientEmail: user.email, sendEmail: false, customer: user.id, fromPoints: points, expiresAt: new Date(Date.now() + 365 * 86_400_000).toISOString() } as never,
      overrideAccess: true,
      depth: 0,
      req,
      context: { giftCardServer: true, storeId },
    })) as unknown as Doc;
    await commitTransaction(req);
    return { ok: true, code: String(card.code), value };
  } catch (e) {
    await killTransaction(req);
    throw e;
  }
}
