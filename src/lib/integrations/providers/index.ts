import type { ProviderImpl } from "../types";

/**
 * The code behind each integration in the catalog, loaded only when needed. An integration with nothing to run on the
 * server (a chat widget, a tag on the storefront) has an empty module.
 */
const SETTINGS_ONLY: ProviderImpl = {};

const LOADERS: Record<string, () => Promise<ProviderImpl>> = {
  // ads & analytics (storefront tags; server events where the provider has an API)
  "google-tag-manager": async () => SETTINGS_ONLY,
  "google-ads": async () => SETTINGS_ONLY,
  "meta-capi": () => import("./meta-capi").then((m) => m.default),
  tiktok: () => import("./tiktok").then((m) => m.default),
  // live chat
  tawk: async () => SETTINGS_ONLY,
  crisp: async () => SETTINGS_ONLY,
  // email marketing
  mailchimp: () => import("./mailchimp").then((m) => m.default),
  klaviyo: () => import("./klaviyo").then((m) => m.default),
  // the store's own WhatsApp, SMS and email
  "whatsapp-cloud": () => import("./whatsapp-cloud").then((m) => m.default),
  twilio: () => import("./sms").then((m) => m.twilio),
  africastalking: () => import("./sms").then((m) => m.africastalking),
  "branded-sms-pk": () => import("./sms").then((m) => m.brandedSmsPk),
  "sms-http": () => import("./sms").then((m) => m.smsHttp),
  resend: () => import("./email").then((m) => m.resend),
  brevo: () => import("./email").then((m) => m.brevo),
  smtp: () => import("./email").then((m) => m.smtp),
  // online payments (the store's own merchant account)
  safepay: () => import("./safepay").then((m) => m.default),
  "jazzcash-online": () => import("./jazzcash").then((m) => m.default),
  "easypaisa-online": () => import("./easypaisa").then((m) => m.default),
  "payfast-pk": () => import("./payfast-pk").then((m) => m.default),
  paypal: () => import("./paypal").then((m) => m.default),
  razorpay: () => import("./razorpay").then((m) => m.default),
  paystack: () => import("./paystack").then((m) => m.default),
  flutterwave: () => import("./flutterwave").then((m) => m.default),
  mercadopago: () => import("./mercadopago").then((m) => m.default),
  tap: () => import("./tap").then((m) => m.default),
  paytabs: () => import("./paytabs").then((m) => m.default),
  // accounting and marketplaces (signed in with the provider's page)
  quickbooks: () => import("./quickbooks").then((m) => m.default),
  xero: () => import("./xero").then((m) => m.default),
  daraz: () => import("./daraz").then((m) => m.default),
  amazon: () => import("./amazon").then((m) => m.default),
  // couriers
  postex: () => import("./postex").then((m) => m.default),
  leopards: () => import("./leopards").then((m) => m.default),
  tcs: () => import("./tcs").then((m) => m.default),
  trax: () => import("./trax").then((m) => m.default),
  mnp: () => import("./mnp").then((m) => m.default),
  callcourier: () => import("./callcourier").then((m) => m.default),
  shippo: () => import("./shippo").then((m) => m.default),
  easypost: () => import("./easypost").then((m) => m.default),
  "dhl-express": () => import("./dhl-express").then((m) => m.default),
};

export async function providerImpl(id: string): Promise<ProviderImpl | null> {
  const load = LOADERS[id];
  return load ? load() : null;
}

export const hasProviderCode = (id: string) => id in LOADERS;
