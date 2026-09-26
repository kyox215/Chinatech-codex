"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  useRef,
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
import type { MessageKey, MessageValues } from "@/shared/i18n/messages";
import {
  translateLoadedMessage as translateMessage,
  getLoadedMessageCatalog,
  loadMessageCatalog,
  registerMessageCatalog,
  type MessageCatalog,
} from "@/shared/i18n/runtime-messages";

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
  initialMessages,
  children,
}: {
  initialLocale: AppLocale;
  initialMessages?: MessageCatalog;
  children: ReactNode;
}) {
  if (initialMessages) registerMessageCatalog(initialLocale, initialMessages);
  const [locale, setLocaleState] = useState(initialLocale);
  const localeRequestRef = useRef(0);
  useEffect(
    () => () => {
      localeRequestRef.current += 1;
    },
    [],
  );
  const [announcement, setAnnouncement] = useState("");

  useEffect(() => {
    document.documentElement.lang = locale;
    document.documentElement.dataset.locale = locale;
    document.title = localizeKnownDocumentTitle(document.title, locale);
  }, [locale]);

  const setLocale = useCallback(
    (nextLocale: AppLocale) => {
      const request = ++localeRequestRef.current;
      if (nextLocale === locale) return;
      const apply = () => {
        if (localeRequestRef.current !== request) return;
        setLocaleState(nextLocale);
        document.documentElement.lang = nextLocale;
        document.documentElement.dataset.locale = nextLocale;
        const persisted = persistLocaleCookie(nextLocale);
        setAnnouncement(
          translateMessage(nextLocale, persisted ? "locale.changed" : "locale.persistenceFailed", {
            language: localeDisplayNames[nextLocale],
          }),
        );
      };
      if (getLoadedMessageCatalog(nextLocale)) apply();
      else
        void loadMessageCatalog(nextLocale)
          .then(apply)
          .catch(() => {
            if (localeRequestRef.current === request)
              setAnnouncement(translateMessage(locale, "locale.loadFailed"));
          });
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
