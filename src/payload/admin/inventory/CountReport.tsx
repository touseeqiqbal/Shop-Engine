"use client";
import { useFormFields } from "@payloadcms/ui";
import { useAdminMoney, useStoreRole } from "../ui/store-context";

/** Variance report on a finished stock count: what's short / over, missing or unexpected serials, and the value. */

type Line = { productId: number; title: string; sku: string; tracked: boolean; expected: number; counted: number; unitCost: number; expectedSerials: string[]; scannedSerials: string[]; touched?: boolean };

export function CountReport() {
  const lines = useFormFields(([f]) => f.lines?.value) as Line[] | undefined;
  const status = useFormFields(([f]) => f.status?.value) as string | undefined;
  const store = useFormFields(([f]) => f.store?.value);
  const money = useAdminMoney(store);
  const { isOwner } = useStoreRole();
  if (!Array.isArray(lines)) return null;
  const counted = lines.filter((l) => l.touched);
  const diff = counted.filter((l) => l.counted !== l.expected || (l.tracked && l.expectedSerials.some((s) => !l.scannedSerials.includes(s))));
  const notCounted = lines.length - counted.length;
  const value = diff.reduce((s, l) => s + (l.counted - l.expected) * (l.unitCost || 0), 0);
  return (
    <div className="urko-card" style={{ marginBottom: 24 }}>
      <h3 style={{ marginTop: 0 }}>Variance report</h3>
      {status === "open" && (
        <p className="urko-tip">
          Still counting – continue on <a href="/cms/stock-count">Products → Stock count</a>.
        </p>
      )}
      <p className="urko-tip">
        {counted.length} product(s) counted{notCounted ? ` · ${notCounted} not counted (not included below)` : ""}.
      </p>
      {diff.length === 0 ? (
        <p>Everything matches. 🎉</p>
      ) : (
        <>
          {isOwner && <p className="urko-tip">Value of the difference at cost: {money(value)}</p>}
          <div className="urko-table-wrap">
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
                {diff.map((l) => {
                  const missing = l.tracked ? l.expectedSerials.filter((s) => !l.scannedSerials.includes(s)) : [];
                  const extra = l.tracked ? l.scannedSerials.filter((s) => !l.expectedSerials.includes(s)) : [];
                  const d = l.counted - l.expected;
                  return (
                    <tr key={l.productId}>
                      <td>
                        {l.title} <small className="urko-tip">{l.sku}</small>
                        {missing.length > 0 && <div className="urko-tip">Not found on shelf: {missing.join(", ")}</div>}
                        {extra.length > 0 && <div className="urko-tip">On shelf but not “In stock” in the system: {extra.join(", ")}</div>}
                      </td>
                      <td className="n">{l.expected}</td>
                      <td className="n">{l.counted}</td>
                      <td className="n">
                        <span className={`urko-badge urko-badge--${d < 0 ? "r" : d > 0 ? "b" : "y"}`}>{d > 0 ? `+${d}` : d}</span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </>
      )}
    </div>
  );
}
