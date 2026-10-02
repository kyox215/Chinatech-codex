"use client";

import { createContext, useContext, useEffect, useRef, useState, type ReactNode } from "react";
import { Check, ChevronRight, Pencil, Package, Sparkles, X } from "lucide-react";
import { ColorPicker } from "@/components/color-picker";
import { IdentifierField } from "@/components/identifier-field";
import { SingleChoice } from "@/components/single-choice";
import { RetailDateControl, RetailMoneyControl, RetailNumberControl } from "./retail-input-controls";
import { SelectControl } from "@/components/select-control";
import { intakeRecordTime } from "@/lib/repair-intake-record";
import { canEditRetailField, parseRetailMoney, retailCategories, retailFieldLabels, retailMoney, retailWarrantyLabel, validateRetailFieldEdit, type Capacity, type RetailDisk, type RetailEditableField, type RetailFieldValue, type RetailUnit } from "@/lib/retail";
import { useRetail } from "./retail-provider";
import { RetailWarrantyControl } from "./retail-warranty-control";
import { RetailCatalogControl, RetailDisksControl, RetailRamControl, RetailStorageControl } from "./retail-spec-controls";
import { useStaff } from "@/components/staff/use-staff";
import { retailFieldPermission } from "@/lib/retail-access";
import styles from "./retail-field-editor.module.css";

const moneyFields = ["costCents", "refurbCents", "priceCents"];
const activeEdit = createContext<RetailEditableField | null>(null);
export function RetailEditScope({ field, children }: { field: RetailEditableField | null; children: ReactNode }) { return <activeEdit.Provider value={field}>{children}</activeEdit.Provider>; }
export function retailFieldText(field: RetailEditableField, value: RetailFieldValue): string {
  if (moneyFields.includes(field)) return retailMoney(value as number | null);
  if (field === "warrantyMonths") return value === null ? "无额外商家保修" : retailWarrantyLabel(value as number);
  if (value === null || value === "") return "未记录";
  if (field === "category") return retailCategories[value as RetailUnit["category"]];
  if (field === "ramGb") return `${value} GB`;
  if (field === "batteryPercent") return `${value}%`;
  if (field === "controllers") return `${value} 个`;
  if (field === "bodyStorage") { const storage = value as Capacity; return `${storage.capacity ?? "容量未记录"} ${storage.unit}`; }
  if (field === "disks") { const disks = value as RetailDisk[]; return disks.length ? disks.map((disk, index) => `${index + 1}. ${disk.capacity ?? "容量未记录"} ${disk.unit} ${disk.type}`).join(" / ") : "未记录"; }
  return String(value);
}

export function RetailFieldButton({ unit, field, onEdit, children, compact = false, className = "" }: { unit: RetailUnit; field: RetailEditableField; onEdit: (field: RetailEditableField) => void; children?: ReactNode; compact?: boolean; className?: string }) {
  const { ready, error } = useRetail();
  const staff = useStaff();
  const active = useContext(activeEdit);
  const blocked = active !== null && active !== field;
  const editable = canEditRetailField(unit, field) && staff.can(retailFieldPermission(field));
  if (field === "code") return <div className={`${styles.fieldButton} ${className}`} title="创建时自动生成，保留原编号"><span className={styles.valueGroup}><small>{retailFieldLabels[field]}</small><span className={styles.value}>{unit.code}</span></span></div>;
  return <button type="button" className={`${styles.fieldButton}${compact ? ` ${styles.compact}` : ""} ${className}`} aria-label={`编辑${retailFieldLabels[field]}`} aria-expanded={active === field} title={blocked ? "先保存或取消当前编辑" : !staff.can(retailFieldPermission(field)) ? "当前账号无此编辑权限" : editable ? `编辑${retailFieldLabels[field]}` : "当前状态保留已有资料"} disabled={blocked || !editable || !ready || Boolean(error)} onClick={() => onEdit(field)}>
    <span className={styles.valueGroup}>{compact ? null : <small>{retailFieldLabels[field]}</small>}<span className={styles.value}>{children ?? retailFieldText(field, unit[field])}</span></span>{editable ? <Pencil size={13} aria-hidden="true" /> : null}
  </button>;
}

export function RetailFieldEditor({ unit, field, onClose, initialCandidate }: { unit: RetailUnit; field: RetailEditableField; onClose: () => void; initialCandidate?: RetailUnit }) {
  const { units, dispatch, ready, error: storageError, feedback } = useRetail();
  const [original] = useState(unit);
  const [value, setValue] = useState<RetailFieldValue>(() => structuredClone((initialCandidate ?? unit)[field]));
  const [raw, setRaw] = useState(() => moneyFields.includes(field) ? unit[field] === null ? "" : (Number(unit[field]) / 100).toFixed(2) : String(unit[field] ?? ""));
  const [note, setNote] = useState("");
  const [candidate, setCandidate] = useState<RetailUnit | null>(initialCandidate ?? null);
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [attempted, setAttempted] = useState(false);
  const region = useRef<HTMLElement>(null);
  const body = useRef<HTMLDivElement>(null);
  const busy = useRef(false);
  const heading = useRef<HTMLHeadingElement>(null);
  useEffect(() => {
    const previousFocus = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    region.current?.scrollIntoView({ block: "nearest" });
    return () => { if (previousFocus?.isConnected) previousFocus.focus({ preventScroll: true }); };
  }, []);
  useEffect(() => {
    const target = candidate ? heading.current : body.current?.querySelector<HTMLElement>('input:not([type="hidden"]),select,textarea,button,summary');
    target?.focus({preventScroll:true});
  }, [candidate]);
  const label = retailFieldLabels[field];
  const current = units.find(item => item.id === original.id);
  const conflict = current?.version !== original.version;
  const storedFailure = attempted && feedback?.id === original.id && feedback.error ? feedback.message : "";
  function next() {
    try {
      if (conflict) throw new Error("单机已被其他操作更新，请关闭并重新打开编辑。");
      const nextValue = moneyFields.includes(field) ? parseRetailMoney(raw) : value;
      const updated = validateRetailFieldEdit(original, { field, value: nextValue }, units);
      if (updated === original) throw new Error("资料没有变化，请修改后再继续。");
      setCandidate(updated); setError(""); setAttempted(false);
    } catch (reason) { setError(reason instanceof Error ? reason.message : "请核对资料。"); }
  }
  async function save() {
    if (!candidate || busy.current) return;
    busy.current = true; setSubmitting(true); setAttempted(true); setError("");
    const detail = `${label}：${retailFieldText(field, original[field])} → ${retailFieldText(field, candidate[field])}；${note.trim() || "逐项资料更正"}`;
    const saved = await dispatch({ type: "command", id: original.id, version: original.version, command: { type: "edit", change: { field, value: candidate[field] } }, event: { id: crypto.randomUUID(), title: `更正${label}`, detail, time: intakeRecordTime() } });
    if (saved) onClose(); else { busy.current = false; setSubmitting(false); }
  }
  const textControl = <label className="field"><span>{label}</span><input aria-label={label} value={String(value ?? "")} maxLength={field === "model" ? 120 : field === "brand" || field === "color" ? 60 : 300} type={field === "intakeDate" ? "date" : "text"} onInput={field === "intakeDate" ? event => setValue(event.currentTarget.value) : undefined} onChange={event => setValue(event.target.value)} /></label>;
  let control: ReactNode = textControl;
  if (field === "serial" || field === "imei1" || field === "imei2" || field === "productCode") control = <IdentifierField label={label} value={String(value)} onChange={setValue} kind={field === "imei1" || field === "imei2" ? "imei" : "serial"} placeholder={field === "imei1" || field === "imei2" ? "15 位数字；未知请留空" : "未知请留空"} />;
  else if (field === "color") control = <ColorPicker value={String(value)} onChange={setValue} />;
  else if (field === "brand" || field === "model" || field === "cpu" || field === "gpu" || field === "keyboard" || field === "edition") control = <RetailCatalogControl field={field} category={original.category} brand={original.brand} units={units} value={String(value)} onChange={setValue} label={label} required={field === "model"} />;
  else if (field === "ramGb") control = <RetailRamControl value={value as number | null} onChange={setValue} />;
  else if (field === "batteryPercent" || field === "controllers") control = <RetailNumberControl label={label} value={value as number | null} onChange={setValue} battery={field === "batteryPercent"} unit={field === "batteryPercent" ? "%" : "个"} />;
  else if (field === "intakeDate") control = <RetailDateControl label={label} value={String(value)} onChange={setValue} clearable />;
  else if (field === "warrantyMonths") control = <RetailWarrantyControl value={value as number | null} onChange={setValue} />;
  else if (field === "condition" || field === "grade") control = <SingleChoice label={label} value={String(value)} onChange={setValue} options={(field === "condition" ? [{value:"新机",label:"新机",icon:Package},{value:"翻新机",label:"翻新机",icon:Sparkles}] : ["待评估","S","A","B","C"].map(item => ({value:item,label:item})))} />;
  else if (field === "category") control = <label className="field"><span>{label}</span><SelectControl aria-label={label} value={String(value)} onChange={event => setValue(event.target.value)}>{Object.entries(retailCategories).map(([key,text]) => <option value={key} key={key}>{text}</option>)}</SelectControl></label>;
  else if (moneyFields.includes(field)) control = <RetailMoneyControl label={label} value={raw} onChange={setRaw} />;
  else if (field === "knownIssues" || field === "accessories" || field === "source") control = <label className="field"><span>{label}</span><textarea aria-label={label} value={String(value)} maxLength={600} onChange={event => setValue(event.target.value)} /></label>;
  else if (field === "bodyStorage") {
    control = <RetailStorageControl category={original.category} value={value as Capacity | null} onChange={setValue} />;
  } else if (field === "disks") control = <RetailDisksControl value={value as RetailDisk[]} onChange={setValue} category={original.category} />;
  return <section ref={region} className={styles.editor} aria-label={`编辑${label}`} onKeyDown={event => { if (event.key === "Escape" && !event.defaultPrevented) { event.preventDefault(); onClose(); } }}>

    <header><div><small>{original.code}</small><h4 ref={heading} tabIndex={-1}>{candidate ? "确认修改" : `编辑${label}`}</h4></div><button type="button" className="icon-button" aria-label="关闭资料编辑" onClick={onClose}><X size={18} /></button></header>
    <div ref={body} className={styles.body}>{candidate ? <><dl className={styles.compare}><div><dt>修改前 · {label}</dt><dd>{retailFieldText(field, original[field])}</dd></div><div><dt>修改后 · {label}</dt><dd>{retailFieldText(field, candidate[field])}</dd></div></dl>{candidate.status !== original.status ? <p className={styles.impact}>本次更正涉及核验资料，保存后转为待检测，三项核验将重新确认。</p> : null}<p className={styles.note}>仅保存本次字段更正，并追加到本台单机历史。</p></> : <>{control}<details className={styles.noteDetails}><summary>更正备注（选填）</summary><label className="field"><span className="visually-hidden">更正备注</span><textarea aria-label="更正备注" maxLength={300} value={note} onChange={event => setNote(event.target.value)} /></label></details></>}{conflict || error || storageError || (candidate && storedFailure) ? <p className="form-error" role="alert">{conflict ? "单机已被其他操作更新，请关闭并重新打开编辑。" : error || storageError || storedFailure}</p> : null}</div>
    <footer><button type="button" className="button button--secondary" disabled={submitting} onClick={onClose}>取消</button>{candidate ? <><button type="button" className="button button--secondary" disabled={submitting} onClick={() => { setCandidate(null); setError(""); }}>返回修改</button><button type="button" className="button button--primary" disabled={submitting || conflict || !ready || Boolean(storageError)} onClick={save}><Check size={17} />{submitting ? "正在保存" : "确认保存"}</button></> : <button type="button" className="button button--primary" disabled={conflict || !ready || Boolean(storageError)} onClick={next}>继续确认<ChevronRight size={17} /></button>}</footer>
  </section>;
}
