"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";

import {
  buildLocaleCookie,
  DEFAULT_LOCALE,
  localeDisplayNames,
  readLocaleCookie,
  type AppLocale,
} from "@/shared/i18n/locales";
import { localizeKnownDocumentTitle } from "@/shared/i18n/document-title";
import { translateMessage, type MessageKey, type MessageValues } from "@/shared/i18n/messages";

type Translate = (key: MessageKey, values?: MessageValues) => string;

type LocaleContextValue = {
  locale: AppLocale;
  setLocale: (locale: AppLocale) => void;
  t: Translate;
};

const defaultLocaleContext: LocaleContextValue = {
  locale: DEFAULT_LOCALE,
  setLocale: () => undefined,
  t: (key, values) => translateMessage(DEFAULT_LOCALE, key, values),
};

const LocaleContext = createContext<LocaleContextValue>(defaultLocaleContext);

export function persistLocaleCookie(locale: AppLocale) {
  try {
    document.cookie = buildLocaleCookie(locale, window.location.protocol === "https:");
    return readLocaleCookie(document.cookie) === locale;
  } catch {
    return false;
  }
}

export function LocaleProvider({
  initialLocale,
  children,
}: {
  initialLocale: AppLocale;
  children: ReactNode;
}) {
  const [locale, setLocaleState] = useState(initialLocale);
  const [announcement, setAnnouncement] = useState("");

  useEffect(() => {
    document.documentElement.lang = locale;
    document.documentElement.dataset.locale = locale;
    document.title = localizeKnownDocumentTitle(document.title, locale);
  }, [locale]);

  const setLocale = useCallback(
    (nextLocale: AppLocale) => {
      if (nextLocale === locale) return;

      setLocaleState(nextLocale);
      document.documentElement.lang = nextLocale;
      document.documentElement.dataset.locale = nextLocale;

      const persisted = persistLocaleCookie(nextLocale);
      const announcementKey = persisted ? "locale.changed" : "locale.persistenceFailed";
      setAnnouncement(
        translateMessage(nextLocale, announcementKey, {
          language: localeDisplayNames[nextLocale],
        }),
      );
    },
    [locale],
  );

  const value = useMemo<LocaleContextValue>(
    () => ({
      locale,
      setLocale,
      t: (key, values) => translateMessage(locale, key, values),
    }),
    [locale, setLocale],
  );

  return (
    <LocaleContext.Provider value={value}>
      {children}
      <span className="sr-only" role="status" aria-live="polite" aria-atomic="true">
        {announcement}
      </span>
    </LocaleContext.Provider>
  );
}

export function useLocale() {
  return useContext(LocaleContext);
}
