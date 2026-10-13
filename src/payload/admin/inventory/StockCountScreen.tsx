"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import { useAuth } from "@payloadcms/ui";
import { toast } from "../ui/toast";

/** /cms/stock-count – walk the shelves with a barcode scanner (or type), then see what's over / short. */

type Line = { productId: number; title: string; sku: string; tracked: boolean; expected: number; counted: number; unitCost: number; expectedSerials: string[]; scannedSerials: string[]; touched?: boolean };
type Count = { id: number; name: string; status: string; lines: Line[]; itemsCounted: number; variance: number; updatedAt: string };

async function post<T>(path: string, body: unknown): Promise<T> {
  const r = await fetch(`/cms-api/stock-count/${path}`, { method: "POST", credentials: "include", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
  const j = (await r.json().catch(() => ({}))) as T & { error?: string };
  if (!r.ok) throw new Error(j.error || "Something went wrong");
  return j;
}

export function StockCountScreen() {
  const { user } = useAuth();
  const isManager = ["owner", "manager"].includes(String((user as { role?: string } | null)?.role));
  const [open, setOpen] = useState<Count[] | null>(null);
  const [current, setCurrent] = useState<Count | null>(null);
  const [name, setName] = useState("");
  const [code, setCode] = useState("");
  const [last, setLast] = useState("");
  const [onlyDiff, setOnlyDiff] = useState(false);
  const [zeroUncounted, setZeroUncounted] = useState(false);
  const [busy, setBusy] = useState(false);
  const scanRef = useRef<HTMLInputElement>(null);

  const loadOpen = useCallback(async () => {
    const r = await fetch("/cms-api/stock-counts?where[status][equals]=open&sort=-updatedAt&limit=10&depth=0", { credentials: "include" });
    setOpen(r.ok ? ((await r.json()) as { docs: Count[] }).docs : []);
  }, []);
  const load = useCallback(async (id: number) => {
    const r = await fetch(`/cms-api/stock-counts/${id}?depth=0`, { credentials: "include" });
    if (r.ok) setCurrent((await r.json()) as Count);
  }, []);
  useEffect(() => {
    void loadOpen();
  }, [loadOpen]);
  useEffect(() => {
    if (current) scanRef.current?.focus();
  }, [current?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  async function start() {
    setBusy(true);
    try {
      const r = await post<{ id: number }>("start", { name });
      await load(r.id);
    } catch (e) {
      toast((e as Error).message, "error");
    } finally {
      setBusy(false);
    }
  }
  async function scan() {
    if (!current || !code.trim()) return;
    const c = code.trim();
    setCode("");
    try {
      const r = await post<{ message: string }>("scan", { id: current.id, code: c });
      setLast(r.message);
      await load(current.id);
    } catch (e) {
      setLast((e as Error).message);
      toast((e as Error).message, "error");
    }
    scanRef.current?.focus();
  }
  async function setCounted(l: Line, v: string) {
    if (!current) return;
    try {
      await post("set", { id: current.id, productId: l.productId, counted: Number(v) || 0 });
      await load(current.id);
    } catch (e) {
      toast((e as Error).message, "error");
    }
  }
  async function finish(apply: boolean) {
    if (!current) return;
    const counted = current.lines.filter((l) => l.touched).length;
    if (
      !window.confirm(
        apply
          ? zeroUncounted
            ? `Finish and correct stock? Products you didn't count (${current.lines.length - counted}) will be set to 0. Laptops tracked by serial are only reported.`
            : `Finish and correct the stock of the ${counted} product(s) you counted? Products you didn't count stay as they are.`
          : "Finish this count and keep it as a report only?"
      )
    )
      return;
    setBusy(true);
    try {
      const r = await post<{ corrected: number }>("finish", { id: current.id, apply, zeroUncounted: apply && zeroUncounted });
      toast(apply ? `Count finished – ${r.corrected} product(s) corrected` : "Count finished");
      window.location.href = `/cms/collections/stock-counts/${current.id}`;
    } catch (e) {
      toast((e as Error).message, "error");
      setBusy(false);
    }
  }

  if (!current)
    return (
      <div className="urko-home" style={{ maxWidth: 760 }}>
        <h1 style={{ margin: "0 0 4px" }}>Stock count</h1>
        <p className="urko-tip">Scan every item on the shelves (or type the SKU / serial). At the end you see what&apos;s over or short and can correct the stock in one go.</p>
        <div className="urko-card" style={{ marginTop: 16 }}>
          <label className="urko-pos__amount">
            Name this count
            <input value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Month-end count – shop" />
          </label>
          <button type="button" className="urko-btn urko-btn--primary urko-pos__complete" disabled={busy} onClick={start}>
            Start a new count
          </button>
        </div>
        {open && open.length > 0 && (
          <div className="urko-card" style={{ marginTop: 16 }}>
            <h2 className="urko-pos__h" style={{ marginTop: 0 }}>
              Continue a count
            </h2>
            <ul className="urko-list">
              {open.map((c) => (
                <li key={c.id}>
                  <span style={{ flex: 1 }}>
                    <strong>{c.name}</strong> · {c.itemsCounted} counted
                  </span>
                  <button type="button" className="urko-btn urko-btn--sm" onClick={() => load(c.id)}>
                    Continue
                  </button>
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>
    );

  const matters = (l: Line) => l.touched || zeroUncounted;
  const lines = current.lines.filter((l) => !onlyDiff || (matters(l) && l.counted !== l.expected));
  const short = current.lines.filter((l) => matters(l) && l.counted < l.expected).length;
  const over = current.lines.filter((l) => matters(l) && l.counted > l.expected).length;
  return (
    <div className="urko-home">
      <div className="urko-pos__head">
        <div>
          <h1 style={{ margin: 0 }}>{current.name}</h1>
          <p className="urko-tip" style={{ margin: "4px 0 0" }}>
            {current.itemsCounted} counted · {short} short · {over} over
          </p>
        </div>
        <div className="urko-opanel__contact">
          <button type="button" className="urko-btn" disabled={busy} onClick={() => finish(false)}>
            Finish (report only)
          </button>
          {isManager && (
            <button type="button" className="urko-btn urko-btn--primary" disabled={busy} onClick={() => finish(true)}>
              Finish & correct stock
            </button>
          )}
        </div>
      </div>
      <div className="urko-card" style={{ marginBottom: 16 }}>
        <label className="urko-pos__search">
          <span className="urko-sr">Scan</span>
          <input
            ref={scanRef}
            value={code}
            onChange={(e) => setCode(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                void scan();
              }
            }}
            placeholder="Scan a barcode (SKU or serial) and press Enter"
            autoComplete="off"
          />
        </label>
        {last && <p className="urko-pos__msg">{last}</p>}
      </div>
      <div style={{ display: "flex", gap: 20, flexWrap: "wrap", marginBottom: 8 }}>
        <label className="urko-opanel__check" style={{ display: "flex" }}>
          <input type="checkbox" checked={onlyDiff} onChange={(e) => setOnlyDiff(e.target.checked)} /> Only show differences
        </label>
        {isManager && (
          <label className="urko-opanel__check" style={{ display: "flex" }}>
            <input type="checkbox" checked={zeroUncounted} onChange={(e) => setZeroUncounted(e.target.checked)} /> Full count: products I don&apos;t count are really gone (set to 0)
          </label>
        )}
      </div>
      <div className="urko-card">
        <table className="urko-table">
          <thead>
            <tr>
              <th scope="col">Product</th>
              <th scope="col" className="n">
                System
              </th>
              <th scope="col" className="n">
                Counted
              </th>
              <th scope="col" className="n">
                Difference
              </th>
            </tr>
          </thead>
          <tbody>
            {lines.map((l) => {
              const d = l.counted - l.expected;
              return (
                <tr key={l.productId}>
                  <td>
                    {l.title}
                    <br />
                    <small className="urko-tip">
                      {l.sku}
                      {l.tracked ? " · by serial" : ""}
                    </small>
                  </td>
                  <td className="n">{l.expected}</td>
                  <td className="n">
                    {l.tracked ? (
                      l.counted
                    ) : (
                      <input className="urko-quick__input" style={{ width: 70, textAlign: "right" }} inputMode="numeric" defaultValue={l.counted} key={`${l.productId}-${l.counted}`} onBlur={(e) => e.target.value !== String(l.counted) && setCounted(l, e.target.value)} aria-label={`Counted ${l.title}`} />
                    )}
                  </td>
                  <td className="n">
                    <span className={`urko-badge urko-badge--${d === 0 ? "g" : d < 0 ? "r" : "b"}`}>{d > 0 ? `+${d}` : d}</span>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
