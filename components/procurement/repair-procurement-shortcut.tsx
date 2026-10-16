"use client";
import { OperationRecoveryControls, useOperationReceipt } from "@/components/use-operation-receipt";
import { subscribeRecovery } from "@/lib/backend/client";
import { useLanguage } from "@/components/language-provider";
import { repairItemText } from "@/lib/i18n/repair-display";
import { useCallback, useEffect, useId, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { History, PackageSearch, Pencil, X } from "lucide-react";
import { RepairProjectControls, type RepairProjectConfirmation } from "./repair-project-controls";
import { RepairItemsForm } from "./repair-items-form";
import { useRepairDirectory } from "@/components/repairs/local-intake-store";
import { reconfirmRepairParts, useRepairWorkflows } from "@/components/repairs/repair-workflow-store";
import { currentRepairRequirements, type RepairRequirement } from "@/lib/repair-requirements";
import { procurementStatuses, procurementStatus, type ProcurementRecord } from "@/lib/procurement";
import { SelectControl } from "@/components/select-control";
import { useStaff } from "@/components/staff/use-staff";
import { isPreorder, procurementEventLabel } from "@/lib/procurement";
import { useProcurement } from "./procurement-provider";
import { ProcurementActions } from "./procurement-detail";
import type { RepairDirectoryEntry } from "@/lib/repair-intake-record";
import { RepairPartForm } from "./repair-part-form";
export function RepairProcurementShortcut({ repairId, onOpen }: { repairId: string; onOpen: (repairId: string) => void }) {
  const { t } = useLanguage();
  const canEdit = useStaff().can("repairs.edit");
  return <button id={`repair-action-${repairId}`} className="button button--secondary" type="button" onClick={() => onOpen(repairId)} aria-label={t("{v0} 配件{v1}", { v0: repairId, v1: canEdit ? t("操作") : t("详情") })} title={canEdit ? t("配件操作") : t("配件详情")}><PackageSearch size={17} aria-hidden="true" /><span>{t("配件")}</span></button>;
}
// Dialog lives outside groups; marking a part may move its work order into another group.
export function RepairProcurementDialog({ repairId, onClose, initialRecordId = "", initialRequirementId }: { repairId: string | null; onClose: () => void; initialRecordId?: string; initialMode?: "view" | "add"; initialRequirementId?: string }) {
  const { t, locale, systemText } = useLanguage();
  const canEdit = useStaff().can("repairs.edit");
  const { records, storageError } = useProcurement();
  const order = useRepairDirectory().find(row => row.id === repairId);
  const { workflows } = useRepairWorkflows();
  const rows = records.filter(row => row.repairId === repairId);
  const [selectedId, setSelectedId] = useState(initialRecordId);
  const [legacyEdit, setLegacyEdit] = useState(false);
  const [pending, setPending] = useState(false);
  const [footerTarget, setFooterTarget] = useState<HTMLDivElement | null>(null);
  const [recoveryRequestId,setRecoveryRequestId]=useState<string|null>(null);
  const [confirmedProject, setConfirmedProject] = useState<RepairProjectConfirmation | null>(null);
  const busy = useRef(false);
  const owner = useRef<string | null>(null);
  const retainOwner = useRef(false);
  const projectOwner = useRef<RepairProjectConfirmation | null>(null);
  const { watch: watchReceipt } = useOperationReceipt();
  const relatedRows = initialRequirementId ? rows.filter(row => row.requirementId === initialRequirementId) : rows;
  const selected = relatedRows.find(row => row.id === selectedId) ?? relatedRows.find(isPreorder) ?? relatedRows[0];
  const releaseOwner = useCallback((requestId: string, confirmed = false) => {
    if (owner.current !== requestId) return;
    if (confirmed && projectOwner.current?.requestId === requestId) setConfirmedProject(projectOwner.current);
    projectOwner.current = null; retainOwner.current = false;
    owner.current = null; busy.current = false; setPending(false); setRecoveryRequestId(null);
  }, []);
  const setOperationPending = (value: boolean, requestId?: string, project?: RepairProjectConfirmation, retainUntilReleased = false) => {
    if (!requestId) return false;
    if (value) {
      if (owner.current && owner.current !== requestId) return false;
      projectOwner.current = project?.requestId === requestId && project.repairId === repairId ? project : null;
      owner.current = requestId; retainOwner.current = retainUntilReleased; busy.current = true; setPending(true); setRecoveryRequestId(requestId);
      if (selected) setSelectedId(selected.id);
      return true;
    }
    if (owner.current !== requestId) return false;
    if (retainOwner.current) releaseOwner(requestId, true);
    else if (project && projectOwner.current === project) releaseOwner(requestId, true);
    else if (!watchReceipt(requestId, () => releaseOwner(requestId, true), () => releaseOwner(requestId))) releaseOwner(requestId);
    return true;
  };
  useEffect(() => {
    // The modal owns the original observer even when saved data removes a child control.
    const observe = () => {
      const requestId = owner.current;
      if (requestId) watchReceipt(requestId, () => { if (retainOwner.current) setRecoveryRequestId(null); else releaseOwner(requestId, true); }, () => releaseOwner(requestId));
    };
    observe();
    return subscribeRecovery(observe);
  }, [watchReceipt, releaseOwner]);
  const dialog = useRef<HTMLDialogElement>(null); const titleId = useId();
  useEffect(() => { if (repairId) dialog.current?.showModal(); }, [repairId]);
  if (!repairId) return null;
  const close = () => { if (!busy.current) onClose(); };
  return createPortal(<dialog className="repair-parts-dialog repair-part-dialog repair-items-dialog repair-procurement-dialog" ref={dialog} aria-labelledby={titleId} aria-busy={pending} onClose={close} onCancel={event => { if (busy.current) event.preventDefault(); }} onClickCapture={event => { if (busy.current && !(event.target instanceof Element && event.target.closest("[data-operation-recovery]"))) { event.preventDefault(); event.stopPropagation(); } }} onSubmitCapture={event => { if (busy.current) { event.preventDefault(); event.stopPropagation(); } }}>
    <header><div><small>{repairId}</small><h2 id={titleId}>{t("供应商与配件")}</h2></div><button className="icon-button" type="button" disabled={pending} onClick={close} aria-label={t("关闭配件操作")}><X size={20} /></button></header>
    <div className="repair-procurement-dialog__body" data-combobox-boundary><fieldset className="form-fields" disabled={pending}>
    {storageError ? <p className="form-error" role="alert">{systemText(storageError)}</p> : null}
    {order && currentRepairRequirements(order, workflows[order.id]).length === 0 ? <RepairProjectControls order={order} records={records} onPendingChange={setOperationPending}/> : null}
    <RepairItemsForm key={repairId} repairId={repairId} requirementId={initialRequirementId} confirmedProject={confirmedProject} onSaved={close} onCancel={close} onPendingChange={setOperationPending} footerTarget={footerTarget} dialogPending={pending} />
    {selected ? <details className="repair-workflow-history repair-existing-parts" open={initialRecordId ? true : undefined}>
      <summary><PackageSearch size={16} />{t("配件记录 ")}<small>{relatedRows.length}</small></summary>
      {relatedRows.length > 1 ? <label className="field"><span>{t("查看配件记录")}</span><SelectControl disabled={pending} aria-label={t("本次操作的配件")} value={selected.id} onChange={event => { if (busy.current) return; setSelectedId(event.target.value); setLegacyEdit(false); }}>{relatedRows.map(row => <option key={row.id} value={row.id}>{repairItemText(row.item, locale)} · {row.supplier} · {row.id}{row.required === false ? t(" · 备选") : ""}</option>)}</SelectControl></label> : null}
      {legacyEdit ? <RepairPartForm key={selected.id} repairId={repairId} record={selected} onSaved={() => { if (!busy.current) setLegacyEdit(false); }} onCancel={() => { if (!busy.current) setLegacyEdit(false); }} onPendingChange={setOperationPending} /> : <>
        <div className="repair-parts-dialog__item"><strong>{repairItemText(selected.item, locale)}</strong><span>{t(procurementStatuses[procurementStatus(selected)].label)}</span>{selected.specification ? <p>{selected.specification}</p> : null}<span>{selected.supplier} · {selected.quantity} {t(" 件")}{selected.required === false ? t(" · 备选") : ""}</span>{canEdit && !selected.requirementId ? <button className="button button--secondary button--tiny" type="button" onClick={() => setLegacyEdit(true)}><Pencil size={14} />{t("编辑旧配件记录")}</button> : null}</div>
        {order && selected.requirementId ? <RepairPartReconfirmation key={selected.requirementId} order={order} requirement={currentRepairRequirements(order, workflows[order.id]).find(row => row.id === selected.requirementId)} rows={rows.filter(row => row.requirementId === selected.requirementId)} onPendingChange={setOperationPending} /> : null}
        <ProcurementActions key={selected.id} record={selected} embedded onPendingChange={setOperationPending} />
        {selected.events.length ? <details className="repair-workflow-history"><summary><History size={16} />{t("配件历史 ")}<small>{selected.events.length}</small></summary><ol className="detail-timeline">{selected.events.toReversed().map(event => <li key={event.id}><i className="timeline-dot timeline-dot--info" /><div><strong>{t(procurementEventLabel(event))}</strong><p>{event.note}</p><small>{event.time}</small></div></li>)}</ol></details> : null}
      </>}
    </details> : null}
    </fieldset></div>
    <OperationRecoveryControls requestId={pending?recoveryRequestId:null}/>
    <div className="repair-procurement-dialog__footer" ref={setFooterTarget}/>
  </dialog>, document.body);
}

function RepairPartReconfirmation({order,requirement,rows,onPendingChange}:{order:RepairDirectoryEntry;requirement?:RepairRequirement;rows:ProcurementRecord[];onPendingChange:(pending:boolean,requestId?:string)=>boolean|void}){
  const { t, locale, systemText } = useLanguage();
  const receipt=useOperationReceipt();
  const canEdit=useStaff().can("repairs.edit");const {workflows}=useRepairWorkflows();const [checked,setChecked]=useState(false);const [error,setError]=useState("");const [pending,setPending]=useState(false);const busy=useRef(false);
  const [openedVersion,setOpenedVersion]=useState(()=>({intake:order.intakeRevision??1,workflow:workflows[order.id]?.revision??0,items:rows.map(row=>({id:row.id,revision:row.events.length}))}));
  if(!requirement||!canEdit||(requirement.mode==="parts"&&requirement.confirmed&&rows.every(row=>row.requirementRevision===requirement.revision)))return null;
  async function confirm(){if(!requirement||busy.current||receipt.isWaiting()||!checked)return;const requestId=crypto.randomUUID();if(onPendingChange(true,requestId)===false)return;busy.current=true;setPending(true);setError("");const release=()=>{busy.current=false;onPendingChange(false,requestId);setError("");};try{await reconfirmRepairParts(order,requirement.id,openedVersion.items,openedVersion.workflow,openedVersion.intake,{requestId});}catch(reason){if(!receipt.watch(requestId,release,release))setError(reason instanceof Error?reason.message:"核对失败。");}finally{if(!receipt.isWaiting()){busy.current=false;onPendingChange(false,requestId);}setPending(false);}}
  return <details className="repair-workflow-history"><summary>{t("配件要求待核对")}</summary><p>{repairItemText(requirement.title, locale)} {t(" · 当前要求：")}{requirement.request||t("未指定")}</p><ul>{rows.map(row=><li key={row.id}>{repairItemText(row.item, locale)} · {row.supplier} · {row.specification||t("规格未记录")}</li>)}</ul><label className="review-confirm"><input type="checkbox" checked={checked} disabled={pending||receipt.waiting} onChange={event=>{setChecked(event.target.checked);if(event.target.checked)setOpenedVersion({intake:order.intakeRevision??1,workflow:workflows[order.id]?.revision??0,items:rows.map(row=>({id:row.id,revision:row.events.length}))});}}/><span>{t("已核对上述全部配件符合当前维修要求")}</span></label>{receipt.waiting?<p role="status">{t("提交结果待核对，请处理原提交，勿重复新建。")}</p>:null}{error?<p role="alert" className="form-error">{systemText(error)}</p>:null}<button className="button button--secondary" type="button" disabled={!checked||pending||receipt.waiting} onClick={()=>void confirm()}>{pending?t("正在保存…"):receipt.waiting?t("待核对"):t("确认当前配件关联")}</button></details>;
}
