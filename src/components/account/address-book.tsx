"use client";
import { useEffect, useState, useTransition } from "react";
import { AnimatePresence, m as motion } from "framer-motion";
import { Loader2, MapPin, Pencil, Plus, Trash2 } from "lucide-react";
import { saveAddressesAction } from "@/app/(frontend)/(store)/account/actions";
import { readLocalAddresses, writeLocalAddresses } from "@/lib/addresses";
import type { SavedAddress } from "@/lib/types";
import { normalizePhone, phonePlaceholder } from "@/lib/phone";
import { useUi } from "@/store/ui";
import { useHydrated } from "@/hooks/use-hydrated";
import { CityCombobox } from "@/components/checkout/city-combobox";
import { Field, fieldAria } from "@/components/checkout/field";
import { formatPhoneInput } from "@/components/checkout/phone";
import { useStoreLocale } from "@/components/providers/locale";
import { Skeleton } from "@/components/ui/skeleton";

type Draft = Omit<SavedAddress, "id"> & { id?: string };
const EMPTY: Draft = { label: "Home", name: "", phone: "", city: "", address: "", landmark: "" };

export function AddressBook({ mode, initial = [] }: { mode: "remote" | "local"; initial?: SavedAddress[] }) {
  const hydrated = useHydrated();
  const toast = useUi((s) => s.toast);
  const [list, setList] = useState<SavedAddress[]>(initial);
  const [draft, setDraft] = useState<Draft | null>(null);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [saving, startSaving] = useTransition();
  const { country } = useStoreLocale();
  const pk = country === "PK"; // other countries type the number with its +code

  useEffect(() => {
    if (mode === "local") setList(readLocalAddresses());
  }, [mode]);

  const persist = (next: SavedAddress[], done?: () => void) => {
    if (mode === "local") {
      writeLocalAddresses(next);
      setList(next);
      done?.();
      return;
    }
    startSaving(async () => {
      const res = await saveAddressesAction(next);
      if (res.ok) {
        setList(res.addresses ?? next);
        done?.();
      } else toast(res.error ?? "Couldn't save address", "error");
    });
  };

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!draft) return;
    const errs: Record<string, string> = {};
    if (!draft.label.trim()) errs.label = "Give this address a label";
    if (draft.name.trim().length < 3) errs.name = "Enter the receiver's name";
    if (!normalizePhone(draft.phone, country)) errs.phone = "Enter a valid mobile number";
    if (pk ? !draft.city : draft.city.trim().length < 2) errs.city = pk ? "Choose a city" : "Enter your city";
    // the same rule as checkout (and the server): 10 characters in Pakistan, 5 elsewhere
    if (draft.address.trim().length < (pk ? 10 : 5)) errs.address = "Enter the complete address";
    setErrors(errs);
    if (Object.keys(errs).length) return;
    const entry: SavedAddress = {
      id: draft.id ?? crypto.randomUUID(),
      label: draft.label.trim(),
      name: draft.name.trim(),
      phone: normalizePhone(draft.phone, country)!,
      city: draft.city,
      address: draft.address.trim(),
      landmark: draft.landmark?.trim() || undefined,
      // outside Pakistan, as at checkout
      region: (!pk && draft.region?.trim()) || undefined,
      postalCode: (!pk && draft.postalCode?.trim()) || undefined,
      // an address abroad saved at checkout keeps its country when edited here
      country: draft.country || undefined,
    };
    const next = draft.id ? list.map((a) => (a.id === draft.id ? entry : a)) : [entry, ...list].slice(0, 10);
    persist(next, () => {
      setDraft(null);
      toast("Address saved");
    });
  };

  if (!hydrated && mode === "local") return <Skeleton className="h-40 w-full rounded-3xl" />;

  return (
    <div className="space-y-5">
      {!draft && (
        <button type="button" className="btn btn-primary" onClick={() => (setErrors({}), setDraft({ ...EMPTY, label: list.length ? "Office" : "Home" }))} disabled={list.length >= 10}>
          <Plus className="size-4" aria-hidden="true" /> Add new address
        </button>
      )}

      <AnimatePresence>
        {draft && (
          <motion.form
            initial={{ opacity: 0, y: -8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
            onSubmit={submit}
            noValidate
            className="card grid gap-4 p-5 sm:grid-cols-2"
            aria-label={draft.id ? "Edit address" : "New address"}
          >
            <Field id="ab-label" label="Label" required error={errors.label}>
              <input {...fieldAria("ab-label", errors.label)} value={draft.label} onChange={(e) => setDraft({ ...draft, label: e.target.value })} maxLength={30} placeholder="Home, Office…" />
            </Field>
            <Field id="ab-name" label="Receiver name" required error={errors.name}>
              <input {...fieldAria("ab-name", errors.name)} autoComplete="name" value={draft.name} onChange={(e) => setDraft({ ...draft, name: e.target.value })} maxLength={80} />
            </Field>
            <Field id="ab-phone" label="Mobile number" required error={errors.phone}>
              <input
                {...fieldAria("ab-phone", errors.phone)}
                type="tel"
                inputMode={pk ? "numeric" : "tel"}
                placeholder={phonePlaceholder(country)}
                value={draft.phone}
                onChange={(e) => setDraft({ ...draft, phone: formatPhoneInput(e.target.value, country) })}
                maxLength={pk ? 12 : 20}
              />
            </Field>
            <CityCombobox id="ab-city" value={draft.city} onChange={(city) => setDraft({ ...draft, city })} required error={errors.city} name="ab-city" />
            {!pk && (
              <>
                <Field id="ab-region" label="State / province" optional>
                  <input {...fieldAria("ab-region")} autoComplete="address-level1" value={draft.region ?? ""} onChange={(e) => setDraft({ ...draft, region: e.target.value })} maxLength={60} />
                </Field>
                <Field id="ab-postal" label="Postcode" optional>
                  <input {...fieldAria("ab-postal")} autoComplete="postal-code" value={draft.postalCode ?? ""} onChange={(e) => setDraft({ ...draft, postalCode: e.target.value })} maxLength={12} />
                </Field>
              </>
            )}
            <Field id="ab-address" label="Complete address" required error={errors.address} className="sm:col-span-2">
              <textarea {...fieldAria("ab-address", errors.address)} rows={2} value={draft.address} onChange={(e) => setDraft({ ...draft, address: e.target.value })} maxLength={300} placeholder="House / flat no., street, block, area" />
            </Field>
            <Field id="ab-landmark" label="Nearest landmark" optional className="sm:col-span-2">
              <input {...fieldAria("ab-landmark")} value={draft.landmark ?? ""} onChange={(e) => setDraft({ ...draft, landmark: e.target.value })} maxLength={120} />
            </Field>
            <div className="flex gap-2 sm:col-span-2">
              <button type="submit" className="btn btn-primary" disabled={saving}>
                {saving && <Loader2 className="size-4 animate-spin" aria-hidden="true" />} Save address
              </button>
              <button type="button" className="btn btn-ghost" onClick={() => setDraft(null)}>
                Cancel
              </button>
            </div>
          </motion.form>
        )}
      </AnimatePresence>

      {list.length === 0 && !draft ? (
        <div className="card flex flex-col items-center gap-2 px-6 py-10 text-center">
          <MapPin className="size-8 text-violet-300" aria-hidden="true" />
          <p className="font-semibold">No saved addresses yet</p>
          <p className="text-sm text-muted">Save your home or office address for one-tap checkout.</p>
        </div>
      ) : (
        <ul className="grid gap-3 sm:grid-cols-2">
          {list.map((a) => (
            <li key={a.id} className="card flex gap-3 p-4">
              <MapPin className="mt-0.5 size-5 shrink-0 text-violet-300" aria-hidden="true" />
              <div className="min-w-0 flex-1 text-sm">
                <p className="font-semibold">{a.label}</p>
                <p className="text-muted">
                  {a.name} · {a.phone}
                  <br />
                  {a.address}
                  {a.landmark ? `, near ${a.landmark}` : ""}
                  <br />
                  {[a.city, a.region, a.postalCode].filter(Boolean).join(", ")}
                </p>
              </div>
              <div className="flex flex-col gap-1">
                <button type="button" className="btn btn-ghost btn-icon" aria-label={`Edit ${a.label} address`} onClick={() => (setErrors({}), setDraft({ ...a, landmark: a.landmark ?? "" }))}>
                  <Pencil className="size-4" aria-hidden="true" />
                </button>
                <button
                  type="button"
                  className="btn btn-ghost btn-icon hover:text-rose-400"
                  aria-label={`Delete ${a.label} address`}
                  disabled={saving}
                  onClick={() => persist(list.filter((x) => x.id !== a.id), () => toast("Address removed", "info"))}
                >
                  <Trash2 className="size-4" aria-hidden="true" />
                </button>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
