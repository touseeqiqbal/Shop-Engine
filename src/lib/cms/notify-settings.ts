import "server-only";
import { unstable_cache } from "next/cache";
import { isCmsConfigured } from "@/lib/db/config";
import { payloadClient } from "./catalog-source";

/** /cms → Settings → Notifications (defaults = previous behaviour: everything on, alerts to the store email). */
export interface NotifySettings {
  staffEmails: string[];
  alertNewOrder: boolean;
  alertWholesale: boolean;
  alertContact: boolean;
  customerEmail: boolean;
  customerWhatsApp: boolean;
  customerSms: boolean;
  orderConfirmation: boolean;
  statusUpdates: string[];
}

export const DEFAULT_NOTIFY: NotifySettings = {
  staffEmails: [],
  alertNewOrder: true,
  alertWholesale: true,
  alertContact: false,
  customerEmail: true,
  customerWhatsApp: true,
  customerSms: true,
  orderConfirmation: true,
  statusUpdates: ["confirmed", "dispatched", "out-for-delivery", "delivered"],
};

const load = unstable_cache(
  async (storeId: number | null): Promise<NotifySettings> => {
    if (!isCmsConfigured) return DEFAULT_NOTIFY;
    const { getStoreSettings } = await import("@/payload/store-settings");
    const g = await getStoreSettings<Record<string, unknown>>(await payloadClient(), "notifications", storeId);
    if (!g.updatedAt) return DEFAULT_NOTIFY;
    const bool = (k: keyof NotifySettings) => (typeof g[k] === "boolean" ? (g[k] as boolean) : (DEFAULT_NOTIFY[k] as boolean));
    return {
      staffEmails: Array.isArray(g.staffEmails) ? (g.staffEmails as string[]).map((e) => e.trim()).filter(Boolean) : [],
      alertNewOrder: bool("alertNewOrder"),
      alertWholesale: bool("alertWholesale"),
      alertContact: bool("alertContact"),
      customerEmail: bool("customerEmail"),
      customerWhatsApp: bool("customerWhatsApp"),
      customerSms: bool("customerSms"),
      orderConfirmation: bool("orderConfirmation"),
      statusUpdates: Array.isArray(g.statusUpdates) ? (g.statusUpdates as string[]) : DEFAULT_NOTIFY.statusUpdates,
    };
  },
  ["cms-notify-v2"],
  { tags: ["settings"], revalidate: 60 }
);

/** A store's notification settings (who gets alerts, which messages customers get). */
// (no fallback to the defaults: unreadable settings used to switch every channel back on – SMS the store turned off,
// alerts it doesn't want; the messages are built in the outbox, which tries again)
export const getNotifySettings = (storeId: number | null) => load(storeId);
