import { notFound, permanentRedirect } from "next/navigation";
import { getPreviewProductBySlug, getProductBySlug } from "@/lib/repo/catalog";
import { isPreviewing } from "@/lib/tenant";

/**
 * Validates the URL before the page's loading.tsx boundary starts streaming, so unknown products return a real
 * 404 and wrong-category URLs a real 308 (thrown inside page.tsx they'd be streamed with a 200 status).
 */
export default async function ProductLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ category: string; product: string }>;
}) {
  const { category, product: slug } = await params;
  // staff preview (Draft Mode): the latest draft – also for a product that isn't published yet
  const preview = (await isPreviewing()) ? await getPreviewProductBySlug(slug) : null;
  const product = preview ?? (await getProductBySlug(slug));
  if (!product) notFound();
  // a variant has no page of its own: its main product's page with this option chosen
  if (product.variantOf) permanentRedirect(product.url);
  if (product.topCategorySlug !== category) permanentRedirect(product.url);
  return children;
}
