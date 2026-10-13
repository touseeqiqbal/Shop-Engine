import "server-only";
import { getAllProducts, getCategories } from "@/lib/repo/catalog";

/** Product count per category id, including products in all descendant categories. */
export async function getCategoryCounts(): Promise<Record<string, number>> {
  const [cats, products] = await Promise.all([getCategories(), getAllProducts()]);
  const parent = new Map(cats.map((c) => [c.id, c.parentId]));
  const counts: Record<string, number> = {};
  for (const p of products) {
    let cur: string | null | undefined = p.categoryId;
    const seen = new Set<string>();
    while (cur && !seen.has(cur)) {
      seen.add(cur);
      counts[cur] = (counts[cur] ?? 0) + 1;
      cur = parent.get(cur);
    }
  }
  return counts;
}

/** Product count per brand slug. */
export async function getBrandCounts(): Promise<Record<string, number>> {
  const counts: Record<string, number> = {};
  for (const p of await getAllProducts()) counts[p.brand] = (counts[p.brand] ?? 0) + 1;
  return counts;
}
