"use client";
import { useId, type ReactNode } from "react";
import { Check, type LucideIcon } from "lucide-react";
import { useLanguage } from "./language-provider";

export type SingleChoiceOption = { value: string; label: string; icon?: LucideIcon; graphic?: ReactNode };
/** Visual, mutually exclusive choices use native radios, not a second select menu. */
export function SingleChoice({ label, value, options, onChange, onRepeatSelect, className = "" }: { label: string; value: string; options: SingleChoiceOption[]; onChange: (value: string) => void; onRepeatSelect?: (value: string) => void; className?: string }) {
  const { t } = useLanguage();
  const name = useId();
  return <fieldset className={`single-choice ${className}`}><legend>{t(label)}</legend><div>{options.map(option => <label key={option.value} data-selected={value === option.value}>
    <input type="radio" name={name} value={option.value} checked={value === option.value} onChange={() => onChange(option.value)} onClick={() => { if (value === option.value) onRepeatSelect?.(option.value); }} />
    {option.graphic}{option.icon ? <option.icon size={17} aria-hidden="true" /> : null}<span>{t(option.label)}</span>{value === option.value ? <Check size={14} aria-hidden="true" /> : null}
  </label>)}</div></fieldset>;
}
