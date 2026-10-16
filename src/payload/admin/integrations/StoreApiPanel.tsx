"use client";
import { useCallback, useEffect, useState } from "react";
import { toast } from "../ui/toast";

/**
 * /cms/integrations → Store API: API keys for the store's own systems (ERP, stock sync, Zapier / Make / n8n).
 * A new key is shown once; after that only its first characters. Endpoints: src/app/api/v1, docs/STORE-API.md.
 */

type Key = { id: number; name: string; prefix: string; scopes: string[]; createdBy: string | null; createdAt: string; lastUsedAt: string | null };
type Data = { keys: Key[]; scopes: { label: string; value: string }[]; canCreate: boolean };

async function call<T>(path: string, body?: unknown): Promise<T> {
  const r = await fetch(`/cms-api${path}`, body === undefined ? { credentials: "include" } : { method: "POST", credentials: "include", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
  const j = (await r.json().catch(() => ({}))) as T & { error?: string };
  if (!r.ok) throw new Error(j.error || "Something went wrong");
  return j;
}

const ENDPOINTS: [string, string, string][] = [
  ["GET", "/products", "products, newest change first – ?page= &limit= (max 100) &updated_since= &sku="],
  ["GET", "/products/{id or SKU}", "one product"],
  ["PATCH", "/products/{id or SKU}", "{ \"stock\": 12, \"price\": 2499, \"compareAtPrice\": 2999 } – any of them"],
  ["GET", "/orders", "orders, newest change first – ?page= &limit= &status= &updated_since="],
  ["GET", "/orders/{order number}", "one order with its items and shipments"],
  ["POST", "/orders/{order number}/status", "{ \"status\": \"dispatched\", \"courier\": \"TCS\", \"trackingNumber\": \"…\" }"],
];

const when = (iso: string | null) => (iso ? new Date(iso).toLocaleString() : "never");

export function StoreApiPanel() {
  const [data, setData] = useState<Data | null>(null);
  const [name, setName] = useState("");
  const [scopes, setScopes] = useState<string[]>(["products:read", "orders:read"]);
  const [busy, setBusy] = useState(false);
  const [made, setMade] = useState<{ key: string; name: string } | null>(null);

  const load = useCallback(async () => {
    try {
      setData(await call<Data>("/integration-tools/api-keys"));
    } catch (e) {
      toast((e as Error).message, "error");
    }
  }, []);
  useEffect(() => void load(), [load]);

  async function create(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    try {
      const r = await call<{ key: string }>("/integration-tools/api-keys", { name, scopes });
      setMade({ key: r.key, name });
      setName("");
      await load();
    } catch (err) {
      toast((err as Error).message, "error");
    } finally {
      setBusy(false);
    }
  }

  async function revoke(k: Key) {
    if (!window.confirm(`Remove the key “${k.name}”? Anything still using it stops working straight away.`)) return;
    try {
      await call("/integration-tools/api-keys/revoke", { id: k.id });
      toast("Key removed.");
      await load();
    } catch (err) {
      toast((err as Error).message, "error");
    }
  }

  if (!data) return <p className="urko-muted">Loading…</p>;
  const base = `${typeof window === "undefined" ? "" : window.location.origin}/api/v1`;
  const label = (s: string) => data.scopes.find((x) => x.value === s)?.label ?? s;

  return (
    <div className="urko-int__api">
      <p className="urko-muted urko-int__groupnote">
        Let your own systems – an ERP or warehouse app, an accounting tool, Zapier, Make or n8n – read your products and orders and keep stock, prices and order status in step. Each key reaches this store only, and only what you allow it.
      </p>

      {made && (
        <div className="urko-int__note urko-int__note--warn" role="status">
          <strong>Copy the key for “{made.name}” now – it won’t be shown again.</strong>
          <div className="urko-int__copy" style={{ marginTop: 8 }}>
            <input type="text" readOnly value={made.key} onFocus={(e) => e.target.select()} aria-label="New API key" />
            <button type="button" className="urko-btn urko-btn--ghost" onClick={() => void navigator.clipboard?.writeText(made.key).then(() => toast("Copied."))}>
              Copy
            </button>
            <button type="button" className="urko-btn urko-btn--ghost" onClick={() => setMade(null)}>
              Done
            </button>
          </div>
        </div>
      )}

      <section className="urko-card urko-int__apicard" aria-labelledby="api-keys-h">
        <h2 id="api-keys-h" className="urko-h2">
          API keys
        </h2>
        {data.keys.length === 0 ? (
          <p className="urko-muted">No keys yet.</p>
        ) : (
          <div className="urko-int__table" role="table" aria-label="API keys">
            {data.keys.map((k) => (
              <div key={k.id} className="urko-int__row" role="row">
                <div role="cell">
                  <strong>{k.name}</strong>
                  <div className="urko-muted urko-int__mono">{k.prefix}</div>
                </div>
                <div role="cell" className="urko-int__badges">
                  {k.scopes.map((s) => (
                    <span key={s} className={`urko-badge urko-badge--${s.endsWith(":write") ? "y" : "n"}`}>
                      {label(s)}
                    </span>
                  ))}
                </div>
                <div role="cell" className="urko-muted urko-int__small">
                  Made {when(k.createdAt)}
                  {k.createdBy ? ` by ${k.createdBy}` : ""}
                  <br />
                  Last used {when(k.lastUsedAt)}
                </div>
                <div role="cell">
                  <button type="button" className="urko-btn urko-btn--danger" onClick={() => void revoke(k)}>
                    Remove
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}

        {data.canCreate ? (
          <form className="urko-int__form urko-int__apiform" onSubmit={(e) => void create(e)}>
            <div className="urko-int__field">
              <label htmlFor="api-key-name">New key – name *</label>
              <input id="api-key-name" type="text" value={name} maxLength={60} onChange={(e) => setName(e.target.value)} placeholder="e.g. Warehouse stock sync" required />
            </div>
            <fieldset className="urko-int__mode urko-int__scopes">
              <legend>It may</legend>
              {data.scopes.map((s) => (
                <label key={s.value}>
                  <input type="checkbox" checked={scopes.includes(s.value)} onChange={(e) => setScopes(e.target.checked ? [...scopes, s.value] : scopes.filter((x) => x !== s.value))} /> {s.label}
                </label>
              ))}
            </fieldset>
            <div className="urko-int__actions">
              <button type="submit" className="urko-btn urko-btn--primary" disabled={busy || !name.trim() || !scopes.length}>
                {busy ? "Creating…" : "Create key"}
              </button>
              <span className="urko-muted urko-int__small">Give each system its own key with only the permissions it needs.</span>
            </div>
          </form>
        ) : (
          <p className="urko-muted">Only the store owner can create keys.</p>
        )}
      </section>

      <section className="urko-card urko-int__apicard" aria-labelledby="api-use-h">
        <h2 id="api-use-h" className="urko-h2">
          Using the API
        </h2>
        <p className="urko-int__small">
          Send the key with every request: <code>Authorization: Bearer se_live_…</code> · up to 120 requests a minute per key · answers are JSON.
        </p>
        <div className="urko-int__copy">
          <input type="text" readOnly value={base} onFocus={(e) => e.target.select()} aria-label="API address" />
          <button type="button" className="urko-btn urko-btn--ghost" onClick={() => void navigator.clipboard?.writeText(base).then(() => toast("Copied."))}>
            Copy
          </button>
        </div>
        <ul className="urko-int__endpoints">
          {ENDPOINTS.map(([m, p, d]) => (
            <li key={`${m} ${p}`}>
              <span className={`urko-int__verb urko-int__verb--${m.toLowerCase()}`}>{m}</span> <code>{p}</code> <span className="urko-muted">– {d}</span>
            </li>
          ))}
        </ul>
        <p className="urko-int__small urko-muted">
          Stock changes are written to Stock history as “Store API”. Order status follows the same rules as staff in /cms (re-opening a delivered or cancelled order needs a manager in /cms). To have new orders and status changes pushed to Zapier, Make or n8n, add a webhook in <a href="/cms/collections/webhook-endpoints">Webhooks</a>.
        </p>
      </section>
    </div>
  );
}
