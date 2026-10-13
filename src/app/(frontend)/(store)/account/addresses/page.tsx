import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { AccountNav, DemoBanner } from "@/components/account/account-ui";
import { AddressBook } from "@/components/account/address-book";
import { getSessionUser, getUserProfile } from "@/lib/auth";
import { isDatabaseConfigured } from "@/lib/db/config";
import { pageMetadata } from "@/lib/seo";

export const dynamic = "force-dynamic";

export const metadata: Metadata = pageMetadata({
  title: "Saved Addresses | Urko Tech Store",
  description: "Manage your saved delivery addresses for faster checkout.",
  path: "/account/addresses",
  noindex: true,
});

export default async function AddressesPage() {
  const heading = (
    <h1 className="font-display text-3xl font-bold sm:text-4xl">
      Saved <span className="gradient-text">addresses</span>
    </h1>
  );
  if (!isDatabaseConfigured) {
    return (
      <div className="space-y-6">
        {heading}
        <AccountNav />
        <DemoBanner />
        <AddressBook mode="local" />
      </div>
    );
  }
  const user = await getSessionUser();
  if (!user) redirect("/account/login?next=/account/addresses");
  const profile = await getUserProfile(user.id).catch(() => null);
  return (
    <div className="space-y-6">
      {heading}
      <AccountNav />
      <AddressBook mode="remote" initial={profile?.addresses ?? []} />
    </div>
  );
}
