import { describe, expect, it } from "vitest";
import { previewCookieValue, readPreviewCookie } from "@/lib/preview-cookie";

describe("the preview cookie only opens the store /api/preview chose", () => {
  const key = Buffer.from("test-key-test-key-test-key-123456");
  const inAnHour = Date.now() + 3_600_000;
  it("a cookie the route signed names its store", () => {
    expect(readPreviewCookie(previewCookieValue(7, inAnHour, key), Date.now(), key)).toBe(7);
  });
  it("a store id typed into the cookie (the old format) or a changed store is refused", () => {
    expect(readPreviewCookie("12", Date.now(), key)).toBeNull();
    const [, exp, sig] = previewCookieValue(7, inAnHour, key).split(".");
    expect(readPreviewCookie(`12.${exp}.${sig}`, Date.now(), key)).toBeNull();
    expect(readPreviewCookie(previewCookieValue(7, inAnHour, Buffer.from("another-secret-another-secret-12")), Date.now(), key)).toBeNull();
  });
  it("an expired cookie is refused", () => {
    expect(readPreviewCookie(previewCookieValue(7, Date.now() - 1000, key), Date.now(), key)).toBeNull();
  });
});
