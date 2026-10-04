"use client";

import { InputControl } from "@/components/input-control";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { ArrowRight, Plus, Search, UsersRound } from "lucide-react";
import { PageTitle } from "@/components/page-title";
import { customerId } from "@/lib/customers";
import { useCustomerDirectory } from "./customer-store";
import { CustomerProfileForm } from "./customer-profile-form";
import styles from "./customers.module.css";

export function CustomerList() {
  const { customers, ready, error } = useCustomerDirectory();
  const [query, setQuery] = useState("");
  const [adding, setAdding] = useState(false);
  const router = useRouter();
  const needle = query.trim().toLowerCase();
  const digits = query.replace(/\D/g, "");
  const filtered = customers.filter(customer => `${customer.name} ${customer.phone} ${customer.email}`.toLowerCase().includes(needle) || digits.length >= 3 && customer.phone.includes(digits));
  return <main className="module-page"><header className="module-heading"><PageTitle title="客户管理" /><button className="button button--primary page-toolbar-action" type="button" aria-label="新建客户" title="新建客户" onClick={() => setAdding(true)}><Plus size={17} /><span>新建客户</span></button></header>
    {error ? <p className="procurement-feedback procurement-feedback--error" role="alert">{error}</p> : null}
    {adding ? <CustomerProfileForm onCancel={() => setAdding(false)} onSaved={phone => router.push(`/app/customers/${customerId(phone)}`)} /> : null}
    <section className={`panel ${styles.listPanel}`} aria-label="客户目录"><div className={styles.listToolbar}><label className="module-search"><Search size={17} /><InputControl onClear={() => setQuery("")} clearLabel="清空搜索客户" aria-label="搜索客户" placeholder="搜索手机号、称呼或电子邮件" value={query} onChange={event => setQuery(event.target.value)} /></label><span className={styles.count}>{filtered.length} 位客户</span></div>
      {!ready ? <div className="module-empty" role="status">正在读取客户记录…</div> : !filtered.length ? <div className="module-empty"><UsersRound size={28} /><strong>{query ? "没有匹配的客户" : "暂无客户"}</strong>{query ? <button className="button button--secondary" type="button" onClick={() => setQuery("")}>清空搜索</button> : null}</div> : <div className="module-table-scroll" role="region" aria-label="客户列表" tabIndex={0}><div className={styles.tableHead}><span>客户 / 手机号</span><span>维修记录</span><span>销售记录</span><span>最后活动</span><span /></div>{filtered.map(customer => <Link className={styles.row} key={customer.id} href={`/app/customers/${customer.id}`}><span className={styles.identity}><span className={styles.avatar}><UsersRound size={19} /></span><span><strong>{customer.name || "未填写称呼"}</strong><small>{customer.phone}</small></span></span><span className={styles.recordCount}><small>维修</small>{customer.repairs.length} 条</span><span className={styles.recordCount}><small>销售</small>{customer.sales.length} 条</span><span className={styles.activity}>{customer.lastActivity || "暂无记录"}</span><ArrowRight size={17} /></Link>)}</div>}
    </section>
  </main>;
}
