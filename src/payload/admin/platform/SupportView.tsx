"use client";
import { useState } from "react";

/**
 * Support "view as": the banner while a platform admin sees a store as one of its roles, and the form that starts it
 * (/cms/platform). Both reload /cms so every screen and menu follows the new rights.
 */

async function post(path: string, body: unknown = {}) {
  const r = await fetch(`/cms-api${path}`, { method: "POST", credentials: "include", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
  const j = (await r.json().catch(() => ({}))) as { error?: string };
  if (!r.ok) throw new Error(j.error || "Something went wrong");
}

export function SupportBanner({ storeName, role, until }: { storeName: string; role: string; until: string }) {
  const [busy, setBusy] = useState(false);
  return (
    <div className="urko-support" role="status">
      <span>
        Support view: <strong>{storeName}</strong> as <strong>{role}</strong> until {new Date(until).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
      </span>
      <button
        type="button"
        className="urko-btn urko-btn--ghost"
        disabled={busy}
        onClick={() => {
          setBusy(true);
          void post("/platform/view-as/stop")
            .then(() => window.location.assign("/cms/platform"))
            .catch(() => setBusy(false));
        }}
      >
        Stop
      </button>
    </div>
  );
}

export function ViewAsForm({ stores }: { stores: { id: number; name: string }[] }) {
  const [storeId, setStoreId] = useState(String(stores[0]?.id ?? ""));
  const [role, setRole] = useState("store_staff");
  const [reason, setReason] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  return (
    <form
      className="urko-support__form"
      onSubmit={(e) => {
        e.preventDefault();
        setBusy(true);
        setError("");
        void post("/platform/view-as", { storeId: Number(storeId), role, reason })
          .then(() => window.location.assign("/cms"))
          .catch((err: Error) => {
            setError(err.message);
            setBusy(false);
          });
      }}
    >
      <label>
        Store
        <select value={storeId} onChange={(e) => setStoreId(e.target.value)}>
          {stores.map((s) => (
            <option key={s.id} value={s.id}>
              {s.name}
            </option>
          ))}
        </select>
      </label>
      <label>
        See it as
        <select value={role} onChange={(e) => setRole(e.target.value)}>
          <option value="store_staff">Staff</option>
          <option value="store_manager">Manager</option>
          <option value="store_owner">Owner</option>
        </select>
      </label>
      <label className="urko-support__reason">
        Why (written to the store’s activity log)
        <input value={reason} onChange={(e) => setReason(e.target.value)} placeholder="e.g. support request #1234 – staff can’t see orders" maxLength={200} required minLength={5} />
      </label>
      <button type="submit" className="urko-btn urko-btn--primary" disabled={busy || reason.trim().length < 5}>
        {busy ? "Opening…" : "View for 30 minutes"}
      </button>
      {error && <p className="urko-int__result is-error">{error}</p>}
    </form>
  );
}
