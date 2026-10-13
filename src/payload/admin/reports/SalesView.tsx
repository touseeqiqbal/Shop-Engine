import type { AdminViewServerProps } from "payload";
import { AdminPage } from "../ui/AdminPage";
import { SalesReport } from "./SalesReport";

/** /cms/reports/sales – sales (website + shop counter) and profit, by product, category, brand, city, payment, channel. */
export function SalesView(props: AdminViewServerProps) {
  return (
    <AdminPage props={props} path="/reports/sales">
      <SalesReport />
    </AdminPage>
  );
}
