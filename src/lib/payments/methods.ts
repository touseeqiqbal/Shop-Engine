import type { StoreSettings } from "../types";
import { gatewayInfo, gatewaySupports } from "./catalog";

/**
 * Payment methods – what a shopper can choose at checkout (client-safe; the server checks the same list).
 *
 * Three kinds:
 *  - "cod"      paid when the order arrives (cash on delivery, or a store's own "card on delivery", "pay at pickup" …)
 *  - "manual"   paid BEFORE the order ships, outside the shop (bank transfer, a mobile wallet, UPI, M-Pesa, PIX …):
 *               the shopper uploads the receipt and its transaction id; staff check it before the order ships
 *  - "gateway"  an online payment provider takes the payment on its own page; the order is paid only when the provider
 *               says so (verified webhook) – see lib/payments/gateways
 *
 * Built in: Cash on Delivery, bank transfer and card everywhere; JazzCash and EasyPaisa for stores in Pakistan.
 * Every store adds its own in /cms → Settings → Payments → "Other payment methods" (any country's wallets and banks).
 */

export type PaymentKind = "cod" | "manual" | "gateway";
/** When the money comes: before the order ships ("upfront") or when it is delivered / collected. */
export type PaymentDue = "upfront" | "on-delivery";
export type PaymentIcon = "cash" | "wallet" | "bank" | "card" | "other";

export interface CheckoutMethod {
  /** stored on the order: "cod", "bank", "card", "jazzcash" … or a store's own ("upi", "m-pesa") */
  id: string;
  label: string;
  kind: PaymentKind;
  due: PaymentDue;
  /** short line under the option at checkout */
  note: string;
  /** the shopper uploads a payment screenshot and types its transaction id */
  proof: boolean;
  /** where to send the money (manual methods) */
  account: { label: string; value: string }[];
  /** the store's own steps, e.g. "Use your order number as the reference" */
  instructions?: string;
  /** the provider that takes it (gateway methods) */
  gateway?: string;
  icon: PaymentIcon;
}

/** A store's own method (/cms → Settings → Payments → Other payment methods). */
export interface ManualMethodSettings {
  id: string;
  name: string;
  enabled: boolean;
  note?: string;
  instructions?: string;
  details: { label: string; value: string }[];
  /** "upfront" = paid before shipping, with a receipt; "on-delivery" = like cash on delivery */
  due: PaymentDue;
  icon?: PaymentIcon;
}

/** Methods the platform knows. `countries` = only offered by stores in these countries. */
export const BUILT_IN_METHODS: Record<string, { label: string; kind: PaymentKind; due: PaymentDue; icon: PaymentIcon; countries?: readonly string[] }> = {
  cod: { label: "Cash on Delivery", kind: "cod", due: "on-delivery", icon: "cash" },
  jazzcash: { label: "JazzCash", kind: "manual", due: "upfront", icon: "wallet", countries: ["PK"] },
  easypaisa: { label: "EasyPaisa", kind: "manual", due: "upfront", icon: "wallet", countries: ["PK"] },
  bank: { label: "Bank Transfer", kind: "manual", due: "upfront", icon: "bank" },
  card: { label: "Debit / Credit Card", kind: "gateway", due: "upfront", icon: "card" },
};

/** "Bank Transfer", "UPI" … – an order keeps the name it was placed with (`paymentMethodLabel`); else the built-in name. */
export function paymentLabel(method: string | null | undefined, snapshot?: string | null): string {
  if (snapshot) return snapshot;
  const m = String(method ?? "");
  return BUILT_IN_METHODS[m]?.label ?? (m ? m.replace(/[-_]+/g, " ").replace(/^\w/, (c) => c.toUpperCase()) : "");
}

/** An id for a store's own method from its name ("M-Pesa" → "m-pesa"); never one of the built-in ids. */
export function manualMethodId(name: string): string {
  const id =
    name
      .toLowerCase()
      .normalize("NFKD")
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "")
      .slice(0, 32) || "other";
  return BUILT_IN_METHODS[id] ? `${id}-own` : id;
}

/** Can this store offer a built-in method in its country? */
export const builtInAvailable = (id: string, country: string) => {
  const m = BUILT_IN_METHODS[id];
  return Boolean(m && (!m.countries || m.countries.includes(country)));
};

const nonEmpty = (lines: { label: string; value: string }[]) => lines.filter((l) => l.value?.trim());

/**
 * Everything this store offers at checkout, in display order: cash on delivery, the wallets / bank, card, then the
 * store's own methods. Never a method without real account details (shoppers would send money nowhere).
 */
export function checkoutMethods(settings: StoreSettings): CheckoutMethod[] {
  const country = settings.country || "PK";
  const p = settings.payments;
  // settings never saved (the original shop before its first save): everything with account details is on
  const on = (k: "cod" | "jazzcash" | "easypaisa" | "bank") => (p ? p[k]?.enabled !== false : true);
  const out: CheckoutMethod[] = [];
  const base = (id: string, extra: Partial<CheckoutMethod> = {}): CheckoutMethod => {
    const b = BUILT_IN_METHODS[id];
    return { id, label: b.label, kind: b.kind, due: b.due, icon: b.icon, note: "", proof: b.kind === "manual", account: [], ...extra };
  };

  if (on("cod")) out.push(base("cod", { note: p?.cod.note ?? "" }));

  if (builtInAvailable("jazzcash", country) && on("jazzcash") && settings.jazzcash?.number?.trim())
    out.push(base("jazzcash", { note: p?.jazzcash.note ?? "", account: nonEmpty([{ label: "JazzCash account", value: settings.jazzcash.title }, { label: "Mobile number", value: settings.jazzcash.number }]) }));
  if (builtInAvailable("easypaisa", country) && on("easypaisa") && settings.easypaisa?.number?.trim())
    out.push(base("easypaisa", { note: p?.easypaisa.note ?? "", account: nonEmpty([{ label: "EasyPaisa account", value: settings.easypaisa.title }, { label: "Mobile number", value: settings.easypaisa.number }]) }));

  const bank = settings.bank;
  const bankReady = Boolean(bank?.accountNumber?.replace(/[\s0-]/g, "") || bank?.iban?.replace(/[\s0A-Z]/gi, ""));
  if (on("bank") && bankReady)
    out.push(
      base("bank", {
        note: p?.bank.note || bank.bankName,
        account: nonEmpty([
          { label: "Bank", value: bank.bankName },
          { label: "Account title", value: bank.accountTitle },
          { label: "Account number", value: bank.accountNumber },
          { label: country === "PK" ? "IBAN" : "IBAN / SWIFT", value: bank.iban },
        ]),
      }),
    );

  const card = settings.cardGateway ? gatewayInfo(settings.cardGateway) : null;
  if (settings.cardReady && p?.card?.enabled && card && gatewaySupports(card, country, settings.currency))
    out.push(base("card", { note: p.card.note ?? "", gateway: card.id }));

  for (const m of settings.manualMethods ?? []) {
    if (!m.enabled || !m.name.trim()) continue;
    const account = nonEmpty(m.details ?? []);
    // paid upfront needs somewhere to pay (details or instructions)
    if (m.due === "upfront" && !account.length && !m.instructions?.trim()) continue;
    out.push({ id: m.id, label: m.name.trim(), kind: m.due === "upfront" ? "manual" : "cod", due: m.due, note: m.note ?? "", proof: m.due === "upfront", account, instructions: m.instructions?.trim() || undefined, icon: m.icon ?? (m.due === "upfront" ? "wallet" : "cash") });
  }
  return out;
}

/** The checkout method with this id, if this store offers it now. */
export const findCheckoutMethod = (id: string, settings: StoreSettings) => checkoutMethods(settings).find((m) => m.id === id) ?? null;
