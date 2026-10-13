import "server-only";
import { randomUUID } from "node:crypto";
import { uploadObject } from "@/lib/storage";

/** Customer photo uploads (returns, warranty, trade-ins) – checked by content, stored in the PRIVATE bucket. */

export const MAX_PHOTO_BYTES = 2 * 1024 * 1024;

export async function sniffImage(file: File): Promise<"image/jpeg" | "image/png" | "image/webp" | null> {
  const b = new Uint8Array(await file.slice(0, 12).arrayBuffer());
  if (b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff) return "image/jpeg";
  if (b[0] === 0x89 && b[1] === 0x50 && b[2] === 0x4e && b[3] === 0x47) return "image/png";
  if (b[0] === 0x52 && b[1] === 0x49 && b[2] === 0x46 && b[3] === 0x46 && b[8] === 0x57 && b[9] === 0x45 && b[10] === 0x42 && b[11] === 0x50) return "image/webp";
  return null;
}

/** Validates and stores up to `max` photos from a form under `<prefix>/<ref>/…`. Returns the keys, or an error message. */
export async function storePhotos(files: FormDataEntryValue[], prefix: "returns" | "warranty" | "tradein" | "reviews-pending", ref: string, max = 5): Promise<{ keys: string[] } | { error: string }> {
  const list = files.filter((f): f is File => f instanceof File && f.size > 0).slice(0, max);
  const checked: { file: File; type: string }[] = [];
  for (const file of list) {
    if (file.size > MAX_PHOTO_BYTES) return { error: "Each photo must be 2 MB or smaller." };
    const type = await sniffImage(file);
    if (!type) return { error: "Only JPG, PNG or WebP photos are allowed." };
    checked.push({ file, type });
  }
  const keys: string[] = [];
  for (const { file, type } of checked) {
    const ext = type === "image/png" ? "png" : type === "image/webp" ? "webp" : "jpg";
    const key = `${prefix}/${ref}/${randomUUID().slice(0, 8)}.${ext}`;
    await uploadObject(key, Buffer.from(await file.arrayBuffer()), type);
    keys.push(key);
  }
  return { keys };
}
