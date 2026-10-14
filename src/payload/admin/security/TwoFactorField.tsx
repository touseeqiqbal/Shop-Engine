"use client";
import { useAuth, useDocumentInfo, useFormFields } from "@payloadcms/ui";
import { useStoreRole } from "../ui/store-context";
import { toast } from "../ui/toast";

/** User page sidebar: is 2-step verification on; owners can reset it for someone who lost their phone. */
export function TwoFactorField() {
  const { id } = useDocumentInfo();
  const { user } = useAuth();
  const enabled = useFormFields(([f]) => f["twoFactor.enabled"]?.value) as boolean | undefined;
  const isMe = user && String(user.id) === String(id);
  // resetting someone else's 2-step is a platform admin's job (lost phone)
  const isOwner = useStoreRole().isPlatformAdmin;
  if (!id) return null;

  async function reset() {
    if (!window.confirm("Reset 2-step verification for this person? They'll have to set it up again at their next sign-in.")) return;
    const r = await fetch("/cms-api/2fa/reset", { method: "POST", credentials: "include", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ userId: Number(id) }) });
    const j = (await r.json().catch(() => ({}))) as { error?: string };
    if (r.ok) {
      toast("2-step verification reset");
      setTimeout(() => window.location.reload(), 600);
    } else toast(j.error || "Could not reset", "error");
  }

  return (
    <div className="field-type" style={{ marginBottom: 24 }}>
      <span className="field-label">2-step verification</span>
      <p style={{ margin: "6px 0" }}>
        <span className={`urko-badge urko-badge--${enabled ? "g" : "n"}`}>{enabled ? "On" : "Off"}</span>
      </p>
      {isMe ? (
        <a className="urko-btn urko-btn--sm" href="/cms/security">
          {enabled ? "Manage" : "Set up"}
        </a>
      ) : (
        isOwner &&
        enabled && (
          <button type="button" className="urko-btn urko-btn--sm urko-btn--ghost" onClick={reset}>
            Reset (lost phone)
          </button>
        )
      )}
    </div>
  );
}
