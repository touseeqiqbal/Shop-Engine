import type { AdminViewServerProps } from "payload";
import { DefaultTemplate } from "@payloadcms/next/templates";
import { redirect } from "next/navigation";

/** Wraps a custom admin screen in the normal admin frame (sidebar, header tools). Signed-in staff only. */
export function AdminPage({ props, path, children }: { props: AdminViewServerProps; path: string; children: React.ReactNode }) {
  const { initPageResult, params, searchParams } = props;
  const { req, permissions, visibleEntities, locale } = initPageResult;
  if (!req.user) redirect(`/cms/login?redirect=${encodeURIComponent(`/cms${path}`)}`);
  const role = (req.user as { role?: string }).role;
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
      {role && role !== "customer" ? children : <p style={{ padding: 32 }}>Only staff can open this page.</p>}
    </DefaultTemplate>
  );
}
