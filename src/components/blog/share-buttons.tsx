"use client";
import { useState } from "react";
import { Check, Link2 } from "lucide-react";
import { WhatsAppIcon } from "@/components/layout/whatsapp-icon";
import { trackEvent } from "@/components/analytics";
import { cn } from "@/lib/utils";

const FacebookIcon = () => (
  <svg viewBox="0 0 24 24" className="size-4" fill="currentColor" aria-hidden="true">
    <path d="M14 8h3V4h-3c-2.8 0-5 2.2-5 5v2H7v4h2v8h4v-8h3l1-4h-4V9c0-.6.4-1 1-1z" />
  </svg>
);
const XIcon = () => (
  <svg viewBox="0 0 24 24" className="size-4" fill="currentColor" aria-hidden="true">
    <path d="M17.8 3h3.1l-6.8 7.7L22 21h-6.2l-4.9-6.4L5.3 21H2.2l7.3-8.3L2 3h6.4l4.4 5.8L17.8 3zm-1.1 16.2h1.7L7.4 4.7H5.6l11.1 14.5z" />
  </svg>
);
const LinkedInIcon = () => (
  <svg viewBox="0 0 24 24" className="size-4" fill="currentColor" aria-hidden="true">
    <path d="M4.98 3.5a2.5 2.5 0 1 1 0 5 2.5 2.5 0 0 1 0-5zM3 9.75h4v11H3v-11zm6.5 0h3.8v1.5h.1c.5-1 1.8-1.9 3.7-1.9 4 0 4.7 2.6 4.7 6v6.4h-4v-5.7c0-1.4 0-3.1-1.9-3.1s-2.2 1.5-2.2 3v5.8h-4.2v-11z" />
  </svg>
);

/** Share row: WhatsApp (primary in Pakistan), Facebook, X, LinkedIn and copy link. */
export function ShareButtons({ url, title, className }: { url: string; title: string; className?: string }) {
  const [copied, setCopied] = useState(false);
  const enc = encodeURIComponent;
  const links = [
    { name: "WhatsApp", href: `https://wa.me/?text=${enc(`${title} – ${url}`)}`, icon: <WhatsAppIcon className="size-4" />, tone: "hover:bg-green-600 hover:border-green-600" },
    { name: "Facebook", href: `https://www.facebook.com/sharer/sharer.php?u=${enc(url)}`, icon: <FacebookIcon />, tone: "hover:bg-blue-600 hover:border-blue-600" },
    { name: "X", href: `https://twitter.com/intent/tweet?url=${enc(url)}&text=${enc(title)}`, icon: <XIcon />, tone: "hover:bg-black hover:border-white/30" },
    { name: "LinkedIn", href: `https://www.linkedin.com/sharing/share-offsite/?url=${enc(url)}`, icon: <LinkedInIcon />, tone: "hover:bg-sky-700 hover:border-sky-700" },
  ];

  async function copy() {
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      trackEvent("share", { method: "copy_link", content_type: "article" });
      setTimeout(() => setCopied(false), 2000);
    } catch {
      /* clipboard unavailable */
    }
  }

  return (
    <div className={cn("flex flex-wrap items-center gap-2", className)}>
      <span className="mr-1 text-sm font-semibold text-fg">Share:</span>
      {links.map((l) => (
        <a
          key={l.name}
          href={l.href}
          target="_blank"
          rel="noopener noreferrer"
          aria-label={`Share on ${l.name}`}
          onClick={() => trackEvent("share", { method: l.name, content_type: "article" })}
          className={cn("grid size-10 place-items-center rounded-full border border-border-strong bg-surface text-fg transition-colors hover:text-white", l.tone)}
        >
          {l.icon}
        </a>
      ))}
      <button
        type="button"
        onClick={copy}
        aria-label={copied ? "Link copied" : "Copy link"}
        className="grid size-10 place-items-center rounded-full border border-border-strong bg-surface text-fg transition-colors hover:border-violet-500/60"
      >
        {copied ? <Check className="size-4 text-emerald-400" aria-hidden="true" /> : <Link2 className="size-4" aria-hidden="true" />}
      </button>
      <span aria-live="polite" className="sr-only">
        {copied ? "Link copied to clipboard" : ""}
      </span>
    </div>
  );
}
