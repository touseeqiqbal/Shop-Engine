import type { AdminViewServerProps } from "payload";
import { AdminPage } from "../ui/AdminPage";
import { RtoReport } from "./RtoReport";

/** /cms/reports/rto – refused parcels (RTO) by city, zone, courier and customer. */
export function RtoView(props: AdminViewServerProps) {
  return (
    <AdminPage props={props} path="/reports/rto">
      <RtoReport />
    </AdminPage>
  );
}
