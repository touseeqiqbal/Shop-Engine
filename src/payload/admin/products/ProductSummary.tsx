"use client";
import { useEffect, useState } from "react";
import { useAllFormFields, useDocumentInfo } from "@payloadcms/ui";

/**
 * Right-hand summary on the product editor: is it ready to sell (checklist + score),
 * live profit for owners (cost price is only in the form for them), and a link to the live page.
 */

type Fields = Record<string, { value?: unknown } | undefined>;
const num = (v: unknown) =>
  typeof v === "number" && Number.isFinite(v) ? v : null;
const rs = (n: number) => `Rs ${Math.round(n).toLocaleString("en-PK")}`;
const relId = (v: unknown) =>
  v && typeof v === "object"
    ? ((v as { id?: unknown; value?: unknown }).id ??
      (v as { value?: unknown }).value)
    : v;

/** Rich text has content when any text node is non-empty */
const hasText = (v: unknown): boolean => {
  if (!v || typeof v !== "object")
    return typeof v === "string" && v.trim() !== "";
  const n = v as { text?: string; children?: unknown[]; root?: unknown };
  if (typeof n.text === "string" && n.text.trim()) return true;
  if (n.root) return hasText(n.root);
  return Array.isArray(n.children) && n.children.some(hasText);
};

/** array fields keep their row count in the form state value */
const rows = (fields: Fields, name: string) => {
  const v = fields[name]?.value;
  return typeof v === "number" ? v : Array.isArray(v) ? v.length : 0;
};

export function ProductSummary() {
  const [fields] = useAllFormFields() as unknown as [Fields];
  const { id } = useDocumentInfo();
  const val = (k: string) => fields[k]?.value;

  const price = num(val("price"));
  const was = num(val("compareAtPrice"));
  const hasCost = "costPrice" in fields;
  const cost = num(val("costPrice"));
  const stock = num(val("stock")) ?? 0;
  const photos = Array.isArray(val("images"))
    ? (val("images") as unknown[]).length
    : 0;
  const onRequest = Boolean(val("priceOnRequest"));
  const status = String(val("status") ?? "draft");
  const slug = String(val("slug") ?? "");
  const categoryId = relId(val("category"));

  const [categorySlug, setCategorySlug] = useState("");
  useEffect(() => {
    if (!categoryId) return setCategorySlug("");
    let live = true;
    fetch(`/cms-api/categories/${categoryId}?depth=0`, {
      credentials: "include",
    })
      .then((r) => (r.ok ? r.json() : null))
      .then(
        (c: { slug?: string } | null) => live && setCategorySlug(c?.slug ?? ""),
      )
      .catch(() => undefined);
    return () => {
      live = false;
    };
  }, [categoryId]);

  const checks = [
    { label: "Name", done: Boolean(String(val("title") ?? "").trim()) },
    {
      label: onRequest ? "Price (on request)" : "Price",
      done: onRequest || (price ?? 0) > 0,
    },
    {
      label: "At least 3 photos",
      done: photos >= 3,
      hint: photos ? `${photos} added` : "none yet",
    },
    {
      label: "Short summary",
      done: Boolean(String(val("shortDescription") ?? "").trim()),
    },
    { label: "Full description", done: hasText(val("description")) },
    {
      label: "Category & brand",
      done: Boolean(categoryId && relId(val("brand"))),
    },
    { label: "Specifications", done: rows(fields, "specs") > 0 },
    {
      label: "Condition & warranty",
      done: Boolean(val("condition") && String(val("warranty") ?? "").trim()),
    },
    { label: "In stock", done: stock > 0 },
  ];
  const score = Math.round(
    (checks.filter((c) => c.done).length / checks.length) * 100,
  );
  const tone = score >= 90 ? "g" : score >= 60 ? "y" : "r";

  const profit = price != null && cost != null ? price - cost : null;
  const margin =
    profit != null && price ? Math.round((profit / price) * 100) : null;
  const off =
    price && was && was > price
      ? Math.round(((was - price) / was) * 100)
      : null;
  const liveUrl =
    status === "active" && id && slug && categorySlug
      ? `/${categorySlug}/${slug}`
      : null;

  return (
    <div className="urko-psum">
      <div className="urko-psum__head">
        <span>Ready to sell</span>
        <strong className={`urko-badge urko-badge--${tone}`}>{score}%</strong>
      </div>
      <div className="urko-meter" aria-hidden="true">
        <span
          className={`urko-meter__fill urko-meter__fill--${tone}`}
          style={{ width: `${score}%` }}
        />
      </div>
      <ul className="urko-psum__checks">
        {checks.map((c) => (
          <li key={c.label} className={c.done ? "is-done" : undefined}>
            <span aria-hidden="true">{c.done ? "✓" : "○"}</span>
            {c.label}
            <span className="urko-sr">{c.done ? " – done" : " – missing"}</span>
            {!c.done && c.hint && <small>{c.hint}</small>}
          </li>
        ))}
      </ul>

      {(off != null || (hasCost && price != null)) && (
        <dl className="urko-psum__money">
          {off != null && (
            <div>
              <dt>Sale</dt>
              <dd>{off}% off</dd>
            </div>
          )}
          {hasCost && price != null && (
            <>
              <div>
                <dt>Profit per sale</dt>
                <dd
                  className={
                    profit != null && profit < 0 ? "is-loss" : undefined
                  }
                >
                  {profit == null ? "Add your cost" : rs(profit)}
                </dd>
              </div>
              {margin != null && (
                <div>
                  <dt>Margin</dt>
                  <dd className={margin < 0 ? "is-loss" : undefined}>
                    {margin}%
                  </dd>
                </div>
              )}
            </>
          )}
        </dl>
      )}

      {liveUrl ? (
        <a
          className="urko-psum__link"
          href={liveUrl}
          target="_blank"
          rel="noreferrer"
        >
          View on store ↗
        </a>
      ) : (
        <p className="urko-psum__note">
          {status === "active"
            ? "Save to see it on the store."
            : "Not on the store yet. Set Status to “On store” and save."}
        </p>
      )}
    </div>
  );
}
