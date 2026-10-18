import { lookup as dnsLookup, type LookupAddress, type LookupOneOptions } from "node:dns";
import http from "node:http";
import https from "node:https";
import { isIP } from "node:net";
import { brotliDecompressSync, gunzipSync, inflateSync } from "node:zlib";

/**
 * Requests to addresses a STORE typed in (its webhook endpoints, an "any SMS provider" send link, an SMTP server) must
 * never reach ShopEngine's own network: loopback, private ranges, link-local (the cloud metadata service), CGNAT …
 * The check runs at connect time on the address actually connected to – resolving first and fetching after would let a
 * DNS name answer "public" for the check and "private" for the request (DNS rebinding). Redirects are never followed.
 * Local development may call localhost (test receivers), as before.
 */

/** An IPv6 address as its 8 numbers ("::" expanded, a trailing a.b.c.d turned into two). */
function ipv6Words(ip: string): number[] | null {
  let v = ip.toLowerCase().split("%")[0];
  const dotted = v.match(/(\d+\.\d+\.\d+\.\d+)$/);
  if (dotted) {
    const [a, b, c, d] = dotted[1].split(".").map(Number);
    v = v.slice(0, -dotted[1].length) + ((a << 8) | b).toString(16) + ":" + ((c << 8) | d).toString(16);
  }
  const [head, tail] = v.split("::");
  const h = head ? head.split(":") : [];
  const t = tail !== undefined ? (tail ? tail.split(":") : []) : [];
  const words = tail !== undefined ? [...h, ...Array(8 - h.length - t.length).fill("0"), ...t] : h;
  if (words.length !== 8) return null;
  const n = words.map((w) => parseInt(w, 16));
  return n.some((x) => Number.isNaN(x)) ? null : n;
}

/** Loopback, private, link-local (cloud metadata), carrier-grade NAT, multicast and reserved ranges. */
export function isPrivateAddress(ip: string): boolean {
  if (isIP(ip) === 6) {
    const w = ipv6Words(ip);
    if (!w) return true; // can't read it: refuse
    const v4 = (hi: number, lo: number) => `${hi >> 8}.${hi & 255}.${lo >> 8}.${lo & 255}`;
    const zeros = (from: number, to: number) => w.slice(from, to).every((x) => x === 0);
    if (zeros(0, 7) && (w[7] === 0 || w[7] === 1)) return true; // :: and ::1
    // an IPv4 address inside IPv6 – written any way (::ffff:127.0.0.1 is also ::ffff:7f00:1): check that address
    if (zeros(0, 5) && (w[5] === 0xffff || w[5] === 0)) return isPrivateAddress(v4(w[6], w[7])); // mapped / compatible
    if (w[0] === 0x64 && w[1] === 0xff9b && zeros(2, 6)) return isPrivateAddress(v4(w[6], w[7])); // NAT64
    if (w[0] === 0x2002) return isPrivateAddress(v4(w[1], w[2])); // 6to4
    return (w[0] & 0xfe00) === 0xfc00 || (w[0] & 0xffc0) === 0xfe80 || (w[0] & 0xffc0) === 0xfec0 || (w[0] & 0xff00) === 0xff00; // unique-local, link-local, site-local, multicast
  }
  const [a, b] = ip.split(".").map(Number);
  return a === 0 || a === 10 || a === 127 || (a === 100 && b >= 64 && b <= 127) || (a === 169 && b === 254) || (a === 172 && b >= 16 && b <= 31) || (a === 192 && b === 168) || (a === 198 && (b === 18 || b === 19)) || a >= 224;
}

export class PrivateAddressError extends Error {
  constructor(host: string) {
    super(`Refused: ${host} points to a private address`);
    this.name = "PrivateAddressError";
  }
}

/** Local development only: test receivers on this machine. */
export const devLocalHost = (hostname: string) => process.env.NODE_ENV !== "production" && ["localhost", "127.0.0.1", "[::1]", "::1"].includes(hostname);

const bare = (hostname: string) => hostname.replace(/^\[|\]$/g, "");

/** A DNS lookup that refuses names with any private address (used by the socket itself, so nothing can change in between). */
function guardedLookup(hostname: string, options: LookupOneOptions & { all?: boolean }, callback: (err: NodeJS.ErrnoException | null, address: string | LookupAddress[], family?: number) => void) {
  dnsLookup(hostname, { ...options, all: true }, (err, addresses) => {
    if (err) return callback(err, "");
    const list = addresses as LookupAddress[];
    if (!list.length || list.some((a) => isPrivateAddress(a.address))) return callback(new PrivateAddressError(hostname) as NodeJS.ErrnoException, "");
    if (options.all) return callback(null, list);
    callback(null, list[0].address, list[0].family);
  });
}

/**
 * Resolves a host name a store typed in and refuses it when any of its addresses is internal; the address to connect
 * to is returned (connect to IT, not to the name again – see above).
 */
export async function resolvePublicHost(hostname: string): Promise<{ address: string; family: number; local: boolean }> {
  const host = bare(hostname);
  if (devLocalHost(hostname) || devLocalHost(host)) return { address: host === "localhost" ? "127.0.0.1" : host, family: isIP(host) === 6 ? 6 : 4, local: true };
  if (isIP(host)) {
    if (isPrivateAddress(host)) throw new PrivateAddressError(host);
    return { address: host, family: isIP(host), local: false };
  }
  const list = await new Promise<LookupAddress[]>((resolve, reject) => dnsLookup(host, { all: true }, (e, a) => (e ? reject(e) : resolve(a))));
  if (!list.length || list.some((a) => isPrivateAddress(a.address))) throw new PrivateAddressError(host);
  return { address: list[0].address, family: list[0].family, local: false };
}

export type PublicRequestOptions = {
  method?: string;
  headers?: Record<string, string>;
  body?: string;
  timeoutMs?: number;
  /** answers larger than this are cut off (default 1 MB) */
  maxBytes?: number;
};

export type PublicResponse = { status: number; ok: boolean; headers: Headers; text: string };

/** One request to a store-supplied address (http/https only, no redirects followed, never to a private address). */
export async function publicRequest(target: string | URL, opts: PublicRequestOptions = {}): Promise<PublicResponse> {
  const url = new URL(target);
  if (url.protocol !== "https:" && url.protocol !== "http:") throw new Error("Only web addresses (http/https) can be called.");
  const host = bare(url.hostname);
  const local = devLocalHost(url.hostname) || devLocalHost(host);
  // an IP address is connected to without a lookup – check it here
  if (!local && isIP(host) && isPrivateAddress(host)) throw new PrivateAddressError(host);
  const lib = url.protocol === "https:" ? https : http;
  const maxBytes = opts.maxBytes ?? 1_000_000;
  return new Promise<PublicResponse>((resolve, reject) => {
    const req = lib.request(
      url,
      {
        method: opts.method ?? (opts.body ? "POST" : "GET"),
        headers: { "accept-encoding": "gzip, deflate, br", ...opts.headers, ...(opts.body ? { "content-length": String(Buffer.byteLength(opts.body)) } : {}) },
        signal: AbortSignal.timeout(opts.timeoutMs ?? 15_000),
        ...(local ? {} : { lookup: guardedLookup as never }),
      },
      (res) => {
        const chunks: Buffer[] = [];
        let size = 0;
        res.on("data", (c: Buffer) => {
          size += c.length;
          if (size <= maxBytes) chunks.push(c);
          else res.destroy();
        });
        const done = () => {
          let buf = Buffer.concat(chunks);
          const enc = String(res.headers["content-encoding"] ?? "").toLowerCase();
          try {
            if (enc === "gzip") buf = gunzipSync(buf);
            else if (enc === "deflate") buf = inflateSync(buf);
            else if (enc === "br") buf = brotliDecompressSync(buf);
          } catch {
            // cut off or not really compressed: keep the raw bytes
          }
          const headers = new Headers();
          for (const [k, v] of Object.entries(res.headers)) if (v !== undefined) headers.set(k, Array.isArray(v) ? v.join(", ") : String(v));
          const status = res.statusCode ?? 0;
          resolve({ status, ok: status >= 200 && status < 300, headers, text: buf.toString("utf8") });
        };
        res.on("end", done);
        res.on("close", () => {
          if (!res.complete) done();
        });
        res.on("error", reject);
      },
    );
    // a failed connect to a name with several addresses is an AggregateError without a message of its own
    req.on("error", (e: Error & { errors?: Error[]; code?: string }) => {
      if (!e.message) {
        const first = e.errors?.[0] as (Error & { code?: string }) | undefined;
        const why = first?.message || first?.code || e.code || "connection failed";
        return reject(Object.assign(new Error(`Couldn't reach ${url.host}: ${why}`), { code: first?.code ?? e.code, cause: e }));
      }
      reject(e);
    });
    if (opts.body) req.write(opts.body);
    req.end();
  });
}
