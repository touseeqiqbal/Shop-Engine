import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { AuthShell } from "@/components/account/auth-shell";
import { LoginForm } from "@/components/account/auth-forms";
import { getSessionUser } from "@/lib/auth";
import { isDatabaseConfigured } from "@/lib/db/config";
import { pageMetadata } from "@/lib/seo";
import { safePath } from "@/lib/safe-path";

export const dynamic = "force-dynamic";

export const metadata: Metadata = pageMetadata({
  title: "Sign In | Urko Tech Store",
  description: "Sign in to your Urko Tech Store account to view orders and saved addresses.",
  path: "/account/login",
  noindex: true,
});

const safe = (n?: string) => (n ? safePath(n, "") || undefined : undefined);

export default async function LoginPage({ searchParams }: { searchParams: Promise<{ next?: string; reset?: string }> }) {
  const { next, reset } = await searchParams;
  if (isDatabaseConfigured && (await getSessionUser().catch(() => null))) redirect(safe(next) ?? "/account");
  return (
    <AuthShell
      demo={!isDatabaseConfigured}
      title={
        <>
          Welcome <span className="gradient-text">back</span>
        </>
      }
      subtitle="Sign in to track orders and check out faster."
    >
      {reset && (
        <p role="status" className="mb-4 rounded-2xl border border-emerald-500/40 bg-emerald-500/10 px-4 py-3 text-sm text-emerald-200">
          Your new password is saved – please sign in with it.
        </p>
      )}
      <LoginForm next={safe(next)} />
    </AuthShell>
  );
}
