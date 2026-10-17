"use client";

import { useLanguage } from "@/components/language-provider";
import { NavigationLink as Link } from "@/components/navigation-link";
import { useMemo } from "react";
import { ListPagination, useListWindow } from "@/components/list-pagination";
import { Archive, ChevronRight } from "lucide-react";
import { retailHistoryCode, type RetailHistoryRecord } from "@/lib/retail-history";
import { historyDate, historyDetailHref, historyMoney, historyTitle, RetailHistoryStatus } from "./retail-history-shared";
import styles from "./retail-history.module.css";

export function RetailHistoryCustomerRecords({ records, returnTo }: { records: RetailHistoryRecord[]; returnTo: string }) {
  const { t , locale } = useLanguage();
  const sorted = useMemo(() => [...records].sort((a, b) => b.intakeAt.localeCompare(a.intakeAt) || b.sourceRow - a.sourceRow), [records]);
  const window = useListWindow(records.length, returnTo);
  const visible = sorted.slice(0, window.limit);
  if (!records.length) return <div className="module-empty"><Archive size={26} /><strong>{t("暂无历史整机记录")}</strong></div>;
  return <><ol className={styles.customerHistoryRows}>{visible.map(record => <li key={record.id}><Link href={historyDetailHref(record.id, returnTo)} icon={<ChevronRight size={17} />} iconPosition="end"><span><strong>{historyTitle(record, locale)}</strong><small>{retailHistoryCode(record)} {t(" · 入库 ")}{historyDate(record.intakeAt, false, locale)}</small><p>{t("成交价 ")}{historyMoney(record.salePriceCents, locale)} {t(" · 拿走 ")}{historyDate(record.pickupDate, false, locale)}</p><span className={styles.inlineStates}><RetailHistoryStatus record={record} />{record.reviewReasons.length ? <span className={styles.review}>{t("待核对")}</span> : null}</span></span></Link></li>)}</ol><ListPagination shown={visible.length} total={records.length} hasMore={visible.length < records.length} onLoadMore={window.loadMore} resetKey={window.resetKey} label={t("客户历史整机加载")} /></>;
}
