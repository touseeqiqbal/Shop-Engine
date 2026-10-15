import { countryDefaults, DEFAULT_LOCALE } from "./locale";

/**
 * Phone numbers for stores in any country. Client-safe, no dependencies.
 *  - Pakistan keeps its familiar format "0300-1234567" (orders, risk checks and messages already use it).
 *  - Everywhere else numbers are stored internationally: "+44 7700900123" style → "+447700900123".
 * A number typed with its country code (+…, 00…) is always accepted; a local number gets the store's country code.
 */

const digitsOnly = (s: string) => s.replace(/\D/g, "");

/** Pakistani mobile → "0300-1234567"; null when it isn't one. */
export function normalizePkMobile(input: string): string | null {
  const digits = input.replace(/[^\d+]/g, "");
  let local = digits;
  if (local.startsWith("+92")) local = "0" + local.slice(3);
  else if (local.startsWith("0092")) local = "0" + local.slice(4);
  else if (local.startsWith("92") && local.length === 12) local = "0" + local.slice(2);
  if (!/^03\d{9}$/.test(local)) return null;
  return `${local.slice(0, 4)}-${local.slice(4)}`;
}

/**
 * A phone number as the store keeps it, or null when it can't be a phone number.
 * `country` = the store's country (ISO code).
 */
export function normalizePhone(input: string, country: string = DEFAULT_LOCALE.country): string | null {
  const raw = String(input ?? "").trim();
  if (!raw) return null;
  if (country === "PK") {
    const pk = normalizePkMobile(raw);
    if (pk) return pk;
    // a foreign number given in full international form is fine too
    if (!/^(\+|00)/.test(raw)) return null;
  }
  let d: string;
  if (raw.startsWith("+")) d = digitsOnly(raw);
  else if (raw.startsWith("00")) d = digitsOnly(raw).slice(2);
  else {
    const dial = countryDefaults(country).dial;
    // national number: drop the trunk 0 (UK 07…, DE 0151…) and add the country code
    const national = digitsOnly(raw).replace(/^0+/, "");
    d = national.startsWith(dial) && national.length > 10 ? national : `${dial}${national}`;
  }
  // E.164: at most 15 digits; at least 8 is a real subscriber number with its country code
  if (d.length < 8 || d.length > 15) return null;
  return `+${d}`;
}

/** Digits for comparing numbers (risk checks, "find my orders"): Pakistani numbers as 03…, others as full digits. */
export function phoneKey(phone: string): string {
  const d = digitsOnly(phone);
  if (/^92(3\d{9})$/.test(d)) return `0${d.slice(2)}`;
  return d;
}

/** International digits without "+" (WhatsApp, SMS gateways): "0300-1234567" → "923001234567", "07700 900123" (GB) → "447700900123". */
export function intlDigits(phone: string, country: string = DEFAULT_LOCALE.country): string {
  const raw = String(phone ?? "").trim();
  if (raw.startsWith("+")) return digitsOnly(raw);
  if (raw.startsWith("00")) return digitsOnly(raw).slice(2);
  const pk = normalizePkMobile(raw);
  if (pk) return `92${digitsOnly(pk).slice(1)}`;
  const d = digitsOnly(raw);
  const dial = countryDefaults(country).dial;
  // national number: drop the trunk 0; a number that already starts with the country code is kept
  if (d.startsWith("0")) return `${dial}${d.replace(/^0+/, "")}`;
  if (d.startsWith(dial) && d.length > 10) return d;
  return `${dial}${d}`;
}

/** Example shown in the phone field. */
export const phonePlaceholder = (country: string = DEFAULT_LOCALE.country) => (country === "PK" ? "03XX-XXXXXXX" : `+${countryDefaults(country).dial} …`);

/** As the shopper types: Pakistani mobiles get their dash; other numbers are left as typed. */
export function formatPhoneTyping(value: string, country: string = DEFAULT_LOCALE.country): string {
  if (country !== "PK" || /^\s*(\+|00)/.test(value)) return value.replace(/[^\d+\s()-]/g, "").slice(0, 20);
  const d = digitsOnly(value).slice(0, 11);
  return d.length > 4 ? `${d.slice(0, 4)}-${d.slice(4)}` : d;
}
