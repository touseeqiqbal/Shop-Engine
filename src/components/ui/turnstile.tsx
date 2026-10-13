"use client";
import { useEffect, useRef } from "react";

/**
 * Cloudflare Turnstile bot check. Renders nothing until NEXT_PUBLIC_TURNSTILE_SITE_KEY is set.
 * Put it inside a <form>; it adds a hidden "cf-turnstile-response" field that the server checks
 * with verifyTurnstile(). Usually invisible to real visitors ("managed" mode).
 */

type TurnstileApi = {
  render: (el: HTMLElement, opts: Record<string, unknown>) => string;
  remove: (id: string) => void;
  reset: (id: string) => void;
};
declare global {
  interface Window {
    turnstile?: TurnstileApi;
    __turnstileLoading?: Promise<void>;
  }
}

const SITE_KEY = process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY;

function loadScript(): Promise<void> {
  if (window.turnstile) return Promise.resolve();
  window.__turnstileLoading ??= new Promise<void>((resolve, reject) => {
    const s = document.createElement("script");
    s.src = "https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit";
    s.async = true;
    s.defer = true;
    s.onload = () => resolve();
    s.onerror = () => reject(new Error("turnstile failed to load"));
    document.head.appendChild(s);
  });
  return window.__turnstileLoading;
}

export function Turnstile({ action }: { action?: string }) {
  const box = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!SITE_KEY || !box.current) return;
    let id: string | null = null;
    let live = true;
    loadScript()
      .then(() => {
        if (!live || !box.current || !window.turnstile) return;
        const dark = document.documentElement.classList.contains("dark") || document.documentElement.dataset.theme === "dark";
        id = window.turnstile.render(box.current, { sitekey: SITE_KEY, action, theme: dark ? "dark" : "auto", size: "flexible", appearance: "interaction-only" });
      })
      .catch(() => undefined);
    // a token works once: get a fresh one after every submit (the form may come back with an error)
    const form = box.current.closest("form");
    const onSubmit = () => setTimeout(() => id && window.turnstile?.reset(id), 1500);
    form?.addEventListener("submit", onSubmit);
    return () => {
      live = false;
      form?.removeEventListener("submit", onSubmit);
      if (id && window.turnstile) window.turnstile.remove(id);
    };
  }, [action]);
  if (!SITE_KEY) return null;
  return <div ref={box} className="min-h-0" />;
}
