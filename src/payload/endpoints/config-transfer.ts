import type { Endpoint, PayloadRequest } from "payload";
import { isOwnerUser } from "../access";

/**
 * Store configuration backup (owner only):
 *   GET  /cms-api/config-export          → JSON file with every settings global + menus, pages, collections, redirects
 *   POST /cms-api/config-import?dryRun=1 → what an import would change (no writes)
 *   POST /cms-api/config-import          → restore it (globals replaced; documents matched by handle / slug / from-path)
 * Relationships are stored as ids, so restore into the same store or a copy of its database (e.g. staging).
 * Orders, customers and products are NOT part of this file – they are covered by the daily database backup.
 */

type Doc = Record<string, unknown>;
const FORMAT = "urko-cms-config@1";
const COLLECTIONS: { slug: string; key: string }[] = [
  { slug: "menus", key: "handle" },
  { slug: "pages", key: "slug" },
  { slug: "product-collections", key: "slug" },
  { slug: "redirects", key: "from" },
];

/** Drop ids/timestamps so documents and array rows can be recreated cleanly. */
const DROP = new Set(["id", "createdAt", "updatedAt", "globalType", "legacyId"]);
function strip(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(strip);
  if (!value || typeof value !== "object") return value;
  return Object.fromEntries(Object.entries(value as Doc).filter(([k]) => !DROP.has(k)).map(([k, v]) => [k, strip(v)]));
}

const forbidden = () => Response.json({ error: "Only the store owner can export or import the configuration." }, { status: 403 });

export const configExportEndpoint: Endpoint = {
  path: "/config-export",
  method: "get",
  handler: async (req: PayloadRequest) => {
    if (!isOwnerUser(req.user as never)) return forbidden();
    const { payload } = req;
    const globals: Doc = {};
    for (const g of payload.config.globals) {
      const doc = (await payload.findGlobal({ slug: g.slug as never, depth: 0, overrideAccess: true, draft: false })) as Doc;
      if (doc.updatedAt) globals[g.slug] = strip(doc); // never-saved globals still use built-in defaults – nothing to back up
    }
    const collections: Doc = {};
    for (const c of COLLECTIONS) {
      const res = await payload.find({ collection: c.slug as never, limit: 0, pagination: false, depth: 0, overrideAccess: true });
      collections[c.slug] = res.docs.map(strip);
    }
    const body = JSON.stringify({ format: FORMAT, exportedAt: new Date().toISOString(), globals, collections }, null, 2);
    const stamp = new Date(Date.now() + 5 * 3600e3).toISOString().slice(0, 16).replace(/[:T]/g, "-");
    return new Response(body, {
      headers: {
        "Content-Type": "application/json; charset=utf-8",
        "Content-Disposition": `attachment; filename="urko-cms-config-${stamp}.json"`,
        "Cache-Control": "no-store",
      },
    });
  },
};

export const configImportEndpoint: Endpoint = {
  path: "/config-import",
  method: "post",
  handler: async (req: PayloadRequest) => {
    if (!isOwnerUser(req.user as never)) return forbidden();
    const dryRun = new URL(req.url ?? "", "http://x").searchParams.get("dryRun") === "1";
    let file: { format?: string; globals?: Doc; collections?: Record<string, Doc[]> };
    try {
      file = (await req.json?.()) as typeof file;
    } catch {
      return Response.json({ error: "Not a JSON file." }, { status: 400 });
    }
    if (file?.format !== FORMAT) return Response.json({ error: `Not a configuration export (expected format ${FORMAT}).` }, { status: 400 });

    const { payload } = req;
    const known = new Set(payload.config.globals.map((g) => g.slug));
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

    for (const [slug, data] of Object.entries(file.globals ?? {})) {
      if (!known.has(slug as never)) {
        report.skipped.push(`global ${slug}`);
        continue;
      }
      if (await attempt(`global ${slug}`, () => payload.updateGlobal({ slug: slug as never, data: data as never, overrideAccess: true }))) report.globals.push(slug);
    }
    for (const c of COLLECTIONS) {
      for (const doc of file.collections?.[c.slug] ?? []) {
        const keyValue = doc[c.key];
        if (typeof keyValue !== "string" || !keyValue) {
          report.skipped.push(`${c.slug} without ${c.key}`);
          continue;
        }
        const existing = await payload.find({ collection: c.slug as never, where: { [c.key]: { equals: keyValue } }, limit: 1, depth: 0, overrideAccess: true, draft: true });
        const label = `${c.slug}: ${keyValue}`;
        if (existing.docs[0]) {
          if (await attempt(label, () => payload.update({ collection: c.slug as never, id: (existing.docs[0] as Doc).id as number, data: doc as never, overrideAccess: true }))) report.updated.push(label);
        } else if (await attempt(label, () => payload.create({ collection: c.slug as never, data: doc as never, overrideAccess: true }))) report.created.push(label);
      }
    }
    return Response.json({ dryRun, ...report });
  },
};
