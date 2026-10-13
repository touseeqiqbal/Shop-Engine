import { brandOgImage } from "@/lib/og";
import { getBlogPost } from "@/lib/repo/catalog";

/**
 * Per-article 1200×630 social card at a stable URL (`/og/blog/{slug}`) referenced from the article's
 * metadata. (A colocated `opengraph-image` file under the `(store)` group would get a hashed URL.)
 */
export const revalidate = 86400;

export async function GET(_req: Request, { params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const post = await getBlogPost(slug);
  if (!post) return new Response("Not found", { status: 404 });
  return brandOgImage({ eyebrow: post.category, title: post.title, footer: "Urko Tech Blog · Buying guides for Pakistan" });
}
