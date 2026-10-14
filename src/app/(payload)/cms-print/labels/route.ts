import { adminRequest, canSeeStore } from "@/payload/route-access";
import { storeIdOf } from "@/payload/tenancy";
import { absoluteUrl } from "@/lib/site";
import { storeDirectory, storeOrigin } from "@/lib/tenant";

export const dynamic = "force-dynamic";

/**
 * GET /cms-print/labels?type=products|units&ids=1,2,3&copies=1&qr=1
 * Printable barcode labels (Code 128 – readable by any shop scanner) with name, price and an optional QR code
 * to the product page. Staff only. Fits A4 label sheets (3 across) or a label printer (one per page).
 */

type Doc = Record<string, unknown>;
const esc = (s: unknown) => String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!);
const rs = (n: number) => `Rs ${Math.round(n).toLocaleString("en-PK")}`;

export async function GET(req: Request) {
  // the store's team only (owners/managers must have 2-step on – same rule as the rest of /cms)
  const { payload, t } = await adminRequest(req);
  if (!t.platformAdmin && !t.roles.size) return new Response("Please sign in to /cms first.", { status: 401 });

  const url = new URL(req.url);
  const type = url.searchParams.get("type") === "units" ? "units" : "products";
  const ids = (url.searchParams.get("ids") ?? "").split(",").map(Number).filter((n) => Number.isInteger(n) && n > 0).slice(0, 300);
  const copies = Math.min(50, Math.max(1, Number(url.searchParams.get("copies")) || 1));
  const withQr = url.searchParams.get("qr") !== "0";
  const roll = url.searchParams.get("layout") === "roll";
  if (!ids.length) return new Response("Choose products or units first.", { status: 400 });

  const [bwip, QR] = await Promise.all([import("bwip-js/node"), import("qrcode")]);
  // only the store's own products / units
  const docs = ((await payload.find({ collection: type, where: { id: { in: ids } }, limit: ids.length, depth: 2, overrideAccess: true })).docs as unknown as Doc[]).filter((d) => canSeeStore(t, d.store));

  // QR codes open the product on its own store's address
  const stores = await storeDirectory();
  const pageOf = (store: unknown, path: string) => {
    const s = stores.find((x) => x.id === storeIdOf(store));
    const origin = s ? storeOrigin(s) : "";
    return origin ? `${origin}${path}` : absoluteUrl(path);
  };

  const labels: string[] = [];
  for (const d of docs) {
    const product = (type === "units" ? (d.product as Doc) : d) ?? {};
    const code = String(type === "units" ? d.serial : product.sku || product.id);
    const cat = product.category as Doc | undefined;
    const pageUrl = cat?.slug && product.slug ? pageOf(product.store ?? d.store, `/${cat.slug}/${product.slug}`) : "";
    let barcode = "";
    try {
      barcode = bwip.toSVG({ bcid: "code128", text: code, scale: 2, height: 9, includetext: true, textxalign: "center", textsize: 8 });
    } catch {
      barcode = `<p>${esc(code)}</p>`;
    }
    const qr = withQr && pageUrl ? await QR.toString(pageUrl, { type: "svg", margin: 0, width: 64 }) : "";
    const price = Number(product.price) || 0;
    const html = `<div class="label"><div class="t">${esc(product.title)}</div>${type === "units" && d.conditionNotes ? `<div class="m">${esc(d.conditionNotes)}</div>` : ""}<div class="row"><div class="bc">${barcode}</div>${qr ? `<div class="qr">${qr}</div>` : ""}</div>${price && !product.priceOnRequest ? `<div class="p">${rs(price)}</div>` : ""}</div>`;
    for (let i = 0; i < copies; i++) labels.push(html);
  }

  const page = `<!doctype html><html><head><meta charset="utf-8"><title>Labels</title><style>
*{box-sizing:border-box}body{margin:0;font:11px/1.25 system-ui,Segoe UI,Roboto,sans-serif;color:#000}
.bar{padding:12px;display:flex;gap:8px;align-items:center;font-size:14px}.bar button{font:inherit;padding:8px 16px;border:0;border-radius:8px;background:#111;color:#fff;cursor:pointer}
.sheet{display:grid;grid-template-columns:${roll ? "1fr" : "repeat(3, 1fr)"};gap:${roll ? "0" : "4mm"};padding:${roll ? "0" : "8mm"}}
.label{border:${roll ? "0" : "1px dashed #bbb"};padding:3mm;height:${roll ? "auto" : "36mm"};overflow:hidden;break-inside:avoid;${roll ? "page-break-after:always;width:58mm" : ""}}
.t{font-weight:700;font-size:11px;max-height:2.6em;overflow:hidden}.m{font-size:9px;color:#333;max-height:1.3em;overflow:hidden}
.row{display:flex;align-items:center;gap:2mm;margin-top:1.5mm}.bc{flex:1;min-width:0}.bc svg{width:100%;height:auto;max-height:16mm}.qr svg{width:14mm;height:14mm}
.p{font-weight:800;font-size:14px;margin-top:1mm}
@media print{.bar{display:none}.label{border-color:transparent}@page{margin:${roll ? "0" : "6mm"}}}
</style></head><body><div class="bar"><button onclick="window.print()">Print ${labels.length} label(s)</button><span>A4 sheet (3 across). For a label printer add <code>&amp;layout=roll</code> to the address.</span></div><div class="sheet">${labels.join("")}</div></body></html>`;
  return new Response(page, { headers: { "Content-Type": "text/html; charset=utf-8", "Cache-Control": "private, no-store", "X-Robots-Tag": "noindex" } });
}
