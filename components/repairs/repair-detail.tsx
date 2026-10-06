"use client";
import { useLanguage } from "@/components/language-provider";
import { repairCustomerName, repairIssueText, repairKnownText } from "@/lib/i18n/repair-display";
import Link from "next/link";
import { useState } from "react";
import { Banknote, CalendarClock, CheckCircle2, ClipboardCheck, FileClock, Flag, Gamepad2, Laptop, Package, Phone, Printer, ScanLine, Smartphone, Tablet, UserRound, Wrench, ChevronDown } from "lucide-react";
import { IntakeReceipt } from "./intake-receipt";
import { fixtureIntakeReceipt } from "@/lib/repair-intake-record";
import { IntakeSignatureSection } from "./intake-signature";
import { customerId } from "@/lib/customers";
import { RepairReworkControl } from "./repair-rework-control";
import { PageTitle } from "@/components/page-title";
import { ColorSwatch } from "@/components/color-picker";
import type { RepairOrder } from "@/lib/repair-fixtures";
import { useRepairDirectory, useLocalIntakes } from "./local-intake-store";
import { RepairWorkflowPanel } from "./repair-workflow-panel";
import { RepairProcurementSummary } from "@/components/procurement/procurement-summary";
import styles from "./repair-detail.module.css";

const deviceIcons = { 手机: Smartphone, 电脑: Laptop, 平板: Tablet, 游戏机: Gamepad2 };

export function RepairDetail({ initialOrder }: { initialOrder: RepairOrder }) {
  const { t, locale } = useLanguage();
  const [printOpen, setPrintOpen] = useState(false);
  const directory = useRepairDirectory();
  const reworks = useLocalIntakes().records.filter(row => row.repairOrigin?.repairId === initialOrder.id);
  const repair = { ...initialOrder, ...directory.find(order => order.id === initialOrder.id) };
  const receiptData=fixtureIntakeReceipt(initialOrder);
  const hasQuote = repair.quote.version > 0;
  const DeviceIcon = deviceIcons[repair.device.category as keyof typeof deviceIcons] ?? Wrench;

  const order = directory.find(row => row.id === repair.id);
  return <main className="module-page repair-detail">
    <div className="module-heading repair-detail__toolbar">
      <PageTitle title={repair.id} backHref="/app/repairs" backLabel={t("工单列表")} backScroll={false} />
      <div className="module-heading__actions">
        <button className="button button--secondary button--compact page-toolbar-action" type="button" onClick={() => setPrintOpen(true)} aria-label={t("打印接机单")} title={t("打印接机单")}><Printer size={16} /><span>{t("打印接机单")}</span></button>
        {order ? <RepairReworkControl order={order}/> : null}
      </div>
    </div>
    {reworks.length ? <div className="local-intake-meta">{reworks.map(row => <Link key={row.id} href={`/app/repairs/${row.id}`}>{t("返修单 ")}{row.id}</Link>)}</div> : null}
    <div className={styles.columns}>
        <section className={`panel ${styles.device}`} aria-label={t("设备与故障")}>
          <header className={styles.deviceHeader}>
            <span className={styles.deviceIcon}><DeviceIcon size={29} /></span>
            <div className={styles.deviceTitle}><h3>{repair.device.brand} {repair.device.model}</h3><div className={styles.deviceTags}><span><ColorSwatch value={repair.device.color} />{repairKnownText(repair.device.color, locale) || t("颜色未记录")}</span><span>{repairKnownText(repair.device.category, locale)}</span><span><Flag size={13} />{t(repair.priority)}{t("优先级")}</span></div></div>
          </header>
          <div className={styles.issue}><h4><Wrench size={16} />{t("客户报告的故障")}</h4><p>{repairIssueText(repair, locale)}</p></div>
          <div className={styles.accessories}><small><Package size={15} />{t("随件")}</small><div>{repair.accessories.length ? repair.accessories.map(item => <span key={item}>{repairKnownText(item, locale)}</span>) : <span>{t("无随件记录")}</span>}</div></div>
          <details className={styles.identifier}><summary><ScanLine size={16} /><span>{t("设备标识")}</span><ChevronDown size={14} /></summary><dl><div><dt>SN / IMEI</dt><dd>{repair.device.serial || t("未记录")}</dd></div></dl></details>
        </section>
      <aside className={styles.side}>
        <RepairWorkflowPanel repairId={repair.id} metadata={<dl>
          <div><dt><CalendarClock size={14} />{t("接收时间")}</dt><dd>{repair.receivedAt}</dd></div>
          <div><dt><UserRound size={14} />{t("负责人")}</dt><dd>{repair.technician === "未分配" ? t("未分配") : repair.technician}</dd></div>
          <div><dt><FileClock size={14} />{t("当前等待")}</dt><dd>{t(repair.waitingFor)}</dd></div>
          <div><dt><CalendarClock size={14} />{t("预计交付")}</dt><dd>{repair.promisedAt}</dd></div>
        </dl>} historyContent={repair.timeline.length ? <ol className="detail-timeline">{repair.timeline.map(event => <li key={`${event.time}-${t(event.title)}`}><i className={`timeline-dot timeline-dot--${event.tone}`} /><div><strong>{t(event.title)}</strong><p>{event.detail}</p><small>{event.time} · {event.actor}</small></div></li>)}</ol> : undefined} />
        <section className={`panel ${styles.customer}`} aria-label={t("客户联系")}>
          <span className={styles.customerIcon}><UserRound size={20} /></span><div><small>{t("客户联系")}</small><Link href={`/app/customers/${customerId(repair.customer.phone)}`}>{repairCustomerName(repair, locale)}</Link><a href={`tel:${repair.customer.phone.replace(/[^+\d]/g, "")}`}><Phone size={14} />{repair.customer.phone}</a></div>
        </section>
      </aside>
        <section className={`panel ${styles.quote}`} aria-label={t("报价版本")}>
          <header><h3><ClipboardCheck size={17} />{t("报价")}{hasQuote ? <small>v{repair.quote.version}</small> : null}</h3>{hasQuote ? <span className={`status-pill status-pill--${repair.quote.state === "客户已确认" ? "success" : "warning"}`}><CheckCircle2 size={14} />{repair.quote.state}</span> : null}</header>
          {hasQuote ? <dl><div><dt>{t("配件")}</dt><dd>€{repair.quote.parts.toFixed(2)}</dd></div><div><dt>{t("工时")}</dt><dd>€{repair.quote.labor.toFixed(2)}</dd></div><div className={styles.quoteTotal}><dt>{t("报价合计")}</dt><dd>€{repair.quote.total.toFixed(2)}</dd></div></dl> : <p className={styles.quoteEmpty}><Banknote size={18} />{t("尚未建立报价")}</p>}
        </section>
        <RepairProcurementSummary repairId={repair.id} />

    </div>
    <IntakeSignatureSection data={receiptData}/>
    {printOpen ? <IntakeReceipt data={receiptData} onClose={() => setPrintOpen(false)} /> : null}
  </main>;
}
