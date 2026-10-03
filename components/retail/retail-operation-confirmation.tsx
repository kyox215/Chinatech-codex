"use client";
import { useEffect, useRef, useState, type RefObject } from "react";
import { CheckCircle2, X } from "lucide-react";
import { retailStatuses, type RetailCommand, type RetailEvent, type RetailUnit } from "@/lib/retail";
import { useRetail } from "@/components/backend-domain-context";
import styles from "./retail-detail.module.css";

export type PendingRetailOperation = { command: RetailCommand; event: RetailEvent; version: number; nextStatus: RetailUnit["status"] };
const checkLabels = { functional: "功能检测", ownership: "所有权及账号锁核验", data: "数据处理核验" };
export function RetailOperationConfirmation({ unit, pending, onClose, restoreFocusRef }: { unit: RetailUnit; pending: PendingRetailOperation; onClose: () => void; restoreFocusRef: RefObject<HTMLElement | null> }) {
  const { dispatch, feedback, error, ready } = useRetail();
  const region = useRef<HTMLElement>(null);
  const busy = useRef(false);
  const [attempted, setAttempted] = useState(false);
  useEffect(() => {
    const previous = restoreFocusRef.current;
    region.current?.scrollIntoView({block:"nearest"}); region.current?.focus({preventScroll:true});
    return () => { if (previous?.isConnected) previous.focus({preventScroll:true}); };
  }, [restoreFocusRef]);
  const conflict = unit.version !== pending.version;
  async function confirm() {
    if (busy.current) return;
    busy.current = true; setAttempted(true);
    if (await dispatch({ type: "command", id: unit.id, command: pending.command, event: pending.event, version: pending.version })) onClose();
    else busy.current = false;
  }
  const command = pending.command;
  const title = command.type === "inspect" ? "确认记录检测" : command.type === "approve" ? "确认设为可售" : command.type === "pause" ? "确认暂停销售" : "确认重新检测";
  return <section ref={region} tabIndex={-1} className={styles.inlineConfirmation} aria-label="确认单机操作" onKeyDown={event => { if(event.key === "Escape" && !event.defaultPrevented) { event.preventDefault(); onClose(); } }}>
    <header><div><small>{unit.code}</small><h4>{title}</h4></div><button type="button" className="icon-button" aria-label="关闭操作确认" onClick={onClose}><X size={18} /></button></header>
    <div className={styles.confirmBody}>{command.type === "inspect" ? <ul>{Object.entries(checkLabels).map(([key, label]) => <li key={key}><span>{label}</span><strong>{unit.inspection[key as keyof typeof checkLabels] ? "已记录" : "未完成"} → {command.checks[key as keyof typeof checkLabels] ? "已记录" : "未完成"}</strong></li>)}</ul> : <p>{retailStatuses[unit.status].label} → {retailStatuses[pending.nextStatus].label}</p>}<p>{pending.event.detail}</p>{command.type === "inspect" ? <small>记录检测后仍需明确设为可售。</small> : command.type === "reinspect" ? <small>重新检测后，三项核验将清空。</small> : null}{conflict || error || attempted && feedback?.id === unit.id && feedback.error ? <p className="form-error" role="alert">{conflict ? "单机已被更新，请重新核对。" : error || feedback?.message}</p> : null}</div>
    <footer><button type="button" className="button button--secondary" onClick={onClose}>取消</button><button type="button" className="button button--primary" disabled={conflict || !ready || Boolean(error)} onClick={confirm}><CheckCircle2 size={17} />确认操作</button></footer>
  </section>;
}
