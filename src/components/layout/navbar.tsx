"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { AnimatePresence, m as motion } from "framer-motion";
import { ChevronDown, GitCompareArrows, Heart, Languages, LayoutGrid, Menu, Moon, Search, ShoppingBag, Sun, User, X } from "lucide-react";
import { Logo } from "./logo";
import { CategoryIcon } from "@/components/ui/category-icon";
import { usePrefs } from "@/components/providers/preferences";
import { useChrome } from "@/components/providers/chrome";
import { cartCount, useCart } from "@/store/cart";
import { useLists } from "@/store/lists";
import { useUi } from "@/store/ui";
import { useHydrated } from "@/hooks/use-hydrated";
import { useFocusTrap } from "@/hooks/use-focus-trap";
import { cn } from "@/lib/utils";
import { waLink } from "@/lib/site";
import { useSiteInfo } from "@/components/providers/site-info";
import { primaryPhone } from "@/lib/site-info";
import type { NavLink } from "@/lib/cms/chrome-types";

export function CartButton({ className }: { className?: string }) {
  const lines = useCart((s) => s.lines);
  const pulse = useCart((s) => s.pulse);
  const open = useCart((s) => s.openDrawer);
  const hydrated = useHydrated();
  const count = hydrated ? cartCount(lines) : 0;
  return (
    <button type="button" onClick={open} className={cn("btn btn-ghost btn-icon relative", className)} aria-label={`Open cart, ${count} items`}>
      <ShoppingBag key={pulse} className={cn("size-5", pulse > 0 && "animate-bounce-once")} aria-hidden="true" />
      {count > 0 && (
        <span className="absolute right-0.5 top-0.5 grid min-w-5 place-items-center rounded-full bg-brand-gradient px-1 text-[10px] font-bold leading-5 text-white">
          {count}
        </span>
      )}
    </button>
  );
}

const linkProps = (l: NavLink) => (l.newTab ? { target: "_blank", rel: "noopener noreferrer" } : {});

/** Main navigation – items come from the menu chosen in /cms → Online store → Header (built-in default otherwise). */
export function Navbar({ menu, mobileMenu }: { menu: NavLink[]; mobileMenu?: NavLink[] | null }) {
  const [scrolled, setScrolled] = useState(false);
  const [openIndex, setOpenIndex] = useState<number | null>(null);
  const { theme, setTheme, lang, setLang, t } = usePrefs();
  const { header, theme: themeSettings } = useChrome();
  const setSearchOpen = useUi((s) => s.setSearchOpen);
  const { menuOpen, setMenuOpen } = useUi();
  const { wishlist, compare } = useLists();
  const hydrated = useHydrated();
  const pathname = usePathname();
  const closeTimer = useRef<ReturnType<typeof setTimeout>>(undefined);
  const label = (l: NavLink) => (lang === "ur" && l.labelUr ? l.labelUr : l.label);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 24);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  useEffect(() => {
    setOpenIndex(null);
    setMenuOpen(false);
  }, [pathname, setMenuOpen]);

  // "/" or Ctrl/Cmd+K opens search
  useEffect(() => {
    if (!header.showSearch) return;
    const onKey = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement;
      const typing = target.tagName === "INPUT" || target.tagName === "TEXTAREA" || target.isContentEditable;
      if ((e.key === "/" && !typing) || (e.key.toLowerCase() === "k" && (e.metaKey || e.ctrlKey))) {
        e.preventDefault();
        setSearchOpen(true);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [setSearchOpen, header.showSearch]);

  const open = (i: number) => {
    clearTimeout(closeTimer.current);
    setOpenIndex(i);
  };
  const close = () => {
    closeTimer.current = setTimeout(() => setOpenIndex(null), 150);
  };
  const active = (href: string) => href !== "/" && pathname.startsWith(href.split("?")[0]);
  const openItem = openIndex != null ? menu[openIndex] : null;

  return (
    <header className={cn("top-0 z-40", header.sticky ? "sticky" : "relative")}>
      <div
        className={cn(
          "transition-all duration-300",
          scrolled && header.sticky ? "glass border-x-0 border-t-0 shadow-[0_10px_40px_-20px_rgba(0,0,0,0.6)]" : "border-b border-transparent bg-bg/60 backdrop-blur-md"
        )}
      >
        <nav aria-label="Main" className={cn("container-x flex items-center gap-3 transition-all duration-300", scrolled && header.sticky ? "h-14" : "h-16 lg:h-[4.5rem]")}>
          <button type="button" className="btn btn-ghost btn-icon -ml-2 lg:hidden" onClick={() => setMenuOpen(true)} aria-label="Open menu" aria-expanded={menuOpen}>
            <Menu className="size-5" aria-hidden="true" />
          </button>
          <Logo />

          {/* Desktop links */}
          <ul className="ml-3 hidden shrink-0 items-center gap-1 lg:flex xl:ml-6">
            {menu.map((item, i) =>
              item.children.length ? (
                <li key={`${item.href}-${i}`} onMouseEnter={() => open(i)} onMouseLeave={close} className="relative">
                  <button
                    type="button"
                    className="btn btn-ghost btn-sm gap-1"
                    aria-expanded={openIndex === i}
                    aria-controls={`nav-panel-${i}`}
                    onClick={() => setOpenIndex(openIndex === i ? null : i)}
                  >
                    {item.mega && <LayoutGrid className="size-4" aria-hidden="true" />}
                    {label(item)}
                    <ChevronDown className={cn("size-4 transition-transform", openIndex === i && "rotate-180")} aria-hidden="true" />
                  </button>
                  {/* Simple dropdown */}
                  <AnimatePresence>
                    {!item.mega && openIndex === i && (
                      <motion.ul
                        id={`nav-panel-${i}`}
                        initial={{ opacity: 0, y: -6 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: -6 }}
                        transition={{ duration: 0.15 }}
                        className="glass absolute left-0 top-full mt-2 min-w-56 rounded-2xl p-2 shadow-2xl"
                      >
                        <li>
                          <Link href={item.href} {...linkProps(item)} className="block rounded-xl px-3 py-2 text-sm font-semibold hover:bg-surface-strong">
                            All {label(item)}
                          </Link>
                        </li>
                        {item.children.map((c, j) => (
                          <li key={`${c.href}-${j}`}>
                            <Link href={c.href} {...linkProps(c)} className="block rounded-xl px-3 py-2 text-sm text-muted hover:bg-surface-strong hover:text-fg">
                              {label(c)}
                            </Link>
                          </li>
                        ))}
                      </motion.ul>
                    )}
                  </AnimatePresence>
                </li>
              ) : (
                <li key={`${item.href}-${i}`}>
                  <Link
                    href={item.href}
                    {...linkProps(item)}
                    className={cn("btn btn-ghost btn-sm", active(item.href) && "bg-surface-strong")}
                    aria-current={active(item.href) ? "page" : undefined}
                  >
                    {label(item)}
                  </Link>
                </li>
              )
            )}
          </ul>

          {/* Search trigger */}
          {header.showSearch && (
            <button
              type="button"
              onClick={() => setSearchOpen(true)}
              // a full search bar where there's room (tablets, wide screens); beside a long menu (1024–1279 px) an icon
              className="ml-auto hidden h-11 w-full min-w-0 max-w-sm items-center gap-2 rounded-full border border-border-strong bg-surface px-4 text-left text-sm text-subtle transition hover:border-violet-500/50 md:flex lg:hidden xl:flex"
              aria-label="Search products"
            >
              <Search className="size-4" aria-hidden="true" />
              <span className="flex-1 truncate">{t("searchPlaceholder")}</span>
              <kbd className="hidden rounded-md border border-border-strong px-1.5 py-0.5 text-[10px] font-semibold text-muted xl:inline">Ctrl K</kbd>
            </button>
          )}

          <div className={cn("flex items-center gap-0.5 md:ml-2", "ml-auto")}>
            {header.showSearch && (
              <button type="button" onClick={() => setSearchOpen(true)} className="btn btn-ghost btn-icon md:hidden lg:inline-flex xl:hidden" aria-label="Search">
                <Search className="size-5" aria-hidden="true" />
              </button>
            )}
            {header.showLanguageToggle && (
              <button
                type="button"
                onClick={() => setLang(lang === "en" ? "ur" : "en")}
                className="btn btn-ghost btn-icon hidden sm:inline-flex"
                aria-label={lang === "en" ? "اردو میں دیکھیں" : "Switch to English"}
                title={lang === "en" ? "اردو" : "English"}
              >
                <Languages className="size-5" aria-hidden="true" />
              </button>
            )}
            {themeSettings.allowModeToggle && (
              <button
                type="button"
                onClick={() => setTheme(theme === "dark" ? "light" : "dark")}
                className="btn btn-ghost btn-icon hidden sm:inline-flex"
                aria-label={theme === "dark" ? "Switch to light mode" : "Switch to dark mode"}
              >
                {theme === "dark" ? <Sun className="size-5" aria-hidden="true" /> : <Moon className="size-5" aria-hidden="true" />}
              </button>
            )}
            {header.showAccountLinks && (
              <>
                <Link href="/compare" className="btn btn-ghost btn-icon relative hidden xl:inline-flex" aria-label={`Compare (${hydrated ? compare.length : 0})`}>
                  <GitCompareArrows className="size-5" aria-hidden="true" />
                  {hydrated && compare.length > 0 && (
                    <span className="absolute right-1 top-1 grid size-4 place-items-center rounded-full bg-violet-500 text-[10px] font-bold text-white">{compare.length}</span>
                  )}
                </Link>
                <Link href="/account/wishlist" className="btn btn-ghost btn-icon relative hidden xl:inline-flex" aria-label={`Wishlist (${hydrated ? wishlist.length : 0})`}>
                  <Heart className="size-5" aria-hidden="true" />
                  {hydrated && wishlist.length > 0 && (
                    <span className="absolute right-1 top-1 grid size-4 place-items-center rounded-full bg-rose-500 text-[10px] font-bold text-white">{wishlist.length}</span>
                  )}
                </Link>
                <Link href="/account" prefetch={false} className="btn btn-ghost btn-icon hidden lg:inline-flex" aria-label={t("account")}>
                  <User className="size-5" aria-hidden="true" />
                </Link>
              </>
            )}
            <CartButton />
          </div>
        </nav>
      </div>

      {/* Mega menu */}
      <AnimatePresence>
        {openItem?.mega && (
          <motion.div
            id={`nav-panel-${openIndex}`}
            initial={{ opacity: 0, y: -8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            transition={{ duration: 0.18 }}
            onMouseEnter={() => open(openIndex!)}
            onMouseLeave={close}
            className="absolute inset-x-0 top-full hidden lg:block"
          >
            <div className="container-x">
              <div className="glass mt-2 flex gap-6 rounded-3xl p-6 shadow-2xl">
                <div className="grid flex-1 grid-cols-4 gap-x-6 gap-y-5 xl:grid-cols-5">
                  {openItem.children.map((c, j) => (
                    <div key={`${c.href}-${j}`} className="min-w-0">
                      <Link href={c.href} {...linkProps(c)} className="group flex items-center gap-2 font-semibold text-fg">
                        <span className="grid size-8 place-items-center rounded-lg bg-surface-strong text-violet-300 transition group-hover:bg-brand-gradient group-hover:text-white">
                          <CategoryIcon name={c.icon} className="size-4" />
                        </span>
                        <span className="truncate">{label(c)}</span>
                      </Link>
                      {c.children.length > 0 && (
                        <ul className="mt-2 space-y-1 pl-10">
                          {c.children.slice(0, 6).map((s, k) => (
                            <li key={`${s.href}-${k}`}>
                              <Link href={s.href} {...linkProps(s)} className="block truncate text-sm text-muted hover:text-fg">
                                {label(s)}
                              </Link>
                            </li>
                          ))}
                        </ul>
                      )}
                    </div>
                  ))}
                </div>
                {openItem.image && (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={openItem.image} alt="" loading="lazy" className="hidden w-56 shrink-0 rounded-2xl object-cover xl:block" />
                )}
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      <MobileMenu menu={mobileMenu ?? menu} open={menuOpen} onClose={() => setMenuOpen(false)} />
    </header>
  );
}

const MOBILE_UTILITIES: [string, "compare" | "wishlist" | "trackOrder" | "contact" | "faqs"][] = [
  ["/compare", "compare"],
  ["/account/wishlist", "wishlist"],
  ["/track-order", "trackOrder"],
  ["/contact", "contact"],
  ["/faqs", "faqs"],
];

function MobileMenu({ menu, open, onClose }: { menu: NavLink[]; open: boolean; onClose: () => void }) {
  const { theme, setTheme, lang, setLang, t } = usePrefs();
  const { header, theme: themeSettings } = useChrome();
  const site = useSiteInfo();
  const phone = primaryPhone(site);
  const [expanded, setExpanded] = useState<string | null>(null);
  const panel = useRef<HTMLElement>(null);
  useFocusTrap(panel, open);
  const label = (l: NavLink) => (lang === "ur" && l.labelUr ? l.labelUr : l.label);

  // Items with sub-items become expandable sections; plain links become the quick-link grid.
  const groups = menu.filter((m) => m.children.length);
  const sectionHrefs = new Set(groups.flatMap((g) => g.children.map((c) => c.href)));
  const quick = [
    ...menu.filter((m) => !m.children.length && !sectionHrefs.has(m.href)).map((m) => [m.href, label(m)] as const),
    ...MOBILE_UTILITIES.map(([href, key]) => [href, key === "faqs" ? "FAQs" : t(key)] as const),
  ];

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    document.body.style.overflow = "hidden";
    return () => {
      window.removeEventListener("keydown", onKey);
      document.body.style.overflow = "";
    };
  }, [open, onClose]);

  return (
    <AnimatePresence>
      {open && (
        <>
          <motion.div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm lg:hidden" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={onClose} />
          <motion.aside
            ref={panel}
            role="dialog"
            aria-modal="true"
            aria-label="Menu"
            initial={{ x: "-100%" }}
            animate={{ x: 0 }}
            exit={{ x: "-100%" }}
            transition={{ type: "spring", damping: 30, stiffness: 300 }}
            className="fixed inset-y-0 left-0 z-50 flex w-[86%] max-w-sm flex-col bg-bg-elevated shadow-2xl lg:hidden"
          >
            <div className="flex items-center justify-between border-b border-border p-4">
              <Logo />
              <button type="button" onClick={onClose} className="btn btn-ghost btn-icon" aria-label="Close menu">
                <X className="size-5" aria-hidden="true" />
              </button>
            </div>
            <div className="flex-1 overflow-y-auto p-3">
              {groups.map((g, gi) => (
                <div key={`${g.href}-${gi}`} className={cn(gi > 0 && "mt-4")}>
                  <p className="px-2 pb-2 pt-1 text-xs font-semibold uppercase tracking-wider text-muted">{label(g)}</p>
                  <ul className="space-y-1">
                    {g.children.map((c, ci) => {
                      const key = `${gi}-${c.href}-${ci}`;
                      return (
                        <li key={key}>
                          <div className="flex items-center">
                            <Link href={c.href} {...linkProps(c)} className="flex flex-1 items-center gap-3 rounded-xl px-2 py-2.5 font-medium hover:bg-surface-strong">
                              {c.icon && <CategoryIcon name={c.icon} className="size-5 text-violet-400" />}
                              {label(c)}
                            </Link>
                            {c.children.length > 0 && (
                              <button
                                type="button"
                                className="btn btn-ghost btn-icon"
                                onClick={() => setExpanded(expanded === key ? null : key)}
                                aria-expanded={expanded === key}
                                aria-label={`Show ${c.label} sub-categories`}
                              >
                                <ChevronDown className={cn("size-4 transition-transform", expanded === key && "rotate-180")} aria-hidden="true" />
                              </button>
                            )}
                          </div>
                          {expanded === key && (
                            <ul className="mb-2 ml-10 space-y-0.5 border-l border-border pl-3">
                              {c.children.map((s, si) => (
                                <li key={`${s.href}-${si}`}>
                                  <Link href={s.href} {...linkProps(s)} className="block rounded-lg px-2 py-2 text-sm text-muted hover:text-fg">
                                    {label(s)}
                                  </Link>
                                </li>
                              ))}
                            </ul>
                          )}
                        </li>
                      );
                    })}
                  </ul>
                </div>
              ))}
              <div className="my-4 h-px bg-border" />
              <ul className="grid grid-cols-2 gap-2 text-sm">
                {quick.map(([href, text]) => (
                  <li key={href}>
                    <Link href={href} className="block rounded-xl bg-surface px-3 py-2.5 font-medium hover:bg-surface-strong">
                      {text}
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
            <div className="space-y-3 border-t border-border p-4">
              <div className="flex gap-2">
                {themeSettings.allowModeToggle && (
                  <button type="button" onClick={() => setTheme(theme === "dark" ? "light" : "dark")} className="btn btn-secondary btn-sm flex-1">
                    {theme === "dark" ? <Sun className="size-4" aria-hidden="true" /> : <Moon className="size-4" aria-hidden="true" />}
                    {theme === "dark" ? "Light mode" : "Dark mode"}
                  </button>
                )}
                {header.showLanguageToggle && (
                  <button type="button" onClick={() => setLang(lang === "en" ? "ur" : "en")} className="btn btn-secondary btn-sm flex-1">
                    <Languages className="size-4" aria-hidden="true" />
                    {lang === "en" ? "اردو" : "English"}
                  </button>
                )}
              </div>
              <a href={waLink(phone.wa, `Hi ${site.name}!`)} target="_blank" rel="noopener noreferrer" className="btn btn-whatsapp w-full">
                {t("chatWithUs")} · {phone.display}
              </a>
            </div>
          </motion.aside>
        </>
      )}
    </AnimatePresence>
  );
}
