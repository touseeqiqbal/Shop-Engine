import type { Metadata } from "next";
import { AuthShell } from "@/components/account/auth-shell";
import { ForgotPasswordForm } from "@/components/account/auth-forms";
import { isDatabaseConfigured } from "@/lib/db/config";
import { pageMetadata } from "@/lib/seo";
import { getSiteInfo } from "@/lib/repo/site-content";

export async function generateMetadata(): Promise<Metadata> {
  const { name } = await getSiteInfo(); // the current store's own name
  return pageMetadata({
    title: `Forgot Password | ${name}`,
    description: `Get a link to choose a new password for your ${name} account.`,
    path: "/account/forgot-password",
    noindex: true,
  });
}

export default function ForgotPasswordPage() {
  return (
    <AuthShell
      demo={!isDatabaseConfigured}
      title={
        <>
          Forgot your <span className="gradient-text">password?</span>
        </>
      }
      subtitle="Enter your account email and we'll send you a link to choose a new one."
    >
      <ForgotPasswordForm />
    </AuthShell>
  );
}
