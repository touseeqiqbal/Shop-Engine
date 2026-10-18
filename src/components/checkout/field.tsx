"use client";
import { cn } from "@/lib/utils";

/** Label + control + error message wired together with aria attributes. */
export function Field({
  id,
  label,
  error,
  hint,
  required,
  optional,
  className,
  children,
}: {
  id: string;
  label: string;
  error?: string;
  hint?: string;
  required?: boolean;
  optional?: boolean;
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <div className={className}>
      <label htmlFor={id} className="label">
        {label} {required && <span className="text-rose-400" aria-hidden="true">*</span>}
        {optional && <span className="font-normal text-subtle">(optional)</span>}
      </label>
      {children}
      {error ? (
        <p id={`${id}-error`} className="mt-1.5 text-xs font-medium text-rose-400 light:text-rose-700">
          {error}
        </p>
      ) : hint ? (
        <p id={`${id}-hint`} className="mt-1.5 text-xs text-subtle">
          {hint}
        </p>
      ) : null}
    </div>
  );
}

/** aria props for a control rendered inside <Field>. */
export function fieldAria(id: string, error?: string, hint?: string) {
  return {
    id,
    "aria-invalid": error ? (true as const) : undefined,
    "aria-describedby": error ? `${id}-error` : hint ? `${id}-hint` : undefined,
    className: cn("input", error && "border-rose-500/70 focus:border-rose-500"),
  };
}
