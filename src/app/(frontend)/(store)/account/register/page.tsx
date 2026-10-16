import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { AuthShell } from "@/components/account/auth-shell";
import { RegisterForm } from "@/components/account/auth-forms";
import { getSessionUser } from "@/lib/auth";
import { isDatabaseConfigured } from "@/lib/db/config";
import { pageMetadata } from "@/lib/seo";
import { getSiteInfo } from "@/lib/repo/site-content";
import { safePath } from "@/lib/safe-path";
import { isPlatformRequest } from "@/lib/tenant";

export const dynamic = "force-dynamic";

export async function generateMetadata(): Promise<Metadata> {
  const { name } = await getSiteInfo(); // the current store's own name
  return pageMetadata({
    title: `Create Account | ${name}`,
    description: `Create a free ${name} account for order history, saved addresses and a synced wishlist.`,
    path: "/account/register",
    noindex: true,
  });
}

const safe = (n?: string) => (n ? safePath(n, "") || undefined : undefined);

export default async function RegisterPage({ searchParams }: { searchParams: Promise<{ next?: string }> }) {
  const { next } = await searchParams;
  if (isDatabaseConfigured && (await getSessionUser().catch(() => null))) redirect(safe(next) ?? "/account");
  // ShopEngine's own address: a merchant opening their ShopEngine account
  if (await isPlatformRequest())
    return (
      <AuthShell
        demo={!isDatabaseConfigured}
        merchant
        title={
          <>
            Create your <span className="gradient-text">ShopEngine</span> account
          </>
        }
        subtitle="Next you confirm your email, then open your first store."
      >
        <RegisterForm next={safe(next) ?? "/account/stores"} askPhone={false} />
      </AuthShell>
    );
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
