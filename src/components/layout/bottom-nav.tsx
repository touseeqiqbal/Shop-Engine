"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Home, LayoutGrid, Search, ShoppingBag, User } from "lucide-react";
import { cartCount, useCart } from "@/store/cart";
import { useUi } from "@/store/ui";
import { usePrefs } from "@/components/providers/preferences";
import { useHydrated } from "@/hooks/use-hydrated";
import { cn } from "@/lib/utils";

/** Mobile-only app-style bottom navigation. */
export function BottomNav() {
  const pathname = usePathname();
  const { t } = usePrefs();
  const lines = useCart((s) => s.lines);
  const pulse = useCart((s) => s.pulse);
  const setSearchOpen = useUi((s) => s.setSearchOpen);
  const hydrated = useHydrated();
  const count = hydrated ? cartCount(lines) : 0;

  const item = "flex flex-1 flex-col items-center justify-center gap-0.5 py-2 text-[11px] font-medium transition-colors";
  const isActive = (href: string) => (href === "/" ? pathname === "/" : pathname.startsWith(href));

  return (
    <nav
      aria-label="Mobile"
      className="glass fixed inset-x-0 bottom-0 z-40 border-x-0 border-b-0 pb-[env(safe-area-inset-bottom)] lg:hidden"
    >
      <ul className="flex h-16 items-stretch">
        <li className="flex flex-1">
          <Link href="/" className={cn(item, isActive("/") ? "text-fg" : "text-muted")} aria-current={isActive("/") ? "page" : undefined}>
            <Home className="size-[22px]" aria-hidden="true" />
            {t("home")}
          </Link>
        </li>
        <li className="flex flex-1">
          <Link href="/category" className={cn(item, isActive("/category") ? "text-fg" : "text-muted")}>
            <LayoutGrid className="size-[22px]" aria-hidden="true" />
            {t("categories")}
          </Link>
        </li>
        <li className="flex flex-1">
          <button type="button" onClick={() => setSearchOpen(true)} className={cn(item, "text-muted")}>
            <span className="-mt-6 grid size-12 place-items-center rounded-full bg-brand-gradient text-white shadow-[0_8px_24px_-6px_rgba(139,92,246,0.8)]">
              <Search className="size-5" aria-hidden="true" />
            </span>
            {t("search")}
          </button>
        </li>
        <li className="flex flex-1">
          <Link href="/cart" prefetch={false} className={cn(item, "relative", isActive("/cart") ? "text-fg" : "text-muted")}>
            <span className="relative">
              <ShoppingBag key={pulse} className={cn("size-[22px]", pulse > 0 && "animate-bounce-once")} aria-hidden="true" />
              {count > 0 && (
                <span className="absolute -right-2.5 -top-1.5 grid min-w-[18px] place-items-center rounded-full bg-brand-gradient px-1 text-[10px] font-bold leading-[18px] text-white">
                  {count}
                </span>
              )}
            </span>
            {t("cart")}
          </Link>
        </li>
        <li className="flex flex-1">
          <Link href="/account" prefetch={false} className={cn(item, isActive("/account") ? "text-fg" : "text-muted")}>
            <User className="size-[22px]" aria-hidden="true" />
            {t("account")}
          </Link>
        </li>
      </ul>
    </nav>
  );
}
