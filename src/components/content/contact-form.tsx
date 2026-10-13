"use client";
import { useActionState, useEffect, useRef } from "react";
import { CheckCircle2, Loader2, Send } from "lucide-react";
import { submitContact, type ContactState } from "@/app/(frontend)/(store)/contact/actions";
import { trackEvent } from "@/components/analytics";
import { cn } from "@/lib/utils";
import { Turnstile } from "@/components/ui/turnstile";
import { honeypotProps } from "@/lib/honeypot";

const SUBJECTS = ["Laptop enquiry", "Charger / battery / parts", "Order & delivery", "Warranty / return", "Bulk / corporate order", "Other"];

export function ContactForm() {
  const [state, action, pending] = useActionState<ContactState, FormData>(submitContact, { ok: false, message: "" });
  const formRef = useRef<HTMLFormElement>(null);

  useEffect(() => {
    if (state.ok) {
      formRef.current?.reset();
      trackEvent("generate_lead", { method: "contact_form" });
    }
  }, [state]);

  const err = state.errors ?? {};
  const field = (name: keyof typeof err) => ({
    "aria-invalid": err[name] ? true : undefined,
    "aria-describedby": err[name] ? `${name}-error` : undefined,
  });
  const fieldError = (name: keyof typeof err) =>
    err[name] ? (
      <p id={`${name}-error`} className="mt-1.5 text-xs font-medium text-rose-400">
        {err[name]}
      </p>
    ) : null;

  return (
    <form ref={formRef} action={action} className="space-y-4" noValidate>
      {/* Honeypot */}
      <div aria-hidden="true" className="absolute -left-[9999px] h-0 w-0 overflow-hidden">
        <label htmlFor="hp-contact">Leave this empty</label>
        <input id="hp-contact" {...honeypotProps} />
      </div>
      <Turnstile action="contact" />

      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <label htmlFor="name" className="label">
            Full name <span className="text-rose-400">*</span>
          </label>
          <input id="name" name="name" required autoComplete="name" className="input" placeholder="e.g. Ahmed Raza" {...field("name")} />
          {fieldError("name")}
        </div>
        <div>
          <label htmlFor="phone" className="label">
            Mobile / WhatsApp <span className="text-rose-400">*</span>
          </label>
          <input id="phone" name="phone" type="tel" inputMode="tel" required autoComplete="tel" className="input" placeholder="03XX-XXXXXXX" {...field("phone")} />
          {fieldError("phone")}
        </div>
        <div>
          <label htmlFor="email" className="label">
            Email <span className="font-normal text-subtle">(optional)</span>
          </label>
          <input id="email" name="email" type="email" autoComplete="email" className="input" placeholder="you@example.com" {...field("email")} />
          {fieldError("email")}
        </div>
        <div>
          <label htmlFor="subject" className="label">
            Subject
          </label>
          <select id="subject" name="subject" className="input" defaultValue={SUBJECTS[0]} {...field("subject")}>
            {SUBJECTS.map((s) => (
              <option key={s}>{s}</option>
            ))}
          </select>
          {fieldError("subject")}
        </div>
      </div>
      <div>
        <label htmlFor="message" className="label">
          Message <span className="text-rose-400">*</span>
        </label>
        <textarea
          id="message"
          name="message"
          required
          rows={5}
          className="input resize-y"
          placeholder="Tell us which laptop or part you need, your budget and your city…"
          {...field("message")}
        />
        {fieldError("message")}
      </div>

      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <p className="text-xs text-subtle">We reply within store hours. Your details are only used to answer your enquiry.</p>
        <button type="submit" className="btn btn-primary btn-lg" disabled={pending}>
          {pending ? <Loader2 className="size-4 animate-spin" aria-hidden="true" /> : <Send className="size-4" aria-hidden="true" />}
          {pending ? "Sending…" : "Send message"}
        </button>
      </div>

      <div aria-live="polite" role="status">
        {state.message && (
          <p
            className={cn(
              "flex items-start gap-2 rounded-2xl border p-4 text-sm",
              state.ok ? "border-emerald-500/30 bg-emerald-500/10 text-emerald-300 light:text-emerald-700" : "border-rose-500/30 bg-rose-500/10 text-rose-300 light:text-rose-700"
            )}
          >
            {state.ok && <CheckCircle2 className="mt-0.5 size-4 shrink-0" aria-hidden="true" />}
            {state.message}
          </p>
        )}
      </div>
    </form>
  );
}
