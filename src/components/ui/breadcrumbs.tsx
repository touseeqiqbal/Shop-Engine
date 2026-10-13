import Link from "next/link";
import { ChevronRight, Home } from "lucide-react";
import { JsonLd } from "./json-ld";
import { breadcrumbJsonLd } from "@/lib/seo";
import { cn } from "@/lib/utils";

export interface Crumb {
  name: string;
  href: string;
}

/** Visible breadcrumb trail + BreadcrumbList schema. "Home" is prepended automatically. */
export function Breadcrumbs({ items, className }: { items: Crumb[]; className?: string }) {
  const all = [{ name: "Home", href: "/" }, ...items];
  return (
    <>
      <JsonLd data={breadcrumbJsonLd(all)} />
      <nav aria-label="Breadcrumb" className={cn("text-sm text-muted", className)}>
        <ol className="flex flex-wrap items-center gap-1.5">
          {all.map((c, i) => {
            const last = i === all.length - 1;
            return (
              <li key={c.href + i} className="flex min-w-0 items-center gap-1.5">
                {i > 0 && <ChevronRight className="size-3.5 shrink-0 text-subtle" aria-hidden="true" />}
                {last ? (
                  <span aria-current="page" className="max-w-[16rem] truncate font-medium text-fg">
                    {c.name}
                  </span>
                ) : (
                  <Link href={c.href} className="inline-flex items-center gap-1 transition-colors hover:text-fg">
                    {i === 0 && <Home className="size-3.5" aria-hidden="true" />}
                    {c.name}
                  </Link>
                )}
              </li>
            );
          })}
        </ol>
      </nav>
    </>
  );
}
