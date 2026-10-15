"use client";
import { useMemo } from "react";
import { FieldLabel, useField } from "@payloadcms/ui";
import { allCurrencies, allTimeZones, countryDefaults, countryName, countryOptions, toCountryCode } from "../../lib/locale";

/**
 * Stores → Region: pick the country from a list; choosing it fills in its currency and time zone (both can still be
 * changed). Stores ISO codes ("PK", "USD", "Asia/Karachi").
 */

const box: React.CSSProperties = { width: "100%", padding: "8px 10px", borderRadius: 4, border: "1px solid var(--theme-elevation-150)", background: "var(--theme-input-bg)", color: "var(--theme-text)", fontSize: 14 };
const hint: React.CSSProperties = { margin: "6px 0 0", color: "var(--theme-elevation-500)", fontSize: 12 };
const sibling = (path: string, name: string) => path.replace(/[^.]+$/, name);

type Props = { path: string; field?: { label?: unknown; admin?: { readOnly?: boolean } }; readOnly?: boolean };

export function CountryField({ path, readOnly }: Props) {
  const { value, setValue } = useField<string>({ path });
  const currency = useField<string>({ path: sibling(path, "currency") });
  const timezone = useField<string>({ path: sibling(path, "timezone") });
  const options = useMemo(() => countryOptions(), []);
  const code = toCountryCode(value) ?? "";
  const onChange = (next: string) => {
    const before = code ? countryDefaults(code) : null;
    const after = countryDefaults(next);
    setValue(next);
    // follow the country unless the owner had picked something else than the old country's
    if (!currency.value || currency.value === before?.currency) currency.setValue(after.currency);
    if (!timezone.value || timezone.value === before?.timezone) timezone.setValue(after.timezone);
  };
  return (
    <div className="field-type" style={{ flex: 1 }}>
      <FieldLabel label="Country" path={path} />
      <select style={box} value={code} disabled={readOnly} onChange={(e) => onChange(e.target.value)} aria-label="Country">
        {!code && <option value="">Choose…</option>}
        {options.map((o) => (
          <option key={o.code} value={o.code}>
            {o.name}
          </option>
        ))}
      </select>
      <p style={hint}>Sets the currency, time zone, phone code and checkout address form.</p>
    </div>
  );
}

export function CurrencyField({ path, readOnly }: Props) {
  const { value, setValue } = useField<string>({ path });
  const list = useMemo(() => allCurrencies(), []);
  const names = useMemo(() => {
    try {
      return new Intl.DisplayNames(["en"], { type: "currency" });
    } catch {
      return null;
    }
  }, []);
  const cur = (value ?? "").toUpperCase();
  return (
    <div className="field-type" style={{ flex: 1 }}>
      <FieldLabel label="Currency" path={path} />
      <select style={box} value={cur} disabled={readOnly} onChange={(e) => setValue(e.target.value)} aria-label="Currency">
        {!list.includes(cur) && <option value={cur}>{cur || "Choose…"}</option>}
        {list.map((c) => (
          <option key={c} value={c}>
            {c} – {names?.of(c) ?? c}
          </option>
        ))}
      </select>
      <p style={hint}>Prices are entered and shown in this currency (changing it later does not convert existing prices).</p>
    </div>
  );
}

export function TimezoneField({ path, readOnly }: Props) {
  const { value, setValue } = useField<string>({ path });
  const country = useField<string>({ path: sibling(path, "country") });
  const list = useMemo(() => allTimeZones(), []);
  const tz = value ?? "";
  const home = countryDefaults(toCountryCode(country.value) ?? "PK").timezone;
  return (
    <div className="field-type" style={{ flex: 1 }}>
      <FieldLabel label="Time zone" path={path} />
      <select style={box} value={tz} disabled={readOnly} onChange={(e) => setValue(e.target.value)} aria-label="Time zone">
        {!list.includes(tz) && <option value={tz}>{tz || "Choose…"}</option>}
        {list.map((z) => (
          <option key={z} value={z}>
            {z.replace(/_/g, " ")}
            {z === home ? ` (${countryName(toCountryCode(country.value) ?? "PK")})` : ""}
          </option>
        ))}
      </select>
      <p style={hint}>Order numbers, &quot;today&quot; in reports and dates in messages use this clock.</p>
    </div>
  );
}
