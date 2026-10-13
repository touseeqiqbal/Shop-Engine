"use client";

import Link from "next/link";
import { useActionState, useEffect, useState } from "react";
import { useFormStatus } from "react-dom";
import { CheckCircle2, Loader2, PlusCircle } from "lucide-react";
import { acceptInvitationAction, createStoreAction, publishStoreAction, type StoreFormState } from "@/app/(frontend)/(store)/account/stores/actions";
import { Field, fieldAria } from "@/components/checkout/field";

export type StorePlanOption = {
  id: string;
  slug?: string;
  name: string;
  description?: string | null;
  priceMonthly?: number;
  trialDays?: number;
};

function SubmitButton({ label, pendingLabel }: { label: string; pendingLabel?: string }) {
  const { pending } = useFormStatus();
  return (
    <button type="submit" className="btn btn-primary btn-lg w-full" disabled={pending}>
      {pending ? <Loader2 className="size-4 animate-spin" aria-hidden="true" /> : <PlusCircle className="size-4" aria-hidden="true" />}
      {pending ? pendingLabel ?? label : label}
    </button>
  );
}

export function StoreOnboardingForm({ plans = [] }: { plans?: StorePlanOption[] }) {
  const defaultPlans = plans.length > 0 ? plans : [
    { id: "starter", name: "Starter", description: "Launch a single storefront with a basic feature set.", priceMonthly: 0, trialDays: 14 },
    { id: "growth", name: "Growth", description: "For scaling merchants with more products and staff.", priceMonthly: 9999, trialDays: 14 },
    { id: "scale", name: "Scale", description: "Advanced operations and higher limits for growing commerce teams.", priceMonthly: 29999, trialDays: 14 },
  ];
  const [state, action] = useActionState<StoreFormState, FormData>(createStoreAction, {});
  const [slug, setSlug] = useState("");
  const [selectedPlan, setSelectedPlan] = useState<string>(defaultPlans[0]?.id ?? "starter");

  useEffect(() => {
    const input = document.querySelector<HTMLInputElement>('input[name="planId"]');
    if (input) input.value = selectedPlan;
  }, [selectedPlan]);

  return (
    <form action={action} className="space-y-4" noValidate>
      {state.error && (
        <p role="alert" className="rounded-2xl border border-rose-500/40 bg-rose-500/10 px-4 py-3 text-sm text-rose-200">
          {state.error}
        </p>
      )}
      {state.message && (
        <p role="status" className="flex items-start gap-2 rounded-2xl border border-emerald-500/40 bg-emerald-500/10 px-4 py-3 text-sm text-emerald-200">
          <CheckCircle2 className="mt-0.5 size-4" aria-hidden="true" /> {state.message}
        </p>
      )}

      <Field id="store-name" label="Store name" required>
        <input {...fieldAria("store-name")} name="name" placeholder="My Shop" autoComplete="organization" required />
      </Field>
      <Field id="store-slug" label="Store URL slug" hint="Used for your storefront subdomain">
        <input
          {...fieldAria("store-slug", undefined, "hint")}
          name="slug"
          placeholder="myshop"
          value={slug}
          onChange={(e) => setSlug(e.target.value)}
          autoComplete="off"
        />
      </Field>
      <div className="grid gap-4 sm:grid-cols-2">
        <Field id="store-country" label="Country">
          <input {...fieldAria("store-country")} name="country" placeholder="Pakistan" />
        </Field>
        <Field id="store-currency" label="Currency">
          <input {...fieldAria("store-currency")} name="currency" placeholder="PKR" />
        </Field>
      </div>
      <div className="grid gap-4 sm:grid-cols-2">
        <Field id="store-timezone" label="Timezone">
          <input {...fieldAria("store-timezone")} name="timezone" placeholder="Asia/Karachi" />
        </Field>
        <Field id="store-language" label="Language">
          <input {...fieldAria("store-language")} name="defaultLanguage" placeholder="en" />
        </Field>
      </div>

      <div>
        <label className="mb-2 block text-sm font-medium text-foreground">Choose a plan</label>
        <div className="grid gap-3 md:grid-cols-3">
          {defaultPlans.map((plan) => (
            <button
              key={plan.id}
              type="button"
              onClick={() => setSelectedPlan(plan.id)}
              className={`rounded-2xl border p-4 text-left transition ${selectedPlan === plan.id ? "border-primary bg-primary/10" : "border-border bg-surface"}`}
            >
              <div className="flex items-center justify-between gap-2">
                <span className="font-semibold">{plan.name}</span>
                {selectedPlan === plan.id ? <span className="rounded-full bg-primary px-2 py-0.5 text-[10px] text-primary-foreground">Selected</span> : null}
              </div>
              <p className="mt-2 text-sm text-muted">{plan.description}</p>
              <p className="mt-3 text-xl font-bold">{plan.priceMonthly === 0 ? "Free" : `PKR ${plan.priceMonthly.toLocaleString()}/mo`}</p>
              <p className="mt-1 text-xs text-muted">{plan.trialDays} day trial</p>
            </button>
          ))}
        </div>
      </div>

      <FieldsHidden slug={slug} selectedPlan={selectedPlan} />
      <SubmitButton label="Create store" pendingLabel="Creating store..." />
    </form>
  );
}

function FieldsHidden({ slug, selectedPlan }: { slug: string; selectedPlan: string }) {
  return (
    <>
      <input type="hidden" name="businessName" value={slug || ""} />
      <input type="hidden" name="subdomain" value={slug || ""} />
      <input type="hidden" name="planId" value={selectedPlan || ""} />
    </>
  );
}

export function StoreInviteActions({ invitations }: { invitations: Array<{ id: string | number; store?: { id: string | number; name?: string; slug?: string } | null }> }) {
  const [state, action] = useActionState<StoreFormState, FormData>(acceptInvitationAction, {});

  return (
    <div className="space-y-3">
      {state.error && <p role="alert" className="...">{state.error}</p>}
      {state.message && <p role="status" className="...">{state.message}</p>}
      {invitations.length === 0 ? (
        <p className="text-sm text-muted">No pending invites right now.</p>
      ) : (
        invitations.map((invitation) => (
          <form key={String(invitation.id)} action={action} className="flex flex-col gap-2 rounded-2xl border border-border bg-surface p-4 sm:flex-row sm:items-center sm:justify-between" noValidate>
            <div>
              <p className="font-semibold">{invitation.store?.name ?? "Store invitation"}</p>
              <p className="text-xs text-muted">{invitation.store?.slug ? `/${invitation.store.slug}` : "Store access"}</p>
            </div>
            <input type="hidden" name="membershipId" value={String(invitation.id)} />
            <button type="submit" className="btn btn-secondary btn-sm">Accept invite</button>
          </form>
        ))
      )}
    </div>
  );
}

export function StorePublishedStatus({ storeId, published }: { storeId: string; published: boolean }) {
  const [state, action] = useActionState<StoreFormState, FormData>(publishStoreAction, {});
  if (published) return <p className="text-sm text-emerald-200">This store is live.</p>;

  return (
    <form action={action} className="mt-3" noValidate>
      {state.error && <p role="alert" className="mb-2 ...">{state.error}</p>}
      {state.message && <p role="status" className="mb-2 ...">{state.message}</p>}
      <input type="hidden" name="storeId" value={storeId} />
      <button type="submit" className="btn btn-secondary btn-sm">Publish store</button>
    </form>
  );
}

export function StoreHubLink() {
  return <Link href="/account/stores" className="btn btn-secondary btn-sm">Manage stores</Link>;
}
