import type { Metadata } from "next";
import { BookOpen } from "lucide-react";
import { PageHero } from "@/components/content/page-hero";
import { WhatsAppCta } from "@/components/content/whatsapp-cta";
import { BlogCategoryChips, BlogTagCloud, PostGrid } from "@/components/blog/blog-listing";
import { PostCard } from "@/components/blog/post-card";
import { JsonLd } from "@/components/ui/json-ld";
import { getBlogPosts } from "@/lib/repo/catalog";
import { absoluteUrl } from "@/lib/site";
import { InlineText } from "@/components/content/inline-text";
import { Markdown } from "@/components/ui/markdown";
import { getPageMeta } from "@/lib/page-seo";
import { getResolvedPageContent } from "@/lib/repo/site-content";

export const revalidate = 300;

export async function generateMetadata(): Promise<Metadata> {
  return getPageMeta("/blog");
}

export default async function BlogIndexPage() {
  const [posts, c] = await Promise.all([getBlogPosts(), getResolvedPageContent("/blog")]);
  const site = c.info;
  const [featured, ...rest] = posts;

  return (
    <div className="pb-16">
      <JsonLd
        data={{
          "@context": "https://schema.org",
          "@type": "Blog",
          name: `${site.name} Blog`,
          url: absoluteUrl("/blog"),
          blogPost: posts.map((p) => ({ "@type": "BlogPosting", headline: p.title, url: absoluteUrl(`/blog/${p.slug}`), datePublished: p.publishedAt })),
        }}
      />
      <PageHero
        crumbs={[{ name: "Blog", href: "/blog" }]}
        eyebrow={`${site.shortName} Blog`}
        title={
          <>
            Laptop buying guides & <span className="gradient-text">tech tips</span> for Pakistan
          </>
        }
        description={<InlineText text={c.intro} />}
      />

      <div className="container-x mt-8 space-y-10 sm:mt-10 sm:space-y-14">
        <BlogCategoryChips all={posts} />

        {featured ? (
          <section aria-label="Featured article">
            <PostCard post={featured} featured />
          </section>
        ) : (
          <div className="card grid place-items-center gap-3 p-12 text-center">
            <BookOpen className="size-10 text-muted" aria-hidden="true" />
            <p className="text-muted">New articles are on the way. Check back soon!</p>
          </div>
        )}

        {rest.length > 0 && (
          <section aria-labelledby="latest-heading">
            <h2 id="latest-heading" className="mb-6 text-2xl font-bold text-fg sm:text-3xl">
              Latest articles
            </h2>
            <PostGrid posts={rest} headingLevel="h3" />
          </section>
        )}

        {posts.length > 0 && (
          <section aria-labelledby="topics-heading" className="card p-6 sm:p-8">
            <h2 id="topics-heading" className="mb-4 text-lg font-bold text-fg">
              Browse by topic
            </h2>
            <BlogTagCloud all={posts} />
          </section>
        )}

        {c.seoCopy.trim() && (
          <section aria-label="More information" className="card p-6 sm:p-10">
            <Markdown content={c.seoCopy} className="max-w-4xl text-sm sm:text-base" />
          </section>
        )}

        <WhatsAppCta />
      </div>
    </div>
  );
}
