"use client";
import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { useAuth } from "@payloadcms/ui";
import { ConfigBackup } from "./ConfigBackup";
import { Icon } from "./ui/icons";
import { ORDER_STATUS } from "./orders/status";

/**
 * Home (replaces Payload's default dashboard): greeting, To do, Today vs yesterday, simple charts,
 * setup checklist, recent orders. Data: GET /cms-api/reports (staff only).
 */

type Kpi = { orders: number; paidOrders: number; revenue: number; aov: number };
type Report = {
  range: { from: string; to: string };
  kpis: { today: Kpi; yesterday: Kpi; last7: Kpi; last30: Kpi; range: Kpi };
  todo: {
    pendingOrders: number;
    paymentsToVerify: number;
    toShip: number;
    newWholesale: number;
    openMessages: number;
    missingInfo: number;
    lowStock: { id: number; title: string; stock: number }[];
    lowStockTotal: number;
    outOfStock: { id: number; title: string }[];
    outOfStockTotal: number;
  };
  series: { day: string; revenue: number; orders: number }[];
  topProducts: { key: string; title: string; qty: number; revenue: number }[];
  cities: { key: string; orders: number; revenue: number }[];
  customers?: { total: number; new: number; returning: number; returningRate: number };
  checkout?: { started: number; completed: number; abandoned: number; recoveredByReminder: number; completionRate: number };
  recent: { id: number; orderNumber: string; status: string; total: number; placedAt: string; customer: string; city: string }[];
  setup: { key: string; label: string; done: boolean; href: string }[];
  warnings?: string[];
  greetingName: string;
};

const rs = (n: number) => `Rs ${Math.round(n).toLocaleString("en-PK")}`;
const shortDay = (d: string) => new Date(`${d}T00:00:00Z`).toLocaleDateString("en-GB", { weekday: "short", timeZone: "UTC" });
const pkt = () => new Date(Date.now() + 5 * 3600e3);
const ORDERS = "/cms/collections/orders";
const where = (field: string, op: string, value: string) => `?where%5B${field}%5D%5B${op}%5D=${encodeURIComponent(value)}`;

function Change({ now, before, money }: { now: number; before: number; money?: boolean }) {
  if (!before && !now) return <span className="urko-muted urko-small">Same as yesterday</span>;
  if (!before) return <span className="urko-up urko-small">↑ new today</span>;
  const diff = now - before;
  const text = money ? `${Math.round(Math.abs(diff / before) * 100)}%` : String(Math.abs(diff));
  if (diff === 0) return <span className="urko-muted urko-small">Same as yesterday</span>;
  return diff > 0 ? <span className="urko-up urko-small">↑ {text} vs yesterday</span> : <span className="urko-down urko-small">↓ {text} vs yesterday</span>;
}

export function Dashboard() {
  const { user } = useAuth<{ name?: string }>();
  const [days, setDays] = useState<7 | 30>(7);
  const [data, setData] = useState<Report | null>(null);
  const [error, setError] = useState("");

  useEffect(() => {
    let alive = true;
    const to = pkt().toISOString().slice(0, 10);
    const from = new Date(Date.parse(`${to}T00:00:00Z`) - (days - 1) * 864e5).toISOString().slice(0, 10);
    fetch(`/cms-api/reports?from=${from}&to=${to}`, { credentials: "include" })
      .then((r) => (r.ok ? r.json() : Promise.reject(new Error(`HTTP ${r.status}`))))
      .then((d: Report) => alive && setData(d))
      .catch((e: Error) => alive && setError(e.message));
    return () => {
      alive = false;
    };
  }, [days]);

  const hour = pkt().getUTCHours();
  const greeting = hour < 12 ? "Good morning" : hour < 17 ? "Good afternoon" : "Good evening";
  const name = data?.greetingName || user?.name?.split(" ")[0] || "";
  const dateLabel = pkt().toLocaleDateString("en-GB", { weekday: "long", day: "numeric", month: "long", year: "numeric", timeZone: "UTC" });
  const max = useMemo(() => Math.max(1, ...(data?.series.map((s) => s.revenue) ?? [1])), [data]);
  const setupLeft = data?.setup.filter((s) => !s.done) ?? [];

  const todo = data
    ? [
        { n: data.todo.pendingOrders, text: "orders waiting for confirmation", tone: "y", tag: "Needs action", href: `${ORDERS}${where("status", "equals", "pending")}` },
        { n: data.todo.paymentsToVerify, text: "payments to verify", tone: "y", tag: "Needs action", href: `${ORDERS}${where("paymentStatus", "equals", "awaiting-verification")}` },
        { n: data.todo.toShip, text: "orders ready to book with courier", tone: "b", tag: "Ready", href: `${ORDERS}${where("status", "equals", "confirmed")}` },
        { n: data.todo.lowStockTotal + data.todo.outOfStockTotal, text: "products low or out of stock", tone: "r", tag: "Stock", href: "/cms/collections/products?where%5BstockStatus%5D%5Bin%5D%5B0%5D=low&where%5BstockStatus%5D%5Bin%5D%5B1%5D=out" },
        { n: data.todo.newWholesale, text: "new wholesale enquiries", tone: "y", tag: "New", href: `/cms/collections/wholesale-inquiries${where("status", "equals", "new")}` },
        { n: data.todo.missingInfo, text: "products missing photos or details", tone: "y", tag: "Fix", href: "/cms/collections/products" },
        { n: data.todo.openMessages, text: "unread messages", tone: "y", tag: "New", href: "/cms/collections/contact-messages" },
      ]
    : [];
  const open = todo.filter((t) => t.n > 0);

  return (
    <div className="urko-home">
      {data?.warnings?.length ? (
        <section className="urko-card" role="alert" style={{ borderColor: "var(--theme-error-500, #dc2626)" }}>
          <h2 className="urko-h3">Fix these settings in Railway</h2>
          <ul style={{ margin: "8px 0 0", paddingLeft: 18 }}>
            {data.warnings.map((w) => (
              <li key={w}>{w}</li>
            ))}
          </ul>
        </section>
      ) : null}
      <header className="urko-home__head">
        <div>
          <h1 className="urko-h1">
            {greeting}
            {name ? `, ${name}` : ""}
          </h1>
          <p className="urko-muted">{dateLabel}</p>
        </div>
        <a className="btn btn--style-secondary btn--size-medium urko-btn-inline" href="/" target="_blank" rel="noopener noreferrer">
          View store <Icon name="external" size={16} />
        </a>
      </header>

      {error && <div className="urko-card">Couldn’t load your figures ({error}). Refresh the page to try again.</div>}

      <section aria-labelledby="todo-h">
        <h2 id="todo-h" className="urko-h2">
          To do
        </h2>
        {!data ? (
          <div className="urko-grid urko-grid--todo">
            {[0, 1, 2, 3].map((i) => (
              <div key={i} className="urko-skeleton" style={{ height: 112 }} />
            ))}
          </div>
        ) : open.length ? (
          <div className="urko-grid urko-grid--todo">
            {open.map((t) => (
              <Link key={t.text} href={t.href} className="urko-todo">
                <span className={`urko-badge urko-badge--${t.tone}`}>
                  <span className="urko-badge__dot" />
                  {t.tag}
                </span>
                <span className="urko-todo__n">{t.n}</span>
                <span>{t.text}</span>
              </Link>
            ))}
          </div>
        ) : (
          <div className="urko-card urko-allclear">
            <span className="urko-badge urko-badge--g">
              <span className="urko-badge__dot" />
              All done
            </span>
            Nothing needs your attention right now.
          </div>
        )}
      </section>

      <section aria-labelledby="today-h">
        <h2 id="today-h" className="urko-h2">
          Today at a glance
        </h2>
        <div className="urko-grid urko-grid--stats">
          <div className="urko-card">
            <div className="urko-muted" title="Confirmed, shipped and delivered orders plus shop-counter sales. New orders count once you confirm them.">
              Sales <span className="urko-small">(confirmed)</span>
            </div>
            <div className="urko-big">{data ? rs(data.kpis.today.revenue) : "…"}</div>
            {data && <Change now={data.kpis.today.revenue} before={data.kpis.yesterday.revenue} money />}
          </div>
          <div className="urko-card">
            <div className="urko-muted">Orders</div>
            <div className="urko-big">{data ? data.kpis.today.orders : "…"}</div>
            {data && <Change now={data.kpis.today.orders} before={data.kpis.yesterday.orders} />}
          </div>
          <div className="urko-card">
            <div className="urko-muted">Average order</div>
            <div className="urko-big">{data ? rs(data.kpis.today.aov) : "…"}</div>
            {data && <Change now={data.kpis.today.aov} before={data.kpis.yesterday.aov} money />}
          </div>
          <div className="urko-card">
            <div className="urko-muted">Visitors</div>
            <div className="urko-big urko-big--muted">—</div>
            <Link className="urko-small" href="/cms/globals/seo-settings">
              Connect Google Analytics to see visitors
            </Link>
          </div>
        </div>
      </section>

      <div className="urko-grid urko-grid--panels">
        <section className="urko-card" aria-labelledby="sales-h">
          <div className="urko-card__head">
            <h2 id="sales-h" className="urko-h3">
              Sales – last {days} days
            </h2>
            <div className="urko-seg" role="group" aria-label="Period">
              <button type="button" aria-pressed={days === 7} onClick={() => setDays(7)}>
                7 days
              </button>
              <button type="button" aria-pressed={days === 30} onClick={() => setDays(30)}>
                30 days
              </button>
            </div>
          </div>
          {data ? (
            <>
              <div className="urko-bars" role="img" aria-label={`Sales per day for the last ${days} days. Total ${rs(data.kpis.range.revenue)}.`}>
                {data.series.map((s) => (
                  <span key={s.day} title={`${s.day}: ${rs(s.revenue)} · ${s.orders} orders`} style={{ height: `${Math.max(s.revenue ? 3 : 1, (s.revenue / max) * 100)}%` }} />
                ))}
              </div>
              <div className="urko-bars__legend urko-muted urko-small">
                <span>{days === 7 ? shortDay(data.series[0]?.day ?? "") : data.range.from.slice(5)}</span>
                <span>
                  Total <strong className="urko-text">{rs(data.kpis.range.revenue)}</strong> · {data.kpis.range.orders} order{data.kpis.range.orders === 1 ? "" : "s"}
                </span>
                <span>Today</span>
              </div>
            </>
          ) : (
            <div className="urko-skeleton" style={{ height: 160 }} />
          )}
        </section>

        <section className="urko-card" aria-labelledby="top-h">
          <h2 id="top-h" className="urko-h3">
            Top 5 products
          </h2>
          {data?.topProducts.length ? (
            <ol className="urko-list">
              {data.topProducts.slice(0, 5).map((p) => (
                <li key={p.key}>
                  <span className="urko-list__main">{p.title}</span>
                  <span className="urko-muted urko-small">{p.qty} sold</span>
                  <strong>{rs(p.revenue)}</strong>
                </li>
              ))}
            </ol>
          ) : (
            <p className="urko-muted">{data ? "No sales in this period yet." : "Loading…"}</p>
          )}
        </section>

        <section className="urko-card" aria-labelledby="city-h">
          <h2 id="city-h" className="urko-h3">
            Where sales come from
          </h2>
          {data?.cities.length ? (
            <ul className="urko-meters">
              {data.cities.slice(0, 5).map((c) => {
                const pct = data.kpis.range.revenue ? Math.round((c.revenue / data.kpis.range.revenue) * 100) : 0;
                return (
                  <li key={c.key}>
                    <div>
                      <span>{c.key}</span>
                      <strong>{pct}%</strong>
                    </div>
                    <span className="urko-meter">
                      <span style={{ width: `${pct}%` }} />
                    </span>
                  </li>
                );
              })}
            </ul>
          ) : (
            <p className="urko-muted">{data ? "No sales in this period yet." : "Loading…"}</p>
          )}
        </section>

        {data?.customers && data.checkout && (
          <section className="urko-card" aria-labelledby="cust-h">
            <h2 id="cust-h" className="urko-h3">
              Customers & checkout
            </h2>
            <ul className="urko-meters">
              <li>
                <div>
                  <span>
                    Customers who ordered ({data.customers.new} new, {data.customers.returning} returning)
                  </span>
                  <strong>{data.customers.total}</strong>
                </div>
              </li>
              <li>
                <div>
                  <span>Returning customers</span>
                  <strong>{data.customers.returningRate}%</strong>
                </div>
                <span className="urko-meter">
                  <span style={{ width: `${Math.min(100, data.customers.returningRate)}%` }} />
                </span>
              </li>
              <li>
                <div>
                  <span>
                    Checkouts completed ({data.checkout.completed} of {data.checkout.started})
                  </span>
                  <strong>{data.checkout.completionRate}%</strong>
                </div>
                <span className="urko-meter">
                  <span style={{ width: `${Math.min(100, data.checkout.completionRate)}%` }} />
                </span>
              </li>
              {data.checkout.recoveredByReminder > 0 && (
                <li>
                  <div>
                    <span>Orders won back by cart reminders</span>
                    <strong>{data.checkout.recoveredByReminder}</strong>
                  </div>
                </li>
              )}
            </ul>
          </section>
        )}
      </div>

      {data && setupLeft.length > 0 && (
        <section className="urko-card" aria-labelledby="setup-h">
          <div className="urko-card__head">
            <h2 id="setup-h" className="urko-h3">
              Finish setting up your store
            </h2>
            <span className="urko-muted">
              {data.setup.length - setupLeft.length} of {data.setup.length} done
            </span>
          </div>
          <span className="urko-meter urko-meter--brand">
            <span style={{ width: `${((data.setup.length - setupLeft.length) / data.setup.length) * 100}%` }} />
          </span>
          <ul className="urko-checklist">
            {data.setup.map((s) => (
              <li key={s.key}>
                <Link href={s.href} className={s.done ? "is-done" : ""}>
                  <span className="urko-tick" aria-hidden="true">
                    {s.done ? "✓" : ""}
                  </span>
                  {s.label}
                  <span className="urko-sr">{s.done ? " – done" : " – to do"}</span>
                </Link>
              </li>
            ))}
          </ul>
        </section>
      )}

      {data && data.recent.length > 0 && (
        <section className="urko-card" aria-labelledby="recent-h">
          <div className="urko-card__head">
            <h2 id="recent-h" className="urko-h3">
              Latest orders
            </h2>
            <Link href={ORDERS}>See all orders</Link>
          </div>
          <ul className="urko-recent">
            {data.recent.slice(0, 5).map((o) => {
              const st = ORDER_STATUS[o.status] ?? { label: o.status, tone: "n" };
              return (
                <li key={o.id}>
                  <Link href={`${ORDERS}/${o.id}`}>
                    <span>
                      <strong>{o.orderNumber}</strong> · {o.customer}
                      <span className="urko-muted urko-small"> {o.city}</span>
                    </span>
                    <span className={`urko-badge urko-badge--${st.tone}`}>
                      <span className="urko-badge__dot" />
                      {st.label}
                    </span>
                    <strong>{rs(o.total)}</strong>
                  </Link>
                </li>
              );
            })}
          </ul>
        </section>
      )}

      <ConfigBackup />
    </div>
  );
}
