"use client";
import { useField } from "@payloadcms/ui";
import { countryInText, countryName } from "../../lib/locale";
import { gatewaysFor, LOCAL_METHOD_IDEAS } from "../../lib/payments/catalog";
import { useAdminLocale } from "./ui/store-context";

/** Settings → Payments: what customers in the store's country commonly pay with, and which card providers work there. */
export function PaymentIdeas() {
  const { value: store } = useField<unknown>({ path: "store" });
  const { country, currency } = useAdminLocale(store ?? undefined);
  const ideas = LOCAL_METHOD_IDEAS[country] ?? [];
  const gateways = gatewaysFor(country, currency);
  return (
    <div className="field-type" style={{ margin: "8px 0 16px", padding: "12px 14px", borderRadius: 8, background: "var(--theme-elevation-50)", fontSize: 13, lineHeight: 1.5 }}>
      <strong>Payments in {countryName(country)}</strong>
      <p style={{ margin: "4px 0 0" }}>
        {ideas.length ? (
          <>
            Popular ways to pay: {ideas.join(", ")}. Add the ones you accept below as “Other payment methods” – with your account details, shoppers pay you
            directly and upload the receipt.
          </>
        ) : (
          <>Add the local wallets or bank apps your customers use below as “Other payment methods”.</>
        )}
      </p>
      <p style={{ margin: "4px 0 0", color: "var(--theme-elevation-600)" }}>
        Online card payments: {gateways.length ? `${gateways.map((g) => g.label).join(", ")} – connect it in Account → Stores → Online payments.` : `no connected provider works in ${countryInText(country)} yet – use bank transfer, cash on delivery or your own methods.`}
      </p>
    </div>
  );
}
