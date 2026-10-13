import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { StoreOnboardingForm, StoreInviteActions, StorePublishedStatus } from "@/components/account/store-onboarding";
import { getSessionUser } from "@/lib/auth";
import { isDatabaseConfigured } from "@/lib/db/config";
import { listPendingStoreInvitations, listStoresForUser, listSubscriptionPlans } from "@/lib/store-tenant";
import { pageMetadata } from "@/lib/seo";

export const dynamic = "force-dynamic";

export const metadata: Metadata = pageMetadata({
  title: "Manage stores | ShopEngine",
  description: "Create and manage your stores in ShopEngine.",
  path: "/account/stores",
  noindex: true,
});

export default async function StoreManagementPage() {
  if (!isDatabaseConfigured) {
    redirect("/account/login?next=/account/stores");
  }

  const user = await getSessionUser();
  if (!user) redirect("/account/login?next=/account/stores");

  const [stores, invitations, plans] = await Promise.all([listStoresForUser(user.id), listPendingStoreInvitations(user.id), listSubscriptionPlans()]);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-3">
        <div>
          <p className="text-sm text-muted">ShopEngine workspace</p>
          <h1 className="font-display text-3xl font-bold sm:text-4xl">Stores</h1>
        </div>
        <Link href="/account" className="btn btn-secondary btn-sm">Back to account</Link>
      </div>

      <section className="card p-5 sm:p-6">
        <h2 className="font-display text-xl font-bold">Create a new store</h2>
        <p className="mt-1 text-sm text-muted">Set up your brand, locale, and storefront configuration.</p>
        <div className="mt-5"><StoreOnboardingForm plans={plans} /></div>
      </section>

      <section className="card p-5 sm:p-6">
        <h2 className="font-display text-xl font-bold">Pending invites</h2>
        <div className="mt-4"><StoreInviteActions invitations={invitations} /></div>
      </section>

      <section className="card p-5 sm:p-6">
        <h2 className="font-display text-xl font-bold">Your stores</h2>
        <div className="mt-4 space-y-3">
          {stores.length === 0 ? (
            <p className="text-sm text-muted">No stores yet. Create your first ShopEngine storefront above.</p>
          ) : (
            stores.map((store) => (
              <div key={String(store.id)} className="flex flex-col gap-3 rounded-2xl border border-border bg-surface p-4 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <p className="font-semibold">{store.name}</p>
                  <p className="text-xs text-muted">{store.slug ? `/${store.slug}` : "Store profile"} · {store.status ?? "draft"}</p>
                </div>
                <StorePublishedStatus storeId={String(store.id)} published={store.status === "active"} />
              </div>
            ))
          )}
        </div>
      </section>
    </div>
  );
}
