"use client";

import { createContext, useContext, useEffect, useMemo, useRef, useSyncExternalStore, type ReactNode } from "react";
import { isLocale, languageStorageKey, type Locale } from "@/lib/i18n/locale";
import { translate, translateSystemMessage } from "@/lib/i18n/translate";

let current: Locale = "zh-CN";
let initialized = false;
const listeners = new Set<() => void>();
function snapshot() {
  if (!initialized) {
    initialized = true;
    try { const saved = localStorage.getItem(languageStorageKey); if (isLocale(saved)) current = saved; } catch { /* The switch still works without persistent storage. */ }
  }
  return current;
}
function serverSnapshot(): Locale { return "zh-CN"; }
function subscribe(listener: () => void) {
  listeners.add(listener);
  function onStorage(event: StorageEvent) {
    if (event.key !== languageStorageKey) return;
    current = isLocale(event.newValue) ? event.newValue : "zh-CN";
    listeners.forEach(notify => notify());
  }
  window.addEventListener("storage", onStorage);
  return () => { listeners.delete(listener); window.removeEventListener("storage", onStorage); };
}
function setLocale(locale: Locale) {
  current = locale;
  initialized = true;
  try { localStorage.setItem(languageStorageKey, locale); } catch { /* Do not block an in-memory preference. */ }
  listeners.forEach(notify => notify());
}
type LanguageContextValue = { locale: Locale; setLocale: (locale: Locale) => void; t: (text: string, values?: Record<string, string | number>) => string; systemText: (text: string, values?: Record<string, string | number>) => string };
const LanguageContext = createContext<LanguageContextValue>({ locale: "zh-CN", setLocale, t: text => text, systemText: text => text });
export function LanguageProvider({ children }: { children: ReactNode }) {
  const locale = useSyncExternalStore(subscribe, snapshot, serverSnapshot);
  const title = useRef({ original: "", rendered: "" });
  useEffect(() => {
    document.documentElement.lang = locale;
    const updateTitle = () => {
      if (document.title !== title.current.rendered) title.current.original = document.title;
      const translated = title.current.original.split("｜").map(part => translate(part, locale)).join("｜");
      title.current.rendered = translated;
      if (document.title !== translated) document.title = translated;
    };
    updateTitle();
    // Next updates route metadata independently of the page's client state.
    const observer = new MutationObserver(updateTitle);
    observer.observe(document.head, { childList: true, subtree: true, characterData: true });
    return () => observer.disconnect();
  }, [locale]);
  const value = useMemo(() => ({ locale, setLocale, t: (text: string, values?: Record<string, string | number>) => translate(text, locale, values), systemText: (text: string, values?: Record<string, string | number>) => translateSystemMessage(text, locale, values) }), [locale]);
  return <LanguageContext.Provider value={value}>{children}</LanguageContext.Provider>;
}
export function useLanguage() { return useContext(LanguageContext); }
export function UiText({ text, values }: { text: string; values?: Record<string, string | number> }) { return useLanguage().t(text, values); }
