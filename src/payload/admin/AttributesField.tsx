"use client";
import { useEffect, useMemo, useState } from "react";
import { FieldLabel, useField, useFormFields } from "@payloadcms/ui";

/**
 * Product → "Filter attributes": a form generated from the category's spec template
 * (Catalog → Categories → Filter attributes, inherited from parent categories).
 * Stores the same key → value JSON the storefront filters use.
 */

type Attr = { key: string; label: string; kind: "select" | "boolean" | "range"; options?: string[] | null; unit?: string | null };
type Value = Record<string, string | number | boolean>;
type Cat = { id: number; parent?: number | { id: number } | null; attributes?: Attr[] | null };

const inputStyle: React.CSSProperties = {
  width: "100%",
  padding: "8px 10px",
  borderRadius: 4,
  border: "1px solid var(--theme-elevation-150)",
  background: "var(--theme-input-bg)",
  color: "var(--theme-text)",
};

async function templateFor(categoryId: number): Promise<Attr[]> {
  const chain: Cat[] = [];
  let id: number | null = categoryId;
  for (let i = 0; id && i < 10; i++) {
    const res = await fetch(`/cms-api/categories/${id}?depth=0`, { credentials: "include" });
    if (!res.ok) break;
    const c = (await res.json()) as Cat;
    chain.unshift(c);
    id = typeof c.parent === "object" ? c.parent?.id ?? null : c.parent ?? null;
  }
  // parent first, child definitions win
  const byKey = new Map<string, Attr>();
  for (const c of chain) for (const a of c.attributes ?? []) if (a?.key) byKey.set(a.key, a);
  return [...byKey.values()];
}

export function AttributesField({ path }: { path: string }) {
  const { value, setValue } = useField<Value | null>({ path });
  const category = useFormFields(([fields]) => fields.category?.value) as number | { id: number } | null | undefined;
  const categoryId = typeof category === "object" ? category?.id : category;
  const [attrs, setAttrs] = useState<Attr[] | null>(null);
  const current = useMemo(() => (value && typeof value === "object" ? value : {}), [value]);

  useEffect(() => {
    let alive = true;
    if (!categoryId) {
      setAttrs([]);
      return;
    }
    setAttrs(null);
    templateFor(Number(categoryId)).then((a) => alive && setAttrs(a)).catch(() => alive && setAttrs([]));
    return () => {
      alive = false;
    };
  }, [categoryId]);

  const set = (key: string, v: string | number | boolean | undefined) => {
    const next: Value = { ...current };
    if (v === undefined || v === "") delete next[key];
    else next[key] = v;
    setValue(next);
  };

  const known = new Set((attrs ?? []).map((a) => a.key));
  const extra = Object.entries(current).filter(([k]) => !known.has(k));

  return (
    <div className="field-type" style={{ marginBottom: 24 }}>
      <FieldLabel label="Filter attributes" path={path} />
      <p style={{ margin: "0 0 12px", color: "var(--theme-elevation-600)", fontSize: 13 }}>
        From the category’s spec template (Catalog → Categories → Filter attributes). Used for the shop filters.
      </p>
      {!categoryId && <p style={{ fontSize: 13 }}>Choose a category first.</p>}
      {categoryId && attrs === null && <p style={{ fontSize: 13 }}>Loading the category’s attributes…</p>}
      {attrs && attrs.length === 0 && categoryId && <p style={{ fontSize: 13 }}>This category has no filter attributes yet.</p>}
      {attrs && attrs.length > 0 && (
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(220px, 1fr))", gap: 16 }}>
          {attrs.map((a) => {
            const v = current[a.key];
            const id = `attr-${a.key}`;
            return (
              <div key={a.key}>
                <label htmlFor={id} style={{ display: "block", fontSize: 13, marginBottom: 4 }}>
                  {a.label}
                  {a.unit ? ` (${a.unit})` : ""}
                </label>
                {a.kind === "boolean" ? (
                  <select id={id} style={inputStyle} value={v === true ? "yes" : v === false ? "no" : ""} onChange={(e) => set(a.key, e.target.value === "" ? undefined : e.target.value === "yes")}>
                    <option value="">—</option>
                    <option value="yes">Yes</option>
                    <option value="no">No</option>
                  </select>
                ) : a.kind === "range" ? (
                  <input id={id} type="number" style={inputStyle} value={typeof v === "number" ? v : v ? Number(v) : ""} onChange={(e) => set(a.key, e.target.value === "" ? undefined : Number(e.target.value))} />
                ) : a.options?.length ? (
                  <select id={id} style={inputStyle} value={v == null ? "" : String(v)} onChange={(e) => set(a.key, e.target.value || undefined)}>
                    <option value="">—</option>
                    {[...new Set([...(a.options ?? []), ...(v != null && v !== "" && !a.options.includes(String(v)) ? [String(v)] : [])])].map((o) => (
                      <option key={o} value={o}>
                        {o}
                      </option>
                    ))}
                  </select>
                ) : (
                  <input id={id} type="text" style={inputStyle} value={v == null ? "" : String(v)} onChange={(e) => set(a.key, e.target.value || undefined)} />
                )}
              </div>
            );
          })}
        </div>
      )}
      {extra.length > 0 && (
        <p style={{ marginTop: 12, fontSize: 12, color: "var(--theme-elevation-600)" }}>
          Other saved values (not in this category’s template, kept as-is): {extra.map(([k, v]) => `${k}: ${String(v)}`).join(" · ")}
        </p>
      )}
    </div>
  );
}
