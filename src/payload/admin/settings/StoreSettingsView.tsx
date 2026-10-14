import type { AdminViewServerProps, GlobalSlug } from "payload";
import { redirect } from "next/navigation";
import { AdminPage } from "../ui/AdminPage";
import { getTenant, hasStoreRole } from "../../tenancy";
import { STORE_SETTING_ROLES, storeSettingsSlug } from "../../store-settings";

/** Copy of a global's values for a new store document (system fields and array row ids left out). */
function plain(value: unknown): unknown {
  if (Array.isArray(value)) return value.map((v) => (v && typeof v === "object" && !Array.isArray(v) ? strip(v as Record<string, unknown>) : plain(v)));
  if (value && typeof value === "object") return strip(value as Record<string, unknown>);
  return value;
}
const SYSTEM = new Set(["id", "globalType", "createdAt", "updatedAt", "_status"]);
function strip(o: Record<string, unknown>): Record<string, unknown> {
  return Object.fromEntries(Object.entries(o).filter(([k]) => !SYSTEM.has(k)).map(([k, v]) => [k, plain(v)]));
}

/**
 * /cms/settings/<page> – the settings page (theme, shipping, payments …) of the store being worked in.
 * Opens the store's own document, creating it the first time (the default store starts from the current global values,
 * every other store from the defaults).
 */
export async function StoreSettingsView(props: AdminViewServerProps) {
  const { req } = props.initPageResult;
  const segments = (props.params?.segments as string[] | undefined) ?? [];
  const page = String(segments[1] ?? "");
  if (!req.user) redirect(`/cms/login?redirect=${encodeURIComponent(`/cms/settings/${page}`)}`);
  const min = STORE_SETTING_ROLES[page];
  const t = await getTenant(req);
  const store = t.activeStoreId;
  const message = (text: string) => (
    <AdminPage props={props} path={`/settings/${page}`}>
      <p style={{ padding: 32 }}>{text}</p>
    </AdminPage>
  );
  if (!min) return message("This settings page doesn't exist.");
  if (store == null) {
    if (t.platformAdmin) redirect(`/cms/globals/${page}`);
    return message("Choose a store first (switcher at the top of the menu).");
  }
  if (!hasStoreRole(t, store, min)) return message("Only the store's owner or a manager can change these settings.");

  const collection = storeSettingsSlug(page);
  const find = async () => (await req.payload.find({ collection, where: { store: { equals: store } }, limit: 1, depth: 0, overrideAccess: true, req })).docs[0] as { id: number } | undefined;
  let doc = await find();
  if (!doc) {
    const initial = store === t.defaultStoreId ? (plain(await req.payload.findGlobal({ slug: page as GlobalSlug, depth: 0, overrideAccess: true, req }).catch(() => ({}))) as Record<string, unknown>) : {};
    try {
      doc = (await req.payload.create({ collection, data: { ...initial, store } as never, overrideAccess: true, req, context: { storeId: store } })) as unknown as { id: number };
    } catch {
      doc = await find(); // opened twice at once: the other one created it
    }
  }
  if (!doc) return message("This settings page couldn't be opened – please try again.");
  redirect(`/cms/collections/${collection}/${doc.id}`);
}
