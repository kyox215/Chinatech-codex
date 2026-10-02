"use client";

import Link from "next/link";
import { useMemo, type ReactNode } from "react";
import { useSearchParams } from "next/navigation";
import { Archive, ChevronLeft, ChevronRight, Plus, Search, X } from "lucide-react";
import { PageTitle } from "@/components/page-title";
import { SelectControl } from "@/components/select-control";
import { useStaff } from "@/components/staff/use-staff";
import { retailHistoryCode, retailHistorySearch, type RetailHistoryRecord } from "@/lib/retail-history";
import { historyDate, historyDetailHref, historyMoney, historyText, historyTitle, RetailHistoryStatus } from "./retail-history-shared";
import styles from "./retail-history.module.css";
import surface from "./retail-surface.module.css";

const pageSize = 50;
const sourceStatuses = ["在售", "以售", "分期中", "处理中", "到货已通知", "同行", "作废"];

export function RetailHistoryList({ records, ready, error, sourceTabs }: { records: RetailHistoryRecord[]; ready: boolean; error: string; sourceTabs: ReactNode }) {
  const staff = useStaff();
  const params = useSearchParams();
  const query = params.get("q") || "";
  const status = params.get("status") || "all";
  const category = params.get("category") || "all";
  const review = params.get("review") === "pending";
  const oldest = params.get("sort") === "oldest";
  const categories = useMemo(() => [...new Set(records.map(record => record.category).filter((value): value is string => Boolean(value)))].sort((a, b) => a.localeCompare(b)), [records]);
  const filtered = useMemo(() => records.filter(record => retailHistorySearch(record, query)
    && (status === "all" || (status === "unknown" ? !sourceStatuses.includes(record.sourceStatus || "") : record.sourceStatus === status))
    && (category === "all" || (category === "unknown" ? !record.category : record.category === category))
    && (!review || record.reviewReasons.length > 0))
    .sort((a, b) => (a.intakeAt.localeCompare(b.intakeAt) || a.sourceRow - b.sourceRow) * (oldest ? 1 : -1)), [records, query, status, category, review, oldest]);
  const pageCount = Math.max(1, Math.ceil(filtered.length / pageSize));
  const requestedPage = Number(params.get("page") || "1");
  const page = Math.min(pageCount, Number.isSafeInteger(requestedPage) && requestedPage > 0 ? requestedPage : 1);
  const visible = filtered.slice((page - 1) * pageSize, page * pageSize);
  const listParams = new URLSearchParams(params.toString());
  listParams.set("source", "history");
  if (page > 1) listParams.set("page", String(page)); else listParams.delete("page");
  const listUrl = `/app/retail?${listParams.toString()}`;
  const hasFilters = Boolean(query) || status !== "all" || category !== "all" || review || oldest;
  function update(key: string, value: string) {
    const next = new URLSearchParams(params.toString());
    next.set("source", "history");
    if (!value || value === "all" || key === "sort" && value === "newest") next.delete(key); else next.set(key, value);
    if (key !== "page") next.delete("page");
    window.history.replaceState(null, "", `/app/retail?${next.toString()}`);
  }
  const clear = () => window.history.replaceState(null, "", "/app/retail?source=history");
  return <main className={`module-page ${surface.page}`}>
    <header className="module-heading"><PageTitle title="整机商品" />{staff.can("retail.edit") ? <Link className="button button--primary button--compact" href="/app/retail/new"><Plus size={17} />新建单机</Link> : null}</header>
    {sourceTabs}
    {error ? <p className="procurement-feedback procurement-feedback--error" role="alert">{error}</p> : null}
    <section className={`panel ${styles.list}`} aria-label="历史整机">
      <div className={styles.toolbar}>
        <label className={`module-search ${styles.search}`}><Search size={18} /><input type="search" aria-label="搜索历史整机" value={query} onChange={event => update("q", event.target.value)} placeholder="型号、号码、识别码、颜色、内存、问题或日期" /></label>
        <div className={styles.filters}>
          <label className="module-select"><SelectControl aria-label="历史整机状态筛选" value={status} onChange={event => update("status", event.target.value)}><option value="all">全部状态</option>{sourceStatuses.map(value => <option key={value} value={value}>{value === "以售" ? "已售" : value}</option>)}<option value="unknown">状态待核对</option></SelectControl></label>
          <label className="module-select"><SelectControl aria-label="历史整机类别筛选" value={category} onChange={event => update("category", event.target.value)}><option value="all">全部类别</option>{categories.map(value => <option key={value} value={value}>{value}</option>)}<option value="unknown">类别未记录</option></SelectControl></label>
          <label className="module-select"><SelectControl aria-label="历史整机核对筛选" value={review ? "pending" : "all"} onChange={event => update("review", event.target.value)}><option value="all">全部核对状态</option><option value="pending">待核对</option></SelectControl></label>
          <label className="module-select"><SelectControl aria-label="历史整机排序" value={oldest ? "oldest" : "newest"} onChange={event => update("sort", event.target.value)}><option value="newest">最近入库</option><option value="oldest">最早入库</option></SelectControl></label>
        </div>
      </div>
      <div className={styles.summary}><span>{ready ? `${filtered.length} 条历史记录` : "正在读取…"} · 翻新机</span>{hasFilters ? <button type="button" onClick={clear}><X size={15} />清除筛选</button> : null}</div>
      {!ready ? <div className="module-empty" role="status">正在读取历史整机…</div> : <>
        <div className={`module-table-scroll ${styles.table}`} role="region" aria-label="历史整机表格" tabIndex={0}>
          <div className={styles.tableHead} aria-hidden="true"><span>商品 / 规格</span><span>客户 / 识别码</span><span>入库 / 拿走日期</span><span>标价 / 成交价</span><span>原状态</span><span /></div>
          {visible.map(record => <Link className={styles.row} href={historyDetailHref(record.id, listUrl)} key={record.id}>
            <div className={styles.product}><strong>{historyTitle(record)}</strong><small>{historyText(record.color)} · {historyText(record.memory)}</small><small>{retailHistoryCode(record)} · {historyText(record.category)}</small></div>
            <div className={styles.identity}><span>{historyText(record.customerPhone)}</span><small>{historyText(record.identifier)}</small></div>
            <div className={styles.dates}><span><span className={styles.mobileLabel}>入库 </span>{historyDate(record.intakeAt)}</span><small><span className={styles.mobileLabel}>拿走 </span>{historyDate(record.pickupDate)}</small></div>
            <div className={styles.money}><span><span className={styles.mobileLabel}>标价 </span>{historyMoney(record.askingPriceCents)}</span><small><span className={styles.mobileLabel}>成交 </span>{historyMoney(record.salePriceCents)}</small></div>
            <div className={styles.states}><RetailHistoryStatus record={record} />{record.reviewReasons.length > 0 ? <span className={styles.review}>待核对 · {record.reviewReasons.length}</span> : null}</div><ChevronRight className={styles.arrow} size={17} />
          </Link>)}
        </div>
        {!filtered.length ? <div className="module-empty"><Archive size={28} /><strong>{records.length ? "没有符合条件的历史整机" : "暂无历史整机记录"}</strong>{hasFilters ? <button type="button" className="button button--secondary" onClick={clear}>清除筛选</button> : null}</div> : null}
        <nav className={styles.pagination} aria-label="历史整机分页"><span aria-live="polite">第 {page} / {pageCount} 页 · 每页 {pageSize} 条</span><div><button className="button button--secondary" type="button" aria-label="历史整机上一页" disabled={page <= 1} onClick={() => update("page", String(page - 1))}><ChevronLeft size={17} />上一页</button><button className="button button--secondary" type="button" aria-label="历史整机下一页" disabled={page >= pageCount} onClick={() => update("page", String(page + 1))}>下一页<ChevronRight size={17} /></button></div></nav>
      </>}
    </section>
  </main>;
}
