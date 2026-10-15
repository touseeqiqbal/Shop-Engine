/**
 * Countries, currencies, time zones and languages for stores anywhere in the world. Client-safe (no server imports).
 *
 * A store picks its COUNTRY; the currency, time zone and phone code start from that country (each can be changed).
 * The original shop (default store) is Pakistan / PKR / Asia/Karachi, so it looks exactly as before.
 */

export type StoreLocale = {
  /** ISO 3166-1 alpha-2, e.g. "PK", "US", "AE" */
  country: string;
  /** ISO 4217, e.g. "PKR", "USD" */
  currency: string;
  /** IANA time zone, e.g. "Asia/Karachi" */
  timezone: string;
  /** BCP 47 tag used for number / date formatting, e.g. "en-PK" */
  locale: string;
  /** international dialling code without "+", e.g. "92" */
  dial: string;
};

export const DEFAULT_LOCALE: StoreLocale = { country: "PK", currency: "PKR", timezone: "Asia/Karachi", locale: "en-PK", dial: "92" };

/** code → [currency, main time zone, dialling code]. Countries with several zones list the capital's (editable per store). */
const C: Record<string, [string, string, string]> = {
  AD: ["EUR", "Europe/Andorra", "376"], AE: ["AED", "Asia/Dubai", "971"], AF: ["AFN", "Asia/Kabul", "93"], AG: ["XCD", "America/Antigua", "1"],
  AL: ["ALL", "Europe/Tirane", "355"], AM: ["AMD", "Asia/Yerevan", "374"], AO: ["AOA", "Africa/Luanda", "244"], AR: ["ARS", "America/Argentina/Buenos_Aires", "54"],
  AT: ["EUR", "Europe/Vienna", "43"], AU: ["AUD", "Australia/Sydney", "61"], AZ: ["AZN", "Asia/Baku", "994"], BA: ["BAM", "Europe/Sarajevo", "387"],
  BB: ["BBD", "America/Barbados", "1"], BD: ["BDT", "Asia/Dhaka", "880"], BE: ["EUR", "Europe/Brussels", "32"], BF: ["XOF", "Africa/Ouagadougou", "226"],
  BG: ["BGN", "Europe/Sofia", "359"], BH: ["BHD", "Asia/Bahrain", "973"], BI: ["BIF", "Africa/Bujumbura", "257"], BJ: ["XOF", "Africa/Porto-Novo", "229"],
  BN: ["BND", "Asia/Brunei", "673"], BO: ["BOB", "America/La_Paz", "591"], BR: ["BRL", "America/Sao_Paulo", "55"], BS: ["BSD", "America/Nassau", "1"],
  BT: ["BTN", "Asia/Thimphu", "975"], BW: ["BWP", "Africa/Gaborone", "267"], BY: ["BYN", "Europe/Minsk", "375"], BZ: ["BZD", "America/Belize", "501"],
  CA: ["CAD", "America/Toronto", "1"], CD: ["CDF", "Africa/Kinshasa", "243"], CF: ["XAF", "Africa/Bangui", "236"], CG: ["XAF", "Africa/Brazzaville", "242"],
  CH: ["CHF", "Europe/Zurich", "41"], CI: ["XOF", "Africa/Abidjan", "225"], CL: ["CLP", "America/Santiago", "56"], CM: ["XAF", "Africa/Douala", "237"],
  CN: ["CNY", "Asia/Shanghai", "86"], CO: ["COP", "America/Bogota", "57"], CR: ["CRC", "America/Costa_Rica", "506"], CU: ["CUP", "America/Havana", "53"],
  CV: ["CVE", "Atlantic/Cape_Verde", "238"], CY: ["EUR", "Asia/Nicosia", "357"], CZ: ["CZK", "Europe/Prague", "420"], DE: ["EUR", "Europe/Berlin", "49"],
  DJ: ["DJF", "Africa/Djibouti", "253"], DK: ["DKK", "Europe/Copenhagen", "45"], DM: ["XCD", "America/Dominica", "1"], DO: ["DOP", "America/Santo_Domingo", "1"],
  DZ: ["DZD", "Africa/Algiers", "213"], EC: ["USD", "America/Guayaquil", "593"], EE: ["EUR", "Europe/Tallinn", "372"], EG: ["EGP", "Africa/Cairo", "20"],
  ER: ["ERN", "Africa/Asmara", "291"], ES: ["EUR", "Europe/Madrid", "34"], ET: ["ETB", "Africa/Addis_Ababa", "251"], FI: ["EUR", "Europe/Helsinki", "358"],
  FJ: ["FJD", "Pacific/Fiji", "679"], FR: ["EUR", "Europe/Paris", "33"], GA: ["XAF", "Africa/Libreville", "241"], GB: ["GBP", "Europe/London", "44"],
  GD: ["XCD", "America/Grenada", "1"], GE: ["GEL", "Asia/Tbilisi", "995"], GH: ["GHS", "Africa/Accra", "233"], GM: ["GMD", "Africa/Banjul", "220"],
  GN: ["GNF", "Africa/Conakry", "224"], GQ: ["XAF", "Africa/Malabo", "240"], GR: ["EUR", "Europe/Athens", "30"], GT: ["GTQ", "America/Guatemala", "502"],
  GY: ["GYD", "America/Guyana", "592"], HK: ["HKD", "Asia/Hong_Kong", "852"], HN: ["HNL", "America/Tegucigalpa", "504"], HR: ["EUR", "Europe/Zagreb", "385"],
  HT: ["HTG", "America/Port-au-Prince", "509"], HU: ["HUF", "Europe/Budapest", "36"], ID: ["IDR", "Asia/Jakarta", "62"], IE: ["EUR", "Europe/Dublin", "353"],
  IL: ["ILS", "Asia/Jerusalem", "972"], IN: ["INR", "Asia/Kolkata", "91"], IQ: ["IQD", "Asia/Baghdad", "964"], IR: ["IRR", "Asia/Tehran", "98"],
  IS: ["ISK", "Atlantic/Reykjavik", "354"], IT: ["EUR", "Europe/Rome", "39"], JM: ["JMD", "America/Jamaica", "1"], JO: ["JOD", "Asia/Amman", "962"],
  JP: ["JPY", "Asia/Tokyo", "81"], KE: ["KES", "Africa/Nairobi", "254"], KG: ["KGS", "Asia/Bishkek", "996"], KH: ["KHR", "Asia/Phnom_Penh", "855"],
  KM: ["KMF", "Indian/Comoro", "269"], KN: ["XCD", "America/St_Kitts", "1"], KR: ["KRW", "Asia/Seoul", "82"], KW: ["KWD", "Asia/Kuwait", "965"],
  KZ: ["KZT", "Asia/Almaty", "7"], LA: ["LAK", "Asia/Vientiane", "856"], LB: ["LBP", "Asia/Beirut", "961"], LC: ["XCD", "America/St_Lucia", "1"],
  LI: ["CHF", "Europe/Vaduz", "423"], LK: ["LKR", "Asia/Colombo", "94"], LR: ["LRD", "Africa/Monrovia", "231"], LS: ["LSL", "Africa/Maseru", "266"],
  LT: ["EUR", "Europe/Vilnius", "370"], LU: ["EUR", "Europe/Luxembourg", "352"], LV: ["EUR", "Europe/Riga", "371"], LY: ["LYD", "Africa/Tripoli", "218"],
  MA: ["MAD", "Africa/Casablanca", "212"], MC: ["EUR", "Europe/Monaco", "377"], MD: ["MDL", "Europe/Chisinau", "373"], ME: ["EUR", "Europe/Podgorica", "382"],
  MG: ["MGA", "Indian/Antananarivo", "261"], MK: ["MKD", "Europe/Skopje", "389"], ML: ["XOF", "Africa/Bamako", "223"], MM: ["MMK", "Asia/Yangon", "95"],
  MN: ["MNT", "Asia/Ulaanbaatar", "976"], MO: ["MOP", "Asia/Macau", "853"], MR: ["MRU", "Africa/Nouakchott", "222"], MT: ["EUR", "Europe/Malta", "356"],
  MU: ["MUR", "Indian/Mauritius", "230"], MV: ["MVR", "Indian/Maldives", "960"], MW: ["MWK", "Africa/Blantyre", "265"], MX: ["MXN", "America/Mexico_City", "52"],
  MY: ["MYR", "Asia/Kuala_Lumpur", "60"], MZ: ["MZN", "Africa/Maputo", "258"], NA: ["NAD", "Africa/Windhoek", "264"], NE: ["XOF", "Africa/Niamey", "227"],
  NG: ["NGN", "Africa/Lagos", "234"], NI: ["NIO", "America/Managua", "505"], NL: ["EUR", "Europe/Amsterdam", "31"], NO: ["NOK", "Europe/Oslo", "47"],
  NP: ["NPR", "Asia/Kathmandu", "977"], NZ: ["NZD", "Pacific/Auckland", "64"], OM: ["OMR", "Asia/Muscat", "968"], PA: ["PAB", "America/Panama", "507"],
  PE: ["PEN", "America/Lima", "51"], PG: ["PGK", "Pacific/Port_Moresby", "675"], PH: ["PHP", "Asia/Manila", "63"], PK: ["PKR", "Asia/Karachi", "92"],
  PL: ["PLN", "Europe/Warsaw", "48"], PR: ["USD", "America/Puerto_Rico", "1"], PS: ["ILS", "Asia/Gaza", "970"], PT: ["EUR", "Europe/Lisbon", "351"],
  PY: ["PYG", "America/Asuncion", "595"], QA: ["QAR", "Asia/Qatar", "974"], RO: ["RON", "Europe/Bucharest", "40"], RS: ["RSD", "Europe/Belgrade", "381"],
  RU: ["RUB", "Europe/Moscow", "7"], RW: ["RWF", "Africa/Kigali", "250"], SA: ["SAR", "Asia/Riyadh", "966"], SB: ["SBD", "Pacific/Guadalcanal", "677"],
  SC: ["SCR", "Indian/Mahe", "248"], SD: ["SDG", "Africa/Khartoum", "249"], SE: ["SEK", "Europe/Stockholm", "46"], SG: ["SGD", "Asia/Singapore", "65"],
  SI: ["EUR", "Europe/Ljubljana", "386"], SK: ["EUR", "Europe/Bratislava", "421"], SL: ["SLE", "Africa/Freetown", "232"], SN: ["XOF", "Africa/Dakar", "221"],
  SO: ["SOS", "Africa/Mogadishu", "252"], SR: ["SRD", "America/Paramaribo", "597"], SS: ["SSP", "Africa/Juba", "211"], SV: ["USD", "America/El_Salvador", "503"],
  SY: ["SYP", "Asia/Damascus", "963"], SZ: ["SZL", "Africa/Mbabane", "268"], TD: ["XAF", "Africa/Ndjamena", "235"], TG: ["XOF", "Africa/Lome", "228"],
  TH: ["THB", "Asia/Bangkok", "66"], TJ: ["TJS", "Asia/Dushanbe", "992"], TL: ["USD", "Asia/Dili", "670"], TM: ["TMT", "Asia/Ashgabat", "993"],
  TN: ["TND", "Africa/Tunis", "216"], TO: ["TOP", "Pacific/Tongatapu", "676"], TR: ["TRY", "Europe/Istanbul", "90"], TT: ["TTD", "America/Port_of_Spain", "1"],
  TW: ["TWD", "Asia/Taipei", "886"], TZ: ["TZS", "Africa/Dar_es_Salaam", "255"], UA: ["UAH", "Europe/Kyiv", "380"], UG: ["UGX", "Africa/Kampala", "256"],
  US: ["USD", "America/New_York", "1"], UY: ["UYU", "America/Montevideo", "598"], UZ: ["UZS", "Asia/Tashkent", "998"], VC: ["XCD", "America/St_Vincent", "1"],
  VE: ["VES", "America/Caracas", "58"], VN: ["VND", "Asia/Ho_Chi_Minh", "84"], VU: ["VUV", "Pacific/Efate", "678"], WS: ["WST", "Pacific/Apia", "685"],
  XK: ["EUR", "Europe/Belgrade", "383"], YE: ["YER", "Asia/Aden", "967"], ZA: ["ZAR", "Africa/Johannesburg", "27"], ZM: ["ZMW", "Africa/Lusaka", "260"],
  ZW: ["USD", "Africa/Harare", "263"],
};

export const COUNTRY_CODES = Object.keys(C).sort();

const names = new Map<string, Intl.DisplayNames | null>();
/** English country name ("PK" → "Pakistan"). */
export function countryName(code: string, displayLocale = "en"): string {
  if (!names.has(displayLocale)) {
    try {
      names.set(displayLocale, new Intl.DisplayNames([displayLocale], { type: "region" }));
    } catch {
      names.set(displayLocale, null);
    }
  }
  try {
    return names.get(displayLocale)?.of(code) ?? code;
  } catch {
    return code;
  }
}

let byName: Map<string, string> | null = null;
/** Country code from a code or an English name ("Pakistan" → "PK"); null when unknown. */
export function toCountryCode(value: string | null | undefined): string | null {
  const v = String(value ?? "").trim();
  if (!v) return null;
  const upper = v.toUpperCase();
  if (C[upper]) return upper;
  byName ??= new Map(COUNTRY_CODES.map((c) => [countryName(c).toLowerCase(), c]));
  return byName.get(v.toLowerCase()) ?? null;
}

// names that read with "the" in a sentence
const WITH_THE = new Set(["US", "GB", "AE", "NL", "PH", "BS", "GM", "MV", "CF", "DO", "KM", "SB"]);
/** A country's name as it reads in a sentence: "Pakistan", "the United States". */
export const countryInText = (code: string) => (WITH_THE.has(code) ? `the ${countryName(code)}` : countryName(code));
/** Where a store delivers, in words: "all over Pakistan" (the original shop's wording) or "across the United States". */
export const deliveryArea = (code: string) => (code === "PK" ? "all over Pakistan" : `across ${countryInText(code)}`);

/** The starting currency / time zone / dialling code of a country. */
export function countryDefaults(code: string): { currency: string; timezone: string; dial: string } {
  const row = C[toCountryCode(code) ?? ""] ?? C.PK;
  return { currency: row[0], timezone: row[1], dial: row[2] };
}

/** Options for a country picker, sorted by name. */
export const countryOptions = () => COUNTRY_CODES.map((code) => ({ code, name: countryName(code) })).sort((a, b) => a.name.localeCompare(b.name));

let currencySet: Set<string> | null = null;
/** A real ISO 4217 currency (Intl accepts any three letters, so the runtime's list decides when it has one). */
export const isCurrency = (c: string) => {
  if (!/^[A-Z]{3}$/.test(c)) return false;
  currencySet ??= new Set([...allCurrencies(), ...Object.values(C).map((r) => r[0])]);
  return currencySet.has(c);
};
export const isTimeZone = (tz: string) => { try { new Intl.DateTimeFormat("en", { timeZone: tz }); return true; } catch { return false; } };

/** Every currency and time zone the runtime knows (for pickers). */
export const allCurrencies = (): string[] => { try { return (Intl as unknown as { supportedValuesOf: (k: string) => string[] }).supportedValuesOf("currency"); } catch { return [...new Set(Object.values(C).map((r) => r[0]))].sort(); } };
export const allTimeZones = (): string[] => { try { return (Intl as unknown as { supportedValuesOf: (k: string) => string[] }).supportedValuesOf("timeZone"); } catch { return [...new Set(Object.values(C).map((r) => r[1]))].sort(); } };

type SavedLocale = { country?: string | null; currency?: string | null; timezone?: string | null; language?: string | null; defaultLanguage?: string | null };

const resolved = new Map<string, StoreLocale>();
/**
 * A store's locale from what it saved (country / currency / time zone / language); anything missing or invalid falls
 * back to the country's defaults, then to the original shop's (Pakistan).
 */
export function storeLocale(s: SavedLocale | null | undefined): StoreLocale {
  const key = [s?.country, s?.currency, s?.timezone, s?.language ?? s?.defaultLanguage].join("|");
  const hit = resolved.get(key);
  if (hit) return hit;
  const country = toCountryCode(s?.country) ?? DEFAULT_LOCALE.country;
  const d = countryDefaults(country);
  const currency = String(s?.currency ?? "").trim().toUpperCase();
  const timezone = String(s?.timezone ?? "").trim();
  const lang = String(s?.language ?? s?.defaultLanguage ?? "en").trim().toLowerCase().split(/[-_]/)[0] || "en";
  let locale = `${lang}-${country}`;
  try {
    new Intl.NumberFormat(locale);
  } catch {
    locale = "en";
  }
  const out = { country, currency: isCurrency(currency) ? currency : d.currency, timezone: timezone && isTimeZone(timezone) ? timezone : d.timezone, locale, dial: d.dial };
  if (resolved.size < 500) resolved.set(key, out);
  return out;
}

/** "en-PK" → "en_PK" (Open Graph). */
export const ogLocale = (l: Pick<StoreLocale, "locale">) => l.locale.replace("-", "_");
