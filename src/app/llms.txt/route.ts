import { getAllProducts, getBlogPosts, getCategories, getFaqs, getStoreSettings } from "@/lib/repo/catalog";
import { absoluteUrl } from "@/lib/site";
import { getSiteInfo } from "@/lib/repo/site-content";
import { LANDING_CITIES, citySlug } from "@/lib/cities";
import { storePlace } from "@/lib/site-info";
import { conditionMeta, effectivePrice } from "@/lib/utils";
import { currentAvailability, toStoreUrls } from "@/lib/tenant";
import { getStoreLocale } from "@/lib/store-locale";
import { moneyFormatter } from "@/lib/money";

/**
 * /llms.txt – a Markdown summary of the store for AI assistants and LLM-powered search
 * (ChatGPT, Claude, Perplexity, Gemini…), following https://llmstxt.org.
 * Generated from the live catalog: admin edits to products, categories, blog posts, FAQs or settings
 * call revalidatePath("/", "layout"), which regenerates this file too.
 */
export const dynamic = "force-dynamic";

const MAX_PRODUCTS = 500;

export async function GET() {
  const { store, availability } = await currentAvailability();
  if (!availability.open) return new Response("Not found", { status: 404 });
  // the original (default) shop; the city delivery pages and its delivery times are its own
  const original = !store || store.isDefault;
  const [categories, products, posts, faqs, settings, loc] = await Promise.all([
    getCategories(),
    getAllProducts(),
    getBlogPosts(),
    getFaqs(),
    getStoreSettings(),
    getStoreLocale(),
  ]);
  const site = await getSiteInfo(); // live business profile (/cms → Settings → Store details)
  const place = storePlace(site);
  // prices in the store's currency; Pakistani wording (wallets, "all over Pakistan") only for a store in Pakistan
  const money = moneyFormatter(loc);
  const pk = loc.country === "PK";
  const allOver = pk ? "all over Pakistan" : "nationwide";
  // details the store hasn't filled in are left out (a new store starts with a blank profile)
  const detail = (label: string, value: string) => (value ? [`- ${label}: ${value}`] : []);

  const top = categories.filter((c) => !c.parentId);
  const byTop = new Map<string, typeof products>();
  for (const p of products) byTop.set(p.topCategoryId, [...(byTop.get(p.topCategoryId) ?? []), p]);

  const lines: string[] = [];
  const push = (...l: string[]) => lines.push(...l);

  push(
    `# ${site.name}`,
    "",
    `> ${[site.tagline, site.description].filter(Boolean).join(". ")}`,
    "",
    "## Store details",
    ...detail("Address", site.address.full),
    ...site.phones.map((p) => `- Phone / WhatsApp: ${p.display} (https://wa.me/${p.wa})`),
    ...detail("Email", site.email),
    ...detail("Hours", site.hoursDisplay),
    ...detail("Map", site.mapLink),
    `- Delivery: ${allOver}.${original && pk ? " Karachi same/next day, major cities 1–3 working days, other areas 3–5 working days." : ""} Free delivery above ${money(settings.freeDeliveryThreshold)}.`,
    pk ? `- Payment: Cash on Delivery (all cities), JazzCash, EasyPaisa, bank transfer.` : `- Payment: Cash on Delivery, online payment / bank transfer.`,
    ...(site.couriers.length ? [`- Couriers: ${site.couriers.join(", ")}.`] : []),
    `- All prices are in ${loc.currency === "PKR" ? "Pakistani Rupees (PKR)" : loc.currency} and include the current sale price where applicable.`,
    "",
    "## Key pages",
    `- [Shop all products](${absoluteUrl("/shop")})`,
    `- [Hot deals](${absoluteUrl("/deals")})`,
    `- [Find parts for your laptop (chargers, batteries, keyboards, RAM by model)](${absoluteUrl("/find-parts")})`,
    `- [Wholesale & bulk orders](${absoluteUrl("/wholesale")}): bulk laptops, laptop lots and accessories for shops, resellers and offices (quote only)`,
    `- [Track an order](${absoluteUrl("/track-order")})`,
    `- [Shipping policy](${absoluteUrl("/shipping-policy")}): delivery times and charges by city`,
    `- [Warranty & return policy](${absoluteUrl("/warranty-returns")})`,
    `- [FAQs](${absoluteUrl("/faqs")})`,
    `- [About](${absoluteUrl("/about")}) · [Contact](${absoluteUrl("/contact")})`,
    "",
    "## Laptop conditions",
    ...Object.values(conditionMeta).map((c) => `- ${c.label}: ${c.description}`),
    "",
    "## Categories",
    ...top.map((c) => `- [${c.name}](${absoluteUrl(`/category/${c.slug}`)}): ${c.shortDescription}`),
    ""
  );

  let count = 0;
  push("## Products");
  for (const c of top) {
    const list = (byTop.get(c.id) ?? []).sort((a, b) => b.soldCount - a.soldCount);
    if (!list.length || count >= MAX_PRODUCTS) continue;
    push("", `### ${c.name}`);
    for (const p of list) {
      if (count++ >= MAX_PRODUCTS) break;
      const price = effectivePrice(p);
      const parts = [
        p.priceOnRequest ? "Price on request (wholesale lot – quote only)" : money(price) + (price < p.price ? ` (was ${money(p.price)})` : ""),
        p.condition ? conditionMeta[p.condition].label : null,
        p.stock > 0 ? "in stock" : "out of stock",
        p.warranty || null,
      ].filter(Boolean);
      push(`- [${p.name}](${absoluteUrl(p.url)}): ${parts.join(" · ")}. ${p.shortDescription}`);
    }
  }
  if (products.length > MAX_PRODUCTS) push("", `More products: ${absoluteUrl("/sitemap.xml")}`);

  if (posts.length) {
    push("", "## Buying guides & articles");
    for (const post of posts) push(`- [${post.title}](${absoluteUrl(`/blog/${post.slug}`)}): ${post.excerpt}`);
  }

  const lots = products.filter((p) => p.priceOnRequest);
  push(
    "",
    "## Wholesale",
    `${site.name} sells wholesale / in bulk${place ? ` from ${place}` : ""} to computer shops, resellers, companies and educational institutes ${allOver}. Wholesale is quote-only: no wholesale prices are published – buyers send a quote request at ${absoluteUrl("/wholesale#quote")} or message on WhatsApp.`,
    "- Bulk quantities of a single model (e.g. 20× HP EliteBook 840 G5), usually from 5 units per model.",
    "- Mixed laptop lots / pallets (e.g. 25 mixed Dell & HP Core i5 8th Gen, Grade A/B). Grade A = light signs of use; Grade B = visible wear but fully working.",
    "- Accessories in bulk: chargers, batteries, mouse, keyboards, SSDs and RAM for repair shops and resellers.",
    "- Every unit checked & tested, checking warranty on bulk, invoice provided, courier or cargo delivery nationwide.",
    ...lots.map((p) => `- [${p.name}](${absoluteUrl(p.url)}): price on request. ${p.shortDescription}`)
  );

  // the city pages exist while the original shop sells in Pakistan (see app/(frontend)/(store)/[category]/page.tsx)
  if (original && pk) {
    push("", "## Nationwide delivery pages");
    push(LANDING_CITIES.map((city) => `[Laptops in ${city}](${absoluteUrl(`/laptops-in-${citySlug(city)}`)})`).join(" · "));
  }

  if (faqs.length) {
    push("", "## Frequently asked questions");
    for (const f of faqs) push(`- **${f.q}** ${f.a}`);
  }

  push("", "## Optional", `- [Sitemap](${absoluteUrl("/sitemap.xml")})`, "");

  return new Response(await toStoreUrls(lines.join("\n")), {
    headers: {
      "Content-Type": "text/plain; charset=utf-8",
      "Cache-Control": "public, max-age=0, s-maxage=3600, stale-while-revalidate=86400",
    },
  });
}
