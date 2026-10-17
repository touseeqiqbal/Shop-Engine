import "server-only";
import type { BlogPost, FaqItem, Testimonial } from "@/lib/types";
import type { SiteInfoOverrides } from "@/lib/site-info";
import type { PageSeoMap, PagesContentMap, SeoSettings } from "@/lib/content/registry";
import { isCmsConfigured } from "@/lib/db/config";
import { inStore, payloadClient, storefrontId, toMarkdown } from "./catalog-source";
import { log } from "@/lib/log";

/**
 * Site content managed in /cms (Store info, SEO, page texts, testimonials, FAQs, blog, redirects) – per store.
 * Settings never saved return null, so the storefront keeps its built-in defaults.
 */

type Doc = Record<string, unknown>;
const obj = (v: unknown): Doc => (v && typeof v === "object" ? (v as Doc) : {});
const str = (v: unknown) => (typeof v === "string" ? v.trim() : "");
const arr = (v: unknown) => (Array.isArray(v) ? (v as Doc[]) : []);
const clean = <T extends Record<string, unknown>>(o: T) => Object.fromEntries(Object.entries(o).filter(([, v]) => v !== "" && v !== undefined && v !== null)) as Partial<T>;

/** A store's saved settings page (its own document; the default store falls back to the original global). */
async function savedGlobal(slug: string, storeId: number | null): Promise<Doc | null> {
  if (!isCmsConfigured) return null;
  try {
    const { getStoreSettings } = await import("@/payload/store-settings");
    const g = await getStoreSettings<Doc>(await payloadClient(), slug as never, storeId, { depth: 1 });
    return g.updatedAt ? g : null;
  } catch (e) {
    log.error("site.settings_unavailable", e, { slug });
    return null;
  }
}

export async function cmsSiteInfo(storeId: number | null): Promise<SiteInfoOverrides | null> {
  const g = await savedGlobal("store-info", storeId);
  if (!g) return null;
  const geo = obj(g.geo);
  return {
    ...clean({ name: str(g.name), shortName: str(g.shortName), tagline: str(g.tagline), description: str(g.description), email: str(g.email), hoursDisplay: str(g.hoursDisplay), whatsappNote: str(g.whatsappNote), mapLink: str(g.mapLink), mapEmbed: str(g.mapEmbed) }),
    address: clean(Object.fromEntries(Object.entries(obj(g.address)).map(([k, v]) => [k, str(v)]))),
    geo: clean({ lat: typeof geo.lat === "number" ? geo.lat : undefined, lng: typeof geo.lng === "number" ? geo.lng : undefined }),
    phones: arr(g.phones).map((p) => ({ label: str(p.label), display: str(p.display), tel: str(p.tel), wa: str(p.wa) })),
    hours: arr(g.hours).map((h) => ({ days: Array.isArray(h.days) ? (h.days as string[]) : [], opens: str(h.opens), closes: str(h.closes) })),
    social: Object.fromEntries(Object.entries(obj(g.social)).map(([k, v]) => [k, str(v)])),
    couriers: Array.isArray(g.couriers) ? (g.couriers as string[]) : undefined,
  } as SiteInfoOverrides;
}

export async function cmsSeo(storeId: number | null): Promise<{ settings: Partial<SeoSettings>; pages: PageSeoMap } | null> {
  const g = await savedGlobal("seo-settings", storeId);
  if (!g) return null;
  const pages: PageSeoMap = {};
  for (const p of arr(g.pages)) {
    const key = str(p.page);
    if (!key) continue;
    pages[key] = clean({
      title: str(p.title),
      description: str(p.description),
      ogImage: str(p.ogImage),
      noindex: p.indexing === "noindex" ? true : p.indexing === "index" ? false : undefined,
    });
  }
  return {
    settings: {
      titleTemplate: str(g.titleTemplate),
      defaultTitle: str(g.defaultTitle),
      defaultDescription: str(g.defaultDescription),
      defaultOgImage: str(g.defaultOgImage),
      keywords: Array.isArray(g.keywords) ? (g.keywords as string[]) : [],
      googleVerification: str(g.googleVerification),
      bingVerification: str(g.bingVerification),
      facebookVerification: str(g.facebookVerification),
      ga4Id: str(g.ga4Id),
      metaPixelId: str(g.metaPixelId),
      discourageIndexing: g.discourageIndexing === true,
    },
    pages,
  };
}

export async function cmsPageTexts(storeId: number | null): Promise<PagesContentMap | null> {
  const g = await savedGlobal("page-texts", storeId);
  if (!g) return null;
  const out: PagesContentMap = {};
  for (const p of arr(g.pages)) {
    const key = str(p.page);
    if (key) out[key] = clean({ eyebrow: str(p.eyebrow), title: str(p.title), description: str(p.description), intro: str(p.intro), body: str(p.body), seoCopy: str(p.seoCopy), updated: str(p.updated).slice(0, 10) });
  }
  return out;
}

export async function cmsTestimonials(storeId: number | null): Promise<Testimonial[] | null> {
  const g = await savedGlobal("testimonials", storeId);
  return g ? arr(g.items).map((t) => ({ name: str(t.name), city: str(t.city), rating: Number(t.rating) || 5, text: str(t.text), ...(str(t.product) ? { product: str(t.product) } : {}) })) : null;
}

export async function cmsFaqs(storeId: number | null): Promise<FaqItem[] | null> {
  const g = await savedGlobal("faqs", storeId);
  return g ? arr(g.items).map((f) => ({ q: str(f.q), a: str(f.a), ...(str(f.group) ? { group: str(f.group) } : {}) })) : null;
}

/** Published blog posts from /cms → Content → Blog posts (Markdown content, as the blog renders it). */
export async function cmsBlogPosts(storeId: number | null): Promise<BlogPost[]> {
  const payload = await payloadClient();
  const res = await payload.find({ collection: "posts" as never, where: { and: [{ _status: { equals: "published" } }, inStore(storeId)] }, limit: 0, pagination: false, depth: 1, overrideAccess: true, sort: "-publishedAt" });
  return Promise.all(
    (res.docs as Doc[]).map(async (p): Promise<BlogPost> => {
      const meta = obj(p.meta);
      return {
        id: storefrontId(p),
        slug: str(p.slug),
        title: str(p.title),
        excerpt: str(p.excerpt),
        content: await toMarkdown(payload, p.content),
        cover: str(obj(p.cover).url),
        category: str(p.category),
        tags: Array.isArray(p.tags) ? (p.tags as string[]) : [],
        author: str(p.author),
        publishedAt: str(p.publishedAt) || str(p.createdAt),
        updatedAt: str(p.lastEdited) || undefined,
        relatedProducts: arr(p.relatedProducts).map((x) => str(x.slug)).filter(Boolean),
        relatedCategories: arr(p.relatedCategories).map((x) => str(x.slug)).filter(Boolean),
        seoTitle: str(meta.title) || undefined,
        seoDescription: str(meta.description) || undefined,
        seoNoindex: meta.noindex === true || undefined,
        seoCanonical: str(meta.canonical) || undefined,
        status: "published",
      };
    })
  );
}

/** A store's redirects from /cms → Settings → Redirects: from-path → { to, permanent }. */
export async function cmsRedirects(storeId: number | null): Promise<Map<string, { toPath: string; permanent: boolean }>> {
  const payload = await payloadClient();
  const res = await payload.find({ collection: "redirects" as never, where: inStore(storeId), limit: 0, pagination: false, depth: 1, overrideAccess: true });
  const map = new Map<string, { toPath: string; permanent: boolean }>();
  for (const r of res.docs as Doc[]) {
    const from = str(r.from);
    const to = obj(r.to);
    let target = str(to.url);
    if (!target && to.reference) {
      const ref = obj(to.reference);
      const value = obj(ref.value);
      const slug = str(value.slug);
      if (slug) target = ref.relationTo === "posts" ? `/blog/${slug}` : ref.relationTo === "categories" ? `/category/${slug}` : `/shop?q=${encodeURIComponent(slug)}`;
      if (ref.relationTo === "products" && slug) {
        const [{ getProductBySlug }, { runInStore }] = await Promise.all([import("@/lib/repo/catalog"), import("@/lib/tenant")]);
        target = (await runInStore(storeId, () => getProductBySlug(slug)))?.url ?? target;
      }
    }
    if (from && target) map.set(from, { toPath: target, permanent: !["302", "307"].includes(str(r.type)) });
  }
  return map;
}
