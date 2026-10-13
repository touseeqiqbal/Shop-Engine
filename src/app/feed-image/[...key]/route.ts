import sharp from "sharp";
import { getObject } from "@/lib/storage";
import { isPublicMediaKey } from "@/lib/media";

/**
 * JPEG copy of a public product photo, for shopping feeds (Meta / TikTok reject WebP).
 * Same rules as /media: only the public photo folders, cached for a year (keys never change).
 */
export async function GET(_req: Request, ctx: { params: Promise<{ key: string[] }> }) {
  const { key: parts } = await ctx.params;
  const key = parts.map((p) => decodeURIComponent(p)).join("/");
  if (!isPublicMediaKey(key)) return new Response("Not found", { status: 404 });
  const obj = await getObject(key);
  if (!obj) return new Response("Not found", { status: 404, headers: { "Cache-Control": "public, max-age=60" } });
  const input = Buffer.from(await new Response(obj.body).arrayBuffer());
  try {
    const jpg = await sharp(input).rotate().resize(1600, 1600, { fit: "inside", withoutEnlargement: true }).flatten({ background: "#ffffff" }).jpeg({ quality: 85, mozjpeg: true }).toBuffer();
    return new Response(new Uint8Array(jpg), {
      headers: { "Content-Type": "image/jpeg", "Cache-Control": "public, max-age=31536000, immutable", "X-Content-Type-Options": "nosniff", "Content-Disposition": "inline" },
    });
  } catch {
    return new Response("Not an image", { status: 415 });
  }
}
