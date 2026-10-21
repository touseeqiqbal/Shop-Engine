"use client";
import { useEffect, useState } from "react";
import { useAdminLocale, useAdminMoney } from "../ui/store-context";
import { addDays, dayIn } from "../../../lib/time";

/** Refused-parcel (RTO) report: where parcels get refused, with which courier, and by whom. */

type Row = { key: string; label: string; delivered: number; refused: number; returned: number; lost: number; rate: number };
type Data = { from: string; to: string; totals: { delivered: number; refused: number; returned: number; lost: number; rate: number }; byCity: Row[]; byZone: Row[]; byCourier: Row[]; byCustomer: Row[] };

const todayIn = (timezone: string) => dayIn(Date.now(), timezone);
const RANGES = [
  { label: "30 days", days: 29 },
  { label: "90 days", days: 89 },
  { label: "1 year", days: 364 },
];

export function RtoReport() {
  const [range, setRange] = useState(89);
  const [tab, setTab] = useState<"byCity" | "byZone" | "byCourier" | "byCustomer">("byCity");
  const [data, setData] = useState<Data | null>(null);
  const [error, setError] = useState("");
  const [attempt, setAttempt] = useState(0); // "Try again" loads the same period once more
  // days in the store's time zone, amounts in its currency
  const money = useAdminMoney();
  const { timezone } = useAdminLocale();
  const today = todayIn(timezone);
  useEffect(() => {
    setData(null);
    setError("");
    fetch(`/cms-api/order-tools/rto?from=${addDays(today, -range)}&to=${today}`, { credentials: "include" })
      .then((r) => (r.ok ? r.json() : Promise.reject(new Error("Could not load the report"))))
      .then(setData)
      .catch((e) => setError((e as Error).message));
  }, [range, today, attempt]);
  // a failed load shows the error instead of skeletons that never finish
  const pending = error ? "–" : "…";

  const rows = data?.[tab] ?? [];
  const tone = (rate: number) => (rate >= 20 ? "r" : rate >= 10 ? "y" : "g");
  return (
    <div className="urko-home">
      <div className="urko-pos__head">
        <div>
          <h1 style={{ margin: 0 }}>Refused parcels (RTO)</h1>
          <p className="urko-tip" style={{ margin: "6px 0 0" }}>
            Orders a customer refused at the door. Mark them “Refused (RTO)” on the order page so they count here and in each customer&apos;s risk score.
          </p>
        </div>
        <div className="urko-seg" role="group" aria-label="Period">
          {RANGES.map((r) => (
            <button key={r.days} type="button" aria-pressed={range === r.days} onClick={() => setRange(r.days)}>
              {r.label}
            </button>
          ))}
        </div>
      </div>
      {error && (
        <p className="urko-tip" role="alert">
          {error}{" "}
          <button type="button" className="urko-btn urko-btn--sm" onClick={() => setAttempt((a) => a + 1)}>
            Try again
          </button>
        </p>
      )}
      <div className="urko-grid urko-grid--stats" style={{ marginBottom: 16 }}>
        <Stat label="Refused" value={data ? String(data.totals.refused) : pending} />
        <Stat label="Delivered" value={data ? String(data.totals.delivered) : pending} />
        <Stat label="Refusal rate" value={data ? `${data.totals.rate}%` : pending} />
        <Stat label="Lost on delivery (est.)" value={data ? money(data.totals.lost) : pending} />
      </div>
      <nav className="urko-tabs" aria-label="Group by">
        {(
          [
            ["byCity", "By city"],
            ["byZone", "By zone"],
            ["byCourier", "By courier"],
            ["byCustomer", "By customer"],
          ] as const
        ).map(([k, l]) => (
          <button key={k} type="button" className={tab === k ? "is-active" : undefined} onClick={() => setTab(k)}>
            {l}
          </button>
        ))}
      </nav>
      <div className="urko-card">
        {!data ? (
          error ? (
            <p className="urko-tip">No figures – the report didn&apos;t load.</p>
          ) : (
            <div className="urko-skeleton" style={{ height: 160 }} />
          )
        ) : rows.length === 0 ? (
          <p className="urko-tip">No refused parcels in this period. 🎉</p>
        ) : (
          <div className="urko-table-wrap">
            <table className="urko-table">
              <thead>
                <tr>
                  <th scope="col">{tab === "byCustomer" ? "Customer" : tab === "byCourier" ? "Courier" : tab === "byZone" ? "Zone" : "City"}</th>
                  <th scope="col" className="n">Refused</th>
                  <th scope="col" className="n">Delivered</th>
                  <th scope="col" className="n">Rate</th>
                  <th scope="col" className="n">Lost (est.)</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((r) => (
                  <tr key={r.key}>
                    <td>
                      {tab === "byCustomer" ? (
                        <a href={`/cms/collections/orders?search=${encodeURIComponent(r.label.split(" · ")[1] ?? "")}`}>{r.label}</a>
                      ) : (
                        r.label
                      )}
                    </td>
                    <td className="n">{r.refused}</td>
                    <td className="n">{r.delivered}</td>
                    <td className="n">
                      <span className={`urko-badge urko-badge--${tone(r.rate)}`}>{r.rate}%</span>
                    </td>
                    <td className="n">{money(r.lost)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
      <p className="urko-tip" style={{ marginTop: 12 }}>
        Too many refusals from one city? Add it under Settings → Fake order protection → “Cities that must pay an advance”. A repeat refuser? Open their order and press “Block this number”.
      </p>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="urko-card">
      <p className="urko-tip" style={{ margin: 0 }}>
        {label}
      </p>
      <p style={{ margin: "4px 0 0", fontSize: 24, fontWeight: 800 }}>{value}</p>
    </div>
  );
}
