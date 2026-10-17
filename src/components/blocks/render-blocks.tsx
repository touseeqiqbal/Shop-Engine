import Link from "next/link";
import Image from "next/image";
import type { ReactNode } from "react";
import { Flame, Wrench } from "lucide-react";
import { HeroSlider } from "@/components/home/hero-slider";
import { BrandStrip, CategoryBento, InstallmentBanner, SocialFeed, StoreLocation, Testimonials, TrustBadges, socialHandle } from "@/components/home/sections";
import { ProductCarousel } from "@/components/product/product-carousel";
import { CompatibilityFinder } from "@/components/product/compatibility-finder";
import { WhatsAppIcon } from "@/components/layout/whatsapp-icon";
import { Countdown } from "@/components/ui/countdown";
import { Reveal } from "@/components/ui/reveal";
import { SectionHeading } from "@/components/ui/section-heading";
import { RichTextSections } from "@/components/blocks/rich-text-sections";
import { JsonLd } from "@/components/ui/json-ld";
import {
  getActiveFlashSale,
  getAllProducts,
  getBanners,
  getBrands,
  getCategories,
  getLaptopModels,
  getProductsByIds,
  getTestimonials,
  getStoreSettings,
  getTopCategories,
} from "@/lib/repo/catalog";
import { getSiteInfo } from "@/lib/repo/site-content";
import { getCurrentStore } from "@/lib/tenant";
import { getMoney } from "@/lib/store-locale";
import { DEFAULT_HOME, DEFAULT_HOME_SEO_COPY, NEUTRAL_SECTION_TEXT, SECTION_DEFAULTS, type HomeSectionType } from "@/lib/content/home";
import { fillTokens, tokenValues } from "@/lib/content/page-defaults";
import { AUTO_LIMIT, type BlockText, type PageBlock, type PageData } from "@/lib/cms/blocks-types";
import { getCollection } from "@/lib/cms/collections";
import type { Banner, CatalogProduct, Category } from "@/lib/types";
import { cn } from "@/lib/utils";
import { sanitizeHtml } from "@/lib/sanitize";

/*
 * Renders page-builder blocks (Payload → Pages, or the legacy home config mapped to blocks).
 * With the default home page the output is identical to the original hand-built page. The built-in texts describe the
 * original shop (its Saddar, Karachi store), so any other store gets plain ones where a block still has them.
 * Rich text can use the same {{tokens}} as the content pages ({{storeName}}, {{address}}, {{phone1}} …).
 */

const has = (blocks: PageBlock[], ...types: PageBlock["type"][]) => blocks.some((b) => types.includes(b.type));
const none = <T,>(v: T) => Promise.resolve(v);

export async function RenderBlocks({ page }: { page: PageData }) {
  const blocks = page.blocks;
  const needsProducts = has(blocks, "deals", "products", "categories");
  const [info, store, storeSettings, money] = await Promise.all([getSiteInfo(), getCurrentStore(), has(blocks, "richText") ? getStoreSettings() : none(null), getMoney()]);
  const original = !store || store.isDefault;
  // {{freeDelivery}} and friends in the store's own currency
  const tokens = tokenValues(info, storeSettings, money);
  const fill = (s: string | null | undefined) => (s ? fillTokens(s, tokens) : s);
  /** A section's text, with the original shop's built-in wording swapped for plain text on any other store. */
  const own = (type: HomeSectionType, t: BlockText): BlockText => {
    if (original) return t;
    const d = SECTION_DEFAULTS[type];
    const plain = Object.entries(NEUTRAL_SECTION_TEXT[type] ?? {}).filter(([k]) => t[k as keyof BlockText] === d[k as keyof typeof d]);
    return { ...t, ...Object.fromEntries(plain) };
  };
  const h1Highlight = !original && page.h1Highlight === DEFAULT_HOME.h1Highlight ? info.name : page.h1Highlight;
  const [heroes, topCategories, categories, brands, models, testimonials, flashSale, all] = await Promise.all([
    blocks.some((b) => b.type === "hero" && !b.slides.length) ? getBanners("hero") : none<Banner[]>([]),
    has(blocks, "categories") ? getTopCategories() : none<Category[]>([]),
    has(blocks, "categories", "products") ? getCategories() : none<Category[]>([]),
    has(blocks, "brands", "finder") ? getBrands() : none([] as Awaited<ReturnType<typeof getBrands>>),
    has(blocks, "finder") ? getLaptopModels() : none([] as Awaited<ReturnType<typeof getLaptopModels>>),
    has(blocks, "testimonials") ? getTestimonials() : none([] as Awaited<ReturnType<typeof getTestimonials>>),
    has(blocks, "deals") ? getActiveFlashSale() : none(null),
    needsProducts ? getAllProducts() : none<CatalogProduct[]>([]),
  ]);

  // ── automatic product lists ──
  const byNewest = [...all].sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  const byPopular = [...all].sort((a, b) => b.soldCount - a.soldCount);
  const auto: Record<"newArrivals" | "bestSellers" | "topAccessories", CatalogProduct[]> = {
    newArrivals: byNewest,
    bestSellers: byPopular.filter((p) => p.bestSeller || p.soldCount > 100),
    topAccessories: byPopular.filter((p) => p.topCategorySlug !== "laptops"),
  };
  const flashProducts = flashSale ? await getProductsByIds(flashSale.productIds) : null;
  const slice = (list: CatalogProduct[], limit: number | undefined, fallback: number) => list.slice(0, limit ?? fallback);

  // category id → itself + all descendants (for "From a category" carousels and product counts)
  const parentOf = new Map(categories.map((c) => [c.id, c.parentId]));
  const inCategory = (p: CatalogProduct, id: string) => {
    let cur: string | null | undefined = p.categoryId;
    const seen = new Set<string>();
    while (cur && !seen.has(cur)) {
      if (cur === id) return true;
      seen.add(cur);
      cur = parentOf.get(cur);
    }
    return false;
  };

  async function productsFor(b: Extract<PageBlock, { type: "deals" | "products" }>): Promise<CatalogProduct[]> {
    if (b.source === "manual" && b.productIds.length) {
      const picked = await getProductsByIds(b.productIds);
      return b.limit ? picked.slice(0, b.limit) : picked;
    }
    if (b.type === "deals") {
      if (flashProducts) return b.limit ? flashProducts.slice(0, b.limit) : flashProducts;
      return slice(all.filter((p) => p.hotDeal), b.limit, AUTO_LIMIT.deals);
    }
    if (b.source === "collection") return b.collectionSlug ? slice((await getCollection(b.collectionSlug))?.products ?? [], b.limit, AUTO_LIMIT.collection) : [];
    if (b.source === "category") return b.categoryId ? slice(byPopular.filter((p) => inCategory(p, b.categoryId!)), b.limit, AUTO_LIMIT.category) : [];
    if (b.source === "manual") return [];
    return slice(auto[b.source], b.limit, AUTO_LIMIT[b.source]);
  }

  // ── product counts per category (incl. sub-categories) ──
  const counts: Record<string, number> = {};
  if (has(blocks, "categories")) {
    for (const p of all) {
      let cur: string | null | undefined = p.categoryId;
      const seen = new Set<string>();
      while (cur && !seen.has(cur)) {
        seen.add(cur);
        counts[cur] = (counts[cur] ?? 0) + 1;
        cur = parentOf.get(cur);
      }
    }
  }
  const byId = new Map(categories.map((c) => [c.id, c]));

  // ── H1: always the first thing on the page ──
  const h1 = (
    <h1 className="mb-3 text-sm font-medium text-muted sm:text-base">
      {h1Highlight && <span className="gradient-text font-semibold">{h1Highlight}</span>}
      {h1Highlight && page.h1Text ? " · " : null}
      {page.h1Text}
    </h1>
  );

  // Unique ids when a section type appears more than once (first one keeps the original id).
  const used = new Map<string, number>();
  const uid = (base: string) => {
    const n = used.get(base) ?? 0;
    used.set(base, n + 1);
    return n ? `${base}-${n + 1}` : base;
  };

  const out: ReactNode[] = [];
  let h1Rendered = false;

  for (let i = 0; i < blocks.length; i++) {
    const b = blocks[i];
    const key = `${b.type}-${i}`;

    switch (b.type) {
      case "hero": {
        const next = blocks[i + 1];
        const trust = next?.type === "trust" ? next : null;
        const slides: Banner[] = b.slides.length
          ? b.slides.map((s, n) => ({ ...s, placement: "hero", sortOrder: n, active: true }))
          : heroes;
        out.push(
          <section key={key} className="container-x">
            {!h1Rendered && h1}
            <HeroSlider slides={slides} />
            {/* right under the hero – on screen when the page opens */}
            {trust && <TrustBadges className="mt-4" items={trust.badges} instant />}
          </section>
        );
        h1Rendered = true;
        if (trust) i++;
        break;
      }
      case "trust":
        out.push(
          <section key={key} className="container-x" aria-label="Why shop with us">
            <TrustBadges items={b.badges} />
          </section>
        );
        break;
      case "categories": {
        const t = b.text;
        const id = uid("cats-heading");
        const picked = b.categoryIds.length ? b.categoryIds.map((cid) => byId.get(cid)).filter((c): c is Category => Boolean(c)) : topCategories;
        out.push(
          <section key={key} className="container-x" aria-labelledby={id}>
            <SectionHeading
              eyebrow={t.eyebrow || undefined}
              title={<span id={id}>{t.title}</span>}
              description={t.description || undefined}
              href={t.linkHref || undefined}
              hrefLabel={t.linkLabel || undefined}
            />
            <CategoryBento categories={picked} counts={counts} />
          </section>
        );
        break;
      }
      case "deals": {
        const products = await productsFor(b);
        if (!products.length) break;
        const t = b.text;
        const id = uid("deals-heading");
        out.push(
          <section key={key} className="container-x" aria-labelledby={id}>
            <Reveal className="relative overflow-hidden rounded-[1.75rem] border border-orange-500/20 bg-gradient-to-br from-orange-500/10 via-rose-500/5 to-violet-500/10 p-4 sm:p-8">
              <div className="mb-6 flex flex-wrap items-end justify-between gap-4">
                <div>
                  <p className="chip mb-2 border-orange-500/40 bg-orange-500/10 text-orange-400">
                    <Flame className="size-3.5" aria-hidden="true" /> {t.eyebrow || flashSale?.title || "Hot Deals"}
                  </p>
                  <h2 id={id} className="text-2xl font-bold text-fg sm:text-4xl">
                    {t.title}
                  </h2>
                </div>
                {flashSale && <Countdown endsAt={flashSale.endsAt} />}
              </div>
              <ProductCarousel products={products} label="Hot deals" />
              {t.linkHref && (
                <div className="mt-2 text-right">
                  <Link href={t.linkHref} className="text-sm font-semibold text-fg/90 hover:text-fg">
                    {t.linkLabel}
                  </Link>
                </div>
              )}
            </Reveal>
          </section>
        );
        break;
      }
      case "finder": {
        const t = b.text;
        const id = uid("finder-heading");
        out.push(
          <section key={key} className="container-x" aria-labelledby={id}>
            <Reveal className="relative overflow-hidden rounded-[1.75rem] border border-border bg-bg-elevated p-6 sm:p-10">
              <div className="pointer-events-none absolute -right-20 -top-24 size-80 rounded-full bg-cyan-500/20 blur-3xl" aria-hidden="true" />
              <div className="relative grid gap-8 lg:grid-cols-[1fr_1.6fr] lg:items-center">
                <div>
                  <span className="mb-4 grid size-12 place-items-center rounded-2xl bg-brand-gradient text-white">
                    <Wrench className="size-6" aria-hidden="true" />
                  </span>
                  <h2 id={id} className="text-2xl font-bold text-fg sm:text-3xl">
                    {t.title}
                  </h2>
                  {t.description && <p className="mt-2 text-muted">{t.description}</p>}
                </div>
                <CompatibilityFinder brands={brands} models={models} />
              </div>
            </Reveal>
          </section>
        );
        break;
      }
      case "products": {
        const products = await productsFor(b);
        if ((b.source === "manual" || b.source === "category" || b.source === "collection") && !products.length) break;
        const t = b.text;
        out.push(
          <section key={key} className="container-x" aria-label={t.title}>
            <SectionHeading eyebrow={t.eyebrow || undefined} title={t.title} href={t.linkHref || undefined} hrefLabel={t.linkLabel || undefined} />
            <ProductCarousel products={products} label={t.title} />
          </section>
        );
        break;
      }
      case "brands": {
        const t = b.text;
        out.push(
          <section key={key} className="container-x" aria-label={t.title}>
            <SectionHeading eyebrow={t.eyebrow || undefined} title={t.title} href={t.linkHref || undefined} hrefLabel={t.linkLabel || undefined} />
            <BrandStrip brands={brands} />
          </section>
        );
        break;
      }
      case "installment": {
        const t = b.text;
        out.push(
          <section key={key} className="container-x">
            <InstallmentBanner eyebrow={t.eyebrow} title={t.title} description={t.description} linkLabel={t.linkLabel} linkHref={t.linkHref || "/installments"} />
          </section>
        );
        break;
      }
      case "testimonials":
        if (!testimonials.length) break;
        out.push(
          <section key={key} className="container-x" aria-label="Customer reviews">
            <SectionHeading eyebrow={b.text.eyebrow || undefined} title={b.text.title} />
            <Testimonials items={testimonials} />
          </section>
        );
        break;
      case "social": {
        const t = own("social", b.text);
        out.push(
          <section key={key} className="container-x" aria-label="Instagram and TikTok">
            <SectionHeading eyebrow={t.eyebrow || socialHandle(info) || undefined} title={t.title} description={t.description || undefined} />
            <SocialFeed />
          </section>
        );
        break;
      }
      case "location": {
        const t = own("location", b.text);
        out.push(
          <section key={key} className="container-x" aria-label="Store location">
            <StoreLocation eyebrow={t.eyebrow} title={t.title} description={t.description} />
          </section>
        );
        break;
      }
      case "richText":
        // the original shop's built-in home-page text (its Saddar address and Karachi claims) is its own
        if (!original && !b.html && b.markdown === DEFAULT_HOME_SEO_COPY) break;
        out.push(
          <RichTextSections
            key={key}
            html={fill(b.html)}
            markdown={fill(b.markdown)}
            boxed={Boolean(b.boxed)}
            narrow={b.width === "narrow"}
            label={original && page.slug === "home" && b.boxed ? "About buying laptops in Pakistan" : undefined}
          />
        );
        break;
      case "imageBanner":
        out.push(
          <section key={key} className="container-x">
            <div
              className={cn(
                "relative flex overflow-hidden rounded-[1.75rem] border border-border",
                b.height === "sm" ? "min-h-56" : b.height === "lg" ? "min-h-[28rem] sm:min-h-[34rem]" : "min-h-72 sm:min-h-96",
                b.align === "center" ? "items-center justify-center text-center" : "items-end sm:items-center"
              )}
            >
              <Image src={b.image} alt={b.alt} fill sizes="(min-width: 1280px) 1200px, 100vw" className="object-cover" />
              <div className={cn("absolute inset-0", b.align === "center" ? "bg-black/50" : "bg-gradient-to-r from-black/75 via-black/40 to-transparent")} aria-hidden="true" />
              <div className={cn("relative max-w-xl p-6 text-white sm:p-10", b.align === "center" && "mx-auto")}>
                {b.eyebrow && <p className="chip mb-3 border-white/30 bg-white/10 text-white">{b.eyebrow}</p>}
                {b.heading && <h2 className="text-2xl font-bold sm:text-4xl">{b.heading}</h2>}
                {b.text && <p className="mt-2 text-white/85 sm:text-lg">{b.text}</p>}
                {b.buttonLabel && b.buttonHref && (
                  <Link href={b.buttonHref} className="btn btn-primary btn-lg mt-5">
                    {b.buttonLabel}
                  </Link>
                )}
              </div>
            </div>
          </section>
        );
        break;
      case "imageText":
        out.push(
          <section key={key} className="container-x">
            <div className="grid items-center gap-8 lg:grid-cols-2 lg:gap-12">
              <div className={cn("relative aspect-[4/3] overflow-hidden rounded-[1.75rem] border border-border", b.imageSide === "right" && "lg:order-2")}>
                <Image src={b.image} alt={b.alt} fill sizes="(min-width: 1024px) 600px, 100vw" className="object-cover" />
              </div>
              <div>
                {b.eyebrow && <p className="chip mb-3">{b.eyebrow}</p>}
                {b.heading && <h2 className="text-2xl font-bold text-fg sm:text-3xl">{b.heading}</h2>}
                {b.html && <div className="prose-store mt-3 text-muted" dangerouslySetInnerHTML={{ __html: sanitizeHtml(b.html) }} />}
                {b.buttonLabel && b.buttonHref && (
                  <Link href={b.buttonHref} className="btn btn-primary mt-5">
                    {b.buttonLabel}
                  </Link>
                )}
              </div>
            </div>
          </section>
        );
        break;
      case "faq": {
        const id = uid("faq-heading");
        out.push(
          <section key={key} className="container-x" aria-labelledby={b.text.title ? id : undefined}>
            <JsonLd
              data={{
                "@context": "https://schema.org",
                "@type": "FAQPage",
                mainEntity: b.items.map((q) => ({ "@type": "Question", name: q.question, acceptedAnswer: { "@type": "Answer", text: q.answer } })),
              }}
            />
            {b.text.title && <SectionHeading eyebrow={b.text.eyebrow || undefined} title={<span id={id}>{b.text.title}</span>} />}
            <div className="mx-auto max-w-3xl space-y-3">
              {b.items.map((q, n) => (
                <details key={n} className="card group p-5 [&_summary::-webkit-details-marker]:hidden">
                  <summary className="flex cursor-pointer list-none items-center justify-between gap-4 font-semibold text-fg">
                    {q.question}
                    <span className="text-xl leading-none text-muted transition group-open:rotate-45" aria-hidden="true">
                      +
                    </span>
                  </summary>
                  <p className="mt-3 whitespace-pre-line text-muted">{q.answer}</p>
                </details>
              ))}
            </div>
          </section>
        );
        break;
      }
      case "cta":
        out.push(
          <section key={key} className="container-x">
            <div className="relative overflow-hidden rounded-[1.75rem] border border-border bg-gradient-to-br from-blue-600/20 via-violet-600/20 to-fuchsia-600/10 p-6 text-center sm:p-12">
              <div className="bg-grid pointer-events-none absolute inset-0 opacity-60" aria-hidden="true" />
              <div className="relative mx-auto max-w-2xl">
                <h2 className="text-2xl font-bold text-fg sm:text-4xl">{b.heading}</h2>
                {b.text && <p className="mt-3 text-muted sm:text-lg">{b.text}</p>}
                {b.buttons.length > 0 && (
                  <div className="mt-6 flex flex-wrap justify-center gap-3">
                    {b.buttons.map((btn, n) => {
                      const external = /^https?:\/\//i.test(btn.href);
                      const cls = cn("btn btn-lg", btn.style === "secondary" ? "btn-secondary" : btn.style === "whatsapp" ? "btn-whatsapp" : "btn-primary");
                      const content = (
                        <>
                          {btn.style === "whatsapp" && <WhatsAppIcon className="size-5" />}
                          {btn.label}
                        </>
                      );
                      return external ? (
                        <a key={n} href={btn.href} target="_blank" rel="noopener noreferrer" className={cls}>
                          {content}
                        </a>
                      ) : (
                        <Link key={n} href={btn.href} className={cls}>
                          {content}
                        </Link>
                      );
                    })}
                  </div>
                )}
              </div>
            </div>
          </section>
        );
        break;
    }
    // The H1 must lead the page: if the first rendered block wasn't the hero, put it in front.
    if (!h1Rendered && out.length) {
      out.unshift(
        <section key="h1" className="container-x">
          {h1}
        </section>
      );
      h1Rendered = true;
    }
  }
  if (!h1Rendered) out.push(<section key="h1" className="container-x">{h1}</section>);

  return <div className="space-y-16 pb-8 pt-4 sm:space-y-24 sm:pt-6">{out}</div>;
}
