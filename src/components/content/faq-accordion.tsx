import { ChevronDown } from "lucide-react";
import type { FaqItem } from "@/lib/types";
import { cn } from "@/lib/utils";

/** Accessible, JS-free accordion built on <details>/<summary>. */
export function FaqAccordion({ items, className, headingLevel = "h3" }: { items: FaqItem[]; className?: string; headingLevel?: "h2" | "h3" }) {
  const H = headingLevel;
  return (
    <div className={cn("space-y-3", className)}>
      {items.map((f, i) => (
        <details key={f.q} className="card group overflow-hidden open:border-violet-500/40" open={i === 0}>
          <summary className="flex cursor-pointer list-none items-center justify-between gap-4 p-5 text-left [&::-webkit-details-marker]:hidden">
            <H className="font-sans text-[0.95rem] font-semibold tracking-normal text-fg sm:text-base">{f.q}</H>
            <ChevronDown className="size-5 shrink-0 text-muted transition-transform duration-300 group-open:rotate-180" aria-hidden="true" />
          </summary>
          <div className="px-5 pb-5 text-sm leading-relaxed text-muted sm:text-[0.95rem]">{f.a}</div>
        </details>
      ))}
    </div>
  );
}
