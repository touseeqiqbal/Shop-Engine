"use client";
import { useState } from "react";
import { toast } from "../ui/toast";

/** /cms/privacy – a customer asks for a copy of their data, or for it to be deleted. */

type Found = { accounts: { id: number; name: string; email: string }[]; counts: Record<string, number>; names: string[] };
const LABELS: Record<string, string> = {
  orders: "Orders",
  returns: "Returns",
  warrantyClaims: "Warranty claims",
  messages: "Contact messages",
  wholesale: "Wholesale enquiries",
  shopSales: "Shop sales",
  blockedList: "Blocked-numbers list (kept)",
};

export function PrivacyScreen() {
  const [q, setQ] = useState("");
  const [found, setFound] = useState<Found | null>(null);
  const [busy, setBusy] = useState(false);
  const [confirm, setConfirm] = useState("");

  async function search(e?: React.FormEvent) {
    e?.preventDefault();
    setBusy(true);
    setFound(null);
    try {
      const r = await fetch(`/cms-api/privacy/find?q=${encodeURIComponent(q)}`, { credentials: "include" });
      const j = (await r.json()) as Found & { error?: string };
      if (!r.ok) throw new Error(j.error || "Search failed");
      setFound(j);
    } catch (err) {
      toast((err as Error).message, "error");
    } finally {
      setBusy(false);
    }
  }

  async function erase() {
    setBusy(true);
    try {
      const r = await fetch("/cms-api/privacy/erase", { method: "POST", credentials: "include", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ q, confirm }) });
      const j = (await r.json()) as { error?: string; orders?: number; accounts?: number };
      if (!r.ok) throw new Error(j.error || "Could not delete");
      toast(`Deleted. ${j.accounts ?? 0} account(s) removed, ${j.orders ?? 0} order(s) anonymised.`);
      setConfirm("");
      void search();
    } catch (err) {
      toast((err as Error).message, "error");
    } finally {
      setBusy(false);
    }
  }

  const total = found ? Object.entries(found.counts).filter(([k]) => k !== "blockedList").reduce((s, [, v]) => s + v, 0) + found.accounts.length : 0;
  return (
    <div className="urko-home" style={{ maxWidth: 760 }}>
      <h1 style={{ margin: "0 0 4px" }}>Customer data requests</h1>
      <p className="urko-tip">When a customer asks “what do you have about me?” or “delete my data”. Check it&apos;s really them first (call the number back, or reply from the email).</p>
      <form onSubmit={search} className="urko-pos__row" style={{ display: "flex", gap: 8, margin: "16px 0" }}>
        <label className="urko-sr" htmlFor="privacy-q">
          Phone or email
        </label>
        <input id="privacy-q" className="urko-privacy__input" value={q} onChange={(e) => setQ(e.target.value)} placeholder="Phone or email" />
        <button className="urko-btn urko-btn--primary" disabled={busy || q.trim().length < 6}>
          Find
        </button>
      </form>
      {found && (
        <div className="urko-card">
          {total === 0 ? (
            <p>Nothing found for {q}.</p>
          ) : (
            <>
              <p>
                <strong>{found.names.join(", ") || q}</strong>
                {found.accounts.length ? ` · ${found.accounts.length} customer account(s)` : " · no account"}
              </p>
              <ul className="urko-list">
                {Object.entries(found.counts)
                  .filter(([, v]) => v > 0)
                  .map(([k, v]) => (
                    <li key={k}>
                      <span style={{ flex: 1 }}>{LABELS[k] ?? k}</span>
                      <strong>{v}</strong>
                    </li>
                  ))}
              </ul>
              <div className="urko-opanel__contact">
                <a className="urko-btn" href={`/cms-api/privacy/export?q=${encodeURIComponent(q)}`}>
                  Download their data (JSON)
                </a>
              </div>
              <div className="urko-privacy__danger">
                <h2>Delete this customer&apos;s data</h2>
                <p>
                  Removes their account, messages, enquiries and photos, and replaces their name, phone and address on orders, returns and shop sales with “Deleted customer”. Amounts and items stay for your
                  accounts. <strong>This can&apos;t be undone.</strong>
                </p>
                <label>
                  Type <code>DELETE</code> to confirm
                  <input value={confirm} onChange={(e) => setConfirm(e.target.value)} />
                </label>
                <button type="button" className="urko-btn urko-btn--danger" disabled={busy || confirm !== "DELETE"} onClick={erase}>
                  Delete their data
                </button>
              </div>
            </>
          )}
        </div>
      )}
    </div>
  );
}
