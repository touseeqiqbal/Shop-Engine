"use client";
import { WhatsAppIcon } from "@/components/layout/whatsapp-icon";
import { useSiteInfo } from "@/components/providers/site-info";
import { waLink } from "@/lib/site";
import { cn } from "@/lib/utils";

/** Gradient call-to-action panel with WhatsApp + call buttons for both sales numbers. */
export function WhatsAppCta({
  title = "Need help choosing? Ask us on WhatsApp",
  text = "Tell us your budget, city and what you need – our team in Saddar, Karachi replies within minutes during store hours.",
  message = "Hi Urko Tech Store! I need help choosing a laptop.",
  className,
  headingLevel = "h2",
}: {
  title?: string;
  text?: string;
  message?: string;
  className?: string;
  headingLevel?: "h2" | "h3";
}) {
  const H = headingLevel;
  const site = useSiteInfo(); // live phones (/cms → Settings → Store details)
  return (
    <div className={cn("relative overflow-hidden rounded-[1.75rem] border border-emerald-500/25 bg-gradient-to-br from-emerald-500/15 via-teal-500/5 to-violet-600/15 p-6 sm:p-10", className)}>
      <div className="bg-grid pointer-events-none absolute inset-0 opacity-50" aria-hidden="true" />
      <div className="pointer-events-none absolute -right-16 -top-16 size-64 rounded-full bg-emerald-500/20 blur-3xl" aria-hidden="true" />
      <div className="relative flex flex-col gap-6 md:flex-row md:items-center md:justify-between">
        <div className="flex items-start gap-4">
          <span className="grid size-14 shrink-0 place-items-center rounded-2xl bg-[#16a34a] text-white shadow-lg shadow-emerald-900/40">
            <WhatsAppIcon className="size-7" />
          </span>
          <div>
            <H className="text-xl font-bold text-fg sm:text-2xl">{title}</H>
            <p className="mt-1 max-w-xl text-sm text-muted sm:text-base">{text}</p>
          </div>
        </div>
        <div className="flex flex-col gap-2 sm:flex-row md:flex-col lg:flex-row">
          {site.phones.map((p, i) => (
            <a
              key={p.wa}
              href={waLink(p.wa, message)}
              target="_blank"
              rel="noopener noreferrer"
              className={cn("btn", i === 0 ? "btn-whatsapp" : "btn-secondary")}
            >
              <WhatsAppIcon className="size-4" />
              {p.display}
            </a>
          ))}
        </div>
      </div>
    </div>
  );
}
