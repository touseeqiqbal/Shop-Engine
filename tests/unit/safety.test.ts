import { afterEach, describe, expect, it } from "vitest";
import { safePath } from "@/lib/safe-path";
import { sanitizeHtml } from "@/lib/sanitize";
import { cookieMatchesOrder, orderCookieValue } from "@/lib/order-cookie";
import { checkVerifyToken, createVerifyToken, readVerifyToken } from "@/lib/account-email";
import { ipFromHeaders } from "@/lib/client-ip";
import { ORDER_NUMBER_RE } from "@/lib/order-number";

const headers = (h: Record<string, string>) => ({ get: (k: string) => h[k.toLowerCase()] ?? null });

describe("redirect targets", () => {
  it("only pages of this site", () => {
    expect(safePath("/account/orders?tab=1", "X")).toBe("/account/orders?tab=1");
    for (const bad of ["//evil.com", "/\\evil.com", "/\tevil.com", "https://evil.com", "javascript:alert(1)", "", 42]) expect(safePath(bad, "X")).toBe("X");
  });
});

describe("HTML from /cms", () => {
  it("removes scripts, event handlers and javascript: links; keeps formatting", () => {
    const out = sanitizeHtml('<p>Hi <img src="x" onerror="alert(1)"><a href="javascript:alert(1)">x</a><script>alert(2)</script><strong>ok</strong></p>');
    expect(out).not.toMatch(/onerror|javascript:|<script/i);
    expect(out).toContain("<strong>ok</strong>");
  });
});

describe("order cookie", () => {
  const order = "UTS-261006-123456";
  it("only the server's signed value opens an order", () => {
    const v = orderCookieValue(order);
    expect(cookieMatchesOrder(v, order)).toBe(true);
    expect(cookieMatchesOrder(order, order)).toBe(false);
    expect(cookieMatchesOrder(`${order}.forged-signature-value-xyz`, order)).toBe(false);
    expect(cookieMatchesOrder(v, "UTS-261006-654321")).toBe(false);
    expect(cookieMatchesOrder(undefined, order)).toBe(false);
  });
  it("order numbers: 6 digits now, 4 digits for older orders", () => {
    expect(ORDER_NUMBER_RE.test(order)).toBe(true);
    expect(ORDER_NUMBER_RE.test("UTS-260512-4821")).toBe(true);
    expect(ORDER_NUMBER_RE.test("UTS-260512-48219")).toBe(false);
  });
});

describe("email confirmation link", () => {
  it("valid only for the same email and secret, and its expiry can't be changed", () => {
    const t = readVerifyToken(createVerifyToken("secret", 7, "A@b.com"))!;
    expect(t.id).toBe("7");
    expect(checkVerifyToken("secret", t, "a@b.com")).toBe("ok");
    expect(checkVerifyToken("secret", t, "other@b.com")).toBe("invalid");
    expect(checkVerifyToken("other-secret", t, "a@b.com")).toBe("invalid");
    expect(checkVerifyToken("secret", { ...t, exp: t.exp + 1 }, "a@b.com")).toBe("invalid");
    expect(readVerifyToken("garbage")).toBeNull();
  });
});

describe("visitor IP for rate limits", () => {
  afterEach(() => {
    delete process.env.CLIENT_IP_HEADER;
  });
  it("uses the entry our proxy added, not what the visitor sent", () => {
    expect(ipFromHeaders(headers({ "x-forwarded-for": "6.6.6.6, 203.0.113.9" }))).toBe("203.0.113.9");
    expect(ipFromHeaders(headers({}))).toBe("unknown");
  });
  it("CLIENT_IP_HEADER wins (e.g. behind Cloudflare)", () => {
    process.env.CLIENT_IP_HEADER = "cf-connecting-ip";
    expect(ipFromHeaders(headers({ "cf-connecting-ip": "198.51.100.4", "x-forwarded-for": "1.1.1.1" }))).toBe("198.51.100.4");
  });
});

describe("bot check (Turnstile)", () => {
  afterEach(() => {
    delete process.env.TURNSTILE_SECRET_KEY;
    delete process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY;
  });
  it("never blocks forms while only one of the two keys is set", async () => {
    const { verifyTurnstile } = await import("@/lib/turnstile");
    process.env.TURNSTILE_SECRET_KEY = "secret";
    expect(await verifyTurnstile(new FormData(), "checkout")).toBe(true);
  });
  it("with both keys, a form without the check's answer is refused", async () => {
    const { verifyTurnstile } = await import("@/lib/turnstile");
    process.env.TURNSTILE_SECRET_KEY = "secret";
    process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY = "site";
    expect(await verifyTurnstile(new FormData(), "checkout")).toBe(false);
  });
});
