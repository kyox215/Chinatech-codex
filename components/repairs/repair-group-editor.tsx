"use client";

import { InputControl } from "@/components/input-control";
import { useEffect, useLayoutEffect, useRef, useState, type PointerEvent } from "react";
import { createPortal } from "react-dom";
import { ArrowDown, ArrowUp, Check, GripVertical, X } from "lucide-react";
import { saveStoreSettings } from "@/components/settings/settings-store";
import { defaultRepairGroups, parseRepairGroups, moveRepairGroup, visibleRepairGroups, mergeVisibleRepairGroups, type RepairGroupItem, type RepairGroupKind } from "@/lib/repair-groups";
import type { StoreSettings } from "@/lib/store-settings";
import styles from "./repair-group-editor.module.css";

export function RepairGroupEditor({ settings, kind, onClose, onSaved }: { settings: StoreSettings; kind: RepairGroupKind; onClose: () => void; onSaved: () => void }) {
  const dialog = useRef<HTMLDialogElement>(null);
  const list = useRef<HTMLDivElement>(null);
  const [revision] = useState(settings.revision);
  const [initial] = useState(() => parseRepairGroups(settings.repairGroups ?? defaultRepairGroups()));
  const [rows, setRows] = useState<RepairGroupItem[]>(() => visibleRepairGroups(initial, kind));
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [saving, setSaving] = useState(false);
  const busy = useRef(false);
  type DragPosition = { key: string; top: number; height: number };
  type DragSession = { id: number; key: string; target: string; startY: number; y: number; startScroll: number; moved: boolean; positions: DragPosition[]; from: number };
  const pointer = useRef<DragSession | null>(null);
  const frame = useRef<number | null>(null);
  const settle = useRef<Map<string, number> | null>(null);
  const [drag, setDrag] = useState<{ key: string; target: string; offset: number; from: number; to: number; positions: DragPosition[] } | null>(null);
  const changed = JSON.stringify(rows) !== JSON.stringify(visibleRepairGroups(initial, kind));
  function stopFrame() {
    if (frame.current !== null) cancelAnimationFrame(frame.current);
    frame.current = null;
  }
  useEffect(() => { const element = dialog.current; element?.showModal(); return () => element?.close(); }, []);
  useEffect(() => {
    const cancel = () => { stopFrame(); pointer.current = null; setDrag(null); };
    window.addEventListener("blur", cancel); window.addEventListener("resize", cancel);
    return () => { stopFrame(); window.removeEventListener("blur", cancel); window.removeEventListener("resize", cancel); };
  }, []);
  useLayoutEffect(() => {
    const before = settle.current; settle.current = null;
    if (!before || !list.current || window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    for (const element of list.current.querySelectorAll<HTMLElement>("[data-repair-group]")) {
      const previous = before.get(element.dataset.repairGroup!);
      if (previous === undefined) continue;
      const offset = previous - element.getBoundingClientRect().top;
      if (Math.abs(offset) > 1) element.animate([{ transform: `translateY(${offset}px)` }, { transform: "translateY(0)" }], { duration: 180, easing: "cubic-bezier(.2,.8,.2,1)" });
    }
  }, [rows, drag]);
  function capturePositions() {
    return new Map(Array.from(list.current?.querySelectorAll<HTMLElement>("[data-repair-group]") ?? []).map(element => [element.dataset.repairGroup!, element.getBoundingClientRect().top]));
  }
  function move(key: string, target: string) {
    if (key === target) return;
    settle.current = capturePositions();
    setRows(current => moveRepairGroup(current, key, target));
    setMessage("分组顺序已调整，保存后对全店生效。");
  }
  function updateDrag() {
    const current = pointer.current; const container = list.current;
    if (!current?.moved || !container) return;
    const source = current.positions[current.from];
    const last = current.positions[current.positions.length - 1];
    const offset = Math.min(last.top - source.top, Math.max(current.positions[0].top - source.top, current.y - current.startY + container.scrollTop - current.startScroll));
    const center = source.top + offset + source.height / 2;
    const to = current.positions.reduce((nearest, position, index) => Math.abs(position.top + position.height / 2 - center) < Math.abs(current.positions[nearest].top + current.positions[nearest].height / 2 - center) ? index : nearest, current.from);
    current.target = current.positions[to].key;
    setDrag(previous => previous?.offset === offset && previous.to === to ? previous : { key: current.key, target: current.target, offset, from: current.from, to, positions: current.positions });
  }
  function scrollDrag() {
    const current = pointer.current; const container = list.current;
    if (!current || !container) { frame.current = null; return; }
    if (current.moved) {
      const bounds = container.getBoundingClientRect();
      const edge = 40;
      const step = current.y < bounds.top + edge ? -Math.min(12, (bounds.top + edge - current.y) / 4) : current.y > bounds.bottom - edge ? Math.min(12, (current.y - bounds.bottom + edge) / 4) : 0;
      if (step) { container.scrollTop += step; updateDrag(); }
    }
    frame.current = requestAnimationFrame(scrollDrag);
  }
  function pointerMove(event: PointerEvent<HTMLButtonElement>) {
    const current = pointer.current;
    if (!current || current.id !== event.pointerId) return;
    current.y = event.clientY;
    if (Math.abs(current.y - current.startY) > 5) current.moved = true;
    updateDrag();
  }
  function finish(event: PointerEvent<HTMLButtonElement>, cancel = false) {
    const current = pointer.current;
    if (!current || current.id !== event.pointerId) return;
    settle.current = capturePositions();
    stopFrame(); pointer.current = null; setDrag(null);
    if (event.currentTarget.hasPointerCapture(event.pointerId)) event.currentTarget.releasePointerCapture(event.pointerId);
    if (!cancel && current.moved && current.key !== current.target) {
      setRows(rows => moveRepairGroup(rows, current.key, current.target));
      setMessage("分组顺序已调整，保存后对全店生效。");
    }
  }
  function rowOffset(index: number, key: string) {
    if (!drag) return 0;
    if (key === drag.key) return drag.offset;
    if (drag.from < drag.to && index > drag.from && index <= drag.to) return drag.positions[index - 1].top - drag.positions[index].top;
    if (drag.from > drag.to && index >= drag.to && index < drag.from) return drag.positions[index + 1].top - drag.positions[index].top;
    return 0;
  }
  async function save() {
    const invalid = Array.from(dialog.current?.querySelectorAll<HTMLInputElement>("input") ?? []).filter(input => !input.checkValidity());
    if (invalid.length) { invalid[0].reportValidity(); return; }
    if (busy.current) return;
    busy.current = true; setSaving(true); setError("");
    try {
      const repairGroups = mergeVisibleRepairGroups(initial, kind, rows);
      await saveStoreSettings(revision, current => ({ ...current, repairGroups }));
      onSaved();
    } catch (reason) { setError(reason instanceof Error ? reason.message : "保存失败，请重试。"); }
    finally { busy.current = false; setSaving(false); }
  }
  return createPortal(<dialog ref={dialog} className={`repair-parts-dialog ${styles.dialog}`} aria-label="管理维修分组" onCancel={event => { event.preventDefault(); if (pointer.current) { settle.current = capturePositions(); stopFrame(); pointer.current = null; setDrag(null); } else if (!busy.current) onClose(); }} onClose={event => { if (!event.currentTarget.open) onClose(); }}>
    <header><h2>管理{kind === "workflow" ? "维修状态" : "配件"}分组</h2><button className="icon-button" type="button" disabled={saving} aria-label="关闭分组管理" onClick={onClose}><X size={18} /></button></header>
    <p className={styles.hint}>{kind === "workflow" ? "名称与维修阶段一致，拖动手柄调整顺序。" : "拖动手柄调整顺序，修改名称后保存。"}更改对全店生效。</p>
    <div className={styles.list} ref={list} data-dragging={Boolean(drag)}>
      {drag ? <div className={styles.placeholder} aria-hidden="true" style={{ top: drag.positions[drag.to].top, height: drag.positions[drag.from].height }} /> : null}
      {rows.map((row, index) => <div className={`${styles.row}${drag?.key === row.key ? ` ${styles.dragging}` : ""}`} style={{ transform: `translateY(${rowOffset(index, row.key)}px)` }} key={row.key} data-repair-group={row.key}>
        <button className={`icon-button ${styles.handle}`} type="button" disabled={saving} aria-label={`拖动分组 ${row.label}`} title="拖动排序，也可按方向键上下移动" onPointerDown={event => {
          if (!event.isPrimary || event.button !== 0 || busy.current || pointer.current || !list.current) return;
          for (const element of list.current.querySelectorAll<HTMLElement>("[data-repair-group]")) element.getAnimations().forEach(animation => animation.cancel());
          const bounds = list.current.getBoundingClientRect();
          const positions = Array.from(list.current.querySelectorAll<HTMLElement>("[data-repair-group]")).map(element => { const rect = element.getBoundingClientRect(); return { key: element.dataset.repairGroup!, top: rect.top - bounds.top + list.current!.scrollTop, height: rect.height }; });
          event.currentTarget.focus(); event.currentTarget.setPointerCapture(event.pointerId);
          pointer.current = { id: event.pointerId, key: row.key, target: row.key, startY: event.clientY, y: event.clientY, startScroll: list.current.scrollTop, moved: false, positions, from: index };
          frame.current = requestAnimationFrame(scrollDrag);
        }} onPointerMove={pointerMove} onPointerUp={event => finish(event)} onPointerCancel={event => finish(event, true)} onLostPointerCapture={event => finish(event, true)} onKeyDown={event => {
          if (pointer.current) return;
          const next = event.key === "ArrowUp" ? index - 1 : event.key === "ArrowDown" ? index + 1 : -1;
          if (["ArrowUp", "ArrowDown"].includes(event.key)) { event.preventDefault(); if (rows[next]) move(row.key, rows[next].key); }
        }}><GripVertical size={20} /></button>
        <label className={`field ${styles.name}`}><span className={styles.srOnly}>分组名称 {initial[kind].find(item => item.key === row.key)?.label}</span><InputControl readOnly={kind === "workflow"} required validate={value => value.trim() ? "" : "分组名称不能为空，请填写便于识别的名称。"} aria-label={`分组名称 ${initial[kind].find(item => item.key === row.key)?.label ?? row.label}`} placeholder="填写分组名称" onClear={() => { const label = ""; setRows(current => current.map(item => item.key === row.key ? { ...item, label } : item)); }} clearLabel={`清空分组名称 ${row.label}`} value={row.label} maxLength={40} disabled={saving} onChange={event => { const label = event.target.value; setRows(current => current.map(item => item.key === row.key ? { ...item, label } : item)); }} /></label>
        <button className="icon-button" type="button" disabled={saving || index === 0} aria-label={`上移分组 ${row.label}`} onClick={() => move(row.key, rows[index - 1].key)}><ArrowUp size={17} /></button>
        <button className="icon-button" type="button" disabled={saving || index === rows.length - 1} aria-label={`下移分组 ${row.label}`} onClick={() => move(row.key, rows[index + 1].key)}><ArrowDown size={17} /></button>
      </div>)}
    </div>
    <span className={styles.srOnly} role="status">{message}</span>
    {error ? <p className="form-error" role="alert">{error}</p> : null}
    <footer><button className="button button--secondary" type="button" disabled={saving} onClick={onClose}>取消</button><button className="button button--primary" type="button" disabled={saving || Boolean(drag) || !changed} onClick={save}><Check size={17} />{saving ? "正在保存…" : "保存分组"}</button></footer>
  </dialog>, document.body);
}
