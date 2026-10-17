"use client";

import { useLanguage } from "@/components/language-provider";
import { InputControl } from "@/components/input-control";
import { NavigationLink as Link } from "@/components/navigation-link";
import { useSearchParams, useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { ArrowRight, Plus, Search, UsersRound } from "lucide-react";
import { PageTitle } from "@/components/page-title";
import { customerId } from "@/lib/customers";
import { useCustomerDirectory } from "./customer-store";
import { CustomerProfileForm } from "./customer-profile-form";
import styles from "./customers.module.css";
import { useStaff } from "@/components/staff/use-staff";
import { ListPagination, useListWindow } from "@/components/list-pagination";
import { ReadFailure, ReadPending } from "@/components/page-recovery";
import { useBackendState } from "@/components/backend-snapshot";
import type { CustomerListSummary } from "@/lib/backend/customer-list-contract";
import { backendSnapshot, subscribeBackend } from "@/lib/backend/client";
import { backendScopeKey } from "@/lib/backend/read-plan";
import { bindCustomerListPosition, rememberCustomerListPosition, customerListLocation } from "@/lib/customer-list-location";
import { WindowedListRows } from "@/components/windowed-list-rows";
import { useCustomerListPage } from "./use-customer-list-page";

export function CustomerList() {
  const backend=useBackendState();
  return backend.formal && backend.snapshot?.customerListEnabled ? <FormalCustomerList /> : <LegacyCustomerList />;
}
function FormalCustomerList() {
  const params=useSearchParams(),query=params.get("q")??"";
  const setQuery=(value:string)=>{const next=new URLSearchParams();if(value)next.set("q",value);window.history.replaceState(null,"","/app/customers"+(next.size?"?"+next:""));};
  const rawAnchor=params.get("anchor"),returnAnchor=rawAnchor&&/^\+[1-9]\d{6,14}$/.test(rawAnchor)?rawAnchor:undefined;
  const list=useCustomerListPage(query,"directory",returnAnchor), staff=useStaff();
  useEffect(()=>bindCustomerListPosition(()=>{const scope=backendSnapshot()?.read?.scope;return scope?backendScopeKey(scope):null;},subscribeBackend),[]);
  if(!staff.can("customers.view"))return <CustomerListBody query={query} setQuery={setQuery} visible={[]} total={0} shown={0} ready error="当前账号没有此操作权限。" hasMore={false} loadMore={()=>{}} resetKey={list.resetKey}/>;
  return <CustomerListBody query={query} setQuery={setQuery} visible={list.page?.items??[]} total={list.page?.total??0} shown={(list.page?.items.length??0)+list.removed} ready={Boolean(list.page)} error={list.error} pending={list.pending} hasMore={Boolean(list.page?.nextCursor) && list.page?.query.q===query.trim()&&query.length<=160} loadMore={list.loadMore} retry={list.retry} startIndex={list.page?.startIndex??0} extent={list.extent} windowKey={list.page?JSON.stringify([list.page.scope,list.page.query]):list.resetKey} windowVersion={list.page?.stateToken} onAnchor={list.rememberAnchor} onSeek={list.seek} loadPrevious={!list.error&&list.page?.previousCursor?list.loadPrevious:undefined} resetKey={list.resetKey}/>;
}
function LegacyCustomerList() {
  const {customers,ready,error}=useCustomerDirectory();
  const [query,setQuery]=useState("");
  const needle=query.trim().toLowerCase(),digits=query.replace(/\D/g,"");
  const filtered=customers.filter(customer=>`${customer.name} ${customer.phone} ${customer.email}`.toLowerCase().includes(needle)||digits.length>=3&&customer.phone.includes(digits));
  const window=useListWindow(filtered.length,query);
  const visible=filtered.slice(0,window.limit).map(customer=>({id:customer.id,phone:customer.phone,name:customer.name,email:customer.email,repairCount:customer.repairs.length,saleCount:customer.sales.length,historyCount:customer.history.length,lastActivity:customer.lastActivity}));
  return <CustomerListBody query={query} setQuery={setQuery} visible={visible} total={filtered.length} shown={visible.length} ready={ready} error={error} hasMore={visible.length<filtered.length} loadMore={window.loadMore} resetKey={window.resetKey}/>;
}
function CustomerListBody({query,setQuery,visible,total,shown,ready,error,pending=false,hasMore,loadMore,retry,resetKey,startIndex=0,extent,windowKey,windowVersion,onAnchor,onSeek,loadPrevious}:{query:string;setQuery:(value:string)=>void;visible:CustomerListSummary[];total:number;shown:number;ready:boolean;error:string;pending?:boolean;hasMore:boolean;loadMore:()=>void;retry?:()=>void;resetKey:string;startIndex?:number;extent?:number;windowKey?:string;windowVersion?:string;onAnchor?:(phone:string)=>void;onSeek?:(index:number)=>void;loadPrevious?:()=>void}) {
  const {t}=useLanguage(),staff=useStaff(),router=useRouter(),params=useSearchParams(),backend=useBackendState();
  const rawAnchor=params.get("anchor"),initialAnchor=rawAnchor&&/^\+[1-9]\d{6,14}$/.test(rawAnchor)?rawAnchor:null, rawOffset=Number(params.get("offset")??0),initialOffset=Number.isFinite(rawOffset)?Math.max(-2000,Math.min(2000,rawOffset)):0;
  const [adding,setAdding]=useState(false),canEdit=staff.can("customers.edit");
  return <main className="module-page"><header className="module-heading"><PageTitle title={t("客户管理")}/>{canEdit?<button className="button button--primary page-toolbar-action" type="button" aria-label={t("新建客户")} title={t("新建客户")} onClick={()=>setAdding(true)}><Plus size={17}/><span>{t("新建客户")}</span></button>:null}</header>
    {adding&&canEdit&&!error?<CustomerProfileForm onCancel={()=>setAdding(false)} onSaved={phone=>router.push(`/app/customers/${customerId(phone)}`)}/>:null}
    <section className={`panel ${styles.listPanel}`} aria-label={t("客户目录")}><div className={styles.listToolbar}><label className="module-search"><Search size={17}/><InputControl onClear={()=>setQuery("")} clearLabel={t("清空搜索客户")} aria-label={t("搜索客户")} maxLength={160} placeholder={t("搜索手机号、称呼或电子邮件")} value={query} onChange={event=>setQuery(event.target.value)}/></label><span className={styles.count}>{!ready?"—":total} {t(" 位客户")}</span></div>
      {error?<ReadFailure message={error} onRetry={retry} pending={pending}/>:null}{!ready?(pending?<ReadPending label="正在读取客户记录…"/>:null):error&&!visible.length?null:!visible.length?<div className="module-empty"><UsersRound size={28}/><strong>{query?t("没有匹配的客户"):t("暂无客户")}</strong>{query?<button className="button button--secondary" type="button" onClick={()=>setQuery("")}>{t("清空搜索")}</button>:null}</div>:<div className="module-table-scroll" role="region" aria-label={t("客户列表")} tabIndex={0}><div className={styles.tableHead}><span>{t("客户 / 手机号")}</span><span>{t("维修记录")}</span><span>{t("销售记录")}</span><span>{t("最后活动")}</span><span/></div><WindowedListRows active={!backend.formal||backend.active} key={windowKey??resetKey} items={visible} startIndex={startIndex} total={total} extent={extent} version={windowVersion} initialAnchor={initialAnchor?"PHONE-"+initialAnchor.slice(1):undefined} initialOffset={initialOffset} rowKey={row=>row.id} pending={pending} onSeek={onSeek} onLoadPrevious={loadPrevious} onAnchor={row=>onAnchor?.(row.phone)} render={(customer,rowProps)=><Link {...rowProps} className={styles.row} key={customer.id} id={`customer-${customer.id}`} href={`/app/customers/${customer.id}?returnTo=${encodeURIComponent(customerListLocation(query,customer.phone))}`} onClick={event=>{const offset=event.currentTarget.getBoundingClientRect().top,scope=backend.snapshot?.read?.scope;if(scope)rememberCustomerListPosition(backendScopeKey(scope),query,customer.phone,offset);window.history.replaceState(null,"",customerListLocation(query,customer.phone,offset));}} icon={<ArrowRight size={17}/>} iconPosition="end"><span className={styles.identity}><span className={styles.avatar}><UsersRound size={19}/></span><span><strong>{customer.name||t("未填写称呼")}{customer.namePreview?"…":""}</strong><small>{customer.phone}</small></span></span><span className={styles.recordCount}><small>{t("维修")}</small>{customer.repairCount} {t(" 条")}</span><span className={styles.recordCount}><small>{t("销售记录")}</small>{customer.saleCount} {t(" 条")}</span><span className={styles.activity}>{customer.lastActivity||t("暂无记录")}</span></Link>}/></div>}
      {ready?<ListPagination start={startIndex} shown={shown} total={total} hasMore={hasMore} onLoadMore={loadMore} loading={pending} error={Boolean(error)} resetKey={resetKey}/>:null}
    </section>
  </main>;
}
