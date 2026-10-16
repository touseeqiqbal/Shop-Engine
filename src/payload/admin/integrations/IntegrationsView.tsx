import type { AdminViewServerProps } from "payload";
import { AdminPage } from "../ui/AdminPage";
import { IntegrationsScreen } from "./IntegrationsScreen";

/** /cms/integrations – the store's connections to couriers, payment providers, its own messaging accounts, ads tools … */
export function IntegrationsView(props: AdminViewServerProps) {
  return (
    <AdminPage props={props} path="/integrations">
      <IntegrationsScreen />
    </AdminPage>
  );
}
