"use client";

import { useId } from "react";
import { IdentifierScanner } from "@/components/identifier-scanner";
import type { IdentifierKind } from "@/lib/identifier-scan";
import styles from "./identifier-scanner.module.css";

type IdentifierFieldProps = {
  label: string;
  value: string;
  onChange: (value: string) => void;
  kind?: IdentifierKind;
  placeholder?: string;
  maxLength?: number;
  required?: boolean;
  disabled?: boolean;
  name?: string;
};

export function IdentifierField({ label, value, onChange, kind = "serial", placeholder, maxLength = 150, required, disabled, name }: IdentifierFieldProps) {
  const inputId = useId();
  const labelId = useId();
  return <div className="field"><span id={labelId}><label htmlFor={inputId}>{label}</label></span><div className={styles.inputRow}><input id={inputId} aria-labelledby={labelId} value={value} onChange={(event) => onChange(event.target.value)} placeholder={placeholder} maxLength={maxLength} required={required} disabled={disabled} name={name} inputMode={kind === "imei" ? "numeric" : "text"} autoCapitalize="off" autoCorrect="off" spellCheck={false} /><IdentifierScanner iconOnly title={`识别 ${label}`} triggerLabel={`扫描${label}`} inputLabel={label} kind={kind} disabled={disabled} onConfirm={onChange} prompt={`扫描实物上的 ${kind === "imei" ? "IMEI" : kind === "serial-or-imei" ? "SN 或 IMEI" : "SN / 条码"}`} /></div></div>;
}
