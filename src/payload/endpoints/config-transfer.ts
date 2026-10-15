import type { CollectionSlug, Endpoint, GlobalSlug, PayloadRequest } from "payload";
import { getTenant, hasStoreRole } from "../tenancy";
import { STORE_SETTING_ROLES, storeSettingsSlug } from "../store-settings";
import { logActivity } from "../collections/history";
import { storeLocaleOf } from "../store-locale";
import { zoneOffsetMinutes } from "../../lib/time";

/**
 * Store configuration backup (the store's owner, for the store being worked in):
 *   GET  /cms-api/config-export          → JSON file with every settings page + menus, pages, collections, redirects
 *   POST /cms-api/config-import?dryRun=1 → what an import would change (no writes)
 *   POST /cms-api/config-import          → restore it (settings replaced; documents matched by handle / slug / from-path)
 * A platform admin with no store chosen exports / restores ShopEngine's defaults (the globals) instead.
 * Relationships are stored as ids, so restore into the same store or a copy of its database (e.g. staging).
 * Orders, customers and products are NOT part of this file – they are covered by the daily database backup.
 * The file never decides which store it goes into: everything is restored into the store being worked in.
 */

type Doc = Record<string, unknown>;
const FORMAT = "shopengine-config@2";
const LEGACY_FORMAT = "urko-cms-config@1"; // older files (one store) still restore
const COLLECTIONS: { slug: CollectionSlug; key: string }[] = [
  { slug: "menus", key: "handle" },
  { slug: "pages", key: "slug" },
  { slug: "product-collections", key: "slug" },
  { slug: "redirects", key: "from" },
];

/** Drop ids/timestamps (and the store) so documents and array rows can be recreated cleanly. */
const DROP = new Set(["id", "createdAt", "updatedAt", "globalType", "legacyId", "store"]);
function strip(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(strip);
  if (!value || typeof value !== "object") return value;
  return Object.fromEntries(Object.entries(value as Doc).filter(([k]) => !DROP.has(k)).map(([k, v]) => [k, strip(v)]));
}

const forbidden = () => Response.json({ error: "Only the store's owner can export or import its configuration." }, { status: 403 });

/** The store this backup is for (null = ShopEngine's defaults), or a refusal. */
async function target(req: PayloadRequest): Promise<{ store: number | null } | Response> {
  if (!req.user) return forbidden();
  const t = await getTenant(req);
  if (t.activeStoreId == null) return t.platformAdmin ? { store: null } : forbidden();
  if (!hasStoreRole(t, t.activeStoreId, "store_owner")) return forbidden();
  if (!t.platformAdmin && t.readOnly.has(t.activeStoreId) && req.method !== "GET") return Response.json({ error: "This store is read-only." }, { status: 403 });
  return { store: t.activeStoreId };
}

export const configExportEndpoint: Endpoint = {
  path: "/config-export",
  method: "get",
  handler: async (req: PayloadRequest) => {
    const to = await target(req);
    if (to instanceof Response) return to;
    const { payload } = req;
    const inStore = to.store == null ? [] : [{ store: { equals: to.store } }];
    const globals: Doc = {};
    if (to.store == null) {
      for (const g of payload.config.globals) {
        const doc = (await payload.findGlobal({ slug: g.slug as never, depth: 0, overrideAccess: true, draft: false })) as Doc;
        if (doc.updatedAt) globals[g.slug] = strip(doc); // never-saved globals still use built-in defaults – nothing to back up
      }
    } else {
      for (const slug of Object.keys(STORE_SETTING_ROLES)) {
        const doc = (await payload.find({ collection: storeSettingsSlug(slug), where: { store: { equals: to.store } }, limit: 1, depth: 0, overrideAccess: true })).docs[0] as unknown as Doc | undefined;
        if (doc) globals[slug] = strip(doc);
      }
    }
    const collections: Doc = {};
    for (const c of COLLECTIONS) {
      const res = await payload.find({ collection: c.slug, where: { and: inStore }, limit: 0, pagination: false, depth: 0, overrideAccess: true });
      collections[c.slug] = res.docs.map(strip);
    }
    const body = JSON.stringify({ format: FORMAT, exportedAt: new Date().toISOString(), scope: to.store == null ? "platform-defaults" : "store", globals, collections }, null, 2);
    // file name: the store's local date and time
    const { timezone } = await storeLocaleOf(payload, to.store, req);
    const now = Date.now();
    const stamp = new Date(now + zoneOffsetMinutes(timezone, now) * 60000).toISOString().slice(0, 16).replace(/[:T]/g, "-");
    return new Response(body, {
      headers: {
        "Content-Type": "application/json; charset=utf-8",
        "Content-Disposition": `attachment; filename="shopengine-config-${stamp}.json"`,
        "Cache-Control": "no-store",
      },
    });
  },
};

export const configImportEndpoint: Endpoint = {
  path: "/config-import",
  method: "post",
  handler: async (req: PayloadRequest) => {
    const to = await target(req);
    if (to instanceof Response) return to;
    const dryRun = new URL(req.url ?? "", "http://x").searchParams.get("dryRun") === "1";
    let file: { format?: string; globals?: Doc; collections?: Record<string, Doc[]> };
    try {
      file = (await req.json?.()) as typeof file;
    } catch {
      return Response.json({ error: "Not a JSON file." }, { status: 400 });
    }
    if (file?.format !== FORMAT && file?.format !== LEGACY_FORMAT) return Response.json({ error: `Not a configuration export (expected format ${FORMAT}).` }, { status: 400 });

    const { payload } = req;
    const known = new Set<string>(to.store == null ? payload.config.globals.map((g) => g.slug) : Object.keys(STORE_SETTING_ROLES));
    const inStore = to.store == null ? [] : [{ store: { equals: to.store } }];
    const report: { globals: string[]; created: string[]; updated: string[]; skipped: string[]; failed: string[] } = { globals: [], created: [], updated: [], skipped: [], failed: [] };
    // Each item is applied on its own: one bad entry is reported instead of stopping the whole restore.
    const attempt = async (label: string, fn: () => Promise<unknown>) => {
      if (dryRun) return true;
      try {
        await fn();
        return true;
      } catch (e) {
        report.failed.push(`${label}: ${(e as Error).message}`);
        return false;
      }
    };

    for (const [slug, raw] of Object.entries(file.globals ?? {})) {
      if (!known.has(slug)) {
        report.skipped.push(`settings ${slug}`);
        continue;
      }
      const data = strip(raw) as Doc;
      const apply = async () => {
        if (to.store == null) return payload.updateGlobal({ slug: slug as GlobalSlug, data: data as never, overrideAccess: true });
        const collection = storeSettingsSlug(slug);
        const existing = (await payload.find({ collection, where: { store: { equals: to.store } }, limit: 1, depth: 0, overrideAccess: true })).docs[0] as unknown as Doc | undefined;
        return existing
          ? payload.update({ collection, id: existing.id as number, data: data as never, overrideAccess: true, req })
          : payload.create({ collection, data: { ...data, store: to.store } as never, overrideAccess: true, req, context: { storeId: to.store } });
      };
      if (await attempt(`settings ${slug}`, apply)) report.globals.push(slug);
    }
    for (const c of COLLECTIONS) {
      for (const raw of file.collections?.[c.slug] ?? []) {
        const doc = strip(raw) as Doc;
        const keyValue = doc[c.key];
        if (typeof keyValue !== "string" || !keyValue) {
          report.skipped.push(`${c.slug} without ${c.key}`);
          continue;
        }
        const existing = await payload.find({ collection: c.slug, where: { and: [{ [c.key]: { equals: keyValue } }, ...inStore] }, limit: 1, depth: 0, overrideAccess: true, draft: true });
        const label = `${c.slug}: ${keyValue}`;
        if (existing.docs[0]) {
          if (await attempt(label, () => payload.update({ collection: c.slug, id: (existing.docs[0] as unknown as Doc).id as number, data: doc as never, overrideAccess: true, req }))) report.updated.push(label);
        } else if (await attempt(label, () => payload.create({ collection: c.slug, data: { ...doc, ...(to.store == null ? {} : { store: to.store }) } as never, overrideAccess: true, req, context: { storeId: to.store } })))
          report.created.push(label);
      }
    }
    if (!dryRun)
      await logActivity(req, {
        action: "update",
        entity: "config-import",
        entityLabel: "Settings backup restored",
        docId: to.store == null ? "platform" : String(to.store),
        title: to.store == null ? "ShopEngine defaults" : "Store settings",
        changes: [
          { field: "settings", from: "", to: String(report.globals.length) },
          { field: "created", from: "", to: String(report.created.length) },
          { field: "updated", from: "", to: String(report.updated.length) },
          { field: "failed", from: "", to: String(report.failed.length) },
        ],
        storeId: to.store,
      });
    return Response.json({ dryRun, ...report });
  },
};
