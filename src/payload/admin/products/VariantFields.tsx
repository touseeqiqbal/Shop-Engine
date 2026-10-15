"use client";
import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { useDocumentInfo, useField, useFormFields, useFormModified } from "@payloadcms/ui";
import { toast } from "../ui/toast";
import { useAdminMoney } from "../ui/store-context";

/** A variant's option, e.g. "Colour: Black · Size: L" (set when the variant was created – read only). */
export function OptionValuesField({ path }: { path: string }) {
  const { value } = useField<Record<string, string> | null>({ path });
  const entries = value && typeof value === "object" ? Object.entries(value) : [];
  if (!entries.length) return null;
  return (
    <div className="field-type">
      <span className="field-label">Option</span>
      <p style={{ margin: "4px 0 16px", fontWeight: 600 }}>{entries.map(([k, v]) => `${k}: ${v}`).join(" · ")}</p>
    </div>
  );
}

type Variant = { id: number; title: string; sku: string; price: number; stock: number; status: string; optionValues?: Record<string, string> };

const STATUS: Record<string, string> = { active: "On store", draft: "Draft", archived: "Hidden" };

/**
 * Main product → Variants tab: its variants (option, SKU, price, stock – each opens to edit) and a button that makes a
 * variant for every option combination that doesn't exist yet.
 */
export function VariantsPanel() {
  const { id } = useDocumentInfo();
  const modified = useFormModified();
  const [variants, setVariants] = useState<Variant[] | null>(null);
  const [busy, setBusy] = useState(false);
  // prices in the product's store's currency
  const store = useFormFields(([f]) => f.store?.value);
  const money = useAdminMoney(store);

  const load = useCallback(async () => {
    if (!id) return;
    const r = await fetch(`/cms-api/products?where[variantOf][equals]=${encodeURIComponent(String(id))}&limit=200&depth=0&sort=title`, { credentials: "include" });
    const j = await r.json().catch(() => null);
    setVariants((j?.docs as Variant[] | undefined) ?? []);
  }, [id]);

  useEffect(() => {
    void load();
  }, [load]);

  if (!id) return <p className="urko-tip">Save the product first – then add its options and create the variants.</p>;

  const create = async () => {
    if (modified) return toast("Save your changes first (the options you typed), then create the variants.", "error");
    setBusy(true);
    const r = await fetch(`/cms-api/products/${id}/create-variants`, { method: "POST", credentials: "include" });
    const j = await r.json().catch(() => null);
    setBusy(false);
    if (!r.ok) return toast(j?.error ?? "Couldn't create the variants.", "error");
    toast(j.created.length ? `${j.created.length} variant${j.created.length === 1 ? "" : "s"} created – set their stock (and photo / price if different).` : "All option combinations already have a variant.");
    void load();
  };

  return (
    <div className="field-type" style={{ marginTop: 8 }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12, flexWrap: "wrap" }}>
        <span className="field-label" style={{ margin: 0 }}>
          Variants {variants ? `(${variants.length})` : ""}
        </span>
        <button type="button" className="urko-btn urko-btn--primary" onClick={create} disabled={busy}>
          {busy ? "Creating…" : "Create variants"}
        </button>
      </div>
      {variants === null ? (
        <p className="urko-tip">Loading…</p>
      ) : variants.length === 0 ? (
        <p className="urko-tip" style={{ marginTop: 8 }}>
          No variants yet. Add options above (e.g. Colour: Black, Silver), save, then press “Create variants”. While a product has variants, its stock is the
          total of their stock and shoppers pick an option on its page.
        </p>
      ) : (
        <div style={{ overflowX: "auto", marginTop: 8 }}>
          <table className="urko-vtable" style={{ width: "100%", borderCollapse: "collapse", fontSize: 14 }}>
            <thead>
              <tr style={{ textAlign: "left", color: "var(--theme-elevation-600)" }}>
                <th style={{ padding: "6px 8px" }}>Option</th>
                <th style={{ padding: "6px 8px" }}>SKU</th>
                <th style={{ padding: "6px 8px" }}>Price</th>
                <th style={{ padding: "6px 8px" }}>Stock</th>
                <th style={{ padding: "6px 8px" }}>Status</th>
              </tr>
            </thead>
            <tbody>
              {variants.map((v) => (
                <tr key={v.id} style={{ borderTop: "1px solid var(--theme-elevation-150)" }}>
                  <td style={{ padding: "8px" }}>
                    <Link href={`/cms/collections/products/${v.id}`} style={{ fontWeight: 600 }}>
                      {/* the name keeps the options in their order ("… – Black / 13 inch") */}
                      {v.title.includes(" – ") ? v.title.slice(v.title.lastIndexOf(" – ") + 3) : v.optionValues ? Object.values(v.optionValues).join(" / ") : v.title}
                    </Link>
                  </td>
                  <td style={{ padding: "8px", fontFamily: "ui-monospace, Menlo, Consolas, monospace", fontSize: 12 }}>{v.sku}</td>
                  <td style={{ padding: "8px" }}>{money(Number(v.price) || 0)}</td>
                  <td style={{ padding: "8px", fontWeight: 600, color: Number(v.stock) > 0 ? undefined : "var(--urko-red)" }}>{Number(v.stock) || 0}</td>
                  <td style={{ padding: "8px" }}>{STATUS[v.status] ?? v.status}</td>
                </tr>
              ))}
            </tbody>
          </table>
          <p className="urko-tip" style={{ marginTop: 8 }}>
            Open a variant to change its price, photo or stock. Stock of this main product = {variants.reduce((s, v) => s + (Number(v.stock) || 0), 0)} (all variants together).
          </p>
        </div>
      )}
    </div>
  );
}
