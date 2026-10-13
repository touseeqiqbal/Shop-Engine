import type { AdminViewServerProps } from "payload";
import { AdminPage } from "../ui/AdminPage";
import { SecurityScreen } from "./SecurityScreen";

/** /cms/security – the signed-in person's 2-step verification. */
export function SecurityView(props: AdminViewServerProps) {
  return (
    <AdminPage props={props} path="/security">
      <SecurityScreen />
    </AdminPage>
  );
}
