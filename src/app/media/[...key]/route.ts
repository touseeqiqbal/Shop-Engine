import type { NextRequest } from "next/server";
import { getObject } from "@/lib/storage";
import { isPublicMediaKey } from "@/lib/media";

/**
 * Streams public images (products/, banners/, blog/) from the private bucket.
 * Keys are unique per upload, so responses are cached forever by browsers and Cloudflare.
 * Private prefixes such as payments/ and backups/ are never served here.
 */
export async function GET(req: NextRequest, ctx: { params: Promise<{ key: string[] }> }) {
  const { key: parts } = await ctx.params;
  const key = parts.map((p) => decodeURIComponent(p)).join("/");
  if (!isPublicMediaKey(key)) return new Response("Not found", { status: 404 });

  const obj = await getObject(key);
  if (!obj) return new Response("Not found", { status: 404, headers: { "Cache-Control": "public, max-age=60" } });

  if (obj.etag && req.headers.get("if-none-match") === obj.etag) {
    await obj.body.cancel();
    return new Response(null, { status: 304, headers: { ETag: obj.etag, "Cache-Control": "public, max-age=31536000, immutable" } });
  }

  const headers = new Headers({
    "Content-Type": obj.contentType,
    "Cache-Control": "public, max-age=31536000, immutable",
    "X-Content-Type-Options": "nosniff",
    "Content-Disposition": "inline",
    // Media never needs to run code – neutralises scripts embedded in SVG uploads.
    "Content-Security-Policy": "default-src 'none'; style-src 'unsafe-inline'; sandbox",
  });
  if (obj.contentLength) headers.set("Content-Length", String(obj.contentLength));
  if (obj.etag) headers.set("ETag", obj.etag);
  return new Response(obj.body, { headers });
}
