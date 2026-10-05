"use client";

import { useLanguage } from "@/components/language-provider";
import { useId } from "react";
import { InputControl } from "./input-control";
import { IdentifierScanner } from "@/components/identifier-scanner";
import { identifierScanValue, type IdentifierKind } from "@/lib/identifier-scan";
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
  readOnly?: boolean;
  error?: string;
  hint?: string;
};

export function IdentifierField({ label, value, onChange, kind = "serial", placeholder, maxLength = 150, required, disabled, name, readOnly, error, hint }: IdentifierFieldProps) {
  const { t } = useLanguage();
  const inputId = useId();
  const labelId = useId();
  return <div className="field"><span id={labelId}><label htmlFor={inputId}>{t(label)}</label></span><div className={styles.inputRow}><InputControl validate={value => required && !value.trim() ? `请填写${label}，或扫码后核对。` : value.trim() && kind === "imei" ? identifierScanValue(value, kind).error ?? "" : ""} error={error} hint={hint} readOnly={readOnly} onClear={() => onChange("")} clearLabel={t("清空{v0}", { v0: t(label) })} id={inputId} aria-labelledby={labelId} value={value} onChange={(event) => onChange(event.target.value)} placeholder={placeholder ?? (kind === "imei" ? t("15 位 IMEI，未知留空") : t("输入实物标识，或扫描后核对"))} maxLength={maxLength} required={required} disabled={disabled} name={name} inputMode={kind === "imei" ? "numeric" : "text"} autoCapitalize="off" autoCorrect="off" spellCheck={false} /><IdentifierScanner iconOnly title={t("识别 {v0}", { v0: t(label) })} triggerLabel={t("扫描{v0}", { v0: t(label) })} inputLabel={label} kind={kind} disabled={disabled || readOnly} onConfirm={onChange} prompt={t("扫描实物上的 {v0}", { v0: kind === "imei" ? "IMEI" : kind === "serial-or-imei" ? t("SN 或 IMEI") : t("SN / 条码") })} /></div></div>;
}
