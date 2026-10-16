"use client";
import { useActionState, useEffect, useRef } from "react";
import { CircleAlert, CircleCheck, LoaderCircle, Send } from "lucide-react";
import { submitPlatformContact, type ContactField, type PlatformContactState } from "@/app/(marketing)/shopengine/contact/actions";
import { CONTACT_TOPICS } from "@/lib/marketing/content";
import { honeypotProps } from "@/lib/honeypot";
import { Turnstile } from "@/components/ui/turnstile";

const initial: PlatformContactState = { ok: false, message: "" };

const inputCls =
  "block w-full rounded-xl border border-white/10 bg-white/[0.04] px-4 py-3 text-[0.9375rem] text-ink shadow-[inset_0_1px_0_rgba(255,255,255,0.04)] placeholder:text-faint transition-colors hover:border-white/20 focus:border-brand focus:bg-white/[0.06] focus:outline-none focus:ring-4 focus:ring-brand-100 aria-[invalid=true]:border-danger [&>option]:bg-[#0a0f2b]";

function Field({ id, label, error, optional, children }: { id: ContactField; label: string; error?: string; optional?: boolean; children: React.ReactNode }) {
  return (
    <div>
      <label htmlFor={`c-${id}`} className="mb-2 block text-sm font-medium text-ink-2">
        {label} {optional && <span className="font-normal text-faint">(optional)</span>}
      </label>
      {children}
      {error && (
        <p id={`c-${id}-error`} className="mt-1.5 text-sm text-danger">
          {error}
        </p>
      )}
    </div>
  );
}

export function ContactForm({ defaultTopic }: { defaultTopic?: string }) {
  const [state, action, pending] = useActionState(submitPlatformContact, initial);
  const status = useRef<HTMLDivElement>(null);
  const e = state.errors ?? {};

  useEffect(() => {
    if (!state.ts) return;
    // move focus to the first invalid field, or to the result message
    const first = (Object.keys(state.errors ?? {}) as ContactField[])[0];
    if (first) document.getElementById(`c-${first}`)?.focus();
    else status.current?.focus();
  }, [state]);

  const describe = (id: ContactField) => (e[id] ? { "aria-invalid": true as const, "aria-describedby": `c-${id}-error` } : {});
  // a new form after every answer: empty after a success, the typed values after an error
  const v = state.values ?? {};
  const topic = CONTACT_TOPICS.find((t) => t === (v.topic ?? defaultTopic)) ?? "";

  return (
    <form key={state.ts ?? 0} action={action} noValidate className="space-y-5">
      <div ref={status} tabIndex={-1} role="status" aria-live="polite" className="outline-none">
        {state.message && (
          <p className={`flex items-start gap-2.5 rounded-xl border p-4 text-sm ${state.ok ? "border-ok/30 bg-ok-50 text-ok" : "border-danger/30 bg-danger-50 text-danger"}`}>
            {state.ok ? <CircleCheck className="mt-0.5 size-4 shrink-0" aria-hidden="true" /> : <CircleAlert className="mt-0.5 size-4 shrink-0" aria-hidden="true" />}
            {state.message}
          </p>
        )}
      </div>

      <div className="grid gap-5 sm:grid-cols-2">
        <Field id="name" label="Your name" error={e.name}>
          <input id="c-name" name="name" defaultValue={v.name} required minLength={2} maxLength={80} autoComplete="name" className={inputCls} {...describe("name")} />
        </Field>
        <Field id="email" label="Work email" error={e.email}>
          <input id="c-email" name="email" defaultValue={v.email} type="email" required maxLength={120} autoComplete="email" inputMode="email" className={inputCls} {...describe("email")} />
        </Field>
      </div>
      <div className="grid gap-5 sm:grid-cols-2">
        <Field id="company" label="Company or store" optional error={e.company}>
          <input id="c-company" name="company" defaultValue={v.company} maxLength={120} autoComplete="organization" className={inputCls} {...describe("company")} />
        </Field>
        <Field id="topic" label="Topic" error={e.topic}>
          <select id="c-topic" name="topic" required defaultValue={topic} className={inputCls} {...describe("topic")}>
            <option value="" disabled>
              Choose a topic
            </option>
            {CONTACT_TOPICS.map((t) => (
              <option key={t} value={t}>
                {t}
              </option>
            ))}
          </select>
        </Field>
      </div>
      <Field id="message" label="Message" error={e.message}>
        <textarea id="c-message" name="message" defaultValue={v.message} required minLength={10} maxLength={4000} rows={6} className={`${inputCls} resize-y`} placeholder="Tell us about your business and how we can help." {...describe("message")} />
      </Field>

      {/* spam trap – hidden from people */}
      <div aria-hidden="true" className="absolute -left-[9999px] h-px w-px overflow-hidden">
        <label>
          Leave this empty
          <input {...honeypotProps} />
        </label>
      </div>
      <Turnstile action="platform_contact" />

      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <p className="text-xs text-faint">We use your details only to reply to this message.</p>
        <button type="submit" disabled={pending} className="mk-btn mk-btn-primary mk-btn-lg disabled:opacity-70">
          {pending ? <LoaderCircle className="size-4 animate-spin" aria-hidden="true" /> : <Send className="size-4" aria-hidden="true" />}
          {pending ? "Sending…" : "Send message"}
        </button>
      </div>
    </form>
  );
}
