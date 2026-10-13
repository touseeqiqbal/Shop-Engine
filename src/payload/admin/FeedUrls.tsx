"use client";
import { toast } from "./ui/toast";

/** Feed addresses to copy into Google / Meta / TikTok. */
const FEEDS = [
  { name: "Google Merchant Center", path: "/feeds/google.xml", where: "Merchant Center → Products → Feeds → Add feed → Scheduled fetch" },
  { name: "Meta (Facebook / Instagram)", path: "/feeds/meta.xml", where: "Commerce Manager → Catalog → Data sources → Data feed → Scheduled feed" },
  { name: "TikTok", path: "/feeds/tiktok.csv", where: "TikTok Ads Manager → Assets → Catalogs → Add products → Data feed" },
];

export function FeedUrls() {
  const origin = typeof window === "undefined" ? "" : window.location.origin;
  return (
    <div className="field-type" style={{ marginBottom: 24 }}>
      <span className="field-label">Feed addresses</span>
      <ul className="urko-list">
        {FEEDS.map((f) => (
          <li key={f.path} style={{ flexWrap: "wrap" }}>
            <span style={{ flex: "1 1 260px", minWidth: 0 }}>
              <strong>{f.name}</strong>
              <br />
              <code style={{ wordBreak: "break-all" }}>{origin + f.path}</code>
              <br />
              <small className="urko-tip">{f.where}</small>
            </span>
            <button type="button" className="urko-btn urko-btn--sm" onClick={() => navigator.clipboard.writeText(origin + f.path).then(() => toast("Copied"))}>
              Copy
            </button>
            <a className="urko-btn urko-btn--sm" href={f.path} target="_blank" rel="noreferrer">
              Open
            </a>
          </li>
        ))}
      </ul>
    </div>
  );
}
