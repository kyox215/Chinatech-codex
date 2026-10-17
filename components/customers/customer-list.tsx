"use client";

import { useLanguage } from "@/components/language-provider";
import { InputControl } from "@/components/input-control";
import { NavigationLink as Link } from "@/components/navigation-link";
import { useStoreRouter as useRouter } from "@/components/use-store-router";
import { useRef, useState } from "react";
import { ArrowRight, Plus, Search, UsersRound } from "lucide-react";
import { PageTitle } from "@/components/page-title";
import { customerId } from "@/lib/customers";
import { useCustomerDirectory } from "./customer-store";
import { CustomerProfileForm } from "./customer-profile-form";
import styles from "./customers.module.css";
import { useStaff } from "@/components/staff/use-staff";
import { ListPagination, listPageSize } from "@/components/list-pagination";
import { ReadFailure, ReadPending } from "@/components/page-recovery";

export function CustomerList() {
  const { t } = useLanguage();
  const { customers, ready, error } = useCustomerDirectory();
  const [query, setQuery] = useState("");
  const [page, setPage] = useState(1);
  const staff = useStaff();
  const canEdit = staff.can("customers.edit");
  const changeQuery = (value: string) => { setQuery(value); setPage(1); };
  const [adding, setAdding] = useState(false);
  const router = useRouter();
  const list = useRef<HTMLDivElement>(null);
  const changePage = (value: number) => { setPage(value); requestAnimationFrame(() => { list.current?.scrollIntoView({block:"start",behavior:"instant"}); list.current?.focus({preventScroll:true}); }); };
  const needle = query.trim().toLowerCase();
  const digits = query.replace(/\D/g, "");
  const filtered = customers.filter(customer => `${customer.name} ${customer.phone} ${customer.email}`.toLowerCase().includes(needle) || digits.length >= 3 && customer.phone.includes(digits));
  const pages = Math.max(1, Math.ceil(filtered.length / listPageSize));
  const currentPage = Math.min(page, pages);
  const visible = filtered.slice((currentPage - 1) * listPageSize, currentPage * listPageSize);
  return <main className="module-page"><header className="module-heading"><PageTitle title={t("客户管理")} />{canEdit ? <button className="button button--primary page-toolbar-action" type="button" aria-label={t("新建客户")} title={t("新建客户")} onClick={() => setAdding(true)}><Plus size={17} /><span>{t("新建客户")}</span></button> : null}</header>

    {adding && canEdit && !error ? <CustomerProfileForm onCancel={() => setAdding(false)} onSaved={phone => router.push(`/app/customers/${customerId(phone)}`)} /> : null}
    <section className={`panel ${styles.listPanel}`} aria-label={t("客户目录")}><div className={styles.listToolbar}><label className="module-search"><Search size={17} /><InputControl onClear={() => changeQuery("")} clearLabel={t("清空搜索客户")} aria-label={t("搜索客户")} placeholder={t("搜索手机号、称呼或电子邮件")} value={query} onChange={event => changeQuery(event.target.value)} /></label><span className={styles.count}>{!ready ? "—" : filtered.length} {t(" 位客户")}</span></div>
      {error ? <ReadFailure message={error} /> : null}{!ready ? <ReadPending label="正在读取客户记录…" /> : error && !filtered.length ? null : !filtered.length ? <div className="module-empty"><UsersRound size={28} /><strong>{query ? t("没有匹配的客户") : t("暂无客户")}</strong>{query ? <button className="button button--secondary" type="button" onClick={() => changeQuery("")}>{t("清空搜索")}</button> : null}</div> : <div ref={list} className="module-table-scroll" role="region" aria-label={t("客户列表")} tabIndex={0}><div className={styles.tableHead}><span>{t("客户 / 手机号")}</span><span>{t("维修记录")}</span><span>{t("销售记录")}</span><span>{t("最后活动")}</span><span /></div>{visible.map(customer => <Link className={styles.row} key={customer.id} href={`/app/customers/${customer.id}`} icon={<ArrowRight size={17} />} iconPosition="end"><span className={styles.identity}><span className={styles.avatar}><UsersRound size={19} /></span><span><strong>{customer.name || t("未填写称呼")}</strong><small>{customer.phone}</small></span></span><span className={styles.recordCount}><small>{t("维修")}</small>{customer.repairs.length} {t(" 条")}</span><span className={styles.recordCount}><small>{t("销售记录")}</small>{customer.sales.length} {t(" 条")}</span><span className={styles.activity}>{customer.lastActivity || t("暂无记录")}</span></Link>)}</div>}
      {ready && !error && <ListPagination page={currentPage} pages={pages} total={filtered.length} onChange={changePage} />}
    </section>
  </main>;
}
