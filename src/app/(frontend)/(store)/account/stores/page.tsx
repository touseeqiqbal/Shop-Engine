import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { StoreCard, StoreInviteActions, StoreOnboardingForm } from "@/components/account/store-onboarding";
import { getSessionUser } from "@/lib/auth";
import { isCmsConfigured } from "@/lib/db/config";
import { listPendingStoreInvitations, listStoresForUser, listSubscriptionPlans } from "@/lib/store-tenant";
import { platformRootDomain } from "@/lib/tenant-shared";
import { pageMetadata } from "@/lib/seo";

export const dynamic = "force-dynamic";

export const metadata: Metadata = pageMetadata({
  title: "Manage stores | ShopEngine",
  description: "Create and manage your stores in ShopEngine.",
  path: "/account/stores",
  noindex: true,
});

/** 2-step on for this account → the owner tools below ask for a code (the shop sign-in is password-only). */
async function accountHasTwoStep(storefrontUserId: string): Promise<boolean> {
  const [{ payloadClient }, { byStorefrontId }, { twoStepOn }] = await Promise.all([import("@/lib/cms/catalog-source"), import("@/lib/cms/sales"), import("@/payload/endpoints/two-factor")]);
  const payload = await payloadClient();
  const u = (await payload.find({ collection: "users", where: byStorefrontId(storefrontUserId), limit: 1, depth: 0, overrideAccess: true })).docs[0] as { id?: number } | undefined;
  return u?.id ? twoStepOn(payload, Number(u.id)) : false;
}

export default async function StoreManagementPage({ searchParams }: { searchParams: Promise<{ invite?: string }> }) {
  const { invite } = await searchParams;
  const token = invite && /^[A-Za-z0-9_-]{20,64}$/.test(invite) ? invite : null;
  const next = `/account/stores${token ? `?invite=${token}` : ""}`;
  if (!isCmsConfigured) redirect(`/account/login?next=${encodeURIComponent(next)}`);

  const user = await getSessionUser();
  if (!user) redirect(`/account/login?next=${encodeURIComponent(next)}`);

  const [stores, invitations, plans, twoStep] = await Promise.all([listStoresForUser(user.id), listPendingStoreInvitations(user.id), listSubscriptionPlans(), accountHasTwoStep(user.id)]);
  const root = platformRootDomain() || null;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-3">
        <div>
          <p className="text-sm text-muted">ShopEngine – the engine that powers shops</p>
          <h1 className="font-display text-3xl font-bold sm:text-4xl">Stores</h1>
        </div>
        <Link href="/account" className="btn btn-secondary btn-sm">
          Back to account
        </Link>
      </div>

      {token || invitations.length > 0 ? (
        <section className="card p-5 sm:p-6">
          <h2 className="font-display text-xl font-bold">Invitations</h2>
          <div className="mt-4">
            <StoreInviteActions invitations={invitations} token={token} />
          </div>
        </section>
      ) : null}

      <section className="card p-5 sm:p-6">
        <h2 className="font-display text-xl font-bold">Your stores</h2>
        <div className="mt-4 space-y-3">
          {stores.length === 0 ? (
            <p className="text-sm text-muted">No stores yet. Create your first ShopEngine store below.</p>
          ) : (
            stores.map((store) => <StoreCard key={store.id} store={store} plans={plans} rootDomain={root} twoStep={twoStep} />)
          )}
        </div>
      </section>

      <section className="card p-5 sm:p-6">
        <h2 className="font-display text-xl font-bold">Create a new store</h2>
        <p className="mt-1 text-sm text-muted">It starts unpublished: add your products and settings in /cms, then publish it here.</p>
        <div className="mt-5">
          <StoreOnboardingForm plans={plans} />
        </div>
      </section>
    </div>
  );
}
