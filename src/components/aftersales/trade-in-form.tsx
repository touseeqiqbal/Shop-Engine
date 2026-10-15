"use client";
import { useActionState, useRef, useState } from "react";
import { CheckCircle2, ImagePlus, X } from "lucide-react";
import { submitTradeIn, type TradeInState } from "@/app/(frontend)/(store)/sell-your-laptop/actions";
import { useMoney, useStoreLocale } from "@/components/providers/locale";
import { Turnstile } from "@/components/ui/turnstile";
import { compressImage } from "@/lib/compress-image";
import { honeypotProps } from "@/lib/honeypot";
import { phonePlaceholder } from "@/lib/phone";

/** "Sell / trade in your laptop": brand, model, specs, condition, photos, expected price, contact. */
export function TradeInForm() {
  const [state, action, pending] = useActionState<TradeInState, FormData>(submitTradeIn, {});
  const [files, setFiles] = useState<File[]>([]);
  const input = useRef<HTMLInputElement>(null);
  const money = useMoney();
  const { country } = useStoreLocale();
  const pk = country === "PK";
  if (state.ok)
    return (
      <div className="card p-8 text-center" role="status">
        <CheckCircle2 className="mx-auto size-12 text-emerald-300" aria-hidden="true" />
        <p className="mt-3 text-muted">{state.message}</p>
      </div>
    );
  return (
    <form
      action={(fd) => {
        fd.delete("photos");
        files.forEach((f) => fd.append("photos", f));
        action(fd);
      }}
      className="card space-y-5 p-5 sm:p-6"
    >
      <input className="hidden" {...honeypotProps} />
      <fieldset className="grid gap-3 sm:grid-cols-2">
        <legend className="mb-2 font-display text-lg font-bold">Your laptop</legend>
        <label className="block text-sm font-medium">
          Brand
          <input name="brand" className="input mt-1" required placeholder="Dell, HP, Lenovo, Apple…" />
        </label>
        <label className="block text-sm font-medium">
          Model
          <input name="model" className="input mt-1" required placeholder="e.g. Latitude 5420" />
        </label>
        <label className="block text-sm font-medium">
          Processor
          <input name="processor" className="input mt-1" placeholder="e.g. Core i5 11th gen" />
        </label>
        <label className="block text-sm font-medium">
          RAM
          <input name="ram" className="input mt-1" placeholder="e.g. 16GB" />
        </label>
        <label className="block text-sm font-medium">
          Storage
          <input name="storage" className="input mt-1" placeholder="e.g. 512GB SSD" />
        </label>
        <label className="block text-sm font-medium">
          Battery health <span className="text-subtle">(if you know it)</span>
          <input name="batteryHealth" className="input mt-1" placeholder="e.g. 85%" />
        </label>
        <label className="block text-sm font-medium sm:col-span-2">
          Condition
          <select name="condition" className="input mt-1" required defaultValue="">
            <option value="" disabled>
              Choose…
            </option>
            <option value="like-new">Like new</option>
            <option value="good">Good – small marks</option>
            <option value="fair">Fair – visible wear</option>
            <option value="faulty">Has a fault</option>
          </select>
        </label>
        <label className="block text-sm font-medium sm:col-span-2">
          Comes with <span className="text-subtle">(optional)</span>
          <input name="accessories" className="input mt-1" placeholder="Charger, box, bag…" />
        </label>
        <label className="block text-sm font-medium sm:col-span-2">
          Any faults or notes <span className="text-subtle">(optional)</span>
          <textarea name="faults" rows={3} className="input mt-1" placeholder="e.g. One USB port loose, keyboard backlight off" />
        </label>
      </fieldset>

      <div>
        <p className="text-sm font-medium">
          Photos <span className="text-subtle">– front, back, screen on, any damage (up to 6)</span>
        </p>
        <div className="mt-2 flex flex-wrap gap-2">
          {files.map((f, i) => (
            <span key={i} className="relative size-20 overflow-hidden rounded-xl border border-border bg-surface">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={URL.createObjectURL(f)} alt="" className="size-full object-cover" />
              <button type="button" aria-label="Remove photo" onClick={() => setFiles(files.filter((_, j) => j !== i))} className="absolute right-1 top-1 rounded-full bg-black/70 p-1">
                <X className="size-3" />
              </button>
            </span>
          ))}
          {files.length < 6 && (
            <button type="button" onClick={() => input.current?.click()} className="flex size-20 flex-col items-center justify-center gap-1 rounded-xl border border-dashed border-border-strong text-xs text-muted hover:text-fg">
              <ImagePlus className="size-5" aria-hidden="true" /> Add
            </button>
          )}
        </div>
        <input
          ref={input}
          type="file"
          accept="image/jpeg,image/png,image/webp"
          multiple
          hidden
          onChange={async (e) => {
            const picked = [...(e.target.files ?? [])].slice(0, 6 - files.length);
            e.target.value = "";
            setFiles([...files, ...(await Promise.all(picked.map((f) => compressImage(f))))].slice(0, 6));
          }}
        />
      </div>

      <fieldset className="grid gap-3 sm:grid-cols-2">
        <legend className="mb-2 font-display text-lg font-bold">Price & contact</legend>
        <label className="block text-sm font-medium">
          Price you expect ({money.symbol}) <span className="text-subtle">(optional)</span>
          <input name="expectedPrice" inputMode="numeric" className="input mt-1" placeholder={pk ? "e.g. 85000" : undefined} />
        </label>
        <label className="flex items-center gap-2 self-end text-sm font-medium">
          <input type="checkbox" name="wantsTradeIn" className="size-5" /> I want to trade it in for another laptop
        </label>
        <label className="block text-sm font-medium">
          Your name
          <input name="name" className="input mt-1" required minLength={3} />
        </label>
        <label className="block text-sm font-medium">
          Mobile (WhatsApp)
          <input name="phone" inputMode="tel" className="input mt-1" required placeholder={pk ? "0300-1234567" : phonePlaceholder(country)} />
        </label>
        <label className="block text-sm font-medium sm:col-span-2">
          City <span className="text-subtle">(optional)</span>
          <input name="city" className="input mt-1" />
        </label>
      </fieldset>
      <Turnstile action="tradein" />
      {state.message && (
        <p className="text-sm text-rose-300" role="alert">
          {state.message}
        </p>
      )}
      <button className="btn btn-primary btn-lg w-full" disabled={pending}>
        {pending ? "Sending…" : "Get my offer"}
      </button>
    </form>
  );
}
