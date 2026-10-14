"use client";

import { useLanguage } from "@/components/language-provider";
import { useCallback, useEffect, useId, useMemo, useRef, useState, type ReactNode } from "react";
import { ChevronDown, Search, Check } from "lucide-react";
import { InputControl } from "./input-control";

export type ComboboxOption = { value: string; label: string; detail?: string; key?: string };
type SearchEdit = { value: string; text: string };
type Props = {
  label: string; value: string; onChange: (value: string) => void;
  options: readonly ComboboxOption[]; onSelect?: (option: ComboboxOption) => void;
  placeholder?: string; inputMode?: "text" | "tel"; emptyText?: string | null;
  filterOptions?: boolean; required?: boolean; autoFocus?: boolean; maxLength?: number;
  displaySelectedLabel?: boolean; optionDetailsAsDescription?: boolean;
  optionLimit?: number; menuClassName?: string; menuHeader?: ReactNode;
  menuFooter?: ReactNode; manualActionLabel?: string;
  onOpenChange?: (open: boolean) => void; loading?: boolean;
  windowed?: boolean; onEndReached?: () => void; persistentMenu?: boolean; selectedKey?: string;
  className?: string; inputLabel?: string;
  commitOnBlur?: boolean; showAllOnOpen?: boolean; adaptiveMenu?: boolean;
  onQueryChange?: (query: string) => void;
  disabled?: boolean; readOnly?: boolean; error?: string; hint?: string; validate?: (value: string) => string;
};

/** Defaults retain immediate editable search; catalog fields opt into explicit selection/manual commit. */
export function SearchCombobox({
  label, value, onChange, options, onSelect, placeholder, inputMode = "text",
  emptyText = "没有匹配，可保留手动输入", filterOptions = true, displaySelectedLabel = false,
  optionDetailsAsDescription = false, optionLimit = 12, menuClassName, menuHeader, menuFooter, manualActionLabel,
  onOpenChange, loading = false, windowed = false, onEndReached, persistentMenu = false,
  selectedKey, className, inputLabel, commitOnBlur = false, showAllOnOpen = false,
  adaptiveMenu = false, onQueryChange, required, autoFocus, maxLength, disabled, readOnly, error, hint, validate,
}: Props) {
  const { t } = useLanguage();
  const id = useId();
  const root = useRef<HTMLDivElement>(null);
  const input = useRef<HTMLInputElement>(null);
  const list = useRef<HTMLUListElement>(null);
  const menu = useRef<HTMLDivElement>(null);
  const pendingEdit = useRef<SearchEdit | null>(null);
  const [edit, setEdit] = useState<SearchEdit | null>(null);
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(-1);
  const [scrollTop, setScrollTop] = useState(0);
  const [heights, setHeights] = useState<Record<string, number>>({});
  const expanded = (persistentMenu || open) && !disabled && !readOnly;
  const currentEdit = commitOnBlur && edit?.value === value ? edit : null;
  const displayedValue = currentEdit?.text ?? (displaySelectedLabel ? options.find(option => option.value === value)?.label ?? value : value);
  const query = showAllOnOpen ? currentEdit?.text ?? "" : displayedValue;
  const matches = useMemo(() => (filterOptions
    ? options.filter(option => [option.value, option.label, option.detail ?? ""].join(" ").toLowerCase().includes(query.trim().toLowerCase()))
    : options).slice(0, windowed ? Math.max(1, optionLimit) : Math.min(50, Math.max(1, optionLimit))),
  [filterOptions, options, query, windowed, optionLimit]);
  const offsets = useMemo(() => {
    const positions = [0];
    for (const option of matches) positions.push(positions.at(-1)! + (heights[option.key ?? option.value] ?? 72));
    return positions;
  }, [matches, heights]);
  const start = windowed ? Math.max(0, offsets.findIndex((offset, index) => index < matches.length && offsets[index + 1] > scrollTop) - 3) : 0;
  const end = windowed ? Math.min(matches.length, start + 16) : matches.length;

  function resetQuery() {
    pendingEdit.current = null;
    setEdit(null);
    onQueryChange?.("");
    setActive(-1);
    setScrollTop(0);
    if (list.current) list.current.scrollTop = 0;
  }
  const close = useCallback((commit = false) => {
    const pending = pendingEdit.current;
    // Clear synchronously before publishing: outside-pointer and blur must not commit twice.
    pendingEdit.current = null;
    if (commitOnBlur && commit && pending?.value === value && !disabled && !readOnly && !input.current?.matches(":disabled")) onChange(pending.text);
    setEdit(null);
    onQueryChange?.("");
    setOpen(false);
    setActive(-1);
  }, [commitOnBlur, value, disabled, readOnly, onChange, onQueryChange]);
  function select(option: ComboboxOption) {
    if (disabled || readOnly || input.current?.matches(":disabled")) return;
    resetQuery();
    onChange(option.value);
    onSelect?.(option);
    input.current?.focus({ preventScroll: true });
    setOpen(false);
  }

  useEffect(() => { onOpenChange?.(expanded); }, [expanded, onOpenChange]);
  useEffect(() => {
    if (open && active >= 0) {
      const element = document.getElementById(id + "-option-" + active);
      if (element) element.scrollIntoView({ block: "nearest" });
      else if (windowed && list.current) { list.current.scrollTop = offsets[active]; setScrollTop(offsets[active]); }
    }
  }, [active, open, id, windowed, offsets]);
  useEffect(() => {
    if (!windowed || !open || !list.current) return;
    const observer = new ResizeObserver(items => {
      const next: Record<string, number> = {};
      for (const item of items) {
        const key = (item.target as HTMLElement).dataset.optionKey;
        if (key) next[key] = item.target.getBoundingClientRect().height;
      }
      setHeights(previous => Object.entries(next).every(([key, height]) => previous[key] === height) ? previous : { ...previous, ...next });
    });
    for (const item of list.current.querySelectorAll("[data-option-key]")) observer.observe(item);
    return () => observer.disconnect();
  }, [windowed, open, start, end, options]);
  useEffect(() => {
    if (!open || persistentMenu) return;
    const outside = (event: PointerEvent) => { if (!root.current?.contains(event.target as Node)) close(true); };
    document.addEventListener("pointerdown", outside);
    return () => document.removeEventListener("pointerdown", outside);
    // The handler must follow the current value/permissions, including an external draft restore.
  }, [open, persistentMenu, close]);
  useEffect(() => {
    if (!expanded || !adaptiveMenu || !menu.current || !root.current || !input.current) return;
    const node = menu.current;
    let frame = 0;
    const position = () => {
      frame = 0;
      if (!root.current || !input.current) return;
      const bounds = root.current.getBoundingClientRect();
      const anchor = input.current.closest(".input-control__body")?.getBoundingClientRect() ?? input.current.getBoundingClientRect();
      const viewport = window.visualViewport;
      const top = viewport?.offsetTop ?? 0;
      const bottom = top + (viewport?.height ?? window.innerHeight);
      const below = Math.max(44, bottom - anchor.bottom - 12);
      const above = Math.max(44, anchor.top - top - 12);
      const upwards = below < 260 && above > below;
      const nextTop = upwards ? "auto" : (anchor.bottom - bounds.top + 4) + "px";
      const nextBottom = upwards ? (bounds.bottom - anchor.top + 4) + "px" : "auto";
      const space = Math.min(360, upwards ? above : below) + "px";
      if (node.style.top !== nextTop) node.style.top = nextTop;
      if (node.style.bottom !== nextBottom) node.style.bottom = nextBottom;
      if (node.style.getPropertyValue("--combobox-space") !== space) node.style.setProperty("--combobox-space", space);
    };
    const schedule = () => { if (!frame) frame = requestAnimationFrame(position); };
    position();
    const observer = new ResizeObserver(schedule);
    observer.observe(node);
    observer.observe(root.current);
    window.addEventListener("resize", schedule);
    window.addEventListener("scroll", schedule, true);
    window.visualViewport?.addEventListener("resize", schedule);
    window.visualViewport?.addEventListener("scroll", schedule);
    return () => {
      if (frame) cancelAnimationFrame(frame);
      observer.disconnect();
      window.removeEventListener("resize", schedule);
      window.removeEventListener("scroll", schedule, true);
      window.visualViewport?.removeEventListener("resize", schedule);
      window.visualViewport?.removeEventListener("scroll", schedule);
    };
  }, [expanded, adaptiveMenu]);

  return <div ref={root} className={["field search-combobox", className].filter(Boolean).join(" ")} onBlur={event => {
    if (!persistentMenu && !event.currentTarget.contains(event.relatedTarget as Node | null)) close(true);
  }}>
    <label htmlFor={id}>{label}{required ? " *" : ""}</label>
    <InputControl validate={displaySelectedLabel && validate ? () => validate(value) : validate}
      leading={<Search size={16} aria-hidden="true" />} error={error} hint={hint} disabled={disabled} readOnly={readOnly}
      clearLabel={t("清空{v0}", { v0: t(label) })} onClear={() => { resetQuery(); onChange(""); setOpen(true); }}
      trailing={<button type="button" disabled={disabled || readOnly} aria-label={t("显示{v0}候选", { v0: t(label) })} aria-expanded={expanded}
        onClick={() => { input.current?.focus({ preventScroll: true }); setOpen(!expanded); }}><ChevronDown size={17} aria-hidden="true" /></button>}
      id={id} ref={input} role="combobox" aria-label={inputLabel} aria-autocomplete="list" aria-expanded={expanded}
      aria-controls={expanded ? id + "-list" : undefined}
      aria-activedescendant={expanded && active >= 0 && active < matches.length ? id + "-option-" + active : undefined}
      value={displayedValue} required={required} aria-required={required || undefined} maxLength={maxLength} autoFocus={autoFocus}
      inputMode={inputMode} autoComplete="off" placeholder={placeholder ? t(placeholder) : undefined}
      onFocus={() => { if (!readOnly) { setOpen(true); if (commitOnBlur && !pendingEdit.current) input.current?.select(); } }}
      onClick={() => { if (!readOnly) setOpen(true); }}
      onChange={event => {
        const next = event.target.value;
        if (commitOnBlur) { const draft = { value, text: next }; pendingEdit.current = draft; setEdit(draft); onQueryChange?.(next); }
        else onChange(next);
        setOpen(true); setActive(-1); setScrollTop(0); if (list.current) list.current.scrollTop = 0;
      }}
      onKeyDown={event => {
        if (disabled || readOnly || event.currentTarget.matches(":disabled") || event.nativeEvent.isComposing || event.keyCode === 229) return;
        if (event.key === "ArrowDown" || event.key === "ArrowUp") {
          event.preventDefault(); setOpen(true);
          setActive(current => matches.length ? event.key === "ArrowDown" ? (current + 1) % matches.length : current <= 0 ? matches.length - 1 : current - 1 : -1);
        }
        if (event.key === "Escape" && !persistentMenu) { event.preventDefault(); close(false); }
        if (event.key === "Enter" && expanded) {
          if (active >= 0 && matches[active]) { event.preventDefault(); select(matches[active]); }
          else if (commitOnBlur) { event.preventDefault(); close(true); }
        }
        if (event.key === "Tab" && commitOnBlur) close(true);
      }} />
    {expanded ? <div ref={menu} className={["search-combobox__menu", menuClassName].filter(Boolean).join(" ")}>
      {menuHeader}
      <ul ref={list} role="listbox" id={id + "-list"} aria-label={t("{v0}候选", { v0: t(label) })} aria-busy={loading}
        onScroll={event => {
          if (windowed) setScrollTop(event.currentTarget.scrollTop);
          if (event.currentTarget.scrollHeight - event.currentTarget.scrollTop - event.currentTarget.clientHeight < 100) onEndReached?.();
        }}>
        {windowed && start > 0 ? <li role="presentation" aria-hidden="true" style={{ height: offsets[start] }} /> : null}
        {matches.slice(start, end).map((option, relative) => {
          const index = start + relative;
          const selected = selectedKey === undefined ? value === option.value : selectedKey === (option.key ?? option.value);
          return <li key={option.key ?? option.value} role="presentation" data-option-key={option.key ?? option.value}>
            <button className="search-combobox__option" type="button" tabIndex={-1} id={id + "-option-" + index} role="option"
              aria-posinset={windowed ? index + 1 : undefined} aria-setsize={windowed ? matches.length : undefined}
              aria-label={optionDetailsAsDescription ? option.label : undefined}
              aria-describedby={optionDetailsAsDescription && option.detail ? id + "-detail-" + index : undefined}
              aria-selected={selected} data-active={index === active} onMouseDown={event => event.preventDefault()} onClick={() => select(option)}>
              <span><strong>{option.label}</strong>{option.detail ? <small id={id + "-detail-" + index}>{option.detail}</small> : null}</span>
              {selected ? <Check size={16} /> : null}
            </button>
          </li>;
        })}
        {windowed && end < matches.length ? <li role="presentation" aria-hidden="true" style={{ height: offsets[matches.length] - offsets[end] }} /> : null}
      </ul>
      {loading ? <p role="status">{t("正在查询设备目录…")}</p> : !matches.length && emptyText !== null ? <p role="status">{t(emptyText)}</p> : null}
      {manualActionLabel ? <div className="search-combobox__footer">
        {currentEdit ? <button type="button" className="button button--secondary" onMouseDown={event => event.preventDefault()} onClick={() => close(true)}>{t(manualActionLabel)}</button> : null}
        {menuFooter}
      </div> : menuFooter}
    </div> : null}
  </div>;
}
