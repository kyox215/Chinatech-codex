"use client";

import { useLanguage } from "@/components/language-provider";
import { InputControl } from "@/components/input-control";
import { useId, useRef, useState } from "react";
import { HardDrive, Plus, X } from "lucide-react";
import { RetailNumberControl } from "./retail-input-controls";
import { retailDraftNumber } from "@/lib/retail-input";
import { SelectControl } from "@/components/select-control";
import { SearchCombobox } from "@/components/search-combobox";
import { retailCatalogOptions, retailRamPresets, retailStoragePresets, type RetailCatalogField } from "@/lib/retail-catalog";
import type { Capacity, RetailCategory, RetailDisk, RetailUnit } from "@/lib/retail";
import styles from "./retail-spec-controls.module.css";

export function RetailCatalogControl({ field, category, brand, units, value, onChange, label, required = false }: {
  field: RetailCatalogField; category: RetailCategory; brand?: string; units: RetailUnit[]; value: string; onChange: (value: string) => void; label: string; required?: boolean;
}) {
  const { t } = useLanguage();
  return <SearchCombobox validate={text => required && !text.trim() ? "请选择或填写实物型号。" : ""} label={t(label)} value={value} onChange={onChange} options={retailCatalogOptions(field, category, brand, units)}
    required={required} maxLength={field === "brand" ? 60 : field === "model" ? 120 : 300} placeholder={t("搜索或手动填写{v0}", { v0: label })} />;
}

export function RetailStorageControl({ category, value, onChange, label = "机身存储", disk = false }: {
  category: RetailCategory; value: Capacity | null; onChange: (value: Capacity | null) => void; label?: string; disk?: boolean;
}) {
  const { t } = useLanguage();
  const options: Capacity[] = disk ? [...[128, 256, 512].map(capacity => ({ capacity, unit: "GB" as const })), ...[1, 2, 4, 8, 16].map(capacity => ({capacity, unit: "TB" as const}))] : retailStoragePresets(category);
  const [custom, setCustom] = useState(() => Boolean(value && value.capacity !== null && !options.some(item => item.capacity === value.capacity && item.unit === value.unit)));
  const [raw, setRaw] = useState(() => String(value?.capacity ?? ""));
  const id = useId();
  const selected = custom ? "custom" : value?.capacity != null ? `${value.capacity}-${value.unit}` : "unknown";
  const number = retailDraftNumber(raw); const unit = value?.unit ?? "GB";
  const invalid = custom && number !== null && (!Number.isFinite(number) || number <= 0 || number > (unit === "GB" ? 1048576 : 1024));
  return <div className={styles.control}>
    <label className="field"><span>{t(label)}</span><SelectControl aria-label={t(label)} value={selected} onChange={event => {
      const next = event.target.value;
      setCustom(next === "custom");
      if (next === "unknown") { setRaw(""); onChange(null); }
      else if (next === "custom") setRaw(String(value?.capacity ?? ""));
      else { const option = options.find(item => `${item.capacity}-${item.unit}` === next); if (option) { setRaw(String(option.capacity)); onChange({ ...option }); } }
    }}><option value="unknown">{t("未记录")}</option>{options.map(option => <option key={`${option.capacity}-${option.unit}`} value={`${option.capacity}-${option.unit}`}>{option.capacity} {option.unit}</option>)}<option value="custom">{t("自定义容量")}</option></SelectControl></label>
    {custom ? <div className={styles.capacity}><label className="field"><span>{t("自定义容量")}</span><InputControl validate={() => invalid ? "容量须为有效正数，请核对容量及单位。" : ""} aria-label={t("自定义{v0}", { v0: label })} aria-invalid={invalid} aria-describedby={id} inputMode="decimal" maxLength={12} value={raw} placeholder={t("未知留空")} onChange={event => { setRaw(event.target.value); onChange({ capacity: retailDraftNumber(event.target.value), unit }); }} /></label><label className="field"><span>{t("单位")}</span><SelectControl aria-label={t("{v0}单位", { v0: label })} value={unit} onChange={event => onChange({ capacity: retailDraftNumber(raw), unit: event.target.value as Capacity["unit"] })}><option value="GB">GB</option><option value="TB">TB</option></SelectControl></label><small id={id} className={invalid ? styles.error : styles.hint}>{invalid ? t("容量须为有效正数，请核对容量及单位。") : t("填写实测容量，空白为未记录")}</small></div> : null}
  </div>;
}

export function RetailRamControl({ value, onChange }: { value: number | null; onChange: (value: number | null) => void }) {
  const { t } = useLanguage();
  const [custom, setCustom] = useState(() => value !== null && !retailRamPresets.includes(value));
  return <div className={styles.control}><label className="field"><span>RAM（GB）</span><SelectControl aria-label="RAM（GB）" value={custom ? "custom" : value === null ? "unknown" : String(value)} onChange={event => {
    const next = event.target.value; setCustom(next === "custom");
    if (next !== "custom") onChange(next === "unknown" ? null : Number(next));
  }}><option value="unknown">{t("未记录")}</option>{retailRamPresets.map(amount => <option value={amount} key={amount}>{amount} GB</option>)}<option value="custom">{t("自定义容量")}</option></SelectControl></label>{custom ? <RetailNumberControl label={t("自定义RAM容量")} value={value} onChange={onChange} min={1} max={8192} unit="GB" /> : null}</div>;
}

export function RetailDisksControl({ value, onChange, category }: { value: RetailDisk[]; onChange: (value: RetailDisk[]) => void; category: RetailCategory }) {
  const { t } = useLanguage();
  const prefix = useId(); const sequence = useRef(value.length);
  const [keys, setKeys] = useState(() => value.map((_, index) => `${prefix}-${index}`));
  function update(index: number, change: Partial<RetailDisk>) { onChange(value.map((disk, position) => position === index ? { ...disk, ...change } : disk)); }
  return <div className={styles.disks} aria-label={t("逐块存储编辑")}>
    {!value.length ? <p className={styles.hint}>{t("未记录磁盘，可逐块添加实物存储。")}</p> : null}
    {value.map((disk, index) => <div className={styles.disk} key={keys[index]}><header><strong><HardDrive size={17} aria-hidden="true" />{t("第 ")}{index + 1} {t(" 块存储")}</strong><button type="button" className="icon-button" aria-label={t("移除第 {v0} 块存储", { v0: index + 1 })} onClick={() => { setKeys(keys.filter((_, position) => position !== index)); onChange(value.filter((_, position) => position !== index)); }}><X size={17} /></button></header><div>
      <label className="field"><span>{t("类型")}</span><SelectControl aria-label={t("第 {v0} 块类型", { v0: index + 1 })} value={disk.type} onChange={event => update(index, {type: event.target.value as RetailDisk["type"]})}><option value="SSD">SSD</option><option value="HDD">HDD</option><option value="NVMe SSD">NVMe SSD</option></SelectControl></label>
      <RetailStorageControl category={category} disk label={t("第 {v0} 块容量", { v0: index + 1 })} value={{ capacity: disk.capacity, unit: disk.unit }} onChange={capacity => update(index, capacity ?? {capacity: null, unit: disk.unit})} />
    </div></div>)}
    <button type="button" className="button button--secondary" disabled={value.length >= 16} onClick={() => { setKeys([...keys, `${prefix}-${sequence.current++}`]); onChange([...value, {capacity: null, unit: "GB", type: "SSD"}]); }}><Plus size={17} />{t("添加一块存储")}<small>{value.length}/16</small></button>
  </div>;
}
