"use client";
import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { useAuth, useListQuery } from "@payloadcms/ui";
import type { DefaultCellComponentProps } from "payload";
import { getThumb } from "./thumbs";
import { toast } from "../ui/toast";

/** Product list cells: photo + name + SKU, coloured status, and quick edit for price and stock. */

type Row = Record<string, unknown>;
const firstImageId = (row: Row) => {
  const imgs = row.images;
  const first = Array.isArray(imgs) ? imgs[0] : null;
  if (first == null) return null;
  return typeof first === "object"
    ? String((first as { id: unknown }).id)
    : String(first);
};

export function ProductTitleCell({
  rowData,
  cellData,
}: DefaultCellComponentProps) {
  const id = firstImageId(rowData);
  const [thumb, setThumb] = useState<{ url: string; alt: string } | null>(null);
  useEffect(() => {
    let live = true;
    if (id) getThumb(id).then((t) => live && setThumb(t));
    return () => {
      live = false;
    };
  }, [id]);
  const count = Array.isArray(rowData.images) ? rowData.images.length : 0;
  return (
    <Link
      className="urko-pcell"
      href={`/cms/collections/products/${rowData.id}`}
    >
      <span className="urko-pcell__img">
        {thumb ? (
          <img src={thumb.url} alt="" loading="lazy" />
        ) : (
          !count && <span>No photo</span>
        )}
      </span>
      <span className="urko-pcell__text">
        <strong>{String(cellData || "Untitled product")}</strong>
        <small>
          {rowData.sku ? `SKU ${String(rowData.sku)}` : "No SKU"}
          {count > 0 && count < 3
            ? ` · only ${count} photo${count === 1 ? "" : "s"}`
            : ""}
        </small>
      </span>
    </Link>
  );
}

const STATUS: Record<string, { label: string; tone: string }> = {
  active: { label: "On store", tone: "g" },
  draft: { label: "Draft", tone: "n" },
  archived: { label: "Hidden", tone: "r" },
};
export function ProductStatusCell({ cellData }: DefaultCellComponentProps) {
  const s = STATUS[String(cellData)] ?? {
    label: String(cellData ?? "—"),
    tone: "n",
  };
  return <span className={`urko-badge urko-badge--${s.tone}`}>{s.label}</span>;
}

const STOCK: Record<string, { label: string; tone: string }> = {
  in: { label: "In stock", tone: "g" },
  low: { label: "Low", tone: "y" },
  out: { label: "Out", tone: "r" },
};

const rs = (n: number) => `Rs ${Math.round(n).toLocaleString("en-PK")}`;

/** Click the number, type, press Enter. Esc cancels. Saves straight away. */
function QuickNumber({
  id,
  field,
  value,
  label,
  format,
}: {
  id: unknown;
  field: string;
  value: number | null;
  label: string;
  format: (n: number) => string;
}) {
  const { refineListData, query } = useListQuery();
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState("");
  const [shown, setShown] = useState(value);
  const [busy, setBusy] = useState(false);
  const input = useRef<HTMLInputElement>(null);
  useEffect(() => setShown(value), [value]);
  useEffect(() => {
    if (editing) input.current?.select();
  }, [editing]);

  async function save() {
    const next =
      draft.trim() === "" ? null : Number(draft.replace(/[,\s]/g, ""));
    if (next === shown) return setEditing(false);
    if (next === null || !Number.isFinite(next) || next < 0) {
      toast(`${label} must be a number of 0 or more`, "error");
      return input.current?.focus();
    }
    setBusy(true);
    try {
      const res = await fetch(`/cms-api/products/${id}?depth=0`, {
        method: "PATCH",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        // stock: also send what this row showed, so a sale made meanwhile is never overwritten (server refuses instead)
        body: JSON.stringify(field === "stock" ? { stock: Math.round(next), stockSeen: shown } : { [field]: Math.round(next) }),
      });
      if (!res.ok) {
        const j = (await res.json().catch(() => ({}))) as {
          errors?: { message?: string }[];
        };
        throw new Error(j.errors?.[0]?.message || "Could not save");
      }
      setShown(Math.round(next));
      setEditing(false);
      toast(`${label} saved`);
      // stock changes the In stock / Low / Out badge, so reload the rows
      if (field === "stock") void refineListData(query, false);
    } catch (e) {
      toast(`${label} not saved – ${(e as Error).message}`, "error");
    } finally {
      setBusy(false);
    }
  }

  if (editing)
    return (
      <input
        ref={input}
        className="urko-quick__input"
        inputMode="numeric"
        aria-label={label}
        value={draft}
        disabled={busy}
        onChange={(e) => setDraft(e.target.value)}
        onBlur={save}
        onKeyDown={(e) => {
          if (e.key === "Enter") (e.target as HTMLInputElement).blur();
          if (e.key === "Escape") setEditing(false);
        }}
        onClick={(e) => e.stopPropagation()}
      />
    );
  return (
    <button
      type="button"
      className="urko-quick"
      title={`Change ${label.toLowerCase()}`}
      aria-label={`${label}: ${shown == null ? "not set" : format(shown)}. Click to change`}
      onClick={(e) => {
        e.stopPropagation();
        setDraft(shown == null ? "" : String(shown));
        setEditing(true);
      }}
    >
      {shown == null ? "—" : format(shown)}
      <span className="urko-quick__pen" aria-hidden="true">
        ✎
      </span>
    </button>
  );
}

export function ProductPriceCell({
  rowData,
  cellData,
}: DefaultCellComponentProps) {
  const { user } = useAuth();
  const compare = Number(rowData.compareAtPrice) || 0;
  const price = typeof cellData === "number" ? cellData : null;
  if (rowData.priceOnRequest)
    return <span className="urko-badge urko-badge--b">On request</span>;
  // prices: owners and managers only (staff see them, but can't quick-edit)
  const role = (user as { role?: string } | null)?.role;
  if (role !== "owner" && role !== "manager")
    return (
      <span className="urko-pprice" title="Only owners and managers can change prices">
        {price == null ? "—" : rs(price)}
        {compare > (price ?? 0) && <s>{rs(compare)}</s>}
      </span>
    );
  return (
    <span className="urko-pprice">
      <QuickNumber
        id={rowData.id}
        field="price"
        value={price}
        label="Price"
        format={rs}
      />
      {compare > (price ?? 0) && <s>{rs(compare)}</s>}
    </span>
  );
}

export function ProductStockCell({
  rowData,
  cellData,
}: DefaultCellComponentProps) {
  const s = STOCK[String(rowData.stockStatus)];
  return (
    <span className="urko-pstock">
      {rowData.trackUnits ? (
        // serial-tracked: stock is the count of In-stock units, so link to them instead of editing
        <Link className="urko-quick" href={`/cms/collections/units?where[product][equals]=${rowData.id}&where[status][equals]=in-stock`} title="Stock comes from the serial numbers">
          {typeof cellData === "number" ? cellData : 0} <small>serials</small>
        </Link>
      ) : (
        <QuickNumber
          id={rowData.id}
          field="stock"
          value={typeof cellData === "number" ? cellData : 0}
          label="Stock"
          format={(n) => String(n)}
        />
      )}
      {s && (
        <span className={`urko-badge urko-badge--${s.tone}`}>{s.label}</span>
      )}
    </span>
  );
}
