/**
 * Integrations connected with the provider's own sign-in page (OAuth): ShopEngine registers ONE app with the provider
 * and each store signs in with its own account. The app's keys are platform settings:
 *
 *   QUICKBOOKS_CLIENT_ID, QUICKBOOKS_CLIENT_SECRET     (QuickBooks Online – developer.intuit.com)
 *   XERO_CLIENT_ID, XERO_CLIENT_SECRET                 (Xero – developer.xero.com)
 *   DARAZ_APP_KEY, DARAZ_APP_SECRET                    (Daraz Open Platform – open.daraz.com)
 *   AMAZON_SPAPI_APP_ID, AMAZON_LWA_CLIENT_ID, AMAZON_LWA_CLIENT_SECRET
 *                                                      (Amazon Selling Partner API – a PUBLIC developer app;
 *                                                       AMAZON_SPAPI_DRAFT=true while the app is still a draft)
 *   INTEGRATIONS_OAUTH_BASE_URL   optional: the address registered as the app's redirect, if not the admin's own
 *                                 (the redirect is <base>/cms-api/integration-tools/oauth/callback)
 */

const KEYS: Record<string, string[]> = {
  quickbooks: ["QUICKBOOKS_CLIENT_ID", "QUICKBOOKS_CLIENT_SECRET"],
  xero: ["XERO_CLIENT_ID", "XERO_CLIENT_SECRET"],
  daraz: ["DARAZ_APP_KEY", "DARAZ_APP_SECRET"],
  amazon: ["AMAZON_SPAPI_APP_ID", "AMAZON_LWA_CLIENT_ID", "AMAZON_LWA_CLIENT_SECRET"],
};

/** Has ShopEngine set up its app with this provider? */
export const oauthReady = (provider: string) => (KEYS[provider] ?? ["-"]).every((k) => Boolean(process.env[k]));

export const oauthRedirectUri = (origin: string) => `${(process.env.INTEGRATIONS_OAUTH_BASE_URL || origin).replace(/\/+$/, "")}/cms-api/integration-tools/oauth/callback`;
