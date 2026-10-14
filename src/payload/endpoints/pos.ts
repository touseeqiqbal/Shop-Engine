import { randomInt } from "node:crypto";
import { commitTransaction, initTransaction, killTransaction, type Endpoint, type PayloadRequest, type Where } from "payload";
import { sameStoreAs, storeGate, type StoreGate } from "./guard";
import { hasStoreRole } from "../tenancy";
import { log } from "../../lib/log";

/**
 * Shop counter (POS) API – the store's team, always for the store being worked in.
 *   GET  /cms-api/pos/lookup?q=…     search products by name / SKU / model, or an exact serial number or SKU (barcode scan)
 *   POST /cms-api/pos/sale           complete a sale: takes stock atomically (all lines or none), saves the receipt
 *   POST /cms-api/pos/void           void a sale (managers): puts the stock back
 *   GET  /cms-api/pos/cashup?day=…   today's shop takings by payment method
 *   POST /cms-api/pos/cashup         save the end-of-day drawer count
 */

type Doc = Record<string, unknown>;
const num = (v: unknown) => (typeof v === "number" && Number.isFinite(v) ? v : Number(v) || 0);
const str = (v: unknown) => (typeof v === "string" ? v : "");
const PKT = 5 * 3600e3;
const pktDay = (t: number) => new Date(t + PKT).toISOString().slice(0, 10);
const pktStart = (day: string) => Date.parse(`${day}T00:00:00Z`) - PKT;
const METHODS = new Set(["cash", "card", "bank", "jazzcash", "easypaisa"]);
const bad = (message: string, status = 400) => Response.json({ error: message }, { status });
/** Staff may give up to this much discount on a sale; lower prices or bigger discounts need an owner or manager. */
const STAFF_MAX_DISCOUNT_PERCENT = 10;

function thumb(p: Doc) {
  const img = Array.isArray(p.images) ? (p.images[0] as Doc | undefined) : undefined;
  if (!img || typeof img !== "object") return "";
  return str((img.sizes as Doc | undefined)?.thumbnail && ((img.sizes as Doc).thumbnail as Doc).url) || str(img.url);
}

async function productCard(req: PayloadRequest, p: Doc, gate: StoreGate) {
  const units = p.trackUnits
    ? (
        await req.payload.find({ collection: "units", where: { and: [{ product: { equals: p.id } }, { status: { equals: "in-stock" } }, ...gate.inStore] }, limit: 50, depth: 0, sort: "receivedAt", overrideAccess: true })
      ).docs.map((u) => ({ id: (u as unknown as Doc).id, serial: str((u as unknown as Doc).serial), notes: str((u as unknown as Doc).conditionNotes) }))
    : [];
  return { id: p.id, title: str(p.title), sku: str(p.sku), price: num(p.price), stock: num(p.stock), trackUnits: Boolean(p.trackUnits), image: thumb(p), units };
}

const lookup: Endpoint = {
  path: "/pos/lookup",
  method: "get",
  handler: async (req) => {
    const gate = await storeGate(req, "store_staff", { feature: "pos" });
    if (gate instanceof Response) return gate;
    const q = (new URL(req.url ?? "", "http://x").searchParams.get("q") ?? "").trim();
    if (q.length < 2) return Response.json({ exact: null, products: [] });

    // A scanned serial number or SKU → add straight to the sale
    const unit = (await req.payload.find({ collection: "units", where: { and: [{ serial: { equals: q } }, ...gate.inStore] }, limit: 1, depth: 2, overrideAccess: true })).docs[0] as unknown as Doc | undefined;
    if (unit) {
      const p = unit.product as Doc;
      if (str(unit.status) !== "in-stock") return Response.json({ exact: null, products: [], message: `Serial ${q} is not in stock (it is ${str(unit.status).replace("-", " ")}).` });
      return Response.json({ exact: { kind: "unit", unit: { id: unit.id, serial: str(unit.serial) }, product: await productCard(req, p, gate) }, products: [] });
    }
    const where: Where = {
      and: [{ status: { not_equals: "archived" } }, { or: [{ title: { like: q } }, { sku: { like: q } }, { barcode: { equals: q } }, { model: { like: q } }] }, ...gate.inStore],
    };
    const found = (await req.payload.find({ collection: "products", where, limit: 12, depth: 1, overrideAccess: true, sort: "-stock" })).docs as unknown as Doc[];
    // a scanned barcode or a typed SKU picks the product straight away
    const bySku = found.find((p) => str(p.sku).toLowerCase() === q.toLowerCase() || (str(p.barcode) !== "" && str(p.barcode) === q));
    const products = await Promise.all(found.map((p) => productCard(req, p, gate)));
    return Response.json({ exact: bySku && !bySku.trackUnits ? { kind: "product", product: products.find((p) => p.id === bySku.id) } : null, products });
  },
};

type SaleLine = { productId: number; unitId?: number; qty: number; unitPrice: number };

const sale: Endpoint = {
  path: "/pos/sale",
  method: "post",
  handler: async (req) => {
    const gate = await storeGate(req, "store_staff", { write: true, feature: "pos" });
    if (gate instanceof Response) return gate;
    const body = (await req.json?.().catch(() => null)) as {
      clientSaleId?: string;
      lines?: SaleLine[];
      discount?: number;
      payments?: { method: string; amount: number }[];
      cashReceived?: number;
      customerName?: string;
      customerPhone?: string;
      notes?: string;
    } | null;
    const lines = (body?.lines ?? []).map((l) => ({ productId: Math.trunc(num(l.productId)), unitId: l.unitId ? Math.trunc(num(l.unitId)) : undefined, qty: Math.trunc(num(l.qty)), unitPrice: Math.round(num(l.unitPrice)) }));
    if (!lines.length) return bad("The sale is empty.");
    if (lines.some((l) => l.productId <= 0 || l.qty <= 0 || l.qty > 100 || l.unitPrice < 0 || (l.unitId && l.qty !== 1))) return bad("Check the quantities and prices.");
    const unitIds = lines.filter((l) => l.unitId).map((l) => l.unitId!);
    if (new Set(unitIds).size !== unitIds.length) return bad("The same serial number is in the sale twice.");

    const { payload } = req;
    // the same press of "Complete sale" sent again (double click, retry after a timeout): the first sale, not a second one
    const clientSaleId = /^[A-Za-z0-9_-]{8,64}$/.test(str(body?.clientSaleId)) ? str(body?.clientSaleId) : null;
    const already = async () =>
      clientSaleId ? ((await payload.find({ collection: "pos-sales", where: { and: [{ clientSaleId: { equals: clientSaleId } }, ...gate.inStore] }, limit: 1, depth: 0, overrideAccess: true })).docs[0] as unknown as Doc | undefined) : undefined;
    const earlier = await already();
    if (earlier) return Response.json({ sale: earlier, repeated: true });

    // only this store's products
    const products = new Map(
      ((await payload.find({ collection: "products", where: { and: [{ id: { in: [...new Set(lines.map((l) => l.productId))] } }, ...gate.inStore] }, limit: 200, depth: 0, overrideAccess: true })).docs as unknown as Doc[]).map((p) => [Number(p.id), p])
    );
    const manager = hasStoreRole(gate.t, gate.store, "store_manager");
    const overrides: string[] = [];
    for (const l of lines) {
      const p = products.get(l.productId);
      if (!p) return bad("A product in the sale no longer exists.");
      if (p.trackUnits && !l.unitId) return bad(`Scan or pick the serial number for “${str(p.title)}”.`);
      if (l.unitPrice < num(p.price)) {
        if (!manager) return bad(`Only an owner or manager can sell “${str(p.title)}” below its price (Rs ${num(p.price).toLocaleString("en-PK")}).`, 403);
        overrides.push(`${str(p.sku) || p.id}: ${num(p.price)} → ${l.unitPrice}`);
      }
    }

    const subtotal = lines.reduce((s, l) => s + l.qty * l.unitPrice, 0);
    const discount = Math.min(subtotal, Math.max(0, Math.round(num(body?.discount))));
    if (!manager && subtotal > 0 && discount > (subtotal * STAFF_MAX_DISCOUNT_PERCENT) / 100)
      return bad(`Discounts above ${STAFF_MAX_DISCOUNT_PERCENT}% need an owner or manager.`, 403);
    const total = subtotal - discount;
    const payments = (body?.payments ?? []).filter((p) => METHODS.has(p.method) && num(p.amount) > 0).map((p) => ({ method: p.method, amount: Math.round(num(p.amount)) }));
    const paid = payments.reduce((s, p) => s + p.amount, 0);
    if (paid < total) return bad(`Payment is Rs ${(total - paid).toLocaleString("en-PK")} short.`);
    if (paid > total && !payments.some((p) => p.method === "cash")) return bad("Only cash can be overpaid (for change).");
    const cashPart = payments.filter((p) => p.method === "cash").reduce((s, p) => s + p.amount, 0);
    const change = paid - total;
    // store what was actually kept: cash minus change
    const kept = payments.map((p) => (p.method === "cash" ? { ...p, amount: p.amount - change } : p)).filter((p) => p.amount > 0);

    // Stock, serial numbers and the receipt in ONE transaction – all or nothing (also after a crash)
    const { takeStock, sellUnit, linkUnitsToSale, setStockLog, lockProducts } = await import("../stock");
    await initTransaction(req);
    const fail = async (message: string, status = 400) => {
      await killTransaction(req);
      return bad(message, status);
    };
    let saved: Doc | null = null;
    try {
      let receiptNumber = "";
      for (let attempt = 0; attempt < 5 && !receiptNumber; attempt++) {
        const candidate = `POS-${pktDay(Date.now()).slice(2).replace(/-/g, "")}-${randomInt(100000, 1000000)}`;
        const taken = await payload.count({ collection: "pos-sales", where: { receiptNumber: { equals: candidate } }, overrideAccess: true, req });
        if (!taken.totalDocs) receiptNumber = candidate;
      }
      if (!receiptNumber) return fail("The sale could not be saved. Nothing was taken from stock – please try again.", 500);
      const units = unitIds.length ? new Map(((await payload.find({ collection: "units", where: { and: [{ id: { in: unitIds } }, ...gate.inStore] }, limit: 200, depth: 0, overrideAccess: true, req })).docs as unknown as Doc[]).map((u) => [Number(u.id), str(u.serial)])) : new Map<number, string>();
      if (unitIds.some((id) => !units.has(id))) return fail("A serial number in the sale isn't in this store.");
      // every product locked in id order first: two counters selling the same items can't deadlock
      await lockProducts(payload, lines.map((l) => l.productId), req);
      for (const l of [...lines].sort((a, b) => a.productId - b.productId)) {
        const p = products.get(l.productId)!;
        // stock history: the receipt number, and the laptop's serial number for serial-tracked items
        setStockLog(req, { reason: "pos-sale", ref: receiptNumber, serial: l.unitId ? units.get(l.unitId) : undefined });
        if (l.unitId) {
          const ok = await sellUnit(payload, l.unitId, null, req);
          if (ok === null || ok !== l.productId) return fail(`That serial number of “${str(p.title)}” was just sold or isn't in stock.`, 409);
        } else if ((await takeStock(payload, l.productId, l.qty, req)) === null) return fail(`Not enough “${str(p.title)}” in stock.`, 409);
      }

      saved = (await payload.create({
        collection: "pos-sales",
        overrideAccess: true,
        depth: 0,
        req,
        data: {
          store: gate.store,
          clientSaleId,
          receiptNumber,
          status: "completed",
          items: lines.map((l) => ({ product: l.productId, title: str(products.get(l.productId)?.title), unit: l.unitId ?? null, serial: l.unitId ? units.get(l.unitId) ?? "" : "", qty: l.qty, unitPrice: l.unitPrice })),
          subtotal,
          discount,
          total,
          payments: kept,
          cashReceived: cashPart || null,
          change: change || null,
          customerName: str(body?.customerName).slice(0, 120) || null,
          customerPhone: str(body?.customerPhone).slice(0, 30) || null,
          notes: str(body?.notes).slice(0, 1000) || null,
          cashier: (req.user as { id: number }).id,
        } as never,
      })) as unknown as Doc;
      await linkUnitsToSale(payload, unitIds, Number(saved.id), req);
      await commitTransaction(req);
    } catch (e) {
      await killTransaction(req);
      // a second identical press that raced the first: answer with the first sale
      const first = await already().catch(() => undefined);
      if (first) return Response.json({ sale: first, repeated: true });
      log.error("pos.saving_sale_failed", e);
      return bad("The sale could not be saved. Nothing was taken from stock – please try again.", 500);
    }
    if (overrides.length) log.warn("pos.price_override", { receipt: saved.receiptNumber, by: (req.user as { id: number }).id, lines: overrides });
    const { revalidate, CATALOG_TAG } = await import("../revalidate");
    revalidate([CATALOG_TAG]);
    log.info("pos.sale", { receipt: saved.receiptNumber, total, lines: lines.length, cashier: (req.user as { id: number }).id });
    return Response.json({ sale: saved });
  },
};

const voidSale: Endpoint = {
  path: "/pos/void",
  method: "post",
  handler: async (req) => {
    const gate = await storeGate(req, "store_manager", { write: true, feature: "pos" });
    if (gate instanceof Response) return gate.status === 403 ? bad("Only an owner or manager can void a sale.", 403) : gate;
    const body = (await req.json?.().catch(() => null)) as { saleId?: number; reason?: string } | null;
    const reason = str(body?.reason).trim();
    if (!reason) return bad("Say why the sale is being voided.");
    const { putBackStock, unsellUnit, lockRowStatus, setStockLog } = await import("../stock");
    await initTransaction(req);
    let s: Doc | null = null;
    let updated: unknown;
    try {
      // lock the sale: two clicks (or two managers) can't both put the stock back
      const status = await lockRowStatus(req.payload, "cms_pos_sales", num(body?.saleId), req);
      if (status === null) {
        await killTransaction(req);
        return bad("Sale not found.", 404);
      }
      if (status === "voided") {
        await killTransaction(req);
        return bad("This sale is already voided.");
      }
      s = (await req.payload.findByID({ collection: "pos-sales", id: num(body?.saleId), depth: 0, overrideAccess: true, req })) as unknown as Doc;
      if (!sameStoreAs(gate, s)) {
        await killTransaction(req);
        return bad("Sale not found.", 404);
      }
      // only today's sales; a closed (cashed-up) day can't change; a sale with a return is settled in Returns
      const saleDay = pktDay(Date.parse(str(s.createdAt)));
      if (saleDay !== pktDay(Date.now())) {
        await killTransaction(req);
        return bad("Only today's sales can be voided. For an older sale, record a return / refund instead.");
      }
      const closed = await req.payload.count({ collection: "cash-ups", where: { and: [{ day: { equals: saleDay } }, ...gate.inStore] }, overrideAccess: true, req });
      if (closed.totalDocs) {
        await killTransaction(req);
        return bad(`${saleDay} is already cashed up – voiding now would change a closed day. Record a return / refund instead.`);
      }
      const returned = await req.payload.count({ collection: "return-requests", where: { and: [{ orderNumber: { equals: str(s.receiptNumber) } }, ...gate.inStore] }, overrideAccess: true, req });
      if (returned.totalDocs) {
        await killTransaction(req);
        return bad("This sale already has a return – settle it in Returns (refund / restock) instead of voiding.");
      }
      setStockLog(req, { reason: "pos-void", ref: str(s.receiptNumber), note: reason.slice(0, 120) });
      for (const i of (Array.isArray(s.items) ? s.items : []) as unknown as Doc[]) {
        const unit = i.unit && typeof i.unit === "object" ? (i.unit as Doc).id : i.unit;
        if (unit) await unsellUnit(req.payload, num(unit), req);
        else if (i.product) await putBackStock(req.payload, num(typeof i.product === "object" ? (i.product as Doc).id : i.product), num(i.qty), req);
      }
      updated = await req.payload.update({ collection: "pos-sales", id: num(s.id), data: { status: "voided", voidReason: reason.slice(0, 300) } as never, overrideAccess: true, depth: 0, req, context: { system: true } });
      await commitTransaction(req);
    } catch (e) {
      await killTransaction(req);
      log.error("pos.void_failed", e);
      return bad("The sale could not be voided – nothing was changed. Please try again.", 500);
    }
    const { revalidate, CATALOG_TAG } = await import("../revalidate");
    revalidate([CATALOG_TAG]);
    log.info("pos.void", { receipt: s.receiptNumber, by: (req.user as { id: number }).id, reason });
    const v = updated as Doc;
    return Response.json({ sale: { id: v.id, receiptNumber: v.receiptNumber, status: v.status } });
  },
};

async function dayTotals(req: PayloadRequest, day: string, gate: StoreGate) {
  const start = pktStart(day);
  const res = await req.payload.find({
    collection: "pos-sales",
    where: { and: [{ createdAt: { greater_than_equal: new Date(start).toISOString() } }, { createdAt: { less_than: new Date(start + 864e5).toISOString() } }, ...gate.inStore] },
    limit: 0,
    pagination: false,
    depth: 0,
    overrideAccess: true,
  });
  const byMethod: Record<string, number> = {};
  let total = 0;
  let count = 0;
  let voided = 0;
  for (const s of res.docs as unknown as Doc[]) {
    if (s.status === "voided") {
      voided++;
      continue;
    }
    count++;
    total += num(s.total);
    for (const p of (Array.isArray(s.payments) ? s.payments : []) as unknown as Doc[]) byMethod[str(p.method)] = (byMethod[str(p.method)] ?? 0) + num(p.amount);
  }
  // cash refunds paid out of the drawer that day (returns refunded in cash) come off the expected cash
  const refunds = await req.payload.find({
    collection: "return-requests",
    where: { and: [{ status: { equals: "refunded" } }, { refundMethod: { equals: "cash" } }, { creditNoteDate: { greater_than_equal: new Date(start).toISOString() } }, { creditNoteDate: { less_than: new Date(start + 864e5).toISOString() } }, ...gate.inStore] },
    limit: 0,
    pagination: false,
    depth: 0,
    overrideAccess: true,
  });
  const cashRefunds = (refunds.docs as unknown as Doc[]).reduce((s, r) => s + num(r.refundAmount), 0);
  return { day, count, voided, total, byMethod, cashRefunds, cash: (byMethod.cash ?? 0) - cashRefunds };
}

const cashupGet: Endpoint = {
  path: "/pos/cashup",
  method: "get",
  handler: async (req) => {
    const gate = await storeGate(req, "store_staff", { feature: "pos" });
    if (gate instanceof Response) return gate;
    const d = new URL(req.url ?? "", "http://x").searchParams.get("day") ?? "";
    const day = /^\d{4}-\d{2}-\d{2}$/.test(d) ? d : pktDay(Date.now());
    const [totals, existing] = await Promise.all([dayTotals(req, day, gate), req.payload.find({ collection: "cash-ups", where: { and: [{ day: { equals: day } }, ...gate.inStore] }, limit: 5, sort: "-createdAt", depth: 1, overrideAccess: true })]);
    return Response.json({ ...totals, cashUps: existing.docs });
  },
};

const cashupPost: Endpoint = {
  path: "/pos/cashup",
  method: "post",
  handler: async (req) => {
    const gate = await storeGate(req, "store_staff", { write: true, feature: "pos" });
    if (gate instanceof Response) return gate;
    const body = (await req.json?.().catch(() => null)) as { day?: string; openingFloat?: number; countedCash?: number; notes?: string } | null;
    const day = /^\d{4}-\d{2}-\d{2}$/.test(str(body?.day)) ? str(body?.day) : pktDay(Date.now());
    if (body?.countedCash == null || num(body.countedCash) < 0) return bad("Enter the cash you counted.");
    const totals = await dayTotals(req, day, gate);
    const opening = Math.max(0, Math.round(num(body?.openingFloat)));
    const expectedCash = opening + totals.cash;
    const countedCash = Math.round(num(body.countedCash));
    const doc = await req.payload.create({
      collection: "cash-ups",
      overrideAccess: true,
      data: { store: gate.store, day, openingFloat: opening, expectedCash, countedCash, difference: countedCash - expectedCash, byMethod: totals.byMethod, salesCount: totals.count, notes: str(body?.notes).slice(0, 1000) || null, closedBy: (req.user as { id: number }).id } as never,
    });
    log.info("pos.cashup", { day, expectedCash, countedCash, by: (req.user as { id: number }).id });
    return Response.json({ cashUp: doc });
  },
};

export const posEndpoints: Endpoint[] = [lookup, sale, voidSale, cashupGet, cashupPost];
