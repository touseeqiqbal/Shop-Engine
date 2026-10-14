import type { CollectionSlug, Endpoint, PayloadRequest, Where } from "payload";
import { getTenant } from "../tenancy";
import { logActivity } from "../collections/history";
import { log } from "../../lib/log";

/**
 * Customer data requests (platform admins – a customer's account and records span every store they shopped at).
 *   GET  /cms-api/privacy/find?q=<phone or email>     what we hold about this person
 *   GET  /cms-api/privacy/export?q=…                  everything, as a JSON download
 *   POST /cms-api/privacy/erase { q, confirm: "DELETE" }
 * Erasing deletes the customer account, messages, wholesale enquiries, trade-in offers, questions, stock / price alerts,
 * saved carts and private photos / payment screenshots, and removes personal details from orders, returns, warranty
 * claims and shop sales – the money and items stay for the accounts ("Deleted customer").
 * Kept on purpose: the blocked-numbers list (fraud prevention). Accounts that run a store (store team members) are
 * never erased here – they have to leave their stores first.
 * Every request is written to the Activity log.
 */

type Doc = Record<string, unknown>;
const str = (v: unknown) => (typeof v === "string" ? v : "");

function matchers(q: string) {
  const email = q.includes("@") ? q.trim().toLowerCase() : null;
  const d = q.replace(/\D/g, "").replace(/^92/, "0");
  const phones = !email && d.length >= 10 ? [d, `${d.slice(0, 4)}-${d.slice(4)}`, `+92${d.slice(1)}`, `92${d.slice(1)}`] : [];
  return { email, phones };
}

const or = (conds: Where[]): Where | null => (conds.length ? { or: conds } : null);

async function gather(req: PayloadRequest, q: string) {
  const { email, phones } = matchers(q);
  if (!email && !phones.length) return null;
  const by = (phoneField: string | null, emailField: string | null) =>
    or([...(phoneField ? phones.map((p) => ({ [phoneField]: { equals: p } })) : []), ...(emailField && email ? [{ [emailField]: { equals: email } }] : [])]);
  const find = async (collection: CollectionSlug, where: Where | null) =>
    where ? ((await req.payload.find({ collection, where, limit: 500, pagination: false, depth: 0, overrideAccess: true, req })).docs as unknown as Doc[]) : [];

  const accounts = (await find("users", by("phone", "email"))).filter((u) => u.role === "customer");
  // people on a store's team are kept (erasing them would lock a store out)
  const team = new Set(
    accounts.length
      ? ((await req.payload.find({ collection: "store-memberships", where: { and: [{ user: { in: accounts.map((u) => u.id) } }, { status: { in: ["active", "invited"] } }] }, limit: 500, depth: 0, overrideAccess: true, req })).docs as unknown as Doc[]).map((m) => String(m.user))
      : [],
  );
  const users = accounts.filter((u) => !team.has(String(u.id)));
  const keptTeamAccounts = accounts.length - users.length;
  const userIds = users.map((u) => u.id);
  const orderWhere = or([...(by("customer.phone", "customer.email") ? [by("customer.phone", "customer.email")!] : []), ...(userIds.length ? [{ user: { in: userIds } }] : [])]);
  const contact = or([...phones.map((p) => ({ contact: { equals: p } })), ...(email ? [{ contact: { equals: email } }] : [])]);
  const [orders, returns, claims, messages, wholesale, sales, blocked, tradeIns, questions, alerts, carts] = await Promise.all([
    find("orders", orderWhere),
    find("return-requests", by("customerPhone", null)),
    find("warranty-claims", by("customerPhone", null)),
    find("contact-messages", by("phone", "email")),
    find("wholesale-inquiries", by("phone", "email")),
    find("pos-sales", by("customerPhone", null)),
    find("blocked-phones", by("phone", null)),
    find("trade-ins", by("phone", null)),
    find("product-questions", by(null, "email")),
    find("stock-alerts", contact),
    find("abandoned-carts", or([...(contact ? [contact] : []), ...(by("phone", "email") ? [by("phone", "email")!] : [])])),
  ]);
  return { users, keptTeamAccounts, orders, returns, claims, messages, wholesale, sales, blocked, tradeIns, questions, alerts, carts };
}

const deny = () => Response.json({ error: "Customer data requests are handled by ShopEngine platform admins." }, { status: 403 });
const allowed = async (req: PayloadRequest) => Boolean(req.user) && (await getTenant(req)).platformAdmin;
const audit = (req: PayloadRequest, action: "find" | "export" | "erase", q: string, summary: Record<string, number>) =>
  logActivity(req, {
    action: action === "erase" ? "delete" : "update",
    entity: "privacy",
    entityLabel: "Customer data request",
    docId: action,
    title: `${action}: ${q.includes("@") ? q.replace(/^(.).*(@.*)$/, "$1…$2") : `…${q.replace(/\D/g, "").slice(-4)}`}`,
    changes: Object.entries(summary).map(([field, n]) => ({ field, from: "", to: String(n) })),
    storeId: null,
  });
const query = (req: PayloadRequest) => (new URL(req.url ?? "", "http://x").searchParams.get("q") ?? "").trim();

const find: Endpoint = {
  path: "/privacy/find",
  method: "get",
  handler: async (req) => {
    if (!(await allowed(req))) return deny();
    const data = await gather(req, query(req));
    if (!data) return Response.json({ error: "Type a full phone number or email." }, { status: 400 });
    await audit(req, "find", query(req), { accounts: data.users.length, orders: data.orders.length });
    return Response.json({
      accounts: data.users.map((u) => ({ id: u.id, name: str(u.name), email: str(u.email) })),
      counts: {
        orders: data.orders.length,
        returns: data.returns.length,
        warrantyClaims: data.claims.length,
        messages: data.messages.length,
        wholesale: data.wholesale.length,
        shopSales: data.sales.length,
        blockedList: data.blocked.length,
        tradeIns: data.tradeIns.length,
        questions: data.questions.length,
        alerts: data.alerts.length,
        savedCarts: data.carts.length,
        storeTeamAccountsKept: data.keptTeamAccounts,
      },
      names: [...new Set([...data.orders.map((o) => str((o.customer as Doc)?.name)), ...data.users.map((u) => str(u.name))].filter(Boolean))].slice(0, 5),
    });
  },
};

const exportData: Endpoint = {
  path: "/privacy/export",
  method: "get",
  handler: async (req) => {
    if (!(await allowed(req))) return deny();
    const q = query(req);
    const data = await gather(req, q);
    if (!data) return Response.json({ error: "Type a full phone number or email." }, { status: 400 });
    const clean = (u: Doc) => {
      const { twoFactor: _t, legacyPasswordHash: _l, sessions: _s, salt: _sa, hash: _h, ...rest } = u;
      return rest;
    };
    const body = JSON.stringify(
      {
        exportedAt: new Date().toISOString(),
        request: q,
        note: "All personal data ShopEngine stores hold for this phone / email.",
        accounts: data.users.map(clean),
        orders: data.orders,
        returns: data.returns,
        warrantyClaims: data.claims,
        messages: data.messages,
        wholesaleEnquiries: data.wholesale,
        shopSales: data.sales,
        tradeIns: data.tradeIns,
        questions: data.questions,
        alerts: data.alerts,
        savedCarts: data.carts,
      },
      null,
      2
    );
    log.info("privacy.export", { by: (req.user as { id: number }).id, records: data.orders.length + data.users.length });
    await audit(req, "export", q, { accounts: data.users.length, orders: data.orders.length });
    return new Response(body, {
      headers: { "Content-Type": "application/json; charset=utf-8", "Content-Disposition": `attachment; filename="customer-data-${new Date().toISOString().slice(0, 10)}.json"`, "Cache-Control": "no-store" },
    });
  },
};

const erase: Endpoint = {
  path: "/privacy/erase",
  method: "post",
  handler: async (req) => {
    if (!(await allowed(req))) return deny();
    const body = (await req.json?.().catch(() => null)) as { q?: string; confirm?: string } | null;
    if (body?.confirm !== "DELETE") return Response.json({ error: 'Type DELETE to confirm.' }, { status: 400 });
    const data = await gather(req, String(body.q ?? ""));
    if (!data) return Response.json({ error: "Type a full phone number or email." }, { status: 400 });
    const { deleteObject } = await import("../../lib/storage");
    const p = req.payload;
    const ctx = { skipNotify: true, skipStock: true, migrating: true };
    const files: string[] = [];

    for (const o of data.orders) {
      if (str(o.paymentScreenshotKey).startsWith("payments/")) files.push(str(o.paymentScreenshotKey));
      await p.update({
        collection: "orders",
        id: Number(o.id),
        overrideAccess: true,
        context: ctx,
        data: { customer: { name: "Deleted customer", phone: "0000-0000000", email: null, city: str((o.customer as Doc)?.city) || "—", address: "—", landmark: null }, notes: null, user: null, paymentScreenshotKey: null } as never,
      });
    }
    for (const [collection, list] of [["return-requests", data.returns], ["warranty-claims", data.claims]] as const) {
      for (const r of list) {
        files.push(...((Array.isArray(r.photoKeys) ? r.photoKeys : []) as string[]));
        await p.update({ collection, id: Number(r.id), overrideAccess: true, data: { customerName: "Deleted customer", customerPhone: "0000-0000000", photoKeys: [], details: null } as never });
      }
    }
    for (const s of data.sales) await p.update({ collection: "pos-sales", id: Number(s.id), overrideAccess: true, data: { customerName: null, customerPhone: null } as never });
    for (const m of data.messages) await p.delete({ collection: "contact-messages", id: Number(m.id), overrideAccess: true });
    for (const w of data.wholesale) await p.delete({ collection: "wholesale-inquiries", id: Number(w.id), overrideAccess: true });
    for (const [collection, list] of [["trade-ins", data.tradeIns], ["product-questions", data.questions], ["stock-alerts", data.alerts], ["abandoned-carts", data.carts]] as const)
      for (const d of list) await p.delete({ collection, id: Number(d.id), overrideAccess: true });
    for (const u of data.users) await p.delete({ collection: "users", id: Number(u.id), overrideAccess: true });
    let filesDeleted = 0;
    for (const key of files) {
      try {
        await deleteObject(key);
        filesDeleted++;
      } catch (e) {
        log.error("privacy.file_delete_failed", e);
      }
    }
    const summary = {
      accounts: data.users.length,
      orders: data.orders.length,
      returns: data.returns.length,
      warrantyClaims: data.claims.length,
      messages: data.messages.length,
      wholesale: data.wholesale.length,
      shopSales: data.sales.length,
      tradeIns: data.tradeIns.length,
      questions: data.questions.length,
      alerts: data.alerts.length,
      savedCarts: data.carts.length,
      files: filesDeleted,
      storeTeamAccountsKept: data.keptTeamAccounts,
    };
    log.warn("privacy.erased", { by: (req.user as { id: number }).id, ...summary });
    await audit(req, "erase", String(body.q ?? ""), summary);
    return Response.json({ ok: true, ...summary });
  },
};

export const privacyEndpoints: Endpoint[] = [find, exportData, erase];
