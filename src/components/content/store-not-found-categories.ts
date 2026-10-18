import "server-only";
import { getTopCategories } from "@/lib/repo/catalog";
import type { NotFoundCategory } from "./not-found-content";

/** The current store's top categories for its 404 page (up to six; none if they can't be loaded). */
export async function storeNotFoundCategories(): Promise<NotFoundCategory[]> {
  const top = await getTopCategories().catch(() => []);
  return top.slice(0, 6).map((c) => ({ href: `/category/${c.slug}`, label: c.name, icon: c.icon }));
}
