import type { AdminViewServerProps } from "payload";
import { DefaultTemplate } from "@payloadcms/next/templates";
import { redirect } from "next/navigation";
import { PosScreen } from "./PosScreen";

/** /cms/pos – the shop counter, inside the normal admin frame (sidebar + header). Staff only. */
export async function PosView({ initPageResult, params, searchParams }: AdminViewServerProps) {
  const { req, permissions, visibleEntities, locale } = initPageResult;
  const role = (req.user as { role?: string } | null)?.role;
  if (!req.user) redirect("/cms/login?redirect=%2Fcms%2Fpos");
  const info = (await req.payload.findGlobal({ slug: "store-info", depth: 0, overrideAccess: true }).catch(() => null)) as { name?: string } | null;
  return (
    <DefaultTemplate
      i18n={req.i18n}
      locale={locale}
      params={params}
      payload={req.payload}
      permissions={permissions}
      searchParams={searchParams}
      user={req.user ?? undefined}
      viewActions={req.payload.config.admin?.components?.actions}
      visibleEntities={visibleEntities}
    >
      {role && role !== "customer" ? <PosScreen storeName={info?.name || "Urko Tech Store"} /> : <p style={{ padding: 32 }}>Only staff can use the shop counter.</p>}
    </DefaultTemplate>
  );
}
