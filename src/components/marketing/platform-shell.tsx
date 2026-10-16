import Link from "next/link";
import { ShopEngineLogo } from "./logo";

/**
 * The frame of the merchant account pages on ShopEngine's own address (sign-up, sign-in, Stores): ShopEngine's logo and a
 * way back to the website – never a store's menu, cart or footer. Dark, like the website (see app/(frontend)/layout.tsx).
 */
export function PlatformShell({ children }: { children: React.ReactNode }) {
  const year = new Date().getFullYear();
  return (
    <div className="flex min-h-dvh flex-col bg-bg">
      <header className="border-b border-border bg-bg-elevated">
        <div className="container-x flex h-16 items-center justify-between gap-4">
          <Link href="/" aria-label="ShopEngine home" className="rounded-lg focus-visible:outline-2 focus-visible:outline-offset-4">
            <ShopEngineLogo size={30} onDark />
          </Link>
          <nav aria-label="ShopEngine" className="flex items-center gap-4 text-sm">
            <Link href="/pricing" className="text-muted hover:text-fg">
              Pricing
            </Link>
            <Link href="/account/stores" className="font-semibold text-fg hover:underline">
              Your stores
            </Link>
          </nav>
        </div>
      </header>
      <main id="main" className="flex-1">
        {children}
      </main>
      <footer className="border-t border-border">
        <div className="container-x flex flex-wrap items-center justify-between gap-3 py-6 text-xs text-muted">
          <p>© {year} ShopEngine</p>
          <nav aria-label="Legal" className="flex gap-4">
            <Link href="/privacy" className="hover:text-fg">
              Privacy
            </Link>
            <Link href="/terms" className="hover:text-fg">
              Terms
            </Link>
            <Link href="/contact" className="hover:text-fg">
              Contact
            </Link>
          </nav>
        </div>
      </footer>
    </div>
  );
}
