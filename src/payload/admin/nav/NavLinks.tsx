"use client";
import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";
import { Icon, type IconName } from "../ui/icons";

export type NavItem = { label: string; href: string; match?: string };
export type NavSection = NavItem & { icon: IconName; exact?: boolean; badge?: number; badgeLabel?: string; children?: NavItem[] };

/** Sidebar links: the open section shows its sub-pages (like Shopify). Badges always have words for screen readers. */
export function NavLinks({ sections }: { sections: NavSection[] }) {
  const pathname = usePathname() ?? "";
  const search = useSearchParams()?.toString() ?? "";
  const here = `${pathname}${search ? `?${search}` : ""}`;
  const matches = (item: NavItem, exact?: boolean) => (exact ? pathname === item.href : pathname.startsWith(item.match ?? item.href.split("?")[0]));
  // the section whose own page or any sub-page is open
  const activeIndex = sections.findIndex((s) => matches(s, s.exact) || s.children?.some((c) => matches(c)));

  return (
    <ul className="urko-nav__list">
      {sections.map((s, i) => {
        const open = i === activeIndex;
        // the most specific child that matches (query string decides e.g. Customers vs Staff, Products vs Inventory)
        const exactChild = s.children?.find((c) => here === c.href) ?? s.children?.find((c) => matches(c) && !c.href.includes("?"));
        return (
          <li key={s.label}>
            <Link href={s.href || s.children?.[0]?.href || "#"} className={`urko-nav__link${open ? " is-active" : ""}`} aria-current={open && !s.children?.length ? "page" : undefined}>
              <Icon name={s.icon} />
              <span>{s.label}</span>
              {s.badge ? (
                <span className="urko-nav__badge">
                  {s.badge}
                  <span className="urko-sr"> {s.badgeLabel}</span>
                </span>
              ) : null}
            </Link>
            {open && s.children && s.children.length > 1 && (
              <ul className="urko-nav__sub">
                {s.children.map((c) => (
                  <li key={c.href}>
                    <Link href={c.href} className={`urko-nav__sublink${exactChild === c ? " is-active" : ""}`} aria-current={exactChild === c ? "page" : undefined}>
                      {c.label}
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </li>
        );
      })}
    </ul>
  );
}
