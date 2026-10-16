"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useId, useRef, useState } from "react";
import { ArrowRight, BookOpen, Briefcase, ChevronDown, CircleHelp, CreditCard, Info, LayoutGrid, Mail, Menu, Rocket, ScanBarcode, ShieldCheck, Store, X } from "lucide-react";
import type { NavItem } from "./nav-data";

const ICONS = { Store, ScanBarcode, Briefcase, LayoutGrid, CreditCard, ShieldCheck, BookOpen, CircleHelp, Info, Mail, Rocket };

/** A header dropdown (Product, Resources): a disclosure button with its panel – Escape, outside click and navigating close it. */
export function NavDropdown({ label, groups, footer }: { label: string; groups: { title: string; items: NavItem[] }[]; footer?: { label: string; href: string } }) {
  const [open, setOpen] = useState(false);
  const id = useId();
  const box = useRef<HTMLDivElement>(null);
  const button = useRef<HTMLButtonElement>(null);
  const pathname = usePathname();
  useEffect(() => setOpen(false), [pathname]);
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== "Escape") return;
      setOpen(false);
      button.current?.focus();
    };
    const onClick = (e: MouseEvent) => box.current && !box.current.contains(e.target as Node) && setOpen(false);
    document.addEventListener("keydown", onKey);
    document.addEventListener("mousedown", onClick);
    return () => {
      document.removeEventListener("keydown", onKey);
      document.removeEventListener("mousedown", onClick);
    };
  }, [open]);
  return (
    <div ref={box} className="relative">
      <button
        ref={button}
        type="button"
        aria-expanded={open}
        aria-controls={id}
        onClick={() => setOpen((o) => !o)}
        className={`inline-flex items-center gap-1 rounded-full px-3.5 py-2 text-sm font-medium transition-colors hover:text-white ${open ? "bg-white/[0.07] text-white" : "text-ink-2"}`}
      >
        {label}
        <ChevronDown className={`size-3.5 opacity-60 transition-transform duration-200 ${open ? "rotate-180" : ""}`} aria-hidden="true" />
      </button>
      <div id={id} hidden={!open} className="absolute left-1/2 top-full z-50 -translate-x-1/2 pt-3">
        <div className="w-[min(92vw,660px)] animate-[rise_0.25s_ease-out_both] overflow-hidden rounded-3xl border border-white/10 bg-[#0a0f2b] shadow-[0_30px_80px_-20px_rgba(0,0,0,0.9),0_0_0_1px_rgba(255,255,255,0.04)]">
          <div className="grid gap-6 p-5 sm:grid-cols-2">
            {groups.map((g) => (
              <div key={g.title}>
                <p className="px-2.5 text-[11px] font-semibold uppercase tracking-[0.12em] text-faint">{g.title}</p>
                <ul className="mt-2 space-y-0.5">
                  {g.items.map((it) => {
                    const Icon = it.icon ? ICONS[it.icon] : null;
                    return (
                      <li key={it.href}>
                        <Link href={it.href} onClick={() => setOpen(false)} className="group flex gap-3 rounded-2xl p-2.5 transition-colors hover:bg-white/[0.05]">
                          {Icon && (
                            <span className="mt-0.5 grid size-9 shrink-0 place-items-center rounded-xl border border-white/10 bg-gradient-to-b from-white/[0.08] to-white/[0.02] text-brand-200 transition-colors group-hover:text-white">
                              <Icon className="size-4" aria-hidden="true" />
                            </span>
                          )}
                          <span>
                            <span className="block text-sm font-medium text-ink">{it.label}</span>
                            {it.text && <span className="mt-0.5 block text-[0.8125rem] leading-snug text-faint">{it.text}</span>}
                          </span>
                        </Link>
                      </li>
                    );
                  })}
                </ul>
              </div>
            ))}
          </div>
          {footer && (
            <Link href={footer.href} onClick={() => setOpen(false)} className="group flex items-center justify-between border-t border-white/[0.07] bg-white/[0.025] px-6 py-3.5 text-sm text-ink-2 transition-colors hover:text-white">
              {footer.label}
              <ArrowRight className="size-4 transition-transform group-hover:translate-x-0.5" aria-hidden="true" />
            </Link>
          )}
        </div>
      </div>
    </div>
  );
}

/** The small-screen menu: every link and both actions, closed by Escape or by following a link. */
export function MobileMenu({ groups, links, signIn, signUp }: { groups: { title: string; items: NavItem[] }[]; links: { label: string; href: string }[]; signIn: string; signUp: string }) {
  const [open, setOpen] = useState(false);
  const button = useRef<HTMLButtonElement>(null);
  const pathname = usePathname();
  useEffect(() => setOpen(false), [pathname]);
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== "Escape") return;
      setOpen(false);
      button.current?.focus();
    };
    document.addEventListener("keydown", onKey);
    const overflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = overflow;
    };
  }, [open]);
  return (
    <div className="lg:hidden">
      <button
        ref={button}
        type="button"
        aria-expanded={open}
        aria-controls="mk-mobile-menu"
        aria-label={open ? "Close menu" : "Open menu"}
        onClick={() => setOpen((o) => !o)}
        className="grid size-10 place-items-center rounded-full text-ink transition-colors hover:bg-white/10"
      >
        {open ? <X className="size-5" aria-hidden="true" /> : <Menu className="size-5" aria-hidden="true" />}
      </button>
      {/* a sheet under the floating bar; any link closes it – also one to the page already open (e.g. /features#payments) */}
      <div
        id="mk-mobile-menu"
        hidden={!open}
        onClick={(e) => (e.target as HTMLElement).closest("a") && setOpen(false)}
        className="absolute inset-x-0 top-[calc(100%+0.5rem)] z-40 max-h-[calc(100dvh-6.5rem)] animate-[rise_0.25s_ease-out_both] overflow-y-auto overscroll-contain rounded-3xl border border-white/10 bg-[#0a0f2b] shadow-[0_30px_80px_-20px_rgba(0,0,0,0.95)]"
      >
        <nav aria-label="Mobile" className="p-3">
          <ul className="space-y-0.5">
            {links.map((l) => (
              <li key={l.href}>
                <Link href={l.href} className="flex items-center justify-between rounded-2xl px-4 py-3 text-base font-medium text-ink hover:bg-white/[0.05]">
                  {l.label}
                  <ArrowRight className="size-4 text-faint" aria-hidden="true" />
                </Link>
              </li>
            ))}
          </ul>
          {groups.map((g) => (
            <div key={g.title} className="mt-4 border-t border-white/[0.07] pt-4">
              <p className="px-4 text-[11px] font-semibold uppercase tracking-[0.12em] text-faint">{g.title}</p>
              <ul className="mt-1">
                {g.items.map((it) => {
                  const Icon = it.icon ? ICONS[it.icon] : null;
                  return (
                    <li key={it.href}>
                      <Link href={it.href} className="flex items-center gap-3 rounded-2xl px-4 py-2.5 text-[0.9375rem] text-ink-2 hover:bg-white/[0.05]">
                        {Icon && <Icon className="size-4 text-brand-200" aria-hidden="true" />}
                        {it.label}
                      </Link>
                    </li>
                  );
                })}
              </ul>
            </div>
          ))}
          <div className="mt-4 grid gap-2 border-t border-white/[0.07] p-2 pt-5">
            <Link href={signUp} className="mk-btn mk-btn-primary mk-btn-lg">
              Start free trial
            </Link>
            <Link href={signIn} className="mk-btn mk-btn-secondary mk-btn-lg">
              Sign in
            </Link>
          </div>
        </nav>
      </div>
    </div>
  );
}
