"use client";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useFocusTrap } from "@/hooks/use-focus-trap";
import { toast } from "../ui/toast";
import { CATEGORIES, type IntegrationCategory, type IntegrationInfo } from "../../../lib/integrations/catalog-types";
import { StoreApiPanel } from "./StoreApiPanel";

/**
 * /cms/integrations – every integration the store can connect, by kind. Connecting opens a window with the provider's
 * steps and settings; keys are sent once and never shown again (only their last 4 characters).
 */

type Info = IntegrationInfo & { oauthReady?: boolean };
type Conn = {
  provider: string;
  enabled: boolean;
  mode: "live" | "test";
  config: Record<string, string | boolean>;
  secretHints: Record<string, string>;
  status: string;
  lastCheckedAt: string | null;
  lastError: string | null;
  account: string | null;
  webhookUrl: string | null;
  lastSyncAt: string | null;
  lastSync: string | null;
};
type Data = { store: { country: string; currency: string; name: string }; isOwner: boolean; catalog: Info[]; connections: Conn[] };

async function api<T>(path: string, body?: unknown): Promise<T> {
  const r = await fetch(`/cms-api${path}`, body === undefined ? { credentials: "include" } : { method: "POST", credentials: "include", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
  const j = (await r.json().catch(() => ({}))) as T & { error?: string };
  if (!r.ok) throw new Error(j.error || "Something went wrong");
  return j;
}

const OAUTH_ERRORS: Record<string, string> = {
  expired: "The sign-in took too long – please connect again.",
  signin: "Sign in to /cms first, then connect again.",
  store: "You switched store meanwhile – connect again from this store.",
  denied: "The connection wasn’t allowed at the provider.",
  failed: "The provider didn’t finish the connection – please try again.",
  unknown: "That integration isn’t available.",
};

function statusOf(c: Conn | undefined) {
  if (!c) return null;
  if (!c.enabled) return { label: "Off", tone: "n" };
  if (c.status === "error") return { label: "Needs attention", tone: "r" };
  return { label: c.mode === "test" ? "Connected · test mode" : "Connected", tone: c.mode === "test" ? "y" : "g" };
}

export function IntegrationsScreen() {
  const [data, setData] = useState<Data | null>(null);
  const [tab, setTab] = useState<IntegrationCategory | "all" | "connected" | "api">("all");
  const [q, setQ] = useState("");
  const [open, setOpen] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      setData(await api<Data>("/integration-tools"));
    } catch (e) {
      toast((e as Error).message, "error");
    }
  }, []);

  useEffect(() => {
    void load();
    // back from a provider's sign-in page
    const p = new URLSearchParams(window.location.search);
    if (p.get("connected")) toast("Connected.");
    else if (p.get("error")) toast(OAUTH_ERRORS[p.get("error") ?? ""] ?? "Couldn’t connect.", "error");
    if (p.get("connected") || p.get("error")) window.history.replaceState(null, "", "/cms/integrations");
  }, [load]);

  const conns = useMemo(() => new Map((data?.connections ?? []).map((c) => [c.provider, c])), [data]);
  const visible = useMemo(() => {
    if (!data) return [];
    const words = q.trim().toLowerCase().split(/\s+/).filter(Boolean);
    return data.catalog.filter(
      (i) =>
        (!i.countries || i.countries.includes(data.store.country) || conns.has(i.id)) &&
        (tab === "all" || (tab === "connected" ? conns.has(i.id) : i.category === tab)) &&
        words.every((w) => `${i.name} ${i.summary} ${i.category}`.toLowerCase().includes(w)),
    );
  }, [data, tab, q, conns]);

  if (!data) return <div className="urko-home" style={{ maxWidth: 1100 }}>Loading…</div>;
  const current = open ? data.catalog.find((i) => i.id === open) ?? null : null;
  const groups = tab === "all" ? CATEGORIES.filter((c) => visible.some((i) => i.category === c.id)) : [];

  return (
    <div className="urko-home urko-int" style={{ maxWidth: 1100 }}>
      <div className="urko-int__head">
        <div>
          <h1 className="urko-h1">Integrations</h1>
          <p className="urko-tip">Connect {data.store.name || "your store"} to the services you already use – with your own accounts, so your money, parcels and messages stay yours.</p>
        </div>
        <input className="urko-int__search" type="search" value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search integrations" aria-label="Search integrations" />
      </div>

      <div className="urko-tabs" role="tablist" aria-label="Kinds of integration">
        {[{ id: "all", label: "All" }, { id: "connected", label: `Connected (${data.connections.length})` }, ...CATEGORIES.map((c) => ({ id: c.id, label: c.label })), { id: "api", label: "Store API" }].map((t) => (
          <button key={t.id} type="button" role="tab" aria-selected={tab === t.id} className={tab === t.id ? "is-active" : ""} onClick={() => setTab(t.id as typeof tab)}>
            {t.label}
          </button>
        ))}
      </div>

      {tab === "api" ? (
        <StoreApiPanel />
      ) : visible.length === 0 ? (
        <p className="urko-muted">{tab === "connected" ? "Nothing connected yet." : "No integrations match."}</p>
      ) : tab === "all" ? (
        groups.map((g) => (
          <section key={g.id} className="urko-int__group" aria-labelledby={`int-${g.id}`}>
            <h2 id={`int-${g.id}`} className="urko-h2">
              {g.label}
            </h2>
            <p className="urko-muted urko-int__groupnote">{g.description}</p>
            <Cards items={visible.filter((i) => i.category === g.id)} conns={conns} onOpen={setOpen} />
          </section>
        ))
      ) : (
        <>
          {tab !== "connected" && <p className="urko-muted urko-int__groupnote">{CATEGORIES.find((c) => c.id === tab)?.description}</p>}
          <Cards items={visible} conns={conns} onOpen={setOpen} />
        </>
      )}

      {current && <Connect info={current} conn={conns.get(current.id)} isOwner={data.isOwner} onClose={() => setOpen(null)} onChanged={load} />}
    </div>
  );
}

function Initial({ info }: { info: Info }) {
  return (
    <span className="urko-int__logo" style={{ background: info.color ?? "#5b48f6" }} aria-hidden="true">
      {info.name.replace(/[^A-Za-z0-9]/g, "").slice(0, 2)}
    </span>
  );
}

function Cards({ items, conns, onOpen }: { items: Info[]; conns: Map<string, Conn>; onOpen: (id: string) => void }) {
  return (
    <div className="urko-int__grid">
      {items.map((i) => {
        const c = conns.get(i.id);
        const st = statusOf(c);
        return (
          <button key={i.id} type="button" className="urko-card urko-int__card" onClick={() => onOpen(i.id)}>
            <span className="urko-int__cardhead">
              <Initial info={i} />
              <span className="urko-int__name">{i.name}</span>
            </span>
            <span className="urko-int__summary">{i.summary}</span>
            <span className="urko-int__badges">
              {st ? (
                <span className={`urko-badge urko-badge--${st.tone}`}>
                  <span className="urko-badge__dot" />
                  {st.label}
                </span>
              ) : (
                <span className="urko-int__connect">Connect →</span>
              )}
              {!i.verified && <span className="urko-badge urko-badge--b" title="Built from the provider’s documentation – check with a test order first">New</span>}
            </span>
          </button>
        );
      })}
    </div>
  );
}

function Connect({ info, conn, isOwner, onClose, onChanged }: { info: Info; conn?: Conn; isOwner: boolean; onClose: () => void; onChanged: () => Promise<void> }) {
  const [config, setConfig] = useState<Record<string, string | boolean>>(() => Object.fromEntries(info.fields.filter((f) => f.type !== "secret").map((f) => [f.key, conn?.config[f.key] ?? (f.type === "checkbox" ? f.default === "true" : (f.default ?? ""))])));
  const [secrets, setSecrets] = useState<Record<string, string>>({});
  const [mode, setMode] = useState<"live" | "test">(conn?.mode ?? "live");
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<{ ok: boolean; message: string } | null>(conn?.status === "error" && conn.lastError ? { ok: false, message: conn.lastError } : null);
  const allowed = info.minRole !== "store_owner" || isOwner;

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [onClose]);
  // focus moves into the dialog, Tab stays inside, and goes back to the card's button on close
  const box = useRef<HTMLDivElement>(null);
  useFocusTrap(box, true);

  async function run(fn: () => Promise<{ ok?: boolean; message?: string; switchedOff?: string[] }>, done?: string) {
    setBusy(true);
    try {
      const r = await fn();
      if (r.message) setResult({ ok: r.ok !== false, message: r.message });
      if (r.switchedOff?.length) toast(`Switched off: ${r.switchedOff.join(", ")} (only one can be on).`);
      if (done) toast(done);
      setSecrets({});
      await onChanged();
    } catch (e) {
      setResult({ ok: false, message: (e as Error).message });
    } finally {
      setBusy(false);
    }
  }

  const save = () => run(() => api("/integration-tools/save", { provider: info.id, enabled: conn ? conn.enabled : true, mode, config, secrets }));

  return (
    <div className="urko-dialog__backdrop" role="dialog" aria-modal="true" aria-labelledby="int-dialog-title" onClick={onClose}>
      <div ref={box} className="urko-dialog urko-int__dialog" onClick={(e) => e.stopPropagation()}>
        <div className="urko-int__dhead">
          <Initial info={info} />
          <div style={{ flex: 1, minWidth: 0 }}>
            <h2 id="int-dialog-title" className="urko-h2" style={{ margin: 0 }}>
              {info.name}
            </h2>
            <p className="urko-muted" style={{ margin: "2px 0 0" }}>
              {info.summary}
            </p>
          </div>
          <button type="button" className="urko-icon-btn" aria-label="Close" onClick={onClose}>
            ✕
          </button>
        </div>

        <div className="urko-int__dbody">
          {!info.verified && (
            <p className="urko-int__note">
              New integration, built from {info.name}’s documentation. Connect in test mode (if {info.name} has one) and try a test order before using it with customers.
            </p>
          )}
          {!allowed && <p className="urko-int__note urko-int__note--warn">Only the store owner can connect {info.name}.</p>}
          {info.steps && (
            <ol className="urko-int__steps">
              {info.steps.map((s) => (
                <li key={s}>{s}</li>
              ))}
            </ol>
          )}

          {info.oauth ? (
            <div className="urko-int__oauth">
              {conn ? (
                <p>
                  Connected{conn.account ? ` to ${conn.account}` : ""}.
                </p>
              ) : info.oauthReady === false ? (
                <p className="urko-int__note urko-int__note--warn">ShopEngine hasn’t switched on {info.name} yet. Ask ShopEngine support to enable it.</p>
              ) : null}
              {allowed &&
                info.oauthReady !== false &&
                info.fields
                  .filter((f) => f.beforeConnect && f.type === "select")
                  .map((f) => (
                    <div key={f.key} className="urko-int__field">
                      <label htmlFor={`int-${info.id}-${f.key}-pre`}>{f.label}</label>
                      <select id={`int-${info.id}-${f.key}-pre`} value={String(config[f.key] ?? "")} onChange={(e) => setConfig({ ...config, [f.key]: e.target.value })}>
                        {f.options?.map((o) => (
                          <option key={o.value} value={o.value}>
                            {o.label}
                          </option>
                        ))}
                      </select>
                    </div>
                  ))}
              {allowed && info.oauthReady !== false && (
                <a
                  className="urko-btn urko-btn--primary"
                  href={`/cms-api/integration-tools/oauth/start?${new URLSearchParams({ provider: info.id, ...Object.fromEntries(info.fields.filter((f) => f.beforeConnect).map((f) => [`opt_${f.key}`, String(config[f.key] ?? "")])) })}`}
                >
                  {conn ? `Reconnect ${info.name}` : `Connect with ${info.name}`}
                </a>
              )}
            </div>
          ) : null}

          {/* signed in with the provider's page: its settings only once connected */}
          {info.fields.length > 0 && (!info.oauth || conn) && (
            <form
              className="urko-int__form"
              onSubmit={(e) => {
                e.preventDefault();
                void save();
              }}
            >
              {info.modes && (
                <fieldset className="urko-int__mode">
                  <legend>Mode</legend>
                  {(["test", "live"] as const).map((m) => (
                    <label key={m}>
                      <input type="radio" name="mode" checked={mode === m} onChange={() => setMode(m)} disabled={!allowed} /> {m === "test" ? "Test (sandbox)" : "Live"}
                    </label>
                  ))}
                </fieldset>
              )}
              {info.fields.map((f) => {
                const id = `int-${info.id}-${f.key}`;
                if (f.type === "checkbox")
                  return (
                    <label key={f.key} className="urko-int__check">
                      <input type="checkbox" checked={config[f.key] === true} onChange={(e) => setConfig({ ...config, [f.key]: e.target.checked })} disabled={!allowed} /> {f.label}
                    </label>
                  );
                return (
                  <div key={f.key} className="urko-int__field">
                    <label htmlFor={id}>
                      {f.label}
                      {f.required ? " *" : ""}
                    </label>
                    {f.type === "select" ? (
                      <select id={id} value={String(config[f.key] ?? "")} onChange={(e) => setConfig({ ...config, [f.key]: e.target.value })} disabled={!allowed}>
                        {!f.required && <option value="">—</option>}
                        {f.options?.map((o) => (
                          <option key={o.value} value={o.value}>
                            {o.label}
                          </option>
                        ))}
                      </select>
                    ) : f.type === "textarea" ? (
                      <textarea id={id} rows={3} value={String(config[f.key] ?? "")} onChange={(e) => setConfig({ ...config, [f.key]: e.target.value })} placeholder={f.placeholder} disabled={!allowed} />
                    ) : f.type === "secret" ? (
                      <input
                        id={id}
                        type="password"
                        autoComplete="new-password"
                        value={secrets[f.key] ?? ""}
                        onChange={(e) => setSecrets({ ...secrets, [f.key]: e.target.value })}
                        placeholder={conn?.secretHints[f.key] ? `Saved ${conn.secretHints[f.key]} – leave empty to keep` : f.placeholder}
                        disabled={!allowed}
                      />
                    ) : (
                      <input id={id} type="text" value={String(config[f.key] ?? "")} onChange={(e) => setConfig({ ...config, [f.key]: e.target.value })} placeholder={f.placeholder} disabled={!allowed} />
                    )}
                    {f.help && <small className="urko-muted">{f.help}</small>}
                  </div>
                );
              })}
              {conn?.webhookUrl && (
                <div className="urko-int__field">
                  <label htmlFor={`int-${info.id}-hook`}>{info.webhook ?? "Your address for updates"}</label>
                  <div className="urko-int__copy">
                    <input id={`int-${info.id}-hook`} type="text" readOnly value={conn.webhookUrl} onFocus={(e) => e.target.select()} />
                    <button type="button" className="urko-btn urko-btn--ghost" onClick={() => void navigator.clipboard?.writeText(conn.webhookUrl ?? "").then(() => toast("Copied."))}>
                      Copy
                    </button>
                  </div>
                </div>
              )}
              {!conn && info.webhook && <p className="urko-muted">After saving, you’ll get the address to paste into {info.name}: {info.webhook.toLowerCase()}.</p>}
              {allowed && (
                <div className="urko-int__actions">
                  <button type="submit" className="urko-btn urko-btn--primary" disabled={busy}>
                    {busy ? "Checking…" : conn ? "Save & check" : "Connect"}
                  </button>
                  {conn && (
                    <button type="button" className="urko-btn urko-btn--ghost" disabled={busy} onClick={() => void run(() => api("/integration-tools/test", { provider: info.id }))}>
                      Check again
                    </button>
                  )}
                </div>
              )}
            </form>
          )}

          {conn && info.category === "marketplaces" && (
            <div className="urko-int__sync">
              <p className="urko-muted">
                {conn.lastSyncAt ? `Last sync ${new Date(conn.lastSyncAt).toLocaleString()}: ${conn.lastSync ?? ""}` : "Not synced yet – it runs about every 30 minutes."}
              </p>
              {allowed && conn.enabled && (
                <button type="button" className="urko-btn urko-btn--ghost" disabled={busy} onClick={() => void run(() => api("/integration-tools/sync", { provider: info.id }))}>
                  {busy ? "Syncing…" : "Sync now"}
                </button>
              )}
            </div>
          )}

          {result && (
            <p className={`urko-int__result ${result.ok ? "is-ok" : "is-error"}`} role="status">
              {result.message}
            </p>
          )}

          {conn && allowed && (
            <div className="urko-int__footer">
              <button type="button" className="urko-btn urko-btn--ghost" disabled={busy} onClick={() => void run(() => api("/integration-tools/toggle", { provider: info.id, enabled: !conn.enabled }), conn.enabled ? "Switched off." : "Switched on.")}>
                {conn.enabled ? "Switch off" : "Switch on"}
              </button>
              <button
                type="button"
                className="urko-btn urko-btn--danger"
                disabled={busy}
                onClick={() => window.confirm(`Remove ${info.name}? Its saved keys are deleted.`) && void run(() => api("/integration-tools/remove", { provider: info.id }), "Removed.").then(onClose)}
              >
                Remove
              </button>
              {conn.lastCheckedAt && <span className="urko-muted urko-int__checked">Last checked {new Date(conn.lastCheckedAt).toLocaleString()}</span>}
            </div>
          )}
          {info.docsUrl && (
            <p className="urko-int__docs">
              <a href={info.docsUrl} target="_blank" rel="noreferrer">
                {info.name} documentation ↗
              </a>
            </p>
          )}
        </div>
      </div>
    </div>
  );
}
