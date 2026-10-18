import { describe, expect, it } from "vitest";
import { downloadToken, readDownloadToken } from "@/lib/downloads";

const key = Buffer.alloc(32, 7);
const other = Buffer.alloc(32, 8);
const exp = Math.floor(Date.now() / 1000) + 3600;

describe("download links", () => {
  it("a link names its order and file", () => {
    expect(readDownloadToken(downloadToken({ order: 151, file: 9, exp }, key), Date.now(), key)).toEqual({ order: 151, file: 9, exp });
  });
  it("a changed, made-up or foreign link is refused", () => {
    const t = downloadToken({ order: 151, file: 9, exp }, key);
    const [body, sig] = t.split(".");
    const otherBody = Buffer.from(`152.9.${exp}`).toString("base64url");
    expect(readDownloadToken(`${otherBody}.${sig}`, Date.now(), key)).toBeNull();
    expect(readDownloadToken(`${body}.${sig.slice(0, -2)}xx`, Date.now(), key)).toBeNull();
    expect(readDownloadToken(t, Date.now(), other)).toBeNull();
    expect(readDownloadToken("nonsense", Date.now(), key)).toBeNull();
    expect(readDownloadToken("", Date.now(), key)).toBeNull();
  });
  it("an expired link is refused", () => {
    const t = downloadToken({ order: 1, file: 2, exp: Math.floor(Date.now() / 1000) - 1 }, key);
    expect(readDownloadToken(t, Date.now(), key)).toBeNull();
  });
});
