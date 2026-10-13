"use client";
import { useCallback, useEffect, useState } from "react";
import { toast } from "../ui/toast";

/**
 * /cms/security – turn on 2-step verification (QR code → 6-digit code → backup codes); when it's on: move it to a
 * new phone or get new backup codes (both need a current code), or turn it off (not for owners/managers).
 */

type Status = { enabled: boolean; required: boolean; backupCodesLeft: number };

async function call<T>(path: string, body?: unknown): Promise<T> {
  const r = await fetch(`/cms-api/2fa/${path}`, { method: body === undefined ? "GET" : "POST", credentials: "include", headers: { "Content-Type": "application/json" }, body: body === undefined ? undefined : JSON.stringify(body) });
  const j = (await r.json().catch(() => ({}))) as T & { error?: string };
  if (!r.ok) throw new Error(j.error || "Something went wrong");
  return j;
}

export function SecurityScreen() {
  const [status, setStatus] = useState<Status | null>(null);
  const [setup, setSetup] = useState<{ secret: string; qr: string } | null>(null);
  const [code, setCode] = useState("");
  const [backup, setBackup] = useState<string[] | null>(null);
  const [busy, setBusy] = useState(false);
  const [current, setCurrent] = useState(""); // code from the CURRENT app (or a backup code) – to move phones / renew codes
  const [moving, setMoving] = useState(false);
  const load = useCallback(async () => setStatus(await call<Status>("status").catch(() => null)), []);
  useEffect(() => {
    void load();
  }, [load]);

  async function start() {
    setBusy(true);
    try {
      setSetup(await call("setup", status?.enabled ? { code: current.trim() } : {}));
      setMoving(Boolean(status?.enabled));
      setCurrent("");
    } catch (e) {
      toast((e as Error).message, "error");
    } finally {
      setBusy(false);
    }
  }
  async function confirm() {
    setBusy(true);
    try {
      const r = await call<{ backupCodes: string[] }>("enable", { code });
      setBackup(r.backupCodes);
      setSetup(null);
      setCode("");
      toast(moving ? "Moved to your new phone – the old phone's codes no longer work" : "2-step verification is on");
      setMoving(false);
      void load();
    } catch (e) {
      toast((e as Error).message, "error");
    } finally {
      setBusy(false);
    }
  }
  async function renewCodes() {
    setBusy(true);
    try {
      const r = await call<{ backupCodes: string[] }>("backup-codes", { code: current.trim() });
      setBackup(r.backupCodes);
      setCurrent("");
      toast("New backup codes – the old ones no longer work");
      void load();
    } catch (e) {
      toast((e as Error).message, "error");
    } finally {
      setBusy(false);
    }
  }
  async function turnOff() {
    const c = window.prompt("Enter a code from your authenticator app to turn 2-step verification off:");
    if (!c) return;
    try {
      await call("disable", { code: c });
      toast("2-step verification is off");
      void load();
    } catch (e) {
      toast((e as Error).message, "error");
    }
  }

  return (
    <div className="urko-home" style={{ maxWidth: 720 }}>
      <h1 style={{ margin: "0 0 4px" }}>Security</h1>
      <p className="urko-tip">2-step verification: after your password, you also type a 6-digit code from an app on your phone. Someone who steals your password still can&apos;t get in.</p>

      {!status ? (
        <div className="urko-skeleton" style={{ height: 120 }} />
      ) : backup ? (
        <div className="urko-card">
          <h2 style={{ marginTop: 0 }}>Save your backup codes</h2>
          <p>If you lose your phone, each of these codes lets you sign in once. Print them or keep them somewhere safe – they won&apos;t be shown again.</p>
          <ul className="urko-backup">
            {backup.map((c) => (
              <li key={c}>{c}</li>
            ))}
          </ul>
          <div className="urko-opanel__contact">
            <button type="button" className="urko-btn" onClick={() => navigator.clipboard.writeText(backup.join("\n")).then(() => toast("Copied"))}>
              Copy
            </button>
            <button type="button" className="urko-btn" onClick={() => window.print()}>
              Print
            </button>
            <a className="urko-btn urko-btn--primary" href="/cms">
              I&apos;ve saved them – go to Home
            </a>
          </div>
        </div>
      ) : status.enabled && !setup ? (
        // (while moving to a new phone `setup` is set – the QR step below must show even though 2-step is on)
        <div className="urko-card">
          <p>
            <span className="urko-badge urko-badge--g">On</span> 2-step verification is on. Backup codes left: <strong>{status.backupCodesLeft}</strong>
          </p>
          <label className="urko-pos__amount" style={{ maxWidth: 320 }}>
            Code from your current app (or a backup code)
            <input autoComplete="one-time-code" maxLength={20} value={current} onChange={(e) => setCurrent(e.target.value.replace(/[^\w-]/g, ""))} placeholder="123456" />
          </label>
          <div className="urko-opanel__contact">
            <button type="button" className="urko-btn urko-btn--primary" disabled={busy || current.trim().length < 6} onClick={start}>
              Move to a new phone
            </button>
            <button type="button" className="urko-btn" disabled={busy || current.trim().length < 6} onClick={renewCodes}>
              Get new backup codes
            </button>
            {!status.required && (
              <button type="button" className="urko-btn urko-btn--ghost" onClick={turnOff}>
                Turn off
              </button>
            )}
          </div>
          <p className="urko-tip">
            New phone? Type a code from the OLD phone (or one of your backup codes), then scan the new QR code with the new phone. Until you finish, the old phone keeps working.
            {status.required ? " Owners and managers must keep 2-step on. Lost your phone and your backup codes? Ask an owner to reset it from your user page." : ""}
          </p>
        </div>
      ) : setup ? (
        <div className="urko-card urko-2fa">
          <ol>
            <li>
              Install <strong>Google Authenticator</strong> or <strong>Microsoft Authenticator</strong> on your phone.
            </li>
            <li>{moving ? "On your NEW phone, in" : "In"} the app tap “+” → “Scan a QR code” and scan this:</li>
          </ol>
          <img src={setup.qr} alt="QR code for your authenticator app" width={220} height={220} />
          <p className="urko-tip">
            Can&apos;t scan? Choose “Enter a setup key” and type: <code>{setup.secret}</code>
          </p>
          <label className="urko-pos__amount" style={{ maxWidth: 260 }}>
            3. Type the 6-digit code the app shows
            <input inputMode="numeric" autoComplete="one-time-code" maxLength={6} value={code} onChange={(e) => setCode(e.target.value.replace(/\D/g, ""))} onKeyDown={(e) => e.key === "Enter" && code.length === 6 && confirm()} />
          </label>
          <div className="urko-opanel__contact">
            <button type="button" className="urko-btn urko-btn--primary" disabled={busy || code.length !== 6} onClick={confirm}>
              {moving ? "Switch to this phone" : "Turn on"}
            </button>
          </div>
        </div>
      ) : (
        <div className="urko-card">
          <p>
            <span className="urko-badge urko-badge--r">Off</span> {status.required ? "Owners and managers must turn this on to keep using the admin." : "Recommended for every staff account."}
          </p>
          <button type="button" className="urko-btn urko-btn--primary" disabled={busy} onClick={start}>
            Set up 2-step verification
          </button>
        </div>
      )}
    </div>
  );
}
