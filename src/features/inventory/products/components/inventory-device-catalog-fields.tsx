"use client";

import { useMemo } from "react";
import { Search } from "lucide-react";

import { Input } from "@/components/ui/input";
import {
  CatalogCombobox,
  catalogCategoryCopy,
  type CatalogPickerSurface,
  type CatalogPickerMode,
  type CatalogOption,
  type CatalogSelection,
} from "@/features/inventory/components/inventory-phone-catalog-fields";
import {
  findDeviceCatalogBrand,
  findDeviceCatalogModel,
  listDeviceCatalogBrands,
  listDeviceCatalogModels,
  type DeviceCatalogModel,
} from "@/features/inventory/products/model/device-catalog";
import type { InventoryCatalogOption, InventoryProductCategory } from "@/lib/repairdesk/types";
import { cn } from "@/lib/utils";
import {
  InventorySelectableField,
  type InventorySelectableFieldOption,
} from "./inventory-selectable-field";
import {
  hasLearnedCatalogModel,
  learnedCatalogBrandsForCategory,
  learnedCatalogOptionsForBrand,
  mergeInventoryCatalogOptions,
} from "../model/inventory-catalog-options";
import { listDeviceRamOptions, listDeviceStorageOptions } from "../model/device-form-options";
import {
  resolveDeviceColorPolicy,
  type AppleColorApprovalOverlay,
} from "../model/device-color-policy";

type InventoryDeviceCatalogFieldsProps = {
  category: InventoryProductCategory;
  brand: string;
  model: string;
  ramCapacity?: string;
  storageCapacity?: string;
  color?: string;
  existingColor?: string;
  approvedAppleColorOverlay?: AppleColorApprovalOverlay;
  colorRequired?: boolean;
  colorInvalid?: boolean;
  surface?: CatalogPickerSurface;
  pickerMode?: CatalogPickerMode;
  disabled?: boolean;
  autoFocusBrand?: boolean;
  idPrefix?: string;
  brandInvalid?: boolean;
  modelInvalid?: boolean;
  learnedCatalogOptions?: readonly InventoryCatalogOption[];
  onBrandChange: (value: string) => void;
  onModelChange: (value: string) => void;
  onRamChange: (value: string) => void;
  onStorageChange: (value: string) => void;
  onColorChange: (value: string) => void;
};

export function InventoryDeviceCatalogFields({
  category,
  brand,
  model,
  ramCapacity = "",
  storageCapacity = "",
  color = "",
  existingColor,
  approvedAppleColorOverlay = {},
  colorRequired = false,
  colorInvalid = false,
  surface = "page",
  pickerMode = "auto",
  disabled = false,
  autoFocusBrand = false,
  idPrefix = "product",
  brandInvalid = false,
  modelInvalid = false,
  learnedCatalogOptions = [],
  onBrandChange,
  onModelChange,
  onRamChange,
  onStorageChange,
  onColorChange,
}: InventoryDeviceCatalogFieldsProps) {
  const brands = useMemo(() => listDeviceCatalogBrands(category), [category]);
  const models = useMemo(() => listDeviceCatalogModels(category, brand), [brand, category]);
  const selectedBrand = useMemo(() => findDeviceCatalogBrand(category, brand), [brand, category]);
  const selectedModel = useMemo(
    () => findDeviceCatalogModel(category, brand, model),
    [brand, category, model],
  );
  const categoryCopy = catalogCategoryCopy[category];

  const learnedBrandOptions = useMemo(
    () => learnedCatalogBrandsForCategory(learnedCatalogOptions, category),
    [category, learnedCatalogOptions],
  );
  const learnedModelOptions = useMemo(
    () => learnedCatalogOptionsForBrand(learnedCatalogOptions, category, brand),
    [brand, category, learnedCatalogOptions],
  );

  const brandOptions = useMemo<CatalogOption[]>(
    () =>
      mergeInventoryCatalogOptions(
        brands.map((item) => ({
          value: item.name,
          keywords: item.aliases?.join(" "),
          aliases: item.aliases,
          description: `${categoryLabel(category)} · ${listDeviceCatalogModels(category, item.name).length} 个型号`,
          group: item.name === selectedBrand?.name ? "当前品牌" : "常用品牌",
          icon: brandMonogram(item.name),
        })),
        learnedBrandOptions,
      ),
    [brands, category, learnedBrandOptions, selectedBrand?.name],
  );

  const modelOptions = useMemo<CatalogOption[]>(
    () =>
      mergeInventoryCatalogOptions(
        models.map((item) => ({
          value: item.name,
          keywords: item.aliases?.join(" "),
          aliases: item.aliases,
          description: item.releasedOn?.slice(0, 4) ?? "系列",
          group: item.series,
          icon: modelMonogram(item),
        })),
        learnedModelOptions,
      ),
    [learnedModelOptions, models],
  );
  const storageOptions = useMemo(
    () => listDeviceStorageOptions(category, selectedModel?.storageOptions),
    [category, selectedModel?.storageOptions],
  );
  const ramOptions = useMemo(
    () => listDeviceRamOptions(category, selectedModel?.ramOptions),
    [category, selectedModel?.ramOptions],
  );
  const colorPolicy = useMemo(
    () =>
      resolveDeviceColorPolicy({
        category,
        brand,
        model,
        existingColor,
        selectedColor: color,
        approvedAppleColors: approvedAppleColorOverlay,
        colorRequired,
      }),
    [approvedAppleColorOverlay, brand, category, color, colorRequired, existingColor, model],
  );
  const colorOptions = useMemo<InventorySelectableFieldOption[]>(
    () =>
      colorPolicy.options.map((option) => ({
        value: option.name,
        label: option.name,
        leading: (
          <span
            aria-hidden="true"
            className="mt-0.5 block size-4 shrink-0 rounded-full border border-foreground/25"
            style={{ background: option.swatches[0] ?? "transparent" }}
          />
        ),
      })),
    [colorPolicy.options],
  );

  const handleBrandSelect = (selection: CatalogSelection) => {
    onBrandChange(selection.value);
  };

  const handleBrandInput = (value: string) => {
    onBrandChange(value);
  };

  const handleModelSelect = (selection: CatalogSelection) => onModelChange(selection.value);

  return (
    <div className="min-w-0 space-y-2">
      <div className="grid min-w-0 grid-cols-1 min-[360px]:grid-cols-[minmax(0,0.85fr)_minmax(0,1.15fr)] gap-1.5 sm:gap-2.5">
        <CatalogCombobox
          id={`${idPrefix}-brand`}
          label="品牌 *"
          value={brand}
          placeholder={categoryCopy.brandPlaceholder}
          compactPlaceholder="选择品牌"
          helperText={categoryCopy.brandHint}
          searchPlaceholder={categoryCopy.brandSearchPlaceholder}
          options={brandOptions}
          disabled={disabled}
          editable
          surface={surface}
          pickerMode={pickerMode}
          required
          invalid={brandInvalid}
          autoFocus={autoFocusBrand}
          maxLength={120}
          onInputChange={handleBrandInput}
          onSelect={handleBrandSelect}
        />
        <CatalogCombobox
          id={`${idPrefix}-model`}
          label="型号 / 商品名称 *"
          value={model}
          placeholder={selectedBrand ? "选择型号" : "先选品牌"}
          compactPlaceholder={selectedBrand ? "选择型号" : "先选品牌"}
          helperText={categoryCopy.modelHint}
          searchPlaceholder={categoryCopy.modelSearchPlaceholder}
          options={modelOptions}
          editable
          surface={surface}
          pickerMode={pickerMode}
          required
          disabled={disabled || !brand.trim()}
          invalid={modelInvalid}
          maxLength={160}
          onInputChange={onModelChange}
          onSelect={handleModelSelect}
        />
      </div>
      <p className="text-[10px] leading-4 text-muted-foreground lg:text-[11px] lg:leading-4">
        <Search className="mr-1 inline size-3" />
        选择器按类别、品牌和系列分组；没有收录的设备仍可直接手动录入。
      </p>

      <div className="grid min-w-0 grid-cols-2 gap-2">
        {category !== "other" ? (
          <SpecificationField
            id={`${idPrefix}-storage`}
            label={category === "computer" ? "硬盘 / 存储容量" : "存储容量"}
            value={storageCapacity}
            options={storageOptions}
            placeholder={categoryCopy.storagePlaceholder}
            className={category === "game_console" ? "col-span-2" : undefined}
            pickerMode={pickerMode}
            disabled={disabled}
            onChange={onStorageChange}
          />
        ) : null}
        {(["phone", "tablet", "computer"] as InventoryProductCategory[]).includes(category) ? (
          <SpecificationField
            id={`${idPrefix}-ram`}
            label="内存（RAM）"
            value={ramCapacity}
            options={ramOptions}
            placeholder="例如 8 GB"
            pickerMode={pickerMode}
            disabled={disabled}
            onChange={onRamChange}
          />
        ) : null}
        <ColorField
          value={color}
          existingColor={existingColor}
          options={colorOptions}
          policyState={colorPolicy.state}
          statusMessage={colorPolicy.statusMessage}
          invalid={colorInvalid || !colorPolicy.save.canSave}
          errorMessage={
            !colorPolicy.save.canSave
              ? colorRequired
                ? "请先选择设备颜色后再保存"
                : "Apple 设备颜色必须来自已审核的官方颜色映射"
              : undefined
          }
          disabled={disabled}
          onChange={onColorChange}
          pickerMode={pickerMode}
          id={`${idPrefix}-color`}
          className={category === "other" || category === "game_console" ? "col-span-2" : undefined}
        />
      </div>
      {model &&
      !selectedModel &&
      !hasLearnedCatalogModel(learnedCatalogOptions, category, brand, model) ? (
        <p className="rounded-lg border border-dashed border-[var(--border-panel)] px-2.5 py-2 text-[10px] leading-4 text-muted-foreground">
          目录中没有“{model}”，已按手动型号保留；仍可继续入库。
        </p>
      ) : null}
    </div>
  );
}

function SpecificationField({
  id,
  label,
  value,
  options,
  placeholder,
  className,
  pickerMode,
  disabled,
  onChange,
}: {
  id: string;
  label: string;
  value: string;
  options: readonly string[];
  placeholder: string;
  className?: string;
  pickerMode?: CatalogPickerMode;
  disabled?: boolean;
  onChange: (value: string) => void;
}) {
  const selectableOptions = options.map((option) => ({ value: option, label: option }));
  const isManualValue = Boolean(value) && !options.includes(value);
  return (
    <fieldset className={cn("min-w-0 space-y-1.5", className)}>
      <InventorySelectableField
        id={id}
        label={label}
        value={value}
        placeholder={`选择${label}`}
        options={selectableOptions}
        mode={pickerMode}
        disabled={disabled}
        onChange={onChange}
      />
      <Input
        id={`${id}-manual`}
        className="h-11 min-h-11 min-w-0 text-base !text-base lg:h-9 lg:min-h-0 lg:!text-sm"
        value={isManualValue ? value : ""}
        disabled={disabled}
        onChange={(event) => onChange(event.target.value)}
        placeholder={`${placeholder}${options.length ? "（其他/手动）" : ""}`}
        aria-label={`${label}手动补充`}
      />
    </fieldset>
  );
}

function ColorField({
  id,
  value,
  existingColor,
  options,
  policyState,
  statusMessage,
  invalid,
  errorMessage,
  disabled,
  onChange,
  pickerMode,
  className,
}: {
  id: string;
  value: string;
  existingColor?: string;
  options: readonly InventorySelectableFieldOption[];
  policyState: "generic" | "approved" | "pending-official-color";
  statusMessage: string;
  invalid?: boolean;
  errorMessage?: string;
  disabled?: boolean;
  onChange: (value: string) => void;
  pickerMode?: CatalogPickerMode;
  className?: string;
}) {
  const isPending = policyState === "pending-official-color";
  const isManualValue = Boolean(value) && !options.some((option) => option.value === value);
  const preservedValue = existingColor?.trim();
  const displayValue = isPending ? (preservedValue ?? "") : value;
  return (
    <fieldset className={cn("col-span-2 min-w-0 space-y-1.5", className)}>
      <InventorySelectableField
        id={id}
        label="设备颜色"
        value={displayValue}
        placeholder="选择设备颜色"
        options={options}
        mode={pickerMode}
        pending={isPending}
        pendingMessage={statusMessage}
        invalid={invalid}
        ariaDescribedBy={invalid ? `${id}-error` : undefined}
        disabled={disabled}
        onChange={onChange}
      />
      {isPending ? (
        preservedValue ? (
          <Input
            id={`${id}-preserved`}
            className="h-11 min-h-11 min-w-0 text-base !text-base lg:h-9 lg:min-h-0 lg:!text-sm"
            value={preservedValue}
            readOnly
            disabled={disabled}
            aria-label="设备颜色当前值（只读）"
          />
        ) : null
      ) : policyState === "generic" ? (
        <Input
          id={`${id}-manual`}
          className="h-11 min-h-11 min-w-0 text-base !text-base lg:h-9 lg:min-h-0 lg:!text-sm"
          value={isManualValue ? value : ""}
          disabled={disabled}
          onChange={(event) => onChange(event.target.value)}
          placeholder="例如 蓝色（其他/手动）"
          aria-label="设备颜色手动补充"
        />
      ) : null}
      {invalid && errorMessage ? (
        <p id={`${id}-error`} className="text-xs text-status-danger-foreground">
          {errorMessage}
        </p>
      ) : null}
    </fieldset>
  );
}

function categoryLabel(category: InventoryProductCategory) {
  return { phone: "手机", tablet: "平板", computer: "电脑", game_console: "游戏机", other: "其他" }[
    category
  ];
}

function brandMonogram(name: string) {
  return (
    name
      .replace(/[^A-Za-z0-9]/g, "")
      .slice(0, 2)
      .toUpperCase() || "品"
  );
}

function modelMonogram(model: DeviceCatalogModel) {
  return (
    model.series
      .replace(/[^A-Za-z0-9]/g, "")
      .slice(0, 2)
      .toUpperCase() || "型"
  );
}
