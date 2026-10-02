import Link from "next/link";
import { PageTitle } from "@/components/page-title";
import { RepairScanner } from "@/components/repairs/repair-scanner";
import { DashboardProcurementSummary } from "@/components/procurement/procurement-summary";
import { RetailDashboardSummary } from "@/components/retail/retail-dashboard-summary";
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
  { label: "待报价", value: "8", note: "其中 3 单超过 24 小时", icon: Clock3, tone: "violet", points: "0,35 12,31 24,34 36,20 48,24 60,14 72,18 84,7 96,12 108,5" },
  { label: "待采购", value: "5", note: "2 单等待确认供应商", icon: PackageSearch, tone: "amber", points: "0,14 12,20 24,12 36,31 48,27 60,36 72,24 84,29 96,18 108,22" },
  { label: "维修中", value: "12", note: "今日计划完成 6 台", icon: Wrench, tone: "mint", points: "0,8 12,13 24,12 36,21 48,17 60,29 72,31 84,25 96,17 108,12" },
  { label: "待取机", value: "6", note: "最早完成于 3 天前", icon: PackageCheck, tone: "rose", points: "0,30 12,22 24,18 36,10 48,16 60,9 72,25 84,28 96,17 108,21" },
];

const repairs = [
  { device: "iPhone 15 Pro", issue: "无法充电，偶发重启", id: "CT-2026-0929", customer: "周先生", state: "等待报价确认", tone: "warning" },
  { device: "MacBook Air M2", issue: "电池健康异常", id: "CT-2026-0927", customer: "Elena R.", state: "等待配件到货", tone: "info" },
  { device: "Nintendo Switch OLED", issue: "左侧摇杆漂移", id: "CT-2026-0924", customer: "Marco B.", state: "维修中", tone: "progress" },
  { device: "Samsung S24 Ultra", issue: "屏幕破裂", id: "CT-2026-0921", customer: "林女士", state: "待取机", tone: "success" },
];

function Sparkline({ points, tone }: { points: string; tone: Tone }) {
  return <svg className={`sparkline sparkline--${tone}`} viewBox="0 0 108 42" role="img" aria-label="近期变化趋势"><polyline points={points} fill="none" vectorEffect="non-scaling-stroke" /></svg>;
}

export function DashboardContent() {
  return (
    <div className="dashboard">
      <header className="module-heading">
        <PageTitle title="工作台" />
        <div className="module-heading__actions"><RepairScanner /><Link className="button button--primary button--compact" href="/app/repairs/new"><Plus size={17} />新建工单</Link></div>
      </header>

      <section className="stat-grid" aria-label="门店待办统计">
        {stats.map((stat) => (
          <article className="stat-card" key={stat.label}>
            <div className="stat-card__head"><span>{stat.label}</span><button type="button" aria-label={`查看更多${stat.label}`}><MoreVertical size={16} /></button></div>
            <div className="stat-card__body"><div><span className={`stat-icon stat-icon--${stat.tone}`}><stat.icon size={18} /></span><strong>{stat.value}</strong><small>{stat.note}</small></div><Sparkline points={stat.points} tone={stat.tone} /></div>
          </article>
        ))}
      </section>

      <section className="dashboard-grid dashboard-grid--main">
        <article className="panel repair-panel">
          <div className="panel__header"><div><h2>优先处理工单</h2></div><Link className="button button--secondary button--tiny" href="/app/repairs">查看全部 <ArrowRight size={15} /></Link></div>
          <div className="module-table-scroll" role="region" aria-label="优先工单表格" tabIndex={0}>
          <div className="repair-table__head"><span>设备与故障</span><span>客户 / 工单号</span><span>当前状态</span><span /></div>
          <div className="repair-list">
            {repairs.map((repair) => (
              <div className="repair-row" key={repair.id}>
                <div className="repair-row__device"><span><Smartphone size={18} /></span><div><strong>{repair.device}</strong><small>{repair.issue}</small></div></div>
                <div className="repair-row__meta"><strong>{repair.customer}</strong><small>{repair.id}</small></div>
                <span className={`status-pill status-pill--${repair.tone}`}>{repair.state}</span>
                <Link className="row-action" href={`/app/repairs/${repair.id}`} aria-label={`打开 ${repair.id}`}><ChevronRight size={18} /></Link>
              </div>
            ))}
          </div>
          </div>
        </article>

        <article className="panel workload-panel">
          <div className="panel__header"><div><h2>维修阶段分布</h2></div><button className="panel-menu" type="button" aria-label="更多"><MoreVertical size={17} /></button></div>
          <div className="donut"><div className="donut__center"><strong>31</strong><span>处理中</span></div></div>
          <div className="legend-list"><span><i className="legend-dot legend-dot--violet" />待确认 <strong>8</strong></span><span><i className="legend-dot legend-dot--amber" />采购中 <strong>5</strong></span><span><i className="legend-dot legend-dot--mint" />维修中 <strong>12</strong></span><span><i className="legend-dot legend-dot--rose" />待取机 <strong>6</strong></span></div>
        </article>
      </section>

      <section className="dashboard-grid dashboard-grid--bottom">
        <DashboardProcurementSummary />

        <RetailDashboardSummary />

        <article className="panel activity-panel">
          <div className="panel__header"><div><h2>今日动态</h2></div><button className="panel-menu" type="button" aria-label="更多"><MoreVertical size={17} /></button></div>
          <ol className="activity-list"><li><span className="activity-dot activity-dot--mint" /><div><strong>CT-2026-0921 已完成测试</strong><small>09:18 · 技术员 Luca</small></div></li><li><span className="activity-dot activity-dot--amber" /><div><strong>采购行记录部分到货</strong><small>08:52 · MobileParts SRL</small></div></li><li><span className="activity-dot activity-dot--violet" /><div><strong>整机 U-1042 设为可售</strong><small>08:30 · 检测已通过</small></div></li></ol>
        </article>
      </section>

    </div>
  );
}
