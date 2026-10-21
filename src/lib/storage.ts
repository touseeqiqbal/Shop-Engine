import "server-only";
import { createReadStream } from "node:fs";
import { mkdir, rm, stat, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { Readable } from "node:stream";
import { DeleteObjectCommand, GetObjectCommand, PutObjectCommand, S3Client } from "@aws-sdk/client-s3";
import { isSafeKey, mediaUrl } from "@/lib/media";
import { strictProduction } from "@/lib/db/config";

/**
 * Object storage for a PRIVATE S3-compatible bucket (Railway Storage Bucket).
 *   S3_ENDPOINT, S3_BUCKET, S3_ACCESS_KEY_ID, S3_SECRET_ACCESS_KEY, S3_REGION (=auto), S3_FORCE_PATH_STYLE (optional "true")
 * The bucket has no public URLs – everything is streamed through /media/[...key].
 * Without those env vars (local demo mode) files are stored in ./.data/uploads and served by the same route.
 */

export { mediaUrl };

const env = {
  endpoint: process.env.S3_ENDPOINT,
  bucket: process.env.S3_BUCKET,
  accessKeyId: process.env.S3_ACCESS_KEY_ID,
  secretAccessKey: process.env.S3_SECRET_ACCESS_KEY,
  region: process.env.S3_REGION || "auto",
  forcePathStyle: process.env.S3_FORCE_PATH_STYLE === "true",
};

export const isStorageConfigured = Boolean(env.endpoint && env.bucket && env.accessKeyId && env.secretAccessKey);

const g = globalThis as unknown as { __urkoS3?: S3Client };
function s3() {
  if (!g.__urkoS3) {
    g.__urkoS3 = new S3Client({
      region: env.region,
      endpoint: env.endpoint,
      forcePathStyle: env.forcePathStyle,
      credentials: { accessKeyId: env.accessKeyId!, secretAccessKey: env.secretAccessKey! },
      // a bucket that stops answering fails the request instead of holding it (and a page render) open for ever
      requestHandler: { connectionTimeout: 5_000, requestTimeout: 60_000 },
    });
  }
  return g.__urkoS3;
}

// ───────────────────────────── local fallback ─────────────────────────────

const LOCAL_ROOT = resolve(process.cwd(), ".data", "uploads");
function localPath(key: string) {
  // production never reads or writes the container's disk (files there vanish on the next deploy)
  if (strictProduction) throw new Error("File storage (S3_*) is not configured");
  if (!isSafeKey(key)) throw new Error("Invalid storage key");
  const p = resolve(LOCAL_ROOT, key);
  if (!p.startsWith(LOCAL_ROOT)) throw new Error("Invalid storage key");
  return p;
}

const CONTENT_TYPES: Record<string, string> = { webp: "image/webp", jpg: "image/jpeg", jpeg: "image/jpeg", png: "image/png", svg: "image/svg+xml", gif: "image/gif", mp4: "video/mp4", gz: "application/gzip" };
const typeFromKey = (key: string) => CONTENT_TYPES[key.split(".").pop()?.toLowerCase() ?? ""] ?? "application/octet-stream";

// ───────────────────────────── API ─────────────────────────────

export async function uploadObject(key: string, body: Buffer, contentType: string) {
  if (!isSafeKey(key)) throw new Error("Invalid storage key");
  if (!isStorageConfigured) {
    const p = localPath(key);
    await mkdir(dirname(p), { recursive: true });
    await writeFile(p, body);
    return key;
  }
  await s3().send(new PutObjectCommand({ Bucket: env.bucket, Key: key, Body: body, ContentType: contentType }));
  return key;
}

export interface StoredObject {
  body: ReadableStream<Uint8Array>;
  contentType: string;
  contentLength?: number;
  etag?: string;
}

/**
 * An object to stream. `ifNoneMatch` (the browser's cached ETag): when the object is unchanged, `{ notModified }` comes
 * back without reading it – the bucket isn't asked to send a file the browser already has.
 */
export async function getObject(key: string): Promise<StoredObject | null>;
export async function getObject(key: string, opts: { ifNoneMatch?: string | null }): Promise<StoredObject | { notModified: true; etag: string } | null>;
export async function getObject(key: string, opts: { ifNoneMatch?: string | null } = {}): Promise<StoredObject | { notModified: true; etag: string } | null> {
  if (!isSafeKey(key)) return null;
  if (!isStorageConfigured) {
    try {
      const p = localPath(key);
      const s = await stat(p);
      const etag = `"${s.size}-${s.mtimeMs}"`;
      if (opts.ifNoneMatch && opts.ifNoneMatch === etag) return { notModified: true, etag };
      return {
        body: Readable.toWeb(createReadStream(p)) as unknown as ReadableStream<Uint8Array>,
        contentType: typeFromKey(key),
        contentLength: s.size,
        etag: `"${s.size}-${s.mtimeMs}"`,
      };
    } catch {
      return null;
    }
  }
  try {
    const res = await s3().send(new GetObjectCommand({ Bucket: env.bucket, Key: key, ...(opts.ifNoneMatch ? { IfNoneMatch: opts.ifNoneMatch } : {}) }));
    if (!res.Body) return null;
    return {
      body: res.Body.transformToWebStream() as ReadableStream<Uint8Array>,
      contentType: res.ContentType || typeFromKey(key),
      contentLength: res.ContentLength,
      etag: res.ETag,
    };
  } catch (e) {
    const status = (e as { $metadata?: { httpStatusCode?: number } }).$metadata?.httpStatusCode;
    if (status === 304 && opts.ifNoneMatch) return { notModified: true, etag: opts.ifNoneMatch };
    if ((e as { name?: string }).name === "NoSuchKey" || status === 404) return null;
    throw e;
  }
}

/** Deletes a private object (customer data erasure). Missing objects are ignored. */
export async function deleteObject(key: string): Promise<void> {
  if (!isSafeKey(key)) return;
  if (!isStorageConfigured) {
    await rm(localPath(key), { force: true });
    return;
  }
  await s3().send(new DeleteObjectCommand({ Bucket: env.bucket, Key: key }));
}
