"use client";

import { useLanguage } from "@/components/language-provider";
import { useMemo } from "react";
import { ListPagination, useListWindow } from "@/components/list-pagination";
import { Archive } from "lucide-react";
import { type RetailHistoryRecord } from "@/lib/retail-history";
import { CustomerHistoryRecordLink } from "@/components/customers/customer-record-links";
import styles from "./retail-history.module.css";

export function RetailHistoryCustomerRecords({ records, returnTo }: { records: RetailHistoryRecord[]; returnTo: string }) {
  const { t } = useLanguage();
  const sorted = useMemo(() => [...records].sort((a, b) => b.intakeAt.localeCompare(a.intakeAt) || b.sourceRow - a.sourceRow), [records]);
  const window = useListWindow(records.length, returnTo);
  const visible = sorted.slice(0, window.limit);
  if (!records.length) return <div className="module-empty"><Archive size={26} /><strong>{t("暂无历史整机记录")}</strong></div>;
  return <><ol className={styles.customerHistoryRows}>{visible.map(record => <li key={record.id}><CustomerHistoryRecordLink record={{...record,reviewCount:record.reviewReasons.length}} returnTo={returnTo}/></li>)}</ol><ListPagination shown={visible.length} total={records.length} hasMore={visible.length < records.length} onLoadMore={window.loadMore} resetKey={window.resetKey} label={t("客户历史整机加载")} /></>;
}
