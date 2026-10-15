"use client";
import { useActionState, useRef, useState, useTransition } from "react";
import { CheckCircle2, ImagePlus, X } from "lucide-react";
import { lookupForReturn, submitReturn, submitWarranty, type LookupState, type SubmitState } from "@/app/(frontend)/(store)/returns/actions";
import { compressImage } from "@/lib/compress-image";
import { phonePlaceholder } from "@/lib/phone";
import { useMoney, useStoreLocale } from "@/components/providers/locale";
import { Turnstile } from "@/components/ui/turnstile";
import { honeypotProps } from "@/lib/honeypot";

/** Example in the phone fields: the original shop's familiar "0300-1234567", else the store country's format. */
const phoneExample = (country: string) => (country === "PK" ? "0300-1234567" : phonePlaceholder(country));

/** Return request (find order → pick items → reason + photos) and warranty claim (serial / order + problem + photos). */
export function AfterSalesForms({ initial, reasons, requirePhotos, returnDays }: { initial: "return" | "warranty"; reasons: string[]; requirePhotos: boolean; returnDays: number }) {
  const [mode, setMode] = useState(initial);
  return (
    <div className="card p-5 sm:p-6">
      <div className="mb-5 inline-flex rounded-xl border border-border bg-surface p-1" role="tablist" aria-label="What do you need?">
        {(
          [
            ["return", "Return / exchange"],
            ["warranty", "Warranty claim"],
          ] as const
        ).map(([k, l]) => (
          <button key={k} type="button" role="tab" aria-selected={mode === k} onClick={() => setMode(k)} className={`rounded-lg px-4 py-2 text-sm font-semibold ${mode === k ? "bg-surface-strong text-fg" : "text-muted"}`}>
            {l}
          </button>
        ))}
      </div>
      {mode === "return" ? <ReturnForm reasons={reasons} requirePhotos={requirePhotos} returnDays={returnDays} /> : <WarrantyForm />}
    </div>
  );
}

function Done({ state }: { state: SubmitState }) {
  if (!state?.ok) return null;
  return (
    <div className="rounded-2xl border border-emerald-500/40 bg-emerald-500/10 p-5 text-center" role="status">
      <CheckCircle2 className="mx-auto size-10 text-emerald-300" aria-hidden="true" />
      <p className="mt-2 font-display text-xl font-bold">{state.reference}</p>
      <p className="mt-1 text-sm text-muted">{state.message}</p>
    </div>
  );
}

function PhotoPicker({ files, setFiles, required }: { files: File[]; setFiles: (f: File[]) => void; required: boolean }) {
  const input = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  return (
    <div>
      <p className="text-sm font-medium">
        Photos {required ? "" : <span className="text-subtle">(optional)</span>} <span className="text-xs text-subtle">– up to 5, show the problem clearly</span>
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
        {files.length < 5 && (
          <button type="button" onClick={() => input.current?.click()} className="flex size-20 flex-col items-center justify-center gap-1 rounded-xl border border-dashed border-border-strong text-xs text-muted hover:text-fg" disabled={busy}>
            <ImagePlus className="size-5" aria-hidden="true" />
            {busy ? "…" : "Add"}
          </button>
        )}
      </div>
      <input
        ref={input}
        type="file"
        accept="image/jpeg,image/png,image/webp"
        capture="environment"
        multiple
        hidden
        onChange={async (e) => {
          const picked = [...(e.target.files ?? [])].slice(0, 5 - files.length);
          e.target.value = "";
          setBusy(true);
          const small = await Promise.all(picked.map((f) => compressImage(f)));
          setBusy(false);
          setFiles([...files, ...small].slice(0, 5));
        }}
      />
    </div>
  );
}

function ReturnForm({ reasons, requirePhotos, returnDays }: { reasons: string[]; requirePhotos: boolean; returnDays: number }) {
  const [number, setNumber] = useState("");
  const [phone, setPhone] = useState("");
  const [found, setFound] = useState<LookupState>(null);
  const [looking, startLookup] = useTransition();
  const [qty, setQty] = useState<Record<number, number>>({});
  const [files, setFiles] = useState<File[]>([]);
  const [state, action, pending] = useActionState<SubmitState, FormData>(submitReturn, null);
  const money = useMoney();
  const { country } = useStoreLocale();
  if (state?.ok) return <Done state={state} />;

  const order = found?.ok ? found.order : null;
  const canReturn = order && order.status === "delivered" && order.daysLeft != null && order.daysLeft >= 0;
  return (
    <div className="space-y-5">
      <form
        className="grid gap-3 sm:grid-cols-[1fr_1fr_auto] sm:items-end"
        onSubmit={(e) => {
          e.preventDefault();
          startLookup(async () => setFound(await lookupForReturn(number, phone)));
        }}
      >
        <label className="block text-sm font-medium">
          Order / receipt number
          <input className="input mt-1 font-mono uppercase" value={number} onChange={(e) => setNumber(e.target.value)} placeholder="UTS-260512-482193" required />
        </label>
        <label className="block text-sm font-medium">
          Phone used for the order
          <input className="input mt-1" inputMode="tel" value={phone} onChange={(e) => setPhone(e.target.value)} placeholder={phoneExample(country)} required />
        </label>
        <button className="btn btn-secondary" disabled={looking}>
          {looking ? "Finding…" : "Find my order"}
        </button>
      </form>
      {found && !found.ok && <p className="text-sm text-rose-300">{found.message}</p>}

      {order && !canReturn && (
        <p className="rounded-xl border border-amber-500/40 bg-amber-500/10 p-4 text-sm">
          {order.status !== "delivered"
            ? "This order hasn't been delivered yet. If there's a problem with it, please WhatsApp us."
            : `Returns are accepted within ${returnDays} days of delivery. For a fault after that, make a warranty claim instead.`}
        </p>
      )}

      {order && canReturn && (
        <form
          action={(fd) => {
            fd.set("orderNumber", number);
            fd.set("phone", phone);
            fd.set("items", JSON.stringify(Object.entries(qty).filter(([, q]) => q > 0).map(([index, q]) => ({ index: Number(index), qty: q }))));
            fd.delete("photos");
            files.forEach((f) => fd.append("photos", f));
            action(fd);
          }}
          className="space-y-4"
        >
          <input className="hidden" {...honeypotProps} />
          <Turnstile action="aftersales" />
          <p className="text-sm text-muted">
            Hi {order.customerName.split(" ")[0]} – {order.daysLeft} day{order.daysLeft === 1 ? "" : "s"} left to return. Which item(s)?
          </p>
          <ul className="divide-y divide-border rounded-xl border border-border">
            {order.items.map((i) => (
              <li key={i.index} className="flex items-center gap-3 p-3">
                <input
                  type="checkbox"
                  aria-label={`Return ${i.title}`}
                  className="size-5"
                  checked={(qty[i.index] ?? 0) > 0}
                  onChange={(e) => setQty({ ...qty, [i.index]: e.target.checked ? 1 : 0 })}
                />
                <span className="flex-1 text-sm">
                  {i.title}
                  <span className="block text-xs text-muted">
                    {money(i.unitPrice)} {i.serials.length ? `· S/N ${i.serials.join(", ")}` : ""}
                  </span>
                </span>
                {i.qty > 1 && (qty[i.index] ?? 0) > 0 && (
                  <select className="input w-20" value={qty[i.index]} onChange={(e) => setQty({ ...qty, [i.index]: Number(e.target.value) })} aria-label="How many">
                    {Array.from({ length: i.qty }, (_, n) => (
                      <option key={n + 1}>{n + 1}</option>
                    ))}
                  </select>
                )}
              </li>
            ))}
          </ul>
          <label className="block text-sm font-medium">
            Reason
            <select name="reason" className="input mt-1" required defaultValue="">
              <option value="" disabled>
                Choose…
              </option>
              {reasons.map((r) => (
                <option key={r}>{r}</option>
              ))}
            </select>
          </label>
          <label className="block text-sm font-medium">
            Tell us more <span className="text-subtle">(optional)</span>
            <textarea name="details" rows={3} className="input mt-1" placeholder="e.g. The screen flickers when I open the lid." />
          </label>
          <PhotoPicker files={files} setFiles={setFiles} required={requirePhotos} />
          {state && !state.ok && (
            <p className="text-sm text-rose-300" role="alert">
              {state.message}
            </p>
          )}
          <button className="btn btn-primary btn-lg w-full" disabled={pending || (requirePhotos && !files.length)}>
            {pending ? "Sending…" : "Send return request"}
          </button>
        </form>
      )}
    </div>
  );
}

function WarrantyForm() {
  const [files, setFiles] = useState<File[]>([]);
  const [state, action, pending] = useActionState<SubmitState, FormData>(submitWarranty, null);
  const { country } = useStoreLocale();
  if (state?.ok) return <Done state={state} />;
  return (
    <form
      action={(fd) => {
        fd.delete("photos");
        files.forEach((f) => fd.append("photos", f));
        action(fd);
      }}
      className="space-y-4"
    >
      <input className="hidden" {...honeypotProps} />
          <Turnstile action="aftersales" />
      <div className="grid gap-3 sm:grid-cols-2">
        <label className="block text-sm font-medium">
          Your name
          <input name="name" className="input mt-1" required minLength={3} />
        </label>
        <label className="block text-sm font-medium">
          Phone
          <input name="phone" className="input mt-1" inputMode="tel" placeholder={phoneExample(country)} required />
        </label>
        <label className="block text-sm font-medium">
          Serial number <span className="text-subtle">(sticker under the laptop)</span>
          <input name="serial" className="input mt-1 font-mono uppercase" />
        </label>
        <label className="block text-sm font-medium">
          Order / receipt number
          <input name="orderNumber" className="input mt-1 font-mono uppercase" placeholder="UTS-… or POS-…" />
        </label>
      </div>
      <p className="text-xs text-subtle">Give the serial number, the order / receipt number, or both – we check your warranty automatically.</p>
      <label className="block text-sm font-medium">
        What&apos;s wrong?
        <textarea name="issue" rows={4} className="input mt-1" required minLength={10} placeholder="e.g. Battery drains in 30 minutes since last week." />
      </label>
      <PhotoPicker files={files} setFiles={setFiles} required={false} />
      {state && !state.ok && (
        <p className="text-sm text-rose-300" role="alert">
          {state.message}
        </p>
      )}
      <button className="btn btn-primary btn-lg w-full" disabled={pending}>
        {pending ? "Sending…" : "Send warranty claim"}
      </button>
    </form>
  );
}
