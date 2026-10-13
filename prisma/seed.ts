/**
 * Idempotent database seed:  npm run db:seed   (or `npx prisma db seed`)
 *
 * Upserts every seed array from src/lib/data/seed/* by primary key, so it can be re-run safely:
 * seed rows are refreshed, anything you created yourself (products, orders, users…) is untouched.
 * Optionally creates/updates the first admin from SEED_ADMIN_EMAIL / SEED_ADMIN_PASSWORD.
 */
import "dotenv/config";
import bcrypt from "bcryptjs";
import type { Prisma } from "../src/generated/prisma/client";
import { prisma } from "../src/lib/db/prisma";
import {
  seedBanners,
  seedBlogPosts,
  seedBrands,
  seedCategories,
  seedCoupons,
  seedFaqs,
  seedFlashSales,
  seedLaptopModels,
  seedProducts,
  seedRedirects,
  seedReviews,
  seedSettings,
  seedTestimonials,
} from "../src/lib/data/seed";
import type { Category } from "../src/lib/types";

const json = (v: unknown) => v as Prisma.InputJsonValue;
const date = (v: string | null | undefined) => (v ? new Date(v) : null);

/** Parents before children so the self-referencing foreign key is always satisfied. */
function parentsFirst(categories: Category[]): Category[] {
  const byId = new Map(categories.map((c) => [c.id, c]));
  const depth = (c: Category, guard = 0): number =>
    c.parentId && byId.has(c.parentId) && guard < 50 ? 1 + depth(byId.get(c.parentId)!, guard + 1) : 0;
  return [...categories].sort((a, b) => depth(a) - depth(b));
}

async function upsertAll<T>(label: string, rows: T[], fn: (row: T) => Promise<unknown>) {
  for (const row of rows) await fn(row);
  console.log(`  ${label.padEnd(14)} ${rows.length}`);
}

async function main() {
  if (!process.env.DATABASE_URL) throw new Error("DATABASE_URL is not set – nothing to seed (the app runs in demo mode without it).");
  console.log("Seeding database…");

  await upsertAll("brands", seedBrands, (b) =>
    prisma.brand.upsert({ where: { slug: b.slug }, create: b, update: b })
  );

  await upsertAll("categories", parentsFirst(seedCategories), (c) => {
    const data = { ...c, attributes: json(c.attributes) };
    return prisma.category.upsert({ where: { id: c.id }, create: data, update: data });
  });

  await upsertAll("laptopModels", seedLaptopModels, (m) =>
    prisma.laptopModel.upsert({ where: { id: m.id }, create: m, update: m })
  );

  await upsertAll("products", seedProducts, (p) => {
    const data = {
      ...p,
      specs: json(p.specs),
      attributes: json(p.attributes),
      upgrades: json(p.upgrades),
      // Json? column: send an object or leave it untouched (never a bare null)
      wholesale: p.wholesale ? json(p.wholesale) : undefined,
      priceOnRequest: Boolean(p.priceOnRequest),
      dealEndsAt: date(p.dealEndsAt),
      createdAt: new Date(p.createdAt),
    };
    return prisma.product.upsert({ where: { id: p.id }, create: data, update: data });
  });

  await upsertAll("reviews", seedReviews, (r) => {
    const data = { ...r, createdAt: new Date(r.createdAt) };
    return prisma.review.upsert({ where: { id: r.id }, create: data, update: data });
  });

  await upsertAll("blogPosts", seedBlogPosts, (p) => {
    const data = { ...p, publishedAt: new Date(p.publishedAt), updatedAt: date(p.updatedAt) };
    return prisma.blogPost.upsert({ where: { id: p.id }, create: data, update: data });
  });

  await upsertAll("banners", seedBanners, (b) =>
    prisma.banner.upsert({ where: { id: b.id }, create: b, update: b })
  );

  // Coupons: keep the live `used` counter when re-seeding.
  await upsertAll("coupons", seedCoupons, (c) => {
    const data = { ...c, expiresAt: date(c.expiresAt) };
    const { used: _used, ...update } = data;
    return prisma.coupon.upsert({ where: { code: c.code }, create: data, update });
  });

  await upsertAll("flashSales", seedFlashSales, (f) => {
    const data = { ...f, endsAt: new Date(f.endsAt) };
    return prisma.flashSale.upsert({ where: { id: f.id }, create: data, update: data });
  });

  await upsertAll("redirects", seedRedirects, (r) =>
    prisma.redirect.upsert({ where: { fromPath: r.fromPath }, create: r, update: r })
  );

  const settings: { key: string; value: unknown }[] = [
    { key: "store", value: seedSettings },
    { key: "testimonials", value: seedTestimonials },
    { key: "faqs", value: seedFaqs },
  ];
  await upsertAll("settings", settings, (s) =>
    prisma.setting.upsert({ where: { key: s.key }, create: { key: s.key, value: json(s.value) }, update: { value: json(s.value) } })
  );

  const email = process.env.SEED_ADMIN_EMAIL?.trim().toLowerCase();
  const password = process.env.SEED_ADMIN_PASSWORD;
  if (email && password) {
    if (password.length < 8) throw new Error("SEED_ADMIN_PASSWORD must be at least 8 characters.");
    const passwordHash = await bcrypt.hash(password, 12);
    await prisma.user.upsert({
      where: { email },
      create: { email, passwordHash, name: "Store Admin", role: "admin" },
      update: { passwordHash, role: "admin" },
    });
    console.log(`  admin user     ${email}`);
  } else {
    console.log("  admin user     skipped (set SEED_ADMIN_EMAIL and SEED_ADMIN_PASSWORD to create one)");
  }

  console.log("Done.");
}

main()
  .catch((e) => {
    console.error(e);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
