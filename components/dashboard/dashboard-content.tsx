"use client";

import { useLanguage } from "@/components/language-provider";
import Link from "next/link";
import { AppNavigationContext, PageTitle } from "@/components/page-title";
import { useContext } from "react";
import { retailEventTitle } from "@/lib/i18n/retail-display";
import { repairActivityLabel, repairCustomerName, repairIssueText, repairItemText } from "@/lib/i18n/repair-display";
import { RepairScanner } from "@/components/repairs/repair-scanner";
import { DashboardProcurementSummary } from "@/components/procurement/procurement-summary";
import { RetailDashboardSummary } from "@/components/retail/retail-dashboard-summary";
import { useRepairDirectory } from "@/components/repairs/local-intake-store";
import { useRepairWorkflows } from "@/components/repairs/repair-workflow-store";
import { useProcurement } from "@/components/procurement/procurement-provider";
import { useRetail } from "@/components/retail/retail-provider";
import { useStaff } from "@/components/staff/use-staff";
import { useStoreSettings } from "@/components/settings/settings-store";
import { defaultRepairGroups, visibleRepairGroups } from "@/lib/repair-groups";
import { isBackendClient } from "@/lib/backend/client";
import { workflowGroup, workflowGroups, repairProgress, hasCurrentRepairHandover, initialRepairWorkflow, type WorkflowGroup } from "@/lib/repair-workflow";
import { procurementEventLabel } from "@/lib/procurement";
import {
  ArrowRight,
  ChevronRight,
  Clock3,
  MoreVertical,
  PackageCheck,
  PackageSearch,
  Plus,
  Smartphone,
  Wrench,
} from "lucide-react";

type Tone = "violet" | "amber" | "mint" | "rose";

const stats: Array<{ label: string; value: string; note: string; icon: typeof Clock3; tone: Tone; points: string }> = [
  { label: "返修", value: "8", note: "其中 3 单超过 24 小时", icon: Clock3, tone: "violet", points: "0,35 12,31 24,34 36,20 48,24 60,14 72,18 84,7 96,12 108,5" },
  { label: "等配件", value: "5", note: "2 单等待确认供应商", icon: PackageSearch, tone: "amber", points: "0,14 12,20 24,12 36,31 48,27 60,36 72,24 84,29 96,18 108,22" },
  { label: "处理中", value: "12", note: "今日计划完成 6 台", icon: Wrench, tone: "mint", points: "0,8 12,13 24,12 36,21 48,17 60,29 72,31 84,25 96,17 108,12" },
  { label: "等取机", value: "6", note: "最早完成于 3 天前", icon: PackageCheck, tone: "rose", points: "0,30 12,22 24,18 36,10 48,16 60,9 72,25 84,28 96,17 108,21" },
];

const repairs = [
  { device: "iPhone 15 Pro", issue: "无法充电，偶发重启", id: "CT-2026-0929", customer: "周先生", state: "等待报价确认", tone: "warning" },
  { device: "MacBook Air M2", issue: "电池健康异常", id: "CT-2026-0927", customer: "Elena R.", state: "等待配件到货", tone: "info" },
  { device: "Nintendo Switch OLED", issue: "左侧摇杆漂移", id: "CT-2026-0924", customer: "Marco B.", state: "维修中", tone: "progress" },
  { device: "Samsung S24 Ultra", issue: "屏幕破裂", id: "CT-2026-0921", customer: "林女士", state: "待取机", tone: "success" },
];

function Sparkline({ points, tone }: { points: string; tone: Tone }) {
  const { t } = useLanguage();
  return <svg className={`sparkline sparkline--${tone}`} viewBox="0 0 108 42" role="img" aria-label={t("近期变化趋势")}><polyline points={points} fill="none" vectorEffect="non-scaling-stroke" /></svg>;
}

function DashboardHeading({ canScan = true, canCreate = true }: { canScan?: boolean; canCreate?: boolean }) {
  const { t } = useLanguage();
  const navigation = useContext(AppNavigationContext);
  return <header className="module-heading"><PageTitle title={t("工作台")} /><div className="module-heading__actions">{canScan ? <RepairScanner iconOnly={navigation?.isMobile ?? false} /> : null}{canCreate ? <Link className="button button--primary button--compact" href="/app/repairs/new"><Plus size={17} />{t("新建工单")}</Link> : null}</div></header>;
}

export function DashboardContent() {
  return isBackendClient() ? <RealDashboardContent /> : <PreviewDashboardContent />;
}

function RealDashboardContent() {
  const { t, locale , systemText } = useLanguage();
  const { settings } = useStoreSettings();
  const orders = useRepairDirectory();
  const { records, storageError } = useProcurement();
  const { workflows, ready: workflowReady, error: workflowError } = useRepairWorkflows();
  const { units, ready: retailReady, error: retailError } = useRetail();
  const staff = useStaff();
  const canRepairs = staff.can("repairs.view");
  const canRetail = staff.can("retail.view");
  const error = storageError || workflowError || retailError || staff.error;
  const counts = Object.fromEntries(Object.keys(workflowGroups).map(group => [group, 0])) as Record<WorkflowGroup, number>;
  for (const order of orders) counts[workflowGroup(order, records, workflows[order.id])]++;
  const realStats = [
    { label: "返修", value: counts.rework, note: "再次送回，待处理", icon: Clock3, tone: "violet" },
    { label: "处理中", value: counts.processing, note: "检测、报价、维修与测试", icon: Wrench, tone: "mint" },
    { label: "等配件", value: counts.purchase, note: "实际下单，尚未到齐", icon: PackageSearch, tone: "amber" },
    { label: "等取机", value: counts.ready, note: "未通知与已通知", icon: PackageCheck, tone: "rose" },
  ];
  const debtCount = orders.filter(order => { const current = workflows[order.id] ?? initialRepairWorkflow(order); return hasCurrentRepairHandover(current) && current.followUp?.collectedUnpaid; }).length;
  const recent = [...orders].sort((left, right) => right.updatedAt.localeCompare(left.updatedAt) || left.id.localeCompare(right.id)).slice(0, 4);
  const activity = [
    ...orders.map(order => ({ id: `intake:${order.id}`, title: `${order.id} · ${t("工单已登记")}`, time: order.createdAt, href: `/app/repairs/${order.id}`, tone: "violet" })),
    ...orders.flatMap(order => (workflows[order.id]?.events ?? []).map(event => ({ id: `repair:${order.id}:${event.id}`, title: `${order.id} · ${repairActivityLabel(event, locale)}`, time: event.time, href: `/app/repairs/${order.id}`, tone: "mint" }))),
    ...records.flatMap(record => record.events.map(event => ({ id: `procurement:${record.id}:${event.id}`, title: `${repairItemText(record.item, locale)} · ${t(procurementEventLabel(event))}`, time: event.time, href: `/app/repairs/${record.repairId}`, tone: "amber" }))),
    ...units.flatMap(unit => unit.events.map(event => ({ id: `retail:${unit.id}:${event.id}`, title: `${unit.code} · ${retailEventTitle(event.title, locale)}`, time: event.time, href: `/app/retail/units/${unit.id}`, tone: "violet" }))),
  ].filter(event => event.time).sort((left, right) => right.time.localeCompare(left.time) || left.id.localeCompare(right.id)).slice(0, 5);
  const heading = <DashboardHeading canScan={canRepairs} canCreate={staff.can("repairs.edit")} />;
  if (!workflowReady || !retailReady || !staff.ready) return <div className="dashboard">{heading}<div className="panel module-empty" role="status">{t("正在读取门店概况…")}</div></div>;
  if (error) return <div className="dashboard">{heading}<div className="panel module-empty" role="alert">{systemText(error)}</div></div>;

  return <div className="dashboard">
    {heading}
    <section className="stat-grid" aria-label={t("门店待办统计")}>
      {realStats.map(stat => <article className="stat-card" key={stat.label}><div className="stat-card__head"><span>{t(stat.label)}</span></div><div className="stat-card__body"><div><span className={`stat-icon stat-icon--${stat.tone}`}><stat.icon size={18} /></span><strong>{canRepairs ? stat.value : "—"}</strong><small>{canRepairs ? t(stat.note) : t("无维修查看权限")}</small></div></div></article>)}
    </section>
    {canRepairs && debtCount > 0 ? <p className="repair-stage-note"><Link href="/app/repairs?view=history&status=handover">{t("已取机待收尾 · ")}{debtCount}{t("单")}</Link></p> : null}
    <section className="dashboard-grid dashboard-grid--main">
      <article className="panel repair-panel">
        <div className="panel__header"><div><h2>{t("近期工单")}</h2></div>{canRepairs ? <Link className="button button--secondary button--tiny" href="/app/repairs">{t("查看全部 ")}<ArrowRight size={15} /></Link> : null}</div>
        {!canRepairs ? <div className="section-empty"><strong>{t("当前账号没有维修查看权限")}</strong></div> : !recent.length ? <div className="section-empty"><Wrench size={24} /><strong>{t("尚未登记工单")}</strong></div> : <div className="module-table-scroll" role="region" aria-label={t("近期工单表格")} tabIndex={0}><div className="repair-table__head"><span>{t("设备与故障")}</span><span>{t("客户 / 工单号")}</span><span>{t("当前状态")}</span><span /></div><div className="repair-list">{recent.map(order => <div className="repair-row" key={order.id}><div className="repair-row__device"><span><Smartphone size={18} /></span><div><strong>{order.device.brand} {order.device.model}</strong><small>{repairIssueText(order, locale)}</small></div></div><div className="repair-row__meta"><strong>{repairCustomerName(order, locale)}</strong><small>{order.id}</small></div><span className={`status-pill status-pill--${repairProgress(order, records, workflows[order.id]).tone}`}>{t(repairProgress(order, records, workflows[order.id]).label)}</span><Link className="row-action" href={`/app/repairs/${order.id}`} aria-label={t("打开 {v0}", { v0: order.id })}><ChevronRight size={18} /></Link></div>)}</div></div>}
      </article>
      <article className="panel workload-panel">
        <div className="panel__header"><div><h2>{t("日常维修分组")}</h2></div>{canRepairs ? <span className="status-pill status-pill--info">{counts.rework + counts.processing + counts.purchase + counts.ready} {t(" 张")}</span> : null}</div>
        {canRepairs ? <div className="legend-list">{visibleRepairGroups(settings.repairGroups ?? defaultRepairGroups(), "workflow").map(({key: group, label}) => <span key={group}>{t(label)}<strong>{counts[group]}</strong></span>)}</div> : <div className="section-empty"><strong>{t("当前账号没有维修查看权限")}</strong></div>}
      </article>
    </section>
    <section className="dashboard-grid dashboard-grid--bottom">
      {canRepairs && records.length ? <DashboardProcurementSummary /> : <article className="panel arrivals-panel"><div className="panel__header"><div><h2>{t("采购与到货")}</h2></div>{canRepairs ? <Link className="button button--secondary button--tiny" href="/app/repairs">{t("查看工单")}</Link> : null}</div><div className="section-empty"><strong>{canRepairs ? t("尚未登记采购") : t("当前账号没有维修查看权限")}</strong></div></article>}
      {canRetail ? <RetailDashboardSummary /> : <article className="panel retail-panel"><div className="panel__header"><div><h2>{t("整机商品")}</h2></div></div><div className="section-empty"><strong>{t("当前账号没有整机查看权限")}</strong></div></article>}
      <article className="panel activity-panel"><div className="panel__header"><div><h2>{t("近期动态")}</h2></div></div>{activity.length ? <ol className="activity-list">{activity.map(event => <li key={event.id}><span className={`activity-dot activity-dot--${event.tone}`} /><div><Link href={event.href}><strong>{event.title}</strong></Link><small>{event.time}</small></div></li>)}</ol> : <div className="section-empty"><strong>{t("暂无业务动态")}</strong></div>}</article>
    </section>
  </div>;
}

function PreviewDashboardContent() {
  const { t, locale } = useLanguage();
  return (
    <div className="dashboard">
      <DashboardHeading />

      <section className="stat-grid" aria-label={t("门店待办统计")}>
        {stats.map((stat) => (
          <article className="stat-card" key={stat.label}>
            <div className="stat-card__head"><span>{t(stat.label)}</span><button type="button" aria-label={t("查看更多{v0}", { v0: stat.label })}><MoreVertical size={16} /></button></div>
            <div className="stat-card__body"><div><span className={`stat-icon stat-icon--${stat.tone}`}><stat.icon size={18} /></span><strong>{stat.value}</strong><small>{t(stat.note)}</small></div><Sparkline points={stat.points} tone={stat.tone} /></div>
          </article>
        ))}
      </section>

      <section className="dashboard-grid dashboard-grid--main">
        <article className="panel repair-panel">
          <div className="panel__header"><div><h2>{t("优先处理工单")}</h2></div><Link className="button button--secondary button--tiny" href="/app/repairs">{t("查看全部 ")}<ArrowRight size={15} /></Link></div>
          <div className="module-table-scroll" role="region" aria-label={t("优先工单表格")} tabIndex={0}>
          <div className="repair-table__head"><span>{t("设备与故障")}</span><span>{t("客户 / 工单号")}</span><span>{t("当前状态")}</span><span /></div>
          <div className="repair-list">
            {repairs.map((repair) => (
              <div className="repair-row" key={repair.id}>
                <div className="repair-row__device"><span><Smartphone size={18} /></span><div><strong>{repair.device}</strong><small>{repairIssueText(repair, locale)}</small></div></div>
                <div className="repair-row__meta"><strong>{repair.customer}</strong><small>{repair.id}</small></div>
                <span className={`status-pill status-pill--${repair.tone}`}>{t(repair.state)}</span>
                <Link className="row-action" href={`/app/repairs/${repair.id}`} aria-label={t("打开 {v0}", { v0: repair.id })}><ChevronRight size={18} /></Link>
              </div>
            ))}
          </div>
          </div>
        </article>

        <article className="panel workload-panel">
          <div className="panel__header"><div><h2>{t("日常维修分组")}</h2></div><button className="panel-menu" type="button" aria-label={t("更多")}><MoreVertical size={17} /></button></div>
          <div className="donut"><div className="donut__center"><strong>31</strong><span>{t("处理中 ")}</span></div></div>
          <div className="legend-list"><span><i className="legend-dot legend-dot--violet" />{t("返修 ")}<strong>8</strong></span><span><i className="legend-dot legend-dot--amber" />{t("等配件 ")}<strong>5</strong></span><span><i className="legend-dot legend-dot--mint" />{t("处理中 ")}<strong>12</strong></span><span><i className="legend-dot legend-dot--rose" />{t("等取机 ")}<strong>6</strong></span></div>
        </article>
      </section>

      <section className="dashboard-grid dashboard-grid--bottom">
        <DashboardProcurementSummary />

        <RetailDashboardSummary />

        <article className="panel activity-panel">
          <div className="panel__header"><div><h2>{t("今日动态")}</h2></div><button className="panel-menu" type="button" aria-label={t("更多")}><MoreVertical size={17} /></button></div>
          <ol className="activity-list"><li><span className="activity-dot activity-dot--mint" /><div><strong>{t("CT-2026-0921 已完成测试")}</strong><small>{t("09:18 · 技术员 Luca")}</small></div></li><li><span className="activity-dot activity-dot--amber" /><div><strong>{t("采购行记录部分到货")}</strong><small>08:52 · MobileParts SRL</small></div></li><li><span className="activity-dot activity-dot--violet" /><div><strong>{t("整机 U-1042 设为可售")}</strong><small>{t("08:30 · 检测已通过")}</small></div></li></ol>
        </article>
      </section>

    </div>
  );
}
