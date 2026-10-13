"use client";
import { useEffect } from "react";
import Script from "next/script";

/**
 * Google Analytics 4 + Meta Pixel. Both load only when their IDs are set (/cms → Settings → Google & SEO, or
 * NEXT_PUBLIC_GA_ID / NEXT_PUBLIC_META_PIXEL_ID). Scripts load after the page is interactive.
 *
 * With the cookie notice on (consent = true):
 *   - GA4 uses Google consent mode: no analytics / ad cookies until the visitor presses Accept
 *     (until then Google only receives cookieless pings).
 *   - The Meta Pixel doesn't load at all until Accept.
 */
const PIXEL = (id: string) =>
  `!function(f,b,e,v,n,t,s){if(f.fbq)return;n=f.fbq=function(){n.callMethod?n.callMethod.apply(n,arguments):n.queue.push(arguments)};if(!f._fbq)f._fbq=n;n.push=n;n.loaded=!0;n.version='2.0';n.queue=[];t=b.createElement(e);t.async=!0;t.src=v;s=b.getElementsByTagName(e)[0];s.parentNode.insertBefore(t,s)}(window,document,'script','https://connect.facebook.net/en_US/fbevents.js');fbq('init','${id}');fbq('track','PageView');`;

const granted = () => /(?:^|; )urko-consent=granted/.test(document.cookie);

function loadPixel(id: string) {
  if ((window as unknown as { fbq?: unknown }).fbq) return;
  const s = document.createElement("script");
  s.text = PIXEL(id);
  document.head.appendChild(s);
}

export function Analytics({ gaId, pixelId, consent = false }: { gaId?: string; pixelId?: string; consent?: boolean } = {}) {
  const clean = (v: string | undefined) => (v ?? "").replace(/[^A-Za-z0-9-]/g, "");
  const ga = clean(gaId || process.env.NEXT_PUBLIC_GA_ID);
  const pixel = clean(pixelId || process.env.NEXT_PUBLIC_META_PIXEL_ID);

  useEffect(() => {
    if (!pixel) return;
    if (!consent || granted()) {
      const t = setTimeout(() => loadPixel(pixel), 2500); // like lazyOnload
      return () => clearTimeout(t);
    }
    const onConsent = (e: Event) => (e as CustomEvent<string>).detail === "granted" && loadPixel(pixel);
    window.addEventListener("urko:consent", onConsent);
    return () => window.removeEventListener("urko:consent", onConsent);
  }, [pixel, consent]);

  if (!ga) return null;
  const consentDefault = consent
    ? `var c=(document.cookie.match(/(?:^|; )urko-consent=(granted|denied)/)||[])[1]==='granted'?'granted':'denied';gtag('consent','default',{analytics_storage:c,ad_storage:c,ad_user_data:c,ad_personalization:c,wait_for_update:500});`
    : "";
  return (
    <>
      <Script id="ga4" strategy="afterInteractive">
        {`window.dataLayer=window.dataLayer||[];function gtag(){dataLayer.push(arguments);}window.gtag=gtag;${consentDefault}gtag('js',new Date());gtag('config','${ga}');`}
      </Script>
      <Script src={`https://www.googletagmanager.com/gtag/js?id=${ga}`} strategy="afterInteractive" />
    </>
  );
}

/** Fire a conversion event to GA4 / Meta Pixel from client code (no-op when not configured). */
export function trackEvent(name: string, params: Record<string, unknown> = {}) {
  if (typeof window === "undefined") return;
  const w = window as unknown as { gtag?: (...a: unknown[]) => void; fbq?: (...a: unknown[]) => void };
  w.gtag?.("event", name, params);
  const pixelMap: Record<string, string> = { add_to_cart: "AddToCart", add_to_wishlist: "AddToWishlist", begin_checkout: "InitiateCheckout", purchase: "Purchase", search: "Search", view_item: "ViewContent" };
  if (pixelMap[name]) w.fbq?.("track", pixelMap[name], params);
}
