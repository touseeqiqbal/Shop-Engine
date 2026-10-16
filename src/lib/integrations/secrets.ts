import { createCipheriv, createDecipheriv, createHash, randomBytes } from "node:crypto";

/**
 * A store's integration keys (API keys, passwords, tokens) are stored encrypted: AES-256-GCM with a key derived from
 * PAYLOAD_SECRET. They are decrypted only on the server, when a provider is called – never sent to a browser (the
 * admin shows the last 4 characters).
 *
 * Changing PAYLOAD_SECRET makes saved keys unreadable: stores then reconnect their integrations.
 */

const key = () => createHash("sha256").update(`${process.env.PAYLOAD_SECRET ?? ""}:shopengine-integrations`).digest();

export function sealSecrets(values: Record<string, string>): string {
  const iv = randomBytes(12);
  const c = createCipheriv("aes-256-gcm", key(), iv);
  const data = Buffer.concat([c.update(JSON.stringify(values), "utf8"), c.final()]);
  return ["v1", ...[iv, c.getAuthTag(), data].map((b) => b.toString("base64url"))].join(".");
}

/** The saved keys, or {} when there are none or they can't be read (wrong PAYLOAD_SECRET, damaged). */
export function openSecrets(blob: string | null | undefined): Record<string, string> {
  if (!blob) return {};
  try {
    const [version, iv, tag, data] = blob.split(".");
    if (version !== "v1") return {};
    const d = createDecipheriv("aes-256-gcm", key(), Buffer.from(iv, "base64url"));
    d.setAuthTag(Buffer.from(tag, "base64url"));
    const plain = Buffer.concat([d.update(Buffer.from(data, "base64url")), d.final()]).toString("utf8");
    const parsed = JSON.parse(plain) as unknown;
    return parsed && typeof parsed === "object" ? (parsed as Record<string, string>) : {};
  } catch {
    return {};
  }
}

/** "••••a1b2" – enough for the owner to recognise a key, useless to anyone else. */
export const hint = (value: string | null | undefined) => (value ? `••••${value.length > 8 ? value.slice(-4) : ""}` : "");
