import { getPageMeta } from "@/lib/page-seo";
import type { Metadata, MetadataRoute } from "next";
import { getAllProducts, getBlogPosts, getBrands, getCategories } from "@/lib/repo/catalog";
import { blogCategories, blogTags } from "@/lib/blog";
import { LANDING_CITIES, citySlug } from "@/lib/cities";
import { absoluteUrl } from "@/lib/site";
import { listPublishedPages } from "@/lib/cms/pages";
import { listCollections } from "@/lib/cms/collections";
import { indexable } from "@/lib/seo";

export const revalidate = 3600;

type Entry = MetadataRoute.Sitemap[number];

const STATIC_PAGES: { path: string; priority: number; changeFrequency: Entry["changeFrequency"] }[] = [
  { path: "/", priority: 1, changeFrequency: "daily" },
  { path: "/shop", priority: 0.9, changeFrequency: "daily" },
  { path: "/category", priority: 0.8, changeFrequency: "weekly" },
  { path: "/deals", priority: 0.8, changeFrequency: "daily" },
  { path: "/find-parts", priority: 0.8, changeFrequency: "weekly" },
  { path: "/wholesale", priority: 0.8, changeFrequency: "weekly" },
  { path: "/brands", priority: 0.6, changeFrequency: "weekly" },
  { path: "/blog", priority: 0.7, changeFrequency: "weekly" },
  { path: "/about", priority: 0.6, changeFrequency: "monthly" },
  { path: "/contact", priority: 0.6, changeFrequency: "monthly" },
  { path: "/faqs", priority: 0.5, changeFrequency: "monthly" },
  { path: "/track-order", priority: 0.4, changeFrequency: "yearly" },
  { path: "/shipping-policy", priority: 0.4, changeFrequency: "yearly" },
  { path: "/warranty-returns", priority: 0.4, changeFrequency: "yearly" },
  { path: "/returns", priority: 0.3, changeFrequency: "yearly" },
  { path: "/sell-your-laptop", priority: 0.5, changeFrequency: "monthly" },
  { path: "/installments", priority: 0.4, changeFrequency: "monthly" },
  { path: "/privacy-policy", priority: 0.2, changeFrequency: "yearly" },
  { path: "/terms", priority: 0.2, changeFrequency: "yearly" },
];

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const [products, categories, brands, posts, builderPages] = await Promise.all([getAllProducts(), getCategories(), getBrands(), getBlogPosts(), listPublishedPages()]);
  const collections = await listCollections().catch((e) => (console.error("[sitemap] collections unavailable:", e), []));
  // built-in pages set to "Noindex" in /cms → Settings → Google & SEO → Built-in pages stay out of the sitemap
  const noindexed = new Set((await Promise.all(STATIC_PAGES.map(async (p) => ((await getPageMeta(p.path).catch(() => ({}) as Metadata)).robots as { index?: boolean } | undefined)?.index === false ? p.path : ""))).filter(Boolean));
  const now = new Date();
  const latest = (dates: string[]) => (dates.length ? new Date(dates.reduce((a, b) => (a > b ? a : b))) : now);

  const entries: MetadataRoute.Sitemap = STATIC_PAGES.filter((p) => !noindexed.has(p.path)).map((p) => ({
    url: absoluteUrl(p.path),
    lastModified: now,
    changeFrequency: p.changeFrequency,
    priority: p.priority,
  }));

  // Pages built in /cms (page builder)
  for (const p of builderPages) {
    entries.push({ url: absoluteUrl(`/pages/${p.slug}`), lastModified: p.updatedAt ? new Date(p.updatedAt) : now, changeFrequency: "monthly", priority: 0.5 });
  }

  for (const c of collections) {
    entries.push({ url: absoluteUrl(`/collections/${c.slug}`), lastModified: c.updatedAt ? new Date(c.updatedAt) : now, changeFrequency: "weekly", priority: 0.7 });
  }

  for (const c of categories.filter(indexable)) {
    const inCat = products.filter((p) => p.categorySlug === c.slug || p.topCategorySlug === c.slug);
    if (!inCat.length) continue; // an empty category is a thin page – not worth Google's time
    entries.push({
      url: absoluteUrl(`/category/${c.slug}`),
      lastModified: latest(inCat.map((p) => p.updatedAt || p.createdAt)),
      changeFrequency: "daily",
      priority: c.parentId ? 0.7 : 0.8,
    });
  }

  for (const p of products.filter(indexable)) {
    entries.push({
      url: absoluteUrl(p.url),
      lastModified: new Date(p.updatedAt || p.createdAt),
      changeFrequency: "weekly",
      priority: p.topCategorySlug === "laptops" ? 0.8 : 0.7,
      images: p.images.slice(0, 3).map((i) => absoluteUrl(i)),
    });
  }

  const brandsWithProducts = new Set(products.map((p) => p.brand));
  for (const b of brands.filter((b) => brandsWithProducts.has(b.slug))) {
    entries.push({ url: absoluteUrl(`/brands/${b.slug}`), lastModified: now, changeFrequency: "weekly", priority: 0.6 });
  }

  for (const post of posts.filter(indexable)) {
    entries.push({
      url: absoluteUrl(`/blog/${post.slug}`),
      lastModified: new Date(post.updatedAt ?? post.publishedAt),
      changeFrequency: "monthly",
      priority: 0.6,
      images: [absoluteUrl(post.cover)],
    });
  }
  for (const c of blogCategories(posts)) {
    entries.push({ url: absoluteUrl(`/blog/category/${c.slug}`), lastModified: now, changeFrequency: "weekly", priority: 0.4 });
  }
  // Only tag archives with 2+ posts are indexable (single-post tags are noindex).
  for (const t of blogTags(posts).filter((t) => t.count >= 2)) {
    entries.push({ url: absoluteUrl(`/blog/tag/${t.slug}`), lastModified: now, changeFrequency: "weekly", priority: 0.3 });
  }

  for (const city of LANDING_CITIES) {
    entries.push({ url: absoluteUrl(`/laptops-in-${citySlug(city)}`), lastModified: now, changeFrequency: "weekly", priority: 0.7 });
  }

  return entries;
}
