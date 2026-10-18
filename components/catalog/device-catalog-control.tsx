"use client";

import { useCallback, useMemo, useState } from "react";
import { SearchCombobox, type ComboboxOption } from "@/components/search-combobox";
import { useLanguage } from "@/components/language-provider";
import {
  catalogCategory, catalogBrandAliases, canonicalCatalogBrand, catalogNormalize,
  catalogNameSort, catalogSearchTerms, type CatalogPage, type CatalogPickerModel,
} from "@/lib/device-catalog";
import { useCatalogIndex, useCatalogRead, catalogScope } from "./use-catalog";
import styles from "./device-catalog.module.css";
import type{HistoricalCatalogSource}from'./historical-catalog-source';
import{useEffect}from'react';

type Props = {
  category: string; brand?: string; field: "brand" | "model"; label: string; value: string;
  onChange: (value: string) => void; required?: boolean; maxLength?: number; disabled?: boolean;
  validationError?: boolean; className?: string; historicalOptions?: readonly ComboboxOption[];
  historicalRead?:HistoricalCatalogSource;
  mobilePresentation?: "inline" | "sheet";
};
const noModels: CatalogPickerModel[] = [];
const noOptions: readonly ComboboxOption[] = [];
export function DeviceCatalogControl(props: Props) {
  return <CatalogControl key={props.category + ":" + (props.field === "model" ? canonicalCatalogBrand(props.brand ?? "") : "")} {...props} />;
}
function CatalogControl({
  category, brand = "", field, label, value, onChange, required = false, maxLength,
  disabled = false, validationError = false, className, historicalOptions = noOptions, historicalRead, mobilePresentation,
}: Props) {
  const { t, systemText } = useLanguage();
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState({ source: value, text: "" });
  const query = search.source === value ? search.text : "";
  const [family, setFamily] = useState<string | null>(null);
  const [history, setHistory] = useState(false);
  const historicalOpen=historicalRead?.onOpenChange,historicalQuery=historicalRead?.onQueryChange;
  useEffect(()=>{historicalOpen?.(open&&!disabled);return()=>historicalOpen?.(false);},[historicalOpen,open,disabled]);
  const [page, setPage] = useState(1);
  const [previousPages, setPreviousPages] = useState<{ key: string; rows: CatalogPickerModel[] }>({ key: "", rows: [] });
  const canonical = canonicalCatalogBrand(brand);
  const selectedCategory = category === "all" ? "" : category === "电脑" ? "computer" : catalogCategory(category) ?? "other";
  const scope = catalogScope();
  const base = useCatalogIndex({ category: selectedCategory }, open && !disabled);
  const knownBrand = Boolean(base.ready && base.data?.brands.some(row => row.value === canonical));
  const branched = field === "model" && knownBrand && base.ready && base.data?.complete === false;
  const branch = useCatalogIndex({ category: selectedCategory, brand: canonical }, open && !disabled && branched);
  const refined = branched && branch.ready && branch.data?.complete === false && family !== null && !query && !history;
  const leaf = useCatalogIndex({ category: selectedCategory, brand: canonical, family: family ?? "" }, open && !disabled && refined);
  const current = refined ? leaf : branched ? branch : base;
  const groups = branch.ready ? branch.data : base.ready ? base.data : null;
  const paged = field === "model" && knownBrand && current.ready && current.data?.complete === false && !history;
  const pageKey = JSON.stringify([scope, selectedCategory, canonical, family, query, current.data?.revision ?? ""]);
  const remote = useCatalogRead<CatalogPage>({
    kind: "models", category: selectedCategory, brand: canonical,
    family: query ? "" : family ?? "", familyExact: !query && family !== null ? "1" : "",
    q: query, page: String(page),
  }, open && !disabled && paged);
  const readError = base.error || (branched ? branch.error : "") || (refined ? leaf.error : "") || (paged ? remote.error : "");
  const prior = previousPages.key === pageKey ? previousPages.rows : noModels;
  const modelRows = useMemo(() => {
    const rows = paged ? [...prior, ...(remote.data?.rows ?? [])] : current.ready ? current.data?.models ?? [] : [];
    return [...new Map(rows.map(row => [row.id, row])).values()];
  }, [paged, prior, remote.data, current.ready, current.data]);
  const indexedModels = useMemo(() => modelRows.map(row => ({
    row,
    text: [row.name, row.family, row.network === "unknown" ? "" : row.network, row.year ? String(row.year) : "",
      ...catalogBrandAliases(row.brand), ...row.aliases, ...row.modelCodes].map(catalogNormalize).join(" "),
  })), [modelRows]);
  const terms = useMemo(() => catalogSearchTerms(query), [query]);
  const options = useMemo<ComboboxOption[]>(() => {
    if (!base.ready || readError) return [];
    if (field === "brand") {
      const brands = new Map((base.data?.brands ?? []).map(row => [catalogNormalize(row.value), {
        value: row.value, label: row.value, key: row.value,
        detail: catalogBrandAliases(row.value).filter(alias => alias !== row.value).join(" · "),
      }]));
      for (const row of historicalOptions) if (!brands.has(catalogNormalize(row.value))) brands.set(catalogNormalize(row.value), {
        ...row, key: "history:" + row.value, detail: t("门店原文 · 实物仍须核对"),
      });
      for(const row of historicalRead?.options??[])if(row.catalogKey===null||!brands.has(row.catalogKey??''))brands.set(row.catalogKey??row.key??row.value,{...row,key:row.key??row.value,detail:t("门店原文 · 实物仍须核对")});
      if(historicalRead)return[...brands.values()].filter(row=>row.key.startsWith('history:')?true:terms.every(term=>catalogBrandAliases(row.value).some(alias=>catalogNormalize(alias).includes(term)))).sort((a,b)=>a.label.localeCompare(b.label,'en'));
      return [...brands.values()].filter(row => terms.every(term => catalogBrandAliases(row.value).some(alias => catalogNormalize(alias).includes(term))))
        .sort((a, b) => a.value.localeCompare(b.value, "en"));
    }
    if(history&&historicalRead)return historicalRead.options.map(row=>({...row,detail:t("门店原文 · 实物仍须核对")}));
    if (history) return [...new Map(historicalOptions.map(row => [row.value, row])).values()]
      .filter(row => terms.every(term => catalogNormalize(row.value).includes(term)))
      .map(row => ({ ...row, key: "history:" + row.value, detail: t("门店原文 · 实物仍须核对") }));
    return indexedModels
      .filter(({ row, text }) => row.brand === canonical && (query || family === null || row.family === family) && terms.every(term => text.includes(term)))
      .sort((a, b) => (b.row.releasedAt ?? "").localeCompare(a.row.releasedAt ?? "") ||
        (b.row.year ?? 0) - (a.row.year ?? 0) || catalogNameSort(b.row.name).localeCompare(catalogNameSort(a.row.name)) ||
        a.row.id.localeCompare(b.row.id))
      .map(({ row }) => ({
        value: row.name, label: row.name, key: row.id,
        detail: [row.network === "unknown" ? "" : row.network, row.year ? String(row.year) : "", row.platform,
          ...row.modelCodes.slice(0, 3), row.status === "review" ? t("待核对") : ""].filter(Boolean).join(" · "),
      }));
  }, [base.ready, base.data, readError, field, history, historicalOptions,historicalRead, indexedModels, canonical, query, family, t, terms]);
  const families = (groups?.families ?? []).filter(row => row.brand === canonical);
  const loading = open && (!base.ready && base.loading || branched && !branch.ready && branch.loading ||
    refined && !leaf.ready && leaf.loading || paged && remote.loading||historicalRead?.loading);
  const selected = field === "brand" ? options.find(row => canonicalCatalogBrand(row.value) === canonicalCatalogBrand(value))?.key
    : options.find(row => row.value === value)?.key;
  const invalid = required && !value.trim() ? field === "brand" ? "请选择或填写设备品牌。" : "请选择或填写实物型号。" : "";
  function updateQuery(text: string) {
    setSearch({ source: value, text });
    setFamily(null);
    if(!historicalRead)setHistory(false);
    historicalQuery?.(text);
    setPage(1);
    setPreviousPages({ key: "", rows: [] });
  }
  function loadMore() {
    if (!paged || readError || remote.loading || !remote.data || remote.data.page !== page || modelRows.length >= remote.data.total) return;
    setPreviousPages({ key: pageKey, rows: modelRows });
    setPage(page + 1);
  }
  const changeOpen = useCallback((next: boolean) => {
    setOpen(next);
    // A presentation remount (including a breakpoint change) must not keep an invisible query.
    if (!next) setSearch(current => current.text ? { source: value, text: "" } : current);
  }, [value]);
  return <SearchCombobox key={scope} className={className} label={t(label)} inputLabel={t(label)}
    value={value} onChange={onChange} onQueryChange={updateQuery}
    onOptionCommit={historicalRead?option=>{if(option.key?.startsWith('history:'))historicalRead.onSelect(option);else onChange(option.value);}:undefined}
    options={options} optionDetailsAsDescription selectedKey={selected ?? ""} windowed
    commitOnBlur showAllOnOpen adaptiveMenu filterOptions={false} optionLimit={Math.max(1, options.length)}
    mobilePresentation={mobilePresentation}
    onOpenChange={changeOpen} onEndReached={loadMore} menuClassName={styles.menu}
    loading={loading} required={required} maxLength={maxLength ?? (field === "brand" ? 60 : 120)} disabled={disabled}
    emptyText={readError ? null : undefined}
    error={validationError ? invalid : undefined} validate={text => required && !text.trim() ? invalid || (field === "brand" ? "请选择或填写设备品牌。" : "请选择或填写实物型号。") : ""}
    placeholder={t("搜索或手动填写")}
    manualActionLabel={t(field === "brand" ? "使用手填品牌" : "使用手填型号")}
    menuHeader={field === "model" && !query && !history && !readError && families.length ? <div className={styles.families} role="group" aria-label={t("型号系列筛选")}>
      <button type="button" aria-pressed={family === null} onMouseDown={event => event.preventDefault()} onClick={() => { setFamily(null); setPage(1); setPreviousPages({ key: "", rows: [] }); }}>{t("全部系列")}</button>
      {families.map(row => <button key={row.value} type="button" aria-pressed={family === row.value} onMouseDown={event => event.preventDefault()}
        onClick={() => { setFamily(row.value); setPage(1); setPreviousPages({ key: "", rows: [] }); }}>{row.value || t("未分组系列")}</button>)}
    </div> : null}
    menuFooter={<div className={styles.footer}>
      {readError ? <><p role="alert">{systemText(readError)} {t("仍可手动填写。")}</p>
        <button type="button" onMouseDown={event => event.preventDefault()} onClick={() => { base.retry(); if (branched) branch.retry(); if (refined) leaf.retry(); if (paged) remote.retry(); }}>{t("重新查询目录")}</button></> : null}
      {historicalRead?.error?<><p role="alert">{systemText(historicalRead.error)} {t("仍可手动填写。")}</p><button type="button" onMouseDown={event=>event.preventDefault()} onClick={historicalRead.retry}>{t("重试")}</button></>:null}
      {field === "model" && !readError && base.ready && (historicalOptions.length||historicalRead) ? <button type="button" aria-pressed={history}
        onMouseDown={event => event.preventDefault()} onClick={() => { setHistory(previous => !previous); setPage(1); }}>{t(history ? "目录型号" : "门店原文")}</button> : null}
      {paged && remote.data && !readError ? <span>{modelRows.length} / {remote.data.total}</span> : null}
      {historicalRead&&(field==='brand'||history)?<span>{historicalRead.options.length} / {historicalRead.total}</span>:null}
    </div>} />;
}
