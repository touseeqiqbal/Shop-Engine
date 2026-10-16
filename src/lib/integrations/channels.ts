import type { Payload } from "payload";
import { connectionsOf, type Connection } from "./server";

/**
 * Which of the store's own messaging accounts are connected (lib/integrations/catalog/messaging.ts): notify.ts sends
 * through them, and falls back to ShopEngine's own accounts (WHATSAPP_*, SMS_WEBHOOK_URL, SMTP / Resend) otherwise.
 */

/** notify.ts names WhatsApp templates by their platform setting; a store's own number has its own templates. */
export const TEMPLATE_KEY: Record<string, string> = {
  WHATSAPP_TEMPLATE_ORDER: "orderTemplate",
  WHATSAPP_TEMPLATE_STATUS: "statusTemplate",
  WHATSAPP_TEMPLATE_CONFIRM: "confirmTemplate",
  WHATSAPP_TEMPLATE_ORDER_LOOKUP: "lookupTemplate",
  WHATSAPP_TEMPLATE_CART: "cartTemplate",
  WHATSAPP_TEMPLATE_BACK_IN_STOCK: "stockTemplate",
  WHATSAPP_TEMPLATE_PRICE_DROP: "priceTemplate",
};

export type StoreChannels = { whatsapp: Connection | null; sms: Connection | null; email: Connection | null };
export const NO_CHANNELS: StoreChannels = { whatsapp: null, sms: null, email: null };

const SMS = new Set(["twilio", "africastalking", "branded-sms-pk", "sms-http"]);
const EMAIL = new Set(["resend", "brevo", "smtp"]);

export async function storeChannels(payload: Payload | null, storeId: number | null | undefined): Promise<StoreChannels> {
  if (!payload || storeId == null) return NO_CHANNELS;
  const list = (await connectionsOf(payload, storeId, { category: "messaging" }).catch(() => [])).filter((c) => c.status === "connected");
  return { whatsapp: list.find((c) => c.provider === "whatsapp-cloud") ?? null, sms: list.find((c) => SMS.has(c.provider)) ?? null, email: list.find((c) => EMAIL.has(c.provider)) ?? null };
}

/** The template a store's own WhatsApp number uses for this kind of message (undefined = none set). */
export const storeTemplate = (c: Connection, env: string) => {
  const v = c.config[TEMPLATE_KEY[env] ?? ""];
  return typeof v === "string" && v.trim() ? v.trim() : undefined;
};
