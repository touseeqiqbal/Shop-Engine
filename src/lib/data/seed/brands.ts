import type { Brand, LaptopModel } from "@/lib/types";

export const seedBrands: Brand[] = [
  { slug: "hp", name: "HP" },
  { slug: "dell", name: "Dell" },
  { slug: "lenovo", name: "Lenovo" },
  { slug: "apple", name: "Apple" },
  { slug: "asus", name: "Asus" },
  { slug: "acer", name: "Acer" },
  { slug: "msi", name: "MSI" },
  { slug: "logitech", name: "Logitech" },
  { slug: "razer", name: "Razer" },
  { slug: "redragon", name: "Redragon" },
  { slug: "a4tech", name: "A4Tech" },
  { slug: "samsung", name: "Samsung" },
  { slug: "kingston", name: "Kingston" },
  { slug: "tp-link", name: "TP-Link" },
  { slug: "ugreen", name: "Ugreen" },
  { slug: "urko", name: "Urko Essentials" },
  { slug: "mixed-brands", name: "Mixed Brands" },
];

function models(brand: string, series: string, names: string[]): LaptopModel[] {
  return names.map((name) => ({
    id: `${brand}-${name}`.toLowerCase().replace(/[^a-z0-9]+/g, "-"),
    brand,
    series,
    name,
  }));
}

/** Laptop models used by the "Find Parts for Your Laptop" compatibility finder. */
export const seedLaptopModels: LaptopModel[] = [
  ...models("hp", "EliteBook", [
    "EliteBook 840 G3", "EliteBook 840 G4", "EliteBook 840 G5", "EliteBook 840 G6", "EliteBook 840 G7", "EliteBook 840 G8",
    "EliteBook 850 G5", "EliteBook 850 G6", "EliteBook 830 G5", "EliteBook 830 G6",
  ]),
  ...models("hp", "ProBook", ["ProBook 450 G5", "ProBook 450 G6", "ProBook 450 G7", "ProBook 450 G8", "ProBook 440 G8"]),
  ...models("hp", "Pavilion", ["Pavilion 15", "Pavilion x360 14"]),
  ...models("dell", "Latitude", [
    "Latitude 5400", "Latitude 5410", "Latitude 5420", "Latitude 5430", "Latitude 7400", "Latitude 7410", "Latitude 7420",
    "Latitude 5490", "Latitude 7490", "Latitude 5300",
  ]),
  ...models("dell", "XPS", ["XPS 13 9310", "XPS 13 9300", "XPS 15 9500"]),
  ...models("dell", "Inspiron", ["Inspiron 15 3511", "Inspiron 15 3520"]),
  ...models("lenovo", "ThinkPad", [
    "ThinkPad T14 Gen 1", "ThinkPad T14 Gen 2", "ThinkPad T480", "ThinkPad T490", "ThinkPad X1 Carbon Gen 7",
    "ThinkPad X1 Carbon Gen 8", "ThinkPad E14", "ThinkPad L14",
  ]),
  ...models("lenovo", "IdeaPad", ["IdeaPad 3 15", "IdeaPad 5 14"]),
  ...models("apple", "MacBook", ["MacBook Air M1", "MacBook Air M2", "MacBook Pro 13 M1", "MacBook Pro 14 M3"]),
  ...models("asus", "TUF / VivoBook", ["TUF Gaming F15", "VivoBook 15", "ZenBook 14"]),
  ...models("acer", "Aspire / Nitro", ["Aspire 5", "Nitro 5"]),
];
