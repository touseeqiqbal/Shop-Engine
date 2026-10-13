import Link from "next/link";
import { ArrowRight } from "lucide-react";
import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

export function SectionHeading({
  eyebrow,
  title,
  description,
  href,
  hrefLabel = "View all",
  action,
  className,
  as: H = "h2",
}: {
  eyebrow?: string;
  title: ReactNode;
  description?: string;
  href?: string;
  hrefLabel?: string;
  action?: ReactNode;
  className?: string;
  as?: "h1" | "h2" | "h3";
}) {
  return (
    <div className={cn("mb-6 flex flex-wrap items-end justify-between gap-4 sm:mb-8", className)}>
      <div className="max-w-2xl">
        {eyebrow && <p className="mb-2 text-xs font-semibold uppercase tracking-[0.18em] gradient-text">{eyebrow}</p>}
        <H className="text-2xl font-bold text-fg sm:text-3xl lg:text-4xl">{title}</H>
        {description && <p className="mt-2 text-sm text-muted sm:text-base">{description}</p>}
      </div>
      {action}
      {href && (
        <Link href={href} className="group inline-flex items-center gap-1.5 text-sm font-semibold text-fg/90 hover:text-fg">
          {hrefLabel}
          <ArrowRight className="size-4 transition-transform group-hover:translate-x-1" aria-hidden="true" />
        </Link>
      )}
    </div>
  );
}
