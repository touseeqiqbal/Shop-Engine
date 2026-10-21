import type { AdminViewServerProps } from "payload";
import Link from "next/link";
import { AdminPage } from "../ui/AdminPage";
import { getTenant } from "../../tenancy";
import { historyFor, integrationsOverview, overviewFor } from "../../endpoints/platform";
import { storeLocaleOf } from "../../store-locale";
import { formatMoney } from "../../../lib/money";
import { ViewAsForm } from "./SupportView";

/** /cms/platform – ShopEngine at a glance: stores, merchants, plan revenue, payments to chase, busiest stores. */
export async function PlatformView(props: AdminViewServerProps) {
  const { req } = props.initPageResult;
  const t = req.user ? await getTenant(req) : null;
  if (!t?.platformAdmin)
    return (
      <AdminPage props={props} path="/platform">
        <p style={{ padding: 32 }}>Platform admins only.</p>
      </AdminPage>
    );
  const o = await overviewFor(req);
  // numbers as the default store writes them; money per currency (never added across currencies)
  const { locale } = await storeLocaleOf(req.payload, null, req);
  const [history, integrations, storeList] = await Promise.all([
    historyFor(req, 12),
    integrationsOverview(req),
    req.payload.find({ collection: "stores", sort: "name", limit: 500, depth: 0, select: { name: true } as never, overrideAccess: true, req }).then((r) => (r.docs as unknown as { id: number; name?: string }[]).map((x) => ({ id: Number(x.id), name: String(x.name ?? `#${x.id}`) }))),
  ]);
  const maxOrders = Math.max(1, ...history.map((h) => h.orders));
  const monthName = (m: string) => new Date(`${m}-01T00:00:00Z`).toLocaleDateString(locale, { month: "short", year: "numeric", timeZone: "UTC" });
  const n = (v: number) => Math.round(v).toLocaleString(locale);
  const amounts = (byCurrency: Record<string, number>) => Object.entries(byCurrency).map(([currency, v]) => formatMoney(v, { currency, locale })).join(" + ") || formatMoney(0, { currency: "PKR", locale });
  const card = (label: string, value: string, sub?: string) => (
    <div className="urko-card">
      <div className="urko-muted">{label}</div>
      <div className="urko-big">{value}</div>
      {sub ? <div className="urko-small urko-muted">{sub}</div> : null}
    </div>
  );
  return (
    <AdminPage props={props} path="/platform">
      <div style={{ padding: "24px 32px", display: "grid", gap: 16 }}>
        <h1 style={{ margin: 0 }}>ShopEngine platform</h1>
        <div className="urko-grid urko-grid--stats">
          {card("Stores", n(o.stores.total), `${n(o.stores.active)} live · ${n(o.stores.draft)} setting up · ${n(o.stores.suspended)} suspended · ${n(o.stores.closed)} closed`)}
          {card("New stores (30 days)", n(o.stores.newLast30Days))}
          {card("Merchants", n(o.merchants))}
          {card("Monthly plan revenue (MRR)", amounts(o.subscriptions.mrr), Object.entries(o.subscriptions.byStatus).map(([k, v]) => `${v} ${k.replace("_", " ")}`).join(" · ") || "no subscriptions yet")}
          {card("Orders across stores (30 days)", n(o.gmvLast30Days.orders), `worth ${amounts(o.gmvLast30Days.byCurrency)}`)}
          {card("Messages that failed", n(o.deadDeliveries), "Background deliveries marked Dead")}
        </div>
        <section className="urko-card">
          <h2 className="urko-h">Last 12 months</h2>
          <div className="urko-table-wrap">
            <table className="urko-table urko-history">
              <thead>
                <tr>
                  <th>Month</th>
                  <th>New stores</th>
                  <th>Orders</th>
                  <th>Order value</th>
                  <th>Plan payments collected</th>
                </tr>
              </thead>
              <tbody>
                {history.map((h) => (
                  <tr key={h.month}>
                    <td>{monthName(h.month)}</td>
                    <td>{n(h.storesCreated)}</td>
                    <td>
                      <span className="urko-history__bar" style={{ width: `${Math.round((h.orders / maxOrders) * 100)}%` }} aria-hidden="true" /> {n(h.orders)}
                    </td>
                    <td>{Object.keys(h.orderValue).length ? amounts(h.orderValue) : "–"}</td>
                    <td>{Object.keys(h.planRevenue).length ? amounts(h.planRevenue) : "–"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p className="urko-small urko-muted">Orders that weren’t cancelled, refused or returned (still-unpaid card orders not counted); money per currency. Also as JSON: GET /cms-api/platform/history.</p>
        </section>
        <div className="urko-grid urko-grid--panels">
          <section className="urko-card">
            <h2 className="urko-h">Integrations in use</h2>
            {integrations.providers.length ? (
              <table className="urko-table">
                <thead>
                  <tr>
                    <th>Integration</th>
                    <th>Stores</th>
                    <th>Switched on</th>
                    <th>Need attention</th>
                  </tr>
                </thead>
                <tbody>
                  {integrations.providers.slice(0, 15).map((p) => (
                    <tr key={p.id}>
                      <td>{p.name}</td>
                      <td>{n(p.stores)}</td>
                      <td>{n(p.on)}</td>
                      <td>{p.failing ? <strong>{n(p.failing)}</strong> : "0"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            ) : (
              <p className="urko-muted">No store has connected an integration yet.</p>
            )}
          </section>
          <section className="urko-card">
            <h2 className="urko-h">Integrations that need attention</h2>
            {integrations.needsAttention.length ? (
              <ul>
                {integrations.needsAttention.map((x, i) => (
                  <li key={`${x.storeId}-${x.provider}-${i}`}>
                    <Link href={`/cms/collections/stores/${x.storeId}`}>{x.store}</Link> · {x.provider}
                    {x.error ? <span className="urko-small urko-muted"> – {x.error}</span> : null}
                  </li>
                ))}
              </ul>
            ) : (
              <p className="urko-muted">None – every switched-on integration passed its last check.</p>
            )}
            <p className="urko-small urko-muted">A store’s owner fixes these in /cms → Integrations (keys are never shown here).</p>
          </section>
        </div>
        <div className="urko-grid urko-grid--panels">
          <section className="urko-card">
            <h2 className="urko-h">Busiest stores (30 days)</h2>
            {o.topStores.length ? (
              <table className="urko-table">
                <thead>
                  <tr>
                    <th>Store</th>
                    <th>Orders</th>
                    <th>Value</th>
                  </tr>
                </thead>
                <tbody>
                  {o.topStores.map((s) => (
                    <tr key={s.id}>
                      <td>
                        <Link href={`/cms/collections/stores/${s.id}`}>{s.name}</Link>
                      </td>
                      <td>{n(s.orders)}</td>
                      <td>{formatMoney(s.total, { currency: s.currency, locale })}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            ) : (
              <p className="urko-muted">No orders yet.</p>
            )}
          </section>
          <section className="urko-card">
            <h2 className="urko-h">Plan payments to chase</h2>
            {o.failingPayments.length ? (
              <ul>
                {o.failingPayments.map((s) => (
                  <li key={s.id}>
                    <Link href={`/cms/collections/stores/${s.id}`}>{s.name}</Link>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="urko-muted">None – every paying store is up to date.</p>
            )}
            <p className="urko-small urko-muted">
              Suspend or reactivate a store from its page (Status), or with POST /cms-api/platform/stores/&lt;id&gt;/status – both are recorded in the Activity log.
            </p>
          </section>
        </div>
        <section className="urko-card">
          <h2 className="urko-h">Support: see a store as its team does</h2>
          <p className="urko-small urko-muted">
            For 30 minutes you have exactly that role in that store – nothing more – to reproduce what someone there sees. Nobody’s sign-in is used. It is written to the store’s activity log and to Security events; a banner in the menu ends it.
          </p>
          <ViewAsForm stores={storeList} />
        </section>
      </div>
    </AdminPage>
  );
}
