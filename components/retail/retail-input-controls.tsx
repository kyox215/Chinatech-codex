"use client";

import { InputControl } from "@/components/input-control";
import { useId, useState } from "react";
import { Battery, CalendarDays, Gamepad2, Minus, Plus, X } from "lucide-react";
import { parseRetailMoney, retailMoney } from "@/lib/retail";
import { retailDraftNumber, retailNumberError } from "@/lib/retail-input";
import styles from "./retail-input-controls.module.css";

export function RetailMoneyControl({ label, value, onChange, required = false, placeholder = "未知请留空", maxCents }: {
  label: string; value: string; onChange: (value: string) => void; required?: boolean; placeholder?: string; maxCents?: number | null;
}) {
  let preview = "未记录"; let error = "";
  try {
    const cents = parseRetailMoney(value); preview = cents === null ? required ? "请输入实际金额" : "未记录" : retailMoney(cents);
    if (cents !== null && maxCents != null && cents > maxCents) error = `金额不能超过 ${retailMoney(maxCents)}。`;
  } catch (reason) { error = reason instanceof Error ? reason.message : "请核对金额。"; }
  return <div className={styles.control}><label className="field"><span>{label}{required ? " *" : ""}</span><InputControl shell leading={<b>€</b>} error={error} hint={`${preview} · 最多两位小数`} validate={() => error} aria-label={label} required={required} inputMode="decimal" maxLength={16} value={value} onChange={event => onChange(event.target.value)} onClear={!required ? () => onChange("") : undefined} clearLabel={`清空${label}`} placeholder={placeholder} /></label></div>;
}

/** Integer drafts remain exact; steppers and battery slider are explicit user actions. */
export function RetailNumberControl({ label, value, onChange, min = 0, max = 100, unit = "个", battery = false, disabled = false, optional = true }: {
  label: string; value: number | null; onChange: (value: number | null) => void; min?: number; max?: number; unit?: string; battery?: boolean; disabled?: boolean; optional?: boolean;
}) {
  const [raw, setRaw] = useState(() => value === null || !Number.isFinite(value) ? "" : String(value));
  const id = useId(); const error = retailNumberError(raw, min, max, true);
  const numeric = retailDraftNumber(raw, true); const valid = numeric !== null && !error;
  function change(text: string) { setRaw(text); onChange(retailDraftNumber(text, true)); }
  function step(amount: number) { if (error) return; change(String(numeric === null ? Math.max(min, 1) : Math.min(max, Math.max(min, numeric + amount)))); }
  return <div className={`${styles.control}${battery ? " " + styles.battery : ""}`}>
    {battery ? <div className={styles.batteryPreview}><svg viewBox="0 0 60 30" width="72" height="36" aria-hidden="true"><rect x="2" y="2" width="50" height="26" rx="5" fill="none" stroke="currentColor" strokeWidth="2" /><path d="M55 10v10" stroke="currentColor" strokeWidth="4" /><rect x="6" y="6" width={valid ? numeric * .42 : 0} height="18" rx="2" fill="currentColor" /></svg><strong>{valid ? numeric + "%" : "未记录"}</strong></div> : null}
    <label className="field"><span>{battery ? <Battery size={16} aria-hidden="true" /> : unit === "个" ? <Gamepad2 size={16} aria-hidden="true" /> : null}{label}</span><span className={styles.counter}>
      <button className="icon-button" type="button" aria-label={`减少${label}`} disabled={disabled || !!error || numeric === null || numeric <= min} onClick={() => step(-1)}><Minus size={16} /></button>
      <span className={styles.unitInput}><InputControl required={!optional} validate={value => retailNumberError(value, min, max, true)} aria-label={label} aria-describedby={id} aria-invalid={!!error} inputMode="numeric" value={raw} disabled={disabled} maxLength={5} placeholder={optional ? "未记录" : "填写整数"} onChange={event => change(event.target.value)} /><b>{unit}</b></span>
      <button className="icon-button" type="button" aria-label={`增加${label}`} disabled={disabled || !!error || numeric !== null && numeric >= max} onClick={() => step(1)}><Plus size={16} /></button>
    </span></label>
    {battery ? <label className={styles.range}><span className="visually-hidden">拖动调整电池健康</span><span aria-hidden="true">0%</span><input aria-label="拖动调整电池健康" type="range" min="0" max="100" step="1" value={valid ? numeric : 0} aria-valuetext={valid ? numeric + "%" : "未记录"} disabled={disabled || !!error} onChange={event => change(event.target.value)} /><span aria-hidden="true">100%</span></label> : null}
    <div className={styles.feedback}><small id={id} className={error ? styles.error : styles.hint}>{error || (battery ? "实测整数百分比，0%与未记录分别保存" : `${min}–${max}${unit}${optional ? "，空白为未记录" : ""}`)}</small>{optional ? <button type="button" className="button button--secondary button--compact" disabled={disabled || raw === ""} onClick={() => change("")}><X size={14} />未记录</button> : null}</div>
  </div>;
}

export function RetailDateControl({ label, value, onChange, required = false, min, max, clearable = false }: {
  label: string; value: string; onChange: (value: string) => void; required?: boolean; min?: string; max?: string; clearable?: boolean;
}) {
  return <label className={`field ${styles.control}`}><span><CalendarDays size={16} aria-hidden="true" />{label}{required ? " *" : ""}</span><span className={styles.date}><InputControl aria-label={label} required={required} type="date" min={min} max={max} value={value} onInput={event => onChange(event.currentTarget.value)} onChange={event => onChange(event.target.value)} />{clearable ? <button type="button" className="icon-button" aria-label={`清空${label}`} disabled={!value} onClick={() => onChange("")}><X size={16} /></button> : null}</span></label>;
}
