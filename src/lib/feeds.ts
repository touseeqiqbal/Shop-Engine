import "server-only";
import { unstable_cache } from "next/cache";
import { getAllProducts, getProductDescription, getStoreSettings } from "@/lib/repo/catalog";
import { absoluteUrl } from "@/lib/site";
import { jpegImageUrl } from "@/lib/seo";
import { isCmsConfigured } from "@/lib/db/config";
import { currentStoreId } from "@/lib/tenant";
import type { CatalogProduct } from "@/lib/types";
import { effectivePrice } from "@/lib/utils";

/**
 * Product feed items for Google Merchant Center, Meta and TikTok – built from the live catalog
 * (active products, prices in PKR, condition, availability, images, delivery price).
 * No GTIN / MPN: every item says identifier_exists = no.
 */

export type FeedChannel = "google" | "meta" | "tiktok";
type Settings = { google: boolean; meta: boolean; tiktok: boolean; includeOutOfStock: boolean; excludeCategories: string[]; excludeProducts: string[]; shippingPrice: number | null };
const DEFAULTS: Settings = { google: true, meta: true, tiktok: true, includeOutOfStock: true, excludeCategories: [], excludeProducts: [], shippingPrice: null };

const feedSettingsCached = unstable_cache(
  async (storeId: number | null): Promise<Settings> => {
    if (!isCmsConfigured) return DEFAULTS;
    try {
      const { payloadClient } = await import("@/lib/cms/catalog-source");
      const payload = await payloadClient();
      const { getStoreSettings } = await import("@/payload/store-settings");
      const g = await getStoreSettings<Record<string, unknown>>(payload, "sales-channels", storeId, { depth: 1 });
      if (!g.updatedAt) return DEFAULTS;
      const ids = (v: unknown) => (Array.isArray(v) ? v.map((x) => (x && typeof x === "object" ? String((x as { legacyId?: string; id: number }).legacyId || (x as { id: number }).id) : String(x))) : []);
      return {
        google: g.google !== false,
        meta: g.meta !== false,
        tiktok: g.tiktok !== false,
        includeOutOfStock: g.includeOutOfStock !== false,
        excludeCategories: ids(g.excludeCategories),
        excludeProducts: ids(g.excludeProducts),
        shippingPrice: typeof g.shippingPrice === "number" ? g.shippingPrice : null,
      };
    } catch (e) {
      // never fall back to the defaults (that would switch disabled feeds back on): keep the last good value
      console.error("[feeds] settings could not be loaded:", e);
      throw e;
    }
  },
  ["feed-settings-v2"],
  { tags: ["settings"], revalidate: 600 }
);

/** The store's Settings → Sales channels. */
const getFeedSettings = async () => feedSettingsCached(await currentStoreId());

export type FeedItem = {
  id: string;
  title: string;
  description: string;
  link: string;
  image: string;
  extraImages: string[];
  availability: "in_stock" | "out_of_stock";
  condition: "new" | "used" | "refurbished";
  price: number;
  salePrice: number | null;
  brand: string;
  productType: string;
  googleCategory: string | null;
  shipping: number;
  inventory: number;
};

const CONDITION: Record<string, FeedItem["condition"]> = { new: "new", refurbished: "refurbished", "open-box": "used", "used-a-plus": "used", "used-a": "used" };
/** Google product taxonomy ids for our top categories (others are left for Google to infer) */
const GOOGLE_CATEGORY: Record<string, string> = { laptops: "328", mouse: "3304", keyboards: "1624", chargers: "7349", batteries: "276", storage: "380", ram: "1673", audio: "505771", monitors: "397", webcams: "142", networking: "342" };

/** Product photos are WebP; Meta and TikTok catalogues want JPEG/PNG – feeds link a JPEG copy (/feed-image/…). */
const feedImage = jpegImageUrl;

const plain = (md: string) =>
  md
    .replace(/!\[[^\]]*\]\([^)]*\)/g, "")
    .replace(/\[([^\]]+)\]\([^)]*\)/g, "$1")
    // Markdown marks only – a hyphen inside a word ("i5-1135G7") stays; list dashes at a line start go
    .replace(/^\s*[-*+]\s+/gm, " ")
    .replace(/[#*_>`|~]+/g, " ")
    .replace(/(^|\s)-{2,}(\s|$)/g, " ")
    .replace(/\s+/g, " ")
    .trim();

export async function feedItems(channel: FeedChannel): Promise<FeedItem[] | null> {
  const [s, products, store, info] = await Promise.all([getFeedSettings(), getAllProducts(), getStoreSettings(), import("@/lib/repo/site-content").then((m) => m.getSiteInfo())]);
  const storeName = info.name;
  if (!s[channel]) return null;
  const baseShipping = s.shippingPrice ?? store.defaultDeliveryCharge;
  const listed = (products as CatalogProduct[])
    .filter((p) => !p.priceOnRequest && p.images.length && (s.includeOutOfStock || p.stock > 0))
    .filter((p) => !s.excludeProducts.includes(p.id) && !s.excludeCategories.includes(p.categoryId) && !s.excludeCategories.includes(p.topCategoryId));
  // descriptions are cached per product (the catalogue cache leaves them out)
  const descriptions = new Map(await Promise.all(listed.map(async (p) => [p.id, await getProductDescription(p.id).catch(() => "")] as const)));
  return listed
    .map((p) => ({ ...p, description: descriptions.get(p.id) ?? "" }))
    .map((p) => {
      const price = p.price;
      const sale = effectivePrice(p);
      const sentence = (label: string, v?: string) => (v ? `${label}: ${v.trim().replace(/[.\s]+$/, "")}.` : "");
      const desc = plain(`${p.shortDescription} ${sentence("Condition", p.conditionNotes)} ${sentence("Warranty", p.warranty)} ${p.description}`).slice(0, 4900);
      return {
        id: p.sku || p.id,
        title: p.name.slice(0, 150),
        description: desc || p.name,
        link: absoluteUrl(p.url),
        image: feedImage(p.images[0]),
        extraImages: p.images.slice(1, 10).map(feedImage),
        availability: p.stock > 0 ? "in_stock" : "out_of_stock",
        condition: CONDITION[p.condition ?? "new"] ?? "new",
        price,
        salePrice: sale < price ? sale : null,
        brand: p.brandName || storeName,
        productType: [p.topCategoryName, p.categoryName].filter((x, i, a) => x && a.indexOf(x) === i).join(" > "),
        googleCategory: GOOGLE_CATEGORY[p.topCategorySlug] ?? null,
        shipping: store.freeDeliveryThreshold > 0 && sale >= store.freeDeliveryThreshold ? 0 : baseShipping,
        inventory: Math.max(0, p.stock),
      };
    });
}

const esc = (s: string) => s.replace(/[<>&'"]/g, (c) => ({ "<": "&lt;", ">": "&gt;", "&": "&amp;", "'": "&apos;", '"': "&quot;" })[c]!);
const money = (n: number) => `${n.toFixed(2)} PKR`;

/**
 * RSS 2.0 with the Google namespace – accepted by Google Merchant Center and Meta Commerce Manager.
 * `storeName` = the current store's name (Settings → Store details).
 */
export function toGoogleXml(items: FeedItem[], title: string, storeName: string) {
  const rows = items
    .map(
      (i) => `<item>
<g:id>${esc(i.id)}</g:id>
<title>${esc(i.title)}</title>
<description>${esc(i.description)}</description>
<link>${esc(i.link)}</link>
<g:image_link>${esc(i.image)}</g:image_link>
${i.extraImages.map((x) => `<g:additional_image_link>${esc(x)}</g:additional_image_link>`).join("\n")}
<g:availability>${i.availability}</g:availability>
<g:condition>${i.condition}</g:condition>
<g:price>${money(i.price)}</g:price>
${i.salePrice != null ? `<g:sale_price>${money(i.salePrice)}</g:sale_price>` : ""}
<g:brand>${esc(i.brand)}</g:brand>
<g:identifier_exists>no</g:identifier_exists>
<g:product_type>${esc(i.productType)}</g:product_type>
${i.googleCategory ? `<g:google_product_category>${i.googleCategory}</g:google_product_category>` : ""}
<g:inventory>${i.inventory}</g:inventory>
<g:shipping><g:country>PK</g:country><g:service>Standard</g:service><g:price>${money(i.shipping)}</g:price></g:shipping>
</item>`
    )
    .join("\n");
  return `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0" xmlns:g="http://base.google.com/ns/1.0">
<channel>
<title>${esc(title)}</title>
<link>${esc(absoluteUrl("/"))}</link>
<description>${esc(`${storeName} product feed`)}</description>
${rows}
</channel>
</rss>`;
}

/** TikTok catalog CSV */
export function toTikTokCsv(items: FeedItem[]) {
  const cols = ["sku_id", "title", "description", "availability", "condition", "price", "sale_price", "link", "image_link", "additional_image_link", "brand", "google_product_category", "product_type", "inventory"];
  const cell = (v: string | number | null) => {
    const s = v == null ? "" : String(v);
    return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  };
  const lines = items.map((i) =>
    [i.id, i.title, i.description, i.availability.replace("_", " "), i.condition, money(i.price), i.salePrice != null ? money(i.salePrice) : "", i.link, i.image, i.extraImages.join(","), i.brand, i.googleCategory, i.productType, i.inventory].map(cell).join(",")
  );
  return [cols.join(","), ...lines].join("\n");
}
