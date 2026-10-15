import { adminRequest, canSeeStore } from "@/payload/route-access";
import { storeIdOf } from "@/payload/tenancy";
import { storeLocaleOf } from "@/payload/store-locale";
import { getSiteInfo } from "@/lib/repo/site-content";
import { moneyFormatter } from "@/lib/money";
import { formatDate } from "@/lib/time";

export const dynamic = "force-dynamic";

/** GET /cms-print/credit-note/<returnId> – printable credit note for a refunded return (staff only). */

type Ret = {
  requestNumber?: string;
  orderNumber?: string;
  customerName?: string;
  customerPhone?: string;
  items?: { title?: string; qty?: number; unitPrice?: number; serial?: string }[];
  reason?: string;
  refundMethod?: string;
  refundAmount?: number;
  creditNoteNumber?: string;
  creditNoteDate?: string;
};

const esc = (s: unknown) => String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!);
const METHOD: Record<string, string> = { cash: "Cash", bank: "Bank transfer", jazzcash: "JazzCash", easypaisa: "EasyPaisa", credit: "Store credit" };

export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  // the store's team only (owners/managers must have 2-step on – same rule as the rest of /cms)
  const { payload, t } = await adminRequest(req);
  if (!t.platformAdmin && !t.roles.size) return new Response("Please sign in to /cms first.", { status: 401 });
  if (!/^\d+$/.test(id)) return new Response("Invalid", { status: 400 });
  const r = (await payload.findByID({ collection: "return-requests", id: Number(id), depth: 0, overrideAccess: true }).catch(() => null)) as (Ret & { store?: unknown }) | null;
  if (!r?.creditNoteNumber || !canSeeStore(t, r.store)) return new Response("No credit note for this return yet.", { status: 404 });
  const [site, loc] = await Promise.all([getSiteInfo(storeIdOf(r.store)).catch(() => null), storeLocaleOf(payload, storeIdOf(r.store))]);
  // the store's currency and time zone
  const price = moneyFormatter(loc);
  const amt = (n: number | undefined) => price(n ?? 0);
  const rows = (r.items ?? []).map((i) => `<tr><td>${esc(i.title)}${i.serial ? `<div class="m">Serial: ${esc(i.serial)}</div>` : ""}</td><td class="n">${esc(i.qty ?? 1)}</td><td class="n">${amt((i.unitPrice ?? 0) * (i.qty ?? 1))}</td></tr>`).join("");
  const html = `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Credit note ${esc(r.creditNoteNumber)}</title>
<style>body{font:14px/1.45 system-ui,Segoe UI,Roboto,sans-serif;color:#111;max-width:760px;margin:auto;padding:32px}h1{font-size:22px;margin:0}header{display:flex;justify-content:space-between;border-bottom:2px solid #111;padding-bottom:14px;margin-bottom:18px}
.m{color:#555;font-size:12px}table{width:100%;border-collapse:collapse}td,th{text-align:left;padding:8px 6px;border-bottom:1px solid #ddd}.n{text-align:right}.t{font-size:18px;font-weight:700;text-align:right;margin-top:16px}
.bar{margin-bottom:16px}.bar button{font:inherit;padding:8px 16px;border-radius:8px;border:0;background:#111;color:#fff;cursor:pointer}@media print{.bar{display:none}body{padding:0}}</style></head><body>
<div class="bar"><button onclick="window.print()">Print</button></div>
<header><div><h1>${esc(site?.name ?? "")}</h1><div class="m">${esc(site?.address.full ?? "")}</div></div>
<div style="text-align:right"><h1>Credit note</h1><strong>${esc(r.creditNoteNumber)}</strong><div class="m">${esc(r.creditNoteDate ? formatDate(r.creditNoteDate, loc, { dateStyle: "medium" }) : "")}</div></div></header>
<p><strong>${esc(r.customerName)}</strong> · ${esc(r.customerPhone)}<br><span class="m">Return ${esc(r.requestNumber)}${r.orderNumber ? ` · original order ${esc(r.orderNumber)}` : ""} · reason: ${esc(r.reason)}</span></p>
<table><thead><tr><th>Item returned</th><th class="n">Qty</th><th class="n">Value</th></tr></thead><tbody>${rows}</tbody></table>
<p class="t">Refunded: ${amt(r.refundAmount)} (${esc(METHOD[r.refundMethod ?? ""] ?? r.refundMethod ?? "")})</p>
<p class="m" style="margin-top:28px">This credit note cancels the amount above from the original sale.</p></body></html>`;
  return new Response(html, { headers: { "Content-Type": "text/html; charset=utf-8", "Cache-Control": "private, no-store", "X-Robots-Tag": "noindex" } });
}
