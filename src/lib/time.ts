import { DEFAULT_LOCALE, type StoreLocale } from "./locale";

/**
 * Dates in the store's own time zone (order numbers, "today" in reports, receipts, messages). Client-safe.
 * Replaces the fixed Pakistan offset (UTC+5) the original shop used.
 */

type TimeLocale = Pick<StoreLocale, "timezone" | "locale">;

const partsFmt = new Map<string, Intl.DateTimeFormat>();
function parts(tz: string) {
  let f = partsFmt.get(tz);
  if (!f) {
    f = new Intl.DateTimeFormat("en-US", { timeZone: tz, hourCycle: "h23", year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", second: "2-digit" });
    partsFmt.set(tz, f);
  }
  return f;
}

/** Minutes the zone is ahead of UTC at that moment (Asia/Karachi → 300, America/New_York → -240 / -300). */
export function zoneOffsetMinutes(timezone: string, at: number = Date.now()): number {
  const p = Object.fromEntries(parts(timezone).formatToParts(new Date(at)).map((x) => [x.type, x.value]));
  const asUtc = Date.UTC(Number(p.year), Number(p.month) - 1, Number(p.day), Number(p.hour) % 24, Number(p.minute), Number(p.second));
  return Math.round((asUtc - Math.floor(at / 1000) * 1000) / 60000);
}

/** "YYYY-MM-DD" of a moment in the store's time zone. */
export function dayIn(at: number | string | Date, timezone: string = DEFAULT_LOCALE.timezone): string {
  const ms = typeof at === "number" ? at : new Date(at).getTime();
  const p = Object.fromEntries(parts(timezone).formatToParts(new Date(ms)).map((x) => [x.type, x.value]));
  return `${p.year}-${p.month}-${p.day}`;
}

/** The moment (UTC ms) a store-local day starts. */
export function dayStart(day: string, timezone: string = DEFAULT_LOCALE.timezone): number {
  const guess = Date.parse(`${day}T00:00:00Z`);
  // the offset can differ around a DST change: correct once with the offset at the guessed moment
  const first = guess - zoneOffsetMinutes(timezone, guess) * 60000;
  return guess - zoneOffsetMinutes(timezone, first) * 60000;
}

/** Days later / earlier ("2026-10-14" + 1 → "2026-10-15"). */
export function addDays(day: string, n: number): string {
  return new Date(Date.parse(`${day}T12:00:00Z`) + n * 86400_000).toISOString().slice(0, 10);
}

/** "YYMMDD" of now in the store's zone (order and receipt numbers). */
export const compactDay = (timezone: string = DEFAULT_LOCALE.timezone, at = Date.now()) => dayIn(at, timezone).slice(2).replace(/-/g, "");

/** A date (and time) as the store's customers read it. */
export function formatDate(at: string | number | Date, loc: TimeLocale = DEFAULT_LOCALE, opts: Intl.DateTimeFormatOptions = { dateStyle: "medium" }): string {
  try {
    return new Intl.DateTimeFormat(loc.locale || "en", { timeZone: loc.timezone, ...opts }).format(new Date(at));
  } catch {
    return new Date(at).toISOString().slice(0, 10);
  }
}
export const formatDateTime = (at: string | number | Date, loc: TimeLocale = DEFAULT_LOCALE) => formatDate(at, loc, { dateStyle: "medium", timeStyle: "short" });
