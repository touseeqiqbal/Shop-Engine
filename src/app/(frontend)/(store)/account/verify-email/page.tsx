import type { Metadata } from "next";
import Link from "next/link";
import { CheckCircle2, XCircle } from "lucide-react";
import { confirmEmail, getSessionUser } from "@/lib/auth";
import { pageMetadata } from "@/lib/seo";
import { getSiteInfo } from "@/lib/repo/site-content";

export const dynamic = "force-dynamic";

export async function generateMetadata(): Promise<Metadata> {
  const { name } = await getSiteInfo(); // the current store's own name
  return {
    ...pageMetadata({ title: `Confirm Email | ${name}`, description: `Confirm the email address of your ${name} account.`, path: "/account/verify-email", noindex: true }),
    referrer: "no-referrer",
  };
}

/** Opened from the link in the "Confirm your email" message. */
export default async function VerifyEmailPage({ searchParams }: { searchParams: Promise<{ token?: string }> }) {
  const { token } = await searchParams;
  const result = token ? await confirmEmail(token).catch(() => "invalid" as const) : "invalid";
  const signedIn = Boolean(await getSessionUser().catch(() => null));
  const ok = result === "ok";
  return (
    <div className="card mx-auto max-w-lg p-6 text-center sm:p-8">
      {ok ? <CheckCircle2 className="mx-auto size-12 text-emerald-400" aria-hidden="true" /> : <XCircle className="mx-auto size-12 text-rose-400" aria-hidden="true" />}
      <h1 className="mt-4 font-display text-2xl font-bold">{ok ? "Email confirmed – thank you!" : result === "expired" ? "This link has expired" : "This link doesn't work"}</h1>
      <p className="mt-2 text-sm text-muted">
        {ok
          ? "Order updates and password resets will reach you at this address."
          : signedIn
            ? "Open your account and press “Send the link again” to get a fresh link."
            : "Sign in to your account and press “Send the link again” to get a fresh link."}
      </p>
      <Link href={signedIn ? "/account" : "/account/login?next=/account"} className="btn btn-primary mt-6">
        {signedIn ? "Go to my account" : "Sign in"}
      </Link>
    </div>
  );
}
