import { describe, expect, it } from "vitest";
import { forgetCatalogBuilds, joinParts, partOf, partsFor, productsOfPart, sharedCatalogBuild } from "@/lib/catalog-parts";

const products = Array.from({ length: 1000 }, (_, i) => ({ id: i % 3 ? String(i + 1) : `ck${(i * 7919).toString(36)}`, n: i }));

describe("the catalogue cached in parts (Next.js won't cache an entry over 2 MB)", () => {
  it("splits into parts of about the size asked for", () => {
    expect(partsFor(0, 300)).toBe(1);
    expect(partsFor(300, 300)).toBe(1);
    expect(partsFor(1000, 300)).toBe(4);
    const parts = 4;
    const sizes = Array.from({ length: parts }, (_, i) => productsOfPart(products, i, parts).length);
    expect(sizes.reduce((a, b) => a + b, 0)).toBe(1000);
    for (const n of sizes) expect(n).toBeGreaterThan(150); // spread out, not all in one part
  });

  it("each product is in exactly one part, always the same one", () => {
    const parts = 5;
    const seen = new Map<string, number>();
    for (let i = 0; i < parts; i++) for (const p of productsOfPart(products, i, parts)) seen.set(p.id, (seen.get(p.id) ?? 0) + 1);
    expect(seen.size).toBe(products.length);
    expect([...seen.values()].every((n) => n === 1)).toBe(true);
    expect(partOf("123", 5)).toBe(partOf("123", 5));
    expect(partOf("anything", 1)).toBe(0);
  });

  it("joins the parts back in the catalogue's order", () => {
    const parts = 4;
    const order = products.map((p) => p.id);
    const joined = joinParts(order, Array.from({ length: parts }, (_, i) => productsOfPart(products, i, parts)));
    expect(joined.map((p) => p.id)).toEqual(order);
  });

  it("a part rebuilt from newer data never repeats or loses another part's products", () => {
    const parts = 4;
    const order = products.map((p) => p.id);
    // newer data: one product removed, one added, one changed – only part 2 was rebuilt from it
    const newer = [...products.filter((p) => p.id !== order[10]), { id: "new-one", n: -1 }].map((p) => (p.id === order[20] ? { ...p, n: 999 } : p));
    const stale = Array.from({ length: parts }, (_, i) => productsOfPart(products, i, parts));
    stale[2] = productsOfPart(newer, 2, parts);
    const joined = joinParts(order, stale);
    const ids = joined.map((p) => p.id);
    expect(new Set(ids).size).toBe(ids.length); // nothing twice
    // everything the index knows is there unless its own (rebuilt) part dropped it
    for (const id of order) if (!(id === order[10] && partOf(id, parts) === 2)) expect(ids).toContain(id);
    if (partOf("new-one", parts) === 2) expect(ids.at(-1)).toBe("new-one"); // newer than the index → last
  });

  it("one build is shared while the parts refresh – and forgotten when something changes", async () => {
    let builds = 0;
    const build = async () => ++builds;
    const [a, b] = await Promise.all([sharedCatalogBuild(1, build), sharedCatalogBuild(1, build)]);
    expect(a).toBe(1);
    expect(b).toBe(1);
    expect(builds).toBe(1);
    expect(await sharedCatalogBuild(2, build)).toBe(2); // another store builds its own
    forgetCatalogBuilds();
    expect(await sharedCatalogBuild(1, build)).toBe(3);
  });
});
