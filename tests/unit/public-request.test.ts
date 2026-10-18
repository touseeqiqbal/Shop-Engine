import { createServer, type Server } from "node:http";
import type { AddressInfo } from "node:net";
import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from "vitest";

// "rebind.test" answers with an internal address – like a store's DNS name pointed at ShopEngine's own network
vi.mock("node:dns", async (importOriginal) => {
  const dns = await importOriginal<typeof import("node:dns")>();
  const fake = (hostname: string, options: unknown, callback: (...a: unknown[]) => void) => {
    const cb = typeof options === "function" ? (options as typeof callback) : callback;
    const all = typeof options === "object" && options !== null && (options as { all?: boolean }).all;
    if (hostname === "rebind.test") return all ? cb(null, [{ address: "93.184.216.34", family: 4 }, { address: "169.254.169.254", family: 4 }]) : cb(null, "169.254.169.254", 4);
    return (dns.lookup as unknown as (...a: unknown[]) => void)(hostname, options, callback);
  };
  return { ...dns, default: { ...dns, lookup: fake }, lookup: fake };
});

const { isPrivateAddress, publicRequest, resolvePublicHost } = await import("@/lib/net/public-request");
const { http } = await import("@/lib/integrations/http");

let server: Server;
let port = 0;
beforeAll(async () => {
  // a receiver that redirects to the cloud metadata address
  server = createServer((_req, res) => {
    res.writeHead(302, { location: "http://169.254.169.254/latest/meta-data/" });
    res.end("moved");
  });
  await new Promise<void>((r) => server.listen(0, "127.0.0.1", r));
  port = (server.address() as AddressInfo).port;
});
afterAll(() => new Promise<void>((r) => server.close(() => r())));
afterEach(() => vi.unstubAllEnvs());

describe("store-supplied addresses never reach the internal network", () => {
  it("knows the internal ranges", () => {
    for (const ip of ["127.0.0.1", "10.0.0.5", "172.16.3.4", "192.168.1.1", "169.254.169.254", "100.64.0.1", "0.0.0.0", "::1", "::", "fd00::1", "fe80::1", "::ffff:10.0.0.1"]) expect(isPrivateAddress(ip), ip).toBe(true);
    // the same internal IPv4 addresses written the other IPv6 ways (URL parsing turns ::ffff:127.0.0.1 into ::ffff:7f00:1)
    for (const ip of ["::ffff:7f00:1", "::ffff:a9fe:a9fe", "0:0:0:0:0:ffff:a00:5", "::7f00:1", "64:ff9b::a9fe:a9fe", "2002:a9fe:a9fe::1", "FE80::1%eth0"]) expect(isPrivateAddress(ip), ip).toBe(true);
    for (const ip of ["93.184.216.34", "8.8.8.8", "2606:4700::1111", "::ffff:5db8:d822", "2a00:1450:4001:80b::200e"]) expect(isPrivateAddress(ip), ip).toBe(false);
  });

  it("refuses an internal IP address in the link (the SMS 'send address' attack)", async () => {
    await expect(publicRequest("http://169.254.169.254/latest/meta-data/")).rejects.toThrow(/private address/);
    await expect(publicRequest("http://10.0.0.5:8080/")).rejects.toThrow(/private address/);
    await expect(publicRequest("http://[::ffff:127.0.0.1]/")).rejects.toThrow(/private address/);
  });

  it("refuses a DNS name with an internal address – checked on the connection itself", async () => {
    await expect(publicRequest("http://rebind.test/latest/meta-data/")).rejects.toThrow(/private address/);
    await expect(resolvePublicHost("rebind.test")).rejects.toThrow(/private address/);
    await expect(resolvePublicHost("192.168.0.10")).rejects.toThrow(/private address/);
  });

  it("never follows a redirect (a public address can't bounce the request inside)", async () => {
    const r = await publicRequest(`http://127.0.0.1:${port}/`); // the local test receiver (allowed while developing)
    expect(r.status).toBe(302);
    expect(r.headers.get("location")).toContain("169.254.169.254");
    expect(r.text).toBe("moved");
  });

  it("in production even localhost is refused", async () => {
    vi.stubEnv("NODE_ENV", "production");
    await expect(publicRequest(`http://127.0.0.1:${port}/`)).rejects.toThrow(/private address/);
    await expect(publicRequest(`http://localhost:${port}/`)).rejects.toThrow(/private address/);
    await expect(resolvePublicHost("localhost")).rejects.toThrow(/private address/);
  });

  it("integrations: a store-typed address gets a clear refusal, and no answer from inside is passed back", async () => {
    const r = http("http://169.254.169.254/latest/meta-data/iam/?to=1&text=x", { provider: "SMS provider", storeSupplied: true });
    await expect(r).rejects.toThrow(/private network/);
  });

  it("only web addresses", async () => {
    await expect(publicRequest("file:///etc/passwd")).rejects.toThrow(/web addresses/);
  });
});
