"use client";

import { useEffect, useId, useRef, useState } from "react";
import { ChevronDown, Search, Check } from "lucide-react";

export type ComboboxOption = { value: string; label: string; detail?: string };
type Props = {
  label: string; value: string; onChange: (value: string) => void;
  options: readonly ComboboxOption[]; onSelect?: (option: ComboboxOption) => void;
  placeholder?: string; inputMode?: "text" | "tel"; emptyText?: string;
  filterOptions?: boolean; required?: boolean; autoFocus?: boolean; maxLength?: number;
};

/** Editable search: custom text remains valid; choosing a candidate is always explicit. */
export function SearchCombobox({ label, value, onChange, options, onSelect, placeholder, inputMode = "text", emptyText = "没有匹配，可保留手动输入", filterOptions = true, required, autoFocus, maxLength }: Props) {
  const id = useId();
  const root = useRef<HTMLDivElement>(null);
  const input = useRef<HTMLInputElement>(null);
  const list = useRef<HTMLUListElement>(null);
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(-1);
  const matches = (filterOptions ? options.filter(option => `${option.label} ${option.detail ?? ""}`.toLowerCase().includes(value.trim().toLowerCase())) : options).slice(0, 12);
  useEffect(() => { if (open && active >= 0) list.current?.children[active]?.scrollIntoView({ block: "nearest" }); }, [active,open]);
  useEffect(() => {
    if (!open) return;
    const outside = (event: PointerEvent) => {
      if (!root.current?.contains(event.target as Node)) { setOpen(false); setActive(-1); }
    };
    document.addEventListener("pointerdown", outside);
    return () => document.removeEventListener("pointerdown", outside);
  }, [open]);
  const select = (option: ComboboxOption) => { onChange(option.value); onSelect?.(option); input.current?.focus({ preventScroll: true }); setOpen(false); setActive(-1); };
  return <div ref={root} className="field search-combobox" onBlur={event => { if (!event.currentTarget.contains(event.relatedTarget as Node | null)) { setOpen(false); setActive(-1); } }}>
    <label htmlFor={id}>{label}{required ? " *" : ""}</label>
    <div className="search-combobox__input"><Search size={16} aria-hidden="true" /><input id={id} ref={input} role="combobox" aria-autocomplete="list" aria-expanded={open} aria-controls={`${id}-list`} aria-activedescendant={open && active >= 0 && active < matches.length ? `${id}-option-${active}` : undefined} value={value} required={required} aria-required={required || undefined} maxLength={maxLength} autoFocus={autoFocus} inputMode={inputMode} autoComplete="off" placeholder={placeholder} onFocus={() => setOpen(true)} onClick={() => setOpen(true)} onChange={event => { onChange(event.target.value); setOpen(true); setActive(-1); }} onKeyDown={event => {
      if (event.nativeEvent.isComposing || event.keyCode === 229) return;
      if (event.key === "ArrowDown" || event.key === "ArrowUp") { event.preventDefault(); setOpen(true); setActive(current => matches.length ? event.key === "ArrowDown" ? (current + 1) % matches.length : current <= 0 ? matches.length - 1 : current - 1 : -1); }
      if (event.key === "Escape") { event.preventDefault(); setOpen(false); setActive(-1); }
      if (event.key === "Enter" && open && active >= 0 && matches[active]) { event.preventDefault(); select(matches[active]); }
    }} /><button type="button" aria-label={`显示${label}候选`} aria-expanded={open} onClick={() => { input.current?.focus(); setOpen(!open); }}><ChevronDown size={17} /></button></div>
    {open ? <div className="search-combobox__menu"><ul ref={list} role="listbox" id={`${id}-list`} aria-label={`${label}候选`}>{matches.map((option,index) => <li key={option.value} role="presentation"><button className="search-combobox__option" type="button" tabIndex={-1} id={`${id}-option-${index}`} role="option" aria-selected={value === option.value} data-active={index === active} onMouseDown={event => event.preventDefault()} onClick={() => select(option)}><span><strong>{option.label}</strong>{option.detail ? <small>{option.detail}</small> : null}</span>{value === option.value ? <Check size={16} /> : null}</button></li>)}</ul>{!matches.length ? <p role="status">{emptyText}</p> : null}</div> : null}
  </div>;
}
