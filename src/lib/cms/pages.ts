import "server-only";
import { unstable_cache } from "next/cache";
import { convertLexicalToHTML } from "@payloadcms/richtext-lexical/html";
import type { SerializedEditorState } from "@payloadcms/richtext-lexical/lexical";
import { isCmsConfigured } from "@/lib/db/config";
import { getHomeConfig } from "@/lib/repo/site-content";
import { PAGES_TAG } from "@/payload/revalidate";
import { legacyHomeToPage, textWithDefaults, emptyText, type BlockText, type PageBlock, type PageData, type ProductSource } from "./blocks-types";
import type { HomeSectionType } from "@/lib/content/home";

/**
 * Page-builder pages from Payload (collection `pages`), resolved for the storefront.
 * Published pages are cached under PAGES_TAG (revalidated when an editor publishes);
 * in Draft Mode (live preview) the latest draft is read uncached.
 */

type Doc = Record<string, unknown>;
type Rel = Doc | number | string | null | undefined;

const obj = (v: Rel): Doc | null => (v && typeof v === "object" ? v : null);
const str = (v: unknown) => (typeof v === "string" ? v.trim() : "");
/** Storefront ids of related docs: legacy id for migrated records, Payload id for ones created in /cms. */
const legacyIds = (v: unknown) =>
  Array.isArray(v)
    ? v.map((x) => {
        const d = obj(x as Rel);
        return d ? str(d.legacyId) || String(d.id) : "";
      }).filter(Boolean)
    : [];
const media = (v: unknown) => {
  const m = obj(v as Rel);
  return { url: str(m?.url), alt: str(m?.alt) };
};
const limitOf = (v: unknown) => (Number.isFinite(Number(v)) && Number(v) > 0 ? Math.min(48, Math.round(Number(v))) : undefined);

function richHtml(v: unknown): string {
  const state = obj(v as Rel) as SerializedEditorState | null;
  const children = state?.root?.children ?? [];
  const empty = !children.length || (children.length === 1 && !((children[0] as { children?: unknown[] }).children?.length));
  if (empty) return "";
  try {
    return convertLexicalToHTML({ data: state! });
  } catch {
    return "";
  }
}

/** Section heading text: the editor's text, with the legacy section defaults for empty fields. */
function text(b: Doc, defaultsFrom: HomeSectionType | null): BlockText {
  const t = { eyebrow: str(b.eyebrow), title: str(b.title), description: str(b.description), linkLabel: str(b.linkLabel), linkHref: str(b.linkHref) };
  return defaultsFrom ? textWithDefaults(defaultsFrom, t) : { ...emptyText(), ...t };
}

function toBlock(b: Doc): PageBlock | null {
  switch (b.blockType) {
    case "hero":
      return {
        type: "hero",
        slides: (Array.isArray(b.slides) ? (b.slides as Doc[]) : [])
          .map((s, i) => ({ id: str(s.id) || String(i), eyebrow: str(s.eyebrow) || undefined, title: str(s.title), subtitle: str(s.subtitle), ctaLabel: str(s.ctaLabel), ctaHref: str(s.ctaHref) || "/shop", image: media(s.image).url || str(s.imageUrl), accent: str(s.accent) || undefined }))
          .filter((s) => s.image && s.title),
      };
    case "trust":
      return { type: "trust", badges: (Array.isArray(b.badges) ? (b.badges as Doc[]) : []).map((x) => ({ title: str(x.title), text: str(x.text) })).filter((x) => x.title) };
    case "categories":
      return { type: "categories", text: text(b, "categories"), categoryIds: legacyIds(b.categories) };
    case "deals":
      return { type: "deals", text: text(b, "deals"), source: b.source === "manual" ? "manual" : "auto", productIds: legacyIds(b.products), limit: limitOf(b.limit) };
    case "products": {
      const source = (["newArrivals", "bestSellers", "topAccessories", "category", "collection", "manual"].includes(String(b.source)) ? b.source : "newArrivals") as ProductSource;
      const cat = obj(b.category as Rel);
      let t: BlockText;
      if (source === "category") {
        // Defaults for a category carousel: category name + "View all" → category page
        t = text(b, null);
        t.title ||= str(cat?.name) || "Products";
        if (!t.linkHref && cat?.slug) t.linkHref = `/category/${str(cat.slug)}`;
        if (t.linkHref) t.linkLabel ||= "View all";
      } else if (source === "collection") {
        const col = obj(b.collection as Rel);
        t = text(b, null);
        t.title ||= str(col?.title) || "Featured products";
        if (!t.linkHref && col?.slug) t.linkHref = `/collections/${str(col.slug)}`;
        if (t.linkHref) t.linkLabel ||= "View all";
      } else if (source === "manual") {
        t = text(b, null);
        t.title ||= "Featured products";
      } else {
        t = text(b, source);
      }
      return { type: "products", text: t, source, categoryId: (cat ? str(cat.legacyId) || String(cat.id) : "") || undefined, collectionSlug: str(obj(b.collection as Rel)?.slug) || undefined, productIds: legacyIds(b.products), limit: limitOf(b.limit) };
    }
    case "finder":
    case "brands":
    case "installment":
    case "testimonials":
    case "social":
    case "location":
      return { type: b.blockType, text: text(b, b.blockType) };
    case "richText": {
      const html = richHtml(b.content);
      const markdown = str(b.markdown);
      if (!html && !markdown) return null;
      return { type: "richText", html: html || undefined, markdown: html ? undefined : markdown, boxed: b.boxed !== false, width: b.width === "narrow" ? "narrow" : "wide" };
    }
    case "imageBanner": {
      const m = media(b.image);
      if (!m.url) return null;
      return {
        type: "imageBanner", image: m.url, alt: m.alt, eyebrow: str(b.eyebrow), heading: str(b.heading), text: str(b.text), buttonLabel: str(b.buttonLabel), buttonHref: str(b.buttonHref),
        align: b.align === "center" ? "center" : "left", height: b.height === "sm" || b.height === "lg" ? b.height : "md",
      };
    }
    case "imageText": {
      const m = media(b.image);
      if (!m.url) return null;
      return { type: "imageText", image: m.url, alt: m.alt, eyebrow: str(b.eyebrow), heading: str(b.heading), html: richHtml(b.content), buttonLabel: str(b.buttonLabel), buttonHref: str(b.buttonHref), imageSide: b.imageSide === "right" ? "right" : "left" };
    }
    case "faq": {
      const items = (Array.isArray(b.items) ? (b.items as Doc[]) : []).map((x) => ({ question: str(x.question), answer: str(x.answer) })).filter((x) => x.question && x.answer);
      return items.length ? { type: "faq", text: text(b, null), items } : null;
    }
    case "cta":
      return {
        type: "cta", heading: str(b.heading), text: str(b.text),
        buttons: (Array.isArray(b.buttons) ? (b.buttons as Doc[]) : [])
          .map((x) => ({ label: str(x.label), href: str(x.href), style: (x.style === "secondary" || x.style === "whatsapp" ? x.style : "primary") as "primary" | "secondary" | "whatsapp" }))
          .filter((x) => x.label && x.href),
      };
    default:
      return null;
  }
}

function toPage(doc: Doc): PageData {
  const meta = obj(doc.meta as Rel);
  return {
    title: str(doc.title),
    slug: str(doc.slug),
    h1Highlight: str(doc.h1Highlight),
    h1Text: str(doc.h1Text) || (str(doc.h1Highlight) ? "" : str(doc.title)),
    blocks: (Array.isArray(doc.layout) ? (doc.layout as Doc[]) : []).map(toBlock).filter((b): b is PageBlock => Boolean(b)),
    meta: { title: str(meta?.title) || undefined, description: str(meta?.description) || undefined, image: media(meta?.image).url || undefined, noindex: meta?.noindex === true || undefined, canonical: str(meta?.canonical) || undefined },
    fromCms: true,
  };
}

async function payloadClient() {
  const [{ getPayload }, { default: config }] = await Promise.all([import("payload"), import("@payload-config")]);
  return getPayload({ config });
}

async function fetchPage(slug: string, draft: boolean): Promise<PageData | null> {
  if (!isCmsConfigured) return null;
  try {
    const payload = await payloadClient();
    const res = await payload.find({
      collection: "pages" as never,
      where: draft ? { slug: { equals: slug } } : { and: [{ slug: { equals: slug } }, { _status: { equals: "published" } }] },
      draft,
      depth: 1,
      limit: 1,
      overrideAccess: true,
    });
    const doc = res.docs[0] as Doc | undefined;
    return doc ? toPage(doc) : null;
  } catch (e) {
    // Never break the storefront because the CMS is unavailable.
    console.error(`[pages] could not load "${slug}":`, e);
    return null;
  }
}

const cachedPage = unstable_cache((slug: string) => fetchPage(slug, false), ["cms-page-v1"], { tags: [PAGES_TAG], revalidate: 300 });

/** A published page (or the latest draft in preview), null if it doesn't exist. */
export function getPage(slug: string, { draft = false } = {}) {
  return draft ? fetchPage(slug, true) : cachedPage(slug);
}

/** Home page: the Payload page "home" when it exists, otherwise the legacy home builder config. */
export async function getHomePage({ draft = false } = {}): Promise<PageData> {
  return (await getPage("home", { draft })) ?? legacyHomeToPage(await getHomeConfig());
}

/** Published pages for the sitemap (home excluded – it's "/"). */
export const listPublishedPages = unstable_cache(
  async (): Promise<{ slug: string; updatedAt: string }[]> => {
    if (!isCmsConfigured) return [];
    try {
      const payload = await payloadClient();
      const res = await payload.find({ collection: "pages" as never, where: { _status: { equals: "published" } }, depth: 0, limit: 0, pagination: false, overrideAccess: true, select: { slug: true, updatedAt: true, meta: true } as never });
      // pages hidden from search engines (or pointing at another original) stay out of the sitemap
      return (res.docs as Doc[])
        .filter((d) => obj(d.meta as Rel)?.noindex !== true && !str(obj(d.meta as Rel)?.canonical))
        .map((d) => ({ slug: str(d.slug), updatedAt: str(d.updatedAt) }))
        .filter((d) => d.slug && d.slug !== "home");
    } catch {
      return [];
    }
  },
  ["cms-pages-list-v2"],
  { tags: [PAGES_TAG], revalidate: 300 }
);
