import type { Metadata } from "next";
import Link from "next/link";
import { AuthShell } from "@/components/account/auth-shell";
import { ResetPasswordForm } from "@/components/account/auth-forms";
import { isDatabaseConfigured } from "@/lib/db/config";
import { pageMetadata } from "@/lib/seo";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  ...pageMetadata({
    title: "Choose a New Password | Urko Tech Store",
    description: "Choose a new password for your Urko Tech Store account.",
    path: "/account/reset-password",
    noindex: true,
  }),
  referrer: "no-referrer", // the token is in the URL – never pass it on to other sites
};

export default async function ResetPasswordPage({ searchParams }: { searchParams: Promise<{ token?: string }> }) {
  const { token } = await searchParams;
  return (
    <AuthShell
      demo={!isDatabaseConfigured}
      title={
        <>
          Choose a new <span className="gradient-text">password</span>
        </>
      }
      subtitle="You'll be signed in straight after."
    >
      {token ? (
        <ResetPasswordForm token={token} />
      ) : (
        <p className="text-sm text-muted">
          This link is incomplete. Open the link from the email again, or{" "}
          <Link href="/account/forgot-password" className="font-semibold text-violet-300 hover:text-violet-200">
            ask for a new one
          </Link>
          .
        </p>
      )}
    </AuthShell>
  );
}
