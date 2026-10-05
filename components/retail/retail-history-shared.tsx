"use client";

import { useLanguage } from "@/components/language-provider";
import { retailHistoryStatus, type RetailHistoryRecord } from "@/lib/retail-history";
import styles from "./retail-history.module.css";

export function historyText(value: string | null | undefined) { return value?.trim() || "未记录"; }
export function historyDate(value: string | null | undefined, includeTime = false) {
  return value ? value.slice(0, includeTime ? 19 : 10).replace("T", " ") : "未记录";
}
export function historyMoney(value: number | null) {
  return value === null ? "未记录" : new Intl.NumberFormat("it-IT", { style: "currency", currency: "EUR" }).format(value / 100);
}
export function historyTitle(record: RetailHistoryRecord) {
  return [record.brand, record.model].filter(Boolean).join(" ") || "商品名称未记录";
}
export function historyDetailHref(id: string, returnTo = "/app/retail?view=sold") {
  return `/app/retail/history/${encodeURIComponent(id)}?${new URLSearchParams({ returnTo }).toString()}`;
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
