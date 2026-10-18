import type { AdminViewServerProps } from "payload";
import { AdminPage } from "../ui/AdminPage";
import { FunnelReport } from "./FunnelReport";

/** /cms/reports/funnel – product views → add to cart → checkout → orders (managers). */
export function FunnelView(props: AdminViewServerProps) {
  return (
    <AdminPage props={props} path="/reports/funnel">
      <FunnelReport />
    </AdminPage>
  );
}
