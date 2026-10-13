"use client";
import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";

/**
 * Saved views above a list (Shopify-style tabs). Each tab is just a filtered address, so it can be bookmarked.
 * Used from collection configs: `beforeListTable: [{ path: "/payload/admin/ui/ListTabs#ListTabs", clientProps: { tabs, tip } }]`.
 */
export type ListTab = { label: string; where: string };

const whereOf = (qs: string) =>
  [...new URLSearchParams(qs).entries()]
    .filter(([k]) => k.startsWith("where"))
    .map(([k, v]) => `${k}=${v}`)
    .sort()
    .join("&");

export function ListTabs({ tabs, tip, label = "Views" }: { tabs: ListTab[]; tip?: string; label?: string }) {
  const pathname = usePathname();
  const params = useSearchParams();
  const current = whereOf(params.toString());
  const known = tabs.some((t) => whereOf(t.where) === current);
  return (
    <>
      <nav className="urko-tabs" aria-label={label}>
        {tabs.map((t) => {
          const active = whereOf(t.where) === current;
          return (
            <Link key={t.label} href={t.where ? `${pathname}?${t.where}` : pathname} className={active ? "is-active" : undefined} aria-current={active ? "page" : undefined}>
              {t.label}
            </Link>
          );
        })}
        {!known && <span className="urko-tabs__custom is-active">Custom filter</span>}
      </nav>
      {tip && <p className="urko-tip">{tip}</p>}
    </>
  );
}
