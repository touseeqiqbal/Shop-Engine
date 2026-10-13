/** Public URL for an object stored in the private bucket (streamed by /media/[...key]). Client-safe. */
export function mediaUrl(key: string) {
  return `/media/${key.split("/").map(encodeURIComponent).join("/")}`;
}

/** Folders the admin may upload into (presigned POST) and that /media will serve publicly. */
export const PUBLIC_MEDIA_FOLDERS = ["products", "banners", "blog", "media", "reviews"] as const;
export type MediaFolder = (typeof PUBLIC_MEDIA_FOLDERS)[number];

/**
 * Rejects path tricks: "..", backslashes, absolute paths, empty segments, control characters.
 * Spaces, brackets etc. are allowed – uploads keep their original names (e.g. "WhatsApp Image … (1).webp").
 */
export function isSafeKey(key: string) {
  if (!key || key.length > 512) return false;
  if (key.includes("..") || key.includes("\\") || key.startsWith("/") || key.includes("//")) return false;
  return /^[a-z0-9][^\u0000-\u001f\u007f]*$/i.test(key);
}

/** "WhatsApp Image 2026-10-05 at 7.50.14 PM (1).jpg" → "whatsapp-image-2026-10-05-at-7-50-14-pm-1.jpg" */
export function cleanFileName(name: string) {
  const dot = name.lastIndexOf(".");
  const ext = dot > 0 ? name.slice(dot + 1).toLowerCase().replace(/[^a-z0-9]/g, "") : "";
  const base = (dot > 0 ? name.slice(0, dot) : name)
    .normalize("NFKD")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80) || "image";
  return ext ? `${base}.${ext}` : base;
}

export function isPublicMediaKey(key: string) {
  return isSafeKey(key) && PUBLIC_MEDIA_FOLDERS.some((f) => key.startsWith(`${f}/`));
}
