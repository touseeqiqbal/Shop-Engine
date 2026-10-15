"use client";
import { startTransition, useActionState, useEffect, useId, useRef, useState } from "react";
import { AnimatePresence, m as motion } from "framer-motion";
import { CheckCircle2, Loader2, PenLine, Star } from "lucide-react";
import { useStoreLocale } from "@/components/providers/locale";
import { submitReview, type ReviewFormState } from "@/app/(frontend)/(store)/[category]/[product]/actions";
import { cn } from "@/lib/utils";
import { Turnstile } from "@/components/ui/turnstile";
import { compressImage } from "@/lib/compress-image";
import { honeypotProps } from "@/lib/honeypot";

const LABELS = ["Poor", "Fair", "Good", "Very good", "Excellent"];
const initial: ReviewFormState = { ok: false, message: "" };

export function ReviewForm({ productId, productName }: { productId: string; productName: string }) {
  const pk = useStoreLocale().country === "PK";
  const uid = useId();
  const [open, setOpen] = useState(false);
  const [photos, setPhotos] = useState<File[]>([]);
  const [state, action, pending] = useActionState(submitReview, initial);
  const [rating, setRating] = useState(0);
  const [hover, setHover] = useState(0);
  const formRef = useRef<HTMLFormElement>(null);
  const statusRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (state.ok) {
      formRef.current?.reset();
      setRating(0);
    }
    if (state.message) statusRef.current?.focus();
  }, [state]);

  const err = state.errors ?? {};
  const shown = hover || rating;

  if (state.ok) {
    return (
      <div ref={statusRef} tabIndex={-1} role="status" className="card flex items-start gap-3 p-5 outline-none">
        <CheckCircle2 className="size-6 shrink-0 text-emerald-400" aria-hidden="true" />
        <div>
          <p className="font-semibold text-fg">{state.message}</p>
          <p className="mt-1 text-sm text-muted">We read every review – thank you for helping other shoppers{pk ? " in Pakistan" : ""}.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="card p-5 sm:p-6">
      {!open ? (
        <div className="flex flex-col items-start gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="font-semibold text-fg">Own this product?</p>
            <p className="text-sm text-muted">Share your experience with other buyers.</p>
          </div>
          <button type="button" className="btn btn-secondary" onClick={() => setOpen(true)} aria-expanded={open} aria-controls={`${uid}-form`}>
            <PenLine className="size-4" aria-hidden="true" /> Write a review
          </button>
        </div>
      ) : null}

      <AnimatePresence initial={false}>
        {open && (
          <motion.form
            id={`${uid}-form`}
            ref={formRef}
            onSubmit={(e) => {
              // Submit via transition (instead of the `action` prop) so React doesn't reset the fields on validation errors.
              e.preventDefault();
              const fd = new FormData(e.currentTarget);
              fd.delete("photos");
              photos.forEach((f) => fd.append("photos", f));
              startTransition(() => action(fd));
            }}
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            exit={{ opacity: 0, height: 0 }}
            className="space-y-4 overflow-hidden"
            noValidate
          >
            <h3 className="font-display text-lg font-bold text-fg">Review {productName}</h3>
            <input type="hidden" name="productId" value={productId} />
            {/* honeypot */}
            <div className="hidden" aria-hidden="true">
              <label>
                Leave this empty <input {...honeypotProps} />
              </label>
            </div>
            <Turnstile action="review" />

            <fieldset>
              <legend className="label">
                Your rating <span className="text-rose-400">*</span>
              </legend>
              <div
                role="radiogroup"
                aria-label="Rating out of 5 stars"
                aria-describedby={err.rating ? `${uid}-rating-err` : undefined}
                className="flex items-center gap-1"
                onMouseLeave={() => setHover(0)}
              >
                {[1, 2, 3, 4, 5].map((n) => (
                  <label
                    key={n}
                    onMouseEnter={() => setHover(n)}
                    className="grid size-11 cursor-pointer place-items-center rounded-xl transition has-[:focus-visible]:ring-2 has-[:focus-visible]:ring-violet-500"
                  >
                    <input
                      type="radio"
                      name="rating"
                      value={n}
                      checked={rating === n}
                      onChange={() => setRating(n)}
                      className="sr-only"
                      aria-label={`${n} star${n > 1 ? "s" : ""} – ${LABELS[n - 1]}`}
                    />
                    <Star
                      className={cn("size-7 transition-transform", n <= shown ? "scale-110 fill-amber-400 text-amber-400" : "text-subtle")}
                      aria-hidden="true"
                    />
                  </label>
                ))}
                <span className="ml-2 text-sm font-medium text-muted" aria-hidden="true">
                  {shown ? LABELS[shown - 1] : "Tap to rate"}
                </span>
              </div>
              {err.rating && (
                <p id={`${uid}-rating-err`} className="mt-1 text-xs text-rose-400">
                  {err.rating}
                </p>
              )}
            </fieldset>

            <div className="grid gap-4 sm:grid-cols-2">
              <Field id={`${uid}-name`} label="Your name" required error={err.name}>
                <input id={`${uid}-name`} name="name" className="input" autoComplete="name" maxLength={60} required aria-invalid={!!err.name} aria-describedby={err.name ? `${uid}-name-err` : undefined} />
              </Field>
              <Field id={`${uid}-city`} label="City (optional)" error={err.city}>
                <input id={`${uid}-city`} name="city" className="input" autoComplete="address-level2" maxLength={60} placeholder="e.g. Lahore" />
              </Field>
            </div>
            <Field id={`${uid}-title`} label="Review title (optional)" error={err.title}>
              <input id={`${uid}-title`} name="title" className="input" maxLength={100} placeholder="Sum it up in a few words" />
            </Field>
            <Field id={`${uid}-body`} label="Your review" required error={err.body}>
              <textarea
                id={`${uid}-body`}
                name="body"
                rows={5}
                className="input min-h-32 resize-y py-3"
                maxLength={2000}
                required
                placeholder="What did you like? How was delivery and packaging?"
                aria-invalid={!!err.body}
                aria-describedby={err.body ? `${uid}-body-err` : undefined}
              />
            </Field>

            <div>
              <p className="label">
                Photos <span className="text-subtle">(optional, up to 3)</span>
              </p>
              <div className="mt-1 flex flex-wrap gap-2">
                {photos.map((f, i) => (
                  <span key={i} className="relative size-16 overflow-hidden rounded-xl border border-border bg-surface">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={URL.createObjectURL(f)} alt="" className="size-full object-cover" />
                    <button type="button" aria-label="Remove photo" onClick={() => setPhotos(photos.filter((_, j) => j !== i))} className="absolute right-0.5 top-0.5 rounded-full bg-black/70 px-1.5 text-xs">
                      ×
                    </button>
                  </span>
                ))}
                {photos.length < 3 && (
                  <label className="flex size-16 cursor-pointer items-center justify-center rounded-xl border border-dashed border-border-strong text-xs text-muted hover:text-fg">
                    + Add
                    <input
                      type="file"
                      accept="image/jpeg,image/png,image/webp"
                      multiple
                      className="sr-only"
                      onChange={async (e) => {
                        const picked = [...(e.target.files ?? [])].slice(0, 3 - photos.length);
                        e.target.value = "";
                        setPhotos([...photos, ...(await Promise.all(picked.map((f) => compressImage(f))))].slice(0, 3));
                      }}
                    />
                  </label>
                )}
              </div>
            </div>

            <div ref={statusRef} tabIndex={-1} role="alert" className="outline-none">
              {state.message && !state.ok && <p className="rounded-2xl border border-rose-500/30 bg-rose-500/10 px-4 py-3 text-sm text-rose-300 light:text-rose-700">{state.message}</p>}
            </div>

            <div className="flex flex-wrap items-center gap-3">
              <button type="submit" className="btn btn-primary" disabled={pending}>
                {pending ? <Loader2 className="size-4 animate-spin" aria-hidden="true" /> : <PenLine className="size-4" aria-hidden="true" />}
                {pending ? "Submitting…" : "Submit review"}
              </button>
              <button type="button" className="btn btn-ghost" onClick={() => setOpen(false)}>
                Cancel
              </button>
              <p className="w-full text-xs text-subtle">Reviews are checked by our team before they appear.</p>
            </div>
          </motion.form>
        )}
      </AnimatePresence>
    </div>
  );
}

function Field({ id, label, required, error, children }: { id: string; label: string; required?: boolean; error?: string; children: React.ReactNode }) {
  return (
    <div>
      <label htmlFor={id} className="label">
        {label} {required && <span className="text-rose-400">*</span>}
      </label>
      {children}
      {error && (
        <p id={`${id}-err`} className="mt-1 text-xs text-rose-400">
          {error}
        </p>
      )}
    </div>
  );
}
