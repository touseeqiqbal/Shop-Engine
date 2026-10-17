import type { ShippingOption, StoreSettings } from "./types";
import { findCheckoutMethod } from "./payments/methods";

export const MAJOR_CITIES = [
  "Karachi",
  "Lahore",
  "Islamabad",
  "Rawalpindi",
  "Faisalabad",
  "Multan",
  "Peshawar",
  "Quetta",
  "Hyderabad",
  "Sialkot",
  "Gujranwala",
  "Sukkur",
] as const;

/** Pakistani cities & towns for the checkout dropdown (searchable). */
export const PAKISTAN_CITIES: string[] = Array.from(
  new Set([
    ...MAJOR_CITIES,
    "Abbottabad", "Ahmadpur East", "Alipur", "Arifwala", "Attock", "Awaran", "Badin", "Bagh", "Bahawalnagar",
    "Bahawalpur", "Bannu", "Barkhan", "Batagram", "Battagram", "Bhakkar", "Bhalwal", "Bhimber", "Burewala",
    "Chakwal", "Chaman", "Charsadda", "Chichawatni", "Chiniot", "Chishtian", "Chitral", "Dadu", "Daska",
    "Dera Ghazi Khan", "Dera Ismail Khan", "Dera Murad Jamali", "Dina", "Dipalpur", "Faisalabad", "Fateh Jang",
    "Gadoon", "Gawadar", "Ghotki", "Gilgit", "Gojra", "Gujar Khan", "Gujrat", "Hafizabad", "Hala", "Hangu",
    "Haripur", "Haroonabad", "Hasilpur", "Hassan Abdal", "Hub", "Hunza", "Hyderabad", "Jacobabad", "Jalalpur Jattan",
    "Jampur", "Jamshoro", "Jaranwala", "Jhang", "Jhelum", "Kabirwala", "Kahror Pakka", "Kamalia", "Kamoke",
    "Kandhkot", "Kasur", "Khairpur", "Khanewal", "Khanpur", "Kharian", "Khushab", "Khuzdar", "Kohat", "Kot Addu",
    "Kotli", "Kotri", "Lakki Marwat", "Lalamusa", "Larkana", "Layyah", "Lodhran", "Loralai", "Malakand",
    "Mandi Bahauddin", "Mansehra", "Mardan", "Matiari", "Mian Channu", "Mianwali", "Mingora", "Mirpur (AJK)",
    "Mirpur Khas", "Mirpur Mathelo", "Moro", "Murree", "Muridke", "Muzaffarabad", "Muzaffargarh", "Narowal",
    "Naushahro Feroze", "Nawabshah", "Nowshera", "Okara", "Pakpattan", "Pasrur", "Pattoki", "Pind Dadan Khan",
    "Pindi Bhattian", "Pishin", "Rahim Yar Khan", "Rajanpur", "Rawalakot", "Renala Khurd", "Sadiqabad", "Sahiwal",
    "Samundri", "Sanghar", "Sangla Hill", "Sargodha", "Shahdadkot", "Shahdadpur", "Sheikhupura", "Shikarpur",
    "Shujabad", "Sibi", "Skardu", "Swabi", "Swat", "Talagang", "Tando Adam", "Tando Allahyar",
    "Tando Muhammad Khan", "Taxila", "Thatta", "Timergara", "Toba Tek Singh", "Turbat", "Umerkot", "Vehari",
    "Wah Cantt", "Wazirabad", "Zhob", "Ziarat", "Other (mention in address)",
  ])
).sort((a, b) => {
  if (a.startsWith("Other")) return 1;
  if (b.startsWith("Other")) return -1;
  return a.localeCompare(b);
});

/** Cities used to generate /laptops-in-{city} landing pages for nationwide SEO. */
export const LANDING_CITIES = [
  "Karachi", "Lahore", "Islamabad", "Rawalpindi", "Faisalabad", "Multan", "Peshawar", "Quetta", "Hyderabad",
  "Sialkot", "Gujranwala", "Sukkur", "Bahawalpur", "Sargodha", "Abbottabad", "Larkana", "Mardan", "Sahiwal",
];

export function citySlug(city: string) {
  return city.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
}

export function cityFromSlug(slug: string) {
  return LANDING_CITIES.find((c) => citySlug(c) === slug) ?? null;
}

export type DeliveryZone = "karachi" | "major" | "other";

const MAJOR_SET = new Set<string>(MAJOR_CITIES.filter((c) => c !== "Karachi"));

export function deliveryZone(city: string): DeliveryZone {
  if (city.trim().toLowerCase() === "karachi") return "karachi";
  if (MAJOR_SET.has(city)) return "major";
  return "other";
}

const norm = (v: string) => v.trim().toLowerCase().replace(/\s+/g, " ");
const postcode = (v: string) => v.toUpperCase().replace(/\s+/g, "");

/** Does a zone's typed place match? "Dubai" = that city / area; "SW1*" = postcodes starting with SW1; "10001" = that postcode. */
function placeMatches(place: string, city: string, postalCode: string) {
  const p = place.trim();
  if (!p) return false;
  if (p.endsWith("*")) return Boolean(postalCode) && postcode(postalCode).startsWith(postcode(p.slice(0, -1)));
  return norm(p) === norm(city) || (Boolean(postalCode) && postcode(p) === postcode(postalCode));
}

/** The countries a store delivers to: its own, then the ones in Settings → Delivery → "Also deliver to". */
export function shipToCountries(settings: Pick<StoreSettings, "country" | "shipTo">): string[] {
  const home = settings.country || "PK";
  return [home, ...(settings.shipTo ?? []).filter((c) => c && c !== home)];
}

/** Does the store deliver to this country? */
export const shipsTo = (settings: Pick<StoreSettings, "country" | "shipTo">, country: string | null | undefined) => !country || shipToCountries(settings).includes(country);

/** A zone without countries is for the store's own country; one with countries covers only those. */
const zoneCovers = (z: { countries?: string[] }, country: string, home: string) => (z.countries?.length ? z.countries.includes(country) : country === home);

/**
 * The configured shipping zone for an address (named zone first, then the "rest of the country" zone) – among the
 * zones for the address's country (`country`: ISO code, default the store's own).
 */
export function shippingZoneFor(city: string, settings: Pick<StoreSettings, "zones" | "country">, postalCode = "", country?: string | null) {
  const home = settings.country || "PK";
  const where = country || home;
  const zones = (settings.zones ?? []).filter((z) => zoneCovers(z, where, home));
  const c = norm(city);
  return zones.find((z) => !z.rest && (z.cities.some((x) => norm(x) === c) || (z.places ?? []).some((p) => placeMatches(p, city, postalCode)))) ?? zones.find((z) => z.rest) ?? null;
}

export function deliveryEstimate(city: string, settings?: Pick<StoreSettings, "zones" | "country">, postalCode = "", country?: string | null) {
  const custom = settings ? shippingZoneFor(city, settings, postalCode, country)?.estimate?.trim() : "";
  if (custom) return { label: custom, days: custom };
  // abroad, without an estimate of its own
  if (settings && country && country !== (settings.country || "PK")) return { label: "5–10 working days", days: "5–10 days" };
  // the built-in estimates know Pakistan's cities only
  if (settings?.country && settings.country !== "PK") return { label: "2–5 working days", days: "2–5 days" };
  switch (deliveryZone(city)) {
    case "karachi":
      return { label: "Same day / Next day", days: "0–1 days" };
    case "major":
      return { label: "1–3 working days", days: "1–3 days" };
    default:
      return { label: "3–5 working days", days: "3–5 days" };
  }
}

/** A zone's charge for a cart of this weight: + `perKg` for each started kg above the included weight. */
export const weighedCharge = (charge: number, perKg: number | null | undefined, includedKg: number | null | undefined, weightKg: number) =>
  perKg && perKg > 0 && weightKg > (includedKg ?? 0) ? charge + Math.ceil(weightKg - (includedKg ?? 0) - 1e-9) * perKg : charge;

export function deliveryCharge(city: string, subtotal: number, settings: StoreSettings, postalCode = "", country?: string | null, opts: { weightKg?: number } = {}) {
  if (settings.zones?.length) {
    // Zones from /cms → Settings → Shipping
    const zone = city ? shippingZoneFor(city, settings, postalCode, country) : null;
    const freeAbove = zone?.freeAbove ?? settings.freeDeliveryThreshold;
    if (freeAbove > 0 && subtotal >= freeAbove) return 0;
    return zone ? weighedCharge(zone.charge, zone.perKg, zone.includedKg, opts.weightKg ?? 0) : settings.defaultDeliveryCharge;
  }
  // 0 = no free delivery (same rule as the zones above)
  if (settings.freeDeliveryThreshold > 0 && subtotal >= settings.freeDeliveryThreshold) return 0;
  if (!city) return settings.defaultDeliveryCharge;
  // the old per-city charges are for the store's own country
  if (country && country !== (settings.country || "PK")) return settings.defaultDeliveryCharge;
  return settings.cityCharges[city] ?? settings.defaultDeliveryCharge;
}

const methodId = (name: string) =>
  name
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "") || "method";

/** Does any zone price by weight or offer more than one delivery method? (Then checkout asks the server.) */
export const hasShippingChoices = (settings: Pick<StoreSettings, "zones">) => (settings.zones ?? []).some((z) => (z.methods?.length ?? 0) > 0 || (z.perKg ?? 0) > 0);

/**
 * The ways this address can be delivered to, with their charges for this cart: "Standard" (the zone's own charge –
 * the only one when the zone has no other methods) first, then the zone's other methods (Express …).
 */
export function shippingOptions(city: string, subtotal: number, settings: StoreSettings, postalCode = "", country?: string | null, weightKg = 0): ShippingOption[] {
  const estimate = deliveryEstimate(city, settings, postalCode, country).label;
  const options: ShippingOption[] = [{ id: "standard", name: "Standard", charge: deliveryCharge(city, subtotal, settings, postalCode, country, { weightKg }), estimate }];
  const zone = settings.zones?.length && city ? shippingZoneFor(city, settings, postalCode, country) : null;
  for (const m of zone?.methods ?? []) {
    const free = m.freeAbove != null && m.freeAbove > 0 && subtotal >= m.freeAbove;
    const id = methodId(m.name);
    if (id === "standard" || options.some((o) => o.id === id)) continue;
    options.push({ id, name: m.name, charge: free ? 0 : weighedCharge(m.charge, m.perKg, zone?.includedKg, weightKg), estimate: m.estimate?.trim() || estimate });
  }
  return options;
}

/** Cart total above which delivery is free for this city (0 = never free). */
export function freeDeliveryAbove(city: string, settings: Pick<StoreSettings, "zones" | "freeDeliveryThreshold" | "country">, postalCode = "", country?: string | null) {
  if (!settings.zones?.length) return settings.freeDeliveryThreshold;
  return (city ? shippingZoneFor(city, settings, postalCode, country)?.freeAbove : null) ?? settings.freeDeliveryThreshold;
}

/** localStorage key of the delivery city picked on a product page */
export const CITY_KEY = "urko-delivery-city";

/** The small part of the settings the product page and cart drawer need (not the whole settings object). */
export interface DeliveryInfo extends Pick<StoreSettings, "zones" | "freeDeliveryThreshold" | "country"> {
  cod: { enabled: boolean; maxOrder: number | null };
}

export function deliveryInfo(settings: StoreSettings): DeliveryInfo {
  return {
    zones: settings.zones,
    freeDeliveryThreshold: settings.freeDeliveryThreshold,
    country: settings.country,
    cod: { enabled: paymentEnabled("cod", settings), maxOrder: settings.payments?.cod.maxOrder ?? null },
  };
}

/** Cash-on-delivery handling fee (0 unless set in /cms → Settings → Payments). */
export const codFee = (settings: StoreSettings) => settings.payments?.cod.fee ?? 0;

/**
 * Is a payment method offered? (lib/payments/methods.ts decides: cards only once the store's payment account is
 * connected and switched on; wallets and bank only with real account details; JazzCash / EasyPaisa in Pakistan.)
 */
export function paymentEnabled(method: string, settings: StoreSettings) {
  return findCheckoutMethod(method, settings) !== null;
}
