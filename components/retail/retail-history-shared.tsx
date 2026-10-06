"use client";

import { retailRecordHref } from "@/lib/retail-record";
import type { Locale } from "@/lib/i18n/locale";
import { translate } from "@/lib/i18n/translate";
import { useLanguage } from "@/components/language-provider";
import { retailHistoryStatus, type RetailHistoryRecord } from "@/lib/retail-history";
import styles from "./retail-history.module.css";

export function historyText(value: string | null | undefined, locale: Locale = "zh-CN") { return value?.trim() || translate("未记录", locale); }
export function historyDate(value: string | null | undefined, includeTime = false, locale: Locale = "zh-CN") {
  return value ? value.slice(0, includeTime ? 19 : 10).replace("T", " ") : translate("未记录", locale);
}
export function historyMoney(value: number | null, locale: Locale = "zh-CN") {
  return value === null ? translate("未记录", locale) : new Intl.NumberFormat("it-IT", { style: "currency", currency: "EUR" }).format(value / 100);
}
export function historyTitle(record: RetailHistoryRecord, locale: Locale = "zh-CN") {
  return [record.brand, record.model].filter(Boolean).join(" ") || translate("商品名称未记录", locale);
}
export function historyDetailHref(id: string, returnTo = "/app/retail?view=sold") {
  return retailRecordHref(id, returnTo) + "&original=1";
}
export function historyReturnHref(value: string | null) {
  if (value && (/^\/app\/retail(?:\?|$)/.test(value) || /^\/app\/customers\/PHONE-\d+(?:\?|$)/.test(value))) return value;
  return "/app/retail?view=sold";
}
export function RetailHistoryStatus({ record }: { record: RetailHistoryRecord }) {
  const { t } = useLanguage();
  const status = retailHistoryStatus(record);
  const tone = status === "在售" ? "success" : status === "已售" ? "info" : status === "作废" ? "warning" : "progress";
  return <span className={`status-pill status-pill--${tone} ${styles.status}`}>{t(status)}</span>;
}
