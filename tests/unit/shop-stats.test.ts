import { describe, expect, it } from "vitest";
import { isBot, validRef } from "@/lib/shop-stats";

describe("shop statistics", () => {
  it("crawlers, link previews and scripts aren't counted", () => {
    for (const ua of ["Googlebot/2.1", "facebookexternalhit/1.1", "Mozilla/5.0 (compatible; bingbot/2.0)", "curl/8.4", "python-requests/2.31", "Chrome-Lighthouse", "", null]) expect(isBot(ua)).toBe(true);
  });
  it("browsers are", () => {
    expect(isBot("Mozilla/5.0 (Linux; Android 14) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/129.0 Mobile Safari/537.36")).toBe(false);
    expect(isBot("Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 Mobile/15E148 Safari/604.1")).toBe(false);
  });
  it("product ids: short and plain, or none", () => {
    expect(validRef("17")).toBe("17");
    expect(validRef("lap-123_x")).toBe("lap-123_x");
    expect(validRef("")).toBe("");
    expect(validRef(undefined)).toBe("");
    expect(validRef("<script>")).toBeNull();
    expect(validRef("x".repeat(61))).toBeNull();
  });
});
