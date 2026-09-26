import { commonMessages } from "./common-messages";
import type { AppLocale } from "./locales";
import type { MessageKey, MessageValues } from "./messages";

export type MessageCatalog = Record<MessageKey, string>;
const catalogs: Partial<Record<AppLocale, MessageCatalog>> = {};
const pending: Partial<Record<AppLocale, Promise<MessageCatalog>>> = {};
const loaders = {
  "zh-CN": () => import("./catalogs/zh-CN"),
  "it-IT": () => import("./catalogs/it-IT"),
  en: () => import("./catalogs/en"),
};

// Catalogs contain public static copy only; no request/user/store data is stored here.
export function registerMessageCatalog(locale: AppLocale, catalog: MessageCatalog) {
  catalogs[locale] = catalog;
}

export function getLoadedMessageCatalog(locale: AppLocale) {
  return catalogs[locale];
}

export function loadMessageCatalog(locale: AppLocale): Promise<MessageCatalog> {
  if (catalogs[locale]) return Promise.resolve(catalogs[locale]);
  return (pending[locale] ??= loaders[locale]()
    .then(({ messages }) => {
      registerMessageCatalog(locale, messages);
      return messages;
    })
    .finally(() => {
      delete pending[locale];
    }));
}

export function translateLoadedMessage(locale: AppLocale, key: MessageKey, values?: MessageValues) {
  const common = commonMessages[locale] as Partial<MessageCatalog>;
  const template = catalogs[locale]?.[key] ?? common[key] ?? key;
  if (!values) return template;
  return template.replace(/\{(\w+)\}/g, (match, name: string) => {
    const value = values[name];
    return value === undefined ? match : String(value);
  });
}
