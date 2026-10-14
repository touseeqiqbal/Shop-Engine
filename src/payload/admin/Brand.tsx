/* ShopEngine branding inside the Payload admin (login screen logo + nav icon). The store being worked in is named in the menu. */
const MARK_PATHS = (
  <>
    <defs>
      <linearGradient id="urko-admin-g" gradientUnits="userSpaceOnUse" x1="0" y1="0" x2="64" y2="64">
        <stop offset="0" stopColor="#00C6FF" />
        <stop offset="0.5" stopColor="#3B82F6" />
        <stop offset="1" stopColor="#8B5CF6" />
      </linearGradient>
    </defs>
    {/* rounded tile with a shopping bag */}
    <rect x="0" y="0" width="64" height="64" rx="16" fill="url(#urko-admin-g)" />
    <path d="M18 24 H46 L43 50 H21 Z" fill="none" stroke="#fff" strokeWidth="4.5" strokeLinejoin="round" />
    <path d="M25 24 V20 A7 7 0 0 1 39 20 V24" fill="none" stroke="#fff" strokeWidth="4.5" strokeLinecap="round" />
  </>
);

export function Icon() {
  return (
    <svg viewBox="0 0 64 64" width="24" height="24" aria-label="ShopEngine">
      {MARK_PATHS}
    </svg>
  );
}

export function Logo() {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
      <svg viewBox="0 0 64 64" width="52" height="52" aria-hidden="true">
        {MARK_PATHS}
      </svg>
      <div style={{ display: "flex", flexDirection: "column", lineHeight: 1, fontWeight: 800, fontFamily: "Montserrat, system-ui, sans-serif" }}>
        <span style={{ fontSize: 30, letterSpacing: "0.01em" }}>ShopEngine</span>
        <span style={{ fontSize: 13, letterSpacing: "0.04em", color: "#00D4FF", marginTop: 4, fontWeight: 700 }}>the engine that powers shops</span>
      </div>
    </div>
  );
}
