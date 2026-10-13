import type { AdminViewServerProps } from "payload";
import { AdminPage } from "../ui/AdminPage";
import { PrivacyScreen } from "./PrivacyScreen";

/** /cms/privacy – customer data export / deletion (owners and managers; the API enforces it). */
export function PrivacyView(props: AdminViewServerProps) {
  return (
    <AdminPage props={props} path="/privacy">
      <PrivacyScreen />
    </AdminPage>
  );
}
