"use client";
import { Check } from "lucide-react";
import type { LucideIcon } from "lucide-react";
type Option = { value: string; label: string; icon?: LucideIcon };
export function MultiChoice({ label, options, values, onChange }: { label: string; options: readonly Option[]; values: readonly string[]; onChange: (values: string[]) => void }) {
  return <fieldset className="multi-choice"><legend>{label}</legend><div className="multi-choice__options">{options.map(option => { const selected = values.includes(option.value); return <label key={option.value} className="multi-choice__item" data-selected={selected}><input type="checkbox" checked={selected} onChange={() => onChange(selected ? values.filter(value => value !== option.value) : [...values,option.value])} />{option.icon ? <option.icon size={17} aria-hidden="true" /> : null}<span>{option.label}</span>{selected ? <Check size={14} aria-hidden="true" /> : null}</label>; })}</div></fieldset>;
}
