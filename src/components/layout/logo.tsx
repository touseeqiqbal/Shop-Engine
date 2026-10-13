"use client";
import Image from "next/image";
import Link from "next/link";
import { useId } from "react";
import { cn } from "@/lib/utils";
import { useChrome } from "@/components/providers/chrome";

/** Official Urko Tech Store mark: laptop "L" with a power button, cyan → blue gradient. */
export function LogoMark({ className, title }: { className?: string; title?: string }) {
  const id = useId().replace(/:/g, "");
  return (
    <svg viewBox="-4 -4 506 393" className={cn("h-8 w-auto", className)} role={title ? "img" : undefined} aria-hidden={title ? undefined : true}>
      {title && <title>{title}</title>}
      <defs>
        <linearGradient id={`urko-g-${id}`} gradientUnits="userSpaceOnUse" x1="0" y1="0" x2="500" y2="385">
          <stop offset="0" stopColor="#00F0FF" />
          <stop offset="0.55" stopColor="#00C6FF" />
          <stop offset="1" stopColor="#1D6BFF" />
        </linearGradient>
      </defs>
      <path
        d="M0 25 A25 25 0 0 1 50 25 L50 290 Q50 337 97 337 L488 337 Q498 337 492 345 L475 368 Q465 385 445 385 L97 385 Q0 385 0 290 Z M341 355 H414 A6 6 0 0 1 414 367 H341 A6 6 0 0 1 341 355 Z"
        fill={`url(#urko-g-${id})`}
        fillRule="evenodd"
      />
      <path d="M122.5 179.1 A80 80 0 1 0 253.5 179.1" fill="none" stroke={`url(#urko-g-${id})`} strokeWidth="30" strokeLinecap="round" />
      <path d="M188 109 L188 197" fill="none" stroke={`url(#urko-g-${id})`} strokeWidth="32" strokeLinecap="round" />
    </svg>
  );
}

/**
 * Horizontal lockup: mark + "URKO / TECH STORE" wordmark (Montserrat ExtraBold), theme-aware.
 * A logo uploaded in /cms → Online store → Theme settings replaces it (separate files for dark / light mode).
 */
export function Logo({ className, compact }: { className?: string; compact?: boolean }) {
  const { theme } = useChrome();
  if (theme.logoDark) {
    const style = { height: theme.logoHeight };
    return (
      <Link href="/" className={cn("flex shrink-0 items-center", className)} aria-label={`${theme.logoAlt} home`}>
        {/* resized by Next.js (an uploaded logo can be a big original) */}
        <Image src={theme.logoDark} alt="" width={0} height={0} sizes="180px" loading="eager" unoptimized={theme.logoDark.endsWith(".svg")} style={style} className={cn("w-auto max-w-[180px] object-contain", theme.logoLight !== theme.logoDark && "light:hidden")} />
        {theme.logoLight && theme.logoLight !== theme.logoDark && (
          <Image src={theme.logoLight} alt="" width={0} height={0} sizes="180px" unoptimized={theme.logoLight.endsWith(".svg")} style={style} className="hidden w-auto max-w-[180px] object-contain light:block" />
        )}
      </Link>
    );
  }
  return (
    <Link href="/" className={cn("flex shrink-0 items-center gap-2.5", className)} aria-label={compact ? "Urko Tech Store home" : undefined}>
      <LogoMark className="h-8 sm:h-9" />
      {!compact && (
        <span className="flex flex-col font-logo font-extrabold uppercase leading-none">
          <span className="text-[1.3rem] tracking-[0.02em] text-fg sm:text-[1.45rem]">Urko </span>
          <span className="mt-0.5 text-[0.62rem] tracking-[0.075em] text-[#00D4FF] light:text-[#0095E0] sm:text-[0.7rem]">
            Tech Store<span className="sr-only"> home</span>
          </span>
        </span>
      )}
    </Link>
  );
}
