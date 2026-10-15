import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { PageHero } from "@/components/content/page-hero";
import { WhatsAppCta } from "@/components/content/whatsapp-cta";
import { BlogCategoryChips, BlogTagCloud, PostGrid } from "@/components/blog/blog-listing";
import { getBlogPosts } from "@/lib/repo/catalog";
import { getSiteInfo } from "@/lib/repo/site-content";
import { storePlace } from "@/lib/site-info";
import { blogTagSlug, blogTags } from "@/lib/blog";
import { pageMetadata } from "@/lib/seo";
import { getStoreLocale } from "@/lib/store-locale";

export const revalidate = 300;

type Props = { params: Promise<{ tag: string }> };

export async function generateStaticParams() {
  return blogTags(await getBlogPosts()).map((t) => ({ tag: t.slug }));
}

async function load(slug: string) {
  const all = await getBlogPosts();
  const posts = all.filter((p) => p.tags.some((t) => blogTagSlug(t) === slug));
  const name = posts[0]?.tags.find((t) => blogTagSlug(t) === slug);
  return { all, posts, name };
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { tag } = await params;
  const [{ name, posts }, site] = await Promise.all([load(tag), getSiteInfo()]);
  if (!name) return {};
  const place = storePlace(site);
  return pageMetadata({
    locale: await getStoreLocale(),
    title: `${name.charAt(0).toUpperCase() + name.slice(1)} – Articles & Guides | ${site.name}`,
    description: `Read ${posts.length} ${site.name} article${posts.length === 1 ? "" : "s"} about ${name}: buying advice, prices in Pakistan and expert tips from our ${place ? `${place} ` : ""}laptop shop.`,
    path: `/blog/tag/${tag}`,
    // Thin tag archives stay crawlable but out of the index.
    noindex: posts.length < 2,
  });
}

export default async function BlogTagPage({ params }: Props) {
  const { tag } = await params;
  const { all, posts, name } = await load(tag);
  if (!name) notFound();

  return (
    <div className="pb-16">
      <PageHero
        crumbs={[
          { name: "Blog", href: "/blog" },
          { name: `#${name}`, href: `/blog/tag/${tag}` },
        ]}
        eyebrow="Topic"
        title={
          <>
            Articles about <span className="gradient-text">{name}</span>
          </>
        }
        description={`${posts.length} article${posts.length === 1 ? "" : "s"} tagged “${name}”.`}
      />
      <div className="container-x mt-8 space-y-10 sm:mt-10">
        <BlogCategoryChips all={all} />
        <PostGrid posts={posts} />
        <section aria-labelledby="topics-heading" className="card p-6 sm:p-8">
          <h2 id="topics-heading" className="mb-4 text-lg font-bold text-fg">
            Other topics
          </h2>
          <BlogTagCloud all={all} active={tag} />
        </section>
        <WhatsAppCta />
      </div>
    </div>
  );
}
