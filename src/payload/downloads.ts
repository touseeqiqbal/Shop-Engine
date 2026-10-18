import type { Payload } from "payload";
import { sql } from "@payloadcms/db-postgres";
import { conn } from "./stock";
import { DOWNLOAD_DEFAULTS, downloadToken, readDownloadToken } from "../lib/downloads";

/**
 * An order's downloads (digital products): what it bought, and – once the order is PAID – a signed link per file.
 * Downloads are available for the product's "days" after the order was placed, each file up to its "limit" times.
 */

type Doc = Record<string, unknown>;
const relId = (v: unknown) => Number(v && typeof v === "object" ? (v as Doc).id : v);

export type OrderDownload = { fileId: number; title: string; filename: string; size: number; used: number; limit: number; until: string; url: string | null };
export type OrderDownloads = { paid: boolean; files: OrderDownload[] };

/** The order's digital files with links (null until it is paid / once used up or expired). `linkHours`: link life. */
export async function orderDownloads(payload: Payload, order: Doc, opts: { linkHours?: number; now?: number } = {}): Promise<OrderDownloads> {
  const now = opts.now ?? Date.now();
  const items = (Array.isArray(order.items) ? order.items : []) as Doc[];
  const productIds = [...new Set(items.map((i) => relId(i.product)).filter((n) => Number.isFinite(n) && n > 0))];
  if (!productIds.length) return { paid: false, files: [] };
  const products = (await payload.find({ collection: "products", where: { id: { in: productIds } }, limit: productIds.length, depth: 1, overrideAccess: true })).docs as unknown as Doc[];
  // a cancelled order's files aren't released, even when a payment arrived after cancelling (the team refunds it)
  const paid = order.paymentStatus === "paid" && order.status !== "cancelled";
  const counts = (order.downloadCounts && typeof order.downloadCounts === "object" ? order.downloadCounts : {}) as Record<string, number>;
  const placed = Date.parse(String(order.placedAt ?? order.createdAt ?? "")) || now;
  const files: OrderDownload[] = [];
  const seen = new Set<number>();
  for (const p of products) {
    const d = (p.digital ?? {}) as Doc;
    const list = (Array.isArray(d.files) ? d.files : []) as unknown[];
    if (!list.length) continue;
    const limit = Number(d.downloadLimit) > 0 ? Number(d.downloadLimit) : DOWNLOAD_DEFAULTS.limit;
    const days = Number(d.downloadDays) > 0 ? Number(d.downloadDays) : DOWNLOAD_DEFAULTS.days;
    const until = placed + days * 86_400_000;
    for (const f of list) {
      const file = (f && typeof f === "object" ? f : null) as Doc | null;
      const id = relId(f);
      if (!file || seen.has(id)) continue;
      seen.add(id);
      const used = Number(counts[String(id)]) || 0;
      const usable = paid && used < limit && until > now;
      const exp = Math.min(until, now + (opts.linkHours ?? 24) * 3_600_000);
      files.push({
        fileId: id,
        title: String(file.title ?? file.filename ?? "Download"),
        filename: String(file.filename ?? ""),
        size: Number(file.filesize) || 0,
        used,
        limit,
        until: new Date(until).toISOString(),
        url: usable ? `/download/${downloadToken({ order: Number(order.id), file: id, exp: Math.floor(exp / 1000) })}` : null,
      });
    }
  }
  return { paid, files };
}

/** Counts one download – only while the file has downloads left. False when it is used up. */
export async function countDownload(payload: Payload, orderId: number, fileId: number, limit: number): Promise<boolean> {
  const key = String(fileId);
  const { rows } = await (await conn(payload)).execute(sql`
    UPDATE "payload"."cms_orders"
    SET "download_counts" = jsonb_set(COALESCE("download_counts", '{}'::jsonb), ARRAY[${key}], to_jsonb(COALESCE(("download_counts" ->> ${key})::int, 0) + 1))
    WHERE "id" = ${orderId} AND COALESCE(("download_counts" ->> ${key})::int, 0) < ${limit}
    RETURNING "id"`);
  return rows.length > 0;
}

/** A small page for a download that can't start (expired, not paid yet, used up …). */
export const downloadPage = (status: number, text: string) =>
  new Response(`<!doctype html><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Download</title><body style="font-family:system-ui,sans-serif;max-width:32rem;margin:15vh auto;padding:0 1rem;color:#111"><h1 style="font-size:1.25rem">Download</h1><p>${text}</p><p><a href="/account/orders">Your orders</a></p></body>`, {
    status,
    headers: { "Content-Type": "text/html; charset=utf-8", "Cache-Control": "no-store", "X-Robots-Tag": "noindex" },
  });

/**
 * The file behind a download link: the token must be signed and unexpired, the order PAID and inside the product's
 * download period, the file part of the order and not downloaded too often. Streams it as an attachment.
 */
export async function serveDownload(payload: Payload, token: string, now = Date.now()): Promise<Response> {
  const claim = readDownloadToken(token, now);
  if (!claim) return downloadPage(410, "This download link has expired. Open your order again (or the email we sent) for a fresh link.");
  try {
    const order = (await payload.findByID({ collection: "orders", id: claim.order, depth: 0, overrideAccess: true }).catch(() => null)) as Doc | null;
    if (!order) return downloadPage(404, "We can't find this order.");
    const { paid, files } = await orderDownloads(payload, order, { now });
    const file = files.find((f) => f.fileId === claim.file);
    if (!file) return downloadPage(404, "This file isn't part of the order.");
    if (!paid) return downloadPage(403, "Your download is ready as soon as the payment is confirmed.");
    if (Date.parse(file.until) < now) return downloadPage(410, "The download period for this order has ended. Please contact the shop.");
    if (!(await countDownload(payload, claim.order, claim.file, file.limit))) return downloadPage(410, `This file was downloaded ${file.limit} times already – the most for one order. Please contact the shop if you need it again.`);
    const { getObject } = await import("../lib/storage");
    const obj = await getObject(`downloads/${file.filename}`);
    if (!obj) {
      const { log } = await import("../lib/log");
      log.error("download.missing_file", new Error("file not in storage"), { order: claim.order, file: claim.file });
      return downloadPage(404, "The file is missing – the shop has been told. Please contact them.");
    }
    const headers = new Headers({
      "Content-Type": obj.contentType || "application/octet-stream",
      // (quotes, backslashes and line breaks can't break out of the header)
      "Content-Disposition": `attachment; filename="${file.filename.replace(/["\\\r\n]/g, "_")}"`,
      "Cache-Control": "private, no-store",
      "X-Content-Type-Options": "nosniff",
      "X-Robots-Tag": "noindex",
    });
    if (obj.contentLength) headers.set("Content-Length", String(obj.contentLength));
    return new Response(obj.body, { headers });
  } catch (e) {
    const { log } = await import("../lib/log");
    log.error("download.failed", e, { order: claim.order });
    return downloadPage(500, "The download didn't start – please try again.");
  }
}
