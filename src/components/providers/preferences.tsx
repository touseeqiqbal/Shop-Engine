"use client";
import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from "react";
import { dict, type DictKey, type Lang } from "@/lib/i18n";

type Theme = "dark" | "light";

interface Prefs {
  theme: Theme;
  setTheme: (t: Theme) => void;
  lang: Lang;
  setLang: (l: Lang) => void;
  t: (key: DictKey) => string;
}

const Ctx = createContext<Prefs | null>(null);

export function PreferencesProvider({ children, defaultTheme = "dark" }: { children: ReactNode; defaultTheme?: Theme }) {
  const [theme, setThemeState] = useState<Theme>(defaultTheme);
  const [lang, setLangState] = useState<Lang>("en");

  useEffect(() => {
    const t = document.documentElement.dataset.theme as Theme | undefined;
    if (t === "light" || t === "dark") setThemeState(t);
    try {
      if (localStorage.getItem("urko-lang") === "ur") setLangState("ur");
    } catch {}
  }, []);

  const setTheme = useCallback((t: Theme) => {
    setThemeState(t);
    document.documentElement.dataset.theme = t;
    try {
      localStorage.setItem("urko-theme", t);
    } catch {}
  }, []);

  // the page keeps the store's own language (<html lang>): only a few labels are translated – each is marked as
  // Urdu itself (<Tr>), so screen readers read the rest (products, content) in the right voice
  const setLang = useCallback((l: Lang) => {
    setLangState(l);
    try {
      localStorage.setItem("urko-lang", l);
    } catch {}
  }, []);

  const t = useCallback((key: DictKey) => dict[key][lang], [lang]);

  return <Ctx.Provider value={{ theme, setTheme, lang, setLang, t }}>{children}</Ctx.Provider>;
}

/** A translated label: marked as Urdu (right to left) when shown in Urdu, plain text otherwise. */
export function Tr({ k }: { k: DictKey }) {
  const { lang, t } = usePrefs();
  return lang === "ur" ? (
    <span lang="ur" dir="rtl">
      {t(k)}
    </span>
  ) : (
    <>{t(k)}</>
  );
}

export function usePrefs() {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error("usePrefs must be used inside PreferencesProvider");
  return ctx;
}
