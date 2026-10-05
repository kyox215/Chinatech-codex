"use client";

import { useLanguage } from "@/components/language-provider";
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
  const { t } = useLanguage();
  const { customers, ready, error } = useCustomerDirectory();
  const [query, setQuery] = useState("");
  const [adding, setAdding] = useState(false);
  const router = useRouter();
  const needle = query.trim().toLowerCase();
  const digits = query.replace(/\D/g, "");
  const filtered = customers.filter(customer => `${customer.name} ${customer.phone} ${customer.email}`.toLowerCase().includes(needle) || digits.length >= 3 && customer.phone.includes(digits));
  return <main className="module-page"><header className="module-heading"><PageTitle title={t("客户管理")} /><button className="button button--primary page-toolbar-action" type="button" aria-label={t("新建客户")} title={t("新建客户")} onClick={() => setAdding(true)}><Plus size={17} /><span>{t("新建客户")}</span></button></header>
    {error ? <p className="procurement-feedback procurement-feedback--error" role="alert">{t(error)}</p> : null}
    {adding ? <CustomerProfileForm onCancel={() => setAdding(false)} onSaved={phone => router.push(`/app/customers/${customerId(phone)}`)} /> : null}
    <section className={`panel ${styles.listPanel}`} aria-label={t("客户目录")}><div className={styles.listToolbar}><label className="module-search"><Search size={17} /><InputControl onClear={() => setQuery("")} clearLabel={t("清空搜索客户")} aria-label={t("搜索客户")} placeholder={t("搜索手机号、称呼或电子邮件")} value={query} onChange={event => setQuery(event.target.value)} /></label><span className={styles.count}>{filtered.length} {t(" 位客户")}</span></div>
      {!ready ? <div className="module-empty" role="status">{t("正在读取客户记录…")}</div> : !filtered.length ? <div className="module-empty"><UsersRound size={28} /><strong>{query ? t("没有匹配的客户") : t("暂无客户")}</strong>{query ? <button className="button button--secondary" type="button" onClick={() => setQuery("")}>{t("清空搜索")}</button> : null}</div> : <div className="module-table-scroll" role="region" aria-label={t("客户列表")} tabIndex={0}><div className={styles.tableHead}><span>{t("客户 / 手机号")}</span><span>{t("维修记录")}</span><span>{t("销售记录")}</span><span>{t("最后活动")}</span><span /></div>{filtered.map(customer => <Link className={styles.row} key={customer.id} href={`/app/customers/${customer.id}`}><span className={styles.identity}><span className={styles.avatar}><UsersRound size={19} /></span><span><strong>{customer.name || t("未填写称呼")}</strong><small>{customer.phone}</small></span></span><span className={styles.recordCount}><small>{t("维修")}</small>{customer.repairs.length} {t(" 条")}</span><span className={styles.recordCount}><small>{t("销售")}</small>{customer.sales.length} {t(" 条")}</span><span className={styles.activity}>{customer.lastActivity || t("暂无记录")}</span><ArrowRight size={17} /></Link>)}</div>}
    </section>
  </main>;
}
