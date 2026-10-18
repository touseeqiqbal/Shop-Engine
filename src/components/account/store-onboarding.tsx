"use client";

import Link from "next/link";
import { useActionState, useEffect, useMemo, useState } from "react";
import { useFormStatus } from "react-dom";
import { CheckCircle2, Loader2, PlusCircle } from "lucide-react";
import {
  acceptInvitationAction,
  cancelPlanAction,
  changePlanAction,
  connectPaymentsAction,
  createStoreAction,
  publishStoreAction,
  refreshPaymentsAction,
  setDomainAction,
  verifyDomainAction,
  type StoreFormState,
} from "@/app/(frontend)/(store)/account/stores/actions";
import { Field, fieldAria } from "@/components/checkout/field";
import { Turnstile } from "@/components/ui/turnstile";
import type { MyStore, SubscriptionPlanOption } from "@/lib/store-tenant";
import { allCurrencies, allTimeZones, countryDefaults, countryOptions } from "@/lib/locale";
import { formatMoney } from "@/lib/money";
import { formatDate } from "@/lib/time";

export type StorePlanOption = SubscriptionPlanOption;

const money = (amount: number, currency = "PKR") => (amount === 0 ? "Free" : formatMoney(amount, { currency, locale: "en" }));
// same on the server and in the browser (no time-zone guess that could differ between the two)
const day = (iso: string) => formatDate(iso, { timezone: "UTC", locale: "en" });

/** Country first: it fills in the currency and time zone (both can still be changed). */
function RegionInputs() {
  const countries = useMemo(() => countryOptions(), []);
  const currencies = useMemo(() => allCurrencies(), []);
  const zones = useMemo(() => allTimeZones(), []);
  const [country, setCountry] = useState("PK");
  const [currency, setCurrency] = useState("PKR");
  const [timezone, setTimezone] = useState("Asia/Karachi");
  const pick = (code: string) => {
    const d = countryDefaults(code);
    setCountry(code);
    setCurrency(d.currency);
    setTimezone(d.timezone);
  };
  return (
    <>
      <div className="grid gap-4 sm:grid-cols-2">
        <Field id="store-country" label="Country" hint="Sets your currency, time zone and the checkout address form">
          <select {...fieldAria("store-country", undefined, "hint")} name="country" value={country} onChange={(e) => pick(e.target.value)}>
            {countries.map((c) => (
              <option key={c.code} value={c.code}>
                {c.name}
              </option>
            ))}
          </select>
        </Field>
        <Field id="store-currency" label="Currency">
          <select {...fieldAria("store-currency")} name="currency" value={currency} onChange={(e) => setCurrency(e.target.value)}>
            {currencies.map((c) => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
          </select>
        </Field>
      </div>
      <div className="grid gap-4 sm:grid-cols-2">
        <Field id="store-timezone" label="Time zone">
          <select {...fieldAria("store-timezone")} name="timezone" value={timezone} onChange={(e) => setTimezone(e.target.value)}>
            {zones.map((z) => (
              <option key={z} value={z}>
                {z.replace(/_/g, " ")}
              </option>
            ))}
          </select>
        </Field>
        <Field id="store-language" label="Language">
          <input {...fieldAria("store-language")} name="defaultLanguage" placeholder="en" />
        </Field>
      </div>
    </>
  );
}

function SubmitButton({ label, pendingLabel, className = "btn btn-primary btn-lg w-full", icon = true, disabled = false }: { label: string; pendingLabel?: string; className?: string; icon?: boolean; disabled?: boolean }) {
  const { pending } = useFormStatus();
  return (
    <button type="submit" className={className} disabled={pending || disabled}>
      {pending ? <Loader2 className="size-4 animate-spin" aria-hidden="true" /> : icon ? <PlusCircle className="size-4" aria-hidden="true" /> : null}
      {pending ? (pendingLabel ?? label) : label}
    </button>
  );
}

/** Success / error line of a form; follows `redirectUrl` (payment pages) once shown. */
function FormMessage({ state }: { state: StoreFormState }) {
  useEffect(() => {
    if (state.redirectUrl) window.location.assign(state.redirectUrl);
  }, [state.redirectUrl, state.ts]);
  if (state.error)
    return (
      <p role="alert" className="rounded-2xl border border-rose-500/40 bg-rose-500/10 px-4 py-3 text-sm text-rose-200 light:text-rose-700">
        {state.error}
      </p>
    );
  if (state.message)
    return (
      <p role="status" className="flex items-start gap-2 rounded-2xl border border-emerald-500/40 bg-emerald-500/10 px-4 py-3 text-sm text-emerald-200 light:text-emerald-700">
        <CheckCircle2 className="mt-0.5 size-4 shrink-0" aria-hidden="true" /> {state.message}
      </p>
    );
  return null;
}

function PlanCards({ plans, selected, onSelect, trialUsed = false }: { plans: StorePlanOption[]; selected: string; onSelect: (id: string) => void; trialUsed?: boolean }) {
  return (
    <div className="grid gap-3 md:grid-cols-3" role="radiogroup" aria-label="Plans">
      {plans.map((plan) => (
        <button
          key={plan.id}
          type="button"
          role="radio"
          aria-checked={selected === plan.id}
          onClick={() => onSelect(plan.id)}
          className={`rounded-2xl border p-4 text-left transition ${selected === plan.id ? "border-brand bg-brand/10" : "border-border bg-surface"}`}
        >
          <span className="flex items-center justify-between gap-2">
            <span className="font-semibold">{plan.name}</span>
            {selected === plan.id ? <span className="rounded-full bg-brand-gradient px-2 py-0.5 text-[10px] font-semibold text-white">Selected</span> : null}
          </span>
          {plan.description ? <span className="mt-2 block text-sm text-muted">{plan.description}</span> : null}
          <span className="mt-3 block text-xl font-bold">
            {money(plan.priceMonthly ?? 0, plan.currency)}
            {(plan.priceMonthly ?? 0) > 0 ? <span className="text-sm font-normal text-muted">/month</span> : null}
          </span>
          <span className="mt-1 block text-xs text-muted">
            {(plan.maxProducts ?? 0) > 0 ? `${plan.maxProducts} products` : "Unlimited products"} · {(plan.maxStaffMembers ?? 0) > 0 ? `${plan.maxStaffMembers} team members` : "Unlimited team"}
          </span>
          {(plan.priceMonthly ?? 0) > 0 && (plan.trialDays ?? 0) > 0 && !trialUsed ? <span className="mt-1 block text-xs text-muted">{plan.trialDays}-day free trial</span> : null}
        </button>
      ))}
    </div>
  );
}

export function StoreOnboardingForm({ plans = [] }: { plans?: StorePlanOption[] }) {
  const [state, action] = useActionState<StoreFormState, FormData>(createStoreAction, {});
  const [name, setName] = useState("");
  const [slug, setSlug] = useState("");
  const [selectedPlan, setSelectedPlan] = useState<string>(plans[0]?.id ?? "");
  const suggested = name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 48);

  return (
    <form action={action} className="space-y-4" noValidate>
      <FormMessage state={state} />

      <Field id="store-name" label="Store name" required>
        <input {...fieldAria("store-name")} name="name" placeholder="My Shop" autoComplete="organization" required value={name} onChange={(e) => setName(e.target.value)} />
      </Field>
      <Field id="store-slug" label="Store address" hint="Letters, numbers and dashes – your shop's web address and sub-domain">
        <input {...fieldAria("store-slug", undefined, "hint")} name="slug" placeholder={suggested || "myshop"} value={slug} onChange={(e) => setSlug(e.target.value)} autoComplete="off" />
      </Field>
      <Field id="store-business" label="Business name" hint="Shown on invoices (defaults to the store name)">
        <input {...fieldAria("store-business", undefined, "hint")} name="businessName" placeholder={name || "My Shop (Pvt) Ltd"} autoComplete="off" />
      </Field>
      <RegionInputs />

      {plans.length > 0 ? (
        <div>
          <p className="mb-2 block text-sm font-medium text-fg">Choose a plan</p>
          <PlanCards plans={plans} selected={selectedPlan} onSelect={setSelectedPlan} />
        </div>
      ) : (
        <p className="text-sm text-muted">No plans are offered yet – the store starts without one and ShopEngine support activates it.</p>
      )}

      <input type="hidden" name="subdomain" value={slug || suggested} />
      <input type="hidden" name="planId" value={selectedPlan} />
      <Turnstile action="create-store" />
      <SubmitButton label="Create store" pendingLabel="Creating store..." />
    </form>
  );
}

type Invitation = { id: number; store: { id: number; name: string } | null; role: string; expiresAt: string | null };
const ROLE_LABEL: Record<string, string> = { store_owner: "Owner", store_manager: "Manager", store_staff: "Staff" };

export function StoreInviteActions({ invitations, token }: { invitations: Invitation[]; token?: string | null }) {
  const [state, action] = useActionState<StoreFormState, FormData>(acceptInvitationAction, {});
  return (
    <div className="space-y-3">
      <FormMessage state={state} />
      {token && !state.ok ? (
        <form action={action} className="flex flex-col gap-2 rounded-2xl border border-brand/40 bg-brand/5 p-4 sm:flex-row sm:items-center sm:justify-between" noValidate>
          <p className="text-sm">You opened an invitation link. Accept it to join the store with this account.</p>
          <input type="hidden" name="token" value={token} />
          <SubmitButton label="Accept invitation" pendingLabel="Accepting…" className="btn btn-primary btn-sm" icon={false} />
        </form>
      ) : null}
      {invitations.length === 0 && !token ? (
        <p className="text-sm text-muted">No pending invites right now.</p>
      ) : (
        invitations.map((invitation) => (
          <form key={invitation.id} action={action} className="flex flex-col gap-2 rounded-2xl border border-border bg-surface p-4 sm:flex-row sm:items-center sm:justify-between" noValidate>
            <div>
              <p className="font-semibold">{invitation.store?.name ?? "Store invitation"}</p>
              <p className="text-xs text-muted">
                {ROLE_LABEL[invitation.role] ?? "Team member"}
                {invitation.expiresAt ? ` · until ${day(invitation.expiresAt)}` : ""}
              </p>
            </div>
            <input type="hidden" name="membershipId" value={String(invitation.id)} />
            <SubmitButton label="Accept invite" pendingLabel="Accepting…" className="btn btn-secondary btn-sm" icon={false} />
          </form>
        ))
      )}
    </div>
  );
}

const STATUS_LABEL: Record<string, string> = { draft: "Not published", active: "Live", suspended: "Suspended", closed: "Closed" };
const PLAN_STATUS_LABEL: Record<string, string> = { trialing: "Free trial", active: "Active", past_due: "Payment due", cancelled: "Cancelled", expired: "Ended", suspended: "Suspended" };

function MiniForm({ action, storeId, label, pendingLabel, children, className = "btn btn-secondary btn-sm", twoStep = false, disabled = false }: { action: (s: StoreFormState, fd: FormData) => Promise<StoreFormState>; storeId: number; label: string; pendingLabel?: string; children?: React.ReactNode; className?: string; twoStep?: boolean; disabled?: boolean }) {
  const [state, formAction] = useActionState<StoreFormState, FormData>(action, {});
  // owner actions ask for the 2-step code when the account has 2-step on (or the server says so)
  const askCode = twoStep || Boolean(state.needsCode);
  return (
    <form action={formAction} className="space-y-2" noValidate>
      <FormMessage state={state} />
      <input type="hidden" name="storeId" value={storeId} />
      <div className="flex flex-wrap items-end gap-2">
        {children}
        {askCode ? (
          <input name="code" inputMode="numeric" autoComplete="one-time-code" maxLength={20} placeholder="2-step code" aria-label="2-step code from your authenticator app" className="input w-36" />
        ) : null}
        <SubmitButton label={label} pendingLabel={pendingLabel ?? label} className={className} icon={false} disabled={disabled} />
      </div>
    </form>
  );
}

/** Cancelling the plan is never one click: the owner ticks that they mean it first. */
function CancelPlanForm({ storeId, twoStep }: { storeId: number; twoStep: boolean }) {
  const [sure, setSure] = useState(false);
  return (
    <MiniForm action={cancelPlanAction} storeId={storeId} label="Cancel plan at period end" pendingLabel="Cancelling…" twoStep={twoStep} disabled={!sure}>
      <label className="flex w-full cursor-pointer items-center gap-2 text-sm">
        <input type="checkbox" checked={sure} onChange={(e) => setSure(e.target.checked)} className="size-4 accent-violet-500" />
        Yes, cancel my plan at the end of the period
      </label>
    </MiniForm>
  );
}

/** One store in Account → Stores: status, plan, payments, domain and publishing (owner tools only for the owner). */
export function StoreCard({ store, plans, rootDomain, twoStep = false }: { store: MyStore; plans: StorePlanOption[]; rootDomain?: string | null; twoStep?: boolean }) {
  const owner = store.role === "store_owner";
  const [plan, setPlan] = useState(String(store.planId ?? plans[0]?.id ?? ""));
  const address = store.customDomain && store.domainVerified ? store.customDomain : store.subdomain && rootDomain ? `${store.subdomain}.${rootDomain}` : null;
  return (
    <div className="space-y-4 rounded-2xl border border-border bg-surface p-4">
      <div className="flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <p className="font-semibold">{store.name}</p>
          <p className="text-xs text-muted">
            {STATUS_LABEL[store.status] ?? store.status} · {ROLE_LABEL[store.role] ?? store.role}
            {store.planName ? ` · ${store.planName} (${PLAN_STATUS_LABEL[store.subscriptionStatus] ?? store.subscriptionStatus})` : ""}
            {store.subscriptionStatus === "trialing" && store.trialEndsAt ? ` until ${day(store.trialEndsAt)}` : ""}
          </p>
          {address ? (
            <a href={`https://${address}`} className="text-xs text-violet-300 underline light:text-violet-700" target="_blank" rel="noreferrer">
              {address}
            </a>
          ) : null}
        </div>
        <Link href="/cms" className="btn btn-secondary btn-sm">
          Open /cms
        </Link>
      </div>

      {store.subscriptionStatus === "past_due" ? (
        <p className="rounded-xl border border-amber-500/40 bg-amber-500/10 px-3 py-2 text-sm text-amber-200 light:text-amber-800">
          The plan payment is due{store.graceEndsAt ? ` – the shop goes offline on ${day(store.graceEndsAt)}` : ""}. Choose the plan again below to pay.
        </p>
      ) : null}

      {owner && store.status === "draft" ? <MiniForm action={publishStoreAction} storeId={store.id} label="Publish store" pendingLabel="Publishing…" className="btn btn-primary btn-sm" twoStep={twoStep} /> : null}

      {owner && plans.length > 0 ? (
        <details className="rounded-xl border border-border p-3">
          <summary className="cursor-pointer text-sm font-medium">Plan</summary>
          <div className="mt-3 space-y-3">
            <PlanCards plans={plans} selected={plan} onSelect={setPlan} trialUsed={store.trialUsed} />
            <MiniForm action={changePlanAction} storeId={store.id} label={String(store.planId) === plan && ["active", "trialing"].includes(store.subscriptionStatus) ? "Keep this plan" : "Choose this plan"} pendingLabel="Saving…" twoStep={twoStep}>
              <input type="hidden" name="planId" value={plan} />
              <select name="cycle" className="input w-auto" defaultValue="monthly" aria-label="Billing">
                <option value="monthly">Monthly</option>
                <option value="annual">Yearly</option>
              </select>
            </MiniForm>
            {["active", "trialing"].includes(store.subscriptionStatus) ? <CancelPlanForm storeId={store.id} twoStep={twoStep} /> : null}
          </div>
        </details>
      ) : null}

      {owner ? (
        <details className="rounded-xl border border-border p-3">
          <summary className="cursor-pointer text-sm font-medium">Card payments {store.paymentsReady ? "· ready" : store.paymentsConnected ? "· being checked" : ""}</summary>
          <div className="mt-3 space-y-2 text-sm text-muted">
            <p>Customers pay by card on the payment provider&apos;s secure page; the money goes to your own payment account.</p>
            <MiniForm action={connectPaymentsAction} storeId={store.id} label={store.paymentsConnected ? "Continue payment setup" : "Connect payments"} pendingLabel="Opening…" twoStep={twoStep} />
            {store.paymentsConnected ? <MiniForm action={refreshPaymentsAction} storeId={store.id} label="Check status" pendingLabel="Checking…" /> : null}
          </div>
        </details>
      ) : null}

      {owner ? (
        <details className="rounded-xl border border-border p-3">
          <summary className="cursor-pointer text-sm font-medium">Custom domain {store.customDomain ? `· ${store.customDomain}${store.domainVerified ? " (verified)" : " (not verified)"}` : ""}</summary>
          <div className="mt-3 space-y-3 text-sm">
            <MiniForm action={setDomainAction} storeId={store.id} label="Save domain" pendingLabel="Saving…" twoStep={twoStep}>
              <input name="domain" defaultValue={store.customDomain ?? ""} placeholder="shop.example.com" className="input" aria-label="Domain" />
            </MiniForm>
            {store.customDomain && !store.domainVerified && store.domainToken ? (
              <>
                <p className="text-muted">
                  Point the domain to the platform (CNAME), then add a DNS <b>TXT</b> record on <code>_shopengine.{store.customDomain}</code> (or on the domain itself) with this value:
                </p>
                <code className="block break-all rounded-lg bg-black/30 p-2 text-xs">{store.domainToken}</code>
                <MiniForm action={verifyDomainAction} storeId={store.id} label="Verify" pendingLabel="Checking DNS…" />
              </>
            ) : null}
          </div>
        </details>
      ) : null}
    </div>
  );
}

export function StoreHubLink() {
  return (
    <Link href="/account/stores" className="btn btn-secondary btn-sm">
      Manage stores
    </Link>
  );
}
