import Link from "next/link";
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
export function historyDetailHref(id: string, returnTo = "/app/retail?source=history") {
  return `/app/retail/history/${encodeURIComponent(id)}?${new URLSearchParams({ returnTo }).toString()}`;
}
export function historyReturnHref(value: string | null) {
  if (value && (/^\/app\/retail(?:\?|$)/.test(value) || /^\/app\/customers\/PHONE-\d+(?:\?|$)/.test(value))) return value;
  return "/app/retail?source=history";
}
export function RetailHistoryStatus({ record }: { record: RetailHistoryRecord }) {
  const status = retailHistoryStatus(record);
  const tone = status === "在售" ? "success" : status === "已售" ? "info" : status === "作废" ? "warning" : "progress";
  return <span className={`status-pill status-pill--${tone} ${styles.status}`}>{status}</span>;
}
export function RetailHistorySourceTabs({ active, historyCount, unitCount }: { active: "history" | "units"; historyCount: number; unitCount: number }) {
  return <nav className={styles.sourceTabs} aria-label="整机记录来源">
    <Link href="/app/retail?source=history" aria-current={active === "history" ? "page" : undefined}>历史整机 <span>{historyCount}</span></Link>
    <Link href="/app/retail?source=units" aria-current={active === "units" ? "page" : undefined}>单机档案 <span>{unitCount}</span></Link>
  </nav>;
}
