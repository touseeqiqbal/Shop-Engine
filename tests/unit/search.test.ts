import { describe, expect, it } from "vitest";
import { rank, suggest, words } from "@/lib/search";

const P = (id: string, name: string, extra: Record<string, unknown> = {}) => ({ id, name, stock: 5, soldCount: 0, ...extra });
const catalog = [
  P("elite", "HP EliteBook 840 G8 – Core i5 11th Gen, 16GB, 256GB SSD", { brandName: "HP", categoryName: "Business Laptops", topCategoryName: "Laptops", sku: "HP-840G8" }),
  P("tp", "Lenovo ThinkPad T14 – Ryzen 5 Pro, 16GB, 512GB SSD", { brandName: "Lenovo", categoryName: "Laptops", topCategoryName: "Laptops" }),
  P("mba", "Apple MacBook Air M2 8GB 256GB", { brandName: "Apple", categoryName: "Laptops", topCategoryName: "Laptops" }),
  P("chg", "HP 65W Laptop Charger Type-C", { brandName: "HP", categoryName: "Chargers & Adapters", topCategoryName: "Chargers & Adapters", soldCount: 900 }),
  P("ram", "Kingston 8GB DDR4 3200 Laptop RAM", { brandName: "Kingston", categoryName: "RAM", topCategoryName: "RAM", attributes: { capacity: "8GB" }, soldCount: 800 }),
  P("mouse", "Logitech M185 Wireless Mouse", { brandName: "Logitech", categoryName: "Mouse", topCategoryName: "Mouse", soldCount: 560 }),
  P("pad", "Laptop Cooling Pad 5 Fans", { brandName: "Generic", categoryName: "Laptop Accessories", topCategoryName: "Laptop Accessories", soldCount: 700 }),
];
const ids = (q: string) => rank(catalog, q).map((r) => r.item.id);

describe("search", () => {
  it("normalises words, units and Urdu", () => {
    expect(words("Core i5 8 GB")).toEqual(["core", "i5", "8gb"]);
    expect(words("لیپ ٹاپ چارجر")).toEqual(["laptop", "charger"]);
  });
  it("puts actual laptops first for 'laptop', despite popular accessories", () => {
    const r = ids("laptop");
    expect(r.slice(0, 3).sort()).toEqual(["elite", "mba", "tp"]);
  });
  it("forgives typos", () => {
    expect(ids("elitbook")[0]).toBe("elite");
    expect(ids("macbok")[0]).toBe("mba");
    expect(ids("thinkpd")[0]).toBe("tp");
  });
  it("understands synonyms and units", () => {
    expect(ids("notebook").slice(0, 3).sort()).toEqual(["elite", "mba", "tp"]);
    expect(ids("hp adapter")[0]).toBe("chg");
    expect(ids("8gb ram")[0]).toBe("ram");
    expect(ids("wireless mice")[0]).toBe("mouse");
  });
  it("finds by SKU and Urdu", () => {
    expect(ids("hp-840g8")[0]).toBe("elite");
    expect(ids("ماؤس")[0]).toBe("mouse");
  });
  it("requires every word (one may miss when 3+ are typed)", () => {
    expect(ids("thinkpad charger")).toEqual([]);
    expect(ids("hp elitebook purple")[0]).toBe("elite");
  });
  it("suggests a corrected query", () => {
    expect(suggest(catalog, "logitec mose")).toBe("logitech mouse");
    expect(suggest(catalog, "laptop")).toBeNull();
  });
});

describe("search – closest matches", () => {
  it("falls back to the products matching most words", () => {
    const only16 = catalog.map((p) => (p.id === "ram" ? { ...p, name: "Kingston 16GB DDR4 Laptop RAM", attributes: { capacity: "16GB" } } : p));
    expect(rank(only16, "8gb ram")).toEqual([]);
    expect(rank(only16, "8gb ram", { closest: true })[0]?.item.id).toBe("ram");
  });
});

describe("search – numbers and model codes", () => {
  it("never 'corrects' sizes or model numbers", () => {
    expect(ids("12gb")).toEqual([]); // 16GB is not 12GB
    expect(ids("8250u")).toEqual([]);
    expect(suggest(catalog, "12gb")).toBeNull();
  });
  it("splits category names on '&' / 'and' only, not inside words", () => {
    const stands = [{ id: "s", name: "Aluminium Stand Pro", topCategoryName: "Laptop Stands", stock: 1 }, { id: "x", name: "Stand-up desk lamp", topCategoryName: "Lighting", stock: 1 }];
    expect(rank(stands, "stand")[0]?.item.id).toBe("s");
  });
});
