import { commitTransaction, initTransaction, killTransaction, type Endpoint, type PayloadRequest, type Where } from "payload";
import { isManagerUser, isOwnerUser, isStaffUser } from "../access";
import { log } from "../../lib/log";

/**
 * Stock counts (staff; correcting stock needs a manager).
 *   POST /cms-api/stock-count/start   { name, categoryId? }   snapshot of what the system thinks is on the shelf
 *   POST /cms-api/stock-count/scan    { id, code, qty? }       barcode (SKU or serial) → +1 counted
 *   POST /cms-api/stock-count/set     { id, productId, counted }
 *   POST /cms-api/stock-count/finish  { id, apply, zeroUncounted? }  variance report; apply = correct stock (managers)
 * Correcting only touches products that were actually counted (scanned or typed), unless zeroUncounted is set –
 * so a partial count can never wipe the stock of shelves nobody looked at.
 */

type Doc = Record<string, unknown>;
export type CountLine = {
  productId: number;
  title: string;
  sku: string;
  tracked: boolean;
  expected: number;
  counted: number;
  unitCost: number;
  expectedSerials: string[];
  scannedSerials: string[];
  /** scanned or typed at least once */
  touched?: boolean;
};

const bad = (error: string, status = 400) => Response.json({ error }, { status });
const body = async (req: PayloadRequest) => ((await req.json?.().catch(() => null)) ?? {}) as Doc;
const getCount = async (req: PayloadRequest, id: unknown) => (await req.payload.findByID({ collection: "stock-counts", id: Number(id), depth: 0, overrideAccess: true, req, context: { keepCost: true } }).catch(() => null)) as unknown as Doc | null;
const save = (req: PayloadRequest, id: number, data: Doc) => req.payload.update({ collection: "stock-counts", id, data: data as never, overrideAccess: true, depth: 0, req, context: { keepCost: true } });
/** Cost prices only for the owner. */
const shown = (req: PayloadRequest, line: CountLine | undefined) => (line && !isOwnerUser(req.user as never) ? { ...line, unitCost: 0 } : line);

/**
 * Runs one change to a count while holding a lock on it, so two people scanning at the same moment don't
 * overwrite each other's counts.
 */
async function withCountLock(req: PayloadRequest, id: unknown, work: (c: Doc) => Promise<Response>): Promise<Response> {
  const { lockRowStatus } = await import("../stock");
  await initTransaction(req);
  try {
    const status = await lockRowStatus(req.payload, "cms_stock_counts", Number(id), req);
    if (status === null) {
      await killTransaction(req);
      return bad("Count not found.", 404);
    }
    const c = await getCount(req, id);
    if (!c) {
      await killTransaction(req);
      return bad("Count not found.", 404);
    }
    const res = await work(c);
    if (res.ok) await commitTransaction(req);
    else await killTransaction(req);
    return res;
  } catch (e) {
    await killTransaction(req);
    throw e;
  }
}

async function lineFor(req: PayloadRequest, p: Doc): Promise<CountLine> {
  const tracked = Boolean(p.trackUnits);
  const serials = tracked
    ? ((await req.payload.find({ collection: "units", where: { and: [{ product: { equals: p.id } }, { status: { equals: "in-stock" } }] }, limit: 500, depth: 0, overrideAccess: true })).docs as unknown as Doc[]).map((u) => String(u.serial))
    : [];
  return { productId: Number(p.id), title: String(p.title ?? ""), sku: String(p.sku ?? ""), tracked, expected: Number(p.stock) || 0, counted: 0, unitCost: Number(p.costPrice) || 0, expectedSerials: serials, scannedSerials: [] };
}

const start: Endpoint = {
  path: "/stock-count/start",
  method: "post",
  handler: async (req) => {
    if (!isStaffUser(req.user as never)) return bad("Please sign in as staff.", 401);
    const b = await body(req);
    const name = String(b.name ?? "").trim() || `Stock count ${new Date().toLocaleDateString("en-PK", { dateStyle: "medium" })}`;
    const cat = b.categoryId ? Number(b.categoryId) : null;
    const where: Where = { and: [{ status: { not_equals: "archived" } }, ...(cat ? [{ or: [{ category: { equals: cat } }, { "category.parent": { equals: cat } }] }] : [])] };
    const products = (await req.payload.find({ collection: "products", where, limit: 0, pagination: false, depth: 0, overrideAccess: true, sort: "title" })).docs as unknown as Doc[];
    const lines = await Promise.all(products.map((p) => lineFor(req, p)));
    const doc = await req.payload.create({ collection: "stock-counts", overrideAccess: true, data: { name, status: "open", category: cat, lines, itemsCounted: 0, variance: 0, startedBy: (req.user as { id: number }).id } as never });
    log.info("stockcount.start", { count: doc.id, products: lines.length, by: (req.user as { id: number }).id });
    return Response.json({ id: doc.id });
  },
};

function totals(lines: CountLine[]) {
  const counted = lines.filter((l) => l.touched);
  return { itemsCounted: counted.reduce((s, l) => s + l.counted, 0), variance: counted.reduce((s, l) => s + (l.counted - l.expected), 0) };
}

const scan: Endpoint = {
  path: "/stock-count/scan",
  method: "post",
  handler: async (req) => {
    if (!isStaffUser(req.user as never)) return bad("Please sign in as staff.", 401);
    const b = await body(req);
    const code = String(b.code ?? "").trim();
    if (!code) return bad("Scan or type a barcode.");
    return withCountLock(req, b.id, async (c) => {
    if (c.status !== "open") return bad("This count is closed.");
    const lines = (c.lines as CountLine[]) ?? [];
    let line: CountLine | undefined;
    let message = "";
    const unit = (await req.payload.find({ collection: "units", where: { serial: { equals: code } }, limit: 1, depth: 0, overrideAccess: true })).docs[0] as unknown as Doc | undefined;
    if (unit) {
      const pid = Number(unit.product);
      line = lines.find((l) => l.productId === pid);
      if (!line) {
        const p = (await req.payload.findByID({ collection: "products", id: pid, depth: 0, overrideAccess: true })) as unknown as Doc;
        line = await lineFor(req, p);
        lines.push(line);
      }
      if (line.scannedSerials.includes(code)) return Response.json({ line: shown(req, line), message: `Serial ${code} was already counted.`, duplicate: true });
      line.scannedSerials.push(code);
      line.counted = line.scannedSerials.length;
      line.touched = true;
      message = line.expectedSerials.includes(code) ? `✓ ${line.title} – serial ${code}` : `Serial ${code} wasn't expected on the shelf (status: ${String(unit.status)})`;
    } else {
      // exact SKU, else a single case-insensitive match (scanners sometimes change letter case)
      const exact = (await req.payload.find({ collection: "products", where: { sku: { equals: code } }, limit: 1, depth: 0, overrideAccess: true })).docs as unknown as Doc[];
      const loose = exact.length ? exact : ((await req.payload.find({ collection: "products", where: { sku: { like: code } }, limit: 2, depth: 0, overrideAccess: true })).docs as unknown as Doc[]);
      const p = loose.length === 1 ? loose[0] : undefined;
      if (!p) return bad(`Nothing found for “${code}”.`, 404);
      line = lines.find((l) => l.productId === Number(p.id));
      if (!line) {
        line = await lineFor(req, p);
        lines.push(line);
      }
      if (line.tracked) return Response.json({ line: shown(req, line), message: `${line.title} is tracked by serial – scan the serial number sticker instead.`, needSerial: true });
      line.counted += Math.max(1, Math.trunc(Number(b.qty) || 1));
      line.touched = true;
      message = `✓ ${line.title} – ${line.counted} counted`;
    }
    await save(req, Number(c.id), { lines, ...totals(lines) });
    return Response.json({ line: shown(req, line), message });
    });
  },
};

const set: Endpoint = {
  path: "/stock-count/set",
  method: "post",
  handler: async (req) => {
    if (!isStaffUser(req.user as never)) return bad("Please sign in as staff.", 401);
    const b = await body(req);
    return withCountLock(req, b.id, async (c) => {
    if (c.status !== "open") return bad("This count is closed.");
    const lines = (c.lines as CountLine[]) ?? [];
    const line = lines.find((l) => l.productId === Number(b.productId));
    if (!line) return bad("Product not in this count.");
    if (line.tracked) return bad("Count serial-tracked laptops by scanning their serials.");
    line.counted = Math.max(0, Math.trunc(Number(b.counted) || 0));
    line.touched = true;
    await save(req, Number(c.id), { lines, ...totals(lines) });
    return Response.json({ line: shown(req, line) });
    });
  },
};

const finish: Endpoint = {
  path: "/stock-count/finish",
  method: "post",
  handler: async (req) => {
    if (!isStaffUser(req.user as never)) return bad("Please sign in as staff.", 401);
    const b = await body(req);
    const apply = b.apply === true;
    const zeroUncounted = b.zeroUncounted === true;
    if (apply && !isManagerUser(req.user as never)) return bad("Only an owner or manager can correct stock.", 403);
    return withCountLock(req, b.id, async (c) => {
    if (c.status !== "open") return bad("This count is already finished.");
    const lines = (c.lines as CountLine[]) ?? [];
    let corrected = 0;
    if (apply) {
      const { addStock, setStockLog } = await import("../stock");
      setStockLog(req, { reason: "stock-count", ref: `Stock count #${c.id}` });
      for (const l of lines) {
        if (l.tracked || l.counted === l.expected || (!l.touched && !zeroUncounted)) continue;
        // apply the DIFFERENCE in one statement, so sales made while counting (or right now) aren't lost
        await addStock(req.payload, l.productId, l.counted - l.expected, req);
        corrected++;
      }
      const { revalidate } = await import("../revalidate");
      revalidate(["catalog"]);
    }
    await save(req, Number(c.id), { status: apply ? "applied" : "finished", finishedAt: new Date().toISOString(), lines, ...totals(lines) });
    log.info("stockcount.finish", { count: c.id, applied: apply, corrected, variance: totals(lines).variance, by: (req.user as { id: number }).id });
    return Response.json({ ok: true, corrected });
    });
  },
};

export const inventoryEndpoints: Endpoint[] = [start, scan, set, finish];
