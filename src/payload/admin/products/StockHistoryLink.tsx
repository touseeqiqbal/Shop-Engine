"use client";
import { useDocumentInfo } from "@payloadcms/ui";

/** Product page: link to this product's Stock history (every change, why and who). */
export function StockHistoryLink() {
  const { id } = useDocumentInfo();
  if (!id) return null;
  return (
    <p style={{ margin: "-8px 0 16px" }}>
      <a className="urko-btn urko-btn--sm" href={`/cms/collections/stock-movements?where%5Bproduct%5D%5Bequals%5D=${encodeURIComponent(String(id))}`}>
        Stock history
      </a>{" "}
      <a className="urko-btn urko-btn--sm urko-btn--ghost" href={`/cms/collections/activity-log?where%5Bentity%5D%5Bequals%5D=products&where%5BdocId%5D%5Bequals%5D=${encodeURIComponent(String(id))}`}>
        Change history
      </a>
    </p>
  );
}
