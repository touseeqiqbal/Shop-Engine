import "server-only";
import { PDFDocument, StandardFonts, rgb, type PDFFont, type PDFPage } from "pdf-lib";
import type { Order } from "@/lib/types";
import type { SiteInfo } from "@/lib/site-info";
import { ORDER_STATUS_LABEL, PAYMENT_LABEL, PAYMENT_STATUS_LABEL } from "@/lib/order-display";
import { amountToCollect, creditedAdvance } from "@/lib/order-money";

/**
 * Customer invoice as a real PDF (A4), built with pdf-lib (pure JavaScript, no browser needed).
 * The standard PDF fonts only cover Latin text, so other characters (e.g. Urdu letters in a name) are replaced.
 */

const A4 = { w: 595.28, h: 841.89 };
const M = 48; // page margin
const INK = rgb(0.07, 0.09, 0.15);
const MUTED = rgb(0.4, 0.43, 0.5);
const LINE = rgb(0.85, 0.87, 0.9);
const ACCENT = rgb(0.31, 0.27, 0.9);

/** Text the standard fonts can draw (WinAnsi): common punctuation mapped, anything else → "?". */
export function pdfText(s: unknown): string {
  return String(s ?? "")
    .replace(/[‘’]/g, "'")
    .replace(/[“”]/g, '"')
    .replace(/[–—]/g, "-")
    .replace(/×/g, "x")
    .replace(/…/g, "...")
    .replace(/[   ]/g, " ")
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^\x20-\x7E]/g, "?");
}

const money = (n: number) => `Rs ${Math.round(n).toLocaleString("en-PK")}`;
const date = (iso: string) => {
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? "" : d.toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric", timeZone: "Asia/Karachi" });
};

/** Splits text into lines that fit `width`. */
function wrap(text: string, font: PDFFont, size: number, width: number): string[] {
  const words = pdfText(text).split(/\s+/).filter(Boolean);
  const lines: string[] = [];
  let line = "";
  for (const w of words) {
    const next = line ? `${line} ${w}` : w;
    if (font.widthOfTextAtSize(next, size) <= width) line = next;
    else {
      if (line) lines.push(line);
      // a single very long word: cut it
      let rest = w;
      while (font.widthOfTextAtSize(rest, size) > width && rest.length > 1) {
        let cut = rest.length;
        while (cut > 1 && font.widthOfTextAtSize(rest.slice(0, cut), size) > width) cut--;
        lines.push(rest.slice(0, cut));
        rest = rest.slice(cut);
      }
      line = rest;
    }
  }
  if (line) lines.push(line);
  return lines.length ? lines : [""];
}

export async function buildInvoicePdf(order: Order, site: SiteInfo): Promise<Uint8Array> {
  const doc = await PDFDocument.create();
  doc.setTitle(`Invoice ${order.orderNumber}`);
  doc.setAuthor(pdfText(site.name));
  doc.setCreator(pdfText(site.name));
  const font = await doc.embedFont(StandardFonts.Helvetica);
  const bold = await doc.embedFont(StandardFonts.HelveticaBold);

  let page: PDFPage = doc.addPage([A4.w, A4.h]);
  let y = A4.h - M;
  const text = (s: string, x: number, size = 10, f = font, color = INK) => page.drawText(pdfText(s), { x, y, size, font: f, color });
  const right = (s: string, xRight: number, size = 10, f = font, color = INK) => page.drawText(pdfText(s), { x: xRight - f.widthOfTextAtSize(pdfText(s), size), y, size, font: f, color });
  const rule = (yy = y) => page.drawLine({ start: { x: M, y: yy }, end: { x: A4.w - M, y: yy }, thickness: 0.7, color: LINE });
  const newPageIfNeeded = (need: number) => {
    if (y - need > M + 40) return;
    page = doc.addPage([A4.w, A4.h]);
    y = A4.h - M;
  };

  // ── header ──
  text(site.name, M, 18, bold, ACCENT);
  right("INVOICE", A4.w - M, 18, bold);
  y -= 16;
  for (const l of wrap(site.address.full, font, 9, 280)) {
    text(l, M, 9, font, MUTED);
    y -= 11;
  }
  const contact = [site.phones.map((p) => p.display).join(" / "), site.email].filter(Boolean).join("  ·  ");
  text(contact, M, 9, font, MUTED);
  // order meta on the right
  let my = A4.h - M - 16;
  for (const [k, v] of [
    ["Order", order.orderNumber],
    ["Date", date(order.createdAt)],
    ["Status", ORDER_STATUS_LABEL[order.status] ?? order.status],
    ["Payment", `${PAYMENT_LABEL[order.paymentMethod] ?? order.paymentMethod} - ${PAYMENT_STATUS_LABEL[order.paymentStatus] ?? order.paymentStatus}`],
  ] as const) {
    page.drawText(pdfText(k), { x: A4.w - M - 200, y: my, size: 9, font, color: MUTED });
    const v2 = pdfText(v);
    page.drawText(v2, { x: A4.w - M - bold.widthOfTextAtSize(v2, 9), y: my, size: 9, font: bold, color: INK });
    my -= 13;
  }
  y = Math.min(y, my) - 22;
  rule();
  y -= 20;

  // ── bill to ──
  text("BILL TO / DELIVER TO", M, 8, bold, MUTED);
  y -= 14;
  const c = order.customer;
  for (const l of [c.name, c.phone, c.email ?? "", ...wrap([c.address, c.landmark ? `(near ${c.landmark})` : "", c.city].filter(Boolean).join(", "), font, 10, 300)].filter(Boolean)) {
    text(l, M, 10);
    y -= 13;
  }
  y -= 12;

  // ── items table ──
  const COL = { qty: A4.w - M - 190, price: A4.w - M - 95, amount: A4.w - M };
  const nameWidth = COL.qty - M - 40;
  page.drawRectangle({ x: M, y: y - 6, width: A4.w - 2 * M, height: 20, color: rgb(0.95, 0.96, 0.98) });
  text("Item", M + 6, 9, bold);
  right("Qty", COL.qty, 9, bold);
  right("Price", COL.price, 9, bold);
  right("Amount", COL.amount - 6, 9, bold);
  y -= 24;
  for (const i of order.items) {
    const upgrades = i.upgrades?.length ? ` (${i.upgrades.map((u) => u.label).join(", ")})` : "";
    const lines = wrap(`${i.name}${upgrades}`, font, 10, nameWidth);
    newPageIfNeeded(lines.length * 13 + 10);
    text(lines[0], M + 6, 10);
    right(String(i.qty), COL.qty, 10);
    right(money(i.unitPrice), COL.price, 10);
    right(money(i.unitPrice * i.qty), COL.amount - 6, 10);
    for (const l of lines.slice(1)) {
      y -= 13;
      text(l, M + 6, 10, font, MUTED);
    }
    y -= 10;
    rule(y);
    y -= 14;
  }

  // ── totals ──
  newPageIfNeeded(140);
  const advance = creditedAdvance(order);
  const due = amountToCollect(order);
  const rows: [string, string, boolean?][] = [
    ["Subtotal", money(order.subtotal)],
    ...(order.discount ? ([[`Discount${order.couponCode ? ` (${order.couponCode})` : ""}`, `- ${money(order.discount)}`]] as [string, string][]) : []),
    ["Delivery", order.deliveryCharge ? money(order.deliveryCharge) : "Free"],
    ["Total", money(order.total), true],
    ...(advance ? ([["Advance paid", `- ${money(advance)}`]] as [string, string][]) : []),
    [order.paymentStatus === "paid" ? "Paid" : order.paymentMethod === "cod" ? "To pay on delivery" : "Amount due", order.paymentStatus === "paid" ? money(order.total) : money(due), true],
  ];
  for (const [k, v, strong] of rows) {
    page.drawText(pdfText(k), { x: A4.w - M - 220, y, size: strong ? 11 : 10, font: strong ? bold : font, color: strong ? INK : MUTED });
    right(v, COL.amount - 6, strong ? 11 : 10, strong ? bold : font);
    y -= strong ? 17 : 14;
  }

  // ── footer ──
  y = Math.max(y - 30, M + 30);
  rule(y + 14);
  for (const l of wrap(`Thank you for shopping with ${site.name}. Keep this invoice for warranty and returns. Questions? WhatsApp ${site.phones[0]?.display ?? ""} or email ${site.email}.`, font, 9, A4.w - 2 * M)) {
    text(l, M, 9, font, MUTED);
    y -= 12;
  }
  text(site.url.replace(/^https?:\/\//, ""), M, 9, bold, ACCENT);

  return doc.save();
}
