"use client";
import { useEffect, useState } from "react";
import { useAuth } from "@payloadcms/ui";

type StoreData = { owner: boolean; storeName?: string; status?: string; canClose?: boolean };

/** Is the signed-in person the owner of the store being worked in (or the original shop's owner)? */
function useStoreOwner() {
  const [data, setData] = useState<StoreData | null>(null);
  useEffect(() => {
    void fetch("/cms-api/store-data/status", { credentials: "include" })
      .then((r) => r.json())
      .then((d: StoreData) => setData(d))
      .catch(() => setData({ owner: false }));
  }, []);
  return data;
}

/** Dashboard card (owner only): download / restore the store configuration (settings, menus, pages…). */
export function ConfigBackup() {
  const { user } = useAuth<{ role?: string }>();
  const owner = useStoreOwner();
  const [status, setStatus] = useState("");
  // every store's owner (not only the original shop's): the endpoints check the same
  if (user?.role !== "owner" && !owner?.owner) return null;

  const onFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    const body = await file.text();
    setStatus("Checking the file…");
    const dry = await fetch("/cms-api/config-import?dryRun=1", { method: "POST", credentials: "include", headers: { "Content-Type": "application/json" }, body });
    const plan = await dry.json();
    if (!dry.ok) return setStatus(plan.error ?? "This file can't be imported.");
    const summary = `${plan.globals.length} settings sections, ${plan.updated.length} items to update, ${plan.created.length} to create${plan.skipped.length ? `, ${plan.skipped.length} skipped` : ""}.`;
    if (!window.confirm(`Restore this configuration?\n\n${summary}\n\nCurrent settings will be replaced.`)) return setStatus("Import cancelled.");
    setStatus("Importing…");
    const res = await fetch("/cms-api/config-import", { method: "POST", credentials: "include", headers: { "Content-Type": "application/json" }, body });
    const done = await res.json();
    setStatus(res.ok ? `Done – ${done.globals.length} settings sections, ${done.updated.length} updated, ${done.created.length} created.${done.failed?.length ? ` Not restored: ${done.failed.join("; ")}` : ""}` : done.error ?? "Import failed.");
  };

  return (
    <section className="urko-card" aria-labelledby="backup-h">
      <h2 id="backup-h" className="urko-h3">
        Settings backup
      </h2>
      <p className="urko-muted" style={{ margin: "0 0 12px" }}>
        All settings, theme, menus, pages, collections and redirects in one file. Orders, customers and products are covered by the daily database backup.
      </p>
      <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
        <a href="/cms-api/config-export" className="btn btn--style-primary btn--size-medium urko-btn-inline">
          Download settings
        </a>
        <label className="btn btn--style-secondary btn--size-medium urko-btn-inline" style={{ cursor: "pointer" }}>
          Restore from file…
          <input type="file" accept="application/json,.json" onChange={onFile} style={{ display: "none" }} />
        </label>
      </div>
      {status && (
        <p role="status" style={{ margin: "12px 0 0" }}>
          {status}
        </p>
      )}
    </section>
  );
}

/** Dashboard card (store owner): all of the store's data in one file, and closing the store. */
export function StoreDataCard() {
  const owner = useStoreOwner();
  const [confirm, setConfirm] = useState("");
  const [msg, setMsg] = useState("");
  const [closing, setClosing] = useState(false);
  if (!owner?.owner) return null;
  const close = async () => {
    setMsg("");
    const r = await fetch("/cms-api/store-data/close", { method: "POST", credentials: "include", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ confirm }) });
    const j = (await r.json().catch(() => ({}))) as { error?: string };
    if (!r.ok) return setMsg(j.error ?? "Couldn’t close the store.");
    window.location.reload();
  };
  return (
    <section className="urko-card" aria-labelledby="store-data-h">
      <h2 id="store-data-h" className="urko-h3">
        Your store’s data
      </h2>
      <p className="urko-muted" style={{ margin: "0 0 12px" }}>
        Everything in {owner.storeName || "this store"} in one file – products, orders, customers, pages, stock history, team and integration settings (never keys or passwords). Yours to keep or to move elsewhere.
      </p>
      <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
        <a href="/cms-api/store-data/export" className="btn btn--style-primary btn--size-medium urko-btn-inline">
          Download all store data
        </a>
        {owner.canClose && !closing && (
          <button type="button" className="btn btn--style-secondary btn--size-medium urko-btn-inline" onClick={() => setClosing(true)}>
            Close this store…
          </button>
        )}
      </div>
      {closing && (
        <div style={{ marginTop: 12, display: "grid", gap: 8 }}>
          <p className="urko-small" style={{ margin: 0 }}>
            Closing takes the shop offline and makes /cms read-only. Nothing is deleted – ShopEngine can reopen it, and deletes a store only when asked. Download your data first. Type <strong>{owner.storeName}</strong> to confirm:
          </p>
          <input value={confirm} onChange={(e) => setConfirm(e.target.value)} aria-label="Store name to confirm" style={{ minHeight: 38, padding: "6px 10px", borderRadius: 8 }} />
          <div style={{ display: "flex", gap: 8 }}>
            <button type="button" className="btn btn--style-primary btn--size-medium urko-btn-inline" disabled={confirm.trim() !== (owner.storeName ?? "").trim()} onClick={() => void close()}>
              Close the store
            </button>
            <button type="button" className="btn btn--style-secondary btn--size-medium urko-btn-inline" onClick={() => setClosing(false)}>
              Keep it open
            </button>
          </div>
        </div>
      )}
      {msg && <p className="urko-int__result is-error">{msg}</p>}
    </section>
  );
}
