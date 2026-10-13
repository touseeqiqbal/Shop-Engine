import { unstable_cache } from "next/cache";
import { Analytics } from "@/components/analytics";
import { CookieNotice, type CookieNoticeText } from "@/components/cookie-notice";
import { getSeoSettings } from "@/lib/repo/site-content";
import { isCmsConfigured } from "@/lib/db/config";

type Notice = CookieNoticeText & { enabled: boolean };
const DEFAULT_NOTICE: Notice = {
  enabled: true,
  message: "We use cookies to keep your cart and sign-in working. With your OK we also measure visits (Google Analytics) and ads (Meta) to improve the shop.",
  acceptLabel: "Accept",
  rejectLabel: "Only necessary",
  policyLink: "/privacy-policy",
};

/** Cookie notice text from /cms → Settings → Cookie notice (defaults until it's saved). */
const getCookieNotice = unstable_cache(
  async (): Promise<Notice> => {
    if (!isCmsConfigured) return DEFAULT_NOTICE;
    try {
      const { payloadClient } = await import("@/lib/cms/catalog-source");
      const g = (await (await payloadClient()).findGlobal({ slug: "cookie-notice", depth: 0, overrideAccess: true })) as unknown as Record<string, unknown>;
      if (!g.updatedAt) return DEFAULT_NOTICE;
      const s = (k: keyof CookieNoticeText) => (typeof g[k] === "string" && (g[k] as string).trim() ? (g[k] as string) : DEFAULT_NOTICE[k]);
      return { enabled: g.enabled !== false, message: s("message"), acceptLabel: s("acceptLabel"), rejectLabel: s("rejectLabel"), policyLink: s("policyLink") };
    } catch {
      return DEFAULT_NOTICE;
    }
  },
  ["cookie-notice-v1"],
  { tags: ["settings"], revalidate: 300 }
);

/** GA4 / Meta Pixel with IDs from /cms → Settings → Google & SEO (no rebuild needed), plus the cookie notice. */
export async function RuntimeAnalytics() {
  const [seo, notice] = await Promise.all([getSeoSettings().catch(() => null), getCookieNotice()]);
  const tracking = Boolean(seo?.ga4Id || seo?.metaPixelId || process.env.NEXT_PUBLIC_GA_ID || process.env.NEXT_PUBLIC_META_PIXEL_ID);
  return (
    <>
      <Analytics gaId={seo?.ga4Id} pixelId={seo?.metaPixelId} consent={notice.enabled} />
      {notice.enabled && tracking && <CookieNotice text={notice} />}
    </>
  );
}
