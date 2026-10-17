"use client";

import { DeviceCatalogControl } from "./device-catalog-control";
import type { ComboboxOption } from "@/components/search-combobox";
import { canonicalCatalogBrand, catalogCategory } from "@/lib/device-catalog";
import { useCatalogIndex } from "./use-catalog";
import { useLayoutEffect, useRef, useSyncExternalStore, type ReactNode } from "react";
import { useLanguage } from "@/components/language-provider";
import styles from "./device-catalog.module.css";
import type{HistoricalCatalogSource}from'./historical-catalog-source';

type Props = {
  category: string; brand: string; model: string; onCommit: (value: { brand: string; model: string }) => void;
  mode?: "identity" | "brand" | "model"; brandLabel?: string; modelLabel?: string;
  modelClassName?: string; brandClassName?: string; brandRequired?: boolean; modelRequired?: boolean;
  brandMaxLength?: number; modelMaxLength?: number; disabled?: boolean; validationError?: boolean;
  historicalBrands?: readonly ComboboxOption[]; historicalModels?: readonly ComboboxOption[];
  historicalModelsByBrand?: Readonly<Record<string, readonly ComboboxOption[]>>;
  recordedBrands?:HistoricalCatalogSource;recordedModels?:HistoricalCatalogSource;
};
export function CatalogIndexPreload({ category, enabled = true }: { category: string; enabled?: boolean }) {
  useCatalogIndex({ category: category === "电脑" ? "computer" : catalogCategory(category) ?? "other" }, enabled);
  return null;
}
/** Shared field presentation only; callers retain draft cleanup and existing-record update rules. */
export function DeviceIdentityPicker({
  mode = "identity", brandLabel = "品牌", modelLabel = "型号", brandRequired = false,
  modelRequired = true, brandMaxLength = 60, modelMaxLength = 120, ...props
}: Props) {
  return <>
    {mode !== "model" ? <DeviceCatalogControl category={props.category} field="brand" label={brandLabel}
      value={props.brand} onChange={brand => props.onCommit({ brand, model: props.model })}
      className={props.brandClassName} required={brandRequired} maxLength={brandMaxLength}
      disabled={props.disabled} validationError={props.validationError} historicalOptions={props.historicalBrands} historicalRead={props.recordedBrands} /> : null}
    {mode !== "brand" ? <DeviceCatalogControl category={props.category} field="model" label={modelLabel}
      brand={props.brand} value={props.model} onChange={model => props.onCommit({ brand: props.brand, model })}
      className={props.modelClassName} required={modelRequired} maxLength={modelMaxLength}
      disabled={props.disabled} validationError={props.validationError}
      historicalOptions={props.historicalModels ?? props.historicalModelsByBrand?.[canonicalCatalogBrand(props.brand)]} historicalRead={props.recordedModels} /> : null}
  </>;
}
function subscribeMobile(listener: () => void) {
  const media = window.matchMedia("(max-width: 767px)");
  media.addEventListener("change", listener);
  return () => media.removeEventListener("change", listener);
}
export function DeviceIdentityExtras({ children, hasValue }: { children: ReactNode; hasValue: boolean }) {
  const { t } = useLanguage();
  const details = useRef<HTMLDetailsElement>(null);
  const mobile = useSyncExternalStore(subscribeMobile, () => window.matchMedia("(max-width: 767px)").matches, () => false);
  // Restored facts become visible; clearing a value must not collapse an editor still in use.
  useLayoutEffect(() => { if (hasValue && details.current) details.current.open = true; }, [hasValue, mobile]);
  return mobile ? <details ref={details} className={styles.deviceExtras}>
    <summary>{t("更多设备信息 · 颜色、SN / IMEI")}</summary><div className="field-grid">{children}</div>
  </details> : <>{children}</>;
}
export function IdentityChangeNotice({ onUndo, disabled }: { onUndo: () => void; disabled?: boolean }) {
  const { t } = useLanguage();
  return <div className={styles.identityNotice} role="status"><span>{t("已切换品牌，请重新选择型号。")}</span>
    <button className="button button--secondary" type="button" disabled={disabled} onClick={onUndo}>{t("撤销品牌切换")}</button>
  </div>;
}
