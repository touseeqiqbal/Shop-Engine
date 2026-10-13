import "server-only";
import { isDatabaseConfigured } from "@/lib/db/config";
import { prisma } from "@/lib/db/prisma";
import { Prisma } from "@/generated/prisma/client";
import { mediaUrl } from "@/lib/media";
import type {
  Banner,
  BlogPost,
  Brand,
  Category,
  Coupon,
  FlashSale,
  LaptopModel,
  Order,
  Product,
  Redirect,
  Review,
} from "@/lib/types";
import * as seed from "@/lib/data/seed";

/**
 * Minimal table gateway with two interchangeable back-ends:
 *  - PostgreSQL via Prisma when DATABASE_URL is set
 *  - an in-memory store initialised from the seed data otherwise ("demo mode")
 * Prisma field names are identical to the app types, so rows map 1:1. Dates are returned as ISO strings and
 * nulls as undefined so callers see exactly the shapes declared in src/lib/types.ts.
 */

export interface TableMap {
  categories: Category;
  brands: Brand;
  laptop_models: LaptopModel;
  products: Product;
  reviews: Review;
  blog_posts: BlogPost;
  banners: Banner;
  coupons: Coupon;
  flash_sales: FlashSale;
  redirects: Redirect;
  orders: Order;
}
export type TableName = keyof TableMap;

export const PRIMARY_KEYS: { [K in TableName]: keyof TableMap[K] & string } = {
  categories: "id",
  brands: "slug",
  laptop_models: "id",
  products: "id",
  reviews: "id",
  blog_posts: "id",
  banners: "id",
  coupons: "code",
  flash_sales: "id",
  redirects: "fromPath",
  orders: "id",
};

const DELEGATES: Record<TableName, string> = {
  categories: "category",
  brands: "brand",
  laptop_models: "laptopModel",
  products: "product",
  reviews: "review",
  blog_posts: "blogPost",
  banners: "banner",
  coupons: "coupon",
  flash_sales: "flashSale",
  redirects: "redirect",
  orders: "order",
};

/** Scalar columns per table – anything else on an incoming object (derived fields like `url`) is dropped. */
const FIELDS: Record<TableName, Set<string>> = {
  categories: new Set(Object.values(Prisma.CategoryScalarFieldEnum)),
  brands: new Set(Object.values(Prisma.BrandScalarFieldEnum)),
  laptop_models: new Set(Object.values(Prisma.LaptopModelScalarFieldEnum)),
  products: new Set(Object.values(Prisma.ProductScalarFieldEnum)),
  reviews: new Set(Object.values(Prisma.ReviewScalarFieldEnum)),
  blog_posts: new Set(Object.values(Prisma.BlogPostScalarFieldEnum)),
  banners: new Set(Object.values(Prisma.BannerScalarFieldEnum)),
  coupons: new Set(Object.values(Prisma.CouponScalarFieldEnum)),
  flash_sales: new Set(Object.values(Prisma.FlashSaleScalarFieldEnum)),
  redirects: new Set(Object.values(Prisma.RedirectScalarFieldEnum)),
  orders: new Set(Object.values(Prisma.OrderScalarFieldEnum)),
};

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Delegate = any;
const delegate = (table: TableName): Delegate => (prisma as unknown as Record<string, Delegate>)[DELEGATES[table]];

/** DB row → app object: Date → ISO string, null → undefined (top level only). */
export function fromDb<T>(row: Record<string, unknown>): T {
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(row)) {
    if (v === null) continue;
    out[k] = v instanceof Date ? v.toISOString() : v;
  }
  return out as T;
}

/** App object → Prisma data: keep known scalar columns only; undefined → omitted. */
export function toDb(table: TableName, obj: object): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(obj)) {
    if (!FIELDS[table].has(k) || v === undefined) continue;
    out[k] = v;
  }
  // Uploaded photos live in product_images; never persist their derived /media URLs in the legacy column.
  if (table === "products" && Array.isArray(out.images)) out.images = (out.images as string[]).filter((u) => !u.startsWith("/media/"));
  return out;
}

const productInclude = { productImages: { orderBy: { sortOrder: "asc" as const } } };

/** Merge uploaded ProductImage rows into `images` / `imageAlts`. */
function withImages(row: Record<string, unknown>): Product {
  const pics = (row.productImages as { key: string; alt: string }[] | undefined) ?? [];
  const { productImages: _omit, ...rest } = row;
  void _omit;
  const p = fromDb<Product>(rest);
  if (pics.length) {
    p.images = pics.map((i) => mediaUrl(i.key));
    p.imageAlts = pics.map((i) => i.alt || p.name);
  }
  return p;
}

// ───────────────────────────── memory back-end ─────────────────────────────

type MemoryDb = { [K in TableName]: TableMap[K][] } & { settings: Record<string, unknown> };

const g = globalThis as unknown as { __urkoMemoryDb?: MemoryDb };

function memory(): MemoryDb {
  if (!g.__urkoMemoryDb) {
    g.__urkoMemoryDb = structuredClone({
      categories: seed.seedCategories,
      brands: seed.seedBrands,
      laptop_models: seed.seedLaptopModels,
      products: seed.seedProducts,
      reviews: seed.seedReviews,
      blog_posts: seed.seedBlogPosts,
      banners: seed.seedBanners,
      coupons: seed.seedCoupons,
      flash_sales: seed.seedFlashSales,
      redirects: seed.seedRedirects,
      orders: [] as Order[],
      settings: { store: seed.seedSettings, testimonials: seed.seedTestimonials, faqs: seed.seedFaqs } as Record<string, unknown>,
    });
  }
  return g.__urkoMemoryDb!;
}

// ───────────────────────────── public API ─────────────────────────────

/** Reads every row of a table. `privileged` is accepted for backwards compatibility and ignored. */
export async function listAll<K extends TableName>(table: K, _opts: { privileged?: boolean } = {}): Promise<TableMap[K][]> {
  void _opts;
  if (!isDatabaseConfigured) return structuredClone(memory()[table]) as TableMap[K][];
  if (table === "products") {
    const rows = await prisma.product.findMany({ include: productInclude });
    return rows.map((r) => withImages(r as unknown as Record<string, unknown>)) as TableMap[K][];
  }
  const rows: Record<string, unknown>[] = await delegate(table).findMany();
  return rows.map((r) => fromDb<TableMap[K]>(r));
}

export async function getOne<K extends TableName>(
  table: K,
  column: keyof TableMap[K] & string,
  value: string,
  _opts: { privileged?: boolean } = {}
): Promise<TableMap[K] | null> {
  void _opts;
  if (!isDatabaseConfigured) {
    const row = memory()[table].find((r) => String((r as unknown as Record<string, unknown>)[column]) === value);
    return row ? (structuredClone(row) as TableMap[K]) : null;
  }
  const args: Record<string, unknown> = { where: { [column]: value } };
  if (table === "products") args.include = productInclude;
  const row: Record<string, unknown> | null = await delegate(table).findFirst(args);
  if (!row) return null;
  return (table === "products" ? withImages(row) : fromDb<TableMap[K]>(row)) as TableMap[K];
}

/** Insert or update by primary key. */
export async function upsert<K extends TableName>(table: K, row: TableMap[K]): Promise<TableMap[K]> {
  const pk = PRIMARY_KEYS[table];
  if (!isDatabaseConfigured) {
    const rows = memory()[table] as TableMap[K][];
    const i = rows.findIndex((r) => r[pk] === row[pk]);
    if (i >= 0) rows[i] = structuredClone(row);
    else rows.push(structuredClone(row));
    return row;
  }
  const data = toDb(table, row);
  const saved: Record<string, unknown> = await delegate(table).upsert({
    where: { [pk]: row[pk] },
    create: data,
    update: data,
    ...(table === "products" ? { include: productInclude } : {}),
  });
  return (table === "products" ? withImages(saved) : fromDb<TableMap[K]>(saved)) as TableMap[K];
}

export async function remove<K extends TableName>(table: K, key: string) {
  const pk = PRIMARY_KEYS[table];
  if (!isDatabaseConfigured) {
    const db = memory();
    (db[table] as TableMap[K][]) = (db[table] as TableMap[K][]).filter((r) => String(r[pk]) !== key) as never;
    return;
  }
  await delegate(table).deleteMany({ where: { [pk]: key } });
}

// ───────────────────────────── key/value settings ─────────────────────────────

export async function getSetting<T>(key: string, fallback: T): Promise<T> {
  if (!isDatabaseConfigured) return structuredClone((memory().settings[key] as T) ?? fallback);
  const row = await prisma.setting.findUnique({ where: { key } });
  return (row?.value as T) ?? fallback;
}

/** Direct access to the memory store – only for repo modules that need custom queries in demo mode. */
export function memoryDb() {
  return memory();
}
