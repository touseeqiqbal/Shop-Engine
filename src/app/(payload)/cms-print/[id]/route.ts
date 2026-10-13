import { amountToCollect, creditedAdvance, paymentBlocksShipping } from "@/lib/order-money";
import { getPayload } from "payload";
import config from "@payload-config";
import { isStaffUser } from "@/payload/access";
import { getSiteInfo } from "@/lib/repo/site-content";

export const dynamic = "force-dynamic";

/** GET /cms-print/<orderId>?type=invoice|slip – printable invoice or packing slip for signed-in staff. */

type Order = {
  orderNumber: string;
  placedAt?: string;
  customer?: { name?: string; phone?: string; email?: string; city?: string; address?: string; landmark?: string };
  items?: { title?: string; qty?: number; unitPrice?: number; product?: number | { id: number } | null }[];
  subtotal?: number;
  discount?: number;
  deliveryCharge?: number;
  total?: number;
  advancePaid?: number;
  paymentMethod?: string;
  paymentStatus?: string;
  courier?: string;
  trackingNumber?: string;
};

const esc = (s: unknown) => String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!);
const rs = (n: number | undefined) => `Rs ${Math.round(n ?? 0).toLocaleString("en-PK")}`;
const METHOD: Record<string, string> = { cod: "Cash on delivery", jazzcash: "JazzCash", easypaisa: "EasyPaisa", bank: "Bank transfer", card: "Card" };

export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const payload = await getPayload({ config });
  const { user } = await payload.auth({ headers: req.headers });
  // full staff rights only (owners/managers must have 2-step on – same rule as the rest of /cms)
  if (!isStaffUser(user as never)) return new Response("Please sign in to /cms first.", { status: 401 });
  if (!/^\d+$/.test(id)) return new Response("Invalid order", { status: 400 });
  const o = (await payload.findByID({ collection: "orders", id: Number(id), depth: 0, overrideAccess: true }).catch(() => null)) as Order | null;
  if (!o) return new Response("Order not found", { status: 404 });

  const slip = new URL(req.url).searchParams.get("type") === "slip";
  // serial numbers of the laptops reserved / sold for this order (by product)
  const units = (await payload.find({ collection: "units", where: { order: { equals: Number(id) } }, limit: 100, depth: 0, overrideAccess: true }).catch(() => ({ docs: [] }))).docs as unknown as { product?: number | { id: number }; serial?: string }[];
  const serialsFor = (product: unknown) => {
    const pid = product && typeof product === "object" ? (product as { id: number }).id : product;
    return units.filter((u) => (typeof u.product === "object" ? u.product?.id : u.product) === pid).map((u) => u.serial).filter(Boolean).join(", ");
  };
  const site = await getSiteInfo().catch(() => null);
  const toCollect = amountToCollect(o);
  const advance = creditedAdvance(o);
  const unverified = paymentBlocksShipping(o);
  const date = o.placedAt ? new Date(o.placedAt).toLocaleDateString("en-PK", { dateStyle: "medium", timeZone: "Asia/Karachi" }) : "";
  const c = o.customer ?? {};

  const rows = (o.items ?? [])
    .map(
      (i) => `<tr><td>${esc(i.title)}${serialsFor(i.product) ? `<div class="muted">Serial: ${esc(serialsFor(i.product))}</div>` : ""}</td><td class="n">${esc(i.qty)}</td>${
        slip ? '<td class="n">☐</td>' : `<td class="n">${rs(i.unitPrice)}</td><td class="n">${rs((i.unitPrice ?? 0) * (i.qty ?? 0))}</td>`
      }</tr>`
    )
    .join("");

  const money = slip
    ? ""
    : `<table class="sum">
        <tr><td>Items</td><td class="n">${rs(o.subtotal)}</td></tr>
        ${(o.discount ?? 0) > 0 ? `<tr><td>Discount</td><td class="n">− ${rs(o.discount)}</td></tr>` : ""}
        <tr><td>Delivery</td><td class="n">${(o.deliveryCharge ?? 0) > 0 ? rs(o.deliveryCharge) : "Free"}</td></tr>
        <tr class="t"><td>Total</td><td class="n">${rs(o.total)}</td></tr>
        ${advance > 0 ? `<tr><td>Advance paid</td><td class="n">− ${rs(advance)}</td></tr>` : ""}
      </table>`;

  const html = `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>${slip ? "Packing slip" : "Invoice"} ${esc(o.orderNumber)}</title>
<style>
*{box-sizing:border-box}body{font:14px/1.45 system-ui,-apple-system,Segoe UI,Roboto,sans-serif;color:#111;margin:0;padding:32px;max-width:800px;margin:auto}
h1{font-size:22px;margin:0}header{display:flex;justify-content:space-between;gap:24px;border-bottom:2px solid #111;padding-bottom:16px;margin-bottom:20px}
.muted{color:#555;font-size:12px}.cols{display:flex;gap:32px;margin-bottom:20px}.cols>div{flex:1}h2{font-size:12px;text-transform:uppercase;letter-spacing:.06em;color:#555;margin:0 0 6px}
table{width:100%;border-collapse:collapse}th,td{text-align:left;padding:8px 6px;border-bottom:1px solid #ddd;vertical-align:top}th{font-size:12px;color:#555}.n{text-align:right;white-space:nowrap}
.sum{width:300px;margin:16px 0 0 auto}.sum td{border:0;padding:4px 6px}.sum .t td{font-weight:700;font-size:16px;border-top:2px solid #111}
.collect{margin-top:20px;padding:14px;border:2px dashed #111;font-size:18px;font-weight:700;text-align:center}
.bar{margin-bottom:20px}.bar button{font:inherit;padding:8px 16px;border-radius:8px;border:1px solid #111;background:#111;color:#fff;cursor:pointer}
@media print{.bar{display:none}body{padding:0}}
</style></head><body>
<div class="bar"><button onclick="window.print()">Print</button></div>
<header><div><h1>${esc(site?.name ?? "Urko Tech Store")}</h1><div class="muted">${esc(site?.address.full ?? "")}</div><div class="muted">${esc(site?.phones?.[0]?.display ?? "")} ${esc(site?.email ?? "")}</div></div>
<div style="text-align:right"><h1>${slip ? "Packing slip" : "Invoice"}</h1><div><strong>${esc(o.orderNumber)}</strong></div><div class="muted">${esc(date)}</div></div></header>
<div class="cols"><div><h2>Deliver to</h2><strong>${esc(c.name)}</strong><br>${esc(c.address)}${c.landmark ? ` (near ${esc(c.landmark)})` : ""}<br>${esc(c.city)}<br>${esc(c.phone)}</div>
<div><h2>Payment</h2>${esc(METHOD[o.paymentMethod ?? ""] ?? o.paymentMethod)}${o.courier ? `<h2 style="margin-top:12px">Courier</h2>${esc(o.courier)} ${esc(o.trackingNumber ?? "")}` : ""}</div></div>
<table><thead><tr><th>Item</th><th class="n">Qty</th>${slip ? '<th class="n">Packed</th>' : '<th class="n">Price</th><th class="n">Amount</th>'}</tr></thead><tbody>${rows}</tbody></table>
${money}
${unverified ? `<div class="collect">⚠ PAYMENT NOT VERIFIED – DO NOT SHIP</div>` : ""}
${toCollect > 0 ? `<div class="collect">Collect from customer: ${rs(toCollect)}</div>` : slip ? `<div class="collect">Paid – collect nothing</div>` : ""}
<p class="muted" style="margin-top:28px">Thank you for shopping with us.</p>
</body></html>`;
  return new Response(html, { headers: { "Content-Type": "text/html; charset=utf-8", "Cache-Control": "private, no-store", "X-Robots-Tag": "noindex" } });
}
