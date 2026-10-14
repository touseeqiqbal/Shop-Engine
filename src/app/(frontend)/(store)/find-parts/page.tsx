import Link from "next/link";
import type { Metadata } from "next";
import { BatteryCharging, Camera, CheckCircle2, Cpu, PlugZap, Wrench } from "lucide-react";
import { getBrands, getCategories, getCompatibleProducts, getLaptopModels } from "@/lib/repo/catalog";
import { itemListJsonLd } from "@/lib/seo";
import { getPageMeta } from "@/lib/page-seo";
import { getResolvedPageContent } from "@/lib/repo/site-content";
import { primaryPhone } from "@/lib/site-info";
import { InlineText } from "@/components/content/inline-text";
import { Markdown } from "@/components/ui/markdown";
import { waLink } from "@/lib/site";
import type { CatalogProduct } from "@/lib/types";
import { CompatibilityFinder } from "@/components/product/compatibility-finder";
import { ProductGrid } from "@/components/product/product-grid";
import { CategoryIcon } from "@/components/ui/category-icon";
import { JsonLd } from "@/components/ui/json-ld";
import { Reveal } from "@/components/ui/reveal";
import { WhatsAppIcon } from "@/components/layout/whatsapp-icon";
import { PageHero } from "@/components/shop/page-hero";

type Props = { searchParams: Promise<Record<string, string | string[] | undefined>> };

/** Indexable, but every ?model= variant canonicalises to /find-parts. */
export async function generateMetadata(): Promise<Metadata> {
  return getPageMeta("/find-parts");
}

const TIPS = [
  { icon: PlugZap, title: "Chargers", text: "Match wattage (e.g. 65W) and pin type – blue pin, smart pin or USB-C." },
  { icon: BatteryCharging, title: "Batteries", text: "Check the battery code printed on your old battery (e.g. HT03XL)." },
  { icon: Cpu, title: "RAM & SSD", text: "We confirm DDR generation, slots and M.2 / SATA support for your model." },
];

export default async function FindPartsPage({ searchParams }: Props) {
  const sp = await searchParams;
  const modelId = (Array.isArray(sp.model) ? sp.model[0] : sp.model)?.slice(0, 100);
  const [brands, models, categories, c] = await Promise.all([getBrands(), getLaptopModels(), getCategories(), getResolvedPageContent("/find-parts")]);
  const model = modelId ? models.find((m) => m.id === modelId) : undefined;
  const products = model ? await getCompatibleProducts(model.id) : [];
  const brandName = model ? brands.find((b) => b.slug === model.brand)?.name ?? model.brand : "";
  const fullName = model ? `${brandName} ${model.name}` : "";

  // Group by top-level category in catalogue order.
  const order = new Map(categories.map((c, i) => [c.id, i]));
  const groups = new Map<string, { id: string; name: string; slug: string; icon?: string; items: CatalogProduct[] }>();
  for (const p of products) {
    const g = groups.get(p.topCategoryId) ?? {
      id: p.topCategoryId,
      name: p.topCategoryName,
      slug: p.topCategorySlug,
      icon: categories.find((c) => c.id === p.topCategoryId)?.icon,
      items: [],
    };
    g.items.push(p);
    groups.set(p.topCategoryId, g);
  }
  const grouped = [...groups.values()].sort((a, b) => (order.get(a.id) ?? 99) - (order.get(b.id) ?? 99));

  const waText = model
    ? `Hi! I need a part for my ${fullName}. Here is a photo of my old charger/battery:`
    : "Hi! I need a charger/battery for my laptop. Here is a photo of the old one:";

  return (
    <div className="container-x pb-16">
      <PageHero
        crumbs={[{ name: "Find Parts", href: "/find-parts" }]}
        eyebrow="Compatibility finder"
        title={
          <>
            Find parts for <span className="gradient-text">your laptop</span>
          </>
        }
        description={
          <p>
            <InlineText text={c.intro} />
          </p>
        }
        icon={<Wrench className="size-7" aria-hidden="true" />}
      />

      <section aria-label="Choose your laptop model" className="relative overflow-hidden rounded-[1.75rem] border border-border bg-bg-elevated p-5 sm:p-8">
        <div className="pointer-events-none absolute -right-20 -top-24 size-80 rounded-full bg-cyan-500/20 blur-3xl" aria-hidden="true" />
        <div className="pointer-events-none absolute -bottom-32 -left-20 size-80 rounded-full bg-violet-600/15 blur-3xl" aria-hidden="true" />
        <CompatibilityFinder key={model?.id ?? "none"} brands={brands} models={models} initialModel={model?.id} className="relative" />
      </section>

      {modelId && !model && (
        <p className="mt-6 rounded-2xl border border-amber-500/30 bg-amber-500/10 p-4 text-sm text-amber-200 light:text-amber-800" role="alert">
          We couldn&apos;t find that laptop model. Choose it from the list above – or send us a photo on WhatsApp and we&apos;ll match the part for you.
        </p>
      )}

      {model && (
        <section aria-labelledby="results-heading" className="mt-10">
          <div className="mb-6 flex flex-wrap items-end justify-between gap-3">
            <div>
              <p className="flex items-center gap-1.5 text-sm font-medium text-emerald-400">
                <CheckCircle2 className="size-4" aria-hidden="true" /> Verified compatible
              </p>
              <h2 id="results-heading" className="mt-1 text-2xl font-bold text-fg sm:text-3xl">
                Parts for {fullName}
              </h2>
            </div>
            <p className="text-sm text-muted">
              {products.length} compatible product{products.length === 1 ? "" : "s"}
            </p>
          </div>

          {grouped.length > 0 ? (
            <>
              <JsonLd data={itemListJsonLd(products, `Compatible parts for ${fullName}`)} />
              <nav aria-label="Jump to part type" className="mb-8">
                <ul className="snap-row -mx-4 !gap-2 px-4 sm:mx-0 sm:flex-wrap sm:px-0">
                  {grouped.map((g) => (
                    <li key={g.id}>
                      <a
                        href={`#parts-${g.slug}`}
                        className="inline-flex min-h-10 items-center gap-2 whitespace-nowrap rounded-full border border-border-strong bg-surface px-4 text-sm font-medium text-fg/85 hover:border-violet-500/50 hover:text-fg"
                      >
                        <CategoryIcon name={g.icon} className="size-4" />
                        {g.name}
                        <span className="text-[11px] tabular-nums opacity-70">{g.items.length}</span>
                      </a>
                    </li>
                  ))}
                </ul>
              </nav>
              <div className="space-y-12">
                {grouped.map((g) => (
                  <section key={g.id} id={`parts-${g.slug}`} aria-labelledby={`parts-${g.slug}-heading`} className="scroll-mt-24">
                    <div className="mb-4 flex items-center justify-between gap-3">
                      <h3 id={`parts-${g.slug}-heading`} className="flex items-center gap-3 text-lg font-bold text-fg sm:text-xl">
                        <span className="grid size-10 place-items-center rounded-xl bg-surface-strong">
                          <CategoryIcon name={g.icon} className="size-5 text-violet-400" />
                        </span>
                        {g.name}
                      </h3>
                      <Link href={`/category/${g.slug}`} className="text-sm font-semibold text-fg/80 hover:text-fg">
                        All {g.name.toLowerCase()} →
                      </Link>
                    </div>
                    <ProductGrid products={g.items} />
                  </section>
                ))}
              </div>
            </>
          ) : (
            <div className="card p-8 text-center">
              <p className="text-lg font-semibold text-fg">No listed parts for the {fullName} yet</p>
              <p className="mx-auto mt-2 max-w-md text-sm text-muted">
                We stock far more than we list. Send us a photo of your old part on WhatsApp and we&apos;ll confirm price & availability within minutes.
              </p>
            </div>
          )}
        </section>
      )}

      <Reveal className="mt-14 grid gap-4 lg:grid-cols-[1.2fr_1fr]">
        <div className="relative overflow-hidden rounded-[1.75rem] border border-emerald-500/25 bg-gradient-to-br from-emerald-500/15 via-emerald-500/5 to-transparent p-6 sm:p-8">
          <span className="grid size-12 place-items-center rounded-2xl bg-emerald-600 text-white">
            <Camera className="size-6" aria-hidden="true" />
          </span>
          <h2 className="mt-4 text-xl font-bold text-fg sm:text-2xl">Not sure? Send us a photo of your old charger or battery</h2>
          <p className="mt-2 text-sm text-muted sm:text-base">
            Snap the label on the bottom of your laptop or on the old part and WhatsApp it to us. Our technicians
            {c.info.address.area ? ` in ${c.info.address.area}` : ""} will match the exact part – usually within a few minutes.
          </p>
          <a href={waLink(primaryPhone(c.info).wa, waText)} target="_blank" rel="noopener noreferrer" className="btn btn-whatsapp btn-lg mt-6">
            <WhatsAppIcon className="size-5" /> Send photo on WhatsApp
          </a>
        </div>
        <ul className="grid gap-3">
          {TIPS.map((t) => (
            <li key={t.title} className="card flex items-start gap-4 p-5">
              <span className="grid size-11 shrink-0 place-items-center rounded-2xl bg-surface-strong">
                <t.icon className="size-5 text-violet-400" aria-hidden="true" />
              </span>
              <span>
                <span className="block font-semibold text-fg">{t.title}</span>
                <span className="mt-0.5 block text-sm text-muted">{t.text}</span>
              </span>
            </li>
          ))}
        </ul>
      </Reveal>
      {c.seoCopy.trim() && (
        <section aria-label="More information" className="card mt-12 p-6 sm:p-10">
          <Markdown content={c.seoCopy} className="max-w-4xl text-sm sm:text-base" />
        </section>
      )}
    </div>
  );
}
