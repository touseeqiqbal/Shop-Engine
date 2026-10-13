import type { AdminViewServerProps } from "payload";
import { AdminPage } from "../ui/AdminPage";
import { DEFAULT_GUIDE } from "../../globals/staff-guide";
import { HelpScreen, type Guide } from "./HelpScreen";

/** /cms/help – short guides for the team (text from Settings → Staff guide). */
export async function HelpView(props: AdminViewServerProps) {
  const { req } = props.initPageResult;
  const g = (await req.payload.findGlobal({ slug: "staff-guide", depth: 0, overrideAccess: true }).catch(() => null)) as { updatedAt?: string; sections?: Guide[] } | null;
  const guides = g?.updatedAt && g.sections?.length ? g.sections : DEFAULT_GUIDE;
  const role = (req.user as { role?: string } | null)?.role;
  return (
    <AdminPage props={props} path="/help">
      <HelpScreen guides={guides} canEdit={role === "owner" || role === "manager"} />
    </AdminPage>
  );
}
