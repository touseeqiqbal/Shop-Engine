/**
 * The payment providers ShopEngine can connect a store to (client-safe descriptions; the code that talks to each one
 * is in lib/payments/gateways – server only). Adding a provider: docs/PAYMENT-PLUGINS.md.
 */

export interface GatewayInfo {
  id: string;
  label: string;
  /** checkout methods it takes ("card") */
  methods: readonly string[];
  /** countries whose stores it can onboard (undefined = any) */
  countries?: readonly string[];
  /** currencies it can charge, ISO upper case (undefined = any) */
  currencies?: readonly string[];
  /** shown to owners next to "Connect" */
  description: string;
}

/** Countries where businesses can open a Stripe account (stripe.com/global). */
const STRIPE_COUNTRIES = [
  "AE", "AT", "AU", "BE", "BG", "BR", "CA", "CH", "CY", "CZ", "DE", "DK", "EE", "ES", "FI", "FR", "GB", "GI", "GR", "HK", "HR", "HU", "IE",
  "IN", "IT", "JP", "LI", "LT", "LU", "LV", "MT", "MX", "MY", "NL", "NO", "NZ", "PL", "PT", "RO", "SE", "SG", "SI", "SK", "TH", "US",
] as const;

export const GATEWAYS: readonly GatewayInfo[] = [
  { id: "stripe", label: "Stripe", methods: ["card"], countries: STRIPE_COUNTRIES, description: "Cards, Apple Pay and Google Pay on Stripe's secure page. Payouts to your bank account." },
];

export const gatewayInfo = (id: string | null | undefined) => GATEWAYS.find((g) => g.id === id) ?? null;

/** Can this provider take payments for a store in this country, in this currency? */
export function gatewaySupports(g: GatewayInfo, country: string | null | undefined, currency: string | null | undefined): boolean {
  if (g.countries && country && !g.countries.includes(country)) return false;
  if (g.currencies && currency && !g.currencies.includes(currency.toUpperCase())) return false;
  return true;
}

/** Providers a store in this country can connect. */
export const gatewaysFor = (country: string, currency?: string) => GATEWAYS.filter((g) => gatewaySupports(g, country, currency));

/**
 * Popular ways to pay in some countries – suggestions for a store's own methods (Settings → Payments → Other payment
 * methods). Shoppers pay outside the shop and upload the receipt; no provider account is needed.
 */
export const LOCAL_METHOD_IDEAS: Record<string, string[]> = {
  PK: ["Raast", "SadaPay", "NayaPay"],
  IN: ["UPI", "Paytm", "PhonePe"],
  BD: ["bKash", "Nagad", "Rocket"],
  LK: ["eZ Cash", "mCash"],
  NP: ["eSewa", "Khalti"],
  KE: ["M-Pesa", "Airtel Money"],
  TZ: ["M-Pesa", "Tigo Pesa", "Airtel Money"],
  UG: ["MTN Mobile Money", "Airtel Money"],
  GH: ["MTN Mobile Money", "Telecel Cash"],
  NG: ["Bank transfer (NIP)", "OPay", "PalmPay"],
  ZA: ["EFT", "SnapScan", "Zapper"],
  EG: ["InstaPay", "Vodafone Cash", "Fawry"],
  MA: ["CashPlus", "Wafacash"],
  BR: ["PIX", "Boleto"],
  MX: ["SPEI", "OXXO"],
  AR: ["Mercado Pago", "Transferencia"],
  CO: ["Nequi", "Daviplata", "PSE"],
  PE: ["Yape", "Plin"],
  CL: ["Transferencia", "MACH"],
  PH: ["GCash", "Maya"],
  ID: ["GoPay", "OVO", "DANA", "QRIS"],
  MY: ["DuitNow", "Touch 'n Go eWallet"],
  TH: ["PromptPay", "TrueMoney"],
  VN: ["MoMo", "ZaloPay", "VietQR"],
  SG: ["PayNow"],
  CN: ["Alipay", "WeChat Pay"],
  HK: ["FPS", "PayMe"],
  AE: ["Card on delivery", "Bank transfer"],
  SA: ["mada on delivery", "STC Pay"],
  TR: ["Havale / EFT", "Papara"],
  NL: ["iDEAL"],
  BE: ["Bancontact", "Payconiq"],
  PL: ["BLIK", "Przelewy24"],
  DE: ["Überweisung", "PayPal"],
  SE: ["Swish"],
  NO: ["Vipps"],
  DK: ["MobilePay"],
  CH: ["TWINT"],
  GB: ["Bank transfer (Faster Payments)", "PayPal"],
  US: ["Zelle", "Venmo", "Cash App"],
  CA: ["Interac e-Transfer"],
  AU: ["PayID / Osko", "BPAY"],
};
