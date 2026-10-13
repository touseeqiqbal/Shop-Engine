import type { AdminViewServerProps } from "payload";
import { AdminPage } from "../ui/AdminPage";
import { StockCountScreen } from "./StockCountScreen";

/** /cms/stock-count */
export function StockCountView(props: AdminViewServerProps) {
  return (
    <AdminPage props={props} path="/stock-count">
      <StockCountScreen />
    </AdminPage>
  );
}
