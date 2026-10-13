/* Urko Tech Store branding inside the Payload admin (login screen logo + nav icon). */
const MARK_PATHS = (
  <>
    <defs>
      <linearGradient id="urko-admin-g" gradientUnits="userSpaceOnUse" x1="0" y1="0" x2="500" y2="385">
        <stop offset="0" stopColor="#00F0FF" />
        <stop offset="0.55" stopColor="#00C6FF" />
        <stop offset="1" stopColor="#1D6BFF" />
      </linearGradient>
    </defs>
    <path
      d="M0 25 A25 25 0 0 1 50 25 L50 290 Q50 337 97 337 L488 337 Q498 337 492 345 L475 368 Q465 385 445 385 L97 385 Q0 385 0 290 Z M341 355 H414 A6 6 0 0 1 414 367 H341 A6 6 0 0 1 341 355 Z"
      fill="url(#urko-admin-g)"
      fillRule="evenodd"
    />
    <path d="M122.5 179.1 A80 80 0 1 0 253.5 179.1" fill="none" stroke="url(#urko-admin-g)" strokeWidth="30" strokeLinecap="round" />
    <path d="M188 109 L188 197" fill="none" stroke="url(#urko-admin-g)" strokeWidth="32" strokeLinecap="round" />
  </>
);

export function Icon() {
  return (
    <svg viewBox="-4 -4 506 393" width="28" height="22" aria-label="Urko Tech Store">
      {MARK_PATHS}
    </svg>
  );
}

export function Logo() {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
      <svg viewBox="-4 -4 506 393" width="64" height="50" aria-hidden="true">
        {MARK_PATHS}
      </svg>
      <div style={{ display: "flex", flexDirection: "column", lineHeight: 1, fontWeight: 800, textTransform: "uppercase", fontFamily: "Montserrat, system-ui, sans-serif" }}>
        <span style={{ fontSize: 30, letterSpacing: "0.02em" }}>Urko</span>
        <span style={{ fontSize: 13, letterSpacing: "0.08em", color: "#00D4FF", marginTop: 4 }}>Tech Store · Admin</span>
      </div>
    </div>
  );
}
