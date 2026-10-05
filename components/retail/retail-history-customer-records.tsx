"use client";

import { useLanguage } from "@/components/language-provider";
import Link from "next/link";
import { useMemo, useState } from "react";
import { Archive, ChevronRight } from "lucide-react";
import { retailHistoryCode, type RetailHistoryRecord } from "@/lib/retail-history";
import { historyDate, historyDetailHref, historyMoney, historyTitle, RetailHistoryStatus } from "./retail-history-shared";
import styles from "./retail-history.module.css";

export function RetailHistoryCustomerRecords({ records, returnTo }: { records: RetailHistoryRecord[]; returnTo: string }) {
  const { t } = useLanguage();
  const [requestedPage, setPage] = useState(1);
  const sorted = useMemo(() => [...records].sort((a, b) => b.intakeAt.localeCompare(a.intakeAt) || b.sourceRow - a.sourceRow), [records]);
  const pageCount = Math.max(1, Math.ceil(records.length / 50));
  const page = Math.min(requestedPage, pageCount);
  if (!records.length) return <div className="module-empty"><Archive size={26} /><strong>{t("暂无历史整机记录")}</strong></div>;
  return <><ol className={styles.customerHistoryRows}>{sorted.slice((page - 1) * 50, page * 50).map(record => <li key={record.id}><Link href={historyDetailHref(record.id, returnTo)}><span><strong>{historyTitle(record)}</strong><small>{retailHistoryCode(record)} {t(" · 入库 ")}{historyDate(record.intakeAt)}</small><p>{t("成交价 ")}{historyMoney(record.salePriceCents)} {t(" · 拿走 ")}{historyDate(record.pickupDate)}</p><span className={styles.inlineStates}><RetailHistoryStatus record={record} />{record.reviewReasons.length ? <span className={styles.review}>{t("待核对")}</span> : null}</span></span><ChevronRight size={17} /></Link></li>)}</ol>{pageCount > 1 ? <nav className={styles.pagination} aria-label={t("客户历史整机分页")}><span>{t("第 ")}{page} / {pageCount} {t(" 页")}</span><div><button className="button button--secondary" type="button" disabled={page <= 1} onClick={() => setPage(page - 1)}>{t("上一页")}</button><button className="button button--secondary" type="button" disabled={page >= pageCount} onClick={() => setPage(page + 1)}>{t("下一页")}</button></div></nav> : null}</>;
}
