"use client";

import { InputControl } from "@/components/input-control";
import Link from "next/link";
import { useMemo } from "react";
import { useSearchParams } from "next/navigation";
import { Archive, ChevronLeft, ChevronRight, Plus, Search, X } from "lucide-react";
import { PageTitle } from "@/components/page-title";
import { SelectControl } from "@/components/select-control";
import { useStaff } from "@/components/staff/use-staff";
import type { RetailHistoryRecord } from "@/lib/retail-history";
import type { RetailUnit } from "@/lib/retail";
import { buildRetailListIndex, defaultRetailListSort, queryRetailList, resolveRetailListSort, retailViewFromParams, retailViewLabels, type RetailView } from "@/lib/retail-list-model";
import { useRetail } from "./retail-provider";
import { historyDate, historyDetailHref, historyMoney } from "./retail-history-shared";
import styles from "./retail-history.module.css";
import listStyles from "./retail-list.module.css";
import surface from "./retail-surface.module.css";

export function RetailHistoryList({ records, units, ready, error }: { records: RetailHistoryRecord[]; units: RetailUnit[]; ready: boolean; error: string }) {
  const staff = useStaff();
  const { dispatch } = useRetail();
  const params = useSearchParams();
  const view = retailViewFromParams(params);
  const query = params.get("q") || "";
  const rawCondition = params.get("condition");
  const condition = rawCondition === "新机" || rawCondition === "翻新机" ? rawCondition : "all";
  const category = params.get("category") || "all";
  const review = params.get("review") === "pending";
  const defaultSort = defaultRetailListSort(view);
  const sort = resolveRetailListSort(view, params.get("sort"));
  const status = view === "other" ? params.get("status") || "all" : "all";
  const requestedPage = Number(params.get("page") || "1");
  // Project only list facts once per authorized dataset, not on every keystroke.
  const index = useMemo(() => buildRetailListIndex(units, records), [units, records]);
  const result = useMemo(() => queryRetailList(index, {view, condition, query, category, review, sort, status, page:requestedPage}),
    [index, view, condition, query, category, review, sort, status, requestedPage]);
  const listParams = new URLSearchParams(params.toString());
  listParams.delete("source");
  if(view === "available") listParams.delete("view"); else listParams.set("view",view);
  if(view !== "other") listParams.delete("status");
  if(result.page > 1) listParams.set("page",String(result.page)); else listParams.delete("page");
  const listUrl = `/app/retail${listParams.size ? `?${listParams}` : ""}`;
  const hasFilters = Boolean(query) || condition !== "all" || category !== "all" || status !== "all" || review || sort !== defaultSort;
  function update(key:string,value:string) {
    const next = new URLSearchParams(listParams);
    if(!value || value === "all" || key === "sort" && value === defaultSort) next.delete(key); else next.set(key,value);
    if(key !== "page") next.delete("page");
    window.history.replaceState(null,"",`/app/retail${next.size ? `?${next}` : ""}`);
  }
  const viewHref = (value:RetailView) => `/app/retail${value === "available" ? "" : `?view=${value}`}`;
  const clear = () => window.history.replaceState(null,"",viewHref(view));
  const remember = () => dispatch({type:"remember",url:listUrl,scroll:window.scrollY});
  return <main className={`module-page ${surface.page}`}>
    <header className="module-heading"><PageTitle title="整机商品" /><div className="module-heading__actions"><Link className="button button--secondary button--compact" href="/app/retail?source=units">单机管理</Link>{staff.can("retail.edit") ? <Link className="button button--primary button--compact" href="/app/retail/new"><Plus size={17} />新建单机</Link> : null}</div></header>
    <nav className={styles.sourceTabs} aria-label="整机销售状态">{(["available","sold","other"] as const).map(value => <Link key={value} href={viewHref(value)} aria-current={view === value ? "page" : undefined}>{retailViewLabels[value]} <span>{result.viewCounts[value]}</span></Link>)}</nav>
    {error ? <p className="procurement-feedback procurement-feedback--error" role="alert">{error}</p> : null}
    <section className={`panel ${styles.list}`} aria-label={retailViewLabels[view]}>
      <div className={`${listStyles.classification} ${styles.classificationBar}`} role="group" aria-label="商品分类筛选">{(["all","新机","翻新机"] as const).map(value => <button key={value} type="button" className={condition === value ? listStyles.classificationActive : ""} aria-pressed={condition === value} onClick={() => update("condition",value)}><span>{value === "all" ? "全部" : value}</span><small>{result.conditionCounts[value]}</small></button>)}</div>
      <div className={styles.toolbar}>
        <label className={`module-search ${styles.search}`}><Search size={18} /><InputControl onClear={() => update("q","")} clearLabel="清空搜索整机商品" type="search" aria-label="搜索整机商品" value={query} onChange={event => update("q",event.target.value)} placeholder="型号、号码、识别码、颜色、容量、问题或日期" /></label>
        <div className={styles.filters}>
          <label className="module-select"><SelectControl aria-label="商品类型筛选" value={category} onChange={event => update("category",event.target.value)}><option value="all">全部类型</option>{result.categories.map(value => <option key={value} value={value}>{value}</option>)}</SelectControl></label>
          {view === "other" ? <label className="module-select"><SelectControl aria-label="其他状态筛选" value={status} onChange={event => update("status",event.target.value)}><option value="all">全部其他状态</option>{result.statuses.map(value => <option key={value} value={value}>{value}</option>)}</SelectControl></label> : null}
          <label className="module-select"><SelectControl aria-label="整机核对筛选" value={review ? "pending" : "all"} onChange={event => update("review",event.target.value)}><option value="all">全部核对状态</option><option value="pending">待核对</option></SelectControl></label>
          <label className="module-select"><SelectControl aria-label="整机排序" value={sort} onChange={event => update("sort",event.target.value)}><option value="name-asc">名称 A–Z</option>{view === "sold" ? <option value="sold-newest">最近售出</option> : null}<option value="newest">最近入库</option><option value="oldest">最早入库</option><option value="price-asc">标价升序</option><option value="price-desc">标价降序</option></SelectControl></label>
        </div>
      </div>
      <div className={styles.summary}><span>{retailViewLabels[view]} · {result.total} 条{condition !== "all" ? ` · ${condition}` : ""}</span>{hasFilters ? <button type="button" onClick={clear}><X size={15} />清除筛选</button> : null}</div>
      {!ready ? <div className="module-empty" role="status">正在读取整机商品…</div> : <>
        <div className={`module-table-scroll ${styles.table}`} role="region" aria-label="整机商品表格" tabIndex={0}>
          <div className={styles.tableHead} aria-hidden="true"><span>商品 / 规格</span><span>客户 / 识别码</span><span>入库 / 拿走日期</span><span>标价 / 成交价</span><span>状态</span><span /></div>
          {result.items.map(item => <Link className={`${styles.row}${!item.phone?.trim() && !item.identifier?.trim() ? ` ${styles.rowWithoutIdentity}` : ""}`} href={item.source === "history" ? historyDetailHref(item.id,listUrl) : `/app/retail/units/${encodeURIComponent(item.id)}`} onClick={remember} key={item.key}>
            <div className={styles.product}><strong>{item.title}</strong>{item.color?.trim() || item.specification?.trim() ? <small>{[item.color, item.specification].filter(value => value?.trim()).join(" · ")}</small> : null}</div>
            <div className={styles.identity}>{item.phone?.trim() ? <span>{item.phone}</span> : null}{item.identifier?.trim() ? <small>{item.identifier}</small> : null}</div>
            <div className={styles.dates}>{item.intakeDate ? <span><span className={styles.mobileLabel}>入库 </span>{historyDate(item.intakeDate)}</span> : null}{item.pickupDate ? <small><span className={styles.mobileLabel}>拿走 </span>{historyDate(item.pickupDate)}</small> : null}</div>
            <div className={styles.money}>{item.priceCents !== null ? <span><span className={styles.mobileLabel}>标价 </span>{historyMoney(item.priceCents)}</span> : null}{item.salePriceCents !== null ? <small><span className={styles.mobileLabel}>成交 </span>{historyMoney(item.salePriceCents)}</small> : null}</div>
            <div className={styles.states}><span className={`status-pill status-pill--${view === "available" ? "success" : view === "sold" ? "info" : "progress"} ${styles.status}`}>{item.status}</span>{item.reviewCount > 0 ? <span className={styles.review}>待核对 · {item.reviewCount}</span> : null}</div><ChevronRight className={styles.arrow} size={17} />
          </Link>)}
        </div>
        {!result.total ? <div className="module-empty"><Archive size={28} /><strong>{hasFilters ? "没有符合条件的商品" : view === "available" ? "暂无在售商品" : view === "sold" ? "暂无已售记录" : "暂无其他状态商品"}</strong>{hasFilters ? <button type="button" className="button button--secondary" onClick={clear}>清除筛选</button> : null}</div> : null}
        <nav className={styles.pagination} aria-label="整机商品分页"><span aria-live="polite">第 {result.page} / {result.pageCount} 页 · 每页 50 条</span><div><button className="button button--secondary" type="button" aria-label="整机商品上一页" disabled={result.page <= 1} onClick={() => update("page",String(result.page-1))}><ChevronLeft size={17} />上一页</button><button className="button button--secondary" type="button" aria-label="整机商品下一页" disabled={result.page >= result.pageCount} onClick={() => update("page",String(result.page+1))}>下一页<ChevronRight size={17} /></button></div></nav>
      </>}
    </section>
  </main>;
}
