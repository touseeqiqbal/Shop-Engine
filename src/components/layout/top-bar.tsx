import Link from "next/link";
import { ArrowRight, Mail, MapPin, Phone, Truck } from "lucide-react";
import { waLink } from "@/lib/site";
import { getSiteInfo } from "@/lib/repo/site-content";
import type { Chrome } from "@/lib/cms/chrome-types";
import { WhatsAppIcon } from "./whatsapp-icon";

/**
 * Announcement bar (Online store → Announcement bar in /cms): message, optional link, colours and schedule,
 * plus the phone / WhatsApp / email links (Store info). Hidden completely when both parts are switched off.
 */
export async function TopBar({ announcement, legacyText }: { announcement: Chrome["announcement"]; legacyText?: string }) {
  const site = await getSiteInfo(); // live business profile (Store info)
  if (!announcement.enabled && !announcement.showContactLinks) return null;
  const shortAddress = [site.address.street.split(",")[0], site.address.area].filter(Boolean).join(", ");
  const text = announcement.text || legacyText || site.tagline;
  const style = {
    ...(announcement.backgroundColor ? { backgroundColor: announcement.backgroundColor } : {}),
    ...(announcement.textColor ? { color: announcement.textColor } : {}),
  };
  const external = /^https?:\/\//i.test(announcement.linkUrl);

  return (
    <div className="relative z-50 border-b border-border bg-bg-elevated/80 text-xs text-muted" style={style}>
      <div className="container-x flex h-9 items-center justify-between gap-4">
        {announcement.enabled ? (
          <p className="flex min-w-0 items-center gap-2 truncate">
            <Truck className="size-3.5 shrink-0 text-violet-400" aria-hidden="true" />
            <span className="truncate">{text}</span>
            {announcement.linkUrl && (
              <Link
                href={announcement.linkUrl}
                {...(external ? { target: "_blank", rel: "noopener noreferrer" } : {})}
                className="inline-flex shrink-0 items-center gap-1 font-semibold underline-offset-2 hover:underline"
                style={announcement.textColor ? { color: announcement.textColor } : undefined}
              >
                {announcement.linkLabel || "Learn more"} <ArrowRight className="size-3" aria-hidden="true" />
              </Link>
            )}
          </p>
        ) : (
          <span />
        )}
        {announcement.showContactLinks && (
          <div className="flex shrink-0 items-center gap-4">
            {site.phones.map((p, i) => (
              <span key={p.tel} className={i === 1 ? "hidden md:flex items-center gap-3" : "flex items-center gap-3"}>
                <a href={`tel:${p.tel}`} className="inline-flex min-h-6 min-w-6 items-center justify-center gap-1 hover:text-fg" aria-label={`Call ${p.display}`}>
                  <Phone className="size-3.5" aria-hidden="true" />
                  <span className="hidden sm:inline">{p.display}</span>
                </a>
                <a
                  href={waLink(p.wa, `Hi ${site.name}!`)}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex min-h-6 min-w-6 items-center justify-center text-emerald-400 hover:text-emerald-300"
                  aria-label={`WhatsApp ${p.display}`}
                >
                  <WhatsAppIcon className="size-3.5" />
                </a>
              </span>
            ))}
            <a href={`mailto:${site.email}`} className="hidden items-center gap-1 hover:text-fg lg:inline-flex">
              <Mail className="size-3.5" aria-hidden="true" /> {site.email}
            </a>
            <a href={site.mapLink} target="_blank" rel="noopener noreferrer" className="hidden items-center gap-1 hover:text-fg xl:inline-flex">
              <MapPin className="size-3.5" aria-hidden="true" /> {shortAddress}
            </a>
            <Link href="/track-order" className="hidden min-h-6 items-center font-medium text-fg/90 hover:text-fg sm:inline-flex">
              Track Order
            </Link>
          </div>
        )}
      </div>
    </div>
  );
}
