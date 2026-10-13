"use client";
import { useState } from "react";

/**
 * The /cms sign-in form (replaces Payload's default one, which is hidden with CSS):
 * email + password, then – for accounts with 2-step verification – the 6-digit code (or a backup code).
 */
export function LoginIntro() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [code, setCode] = useState("");
  const [needCode, setNeedCode] = useState(false);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError("");
    try {
      const r = await fetch("/cms-api/2fa/login", { method: "POST", credentials: "include", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ email, password, code: needCode ? code : undefined }) });
      const j = (await r.json().catch(() => ({}))) as { ok?: boolean; needCode?: boolean; error?: string };
      if (j.needCode) {
        setNeedCode(true);
        setBusy(false);
        return;
      }
      if (!r.ok || !j.ok) throw new Error(j.error || "Couldn't sign in");
      const next = new URLSearchParams(window.location.search).get("redirect");
      window.location.href = next && next.startsWith("/cms") ? next : "/cms";
    } catch (err) {
      setError((err as Error).message);
      setBusy(false);
    }
  }

  return (
    <div className="urko-login">
      <div className="urko-login-intro">
        <h1>Welcome back</h1>
        <p>{needCode ? "Open your authenticator app and type the 6-digit code." : "Sign in to manage Urko Tech Store."}</p>
      </div>
      <form onSubmit={submit} className="urko-login__form" noValidate>
        {!needCode ? (
          <>
            <label>
              Email
              <input type="email" autoComplete="username" required value={email} onChange={(e) => setEmail(e.target.value)} autoFocus />
            </label>
            <label>
              Password
              <input type="password" autoComplete="current-password" required value={password} onChange={(e) => setPassword(e.target.value)} />
            </label>
          </>
        ) : (
          <label>
            6-digit code
            <input
              inputMode="numeric"
              autoComplete="one-time-code"
              required
              value={code}
              onChange={(e) => setCode(e.target.value.trim())}
              autoFocus
              placeholder="123456"
              aria-describedby="urko-code-help"
            />
            <small id="urko-code-help">Lost your phone? Type one of your backup codes instead (like k4m9-2xqp).</small>
          </label>
        )}
        {error && (
          <p className="urko-login__error" role="alert">
            {error}
          </p>
        )}
        <button type="submit" className="urko-btn urko-btn--primary" disabled={busy || !email || !password || (needCode && !code)}>
          {busy ? "Signing in…" : needCode ? "Verify" : "Sign in"}
        </button>
        <div className="urko-login__links">
          {needCode ? (
            <button type="button" className="urko-linkbtn" onClick={() => (setNeedCode(false), setCode(""), setError(""))}>
              ← Back
            </button>
          ) : (
            <a href="/cms/forgot">Forgot password?</a>
          )}
        </div>
      </form>
    </div>
  );
}
