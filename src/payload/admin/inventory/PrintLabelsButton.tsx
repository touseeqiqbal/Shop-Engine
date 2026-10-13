"use client";
import { useSelection } from "@payloadcms/ui";

/** Above the product / unit list: print barcode labels for the ticked rows. */
export function PrintLabelsButton({ type }: { type: "products" | "units" }) {
  const { getSelectedIds } = useSelection();
  return (
    <div className="urko-labelbar">
      <button
        type="button"
        className="urko-btn urko-btn--sm"
        onClick={() => {
          const ids = getSelectedIds();
          if (!ids.length) return alert("Tick the rows you want labels for first.");
          const copies = type === "products" ? window.prompt("How many labels of each?", "1") : "1";
          if (copies === null) return;
          window.open(`/cms-print/labels?type=${type}&ids=${ids.join(",")}&copies=${Number(copies) || 1}`, "_blank");
        }}
      >
        Print barcode labels
      </button>
      {type === "products" && (
        <a className="urko-btn urko-btn--sm" href="/cms/stock-count">
          Stock count
        </a>
      )}
    </div>
  );
}
