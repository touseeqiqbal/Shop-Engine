"use client";
import Link from "next/link";
import { useActionState, useState } from "react";
import { useFormStatus } from "react-dom";
import { AlertCircle, CheckCircle2, Eye, EyeOff, Loader2, MailCheck } from "lucide-react";
import {
  forgotPasswordAction,
  loginAction,
  registerAction,
  resendConfirmationAction,
  resetPasswordAction,
  type AuthFormState,
  type ForgotState,
} from "@/app/(frontend)/(store)/account/actions";
import { Field, fieldAria } from "@/components/checkout/field";
import { formatPhoneInput } from "@/components/checkout/phone";
import { honeypotProps } from "@/lib/honeypot";
import { Turnstile } from "@/components/ui/turnstile";

function Submit({ children }: { children: React.ReactNode }) {
  const { pending } = useFormStatus();
  return (
    <button type="submit" className="btn btn-primary btn-lg w-full" disabled={pending}>
      {pending && <Loader2 className="size-4 animate-spin" aria-hidden="true" />}
      {children}
    </button>
  );
}

function FormError({ state }: { state: { error?: string } }) {
  return (
    <div aria-live="assertive">
      {state.error && (
        <p role="alert" className="flex items-start gap-2 rounded-2xl border border-rose-500/40 bg-rose-500/10 px-4 py-3 text-sm text-rose-200">
          <AlertCircle className="mt-0.5 size-4 shrink-0 text-rose-400" aria-hidden="true" /> {state.error}
        </p>
      )}
    </div>
  );
}

function PasswordInput({ id, error, autoComplete, name = "password", describedByHint }: { id: string; error?: string; autoComplete: string; name?: string; describedByHint?: boolean }) {
  const [show, setShow] = useState(false);
  return (
    <div className="relative">
      <input {...fieldAria(id, error, describedByHint ? "hint" : undefined)} name={name} type={show ? "text" : "password"} autoComplete={autoComplete} required className={`${fieldAria(id, error).className} pr-12`} />
      <button
        type="button"
        onClick={() => setShow((s) => !s)}
        className="absolute right-1.5 top-1/2 grid size-9 -translate-y-1/2 place-items-center rounded-full text-muted hover:text-fg"
        aria-label={show ? "Hide password" : "Show password"}
        aria-pressed={show}
      >
        {show ? <EyeOff className="size-4" aria-hidden="true" /> : <Eye className="size-4" aria-hidden="true" />}
      </button>
    </div>
  );
}

export function LoginForm({ next }: { next?: string }) {
  const [state, action] = useActionState<AuthFormState, FormData>(loginAction, {});
  const fe = state.fieldErrors ?? {};
  return (
    <form action={action} className="space-y-4" noValidate>
      <FormError state={state} />
      <input type="hidden" name="next" value={next ?? "/account"} />
      <Field id="login-email" label="Email" required error={fe.email}>
        <input {...fieldAria("login-email", fe.email)} name="email" type="email" autoComplete="email" required />
      </Field>
      <Field id="login-password" label="Password" required error={fe.password}>
        <PasswordInput id="login-password" error={fe.password} autoComplete="current-password" />
      </Field>
      <p className="-mt-2 text-right text-sm">
        <Link href="/account/forgot-password" className="font-semibold text-violet-300 hover:text-violet-200">
          Forgot password?
        </Link>
      </p>
      <Submit>Sign in</Submit>
      <p className="text-center text-sm text-muted">
        New here?{" "}
        <Link href={`/account/register${next ? `?next=${encodeURIComponent(next)}` : ""}`} className="font-semibold text-violet-300 hover:text-violet-200">
          Create an account
        </Link>
      </p>
    </form>
  );
}

export function RegisterForm({ next }: { next?: string }) {
  const [state, action] = useActionState<AuthFormState, FormData>(registerAction, {});
  const [phone, setPhone] = useState("");
  const fe = state.fieldErrors ?? {};
  return (
    <form action={action} className="space-y-4" noValidate>
      <FormError state={state} />
      <input type="hidden" name="next" value={next ?? "/account"} />
      <div aria-hidden="true" className="absolute -left-[9999px] h-0 w-0 overflow-hidden">
        <input {...honeypotProps} />
      </div>
      <Field id="reg-name" label="Full name" required error={fe.name}>
        <input {...fieldAria("reg-name", fe.name)} name="name" autoComplete="name" required maxLength={80} />
      </Field>
      <Field id="reg-email" label="Email" required error={fe.email}>
        <input {...fieldAria("reg-email", fe.email)} name="email" type="email" autoComplete="email" required />
      </Field>
      <Field id="reg-phone" label="Mobile number" optional error={fe.phone} hint="For delivery updates">
        <input
          {...fieldAria("reg-phone", fe.phone, "hint")}
          name="phone"
          type="tel"
          inputMode="numeric"
          placeholder="03XX-XXXXXXX"
          autoComplete="tel-national"
          value={phone}
          onChange={(e) => setPhone(formatPhoneInput(e.target.value))}
          maxLength={12}
        />
      </Field>
      <Field id="reg-password" label="Password" required error={fe.password} hint="At least 8 characters">
        <PasswordInput id="reg-password" error={fe.password} autoComplete="new-password" />
      </Field>
      <Turnstile action="register" />
      <Submit>Create account</Submit>
      <p className="text-center text-sm text-muted">
        Already have an account?{" "}
        <Link href={`/account/login${next ? `?next=${encodeURIComponent(next)}` : ""}`} className="font-semibold text-violet-300 hover:text-violet-200">
          Sign in
        </Link>
      </p>
    </form>
  );
}

export function ForgotPasswordForm() {
  const [state, action] = useActionState<ForgotState, FormData>(forgotPasswordAction, {});
  if (state.sent) {
    return (
      <div role="status" className="space-y-4 text-center">
        <MailCheck className="mx-auto size-10 text-emerald-400" aria-hidden="true" />
        <p className="text-sm text-muted">
          If an account exists for that email, we&apos;ve sent a link to choose a new password. It works for 1 hour – check your spam folder too.
        </p>
        <Link href="/account/login" className="btn btn-secondary w-full">
          Back to sign in
        </Link>
      </div>
    );
  }
  return (
    <form action={action} className="space-y-4" noValidate>
      <FormError state={state} />
      <Field id="forgot-email" label="Email" required>
        <input {...fieldAria("forgot-email")} name="email" type="email" autoComplete="email" required />
      </Field>
      <Submit>Email me a reset link</Submit>
      <p className="text-center text-sm text-muted">
        Remembered it?{" "}
        <Link href="/account/login" className="font-semibold text-violet-300 hover:text-violet-200">
          Sign in
        </Link>
      </p>
    </form>
  );
}

export function ResetPasswordForm({ token }: { token: string }) {
  const [state, action] = useActionState<AuthFormState, FormData>(resetPasswordAction, {});
  const fe = state.fieldErrors ?? {};
  return (
    <form action={action} className="space-y-4" noValidate>
      <FormError state={state} />
      <input type="hidden" name="token" value={token} />
      <Field id="reset-password" label="New password" required error={fe.password} hint="At least 8 characters">
        <PasswordInput id="reset-password" error={fe.password} autoComplete="new-password" describedByHint />
      </Field>
      <Field id="reset-confirm" label="Type it again" required error={fe.confirm}>
        <PasswordInput id="reset-confirm" name="confirm" error={fe.confirm} autoComplete="new-password" />
      </Field>
      <Submit>Save new password</Submit>
      {state.error && (
        <p className="text-center text-sm text-muted">
          <Link href="/account/forgot-password" className="font-semibold text-violet-300 hover:text-violet-200">
            Get a new reset link
          </Link>
        </p>
      )}
    </form>
  );
}

/** Account page notice until the customer clicks the link in the confirmation email. */
export function ConfirmEmailNotice({ email, text }: { email: string; text?: string }) {
  const [result, setResult] = useState<{ ok: boolean; message: string } | null>(null);
  const [busy, setBusy] = useState(false);
  return (
    <section className="card flex flex-col gap-3 border-amber-500/40 p-5 sm:flex-row sm:items-center sm:justify-between sm:p-6" aria-labelledby="confirm-email">
      <div>
        <h2 id="confirm-email" className="font-display text-base font-bold">
          Please confirm your email
        </h2>
        <p className="mt-1 text-sm text-muted">
          We sent a link to <span className="font-semibold text-fg">{email}</span>. {text ?? "Confirming makes sure order updates and password resets reach you."}
        </p>
        <p aria-live="polite" className={`mt-2 text-sm ${result?.ok ? "text-emerald-300" : "text-rose-300"}`}>
          {result?.ok && <CheckCircle2 className="mr-1 inline size-4" aria-hidden="true" />}
          {result?.message}
        </p>
      </div>
      <button
        type="button"
        className="btn btn-secondary btn-sm shrink-0"
        disabled={busy || result?.ok}
        onClick={async () => {
          setBusy(true);
          setResult(await resendConfirmationAction().catch(() => ({ ok: false, message: "Something went wrong – please try again." })));
          setBusy(false);
        }}
      >
        {busy && <Loader2 className="size-4 animate-spin" aria-hidden="true" />}
        Send the link again
      </button>
    </section>
  );
}
