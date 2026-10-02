"use client";

import { useEffect, useRef, useState, type PointerEvent } from "react";
import { createPortal } from "react-dom";
import { ArrowDown, ArrowUp, Check, GripVertical, X } from "lucide-react";
import { saveStoreSettings } from "@/components/settings/settings-store";
import { defaultRepairGroups, moveRepairGroup, parseRepairGroups, type RepairGroupItem, type RepairGroupKind, type RepairGroupSettings } from "@/lib/repair-groups";
import type { StoreSettings } from "@/lib/store-settings";
import styles from "./repair-group-editor.module.css";

export function RepairGroupEditor({ settings, kind, onClose, onSaved }: { settings: StoreSettings; kind: RepairGroupKind; onClose: () => void; onSaved: () => void }) {
  const dialog = useRef<HTMLDialogElement>(null);
  const list = useRef<HTMLDivElement>(null);
  const [revision] = useState(settings.revision);
  const [initial] = useState(() => structuredClone(settings.repairGroups ?? defaultRepairGroups()));
  const [rows, setRows] = useState<RepairGroupItem[]>(() => initial[kind]);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [saving, setSaving] = useState(false);
  const busy = useRef(false);
  const pointer = useRef<{ id: number; key: string; target: string; startY: number; moved: boolean } | null>(null);
  const [drag, setDrag] = useState<{ key: string; target: string } | null>(null);
  const changed = JSON.stringify(rows) !== JSON.stringify(initial[kind]);
  useEffect(() => { const element = dialog.current; element?.showModal(); return () => element?.close(); }, []);
  function move(key: string, target: string) {
    setRows(current => moveRepairGroup(current, key, target));
    setMessage("分组顺序已调整，保存后对全店生效。");
  }
  function pointerMove(event: PointerEvent<HTMLButtonElement>) {
    const current = pointer.current;
    if (!current || current.id !== event.pointerId) return;
    if (Math.abs(event.clientY - current.startY) > 5) current.moved = true;
    if (!current.moved) return;
    const container = list.current;
    if (!container) return;
    const bounds = container.getBoundingClientRect();
    if (event.clientY < bounds.top + 36) container.scrollTop -= 18;
    else if (event.clientY > bounds.bottom - 36) container.scrollTop += 18;
    const target = document.elementFromPoint(event.clientX, event.clientY)?.closest<HTMLElement>("[data-repair-group]");
    if (target && container.contains(target) && target.dataset.repairGroup) current.target = target.dataset.repairGroup;
    setDrag({ key: current.key, target: current.target });
  }
  function finish(event: PointerEvent<HTMLButtonElement>, cancel = false) {
    const current = pointer.current;
    pointer.current = null; setDrag(null);
    if (event.currentTarget.hasPointerCapture(event.pointerId)) event.currentTarget.releasePointerCapture(event.pointerId);
    if (!cancel && current?.moved && current.id === event.pointerId) move(current.key, current.target);
  }
  async function save() {
    if (busy.current) return;
    busy.current = true; setSaving(true); setError("");
    try {
      const repairGroups = parseRepairGroups({ ...initial, [kind]: rows } as RepairGroupSettings);
      await saveStoreSettings(revision, current => ({ ...current, repairGroups }));
      onSaved();
    } catch (reason) { setError(reason instanceof Error ? reason.message : "保存失败，请重试。"); }
    finally { busy.current = false; setSaving(false); }
  }
  return createPortal(<dialog ref={dialog} className={`repair-parts-dialog ${styles.dialog}`} aria-label="管理维修分组" onCancel={event => { event.preventDefault(); if (!busy.current) onClose(); }} onClose={event => { if (!event.currentTarget.open) onClose(); }}>
    <header><h2>管理{kind === "workflow" ? "维修状态" : "配件"}分组</h2><button className="icon-button" type="button" disabled={saving} aria-label="关闭分组管理" onClick={onClose}><X size={18} /></button></header>
    <p className={styles.hint}>拖动手柄调整顺序，修改名称后保存。更改对全店生效。</p>
    <div className={styles.list} ref={list}>
      {rows.map((row, index) => <div className={`${styles.row}${drag?.target === row.key && drag.key !== row.key ? ` ${rows.findIndex(item => item.key === drag.key) < index ? styles.targetAfter : styles.targetBefore}` : ""}${drag?.key === row.key ? ` ${styles.dragging}` : ""}`} key={row.key} data-repair-group={row.key}>
        <button className={`icon-button ${styles.handle}`} type="button" disabled={saving} aria-label={`拖动分组 ${row.label}`} title="拖动排序，也可按方向键上下移动" onPointerDown={event => {
          if (!event.isPrimary || event.button !== 0 || busy.current) return;
          event.currentTarget.focus(); event.currentTarget.setPointerCapture(event.pointerId);
          pointer.current = { id: event.pointerId, key: row.key, target: row.key, startY: event.clientY, moved: false };
        }} onPointerMove={pointerMove} onPointerUp={event => finish(event)} onPointerCancel={event => finish(event, true)} onLostPointerCapture={() => { pointer.current = null; setDrag(null); }} onKeyDown={event => {
          const next = event.key === "ArrowUp" ? index - 1 : event.key === "ArrowDown" ? index + 1 : -1;
          if (["ArrowUp", "ArrowDown"].includes(event.key)) { event.preventDefault(); if (rows[next]) move(row.key, rows[next].key); }
        }}><GripVertical size={20} /></button>
        <label className={`field ${styles.name}`}><span className={styles.srOnly}>分组名称 {initial[kind].find(item => item.key === row.key)?.label}</span><input value={row.label} maxLength={40} disabled={saving} onChange={event => { const label = event.target.value; setRows(current => current.map(item => item.key === row.key ? { ...item, label } : item)); }} /></label>
        <button className="icon-button" type="button" disabled={saving || index === 0} aria-label={`上移分组 ${row.label}`} onClick={() => move(row.key, rows[index - 1].key)}><ArrowUp size={17} /></button>
        <button className="icon-button" type="button" disabled={saving || index === rows.length - 1} aria-label={`下移分组 ${row.label}`} onClick={() => move(row.key, rows[index + 1].key)}><ArrowDown size={17} /></button>
      </div>)}
    </div>
    <span className={styles.srOnly} role="status">{message}</span>
    {error ? <p className="form-error" role="alert">{error}</p> : null}
    <footer><button className="button button--secondary" type="button" disabled={saving} onClick={onClose}>取消</button><button className="button button--primary" type="button" disabled={saving || !changed} onClick={save}><Check size={17} />{saving ? "正在保存…" : "保存分组"}</button></footer>
  </dialog>, document.body);
}
