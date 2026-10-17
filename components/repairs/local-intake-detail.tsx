"use client";
import{safeCustomerRecordLocation,customerRecordReturnPosition}from"@/lib/customer-record-location";
import {useSearchParams} from "next/navigation";
import {useBackendState} from "@/components/backend-snapshot";
import {backendScopeKey} from "@/lib/backend/read-plan";
import {repairListReturnPosition,safeRepairListLocation} from "@/lib/repair-list-location";
import { ReadPending } from "@/components/page-recovery";
import { customerSaleHref } from "@/lib/customers";
import { useLanguage } from "@/components/language-provider";
import { useBackendMode } from "@/components/backend-snapshot";
import { NavigationLink as Link } from "@/components/navigation-link";
import { useRef, useState } from "react";
import { Printer, CircleAlert } from "lucide-react";
import { PageTitle } from "@/components/page-title";
import { RepairReworkControl } from "./repair-rework-control";
import { useRepairDirectory, useLocalIntakes } from "./local-intake-store";
import { RepairDetailWorkspace } from "./repair-detail-workspace";
import { useStaff } from "@/components/staff/use-staff";
import styles from "./repair-detail-workspace.module.css";
import { IntakeReceipt } from "./intake-receipt";

export function LocalIntakeDetail({ id }: { id: string }) {
  const backend=useBackendState(),params=useSearchParams(),scope=backend.snapshot?.read?.scope,customerReturn=safeCustomerRecordLocation(params.get("returnTo")),returnTo=(customerReturn?(scope?customerRecordReturnPosition(backendScopeKey(scope),`/app/repairs/${encodeURIComponent(id)}`):null)??customerReturn:null)??(scope?repairListReturnPosition(backendScopeKey(scope),id):null)??safeRepairListLocation(params.get("returnTo"));
  const formal = useBackendMode();
  const staff = useStaff();
  const { t , systemText } = useLanguage();
  const { records, ready, error } = useLocalIntakes();
  const [printOpen, setPrintOpen] = useState(false);
  const printTrigger = useRef<HTMLButtonElement>(null);
  const directory = useRepairDirectory();
  const order = directory.find(order => order.id === id);
  const data = records.find(record => record.id === id);
  const photos = formal ? (data?.photos ?? []).map(photo => ({...photo,name:photo.slot,url:`/api/backend/intake-photo?order=${encodeURIComponent(id)}&photo=${encodeURIComponent(photo.id)}`})) : [];
  return <main className={`module-page local-intake-detail ${styles.page}`}><header className="module-heading"><PageTitle title={t("工单详情")} backHref={returnTo} backLabel={t("工单列表")} backScroll={false} />{order ? <RepairReworkControl order={order}/> : null}{data ? <button className="button button--primary page-toolbar-action" type="button" aria-label={t("打印接机单")} title={t("打印接机单")} ref={printTrigger} onClick={() => setPrintOpen(true)}><Printer size={17} /><span>{t("打印接机单")}</span></button> : null}</header>
    {!ready ? <ReadPending label="正在读取工单…" /> : !data || !order || error ? <section className="panel module-empty"><CircleAlert size={28} /><strong>{systemText(error) || (formal ? t("工单不存在或无权查看") : t("当前浏览器没有这张工单"))}</strong>{!formal ? <p>{t("请在创建工单的浏览器打开；本地预览尚未接入跨设备数据库。")}</p> : null}</section> : <><RepairDetailWorkspace key={`${staff.member?.id}:${staff.member?.revision}:${id}`} order={order!} data={data} photos={photos} metadata={<div className="local-intake-meta"><span>{data.id}</span>{data.repairOrigin ? <><Link href={`/app/repairs/${data.repairOrigin.repairId}`}>{t("返修 · 原工单 ")}{data.repairOrigin.repairId}</Link><span>{t("返修原因：")}{data.repairOrigin.reason}</span></> : null}{records.filter(row => row.repairOrigin?.repairId === data.id).map(row => <Link key={row.id} href={`/app/repairs/${row.id}`}>{t("返修单 ")}{row.id}</Link>)}{data.retailOrigin ? <Link href={customerSaleHref({ unitId: data.retailOrigin.unitId, id: data.retailOrigin.saleId })}>{t("整机售后 · 返回原销售档案")}</Link>:null}</div>} />{!formal ? <p className="local-intake-note">{t("本地预览 · 照片未持久保存")}</p> : null}{printOpen ? <IntakeReceipt restoreFocusRef={printTrigger} data={data} onClose={() => setPrintOpen(false)} /> : null}</>}
  </main>;
}
