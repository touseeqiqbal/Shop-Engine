import { isCmsConfigured } from "@/lib/db/config";

/**
 * What the storefront needs from a store's integrations: only public ids (tag / pixel / chat ids) – never keys.
 */
export type StorefrontIntegrations = {
  gtmId?: string;
  adsId?: string;
  adsLabel?: string;
  tiktokId?: string;
  chat?: { provider: "tawk" | "crisp"; ids: Record<string, string> };
};

export async function storefrontIntegrations(storeId: number | null): Promise<StorefrontIntegrations> {
  if (!isCmsConfigured || storeId == null) return {};
  try {
    const [{ payloadClient }, { connectionsOf }] = await Promise.all([import("@/lib/cms/catalog-source"), import("./server")]);
    const list = (await connectionsOf(await payloadClient(), storeId)).filter((c) => c.status === "connected");
    const get = (id: string) => list.find((c) => c.provider === id)?.config;
    const s = (v: unknown) => (typeof v === "string" ? v : "");
    const out: StorefrontIntegrations = {};
    const gtm = get("google-tag-manager");
    if (gtm) out.gtmId = s(gtm.containerId);
    const ads = get("google-ads");
    if (ads) Object.assign(out, { adsId: s(ads.conversionId), adsLabel: s(ads.purchaseLabel) });
    const tiktok = get("tiktok");
    if (tiktok) out.tiktokId = s(tiktok.pixelId);
    const tawk = get("tawk");
    const crisp = get("crisp");
    if (tawk) out.chat = { provider: "tawk", ids: { propertyId: s(tawk.propertyId), widgetId: s(tawk.widgetId) } };
    else if (crisp) out.chat = { provider: "crisp", ids: { websiteId: s(crisp.websiteId) } };
    return out;
  } catch {
    return {};
  }
}
