"use client";
import { useMemo, useState } from "react";
import { useAllFormFields, useField } from "@payloadcms/ui";
import { reduceFieldsToValues } from "payload/shared";
import { PAKISTAN_CITIES, deliveryCharge, deliveryEstimate, shippingZoneFor, shipToCountries } from "@/lib/cities";
import { countryName, toCountryCode } from "@/lib/locale";
import type { ShippingZone, StoreSettings } from "@/lib/types";
import { useAdminLocale, useAdminMoney } from "./ui/store-context";

/**
 * Settings → Shipping: try any city (and postcode) + cart total against the zones on screen (unsaved changes
 * included), using the exact function the cart and checkout use.
 */
export function ShippingFeeTester() {
  const [fields] = useAllFormFields();
  const { value: store } = useField<unknown>({ path: "store" });
  const { country } = useAdminLocale(store ?? undefined);
  const money = useAdminMoney(store ?? undefined);
  const pk = country === "PK";
  // untouched fields follow the store's country (it is known only once the admin's store list has loaded)
  const [typedCity, setCity] = useState<string | null>(null);
  const [postalCode, setPostalCode] = useState("");
  const [typedSubtotal, setSubtotal] = useState<number | null>(null);
  const [typedTo, setTo] = useState<string | null>(null);
  const to = typedTo ?? country;
  const city = typedCity ?? (to === "PK" ? "Lahore" : "");
  const subtotal = typedSubtotal ?? (pk ? 12000 : 100);

  const settings = useMemo<StoreSettings>(() => {
    const v = reduceFieldsToValues(fields, true) as { freeDeliveryThreshold?: number; defaultCharge?: number; shipTo?: string[]; zones?: Partial<ShippingZone>[] };
    const codes = (list?: string[]) => (list ?? []).map((c) => toCountryCode(c)).filter((c): c is string => Boolean(c));
    const zones: ShippingZone[] = (v.zones ?? []).map((z) => ({
      name: z.name ?? "",
      cities: z.cities ?? [],
      places: z.places ?? [],
      countries: codes(z.countries),
      rest: Boolean(z.rest),
      charge: Number(z.charge ?? 0),
      freeAbove: z.freeAbove == null || (z.freeAbove as unknown) === "" ? null : Number(z.freeAbove),
      estimate: z.estimate ?? "",
    }));
    return {
      zones: zones.length ? zones : undefined,
      freeDeliveryThreshold: Number(v.freeDeliveryThreshold ?? 0),
      defaultDeliveryCharge: Number(v.defaultCharge ?? 0),
      cityCharges: {},
      advanceThreshold: 0,
      advanceAmount: 0,
      bank: { bankName: "", accountTitle: "", accountNumber: "", iban: "" },
      jazzcash: { title: "", number: "" },
      easypaisa: { title: "", number: "" },
      country,
      shipTo: codes(v.shipTo),
    };
  }, [fields, country]);

  const countries = shipToCountries(settings);
  const zone = settings.zones ? shippingZoneFor(city, settings, postalCode, to) : null;
  const fee = deliveryCharge(city, subtotal, settings, postalCode, to);
  const eta = deliveryEstimate(city, settings, postalCode, to);
  const box: React.CSSProperties = { border: "1px solid var(--theme-elevation-150)", borderRadius: 6, padding: 16, marginTop: 8, marginBottom: 24 };
  const input: React.CSSProperties = { width: "100%", padding: "8px 10px", borderRadius: 4, border: "1px solid var(--theme-elevation-150)", background: "var(--theme-input-bg)", color: "var(--theme-text)" };

  return (
    <div style={box}>
      <h4 style={{ margin: "0 0 4px" }}>Fee tester</h4>
      <p style={{ margin: "0 0 12px", fontSize: 13, color: "var(--theme-elevation-600)" }}>Uses the values on this screen, including unsaved changes.</p>
      <div style={{ display: "grid", gridTemplateColumns: `repeat(${2 + (to === "PK" ? 0 : 1) + (countries.length > 1 ? 1 : 0)}, 1fr)`, gap: 12 }}>
        {countries.length > 1 && (
          <label style={{ fontSize: 13 }}>
            Country
            <select style={input} value={to} onChange={(e) => setTo(e.target.value)}>
              {countries.map((c) => (
                <option key={c} value={c}>
                  {countryName(c)}
                </option>
              ))}
            </select>
          </label>
        )}
        <label style={{ fontSize: 13 }}>
          City
          <input list="fee-tester-cities" style={input} value={city} onChange={(e) => setCity(e.target.value)} />
          {to === "PK" && (
            <datalist id="fee-tester-cities">
              {PAKISTAN_CITIES.map((c) => (
                <option key={c} value={c} />
              ))}
            </datalist>
          )}
        </label>
        {to !== "PK" && (
          <label style={{ fontSize: 13 }}>
            Postcode
            <input style={input} value={postalCode} onChange={(e) => setPostalCode(e.target.value)} />
          </label>
        )}
        <label style={{ fontSize: 13 }}>
          Cart total ({money.symbol})
          <input type="number" min={0} style={input} value={subtotal} onChange={(e) => setSubtotal(Number(e.target.value) || 0)} />
        </label>
      </div>
      <p style={{ margin: "14px 0 0", fontSize: 15 }}>
        <strong>{fee === 0 ? "Free delivery" : money(fee)}</strong>
        {" · "}
        {zone ? `zone “${zone.name}”` : settings.zones ? "no zone matched (default charge)" : "no zones yet (default charge)"}
        {" · "}
        {eta.label}
      </p>
    </div>
  );
}
