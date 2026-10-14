import type { AdminViewServerProps } from "payload";
import { DefaultTemplate } from "@payloadcms/next/templates";
import { redirect } from "next/navigation";
import { getTenant, isAdminCapable } from "../../tenancy";

/** Wraps a custom admin screen in the normal admin frame (sidebar, header tools). Store teams and platform admins only. */
export async function AdminPage({ props, path, children }: { props: AdminViewServerProps; path: string; children: React.ReactNode }) {
  const { initPageResult, params, searchParams } = props;
  const { req, permissions, visibleEntities, locale } = initPageResult;
  if (!req.user) redirect(`/cms/login?redirect=${encodeURIComponent(`/cms${path}`)}`);
  const allowed = isAdminCapable(await getTenant(req));
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
      {allowed ? children : <p style={{ padding: 32 }}>Only a store&apos;s team can open this page.</p>}
    </DefaultTemplate>
  );
}
