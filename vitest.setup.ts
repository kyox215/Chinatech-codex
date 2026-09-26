import "@testing-library/jest-dom/vitest";

// Production receives one catalog from the server. Tests seed static catalogs without network imports.
import { messagesByLocale } from "./src/shared/i18n/messages";
import { registerMessageCatalog } from "./src/shared/i18n/runtime-messages";
import { APP_LOCALES } from "./src/shared/i18n/locales";
for (const locale of APP_LOCALES) registerMessageCatalog(locale, messagesByLocale[locale]);
