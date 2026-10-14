"use client";
import { useState } from "react";
import { useStore } from "../ui/store-context";

const STATUS: Record<string, string> = { draft: "set-up", suspended: "suspended", closed: "closed" };

/** Top of the admin menu: which store you're working in (switch here; a platform admin can also pick "All stores"). */
export function StoreSwitcher() {
  const s = useStore();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  if (!s.loaded || (!s.platformAdmin && s.stores.length < 2)) {
    const only = s.stores[0];
    return only ? (
      <div className="urko-store-switcher" title="The store you're working in">
        <strong>{only.name ?? only.slug}</strong>
        {only.status && STATUS[only.status] ? <span className="urko-badge">{STATUS[only.status]}</span> : null}
        {s.readOnly ? <span className="urko-badge urko-badge--r">read-only</span> : null}
      </div>
    ) : null;
  }
  return (
    <div className="urko-store-switcher">
      <label htmlFor="urko-store-switch" style={{ fontSize: 12, opacity: 0.7 }}>
        Working in
      </label>
      <select
        id="urko-store-switch"
        value={s.activeStoreId ?? ""}
        disabled={busy}
        onChange={async (e) => {
          setBusy(true);
          setError("");
          try {
            await s.switchTo(e.target.value ? Number(e.target.value) : null);
          } catch (err) {
            setError((err as Error).message);
            setBusy(false);
          }
        }}
        style={{ width: "100%" }}
      >
        {s.platformAdmin ? <option value="">All stores (platform)</option> : null}
        {s.stores.map((o) => (
          <option key={o.id} value={o.id}>
            {o.name ?? o.slug}
            {o.isDefault ? " (default)" : ""}
            {o.status && STATUS[o.status] ? ` – ${STATUS[o.status]}` : ""}
          </option>
        ))}
      </select>
      {s.readOnly ? <p style={{ fontSize: 12, margin: "4px 0 0" }}>This store is read-only (suspended or plan ended).</p> : null}
      {error ? <p role="alert" style={{ fontSize: 12, margin: "4px 0 0" }}>{error}</p> : null}
    </div>
  );
}
