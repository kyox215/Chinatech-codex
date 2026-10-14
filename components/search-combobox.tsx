"use client";

import { useLanguage } from "@/components/language-provider";
import { useEffect, useId, useMemo, useRef, useState, type ReactNode } from "react";
import { ChevronDown, Search, Check } from "lucide-react";
import { InputControl } from "./input-control";

export type ComboboxOption = { value: string; label: string; detail?: string; key?: string };
type Props = {
  label: string; value: string; onChange: (value: string) => void;
  options: readonly ComboboxOption[]; onSelect?: (option: ComboboxOption) => void;
  placeholder?: string; inputMode?: "text" | "tel"; emptyText?: string;
  filterOptions?: boolean; required?: boolean; autoFocus?: boolean; maxLength?: number;
  displaySelectedLabel?: boolean; optionDetailsAsDescription?: boolean;
  optionLimit?: number; menuClassName?: string; menuHeader?: ReactNode; menuFooter?: ReactNode;
  onOpenChange?: (open: boolean) => void; loading?: boolean;
  windowed?: boolean; onEndReached?: () => void;
  persistentMenu?: boolean;
  selectedKey?: string;
  disabled?: boolean; readOnly?: boolean; error?: string; hint?: string; validate?: (value: string) => string;
};

/** Editable search: custom text remains valid; choosing a candidate is always explicit. */
export function SearchCombobox({ label, value, onChange, options, onSelect, placeholder, inputMode = "text", emptyText = "没有匹配，可保留手动输入", filterOptions = true, displaySelectedLabel = false, optionDetailsAsDescription = false, optionLimit = 12, menuClassName, menuHeader, menuFooter, onOpenChange, loading = false, windowed = false, onEndReached, persistentMenu = false, selectedKey, required, autoFocus, maxLength, disabled, readOnly, error, hint, validate }: Props) {
  const { t } = useLanguage();
  const id = useId();
  const root = useRef<HTMLDivElement>(null);
  const input = useRef<HTMLInputElement>(null);
  const list = useRef<HTMLUListElement>(null);
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(-1);
  const [scrollTop,setScrollTop]=useState(0);
  const [heights,setHeights]=useState<Record<string,number>>({});
  const expanded = (persistentMenu||open) && !disabled && !readOnly;
  const displayedValue = displaySelectedLabel ? options.find(option => option.value === value)?.label ?? value : value;
  const matches = useMemo(()=>(filterOptions ? options.filter(option => `${option.value} ${option.label} ${option.detail ?? ""}`.toLowerCase().includes(value.trim().toLowerCase())) : options).slice(0, windowed ? Math.max(1,optionLimit) : Math.min(50, Math.max(1,optionLimit))),[filterOptions,options,value,windowed,optionLimit]);
  const offsets=useMemo(()=>{const positions=[0];for(const option of matches)positions.push(positions.at(-1)!+(heights[option.key??option.value]??72));return positions;},[matches,heights]);
  const start=windowed?Math.max(0,offsets.findIndex((offset,index)=>index<matches.length&&offsets[index+1]>scrollTop)-3):0;
  const end=windowed?Math.min(matches.length,start+16):matches.length;
  useEffect(() => { onOpenChange?.(expanded); }, [expanded,onOpenChange]);
  useEffect(() => { if(open&&active>=0){const element=document.getElementById(`${id}-option-${active}`);if(element)element.scrollIntoView({block:'nearest'});else if(windowed&&list.current){list.current.scrollTop=offsets[active];setScrollTop(offsets[active]);}} }, [active,open,id,windowed,offsets]);
  useEffect(()=>{if(!windowed||!open||!list.current)return;const observer=new ResizeObserver(items=>{const next:Record<string,number>={};for(const item of items){const key=(item.target as HTMLElement).dataset.optionKey;if(key)next[key]=item.target.getBoundingClientRect().height;}setHeights(previous=>Object.entries(next).every(([key,height])=>previous[key]===height)?previous:{...previous,...next});});for(const item of list.current.querySelectorAll('[data-option-key]'))observer.observe(item);return()=>observer.disconnect();},[windowed,open,start,end,options]);
  useEffect(() => {
    if (!open||persistentMenu) return;
    const outside = (event: PointerEvent) => {
      if (!root.current?.contains(event.target as Node)) { setOpen(false); setActive(-1); }
    };
    document.addEventListener("pointerdown", outside);
    return () => document.removeEventListener("pointerdown", outside);
  }, [open,persistentMenu]);
  const select = (option: ComboboxOption) => { if (disabled || readOnly || input.current?.matches(":disabled")) return; onChange(option.value); onSelect?.(option); input.current?.focus({ preventScroll: true }); setOpen(false); setActive(-1); };
  return <div ref={root} className="field search-combobox" onBlur={event => { if (!persistentMenu&&!event.currentTarget.contains(event.relatedTarget as Node | null)) { setOpen(false); setActive(-1); } }}>
    <label htmlFor={id}>{label}{required ? " *" : ""}</label>
    <InputControl validate={displaySelectedLabel && validate ? () => validate(value) : validate} leading={<Search size={16} aria-hidden="true" />} error={error} hint={hint} disabled={disabled} readOnly={readOnly} clearLabel={t("清空{v0}", { v0: t(label) })} onClear={() => { onChange(""); setActive(-1); setOpen(true); }} trailing={<button type="button" disabled={disabled || readOnly} aria-label={t("显示{v0}候选", { v0: t(label) })} aria-expanded={expanded} onClick={() => { input.current?.focus({ preventScroll: true }); setOpen(!expanded); }}><ChevronDown size={17} aria-hidden="true" /></button>} id={id} ref={input} role="combobox" aria-autocomplete="list" aria-expanded={expanded} aria-controls={expanded ? `${id}-list` : undefined} aria-activedescendant={expanded && active >= 0 && active < matches.length ? `${id}-option-${active}` : undefined} value={displayedValue} required={required} aria-required={required || undefined} maxLength={maxLength} autoFocus={autoFocus} inputMode={inputMode} autoComplete="off" placeholder={placeholder ? t(placeholder) : undefined} onFocus={() => { if (!readOnly) setOpen(true); }} onClick={() => { if (!readOnly) setOpen(true); }} onChange={event => { onChange(event.target.value); setOpen(true); setActive(-1); }} onKeyDown={event => {
      if (disabled || readOnly || event.currentTarget.matches(":disabled")) return;
      if (event.nativeEvent.isComposing || event.keyCode === 229) return;
      if (event.key === "ArrowDown" || event.key === "ArrowUp") { event.preventDefault(); setOpen(true); setActive(current => matches.length ? event.key === "ArrowDown" ? (current + 1) % matches.length : current <= 0 ? matches.length - 1 : current - 1 : -1); }
      if (event.key === "Escape"&&!persistentMenu) { event.preventDefault(); setOpen(false); setActive(-1); }
      if (event.key === "Enter" && expanded && active >= 0 && matches[active]) { event.preventDefault(); select(matches[active]); }
    }} />
    {expanded ? <div className={["search-combobox__menu",menuClassName].filter(Boolean).join(" ")}>{menuHeader}<ul ref={list} role="listbox" id={`${id}-list`} aria-label={t("{v0}候选", { v0: t(label) })} aria-busy={loading} onScroll={event=>{if(windowed)setScrollTop(event.currentTarget.scrollTop);if(event.currentTarget.scrollHeight-event.currentTarget.scrollTop-event.currentTarget.clientHeight<100)onEndReached?.();}}>{windowed&&start>0?<li role="presentation" aria-hidden="true" style={{height:offsets[start]}}/>:null}{matches.slice(start,end).map((option,relative) => {const index=start+relative;return <li key={option.key??option.value} role="presentation" data-option-key={option.key??option.value}><button className="search-combobox__option" type="button" tabIndex={-1} id={`${id}-option-${index}`} role="option" aria-posinset={windowed?index+1:undefined} aria-setsize={windowed?matches.length:undefined} aria-label={optionDetailsAsDescription ? option.label : undefined} aria-describedby={optionDetailsAsDescription && option.detail ? `${id}-detail-${index}` : undefined} aria-selected={selectedKey===undefined?value===option.value:selectedKey===(option.key??option.value)} data-active={index === active} onMouseDown={event => event.preventDefault()} onClick={() => select(option)}><span><strong>{option.label}</strong>{option.detail ? <small id={`${id}-detail-${index}`}>{option.detail}</small> : null}</span>{(selectedKey===undefined?value===option.value:selectedKey===(option.key??option.value)) ? <Check size={16} /> : null}</button></li>;})}{windowed&&end<matches.length?<li role="presentation" aria-hidden="true" style={{height:offsets[matches.length]-offsets[end]}}/>:null}</ul>{loading ? <p role="status">{t("正在查询设备目录…")}</p> : !matches.length ? <p role="status">{t(emptyText)}</p> : null}{menuFooter}</div> : null}
  </div>;
}
