import { randomInt } from "node:crypto";
import { commitTransaction, initTransaction, killTransaction, type Endpoint, type PayloadRequest, type Where } from "payload";
import { sameStoreAs, storeGate, type StoreGate } from "./guard";
import { hasStoreRole } from "../tenancy";
import { storeLocaleOf, storeMoneyOf } from "../store-locale";
import { log } from "../../lib/log";
import { roundMoney } from "../../lib/money";
import { addDays, compactDay, dayIn, dayStart } from "../../lib/time";
import type { StoreLocale } from "../../lib/locale";

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
const DAY_RE = /^\d{4}-\d{2}-\d{2}$/;
const METHODS = new Set(["cash", "card", "bank", "jazzcash", "easypaisa", "other"]);
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
    // amounts in the store's currency (whole rupees, cents …); receipt numbers by its date
    const { timezone } = await storeLocaleOf(req.payload, gate.store, req);
    const money = await storeMoneyOf(req.payload, gate.store, req);
    const lines = (body?.lines ?? []).map((l) => ({ productId: Math.trunc(num(l.productId)), unitId: l.unitId ? Math.trunc(num(l.unitId)) : undefined, qty: Math.trunc(num(l.qty)), unitPrice: money.round(num(l.unitPrice)) }));
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
        if (!manager) return bad(`Only an owner or manager can sell “${str(p.title)}” below its price (${money(num(p.price))}).`, 403);
        overrides.push(`${str(p.sku) || p.id}: ${num(p.price)} → ${l.unitPrice}`);
      }
    }

    // sums rounded to the currency too (cents add up without floating-point crumbs)
    const subtotal = money.round(lines.reduce((s, l) => s + l.qty * l.unitPrice, 0));
    const discount = Math.min(subtotal, Math.max(0, money.round(num(body?.discount))));
    if (!manager && subtotal > 0 && discount > (subtotal * STAFF_MAX_DISCOUNT_PERCENT) / 100)
      return bad(`Discounts above ${STAFF_MAX_DISCOUNT_PERCENT}% need an owner or manager.`, 403);
    const total = money.round(subtotal - discount);
    const payments = (body?.payments ?? []).filter((p) => METHODS.has(p.method) && num(p.amount) > 0).map((p) => ({ method: p.method, amount: money.round(num(p.amount)) }));
    const paid = money.round(payments.reduce((s, p) => s + p.amount, 0));
    if (paid < total) return bad(`Payment is ${money(total - paid)} short.`);
    if (paid > total && !payments.some((p) => p.method === "cash")) return bad("Only cash can be overpaid (for change).");
    const cashPart = money.round(payments.filter((p) => p.method === "cash").reduce((s, p) => s + p.amount, 0));
    const change = money.round(paid - total);
    // change comes out of the cash handed over – never more than that (card 1000 + cash 200 on a 900 sale would give
    // 300 change from 200 cash, and the drawer wouldn't add up)
    if (change > cashPart) return bad(`Change (${money(change)}) can't be more than the cash received (${money(cashPart)}) – lower the card or wallet amount.`);
    // store what was actually kept: the cash lines as ONE line (cash minus change, taken off once), the rest as paid
    const keptCash = money.round(cashPart - change);
    const kept = [...payments.filter((p) => p.method !== "cash"), ...(keptCash > 0 ? [{ method: "cash", amount: keptCash }] : [])];

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
        const candidate = `POS-${compactDay(timezone)}-${randomInt(100000, 1000000)}`;
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
          currency: money.currency,
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
    const { revalidate, catalogTagOf } = await import("../revalidate");
    // stock only: refreshed in the background
    revalidate([catalogTagOf(gate.store)], [], false, { soft: true });
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
    // "today" in the store's time zone
    const { timezone } = await storeLocaleOf(req.payload, gate.store, req);
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
      const saleDay = dayIn(Date.parse(str(s.createdAt)), timezone);
      if (saleDay !== dayIn(Date.now(), timezone)) {
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
    const { revalidate, catalogTagOf } = await import("../revalidate");
    revalidate([catalogTagOf(gate.store)]);
    log.info("pos.void", { receipt: s.receiptNumber, by: (req.user as { id: number }).id, reason });
    const v = updated as Doc;
    return Response.json({ sale: { id: v.id, receiptNumber: v.receiptNumber, status: v.status } });
  },
};

/** A store-local day's counter takings (`loc` = the store's: its time zone and currency). */
async function dayTotals(req: PayloadRequest, day: string, gate: StoreGate, loc: StoreLocale) {
  const start = dayStart(day, loc.timezone);
  // a day is 23 or 25 hours long when the clocks change
  const end = dayStart(addDays(day, 1), loc.timezone);
  const res = await req.payload.find({
    collection: "pos-sales",
    where: { and: [{ createdAt: { greater_than_equal: new Date(start).toISOString() } }, { createdAt: { less_than: new Date(end).toISOString() } }, ...gate.inStore] },
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
    where: { and: [{ status: { equals: "refunded" } }, { refundMethod: { equals: "cash" } }, { creditNoteDate: { greater_than_equal: new Date(start).toISOString() } }, { creditNoteDate: { less_than: new Date(end).toISOString() } }, ...gate.inStore] },
    limit: 0,
    pagination: false,
    depth: 0,
    overrideAccess: true,
  });
  const round = (n: number) => roundMoney(n, loc.currency);
  for (const m of Object.keys(byMethod)) byMethod[m] = round(byMethod[m]);
  const cashRefunds = round((refunds.docs as unknown as Doc[]).reduce((s, r) => s + num(r.refundAmount), 0));
  return { day, count, voided, total: round(total), byMethod, cashRefunds, cash: round((byMethod.cash ?? 0) - cashRefunds) };
}

const cashupGet: Endpoint = {
  path: "/pos/cashup",
  method: "get",
  handler: async (req) => {
    const gate = await storeGate(req, "store_staff", { feature: "pos" });
    if (gate instanceof Response) return gate;
    const loc = await storeLocaleOf(req.payload, gate.store, req);
    const d = new URL(req.url ?? "", "http://x").searchParams.get("day") ?? "";
    const day = DAY_RE.test(d) ? d : dayIn(Date.now(), loc.timezone);
    const [totals, existing] = await Promise.all([dayTotals(req, day, gate, loc), req.payload.find({ collection: "cash-ups", where: { and: [{ day: { equals: day } }, ...gate.inStore] }, limit: 5, sort: "-createdAt", depth: 1, overrideAccess: true })]);
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
    const loc = await storeLocaleOf(req.payload, gate.store, req);
    const money = await storeMoneyOf(req.payload, gate.store, req);
    const day = DAY_RE.test(str(body?.day)) ? str(body?.day) : dayIn(Date.now(), loc.timezone);
    if (body?.countedCash == null || num(body.countedCash) < 0) return bad("Enter the cash you counted.");
    const totals = await dayTotals(req, day, gate, loc);
    const opening = Math.max(0, money.round(num(body?.openingFloat)));
    const expectedCash = money.round(opening + totals.cash);
    const countedCash = money.round(num(body.countedCash));
    const doc = await req.payload.create({
      collection: "cash-ups",
      overrideAccess: true,
      data: { store: gate.store, day, openingFloat: opening, expectedCash, countedCash, difference: money.round(countedCash - expectedCash), byMethod: totals.byMethod, salesCount: totals.count, notes: str(body?.notes).slice(0, 1000) || null, closedBy: (req.user as { id: number }).id } as never,
    });
    log.info("pos.cashup", { day, expectedCash, countedCash, by: (req.user as { id: number }).id });
    return Response.json({ cashUp: doc });
  },
};

export const posEndpoints: Endpoint[] = [lookup, sale, voidSale, cashupGet, cashupPost];
