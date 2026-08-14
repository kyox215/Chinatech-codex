"use client";

import { useMemo, useRef, useState } from "react";
import { Check, Palette, Search } from "lucide-react";

import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
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
import { phoneColorBackground } from "@/features/inventory/model/eu-phone-catalog";
import type { InventoryCatalogOption, InventoryProductCategory } from "@/lib/repairdesk/types";
import { componentDensity } from "@/lib/component-patterns";
import { cn } from "@/lib/utils";
import {
  hasLearnedCatalogModel,
  learnedCatalogBrandsForCategory,
  learnedCatalogOptionsForBrand,
  mergeInventoryCatalogOptions,
} from "../model/inventory-catalog-options";
import {
  listDeviceColorOptions,
  listDeviceRamOptions,
  listDeviceStorageOptions,
} from "../model/device-form-options";

type InventoryDeviceCatalogFieldsProps = {
  category: InventoryProductCategory;
  brand: string;
  model: string;
  ramCapacity?: string;
  storageCapacity?: string;
  color?: string;
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

const inputClass = componentDensity.compactSelector.editableInput;

export function InventoryDeviceCatalogFields({
  category,
  brand,
  model,
  ramCapacity = "",
  storageCapacity = "",
  color = "",
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
  const colorOptions = useMemo(
    () => listDeviceColorOptions(category, selectedModel?.colors),
    [category, selectedModel?.colors],
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
          <CatalogSpecificationChoices
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
          <CatalogSpecificationChoices
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
        <CatalogColorChoices
          value={color}
          options={colorOptions}
          disabled={disabled}
          onChange={onColorChange}
          pickerMode={pickerMode}
          idPrefix={idPrefix}
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

function CatalogSpecificationChoices({
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
  const isManualValue = Boolean(value) && !options.includes(value);
  const [open, setOpen] = useState(false);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const listId = `${id}-options`;
  const close = () => {
    setOpen(false);
    triggerRef.current?.focus({ preventScroll: true });
  };
  return (
    <fieldset className={cn("min-w-0 space-y-1.5", className)}>
      <legend className="text-xs font-medium">{label}</legend>
      {options.length > 0 && pickerMode !== "mobile" ? (
        <div
          role="radiogroup"
          aria-label={`${label}常用选项`}
          className="flex max-h-40 min-w-0 flex-wrap gap-1 overflow-y-auto overscroll-contain pr-1"
        >
          {options.map((option) => (
            <button
              key={option}
              type="button"
              role="radio"
              aria-checked={value === option}
              disabled={disabled}
              onClick={() => onChange(option)}
              className={cn(
                "min-h-11 min-w-11 rounded-lg border px-2 text-[11px] font-medium transition-colors",
                value === option
                  ? "border-primary bg-primary/10 text-primary"
                  : "border-[var(--border-panel)] bg-background hover:bg-accent/60",
              )}
            >
              {option}
            </button>
          ))}
        </div>
      ) : null}
      {options.length > 0 && pickerMode === "mobile" ? (
        <>
          <button
            type="button"
            className="min-h-11 min-w-0 w-full rounded-lg border border-[var(--border-panel)] bg-background px-3 text-left text-base font-medium lg:text-sm"
            aria-expanded={open}
            aria-haspopup="listbox"
            aria-controls={open ? listId : undefined}
            ref={triggerRef}
            disabled={disabled}
            onClick={() => setOpen(true)}
          >
            {value || "选择" + label}
          </button>
          {open ? (
            <div
              role="listbox"
              id={listId}
              aria-label={`${label}选择`}
              tabIndex={-1}
              onKeyDown={(event) => {
                if (event.key === "Escape") {
                  event.preventDefault();
                  close();
                }
              }}
              className="max-h-72 overflow-y-auto rounded-lg border border-[var(--border-panel)] bg-popover p-1 shadow-[var(--shadow-overlay)]"
            >
              {options.map((option) => (
                <button
                  key={option}
                  type="button"
                  role="option"
                  aria-selected={value === option}
                  className="flex min-h-11 w-full items-center rounded-md px-3 text-left text-base hover:bg-accent lg:text-sm"
                  onClick={() => {
                    onChange(option);
                    close();
                  }}
                >
                  {option}
                </button>
              ))}
            </div>
          ) : null}
        </>
      ) : null}
      <Input
        id={id}
        className={cn(inputClass, "text-base !text-base lg:!text-sm")}
        value={isManualValue ? value : ""}
        disabled={disabled}
        onChange={(event) => onChange(event.target.value)}
        placeholder={`${placeholder}${options.length ? "（其他）" : ""}`}
        aria-label={label}
      />
    </fieldset>
  );
}

function CatalogColorChoices({
  value,
  options,
  disabled,
  onChange,
  pickerMode,
  className,
  idPrefix,
}: {
  value: string;
  options: DeviceCatalogModel["colors"];
  disabled?: boolean;
  onChange: (value: string) => void;
  className?: string;
  pickerMode?: CatalogPickerMode;
  idPrefix: string;
}) {
  const isManualValue = Boolean(value) && !options.some((option) => option.name === value);
  const [open, setOpen] = useState(false);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const listId = `${idPrefix}-color-options`;
  const close = () => {
    setOpen(false);
    triggerRef.current?.focus({ preventScroll: true });
  };
  return (
    <fieldset className={cn("col-span-2 min-w-0 space-y-1.5", className)}>
      <legend className="flex items-center gap-1.5 text-xs font-medium">
        <Palette className="size-3.5 text-primary" /> 设备颜色
      </legend>
      {options.length > 0 && pickerMode !== "mobile" ? (
        <div
          role="radiogroup"
          aria-label="设备颜色常用选项"
          className="flex max-h-40 min-w-0 flex-wrap gap-1 overflow-y-auto overscroll-contain pr-1"
        >
          {options.map((option) => {
            const selected = value === option.name;
            return (
              <button
                key={option.id}
                type="button"
                role="radio"
                aria-checked={selected}
                aria-label={`颜色：${option.name}${selected ? "，已选择" : ""}`}
                disabled={disabled}
                onClick={() => onChange(option.name)}
                className={cn(
                  "flex min-h-11 items-center gap-1.5 rounded-lg border px-2 text-[11px] font-medium transition-colors",
                  selected
                    ? "border-primary bg-primary/10 text-primary"
                    : "border-[var(--border-panel)] bg-background hover:bg-accent/60",
                )}
              >
                <span
                  aria-hidden="true"
                  className="size-4 shrink-0 rounded-full border border-foreground/25"
                  style={{ background: phoneColorBackground(option) }}
                />
                <span>{option.name}</span>
                <Check className={cn("size-3.5", selected ? "opacity-100" : "opacity-0")} />
              </button>
            );
          })}
        </div>
      ) : null}
      {options.length > 0 && pickerMode === "mobile" ? (
        <>
          <button
            type="button"
            className="min-h-11 min-w-0 w-full rounded-lg border border-[var(--border-panel)] bg-background px-3 text-left text-base font-medium lg:text-sm"
            aria-expanded={open}
            aria-haspopup="listbox"
            aria-controls={open ? listId : undefined}
            ref={triggerRef}
            disabled={disabled}
            onClick={() => setOpen(true)}
          >
            {value || "选择设备颜色"}
          </button>
          {open ? (
            <div
              role="listbox"
              id={listId}
              aria-label="设备颜色选择"
              tabIndex={-1}
              onKeyDown={(event) => {
                if (event.key === "Escape") {
                  event.preventDefault();
                  close();
                }
              }}
              className="max-h-72 overflow-y-auto rounded-lg border border-[var(--border-panel)] bg-popover p-1 shadow-[var(--shadow-overlay)]"
            >
              {options.map((option) => (
                <button
                  key={option.id}
                  type="button"
                  role="option"
                  aria-selected={value === option.name}
                  className="flex min-h-11 w-full items-center gap-2 rounded-md px-3 text-left text-base hover:bg-accent lg:text-sm"
                  onClick={() => {
                    onChange(option.name);
                    close();
                  }}
                >
                  <span
                    aria-hidden="true"
                    className="size-4 shrink-0 rounded-full border border-foreground/25"
                    style={{ background: phoneColorBackground(option) }}
                  />
                  {option.name}
                </button>
              ))}
            </div>
          ) : null}
        </>
      ) : null}
      <Input
        id={`${idPrefix}-color`}
        className={cn(inputClass, "text-base !text-base lg:!text-sm")}
        value={isManualValue ? value : ""}
        disabled={disabled}
        onChange={(event) => onChange(event.target.value)}
        placeholder="例如 蓝色（其他/手动）"
        aria-label="设备颜色"
      />
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
