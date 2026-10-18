"use client";

import { useLanguage } from "@/components/language-provider";
import { useCallback, useEffect, useId, useMemo, useRef, useState, useSyncExternalStore, type ReactNode, type KeyboardEvent } from "react";
import { ChevronDown, Search, Check, LoaderCircle, X } from "lucide-react";
import { InputControl } from "./input-control";
import { useControlFeedback } from "./control-feedback";
import { ContentProgress, useActivityFeedback } from "./operation-feedback";

export type ComboboxOption = { value: string; label: string; detail?: string; key?: string };
type SearchEdit = { value: string; text: string };
type Props = {
  label: string; value: string; onChange: (value: string) => void;
  options: readonly ComboboxOption[]; onSelect?: (option: ComboboxOption) => void;
  onOptionCommit?: (option: ComboboxOption) => void;
  placeholder?: string; inputMode?: "text" | "tel"; emptyText?: string | null;
  filterOptions?: boolean; required?: boolean; autoFocus?: boolean; maxLength?: number;
  displaySelectedLabel?: boolean; optionDetailsAsDescription?: boolean;
  optionLimit?: number; menuClassName?: string; menuHeader?: ReactNode;
  menuFooter?: ReactNode; manualActionLabel?: string;
  onOpenChange?: (open: boolean) => void; loading?: boolean; loadingLabel?: string;
  windowed?: boolean; onEndReached?: () => void; persistentMenu?: boolean; selectedKey?: string;
  className?: string; inputLabel?: string; hideLabel?: boolean;
  commitOnBlur?: boolean; showAllOnOpen?: boolean; adaptiveMenu?: boolean;
  onQueryChange?: (query: string) => void;
  mobilePresentation?: "inline" | "sheet";
  disabled?: boolean; readOnly?: boolean; error?: string; hint?: string; validate?: (value: string) => string;
};

/** Defaults retain immediate editable search; catalog fields opt into explicit selection/manual commit. */
function subscribeMobile(listener: () => void) {
  const media = window.matchMedia("(max-width: 767px)");
  media.addEventListener("change", listener);
  return () => media.removeEventListener("change", listener);
}
export function SearchCombobox(props: Props) {
  const mobile = useSyncExternalStore(subscribeMobile, () => window.matchMedia("(max-width: 767px)").matches, () => false);
  const presentation = mobile ? props.mobilePresentation : undefined;
  return <Combobox key={presentation ?? "editable"} {...props} mobilePresentation={presentation} />;
}
function Combobox({
  label, value, onChange, options, onSelect, onOptionCommit, placeholder, inputMode = "text",
  emptyText = "没有匹配，可保留手动输入", filterOptions = true, displaySelectedLabel = false,
  optionDetailsAsDescription = false, optionLimit = 12, menuClassName, menuHeader, menuFooter, manualActionLabel,
  onOpenChange, loading = false, loadingLabel = "正在查询设备目录…", windowed = false, onEndReached, persistentMenu = false,
  selectedKey, className, inputLabel, hideLabel = false, commitOnBlur = false, showAllOnOpen = false,
  adaptiveMenu = false, onQueryChange, mobilePresentation, required, autoFocus, maxLength, disabled, readOnly, error, hint, validate,
}: Props) {
  const { t } = useLanguage();
  const id = useId();
  const root = useRef<HTMLDivElement>(null);
  const input = useRef<HTMLInputElement>(null);
  const trigger = useRef<HTMLButtonElement>(null);
  const searchInput = useRef<HTMLInputElement>(null);
  const dialog = useRef<HTMLDialogElement>(null);
  const dismiss = useRef<HTMLButtonElement>(null);
  const list = useRef<HTMLUListElement>(null);
  const menu = useRef<HTMLDivElement>(null);
  const pendingEdit = useRef<SearchEdit | null>(null);
  const [edit, setEdit] = useState<SearchEdit | null>(null);
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState(false);
  const [active, setActive] = useState(-1);
  const [scrollTop, setScrollTop] = useState(0);
  const [heights, setHeights] = useState<Record<string, number>>({});
  const expanded = (persistentMenu || open) && !disabled && !readOnly;
  const browsing = Boolean(mobilePresentation);
  const sheet = mobilePresentation === "sheet";
  const feedback = useControlFeedback({ error, hint });
  useActivityFeedback(sheet && expanded && loading, { scope: id });
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
    setEditing(false);
    setActive(-1);
  }, [commitOnBlur, value, disabled, readOnly, onChange, onQueryChange]);
  function select(option: ComboboxOption) {
    if (disabled || readOnly || input.current?.matches(":disabled")) return;
    resetQuery();
    if (onOptionCommit) onOptionCommit(option); else onChange(option.value);
    onSelect?.(option);
    if (browsing && dialog.current?.open) dialog.current.close();
    (browsing ? trigger.current : input.current)?.focus({ preventScroll: true });
    setOpen(false);
    setEditing(false);
  }

  function changeQuery(text: string) {
    const draft = { value, text };
    pendingEdit.current = draft; setEdit(draft); onQueryChange?.(text);
    setActive(-1); setScrollTop(0); if (list.current) list.current.scrollTop = 0;
  }
  function dismissMobile(commit = false) {
    if (dialog.current?.open) dialog.current.close();
    close(commit);
    trigger.current?.focus({ preventScroll: true });
  }
  function mobileKeyDown(event: KeyboardEvent<HTMLElement>) {
    if (disabled || readOnly || event.nativeEvent.isComposing || event.keyCode === 229) return;
    if (event.key === "Escape") { event.preventDefault(); dismissMobile(); }
    if (event.key === "ArrowDown" || event.key === "ArrowUp") {
      event.preventDefault(); setOpen(true);
      setActive(current => matches.length ? event.key === "ArrowDown" ? (current + 1) % matches.length : current <= 0 ? matches.length - 1 : current - 1 : -1);
    }
    if (event.key === "Enter" && expanded && (editing || active >= 0)) {
      event.preventDefault();
      if (active >= 0 && matches[active]) select(matches[active]);
    }
  }

  useEffect(() => { onOpenChange?.(expanded); }, [expanded, onOpenChange]);
  useEffect(() => { if (expanded && editing && browsing) searchInput.current?.focus({ preventScroll: true }); }, [expanded, editing, browsing]);
  useEffect(() => {
    if (!sheet || !dialog.current) return;
    const node = dialog.current;
    if (!expanded) { if (node.open) node.close(); return; }
    node.showModal();
    dismiss.current?.focus({ preventScroll: true });
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    let frame = 0;
    const position = () => {
      frame = 0;
      const viewport = window.visualViewport;
      const top = viewport?.offsetTop ?? 0;
      const height = viewport?.height ?? window.innerHeight;
      const bottom = top + height;
      node.style.setProperty("--combobox-viewport-height", height + "px");
      node.style.setProperty("--combobox-viewport-bottom", bottom + "px");
    };
    const schedule = () => { if (!frame) frame = requestAnimationFrame(position); };
    position();
    window.addEventListener("resize", schedule);
    window.visualViewport?.addEventListener("resize", schedule);
    window.visualViewport?.addEventListener("scroll", schedule);
    return () => {
      if (frame) cancelAnimationFrame(frame);
      if (node.open) node.close();
      document.body.style.overflow = previousOverflow;
      window.removeEventListener("resize", schedule);
      window.visualViewport?.removeEventListener("resize", schedule);
      window.visualViewport?.removeEventListener("scroll", schedule);
    };
  }, [sheet, expanded]);
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
    const outside = (event: PointerEvent) => { if (!root.current?.contains(event.target as Node)) close(!browsing); };
    document.addEventListener("pointerdown", outside);
    return () => document.removeEventListener("pointerdown", outside);
    // The handler must follow the current value/permissions, including an external draft restore.
  }, [open, persistentMenu, close, browsing]);
  useEffect(() => {
    if (!expanded || !adaptiveMenu || sheet || !menu.current || !root.current || !(input.current || trigger.current)) return;
    const node = menu.current;
    const boundary = root.current.closest<HTMLElement>("[data-combobox-boundary]");
    let frame = 0;
    const position = () => {
      frame = 0;
      if (!root.current || !(input.current || trigger.current)) return;
      const bounds = root.current.getBoundingClientRect();
      const anchorNode = trigger.current ?? input.current!;
      const anchor = anchorNode.closest(".input-control__body")?.getBoundingClientRect() ?? anchorNode.getBoundingClientRect();
      const viewport = window.visualViewport;
      let top = viewport?.offsetTop ?? 0;
      let bottom = top + (viewport?.height ?? window.innerHeight);
      if (boundary) {
        const clientTop = boundary.getBoundingClientRect().top + boundary.clientTop;
        top = Math.max(top, clientTop);
        bottom = Math.max(top, Math.min(bottom, clientTop + boundary.clientHeight));
      }
      const anchorTop = boundary ? Math.min(bottom, Math.max(top, anchor.top)) : anchor.top;
      const anchorBottom = boundary ? Math.min(bottom, Math.max(top, anchor.bottom)) : anchor.bottom;
      const below = boundary ? Math.max(0, bottom - anchorBottom - 4) : Math.max(44, bottom - anchor.bottom - 12);
      const above = boundary ? Math.max(0, anchorTop - top - 4) : Math.max(44, anchor.top - top - 12);
      const upwards = below < 260 && above > below;
      const nextTop = upwards ? "auto" : (anchorBottom - bounds.top + 4) + "px";
      const nextBottom = upwards ? (bounds.bottom - anchorTop + 4) + "px" : "auto";
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
    if (boundary) observer.observe(boundary);
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
  }, [expanded, adaptiveMenu, sheet]);

  const menuContent = expanded ?  <div ref={menu} className={["search-combobox__menu", menuClassName].filter(Boolean).join(" ")}>
      {browsing ? <div className="search-combobox__browse-tools">
        {!sheet ? <button type="button" className="icon-button" aria-label={t("关闭{v0}候选", { v0: label })} onClick={() => dismissMobile()}><X size={18} aria-hidden="true" /></button> : null}
        {editing ? <InputControl ref={searchInput} role="searchbox" aria-label={t("搜索{v0}", { v0: label })}
          leading={<Search size={16} aria-hidden="true" />} value={currentEdit?.text ?? ""} maxLength={maxLength}
          onChange={event => changeQuery(event.target.value)} onKeyDown={mobileKeyDown}
          onClear={() => changeQuery("")} clearLabel={t("清空搜索")} placeholder={t("搜索或手动填写")} autoComplete="off" />
          : <button type="button" className="button button--secondary search-combobox__search-action" onClick={() => setEditing(true)}><Search size={16} aria-hidden="true" />{t("搜索／手动输入")}</button>}
      </div> : null}
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
            <button className="search-combobox__option" type="button" tabIndex={browsing ? 0 : -1} id={id + "-option-" + index} role="option"
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
      {loading ? <p role="status">{t(loadingLabel)}</p> : !matches.length && emptyText !== null ? <p role="status">{t(emptyText)}</p> : null}
      {manualActionLabel ? <div className="search-combobox__footer">
        {currentEdit ? <button type="button" className="button button--secondary" onMouseDown={event => event.preventDefault()} onClick={() => browsing ? dismissMobile(true) : close(true)}>{t(manualActionLabel)}</button> : null}
        {menuFooter}
      </div> : menuFooter}
    </div> : null;

  return <div ref={root} data-mobile-presentation={mobilePresentation} className={["field search-combobox", className].filter(Boolean).join(" ")} onBlur={event => {
    if (!persistentMenu && !event.currentTarget.contains(event.relatedTarget as Node | null)) close(!browsing);
  }}>
    {!hideLabel ? <label htmlFor={id}>{label}{required ? " *" : ""}</label> : null}
    {browsing ? <>
      <div className="search-combobox__selection" data-filled={Boolean(value)} data-invalid={Boolean(error)}>
        <button ref={trigger} id={id} type="button" role="combobox" className="search-combobox__trigger"
          data-value={value} data-catalog-required={required || undefined} data-empty={!value.trim()}
          aria-label={inputLabel ?? label} aria-haspopup={sheet ? "dialog" : "listbox"} aria-expanded={expanded}
          aria-controls={expanded ? id + (sheet ? "-dialog" : "-list") : undefined}
          aria-activedescendant={!sheet && active >= 0 && expanded ? id + "-option-" + active : undefined}
          aria-required={required || undefined} aria-invalid={Boolean(error) || undefined} aria-describedby={feedback.describedBy()}
          aria-busy={expanded && loading || undefined} disabled={disabled || readOnly}
          onKeyDown={mobileKeyDown} onClick={() => expanded ? dismissMobile() : setOpen(true)}>
          <span>{value || t("请选择")}</span>
          {expanded && loading ? <LoaderCircle className="spin" size={17} aria-hidden="true" /> : <ChevronDown size={17} aria-hidden="true" />}
        </button>
        {value && !disabled && !readOnly ? <button type="button" className="icon-button search-combobox__clear" aria-label={t("清空{v0}", { v0: label })}
          onClick={() => { resetQuery(); onChange(""); close(); trigger.current?.focus({ preventScroll: true }); }}><X size={16} aria-hidden="true" /></button> : null}
      </div>
      {feedback.feedback}
    </> : <InputControl validate={displaySelectedLabel && validate ? () => validate(value) : validate}
      leading={<Search size={16} aria-hidden="true" />} error={error} hint={hint} disabled={disabled} readOnly={readOnly}
      clearLabel={t("清空{v0}", { v0: t(label) })} onClear={() => { resetQuery(); onChange(""); setOpen(true); }}
      trailing={<button type="button" disabled={disabled || readOnly} aria-label={t("显示{v0}候选", { v0: t(label) })} aria-expanded={expanded} aria-busy={expanded && loading || undefined}
        onClick={() => { input.current?.focus({ preventScroll: true }); setOpen(!expanded); }}>{expanded && loading ? <LoaderCircle className="spin" size={17} aria-hidden="true" /> : <ChevronDown size={17} aria-hidden="true" />}</button>}
      id={id} ref={input} role="combobox" aria-label={inputLabel ?? (hideLabel ? label : undefined)} aria-autocomplete="list" aria-expanded={expanded}
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
      }} />}
    {sheet ? <dialog ref={dialog} id={id + "-dialog"} className="search-combobox__sheet" aria-labelledby={id + "-title"}
      onCancel={event => { event.preventDefault(); dismissMobile(); }}
      onClick={event => { if (event.target === event.currentTarget) { const bounds = event.currentTarget.getBoundingClientRect(); if (event.clientY < bounds.top || event.clientY > bounds.bottom || event.clientX < bounds.left || event.clientX > bounds.right) dismissMobile(); } }}>
      <header><h2 id={id + "-title"}>{label}</h2><button ref={dismiss} type="button" className="icon-button" aria-label={t("关闭{v0}候选", { v0: label })} onClick={() => dismissMobile()}><X size={20} aria-hidden="true" /></button></header>
      <ContentProgress scope={id} />
      {menuContent}
    </dialog> : menuContent}
  </div>;
}
