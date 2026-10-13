"use client";
import { useState } from "react";
import { useAuth } from "@payloadcms/ui";

/** Dashboard card (owner only): download / restore the store configuration (settings, menus, pages…). */
export function ConfigBackup() {
  const { user } = useAuth<{ role?: string }>();
  const [status, setStatus] = useState("");
  if (user?.role !== "owner") return null;

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
