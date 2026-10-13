import { notFound } from "next/navigation";
import { getCategoryBySlug } from "@/lib/repo/catalog";

/** Unknown category → a real 404 (checked before loading.tsx starts streaming a 200 page). */
export default async function CategoryLayout({ children, params }: { children: React.ReactNode; params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  if (!(await getCategoryBySlug(decodeURIComponent(slug)))) notFound();
  return children;
}
