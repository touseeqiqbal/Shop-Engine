import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { AuthShell } from "@/components/account/auth-shell";
import { RegisterForm } from "@/components/account/auth-forms";
import { getSessionUser } from "@/lib/auth";
import { isDatabaseConfigured } from "@/lib/db/config";
import { pageMetadata } from "@/lib/seo";
import { safePath } from "@/lib/safe-path";

export const dynamic = "force-dynamic";

export const metadata: Metadata = pageMetadata({
  title: "Create Account | Urko Tech Store",
  description: "Create a free Urko Tech Store account for order history, saved addresses and a synced wishlist.",
  path: "/account/register",
  noindex: true,
});

const safe = (n?: string) => (n ? safePath(n, "") || undefined : undefined);

export default async function RegisterPage({ searchParams }: { searchParams: Promise<{ next?: string }> }) {
  const { next } = await searchParams;
  if (isDatabaseConfigured && (await getSessionUser().catch(() => null))) redirect(safe(next) ?? "/account");
  return (
    <AuthShell
      demo={!isDatabaseConfigured}
      title={
        <>
          Create your <span className="gradient-text">account</span>
        </>
      }
      subtitle="Free, takes 30 seconds. Guest checkout always available."
    >
      <RegisterForm next={safe(next)} />
    </AuthShell>
  );
}
