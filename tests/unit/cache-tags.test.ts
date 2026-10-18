import { describe, expect, it } from "vitest";
import { CATALOG_ALL, catalogTagOf } from "@/lib/cache-tags";

describe("per-store catalog cache tags", () => {
  it("one tag per store, however the store is given", () => {
    expect(catalogTagOf(4)).toBe("catalog:s4");
    expect(catalogTagOf("4")).toBe("catalog:s4");
    expect(catalogTagOf({ id: 4, name: "Acme" })).toBe("catalog:s4");
  });
  it("an unknown store refreshes every store's catalog (never too little)", () => {
    for (const s of [null, undefined, "", 0, "x", {}]) expect(catalogTagOf(s)).toBe(CATALOG_ALL);
  });
});
