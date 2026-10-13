import type { ReactNode } from "react";
import { Breadcrumbs, type Crumb } from "@/components/ui/breadcrumbs";
import { cn } from "@/lib/utils";

/** Shared header for content pages: breadcrumbs, eyebrow, the page's single H1 and an intro. */
export function PageHero({
  crumbs,
  eyebrow,
  title,
  description,
  children,
  className,
  glow = "from-blue-500/25 via-violet-500/20 to-transparent",
}: {
  crumbs: Crumb[];
  eyebrow?: string;
  title: ReactNode;
  description?: ReactNode;
  children?: ReactNode;
  className?: string;
  glow?: string;
}) {
  return (
    <section className={cn("relative overflow-hidden border-b border-border", className)}>
      <div className="bg-grid pointer-events-none absolute inset-0 opacity-70 [mask-image:linear-gradient(to_bottom,#000,transparent)]" aria-hidden="true" />
      <div className={cn("pointer-events-none absolute -right-24 -top-40 size-[34rem] rounded-full bg-gradient-to-br blur-3xl", glow)} aria-hidden="true" />
      <div className="container-x relative py-8 sm:py-12 lg:py-16">
        <Breadcrumbs items={crumbs} className="mb-6" />
        {eyebrow && <p className="mb-3 text-xs font-semibold uppercase tracking-[0.18em] gradient-text">{eyebrow}</p>}
        <h1 className="max-w-4xl text-3xl font-bold leading-[1.1] text-fg sm:text-5xl lg:text-6xl">{title}</h1>
        {description && <div className="mt-4 max-w-2xl text-base text-muted sm:text-lg">{description}</div>}
        {children}
      </div>
    </section>
  );
}
