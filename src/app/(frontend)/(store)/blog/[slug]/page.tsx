import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, ArrowRight, CalendarDays, Clock, Hash, ListOrdered, RefreshCw, UserRound } from "lucide-react";
import { Breadcrumbs } from "@/components/ui/breadcrumbs";
import { CategoryIcon } from "@/components/ui/category-icon";
import { JsonLd } from "@/components/ui/json-ld";
import { SectionHeading } from "@/components/ui/section-heading";
import { ProductCarousel } from "@/components/product/product-carousel";
import { ShareButtons } from "@/components/blog/share-buttons";
import { PostCard } from "@/components/blog/post-card";
import { WhatsAppCta } from "@/components/content/whatsapp-cta";
import { getBlogPost, getBlogPosts, getCategories, getProductsBySlugs } from "@/lib/repo/catalog";
import { getSiteInfo } from "@/lib/repo/site-content";
import { blogCategoryHref, blogTagHref, renderArticle } from "@/lib/blog";
import { absoluteUrl } from "@/lib/site";
import { articleJsonLd, pageMetadata } from "@/lib/seo";
import { readingTime } from "@/lib/utils";
import { getStoreLocale } from "@/lib/store-locale";
import { formatDate } from "@/lib/time";

export const revalidate = 300;

type Props = { params: Promise<{ slug: string }> };

export async function generateStaticParams() {
  return (await getBlogPosts()).map((p) => ({ slug: p.slug }));
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  const [post, site, locale] = await Promise.all([getBlogPost(slug), getSiteInfo(), getStoreLocale()]);
  if (!post) return {};
  return pageMetadata({
    title: post.seoTitle || `${post.title} | ${site.name}`,
    description: post.seoDescription || post.excerpt,
    path: `/blog/${post.slug}`,
    image: `/og/blog/${post.slug}`,
    type: "article",
    noindex: post.seoNoindex,
    canonical: post.seoCanonical,
    publishedTime: post.publishedAt,
    modifiedTime: post.updatedAt ?? post.publishedAt,
    locale,
  });
}

export default async function BlogPostPage({ params }: Props) {
  const { slug } = await params;
  const post = await getBlogPost(slug);
  if (!post) notFound();

  const [all, products, categories, site, loc] = await Promise.all([getBlogPosts(), getProductsBySlugs(post.relatedProducts), getCategories(), getSiteInfo(), getStoreLocale()]);
  const { html, headings } = renderArticle(post.content);
  const minutes = readingTime(post.content);
  const idx = all.findIndex((p) => p.slug === post.slug);
  const newer = idx > 0 ? all[idx - 1] : null;
  const older = idx >= 0 && idx < all.length - 1 ? all[idx + 1] : null;
  const relatedCats = post.relatedCategories.map((s) => categories.find((c) => c.slug === s)).filter((c): c is NonNullable<typeof c> => Boolean(c));
  const morePosts = all
    .filter((p) => p.slug !== post.slug)
    .sort((a, b) => Number(b.category === post.category) - Number(a.category === post.category))
    .slice(0, 3);
  const url = absoluteUrl(`/blog/${post.slug}`);
  const updated = post.updatedAt && post.updatedAt.slice(0, 10) !== post.publishedAt.slice(0, 10) ? post.updatedAt : null;

  return (
    <div className="pb-16">
      <JsonLd data={articleJsonLd(post, site.name)} />

      {/* Header */}
      <header className="relative overflow-hidden border-b border-border">
        <div className="bg-grid pointer-events-none absolute inset-0 opacity-60 [mask-image:linear-gradient(to_bottom,#000,transparent)]" aria-hidden="true" />
        <div className="pointer-events-none absolute -left-32 -top-40 size-[30rem] rounded-full bg-violet-600/20 blur-3xl" aria-hidden="true" />
        <div className="container-x relative py-8 sm:py-12">
          <Breadcrumbs
            items={[
              { name: "Blog", href: "/blog" },
              { name: post.category, href: blogCategoryHref(post.category) },
              { name: post.title, href: `/blog/${post.slug}` },
            ]}
            className="mb-6"
          />
          <div className="mx-auto max-w-4xl text-center">
            <Link href={blogCategoryHref(post.category)} className="chip text-violet-300 hover:border-violet-500/60 light:text-violet-700">
              {post.category}
            </Link>
            <h1 className="mt-4 text-3xl font-bold leading-[1.1] text-fg sm:text-5xl">{post.title}</h1>
            <p className="mx-auto mt-4 max-w-2xl text-base text-muted sm:text-lg">{post.excerpt}</p>
            <div className="mt-6 flex flex-wrap items-center justify-center gap-x-5 gap-y-2 text-sm text-muted">
              <span className="inline-flex items-center gap-1.5">
                <UserRound className="size-4" aria-hidden="true" /> {post.author}
              </span>
              <span className="inline-flex items-center gap-1.5">
                <CalendarDays className="size-4" aria-hidden="true" />
                <time dateTime={post.publishedAt}>{formatDate(post.publishedAt, loc, { dateStyle: "long" })}</time>
              </span>
              {updated && (
                <span className="inline-flex items-center gap-1.5">
                  <RefreshCw className="size-4" aria-hidden="true" /> Updated <time dateTime={updated}>{formatDate(updated, loc)}</time>
                </span>
              )}
              <span className="inline-flex items-center gap-1.5">
                <Clock className="size-4" aria-hidden="true" /> {minutes} min read
              </span>
            </div>
          </div>
          <div className="relative mx-auto mt-8 aspect-[1200/630] max-w-5xl overflow-hidden rounded-[1.75rem] border border-border shadow-2xl shadow-violet-950/30">
            <Image src={post.cover} alt={post.title} fill priority sizes="(min-width: 1024px) 1024px, 100vw" className="object-cover" />
          </div>
        </div>
      </header>

      <div className="container-x mt-8 grid gap-10 sm:mt-12 lg:grid-cols-[minmax(0,1fr)_18rem] lg:gap-14">
        {/* Article */}
        <div className="min-w-0">
          {headings.length > 2 && (
            <details className="card mb-8 p-5 lg:hidden" open>
              <summary className="flex cursor-pointer list-none items-center gap-2 font-semibold text-fg">
                <ListOrdered className="size-4" aria-hidden="true" /> In this article
              </summary>
              <TocList headings={headings} />
            </details>
          )}

          <article className="prose-store mx-auto max-w-3xl text-[1.0625rem]" dangerouslySetInnerHTML={{ __html: html }} />

          <div className="mx-auto mt-10 max-w-3xl space-y-6 border-t border-border pt-8">
            {post.tags.length > 0 && (
              <ul className="flex flex-wrap gap-2" aria-label="Tags">
                {post.tags.map((t) => (
                  <li key={t}>
                    <Link href={blogTagHref(t)} className="chip text-muted transition-colors hover:border-violet-500/50 hover:text-fg">
                      <Hash className="size-3" aria-hidden="true" />
                      {t}
                    </Link>
                  </li>
                ))}
              </ul>
            )}
            <ShareButtons url={url} title={post.title} />
          </div>

          {(older || newer) && (
            <nav aria-label="More articles" className="mx-auto mt-10 grid max-w-3xl gap-3 sm:grid-cols-2">
              {older ? (
                <Link href={`/blog/${older.slug}`} className="glow-hover card group p-5 transition-transform hover:-translate-y-0.5">
                  <span className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider text-muted">
                    <ArrowLeft className="size-3.5 transition-transform group-hover:-translate-x-0.5" aria-hidden="true" /> Previous article
                  </span>
                  <span className="mt-2 block font-display font-bold leading-snug text-fg">{older.title}</span>
                </Link>
              ) : (
                <span className="hidden sm:block" />
              )}
              {newer && (
                <Link href={`/blog/${newer.slug}`} className="glow-hover card group p-5 text-right transition-transform hover:-translate-y-0.5">
                  <span className="flex items-center justify-end gap-1.5 text-xs font-semibold uppercase tracking-wider text-muted">
                    Next article <ArrowRight className="size-3.5 transition-transform group-hover:translate-x-0.5" aria-hidden="true" />
                  </span>
                  <span className="mt-2 block font-display font-bold leading-snug text-fg">{newer.title}</span>
                </Link>
              )}
            </nav>
          )}
        </div>

        {/* Sidebar */}
        <aside className="hidden lg:block">
          <div className="sticky top-28 space-y-5">
            {headings.length > 0 && (
              <nav aria-label="Table of contents" className="card p-5">
                <p className="flex items-center gap-2 text-sm font-semibold text-fg">
                  <ListOrdered className="size-4" aria-hidden="true" /> In this article
                </p>
                <TocList headings={headings} />
              </nav>
            )}
            {relatedCats.length > 0 && (
              <div className="card p-5">
                <p className="mb-3 text-sm font-semibold text-fg">Shop related categories</p>
                <ul className="space-y-1">
                  {relatedCats.map((c) => (
                    <li key={c.id}>
                      <Link href={`/category/${c.slug}`} className="flex items-center gap-2 rounded-xl px-2 py-2 text-sm text-muted transition-colors hover:bg-surface-strong hover:text-fg">
                        <CategoryIcon name={c.icon || "Package"} className="size-4" /> {c.name}
                      </Link>
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        </aside>
      </div>

      <div className="container-x mt-14 space-y-14 sm:mt-20 sm:space-y-20">
        {products.length > 0 && (
          <section aria-labelledby="related-products-heading">
            <SectionHeading eyebrow="Featured in this article" title={<span id="related-products-heading">Products mentioned</span>} href="/shop" hrefLabel="Shop all" />
            <ProductCarousel products={products} label="Products mentioned in this article" />
          </section>
        )}

        {relatedCats.length > 0 && (
          <section aria-labelledby="related-cats-heading" className="lg:hidden">
            <h2 id="related-cats-heading" className="mb-4 text-xl font-bold text-fg">
              Shop related categories
            </h2>
            <ul className="grid grid-cols-2 gap-3 sm:grid-cols-4">
              {relatedCats.map((c) => (
                <li key={c.id}>
                  <Link href={`/category/${c.slug}`} className="card flex h-full items-center gap-3 p-4 text-sm font-semibold text-fg transition-colors hover:border-violet-500/50">
                    <span className="grid size-9 shrink-0 place-items-center rounded-xl bg-surface-strong">
                      <CategoryIcon name={c.icon || "Package"} className="size-4" />
                    </span>
                    {c.name}
                  </Link>
                </li>
              ))}
            </ul>
          </section>
        )}

        <WhatsAppCta
          title="Still not sure what to buy?"
          text={`Send us your budget, city and use case on WhatsApp – we'll shortlist the best options honestly, with Cash on Delivery ${loc.country === "PK" ? "all over Pakistan" : "nationwide"}.`}
          message={`Hi {store}! I just read “${post.title}” and need some advice.`}
        />

        {morePosts.length > 0 && (
          <section aria-labelledby="more-posts-heading">
            <SectionHeading eyebrow="Keep reading" title={<span id="more-posts-heading">More from the blog</span>} href="/blog" hrefLabel="All articles" />
            <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 lg:gap-6">
              {morePosts.map((p) => (
                <li key={p.id}>
                  <PostCard post={p} headingLevel="h3" />
                </li>
              ))}
            </ul>
          </section>
        )}
      </div>
    </div>
  );
}

function TocList({ headings }: { headings: { id: string; text: string }[] }) {
  return (
    <ol className="mt-3 space-y-1 border-l border-border text-sm">
      {headings.map((h) => (
        <li key={h.id}>
          <a href={`#${h.id}`} className="-ml-px block border-l border-transparent py-1 pl-3 text-muted transition-colors hover:border-violet-400 hover:text-fg">
            {h.text}
          </a>
        </li>
      ))}
    </ol>
  );
}
