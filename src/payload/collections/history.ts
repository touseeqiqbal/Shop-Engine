import { sql } from "@payloadcms/db-postgres";
import type { CollectionAfterChangeHook, CollectionAfterDeleteHook, CollectionConfig, GlobalAfterChangeHook, GlobalConfig, PayloadRequest } from "payload";
import { canOpenAdmin, isOwnerUser, managers, staff } from "../access";
import { dbName } from "../fields";
import { log } from "../../lib/log";

/**
 * Two read-only logs, written by the system (nobody can add, edit or delete entries in /cms):
 *  - Stock history  – every change of a product's stock: how much, the stock after it, why (order, cancel, return,
 *    shop-counter sale/void, purchase, stock count, edit, import…), the order / receipt / purchase number and who.
 *    Written by src/payload/stock.ts (same database transaction as the stock change) and the product hook.
 *  - Activity log   – who changed what in /cms (prices, stock, orders, payments, roles, discounts, settings…), with the
 *    before → after values. Passwords and 2-step secrets are never stored; cost prices are shown to owners only.
 * Both are kept for 2 years (src/lib/housekeeping.ts).
 */

export const STOCK_REASONS = [
  { label: "Website order", value: "order" },
  { label: "Order edited", value: "order-edited" },
  { label: "Order cancelled / refused", value: "order-cancelled" },
  { label: "Order re-opened", value: "order-reopened" },
  { label: "Order deleted", value: "order-deleted" },
  { label: "Return restocked", value: "return" },
  { label: "Shop counter sale", value: "pos-sale" },
  { label: "Shop counter sale voided", value: "pos-void" },
  { label: "Purchase received", value: "purchase" },
  { label: "Stock count", value: "stock-count" },
  { label: "Serial numbers changed", value: "units" },
  { label: "Edited in /cms", value: "edited" },
  { label: "New product", value: "new-product" },
  { label: "Other", value: "other" },
] as const;
export type StockReason = (typeof STOCK_REASONS)[number]["value"];

export const StockMovements: CollectionConfig = {
  slug: "stock-movements",
  dbName: dbName("stock_movements"),
  labels: { singular: "Stock change", plural: "Stock history" },
  admin: {
    group: "Catalog",
    useAsTitle: "productTitle",
    defaultColumns: ["createdAt", "productTitle", "change", "stockAfter", "reason", "reference", "byEmail"],
    description: "Every change of stock, newest first: why, how much, the stock after it and who. Filter by product to see one product's history.",
    listSearchableFields: ["productTitle", "reference", "serial"],
  },
  defaultSort: "-createdAt",
  access: { read: staff, create: () => false, update: () => false, delete: () => false },
  timestamps: true,
  fields: [
    { name: "product", type: "relationship", relationTo: "products", index: true },
    { name: "productTitle", type: "text", label: "Product" },
    { type: "row", fields: [
      { name: "change", type: "number", label: "Change", admin: { width: "33%" } },
      { name: "stockAfter", type: "number", label: "Stock after", admin: { width: "33%" } },
      { name: "reason", type: "select", options: [...STOCK_REASONS], index: true, admin: { width: "34%" } },
    ] },
    { type: "row", fields: [
      { name: "reference", type: "text", label: "Order / receipt / purchase", index: true, admin: { width: "50%" } },
      { name: "serial", type: "text", label: "Serial number", admin: { width: "50%" } },
    ] },
    { type: "row", fields: [
      { name: "by", type: "relationship", relationTo: "users", label: "By", admin: { width: "50%" } },
      { name: "byEmail", type: "text", label: "By (email)", admin: { width: "50%" } },
    ] },
    { name: "note", type: "text" },
  ],
};

export const ActivityLog: CollectionConfig = {
  slug: "activity-log",
  dbName: dbName("activity_log"),
  labels: { singular: "Activity", plural: "Activity log" },
  admin: {
    group: "Customers & staff",
    useAsTitle: "title",
    defaultColumns: ["createdAt", "userEmail", "action", "entityLabel", "title", "summary"],
    description: "Who changed what in /cms and when, with the old → new values. Owners and managers only.",
    listSearchableFields: ["title", "summary", "userEmail", "docId"],
  },
  defaultSort: "-createdAt",
  access: { read: managers, create: () => false, update: () => false, delete: () => false },
  timestamps: true,
  hooks: {
    // cost prices are owner-only everywhere else – the same here
    // older entries may still hold cost values – hide them from everyone but owners
    afterRead: [
      ({ doc, req }) => {
        if (isOwnerUser(req.user as never) || !Array.isArray(doc?.changes)) return doc;
        return { ...doc, changes: (doc.changes as Change[]).map((c) => (ownerOnly(String(doc.entity ?? ""), c.field) ? { ...c, from: "•••", to: "changed" } : c)) };
      },
    ],
  },
  fields: [
    { type: "row", fields: [
      { name: "user", type: "relationship", relationTo: "users", admin: { width: "50%" } },
      { name: "userEmail", type: "text", label: "Who", admin: { width: "50%" } },
    ] },
    { type: "row", fields: [
      { name: "action", type: "select", options: [{ label: "Created", value: "create" }, { label: "Changed", value: "update" }, { label: "Deleted", value: "delete" }], index: true, admin: { width: "33%" } },
      { name: "entity", type: "text", index: true, admin: { width: "33%", hidden: true } },
      { name: "entityLabel", type: "text", label: "Where", admin: { width: "33%" } },
      { name: "docId", type: "text", index: true, label: "Record id", admin: { width: "34%" } },
    ] },
    { name: "title", type: "text", label: "What" },
    { name: "summary", type: "textarea", label: "Changes" },
    { name: "changes", type: "json", admin: { description: "Field, old value, new value." } },
  ],
};

/* ───────────── activity hooks ───────────── */

type Change = { field: string; from: string; to: string };
type Doc = Record<string, unknown>;

/** Never logged (secrets / noise). */
const SKIP = new Set([
  "id", "createdAt", "updatedAt", "password", "hash", "salt", "twoFactor", "resetPasswordToken", "resetPasswordExpiration",
  "loginAttempts", "lockUntil", "legacyPasswordHash", "sessions", "sessionsValidAfter", "apiKey", "apiKeyIndex", "enableAPIKey",
  "stockStatus", "soldCount", "rating", "reviewCount", "sizes", "url", "thumbnailURL", "focalX", "focalY", "attemptId",
  "confirmation", "risk", "legacyId", "_verificationToken", "orders", "stockSeen",
]);
/** Logged as "changed" only (long text). */
const LONG = new Set(["description", "content", "body", "layout", "seoContent", "notes", "answer", "message"]);
const COST = new Set(["costPrice", "unitCost"]);
/** Owner-only values are never stored in the log (managers can read and search it): only "changed". */
const ownerOnly = (entity: string, field: string) => COST.has(field.split(".").pop()!) || (entity === "purchases" && /^(total|lines)\b/.test(field));

function show(v: unknown): string {
  if (v === null || v === undefined || v === "") return "—";
  if (typeof v === "number") return v.toLocaleString("en-PK");
  if (typeof v === "boolean") return v ? "yes" : "no";
  if (typeof v === "string") {
    const chars = Array.from(v);
    return chars.length > 80 ? `${chars.slice(0, 77).join("")}…` : v;
  }
  if (Array.isArray(v)) return `${v.length} item${v.length === 1 ? "" : "s"}`;
  if (typeof v === "object" && "id" in (v as Doc)) return `#${(v as Doc).id}`;
  return "…";
}
/** Linked records arrive as full objects on one side and bare ids on the other – compare them by id. */
function norm(v: unknown): unknown {
  if (Array.isArray(v)) return v.map(norm);
  if (v && typeof v === "object") {
    const o = v as Doc;
    if ("id" in o && ("createdAt" in o || "updatedAt" in o)) return o.id;
    return Object.fromEntries(Object.entries(o).filter(([k]) => k !== "createdAt" && k !== "updatedAt").map(([k, x]) => [k, norm(x)]));
  }
  return v === "" ? null : v;
}
const same = (a: unknown, b: unknown) => JSON.stringify(norm(a) ?? null) === JSON.stringify(norm(b) ?? null);

export function diff(prev: Doc | undefined, next: Doc | undefined): Change[] {
  const out: Change[] = [];
  const keys = new Set([...Object.keys(prev ?? {}), ...Object.keys(next ?? {})]);
  for (const k of keys) {
    if (SKIP.has(k) || k.startsWith("_")) continue;
    // a field missing from the saved doc wasn't readable by the person who saved it (e.g. cost) – not a change
    if (next && !(k in next)) continue;
    const a = norm(prev?.[k]);
    const b = norm(next?.[k]);
    if (same(a, b)) continue;
    // nested groups (customer, seo…): compare their fields one level down
    if (a && b && typeof a === "object" && typeof b === "object" && !Array.isArray(a) && !Array.isArray(b) && !("id" in (b as Doc))) {
      for (const c of diff(a as Doc, b as Doc)) out.push({ ...c, field: `${k}.${c.field}` });
      continue;
    }
    if (LONG.has(k)) out.push({ field: k, from: "…", to: "changed" });
    else if (Array.isArray(a) && Array.isArray(b) && a.length === b.length) out.push({ field: k, from: show(a), to: "changed" });
    else out.push({ field: k, from: show(a), to: show(b) });
    if (out.length >= 40) break;
  }
  return out;
}

const summaryOf = (changes: Change[]) =>
  changes
    .slice(0, 8)
    .map((c) => (COST.has(c.field.split(".").pop()!) ? `${c.field} changed` : `${c.field}: ${c.from} → ${c.to}`))
    .join("; ") + (changes.length > 8 ? ` (+${changes.length - 8} more)` : "");

const titleOf = (doc: Doc | undefined, id: unknown) =>
  String(doc?.orderNumber ?? doc?.receiptNumber ?? doc?.title ?? doc?.name ?? doc?.code ?? doc?.email ?? doc?.serial ?? doc?.filename ?? `#${id}`).slice(0, 160);

/** Only people working in /cms are logged (storefront checkouts, customers' own profile, system jobs are not). */
function staffActor(req: PayloadRequest) {
  const u = req.user as { id?: number; email?: string; role?: string; collection?: string } | null;
  return u && canOpenAdmin(u as never) ? u : null;
}

/**
 * Writes one log entry in the SAME transaction as the change (rolled back with it), inside a savepoint: if the
 * entry can't be written, only the entry is dropped – never the save it describes. (A failing nested Payload
 * create would roll back the whole parent transaction.)
 */
async function write(req: PayloadRequest, entry: { action: "create" | "update" | "delete"; entity: string; entityLabel: string; docId: string; title: string; changes: Change[] }) {
  const u = staffActor(req);
  if (!u || (entry.action === "update" && !entry.changes.length)) return;
  const changes = entry.changes.map((c) => (ownerOnly(entry.entity, c.field) ? { field: c.field, from: "•••", to: "changed" } : c));
  const summary = entry.action === "update" ? summaryOf(changes) : entry.action === "create" ? "created" : "deleted";
  const { conn } = await import("../stock");
  let db: Awaited<ReturnType<typeof conn>> | null = null;
  const inTx = Boolean(await req.transactionID);
  try {
    db = await conn(req.payload, req);
    if (inTx) await db.execute(sql`SAVEPOINT activity_log`);
    await db.execute(sql`
      INSERT INTO "payload"."cms_activity_log" ("user_id", "user_email", "action", "entity", "entity_label", "doc_id", "title", "summary", "changes")
      VALUES (${Number(u.id) || null}, ${u.email ?? ""}, ${entry.action}::"payload"."enum_cms_activity_log_action", ${entry.entity}, ${entry.entityLabel},
              ${entry.docId}, ${entry.title}, ${summary}, ${JSON.stringify(changes)}::jsonb)`);
    if (inTx) await db.execute(sql`RELEASE SAVEPOINT activity_log`);
  } catch (e) {
    if (inTx && db) await db.execute(sql`ROLLBACK TO SAVEPOINT activity_log`).catch(() => undefined);
    log.error("activity.write_failed", e, { entity: entry.entity, doc: entry.docId });
  }
}

/** Adds activity-log hooks to a collection (staff changes only). */
export function withActivityLog(c: CollectionConfig): CollectionConfig {
  const label = typeof c.labels?.singular === "string" ? c.labels.singular : c.slug;
  const afterChange: CollectionAfterChangeHook = async ({ doc, previousDoc, operation, req, context }) => {
    if (context?.migrating || context?.skipActivity || doc?._status === "draft") return doc;
    await write(req, { action: operation === "create" ? "create" : "update", entity: c.slug, entityLabel: label, docId: String(doc.id), title: titleOf(doc, doc.id), changes: operation === "create" ? [] : diff(previousDoc, doc) });
    return doc;
  };
  const afterDelete: CollectionAfterDeleteHook = async ({ doc, id, req }) => {
    await write(req, { action: "delete", entity: c.slug, entityLabel: label, docId: String(id), title: titleOf(doc, id), changes: [] });
    return doc;
  };
  return { ...c, hooks: { ...c.hooks, afterChange: [...(c.hooks?.afterChange ?? []), afterChange], afterDelete: [...(c.hooks?.afterDelete ?? []), afterDelete] } };
}

/** Adds activity-log hooks to a settings global. */
export function withGlobalActivityLog(g: GlobalConfig): GlobalConfig {
  const label = typeof g.label === "string" ? g.label : g.slug;
  const afterChange: GlobalAfterChangeHook = async ({ doc, previousDoc, req, context }) => {
    if (context?.migrating) return doc;
    await write(req, { action: "update", entity: g.slug, entityLabel: label, docId: g.slug, title: label, changes: diff(previousDoc, doc) });
    return doc;
  };
  return { ...g, hooks: { ...g.hooks, afterChange: [...(g.hooks?.afterChange ?? []), afterChange] } };
}

/** Collections whose staff changes are logged. */
export const LOGGED_COLLECTIONS = new Set([
  "users", "products", "categories", "brands", "laptop-models", "product-collections", "orders", "return-requests", "warranty-claims",
  "pos-sales", "cash-ups", "units", "discounts", "flash-sales", "pages", "posts", "menus", "suppliers", "purchases", "stock-counts",
  "reviews", "media", "trade-ins", "wholesale-inquiries",
]);
