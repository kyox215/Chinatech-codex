"use client";

import Link from "next/link";
import type { ReactNode } from "react";
import { useSearchParams } from "next/navigation";
import { AlertTriangle, Archive, CalendarDays, CircleEuro, Smartphone, UserRound } from "lucide-react";
import { PageTitle } from "@/components/page-title";
import { useStaff } from "@/components/staff/use-staff";
import { customerId } from "@/lib/customers";
import { retailHistoryCode } from "@/lib/retail-history";
import { useRetailHistory } from "./retail-history-store";
import { historyDate, historyMoney, historyReturnHref, historyText, historyTitle, RetailHistoryStatus } from "./retail-history-shared";
import styles from "./retail-history.module.css";
import surface from "./retail-surface.module.css";

export function RetailHistoryDetail({ id }: { id: string }) {
  const { records, ready, error } = useRetailHistory();
  const staff = useStaff();
  const params = useSearchParams();
  const record = records.find(item => item.id === id);
  const fallback = record?.sourceStatus === "在售" ? "/app/retail" : record?.sourceStatus === "以售" || record?.sourceStatus === "已售" ? "/app/retail?view=sold" : "/app/retail?view=other";
  const backHref = historyReturnHref(params.get("returnTo") || fallback);
  if (!ready || !record || !staff.can("retail.view")) return <main className={`module-page ${surface.page}`}><header className="module-heading"><PageTitle title="历史整机" backHref={backHref} backLabel="返回整机记录" /></header>{error ? <p className="procurement-feedback procurement-feedback--error" role="alert">{error}</p> : null}<div className="panel module-empty">{!ready ? <strong role="status">正在读取历史整机…</strong> : <><Archive size={28} /><strong>{!staff.can("retail.view") ? "当前账号无权查看整机记录" : "没有找到历史整机记录"}</strong><Link href={backHref} className="button button--secondary">返回记录列表</Link></>}</div></main>;
  let customerHref: string | null = null;
  if (record.customerPhone) { try { customerHref = `/app/customers/${customerId(record.customerPhone)}?records=history`; } catch { /* Preserve an invalid original phone as text. */ } }
  const fact = (label: string, value: ReactNode, wide = false) => <div className={wide ? styles.factWide : undefined} key={label}><dt>{label}</dt><dd>{value}</dd></div>;
  return <main className={`module-page ${surface.page}`}>
    <header className="module-heading"><PageTitle title={historyTitle(record)} backHref={backHref} backLabel={backHref.startsWith("/app/customers/") ? "返回客户档案" : "返回整机商品"} badge={<RetailHistoryStatus record={record} />} subtitle={`${retailHistoryCode(record)} · ${record.condition}`} /></header>
    {error ? <p className="procurement-feedback procurement-feedback--error" role="alert">{error}</p> : null}
    {record.reviewReasons.length ? <section className={`panel ${styles.reviewPanel}`} aria-label="历史资料待核对"><h3><AlertTriangle size={18} />待核对 · {record.reviewReasons.length}</h3><ul>{record.reviewReasons.map((reason, index) => <li key={`${index}:${reason}`}>{reason}</li>)}</ul></section> : null}
    <div className={styles.detailLayout}>
      <div className={styles.detailColumn}>
        <section className="panel"><div className={`detail-section__head ${surface.sectionHead}`}><div><span><Smartphone size={18} /></span><h3>商品资料</h3></div></div><dl className={styles.facts}>
          {fact("原状态", historyText(record.sourceStatus))}{fact("商品分类", record.condition)}
          {fact("商品类别", historyText(record.category))}{fact("品牌", historyText(record.brand))}
          {fact("型号 / 商品名称", historyText(record.model), true)}{fact("颜色", historyText(record.color))}{fact("内存 / 容量原文", historyText(record.memory))}
          {fact("IMEI / 序列号原文", historyText(record.identifier), true)}{fact("电池健康", record.batteryPercent === null ? "未记录" : `${record.batteryPercent}%`)}
        </dl></section>
        <section className="panel"><div className={`detail-section__head ${surface.sectionHead}`}><div><span><Archive size={18} /></span><h3>问题与备注</h3></div></div><p className={styles.notes}>{staff.can("financial.read") ? historyText(record.notes) : "需财务权限查看原备注"}</p></section>
      </div>
      <div className={styles.detailColumn}>
        <section className="panel"><div className={`detail-section__head ${surface.sectionHead}`}><div><span><UserRound size={18} /></span><h3>客户资料</h3></div></div><dl className={styles.facts}>{fact("客户称呼", historyText(record.customerName))}{fact("客户号码", customerHref ? <Link className={styles.customerLink} href={customerHref}>{record.customerPhone}</Link> : historyText(record.customerPhone))}</dl></section>
        <section className="panel"><div className={`detail-section__head ${surface.sectionHead}`}><div><span><CircleEuro size={18} /></span><h3>原金额记录</h3></div></div><dl className={styles.facts}>
          {fact("标价", historyMoney(record.askingPriceCents))}{fact("最终成交价", historyMoney(record.salePriceCents))}
          {fact("已付定金", historyMoney(record.depositCents))}{fact("支付方式原文", historyText(record.paymentMethod))}
          {staff.can("financial.read") ? fact("成本", historyMoney(record.costCents)) : null}
        </dl><p className={styles.note}>定金不代表全部实收。</p></section>
        <section className="panel"><div className={`detail-section__head ${surface.sectionHead}`}><div><span><CalendarDays size={18} /></span><h3>日期与来源</h3></div></div><dl className={styles.facts}>
          {fact("入库日期", historyDate(record.intakeAt, true))}{fact("实际拿走日期", historyDate(record.pickupDate))}
          {fact("原时间记录（列 1）", historyDate(record.sourceUpdatedAt, true), true)}
          {fact("来源", "SeaTable · 电子产品")}{fact("源表行号", String(record.sourceRow))}
          {fact("历史记录编号", retailHistoryCode(record))}{fact("导入时间", historyDate(record.importedAt, true))}
        </dl></section>
      </div>
    </div>
  </main>;
}
