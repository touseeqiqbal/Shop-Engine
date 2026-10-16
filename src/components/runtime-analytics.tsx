import { unstable_cache } from "next/cache";
import { Analytics } from "@/components/analytics";
import { CookieNotice, type CookieNoticeText } from "@/components/cookie-notice";
import { getSeoSettings } from "@/lib/repo/site-content";
import { isCmsConfigured } from "@/lib/db/config";
import { currentStoreId } from "@/lib/tenant";
import { storefrontIntegrations } from "@/lib/integrations/storefront";
import { ChatWidget } from "@/components/chat-widget";

type Notice = CookieNoticeText & { enabled: boolean };
const DEFAULT_NOTICE: Notice = {
  enabled: true,
  message: "We use cookies to keep your cart and sign-in working. With your OK we also measure visits (Google Analytics) and ads (Meta) to improve the shop.",
  acceptLabel: "Accept",
  rejectLabel: "Only necessary",
  policyLink: "/privacy-policy",
};

/** Cookie notice text from the store's /cms → Settings → Cookie notice (defaults until it's saved). */
const cookieNoticeCached = unstable_cache(
  async (storeId: number | null): Promise<Notice> => {
    if (!isCmsConfigured) return DEFAULT_NOTICE;
    try {
      const [{ payloadClient }, { getStoreSettings }] = await Promise.all([import("@/lib/cms/catalog-source"), import("@/payload/store-settings")]);
      const g = await getStoreSettings<Record<string, unknown>>(await payloadClient(), "cookie-notice", storeId);
      if (!g.updatedAt) return DEFAULT_NOTICE;
      const s = (k: keyof CookieNoticeText) => (typeof g[k] === "string" && (g[k] as string).trim() ? (g[k] as string) : DEFAULT_NOTICE[k]);
      return { enabled: g.enabled !== false, message: s("message"), acceptLabel: s("acceptLabel"), rejectLabel: s("rejectLabel"), policyLink: s("policyLink") };
    } catch {
      return DEFAULT_NOTICE;
    }
  },
  ["cookie-notice-v2"],
  { tags: ["settings"], revalidate: 300 }
);
const getCookieNotice = async () => cookieNoticeCached(await currentStoreId());

/**
 * GA4 / Meta Pixel with IDs from /cms → Settings → Google & SEO (no rebuild needed), the store's ad and chat
 * integrations (/cms → Integrations), plus the cookie notice.
 */
export async function RuntimeAnalytics() {
  const [seo, notice, apps] = await Promise.all([getSeoSettings().catch(() => null), getCookieNotice(), currentStoreId().then(storefrontIntegrations)]);
  const tracking = Boolean(seo?.ga4Id || seo?.metaPixelId || process.env.NEXT_PUBLIC_GA_ID || process.env.NEXT_PUBLIC_META_PIXEL_ID || apps.gtmId || apps.adsId || apps.tiktokId);
  return (
    <>
      <Analytics gaId={seo?.ga4Id} pixelId={seo?.metaPixelId} consent={notice.enabled} gtmId={apps.gtmId} adsId={apps.adsId} adsLabel={apps.adsLabel} tiktokId={apps.tiktokId} />
      {notice.enabled && tracking && <CookieNotice text={notice} />}
      {apps.chat && <ChatWidget provider={apps.chat.provider} ids={apps.chat.ids} />}
    </>
  );
}
