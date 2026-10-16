"use client";
import { useEffect } from "react";
import Script from "next/script";

/**
 * Google Analytics 4 + Meta Pixel (/cms → Settings → Google & SEO, or NEXT_PUBLIC_GA_ID / NEXT_PUBLIC_META_PIXEL_ID),
 * plus the store's ad integrations (/cms → Integrations): Google Tag Manager, Google Ads conversions, TikTok Pixel.
 * Each loads only when its id is set; scripts load after the page is interactive.
 *
 * With the cookie notice on (consent = true):
 *   - GA4 / Google Ads use Google consent mode: no analytics / ad cookies until the visitor presses Accept
 *     (until then Google only receives cookieless pings).
 *   - The Meta Pixel, TikTok Pixel and Tag Manager don't load at all until Accept.
 */
const PIXEL = (id: string) =>
  `!function(f,b,e,v,n,t,s){if(f.fbq)return;n=f.fbq=function(){n.callMethod?n.callMethod.apply(n,arguments):n.queue.push(arguments)};if(!f._fbq)f._fbq=n;n.push=n;n.loaded=!0;n.version='2.0';n.queue=[];t=b.createElement(e);t.async=!0;t.src=v;s=b.getElementsByTagName(e)[0];s.parentNode.insertBefore(t,s)}(window,document,'script','https://connect.facebook.net/en_US/fbevents.js');fbq('init','${id}');fbq('track','PageView');`;

const TIKTOK = (id: string) =>
  `!function(w,d,t){w.TiktokAnalyticsObject=t;var ttq=w[t]=w[t]||[];ttq.methods=["page","track","identify","instances","debug","on","off","once","ready","alias","group","enableCookie","disableCookie","holdConsent","revokeConsent","grantConsent"];ttq.setAndDefer=function(t,e){t[e]=function(){t.push([e].concat(Array.prototype.slice.call(arguments,0)))}};for(var i=0;i<ttq.methods.length;i++)ttq.setAndDefer(ttq,ttq.methods[i]);ttq.instance=function(t){for(var e=ttq._i[t]||[],n=0;n<ttq.methods.length;n++)ttq.setAndDefer(e,ttq.methods[n]);return e};ttq.load=function(e,n){var r="https://analytics.tiktok.com/i18n/pixel/events.js";ttq._i=ttq._i||{},ttq._i[e]=[],ttq._i[e]._u=r,ttq._t=ttq._t||{},ttq._t[e]=+new Date,ttq._o=ttq._o||{},ttq._o[e]=n||{};var o=d.createElement("script");o.type="text/javascript",o.async=!0,o.src=r+"?sdkid="+e+"&lib="+t;var a=d.getElementsByTagName("script")[0];a.parentNode.insertBefore(o,a)};ttq.load('${id}');ttq.page();}(window,document,'ttq');`;

const GTM = (id: string) => `(function(w,d,s,l,i){w[l]=w[l]||[];w[l].push({'gtm.start':new Date().getTime(),event:'gtm.js'});var f=d.getElementsByTagName(s)[0],j=d.createElement(s),dl=l!='dataLayer'?'&l='+l:'';j.async=true;j.src='https://www.googletagmanager.com/gtm.js?id='+i+dl;f.parentNode.insertBefore(j,f);})(window,document,'script','dataLayer','${id}');`;

const granted = () => /(?:^|; )urko-consent=granted/.test(document.cookie);

function inject(key: string, code: string) {
  if (document.querySelector(`script[data-se="${key}"]`)) return;
  const s = document.createElement("script");
  s.dataset.se = key;
  s.text = code;
  document.head.appendChild(s);
}

type Props = { gaId?: string; pixelId?: string; consent?: boolean; gtmId?: string; adsId?: string; adsLabel?: string; tiktokId?: string };

export function Analytics({ gaId, pixelId, consent = false, gtmId, adsId, adsLabel, tiktokId }: Props = {}) {
  const clean = (v: string | undefined) => (v ?? "").replace(/[^A-Za-z0-9-]/g, "");
  const ga = clean(gaId || process.env.NEXT_PUBLIC_GA_ID);
  const pixel = clean(pixelId || process.env.NEXT_PUBLIC_META_PIXEL_ID);
  const gtm = clean(gtmId);
  const ads = clean(adsId);
  const tiktok = clean(tiktokId);
  const label = (adsLabel ?? "").replace(/[^A-Za-z0-9_-]/g, "");

  // tags that only load with consent (when the cookie notice is on)
  useEffect(() => {
    if (ads && label) (window as unknown as { __seAds?: { id: string; label: string } }).__seAds = { id: ads, label };
    const load = () => {
      if (pixel && !(window as unknown as { fbq?: unknown }).fbq) inject("meta", PIXEL(pixel));
      if (tiktok) inject("tiktok", TIKTOK(tiktok));
      if (gtm) inject("gtm", GTM(gtm));
    };
    if (!pixel && !tiktok && !gtm) return;
    if (!consent || granted()) {
      const t = setTimeout(load, 2500); // like lazyOnload
      return () => clearTimeout(t);
    }
    const onConsent = (e: Event) => (e as CustomEvent<string>).detail === "granted" && load();
    window.addEventListener("urko:consent", onConsent);
    return () => window.removeEventListener("urko:consent", onConsent);
  }, [pixel, tiktok, gtm, ads, label, consent]);

  const tagId = ga || ads;
  if (!tagId) return null;
  const consentDefault = consent
    ? `var c=(document.cookie.match(/(?:^|; )urko-consent=(granted|denied)/)||[])[1]==='granted'?'granted':'denied';gtag('consent','default',{analytics_storage:c,ad_storage:c,ad_user_data:c,ad_personalization:c,wait_for_update:500});`
    : "";
  return (
    <>
      <Script id="ga4" strategy="afterInteractive">
        {`window.dataLayer=window.dataLayer||[];function gtag(){dataLayer.push(arguments);}window.gtag=gtag;${consentDefault}gtag('js',new Date());${ga ? `gtag('config','${ga}');` : ""}${ads ? `gtag('config','${ads}');` : ""}`}
      </Script>
      <Script src={`https://www.googletagmanager.com/gtag/js?id=${tagId}`} strategy="afterInteractive" />
    </>
  );
}

/** Fire a store event to GA4, Tag Manager, Meta, TikTok and Google Ads (each only when it is set up). */
export function trackEvent(name: string, params: Record<string, unknown> = {}) {
  if (typeof window === "undefined") return;
  const w = window as unknown as {
    gtag?: (...a: unknown[]) => void;
    fbq?: (...a: unknown[]) => void;
    ttq?: { track: (...a: unknown[]) => void };
    dataLayer?: unknown[];
    __seAds?: { id: string; label: string };
  };
  w.gtag?.("event", name, params);
  // Tag Manager: GA4 ecommerce shape (the container decides what to do with it)
  if (w.dataLayer && document.querySelector('script[data-se="gtm"]')) {
    w.dataLayer.push({ ecommerce: null });
    w.dataLayer.push({ event: name, ecommerce: params });
  }
  // the server sends the same purchase (Meta Conversions API / TikTok Events API) with this id – counted once
  const eventId = name === "purchase" && params.transaction_id ? `purchase-${String(params.transaction_id)}` : undefined;
  const pixelMap: Record<string, string> = { add_to_cart: "AddToCart", add_to_wishlist: "AddToWishlist", begin_checkout: "InitiateCheckout", purchase: "Purchase", search: "Search", view_item: "ViewContent" };
  if (pixelMap[name]) w.fbq?.("track", pixelMap[name], params, eventId ? { eventID: eventId } : undefined);
  const tiktokMap: Record<string, string> = { add_to_cart: "AddToCart", add_to_wishlist: "AddToWishlist", begin_checkout: "InitiateCheckout", purchase: "Purchase", search: "Search", view_item: "ViewContent" };
  if (tiktokMap[name] && w.ttq) w.ttq.track(tiktokMap[name], { value: params.value, currency: params.currency, contents: params.items }, eventId ? { event_id: eventId } : undefined);
  if (name === "purchase" && w.__seAds && w.gtag) w.gtag("event", "conversion", { send_to: `${w.__seAds.id}/${w.__seAds.label}`, value: params.value, currency: params.currency, transaction_id: params.transaction_id });
}
