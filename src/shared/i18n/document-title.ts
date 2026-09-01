import { APP_LOCALES, type AppLocale } from "@/shared/i18n/locales";
import { translateMessage, type MessageKey } from "@/shared/i18n/messages";

const STATIC_PAGE_TITLE_KEYS = [
  "account.title",
  "action.new-order.label",
  "auth.forgotTitle",
  "auth.confirmTitle",
  "auth.inviteCompleteTitle",
  "auth.login",
  "auth.onboardingTitle",
  "auth.resetTitle",
  "buyback.title",
  "customers.title",
  "inventory.afterSalesDetailTitle",
  "inventory.afterSalesTitle",
  "inventory.editTitle",
  "inventory.intakeTitle",
  "inventory.reservationDetailTitle",
  "inventory.reserveTitle",
  "inventory.saleDetailTitle",
  "inventory.saleTitle",
  "inventory.title",
  "memos.title",
  "messages.title",
  "nav.dashboard.title",
  "offline.title",
  "orders.title",
  "platform.title",
  "profit.title",
  "settings.closedStoresTitle",
  "settings.title",
  "toolkit.title",
] as const satisfies readonly MessageKey[];

const TITLE_SUFFIX = " — RepairDesk";

export function localizeKnownDocumentTitle(currentTitle: string, nextLocale: AppLocale) {
  if (APP_LOCALES.some((locale) => currentTitle === translateMessage(locale, "metadata.title"))) {
    return translateMessage(nextLocale, "metadata.title");
  }

  for (const key of STATIC_PAGE_TITLE_KEYS) {
    const matchedTitle = APP_LOCALES.map(
      (locale) => `${translateMessage(locale, key)}${TITLE_SUFFIX}`,
    ).includes(currentTitle);
    if (matchedTitle) return `${translateMessage(nextLocale, key)}${TITLE_SUFFIX}`;
  }

  return currentTitle;
}
