"use client";
import { useEffect, useMemo, useState } from "react";
import { FieldLabel, useField } from "@payloadcms/ui";
import { BUILT_IN_METHODS, builtInAvailable, paymentLabel } from "../../../lib/payments/methods";
import { useAdminLocale } from "../ui/store-context";

/**
 * Orders → Payment method: the built-in methods of the order's store's country and the store's own methods
 * (Settings → Payments → Other payment methods). Changing it also updates the method's name and when it is paid.
 */

type Own = { methodId?: string; name?: string };
const box: React.CSSProperties = { width: "100%", padding: "8px 10px", borderRadius: 4, border: "1px solid var(--theme-elevation-150)", background: "var(--theme-input-bg)", color: "var(--theme-text)", fontSize: 14 };

export function PaymentMethodField({ path, readOnly }: { path: string; readOnly?: boolean }) {
  const { value, setValue } = useField<string>({ path });
  const { value: label } = useField<string>({ path: "paymentMethodLabel" });
  const { value: store } = useField<unknown>({ path: "store" });
  const { country } = useAdminLocale(store ?? undefined);
  const storeId = store != null && typeof store === "object" ? (store as { id?: unknown }).id : store;
  const [own, setOwn] = useState<Own[]>([]);
  useEffect(() => {
    if (storeId == null || storeId === "") return;
    let live = true;
    // managers can read the payment settings; for staff the list keeps the built-in methods and the current one
    fetch(`/cms-api/store-payments?where[store][equals]=${encodeURIComponent(String(storeId))}&depth=0&limit=1`, { credentials: "include" })
      .then((r) => (r.ok ? r.json() : null))
      .then((res: { docs?: { manualMethods?: Own[] }[] } | null) => live && setOwn(res?.docs?.[0]?.manualMethods ?? []))
      .catch(() => undefined);
    return () => {
      live = false;
    };
  }, [storeId]);
  const options = useMemo(() => {
    const list = Object.keys(BUILT_IN_METHODS)
      .filter((id) => builtInAvailable(id, country))
      .map((id) => ({ id, label: BUILT_IN_METHODS[id].label }));
    for (const m of own) if (m.methodId && !list.some((o) => o.id === m.methodId)) list.push({ id: m.methodId, label: m.name || m.methodId });
    if (value && !list.some((o) => o.id === value)) list.unshift({ id: value, label: paymentLabel(value, label) });
    return list;
  }, [country, own, value, label]);
  return (
    <div className="field-type" style={{ flex: 1 }}>
      <FieldLabel label="Payment method" path={path} required />
      <select style={box} value={value ?? ""} disabled={readOnly} onChange={(e) => setValue(e.target.value)} aria-label="Payment method">
        {!value && <option value="">Choose…</option>}
        {options.map((o) => (
          <option key={o.id} value={o.id}>
            {o.label}
          </option>
        ))}
      </select>
    </div>
  );
}

/** Orders list: the method's name as the customer saw it. */
export function PaymentMethodCell({ cellData, rowData }: { cellData?: unknown; rowData?: { paymentMethodLabel?: string | null } }) {
  return <span>{paymentLabel(typeof cellData === "string" ? cellData : "", rowData?.paymentMethodLabel)}</span>;
}
