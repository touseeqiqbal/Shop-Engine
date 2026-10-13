import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { PageHero } from "@/components/content/page-hero";
import { WhatsAppCta } from "@/components/content/whatsapp-cta";
import { BlogCategoryChips, BlogTagCloud, PostGrid } from "@/components/blog/blog-listing";
import { getBlogPosts } from "@/lib/repo/catalog";
import { blogCategories, blogCategorySlug } from "@/lib/blog";
import { pageMetadata } from "@/lib/seo";

export const revalidate = 300;

type Props = { params: Promise<{ category: string }> };

export async function generateStaticParams() {
  return blogCategories(await getBlogPosts()).map((c) => ({ category: c.slug }));
}

async function load(slug: string) {
  const all = await getBlogPosts();
  const posts = all.filter((p) => blogCategorySlug(p.category) === slug);
  return { all, posts, name: posts[0]?.category };
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { category } = await params;
  const { name, posts } = await load(category);
  if (!name) return {};
  return pageMetadata({
    title: `${name} – Laptop & Tech Articles | Urko Tech Store Blog`,
    description: `${posts.length} ${name.toLowerCase()} article${posts.length === 1 ? "" : "s"} from Urko Tech Store, Saddar Karachi: practical advice on laptops, prices in Pakistan, chargers and accessories.`,
    path: `/blog/category/${category}`,
  });
}

export default async function BlogCategoryPage({ params }: Props) {
  const { category } = await params;
  const { all, posts, name } = await load(category);
  if (!name) notFound();

  return (
    <div className="pb-16">
      <PageHero
        crumbs={[
          { name: "Blog", href: "/blog" },
          { name, href: `/blog/category/${category}` },
        ]}
        eyebrow="Blog category"
        title={name}
        description={`${posts.length} article${posts.length === 1 ? "" : "s"} to help you buy smarter – written by the Urko Tech team in Saddar, Karachi.`}
      />
      <div className="container-x mt-8 space-y-10 sm:mt-10">
        <BlogCategoryChips all={all} active={category} />
        <PostGrid posts={posts} />
        <section aria-labelledby="topics-heading" className="card p-6 sm:p-8">
          <h2 id="topics-heading" className="mb-4 text-lg font-bold text-fg">
            More topics
          </h2>
          <BlogTagCloud all={all} />
        </section>
        <WhatsAppCta />
      </div>
    </div>
  );
}
