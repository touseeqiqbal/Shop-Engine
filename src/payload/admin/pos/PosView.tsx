import type { AdminViewServerProps } from "payload";
import { DefaultTemplate } from "@payloadcms/next/templates";
import { redirect } from "next/navigation";
import { getTenant, hasStoreRole } from "../../tenancy";
import { getStoreSettings } from "../../store-settings";
import { PosScreen } from "./PosScreen";

/** /cms/pos – the shop counter, inside the normal admin frame (sidebar + header). Staff only. */
export async function PosView({ initPageResult, params, searchParams }: AdminViewServerProps) {
  const { req, permissions, visibleEntities, locale } = initPageResult;
  if (!req.user) redirect("/cms/login?redirect=%2Fcms%2Fpos");
  const t = await getTenant(req);
  const store = t.activeStoreId;
  const allowed = store != null && hasStoreRole(t, store, "store_staff");
  const info = allowed ? await getStoreSettings<{ name?: string }>(req.payload, "store-info", store, { req }) : null;
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
      {allowed ? <PosScreen storeName={info?.name || "Store"} /> : <p style={{ padding: 32 }}>{store == null ? "Choose a store first (switcher at the top of the menu)." : "Only the store's team can use the shop counter."}</p>}
    </DefaultTemplate>
  );
}
