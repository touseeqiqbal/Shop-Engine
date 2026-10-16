import type { IntegrationInfo } from "../catalog-types";

/** Ads & analytics: tags on the storefront, and purchases sent from the server (they still count when ad blockers hide the browser's). */
export const MARKETING: IntegrationInfo[] = [
  {
    id: "google-tag-manager",
    name: "Google Tag Manager",
    category: "marketing",
    summary: "Add any tag (GA4, Ads, Hotjar …) from your own GTM container – store events are pushed to the dataLayer.",
    steps: ["In Google Tag Manager, open your container and copy its id (GTM-XXXXXXX).", "Paste it here. Product views, add-to-cart, checkout and purchases are pushed to the dataLayer as GA4 ecommerce events."],
    fields: [{ key: "containerId", label: "Container ID", type: "text", required: true, placeholder: "GTM-XXXXXXX" }],
    minRole: "store_manager",
    verified: false,
    docsUrl: "https://developers.google.com/tag-platform/tag-manager/web",
    color: "#246fdb",
  },
  {
    id: "google-ads",
    name: "Google Ads conversions",
    category: "marketing",
    summary: "Count purchases as conversions in your Google Ads account.",
    steps: ["In Google Ads → Goals → Conversions, create a “Purchase” website conversion and choose “Google tag”.", "Copy the conversion id (AW-…) and the conversion label from the event snippet."],
    fields: [
      { key: "conversionId", label: "Conversion ID", type: "text", required: true, placeholder: "AW-123456789" },
      { key: "purchaseLabel", label: "Purchase conversion label", type: "text", required: true, placeholder: "AbC-D_efG-h12_34-567" },
    ],
    minRole: "store_manager",
    verified: false,
    docsUrl: "https://support.google.com/google-ads/answer/6331314",
    color: "#fbbc04",
  },
  {
    id: "meta-capi",
    name: "Meta Conversions API",
    category: "marketing",
    summary: "Send purchases to Facebook & Instagram ads from the server – matched with your Meta Pixel, counted once.",
    steps: [
      "In Meta Events Manager, open your dataset (pixel) → Settings → Conversions API → Generate access token.",
      "Paste the pixel id and the token. Purchases are sent with hashed email and phone only, and the same event id as the browser pixel so Meta counts each one once.",
    ],
    fields: [
      { key: "pixelId", label: "Pixel (dataset) ID", type: "text", required: true, placeholder: "123456789012345" },
      { key: "accessToken", label: "Conversions API access token", type: "secret", required: true },
      { key: "testEventCode", label: "Test event code (optional)", type: "text", help: "From Events Manager → Test events. Leave empty for real traffic." },
    ],
    minRole: "store_manager",
    verified: false,
    docsUrl: "https://developers.facebook.com/docs/marketing-api/conversions-api",
    color: "#0866ff",
    events: ["order.created", "order.paid"],
  },
  {
    id: "tiktok",
    name: "TikTok Pixel & Events API",
    category: "marketing",
    summary: "Measure TikTok ads: the pixel on your store, and purchases from the server.",
    steps: ["In TikTok Ads Manager → Tools → Events, open your pixel and copy its id.", "Optional: generate an Events API access token there so purchases are also sent from the server."],
    fields: [
      { key: "pixelId", label: "Pixel ID", type: "text", required: true, placeholder: "C1ABCDEFGHIJKLMNOPQR" },
      { key: "accessToken", label: "Events API access token (optional)", type: "secret" },
      { key: "testEventCode", label: "Test event code (optional)", type: "text" },
    ],
    minRole: "store_manager",
    verified: false,
    docsUrl: "https://business-api.tiktok.com/portal/docs?id=1771100865818625",
    color: "#111111",
    events: ["order.created", "order.paid"],
  },
];
