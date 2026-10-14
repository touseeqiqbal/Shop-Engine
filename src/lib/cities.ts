import type { StoreSettings } from "./types";

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

/** The configured shipping zone for a city (named zone first, then the "rest of Pakistan" zone). */
export function shippingZoneFor(city: string, settings: Pick<StoreSettings, "zones">) {
  const zones = settings.zones ?? [];
  const c = city.trim().toLowerCase();
  return zones.find((z) => !z.rest && z.cities.some((x) => x.trim().toLowerCase() === c)) ?? zones.find((z) => z.rest) ?? null;
}

export function deliveryEstimate(city: string, settings?: Pick<StoreSettings, "zones">) {
  const custom = settings ? shippingZoneFor(city, settings)?.estimate?.trim() : "";
  if (custom) return { label: custom, days: custom };
  switch (deliveryZone(city)) {
    case "karachi":
      return { label: "Same day / Next day", days: "0–1 days" };
    case "major":
      return { label: "1–3 working days", days: "1–3 days" };
    default:
      return { label: "3–5 working days", days: "3–5 days" };
  }
}

export function deliveryCharge(city: string, subtotal: number, settings: StoreSettings) {
  if (settings.zones?.length) {
    // Zones from /cms → Settings → Shipping
    const zone = city ? shippingZoneFor(city, settings) : null;
    const freeAbove = zone?.freeAbove ?? settings.freeDeliveryThreshold;
    if (freeAbove > 0 && subtotal >= freeAbove) return 0;
    return zone ? zone.charge : settings.defaultDeliveryCharge;
  }
  // 0 = no free delivery (same rule as the zones above)
  if (settings.freeDeliveryThreshold > 0 && subtotal >= settings.freeDeliveryThreshold) return 0;
  if (!city) return settings.defaultDeliveryCharge;
  return settings.cityCharges[city] ?? settings.defaultDeliveryCharge;
}

/** Cart total above which delivery is free for this city (0 = never free). */
export function freeDeliveryAbove(city: string, settings: Pick<StoreSettings, "zones" | "freeDeliveryThreshold">) {
  if (!settings.zones?.length) return settings.freeDeliveryThreshold;
  return (city ? shippingZoneFor(city, settings)?.freeAbove : null) ?? settings.freeDeliveryThreshold;
}

/** localStorage key of the delivery city picked on a product page */
export const CITY_KEY = "urko-delivery-city";

/** The small part of the settings the product page and cart drawer need (not the whole settings object). */
export interface DeliveryInfo extends Pick<StoreSettings, "zones" | "freeDeliveryThreshold"> {
  cod: { enabled: boolean; maxOrder: number | null };
}

export function deliveryInfo(settings: StoreSettings): DeliveryInfo {
  return {
    zones: settings.zones,
    freeDeliveryThreshold: settings.freeDeliveryThreshold,
    cod: { enabled: paymentEnabled("cod", settings), maxOrder: settings.payments?.cod.maxOrder ?? null },
  };
}

/** Cash-on-delivery handling fee (0 unless set in /cms → Settings → Payments). */
export const codFee = (settings: StoreSettings) => settings.payments?.cod.fee ?? 0;

/** Is a payment method offered? Cards only once the store's online payment account is connected and switched on. */
export function paymentEnabled(method: "cod" | "jazzcash" | "easypaisa" | "bank" | "card", settings: StoreSettings) {
  if (method === "card") return Boolean(settings.cardReady && settings.payments?.card?.enabled);
  const on = settings.payments ? settings.payments[method].enabled : true;
  if (!on) return false;
  // never show a payment method without real account details (customers would send money nowhere)
  if (method === "bank") return Boolean(settings.bank?.accountNumber?.replace(/[\s0-]/g, "") || settings.bank?.iban?.replace(/[\sPK0A-Z]/gi, ""));
  if (method === "jazzcash") return Boolean(settings.jazzcash?.number?.trim());
  if (method === "easypaisa") return Boolean(settings.easypaisa?.number?.trim());
  return true;
}
