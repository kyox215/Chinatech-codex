"use client";

import { useMemo } from "react";
import { Check, Palette, Search } from "lucide-react";

import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  CatalogCombobox,
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
import type { InventoryProductCategory } from "@/lib/repairdesk/types";
import { cn } from "@/lib/utils";

type InventoryDeviceCatalogFieldsProps = {
  category: InventoryProductCategory;
  brand: string;
  model: string;
  ramCapacity?: string;
  storageCapacity?: string;
  color?: string;
  autoFocusBrand?: boolean;
  brandInvalid?: boolean;
  modelInvalid?: boolean;
  onBrandChange: (value: string) => void;
  onModelChange: (value: string) => void;
  onRamChange: (value: string) => void;
  onStorageChange: (value: string) => void;
  onColorChange: (value: string) => void;
};

const inputClass = "h-[38px] min-w-0 text-base sm:h-10 sm:text-sm";

export function InventoryDeviceCatalogFields({
  category,
  brand,
  model,
  ramCapacity = "",
  storageCapacity = "",
  color = "",
  autoFocusBrand = false,
  brandInvalid = false,
  modelInvalid = false,
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

  const brandOptions = useMemo<CatalogOption[]>(
    () =>
      brands.map((item) => ({
        value: item.name,
        keywords: item.aliases?.join(" "),
        aliases: item.aliases,
        description: `${categoryLabel(category)} · ${listDeviceCatalogModels(category, item.name).length} 个型号`,
        group: item.name === selectedBrand?.name ? "当前品牌" : "常用品牌",
        icon: brandMonogram(item.name),
      })),
    [brands, category, selectedBrand?.name],
  );

  const modelOptions = useMemo<CatalogOption[]>(
    () =>
      models.map((item) => ({
        value: item.name,
        keywords: item.aliases?.join(" "),
        aliases: item.aliases,
        description: item.releasedOn?.slice(0, 4) ?? "系列",
        group: item.series,
        icon: modelMonogram(item),
      })),
    [models],
  );

  const handleBrandSelect = (selection: CatalogSelection) => {
    onBrandChange(selection.value);
    if (selection.value !== brand) onModelChange("");
  };

  const handleBrandInput = (value: string) => {
    onBrandChange(value);
    if (value !== brand) onModelChange("");
  };

  const handleModelSelect = (selection: CatalogSelection) => onModelChange(selection.value);

  return (
    <div className="min-w-0 space-y-2">
      <div className="grid min-w-0 grid-cols-[minmax(0,0.85fr)_minmax(0,1.15fr)] gap-1.5 sm:gap-2.5">
        <CatalogCombobox
          id="product-brand"
          label="品牌 *"
          value={brand}
          placeholder="例如 Apple、Samsung"
          options={brandOptions}
          editable
          required
          invalid={brandInvalid}
          autoFocus={autoFocusBrand}
          maxLength={120}
          onInputChange={handleBrandInput}
          onSelect={handleBrandSelect}
        />
        <CatalogCombobox
          id="product-model"
          label="型号 / 商品名称 *"
          value={model}
          placeholder={selectedBrand ? `搜索 ${selectedBrand.name} 型号` : "先输入或选择品牌"}
          options={modelOptions}
          editable
          required
          disabled={!brand.trim()}
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
            id="product-storage"
            label={category === "computer" ? "硬盘 / 存储容量" : "存储容量"}
            value={storageCapacity}
            options={selectedModel?.storageOptions ?? []}
            placeholder={category === "computer" ? "例如 512 GB" : "例如 128 GB"}
            onChange={onStorageChange}
          />
        ) : null}
        {(["phone", "tablet", "computer"] as InventoryProductCategory[]).includes(category) ? (
          <CatalogSpecificationChoices
            id="product-ram"
            label="内存（RAM）"
            value={ramCapacity}
            options={selectedModel?.ramOptions ?? []}
            placeholder="例如 8 GB"
            onChange={onRamChange}
          />
        ) : null}
        <CatalogColorChoices
          value={color}
          options={selectedModel?.colors ?? []}
          onChange={onColorChange}
          className={category === "other" || category === "game_console" ? "col-span-2" : undefined}
        />
      </div>
      {model && !selectedModel ? (
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
  onChange,
}: {
  id: string;
  label: string;
  value: string;
  options: readonly string[];
  placeholder: string;
  onChange: (value: string) => void;
}) {
  const isManualValue = Boolean(value) && !options.includes(value);
  return (
    <fieldset className="min-w-0 space-y-1.5">
      <legend className="text-xs font-medium">{label}</legend>
      {options.length ? (
        <div
          role="radiogroup"
          aria-label={`${label}常用选项`}
          className="flex min-w-0 flex-wrap gap-1"
        >
          {options.map((option) => (
            <button
              key={option}
              type="button"
              role="radio"
              aria-checked={value === option}
              onClick={() => onChange(option)}
              className={cn(
                "min-h-8 rounded-lg border px-2 text-[11px] font-medium transition-colors",
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
      <Input
        id={id}
        className={inputClass}
        value={isManualValue ? value : ""}
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
  onChange,
  className,
}: {
  value: string;
  options: DeviceCatalogModel["colors"];
  onChange: (value: string) => void;
  className?: string;
}) {
  const isManualValue = Boolean(value) && !options.some((option) => option.name === value);
  return (
    <fieldset className={cn("col-span-2 min-w-0 space-y-1.5", className)}>
      <legend className="flex items-center gap-1.5 text-xs font-medium">
        <Palette className="size-3.5 text-primary" /> 设备颜色
      </legend>
      {options.length ? (
        <div
          role="radiogroup"
          aria-label="设备颜色常用选项"
          className="flex min-w-0 flex-wrap gap-1"
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
                onClick={() => onChange(option.name)}
                className={cn(
                  "flex min-h-8 items-center gap-1.5 rounded-lg border px-2 text-[11px] font-medium transition-colors",
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
      <Input
        id="product-color"
        className={inputClass}
        value={isManualValue ? value : ""}
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
