"use client";
import { useLanguage } from "@/components/language-provider";
import { controlError } from "@/components/control-feedback";
import { InputControl, TextareaControl } from "@/components/input-control";
import { useDeviceDraft, DeviceDraftNotice } from "@/components/use-device-draft";

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
export function retailFieldText(field: RetailEditableField, value: RetailFieldValue, display: (text: string) => string = text => text): string {
  if (moneyFields.includes(field)) return display(retailMoney(value as number | null));
  if (field === "warrantyMonths") return display(value === null ? "无额外商家保修" : retailWarrantyLabel(value as number));
  if (value === null || value === "") return display("未记录");
  if (field === "category") return display(retailCategories[value as RetailUnit["category"]]);
  if (field === "ramGb") return `${value} GB`;
  if (field === "batteryPercent") return `${value}%`;
  if (field === "controllers") return `${value} ${display("个")}`;
  if (field === "bodyStorage") { const storage = value as Capacity; return `${storage.capacity ?? display("容量未记录")} ${storage.unit}`; }
  if (field === "disks") { const disks = value as RetailDisk[]; return disks.length ? disks.map((disk, index) => `${index + 1}. ${disk.capacity ?? display("容量未记录")} ${disk.unit} ${disk.type}`).join(" / ")  : display("未记录"); }
  return field === "condition" || field === "grade" || field === "color" ? display(String(value)) : String(value);
}

export function RetailFieldButton({ unit, field, onEdit, children, compact = false, className = "" }: { unit: RetailUnit; field: RetailEditableField; onEdit: (field: RetailEditableField) => void; children?: ReactNode; compact?: boolean; className?: string }) {
  const { t } = useLanguage();
  const { ready, error } = useRetail();
  const staff = useStaff();
  const active = useContext(activeEdit);
  const blocked = active !== null && active !== field;
  const editable = canEditRetailField(unit, field) && staff.can(retailFieldPermission(field));
  if (field === "code") return <div className={`${styles.fieldButton} ${className}`} title={t("创建时自动生成，保留原编号")}><span className={styles.valueGroup}><small>{t(retailFieldLabels[field])}</small><span className={styles.value}>{unit.code}</span></span></div>;
  return <button type="button" className={`${styles.fieldButton}${compact ? ` ${styles.compact}` : ""} ${className}`} aria-label={t("编辑{v0}", { v0: t(retailFieldLabels[field]) })} aria-expanded={active === field} title={blocked ? t("先保存或取消当前编辑") : !staff.can(retailFieldPermission(field)) ? t("当前账号无此编辑权限") : editable ? t("编辑{v0}", { v0: t(retailFieldLabels[field]) }) : t("当前状态保留已有资料")} disabled={blocked || !editable || !ready || Boolean(error)} onClick={() => onEdit(field)}>
    <span className={styles.valueGroup}>{compact ? null : <small>{t(retailFieldLabels[field])}</small>}<span className={styles.value}>{children ?? retailFieldText(field, unit[field], t)}</span></span>{editable ? <Pencil size={13} aria-hidden="true" /> : null}
  </button>;
}

export function RetailFieldEditor({ unit, field, onClose, initialCandidate }: { unit: RetailUnit; field: RetailEditableField; onClose: () => void; initialCandidate?: RetailUnit }) {
  const { t } = useLanguage();
  const { units, dispatch, ready, error: storageError, feedback } = useRetail();
  const [original,setOriginal] = useState(unit);
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
  const deviceDraft=useDeviceDraft(`retail-field:${unit.id}:${field}`,{value,raw,note,version:original.version,before:original[field]},saved=>{setValue(saved.value);setRaw(saved.raw);setNote(saved.note);setOriginal({...unit,version:saved.version,[field]:saved.before});setCandidate(null);});
  const label = retailFieldLabels[field];
  const current = units.find(item => item.id === original.id);
  const conflict = current?.version !== original.version;
  const storedFailure = attempted && feedback?.id === original.id && feedback.error ? feedback.message : "";
  function next() {
    const invalid = Array.from(body.current?.querySelectorAll<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>("input,textarea,select") ?? []).filter(control => !control.checkValidity());
    if (invalid.length) { invalid[0].reportValidity(); return; }
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
    if (saved) {await deviceDraft.clear();onClose();} else { busy.current = false; setSubmitting(false); }
  }
  const textControl = <label className="field"><span>{t(label)}</span><InputControl validate={text => controlError(() => validateRetailFieldEdit(original, { field, value: text }, units))} onClear={() => setValue("")} clearLabel={t("清空{v0}", { v0: t(label) })} aria-label={t(label)} value={String(value ?? "")} maxLength={field === "model" ? 120 : field === "brand" || field === "color" ? 60 : 300} type={field === "intakeDate" ? "date" : "text"} onInput={field === "intakeDate" ? event => setValue(event.currentTarget.value) : undefined} onChange={event => setValue(event.target.value)} /></label>;
  let control: ReactNode = textControl;
  if (field === "serial" || field === "imei1" || field === "imei2" || field === "productCode") control = <IdentifierField label={t(label)} value={String(value)} onChange={setValue} kind={field === "imei1" || field === "imei2" ? "imei" : "serial"} placeholder={field === "imei1" || field === "imei2" ? t("15 位数字；未知请留空") : t("未知请留空")} />;
  else if (field === "color") control = <ColorPicker value={String(value)} onChange={setValue} />;
  else if (field === "brand" || field === "model" || field === "cpu" || field === "gpu" || field === "keyboard" || field === "edition") control = <RetailCatalogControl field={field} category={original.category} brand={original.brand} units={units} value={String(value)} onChange={setValue} label={t(label)} required={field === "model"} />;
  else if (field === "ramGb") control = <RetailRamControl value={value as number | null} onChange={setValue} />;
  else if (field === "batteryPercent" || field === "controllers") control = <RetailNumberControl label={t(label)} value={value as number | null} onChange={setValue} battery={field === "batteryPercent"} unit={field === "batteryPercent" ? "%" : "个"} />;
  else if (field === "intakeDate") control = <RetailDateControl label={t(label)} value={String(value)} onChange={setValue} clearable />;
  else if (field === "warrantyMonths") control = <RetailWarrantyControl value={value as number | null} onChange={setValue} />;
  else if (field === "condition" || field === "grade") control = <SingleChoice label={t(label)} value={String(value)} onChange={setValue} options={(field === "condition" ? [{value:"新机",label:"新机",icon:Package},{value:"翻新机",label:"翻新机",icon:Sparkles}] : ["待评估","S","A","B","C"].map(item => ({value:item,label:item})))} />;
  else if (field === "category") control = <label className="field"><span>{t(label)}</span><SelectControl aria-label={t(label)} value={String(value)} onChange={event => setValue(event.target.value)}>{Object.entries(retailCategories).map(([key,text]) => <option value={key} key={key}>{t(text)}</option>)}</SelectControl></label>;
  else if (moneyFields.includes(field)) control = <RetailMoneyControl label={t(label)} value={raw} onChange={setRaw} />;
  else if (field === "knownIssues" || field === "accessories" || field === "source") control = <label className="field"><span>{t(label)}</span><TextareaControl validate={text => controlError(() => validateRetailFieldEdit(original, { field, value: text }, units))} placeholder={t("填写本台实物的实际资料")} aria-label={t(label)} value={String(value)} maxLength={600} onChange={event => setValue(event.target.value)} /></label>;
  else if (field === "bodyStorage") {
    control = <RetailStorageControl category={original.category} value={value as Capacity | null} onChange={setValue} />;
  } else if (field === "disks") control = <RetailDisksControl value={value as RetailDisk[]} onChange={setValue} category={original.category} />;
  return <section ref={region} className={styles.editor} aria-label={t("编辑{v0}", { v0: t(label) })} onKeyDown={event => { if (event.key === "Escape" && !event.defaultPrevented) { event.preventDefault(); if (!busy.current) onClose(); } }}>

    <header><div><small>{original.code}</small><h4 ref={heading} tabIndex={-1}>{candidate ? t("确认修改") : t("编辑{v0}", { v0: t(label) })}</h4></div><button type="button" className="icon-button" aria-label={t("关闭资料编辑")} disabled={submitting} onClick={onClose}><X size={18} /></button></header>
    <DeviceDraftNotice draft={deviceDraft}/>{conflict?<button type="button" className="button button--secondary" onClick={()=>{if(current){setOriginal(current);setCandidate(null);setError("");}}}>{t("保留输入并核对最新版本")}</button>:null}<div ref={body} className={styles.body}>{candidate ? <><dl className={styles.compare}><div><dt>{t("修改前 · ")}{t(label)}</dt><dd>{retailFieldText(field, original[field], t)}</dd></div><div><dt>{t("修改后 · ")}{t(label)}</dt><dd>{retailFieldText(field, candidate[field], t)}</dd></div></dl>{candidate.status !== original.status ? <p className={styles.impact}>{t("本次更正涉及核验资料，保存后转为待检测，三项核验将重新确认。")}</p> : null}<p className={styles.note}>{t("仅保存本次字段更正，并追加到本台单机历史。")}</p></> : <>{control}<details className={styles.noteDetails}><summary>{t("更正备注（选填）")}</summary><label className="field"><span className="visually-hidden">{t("更正备注")}</span><TextareaControl aria-label={t("更正备注")} placeholder={t("例如：核对实物后更正型号")} maxLength={300} value={note} onChange={event => setNote(event.target.value)} /></label></details></>}{conflict || error || storageError || (candidate && storedFailure) ? <p className="form-error" role="alert">{conflict ? t("单机已被其他操作更新，请关闭并重新打开编辑。") : t(error || storageError) || storedFailure}</p> : null}</div>
    <footer><button type="button" className="button button--secondary" disabled={submitting} onClick={onClose}>{t("取消")}</button>{candidate ? <><button type="button" className="button button--secondary" disabled={submitting} onClick={() => { setCandidate(null); setError(""); }}>{t("返回修改")}</button><button type="button" className="button button--primary" disabled={submitting || conflict || !ready || Boolean(storageError)} onClick={save}><Check size={17} />{submitting ? t("正在保存") : t("确认保存")}</button></> : <button type="button" className="button button--primary" disabled={conflict || !ready || Boolean(storageError)} onClick={next}>{t("继续确认")}<ChevronRight size={17} /></button>}</footer>
  </section>;
}
