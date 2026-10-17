import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { PageHero } from "@/components/content/page-hero";
import { WhatsAppCta } from "@/components/content/whatsapp-cta";
import { BlogCategoryChips, BlogTagCloud, PostGrid } from "@/components/blog/blog-listing";
import { getBlogPosts } from "@/lib/repo/catalog";
import { getSiteInfo } from "@/lib/repo/site-content";
import { storePlace } from "@/lib/site-info";
import { blogCategorySlug } from "@/lib/blog";
import { pageMetadata } from "@/lib/seo";
import { getStoreLocale } from "@/lib/store-locale";
import { countryInText } from "@/lib/locale";

// Rendered per request (the store comes from the address – a cached page must never reach another store's visitors);
// the data behind it stays cached per store. No build-time list: products, brands and posts added later work at once.
export const dynamic = "force-dynamic";

type Props = { params: Promise<{ category: string }> };

async function load(slug: string) {
  const all = await getBlogPosts();
  const posts = all.filter((p) => blogCategorySlug(p.category) === slug);
  return { all, posts, name: posts[0]?.category };
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { category } = await params;
  const [{ name, posts }, site] = await Promise.all([load(category), getSiteInfo()]);
  if (!name) return {};
  const place = storePlace(site, " ");
  const locale = await getStoreLocale();
  return pageMetadata({
    locale,
    title: `${name} – Laptop & Tech Articles | ${site.name} Blog`,
    description: `${posts.length} ${name.toLowerCase()} article${posts.length === 1 ? "" : "s"} from ${site.name}${place ? `, ${place}` : ""}: practical advice on laptops, prices in ${countryInText(locale.country)}, chargers and accessories.`,
    path: `/blog/category/${category}`,
  });
}

export default async function BlogCategoryPage({ params }: Props) {
  const { category } = await params;
  const [{ all, posts, name }, site] = await Promise.all([load(category), getSiteInfo()]);
  if (!name) notFound();
  const place = storePlace(site);

  return (
    <div className="pb-16">
      <PageHero
        crumbs={[
          { name: "Blog", href: "/blog" },
          { name, href: `/blog/category/${category}` },
        ]}
        eyebrow="Blog category"
        title={name}
        description={`${posts.length} article${posts.length === 1 ? "" : "s"} to help you buy smarter – written by the ${site.shortName} team${place ? ` in ${place}` : ""}.`}
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
