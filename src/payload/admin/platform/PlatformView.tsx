import type { AdminViewServerProps } from "payload";
import Link from "next/link";
import { AdminPage } from "../ui/AdminPage";
import { getTenant } from "../../tenancy";
import { overviewFor } from "../../endpoints/platform";

const n = (v: number) => Math.round(v).toLocaleString("en-PK");

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
          {card("Monthly plan revenue (MRR)", n(o.subscriptions.mrr), Object.entries(o.subscriptions.byStatus).map(([k, v]) => `${v} ${k.replace("_", " ")}`).join(" · ") || "no subscriptions yet")}
          {card("Orders across stores (30 days)", n(o.gmvLast30Days.orders), `worth ${n(o.gmvLast30Days.total)}`)}
          {card("Messages that failed", n(o.deadDeliveries), "Background deliveries marked Dead")}
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
                      <td>{n(s.total)}</td>
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
      </div>
    </AdminPage>
  );
}
