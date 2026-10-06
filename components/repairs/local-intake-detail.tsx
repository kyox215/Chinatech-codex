"use client";
import { useLanguage } from "@/components/language-provider";
import { isBackendClient } from "@/lib/backend/client";
import Link from "next/link";
import { useState } from "react";
import { Printer, CircleAlert, Clock3, UserRound } from "lucide-react";
import { PageTitle } from "@/components/page-title";
import { RepairReworkControl } from "./repair-rework-control";
import { RepairWorkflowPanel } from "./repair-workflow-panel";
import { useRepairDirectory, useLocalIntakes } from "./local-intake-store";
import { IntakeSignatureSection } from "./intake-signature";
import { IntakeReview } from "./intake-review";
import { IntakeReceipt } from "./intake-receipt";
import { RepairProcurementSummary } from "@/components/procurement/procurement-summary";

export function LocalIntakeDetail({ id }: { id: string }) {
  const { t , systemText } = useLanguage();
  const { records, ready, error } = useLocalIntakes();
  const [printOpen, setPrintOpen] = useState(false);
  const directory = useRepairDirectory();
  const order = directory.find(order => order.id === id);
  const data = records.find(record => record.id === id);
  const photos = isBackendClient() ? (data?.photos ?? []).map(photo => ({...photo,name:photo.slot,url:`/api/backend/intake-photo?order=${encodeURIComponent(id)}&photo=${encodeURIComponent(photo.id)}`})) : [];
  return <main className="module-page local-intake-detail"><header className="module-heading"><PageTitle title={t("工单详情")} backHref="/app/repairs" backLabel={t("工单列表")} backScroll={false} />{order ? <RepairReworkControl order={order}/> : null}{data ? <button className="button button--primary page-toolbar-action" type="button" aria-label={t("打印接机单")} title={t("打印接机单")} onClick={() => setPrintOpen(true)}><Printer size={17} /><span>{t("打印接机单")}</span></button> : null}</header>
    {!ready ? <section className="panel module-empty" role="status">{t("正在读取工单…")}</section> : !data || error ? <section className="panel module-empty"><CircleAlert size={28} /><strong>{systemText(error) || (isBackendClient() ? t("工单不存在或无权查看") : t("当前浏览器没有这张工单"))}</strong>{!isBackendClient() ? <p>{t("请在创建工单的浏览器打开；本地预览尚未接入跨设备数据库。")}</p> : null}</section> : <><IntakeReview data={data} photos={photos} layout="detail" metadata={<div className="local-intake-meta"><span>{data.id}</span>{data.repairOrigin ? <><Link href={`/app/repairs/${data.repairOrigin.repairId}`}>{t("返修 · 原工单 ")}{data.repairOrigin.repairId}</Link><span>{t("返修原因：")}{data.repairOrigin.reason}</span></> : null}{records.filter(row => row.repairOrigin?.repairId === data.id).map(row => <Link key={row.id} href={`/app/repairs/${row.id}`}>{t("返修单 ")}{row.id}</Link>)}{data.retailOrigin ? <Link href={"/app/retail/units/"+data.retailOrigin.unitId}>{t("整机售后 · 返回原销售档案")}</Link>:null}</div>} relatedContent={<><RepairProcurementSummary repairId={id} /><IntakeSignatureSection data={data} embedded/></>} asideContent={<RepairWorkflowPanel repairId={id} metadata={<dl><div><dt><Clock3 size={14} />{t("接收时间")}</dt><dd>{data.createdAt}</dd></div><div><dt><UserRound size={14} />{t("负责人")}</dt><dd>{order?.technician && order.technician !== "未分配" ? order.technician : t("未分配")}</dd></div></dl>} />} statusContent={false} />{!isBackendClient() ? <p className="local-intake-note">{t("本地预览 · 照片未持久保存")}</p> : null}{printOpen ? <IntakeReceipt data={data} onClose={() => setPrintOpen(false)} /> : null}</>}
  </main>;
}
