"use client";
import { OperationRecoveryControls, useOperationReceipt } from "@/components/use-operation-receipt";
import { useLanguage } from "@/components/language-provider";
import { repairActivityLabel } from "@/lib/i18n/repair-display";
import { useEffect, useRef, useState, type ReactNode } from "react";
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

export function RepairWorkflowPanel({ repairId, metadata, historyContent, showContact = true, showHistory = true }: { repairId: string; metadata?: ReactNode; historyContent?: ReactNode; showContact?: boolean; showHistory?: boolean }) {
  const { t, locale , systemText } = useLanguage();
  const receipt = useOperationReceipt();
  const canEdit = useStaff().can("repairs.edit");
  const directory = useRepairDirectory();
  const order = directory.find(order => order.id === repairId);
  const { workflows, error: storageError } = useRepairWorkflows();
  const { records } = useProcurement();
  const [error, setError] = useState("");
  const custodyEditor = useRef<HTMLDetailsElement>(null);
  const busy = useRef(false);
  const [submitting, setSubmitting] = useState(false);
  const activeOperation = useRef({ active: true });
  useEffect(() => {
    busy.current = false;
    const operation = { active: true };
    activeOperation.current = operation;
    return () => { operation.active = false; };
  }, [repairId]);
  const custodyRevision = useRef<number | null>(null);
  if (!order) return null;
  const workflow = workflows[repairId] ?? initialRepairWorkflow(order);
  const notice = arrivalNotice(workflow, records, repairId, order);
  const update = async (command: WorkflowCommand) => {
    if (busy.current || receipt.isWaiting() || !canEdit || storageError) return;
    const operation = activeOperation.current;
    busy.current = true; setSubmitting(true); setError("");
    const requestId=crypto.randomUUID();
    const finish=()=>{if(!operation.active)return;busy.current=false;setError("");if(custodyEditor.current){custodyEditor.current.open=false;custodyEditor.current.querySelector("summary")?.focus();}};
    try {
      await updateRepairWorkflow(order, command, records, command.type === "custody" ? custodyRevision.current ?? workflow.revision : workflow.revision,{requestId});
      if (!operation.active) return;
      finish();
    } catch (reason) { if(operation.active&&!receipt.watch(requestId,finish,()=>{busy.current=false;}))setError(reason instanceof Error?reason.message:"保存失败。"); }
    finally { if (operation.active) { if(!receipt.isWaiting())busy.current=false;setSubmitting(false); } }
  };
  return <section className={`panel ${styles.panel}`} aria-label={t("工单概况")}>
    <header className={styles.header}><h3><ClipboardList size={17} />{t("工单概况")}</h3><RepairStageControl order={order} /></header>
    <div className={styles.flags}>
      {canEdit ? <details ref={custodyEditor} className={styles.custody} aria-busy={submitting} onToggle={event => { custodyRevision.current = event.currentTarget.open ? workflow.revision : null; }} onKeyDown={event => { if (event.key === "Escape" && custodyEditor.current) { event.preventDefault(); if (busy.current) return; custodyEditor.current.open = false; custodyEditor.current.querySelector("summary")?.focus(); } }}>
        <summary aria-label={t("更改设备保管")} aria-disabled={submitting||receipt.waiting} onClick={event => { if (busy.current) event.preventDefault(); }}><Home size={15} /><span>{t(custodyLabels[workflow.custody])}</span><ChevronDown size={14} /></summary>
        <div className={styles.editor}><label className="field"><span>{t("设备实际保管")}</span><SelectControl aria-label={t("设备实际保管")} value={workflow.custody} disabled={submitting || receipt.waiting || Boolean(storageError)} onChange={event => update({ type: "custody", custody: event.target.value as DeviceCustody })}>{Object.entries(custodyLabels).map(([key, label]) => <option value={key} key={key}>{t(label)}</option>)}</SelectControl></label>{submitting||receipt.waiting?<p role="status">{t(submitting?"正在保存…":"提交结果待核对，请处理原提交，勿重复新建。")}</p>:null}</div>
      </details> : <span className={styles.notice}><Home size={15} />{t(custodyLabels[workflow.custody])}</span>}
      <span className={styles.notice}><Phone size={14} />{systemText(notice)}</span>
    </div>
    <OperationRecoveryControls requestId={receipt.requestId}/>
    {showContact ? <div className={styles.contactActions}><RepairContactControl order={order} /></div> : null}
    {error || storageError ? <p role="alert" className="form-error">{systemText(error || storageError)}</p> : null}
    {metadata ? <div className={styles.metadata}>{metadata}</div> : null}
    {showHistory && (workflow.events.length || historyContent) ? <details className={styles.history}><summary><History size={16} /><span>{t("状态与操作历史")}</span>{workflow.events.length ? <small>{workflow.events.length} {t(" 次操作")}</small> : null}<ChevronDown size={14} /></summary>
      {workflow.events.length ? <ol className="detail-timeline">{workflow.events.toReversed().map(event => <li key={event.id}><i className="timeline-dot timeline-dot--info" /><div><strong>{repairActivityLabel(event, locale)}</strong>{event.note ? <p>{event.note}</p> : null}<small>{event.time}</small></div></li>)}</ol> : null}{historyContent}
    </details> : null}
  </section>;
}
