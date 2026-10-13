import Link from "next/link";
import { Heart, MapPin, Package, ShieldCheck } from "lucide-react";
import { DemoBanner } from "./account-ui";

/** Two-column auth layout with benefits panel. Server component. */
export function AuthShell({ title, subtitle, demo, children }: { title: React.ReactNode; subtitle: string; demo: boolean; children: React.ReactNode }) {
  return (
    <div className="mx-auto grid max-w-5xl gap-6 lg:grid-cols-[1fr_1fr] lg:items-stretch">
      <div className="card relative overflow-hidden p-6 sm:p-8">
        <div className="pointer-events-none absolute -right-16 -top-20 size-64 rounded-full bg-violet-500/20 blur-3xl" aria-hidden="true" />
        <div className="relative">
          <h1 className="font-display text-3xl font-bold">{title}</h1>
          <p className="mt-1 text-sm text-muted">{subtitle}</p>
          <div className="mt-6">
            {demo ? (
              <div className="space-y-4">
                <DemoBanner />
                <div className="flex flex-wrap gap-2">
                  <Link href="/account" className="btn btn-primary">
                    Find my orders
                  </Link>
                  <Link href="/account/wishlist" className="btn btn-secondary">
                    My wishlist
                  </Link>
                  <Link href="/account/addresses" className="btn btn-secondary">
                    Saved addresses
                  </Link>
                </div>
              </div>
            ) : (
              children
            )}
          </div>
        </div>
      </div>
      <aside className="card hidden flex-col justify-center gap-5 bg-bg-elevated p-8 lg:flex" aria-label="Account benefits">
        <p className="font-display text-xl font-bold">
          Why create an <span className="gradient-text">account</span>?
        </p>
        {[
          { icon: Package, t: "Order history", d: "See every order and its delivery status in one place." },
          { icon: MapPin, t: "Saved addresses", d: "Check out in seconds with your home or office address." },
          { icon: Heart, t: "Wishlist everywhere", d: "Your saved products follow you across devices." },
          { icon: ShieldCheck, t: "Guest checkout still works", d: "No account is ever required to place an order." },
        ].map(({ icon: Icon, t, d }) => (
          <div key={t} className="flex gap-3">
            <span className="grid size-10 shrink-0 place-items-center rounded-xl bg-brand-gradient text-white">
              <Icon className="size-5" aria-hidden="true" />
            </span>
            <div>
              <p className="font-semibold">{t}</p>
              <p className="text-sm text-muted">{d}</p>
            </div>
          </div>
        ))}
      </aside>
    </div>
  );
}
