"use client";

import { useStaff } from "@/components/staff/use-staff";
import Link from "next/link";
import { Suspense, useState } from "react";
import { useSearchParams } from "next/navigation";
import { ArrowRight, FileClock, Pencil, Phone, ShoppingBag, UsersRound, Wrench } from "lucide-react";
import { PageTitle } from "@/components/page-title";
import { retailMoney } from "@/lib/retail";
import { useCustomerDirectory } from "./customer-store";
import { CustomerProfileForm } from "./customer-profile-form";
import { RetailHistoryCustomerRecords } from "@/components/retail/retail-history-customer-records";
import historyStyles from "@/components/retail/retail-history.module.css";
import styles from "./customers.module.css";

export function CustomerDetail({ id }: { id: string }) {
  return <Suspense fallback={<main className="module-page"><header className="module-heading"><PageTitle title="客户档案" backHref="/app/customers" backLabel="返回客户列表" /></header><div className="panel module-empty" role="status">正在读取客户记录…</div></main>}><CustomerDetailContent id={id} /></Suspense>;
}

function CustomerDetailContent({ id }: { id: string }) {
  const staff=useStaff();
  const { customers, ready, error } = useCustomerDirectory();
  const [editing, setEditing] = useState(false);
  const params = useSearchParams();
  const [saved, setSaved] = useState(false);
  const customer = customers.find(item => item.id === id);
  const selected = params.get("records");
  const recordType = selected === "history" || selected === "sales" || selected === "repairs" ? selected : customer?.repairs.length ? "repairs" : customer?.sales.length ? "sales" : customer?.history.length ? "history" : "repairs";
  function setRecordType(value: "repairs" | "sales" | "history") {
    const next = new URLSearchParams(params.toString()); next.set("records", value);
    window.history.replaceState(null, "", `/app/customers/${encodeURIComponent(id)}?${next.toString()}`);
  }
  if (!ready || !customer) return <main className="module-page"><header className="module-heading"><PageTitle title="客户档案" backHref="/app/customers" backLabel="返回客户列表" /></header>{error ? <p className="procurement-feedback procurement-feedback--error" role="alert">{error}</p> : null}<div className="panel module-empty">{!ready ? <strong role="status">正在读取客户记录…</strong> : <><UsersRound size={28} /><strong>没有找到客户档案</strong><Link className="button button--primary" href="/app/customers">返回客户列表</Link></>}</div></main>;
  return <main className="module-page"><header className="module-heading"><PageTitle title={customer.name || "客户档案"} backHref="/app/customers" backLabel="返回客户列表" />{staff.can("customers.edit")?<button className="button button--secondary page-toolbar-action" type="button" aria-label="编辑客户资料" title="编辑客户资料" onClick={() => { setEditing(true); setSaved(false); }}><Pencil size={17} /><span>编辑资料</span></button>:null}</header>
    {error ? <p className="procurement-feedback procurement-feedback--error" role="alert">{error}</p> : null}{saved ? <p className="procurement-feedback" role="status">客户资料已保存到当前浏览器。</p> : null}
    <div className={styles.detailLayout}><aside className={styles.profileSide}>{editing ? <CustomerProfileForm customer={customer} onCancel={() => setEditing(false)} onSaved={() => { setEditing(false); setSaved(true); }} /> : <section className="panel detail-section"><div className="detail-section__head"><div><span><UsersRound size={18} /></span><h3>客户资料</h3></div></div><div className="device-facts"><span className="device-facts__wide"><small>手机号</small><strong><a className={styles.phoneLink} href={`tel:${customer.phone}`}><Phone size={15} />{customer.phone}</a></strong></span><span className="device-facts__wide"><small>客户称呼</small><strong>{customer.name || "未填写"}</strong></span><span className="device-facts__wide"><small>电子邮件</small><strong>{customer.email || "未填写"}</strong></span><span className="device-facts__wide"><small>客户备注</small><strong>{customer.note || "未填写"}</strong></span></div></section>}</aside>
      <section className={`panel ${styles.recordsPanel}`} aria-label="客户历史记录"><div className={`${styles.recordTabs} ${historyStyles.customerTabs}`}><button type="button" aria-pressed={recordType === "repairs"} onClick={() => setRecordType("repairs")}><Wrench size={17} />维修记录 <span>{customer.repairs.length}</span></button><button type="button" aria-pressed={recordType === "sales"} onClick={() => setRecordType("sales")}><ShoppingBag size={17} />销售记录 <span>{customer.sales.length}</span></button><button type="button" aria-pressed={recordType === "history"} onClick={() => setRecordType("history")}><FileClock size={17} />历史整机 <span>{customer.history.length}</span></button></div>
        {recordType === "history" ? <RetailHistoryCustomerRecords records={customer.history} returnTo={`/app/customers/${encodeURIComponent(id)}?records=history`} /> : recordType === "repairs" ? customer.repairs.length ? <ol className={styles.recordList}>{customer.repairs.map(repair => <li key={repair.id}><Link href={`/app/repairs/${repair.id}`} className={styles.recordLink}><span className={styles.recordIcon}><Wrench size={18} /></span><span className={styles.recordInfo}><strong>{repair.device.brand} {repair.device.model}</strong><small>{repair.id} · {repair.createdAt}</small><p>{repair.issue}</p><span className={`status-pill status-pill--${repair.tone}`}>{repair.statusLabel}</span></span><ArrowRight size={17} /></Link></li>)}</ol> : <div className="module-empty"><FileClock size={26} /><strong>暂无维修记录</strong></div> : customer.sales.length ? <ol className={styles.recordList}>{customer.sales.map(sale => <li key={`${sale.unitId}:${sale.id}`}><Link href={`/app/retail/units/${sale.unitId}`} className={styles.recordLink}><span className={styles.recordIcon}><ShoppingBag size={18} /></span><span className={styles.recordInfo}><strong>{sale.deviceName}</strong><small>{sale.unitCode} · {sale.time}</small><p>成交 {retailMoney(sale.priceCents)} · {sale.paidCents === null ? "收款未确认" : `实收 ${retailMoney(sale.paidCents)}`} · {sale.delivered ? "已交付" : "交付未确认"}</p><span className="status-pill status-pill--info">{sale.returned?"已退回":"已售出"}{sale.refundedCents?" · 已退款 "+retailMoney(sale.refundedCents):""}{sale.afterSaleCount?" · 售后 "+sale.afterSaleCount+" 次":""}</span></span><ArrowRight size={17} /></Link></li>)}</ol> : <div className="module-empty"><ShoppingBag size={26} /><strong>暂无销售记录</strong></div>}
      </section>
    </div>
  </main>;
}
