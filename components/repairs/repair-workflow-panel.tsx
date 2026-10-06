"use client";
import { useLanguage } from "@/components/language-provider";
import { repairActivityLabel } from "@/lib/i18n/repair-display";
import { useRef, useState, type ReactNode } from "react";
import { Home, Phone, ClipboardList, History, ChevronDown } from "lucide-react";
import { SelectControl } from "@/components/select-control";
import { arrivalNotice, custodyLabels, initialRepairWorkflow, type DeviceCustody, type WorkflowCommand } from "@/lib/repair-workflow";
import { useRepairDirectory } from "./local-intake-store";
import { useRepairWorkflows, updateRepairWorkflow } from "./repair-workflow-store";
import { useProcurement } from "@/components/procurement/procurement-provider";
import { useStaff } from "@/components/staff/use-staff";
import { RepairContactControl } from "./repair-contact-control";
import { RepairStageControl } from "./repair-stage-control";
import styles from "./repair-workflow-panel.module.css";

export function RepairWorkflowPanel({ repairId, metadata, historyContent }: { repairId: string; metadata?: ReactNode; historyContent?: ReactNode }) {
  const { t, locale , systemText } = useLanguage();
  const canEdit = useStaff().can("repairs.edit");
  const directory = useRepairDirectory();
  const order = directory.find(order => order.id === repairId);
  const { workflows, error: storageError } = useRepairWorkflows();
  const { records } = useProcurement();
  const [error, setError] = useState("");
  const custodyEditor = useRef<HTMLDetailsElement>(null);
  const custodyRevision = useRef<number | null>(null);
  if (!order) return null;
  const workflow = workflows[repairId] ?? initialRepairWorkflow(order);
  const notice = arrivalNotice(workflow, records, repairId, order);
  const update = async (command: WorkflowCommand) => {
    try {
      await updateRepairWorkflow(order, command, records, command.type === "custody" ? custodyRevision.current ?? workflow.revision : workflow.revision);
      setError("");
      if (custodyEditor.current) { custodyEditor.current.open = false; custodyEditor.current.querySelector("summary")?.focus(); }
    } catch (reason) { setError(reason instanceof Error ? reason.message : "保存失败。"); }
  };
  return <section className={`panel ${styles.panel}`} aria-label={t("工单概况")}>
    <header className={styles.header}><h3><ClipboardList size={17} />{t("工单概况")}</h3><RepairStageControl order={order} /></header>
    <div className={styles.flags}>
      {canEdit ? <details ref={custodyEditor} className={styles.custody} onToggle={event => { custodyRevision.current = event.currentTarget.open ? workflow.revision : null; }} onKeyDown={event => { if (event.key === "Escape" && custodyEditor.current) { event.preventDefault(); custodyEditor.current.open = false; custodyEditor.current.querySelector("summary")?.focus(); } }}>
        <summary aria-label={t("更改设备保管")}><Home size={15} /><span>{t(custodyLabels[workflow.custody])}</span><ChevronDown size={14} /></summary>
        <div className={styles.editor}><label className="field"><span>{t("设备实际保管")}</span><SelectControl aria-label={t("设备实际保管")} value={workflow.custody} disabled={Boolean(storageError)} onChange={event => update({ type: "custody", custody: event.target.value as DeviceCustody })}>{Object.entries(custodyLabels).map(([key, label]) => <option value={key} key={key}>{t(label)}</option>)}</SelectControl></label></div>
      </details> : <span className={styles.notice}><Home size={15} />{t(custodyLabels[workflow.custody])}</span>}
      <span className={styles.notice}><Phone size={14} />{systemText(notice)}</span>
    </div>
    <div className={styles.contactActions}><RepairContactControl order={order} /></div>
    {error || storageError ? <p role="alert" className="form-error">{systemText(error || storageError)}</p> : null}
    {metadata ? <div className={styles.metadata}>{metadata}</div> : null}
    {workflow.events.length || historyContent ? <details className={styles.history}><summary><History size={16} /><span>{t("状态与操作历史")}</span>{workflow.events.length ? <small>{workflow.events.length} {t(" 次操作")}</small> : null}<ChevronDown size={14} /></summary>
      {workflow.events.length ? <ol className="detail-timeline">{workflow.events.toReversed().map(event => <li key={event.id}><i className="timeline-dot timeline-dot--info" /><div><strong>{repairActivityLabel(event, locale)}</strong>{event.note ? <p>{event.note}</p> : null}<small>{event.time}</small></div></li>)}</ol> : null}{historyContent}
    </details> : null}
  </section>;
}
