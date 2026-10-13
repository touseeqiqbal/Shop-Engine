import { notFound } from "next/navigation";
import { getBrands } from "@/lib/repo/catalog";

/** Unknown brand → a real 404 (checked before loading.tsx starts streaming a 200 page). */
export default async function BrandLayout({ children, params }: { children: React.ReactNode; params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const s = decodeURIComponent(slug);
  if (!(await getBrands()).some((b) => b.slug === s)) notFound();
  return children;
}
