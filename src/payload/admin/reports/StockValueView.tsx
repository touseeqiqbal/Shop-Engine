import type { AdminViewServerProps } from "payload";
import { AdminPage } from "../ui/AdminPage";
import { StockValueReport } from "./StockValueReport";

/** /cms/reports/stock-value – what the stock is worth and how long it has gone without selling (owners). */
export function StockValueView(props: AdminViewServerProps) {
  return (
    <AdminPage props={props} path="/reports/stock-value">
      <StockValueReport />
    </AdminPage>
  );
}
