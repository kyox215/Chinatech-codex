"use client";
import { useId, type ReactNode } from "react";
import { Check, type LucideIcon } from "lucide-react";

export type SingleChoiceOption = { value: string; label: string; icon?: LucideIcon; graphic?: ReactNode };
/** Visual, mutually exclusive choices use native radios, not a second select menu. */
export function SingleChoice({ label, value, options, onChange, className = "" }: { label: string; value: string; options: SingleChoiceOption[]; onChange: (value: string) => void; className?: string }) {
  const name = useId();
  return <fieldset className={`single-choice ${className}`}><legend>{label}</legend><div>{options.map(option => <label key={option.value} data-selected={value === option.value}>
    <input type="radio" name={name} value={option.value} checked={value === option.value} onChange={() => onChange(option.value)} />
    {option.graphic}{option.icon ? <option.icon size={17} aria-hidden="true" /> : null}<span>{option.label}</span>{value === option.value ? <Check size={14} aria-hidden="true" /> : null}
  </label>)}</div></fieldset>;
}
