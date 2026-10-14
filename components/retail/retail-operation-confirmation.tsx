"use client";
import { OperationRecoveryControls, useOperationReceipt } from "@/components/use-operation-receipt";
import { useLanguage } from "@/components/language-provider";
import { useEffect, useRef, useState, type RefObject } from "react";
import { CheckCircle2, X } from "lucide-react";
import { retailStatuses, type RetailCommand, type RetailEvent, type RetailUnit } from "@/lib/retail";
import { useRetail } from "./retail-provider";
import styles from "./retail-detail.module.css";

export type PendingRetailOperation = { command: RetailCommand; event: RetailEvent; version: number; nextStatus: RetailUnit["status"] };
const checkLabels = { functional: "功能检测", ownership: "所有权及账号锁核验", data: "数据处理核验" };
export function RetailOperationConfirmation({ unit, pending, onClose, restoreFocusRef }: { unit: RetailUnit; pending: PendingRetailOperation; onClose: () => void; restoreFocusRef: RefObject<HTMLElement | null> }) {
  const { t , systemText } = useLanguage();
  const { dispatch, feedback, error, ready } = useRetail();
  const receipt = useOperationReceipt();
  const region = useRef<HTMLElement>(null);
  const busy = useRef(false);
  const alive = useRef(true);
  const [submitting, setSubmitting] = useState(false);
  const [attempted, setAttempted] = useState(false);
  useEffect(() => {
    alive.current = true;
    const previous = restoreFocusRef.current;
    region.current?.scrollIntoView({block:"nearest"}); region.current?.focus({preventScroll:true});
    return () => { alive.current = false; if (previous?.isConnected) previous.focus({preventScroll:true}); };
  }, [restoreFocusRef]);
  const conflict = unit.version !== pending.version;
  function close() { if (!busy.current) onClose(); }
  async function confirm() {
    if (busy.current || receipt.isWaiting() || conflict || !ready || error) return;
    busy.current = true; setSubmitting(true); setAttempted(true);
    const requestId=crypto.randomUUID();
    try {
      const saved=await dispatch({ type: "command", id: unit.id, command: pending.command, event: pending.event, version: pending.version },{requestId});
      if(saved&&alive.current)onClose();else if(!saved)receipt.watch(requestId,()=>{if(alive.current)onClose();},()=>{busy.current=false;});
    } finally { if(!receipt.isWaiting())busy.current = false; if (alive.current) setSubmitting(false); }
  }
  const command = pending.command;
  const title = command.type === "inspect" ? "确认记录检测" : command.type === "approve" ? "确认设为可售" : command.type === "pause" ? "确认暂停销售" : "确认重新检测";
  return <section ref={region} tabIndex={-1} className={styles.inlineConfirmation} aria-label={t("确认单机操作")} aria-busy={submitting} onKeyDown={event => { if(event.key === "Escape" && !event.defaultPrevented) { event.preventDefault(); close(); } }}>
    <header><div><small>{unit.code}</small><h4>{t(title)}</h4></div><button type="button" className="icon-button" aria-label={t("关闭操作确认")} disabled={submitting||receipt.waiting} onClick={close}><X size={18} /></button></header>
    <div className={styles.confirmBody}>{command.type === "inspect" ? <ul>{Object.entries(checkLabels).map(([key, label]) => <li key={key}><span>{t(label)}</span><strong>{unit.inspection[key as keyof typeof checkLabels] ? t("已记录") : t("未完成")} → {command.checks[key as keyof typeof checkLabels] ? t("已记录") : t("未完成")}</strong></li>)}</ul> : <p>{t(retailStatuses[unit.status].label)} → {t(retailStatuses[pending.nextStatus].label)}</p>}<p>{pending.event.detail}</p>{command.type === "inspect" ? <small>{t("记录检测后仍需明确设为可售。")}</small> : command.type === "reinspect" ? <small>{t("重新检测后，三项核验将清空。")}</small> : null}{receipt.waiting ? <p role="status">{t("提交结果待核对，请处理原提交，勿重复新建。")}</p> : conflict || error || attempted && feedback?.id === unit.id && feedback.error ? <p className="form-error" role="alert">{conflict ? t("单机已被更新，请重新核对。") : systemText(error || feedback?.message || "")}</p> : null}</div>
    <OperationRecoveryControls requestId={receipt.requestId}/>
    <footer><button type="button" className="button button--secondary" disabled={submitting||receipt.waiting} onClick={close}>{t("取消")}</button><button type="button" className="button button--primary" disabled={submitting || receipt.waiting || conflict || !ready || Boolean(error)} aria-busy={submitting} onClick={confirm}><CheckCircle2 size={17} />{submitting ? t("正在保存…") : receipt.waiting ? t("待核对") : t("确认操作")}</button></footer>
  </section>;
}
