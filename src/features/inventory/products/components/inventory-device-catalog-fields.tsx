"use client";

import { useMemo } from "react";
import { Search } from "lucide-react";

import { Input } from "@/components/ui/input";
import {
  CatalogCombobox,
  catalogCategoryCopy,
  type CatalogComboboxPresentation,
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
  localizeInventoryColor,
  localizeInventoryColorPolicy,
  localizeInventoryProductCategory,
} from "../model/inventory-product-i18n";
import {
  resolveDeviceColorPolicy,
  type AppleColorApprovalOverlay,
} from "../model/device-color-policy";
import { useLocale } from "@/shared/i18n/locale-provider";
import type { MessageKey } from "@/shared/i18n/messages";

const catalogHintKeys: Record<InventoryProductCategory, MessageKey> = {
  phone: "inventory2b4.quick.catalog.hint.phone",
  tablet: "inventory2b4.quick.catalog.hint.tablet",
  computer: "inventory2b4.quick.catalog.hint.computer",
  game_console: "inventory2b4.quick.catalog.hint.gameConsole",
  other: "inventory2b4.quick.catalog.hint.other",
};

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
  const { locale, t } = useLocale();
  const brands = useMemo(() => listDeviceCatalogBrands(category), [category]);
  const models = useMemo(() => listDeviceCatalogModels(category, brand), [brand, category]);
  const selectedBrand = useMemo(() => findDeviceCatalogBrand(category, brand), [brand, category]);
  const selectedModel = useMemo(
    () => findDeviceCatalogModel(category, brand, model),
    [brand, category, model],
  );
  const categoryName = localizeInventoryProductCategory(category, category, t);
  const translatedCategoryCopy = {
    brandPlaceholder: t("inventory2b4.quick.catalog.brandPlaceholder", {
      category: categoryName,
    }),
    brandHint: t(catalogHintKeys[category]),
    brandSearchPlaceholder: t("inventory2b4.quick.catalog.searchBrand", {
      category: categoryName,
    }),
    modelHint: t("inventory2b4.quick.catalog.modelHint", { category: categoryName }),
    modelSearchPlaceholder: t("inventory2b4.quick.catalog.searchModel", {
      category: categoryName,
    }),
    storagePlaceholder:
      category === "computer"
        ? t("inventory2b4.quick.catalog.storageComputerExample")
        : category === "game_console"
          ? t("inventory2b4.quick.catalog.storageConsoleExample")
          : t("inventory2b4.quick.catalog.storageExample"),
  };
  const categoryCopy = locale === "zh-CN" ? catalogCategoryCopy[category] : translatedCategoryCopy;
  const catalogPresentation: CatalogComboboxPresentation = {
    openPickerLabel: t("inventory2b4.quick.catalog.openPicker"),
    selectionAria: (label) => t("inventory2b4.quick.catalog.selectionAria", { label }),
    closeSelectionAria: (label) => t("inventory2b4.quick.catalog.closeSelectionAria", { label }),
    defaultHelper: t("inventory2b4.quick.catalog.defaultHelper"),
    searchAction: t("inventory2b4.quick.catalog.searchAction"),
    browseHint: t("inventory2b4.quick.catalog.browseHint"),
    noResults: t("inventory2b4.quick.catalog.noResults"),
    manualGroup: t("inventory2b4.quick.catalog.manualGroup"),
    useValue: (value) => t("inventory2b4.quick.catalog.useValue", { value }),
    defaultGroup: t("inventory2b4.quick.catalog.defaultGroup"),
  };

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
          description: t("inventory2b4.quick.catalog.modelCount", {
            category: categoryName,
            count: listDeviceCatalogModels(category, item.name).length,
          }),
          group:
            item.name === selectedBrand?.name
              ? t("inventory2b4.quick.catalog.currentBrand")
              : t("inventory2b4.quick.catalog.commonBrands"),
          icon: brandMonogram(item.name, t("inventory2b4.quick.catalog.brandMonogram")),
        })),
        learnedBrandOptions,
      ),
    [brands, category, categoryName, learnedBrandOptions, selectedBrand?.name, t],
  );

  const modelOptions = useMemo<CatalogOption[]>(
    () =>
      mergeInventoryCatalogOptions(
        models.map((item) => ({
          value: item.name,
          keywords: item.aliases?.join(" "),
          aliases: item.aliases,
          description: item.releasedOn?.slice(0, 4) ?? t("inventory2b4.quick.catalog.series"),
          group: item.series,
          icon: modelMonogram(item, t("inventory2b4.quick.catalog.modelMonogram")),
        })),
        learnedModelOptions,
      ),
    [learnedModelOptions, models, t],
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
        label: localizeInventoryColor(
          { stableId: option.id, value: option.name, label: option.name },
          t,
        ).label,
        leading: (
          <span
            aria-hidden="true"
            className="mt-0.5 block size-4 shrink-0 rounded-full border border-foreground/25"
            style={{ background: option.swatches[0] ?? "transparent" }}
          />
        ),
      })),
    [colorPolicy.options, t],
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
          label={t("inventory2b4.quick.catalog.brandLabel")}
          value={brand}
          placeholder={categoryCopy.brandPlaceholder}
          compactPlaceholder={t("inventory2b4.quick.catalog.selectBrand")}
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
          presentation={catalogPresentation}
        />
        <CatalogCombobox
          id={`${idPrefix}-model`}
          label={t("inventory2b4.quick.catalog.modelLabel")}
          value={model}
          placeholder={
            selectedBrand
              ? t("inventory2b4.quick.catalog.selectModel")
              : t("inventory2b4.quick.catalog.chooseBrandFirst")
          }
          compactPlaceholder={
            selectedBrand
              ? t("inventory2b4.quick.catalog.selectModel")
              : t("inventory2b4.quick.catalog.chooseBrandFirst")
          }
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
          presentation={catalogPresentation}
        />
      </div>
      <p className="text-[10px] leading-4 text-muted-foreground lg:text-[11px] lg:leading-4">
        <Search className="mr-1 inline size-3" />
        {t("inventory2b4.quick.catalog.guide")}
      </p>

      <div className="grid min-w-0 grid-cols-2 gap-2">
        {category !== "other" ? (
          <SpecificationField
            id={`${idPrefix}-storage`}
            label={
              category === "computer"
                ? t("inventory2b4.quick.catalog.diskStorage")
                : t("inventory2b4.quick.catalog.storage")
            }
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
            label={t("inventory2b4.quick.catalog.ram")}
            value={ramCapacity}
            options={ramOptions}
            placeholder={t("inventory2b4.quick.catalog.ramExample")}
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
          statusMessage={localizeInventoryColorPolicy(colorPolicy.state, t)}
          invalid={colorInvalid || !colorPolicy.save.canSave}
          errorMessage={
            !colorPolicy.save.canSave
              ? colorPolicy.save.blockedReason === "color-required"
                ? t("inventory2b4.validation.colorRequired")
                : t("inventory2b4.validation.colorNotApproved")
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
          {t("inventory2b4.quick.catalog.manualModel", { model })}
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
  const { t } = useLocale();
  const selectableOptions = options.map((option) => ({ value: option, label: option }));
  const isManualValue = Boolean(value) && !options.includes(value);
  return (
    <fieldset className={cn("min-w-0 space-y-1.5", className)}>
      <InventorySelectableField
        id={id}
        label={label}
        value={value}
        placeholder={t("inventory2b4.quick.catalog.selectValue", { label })}
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
        placeholder={
          options.length
            ? t("inventory2b4.quick.catalog.manualPlaceholder", { placeholder })
            : placeholder
        }
        aria-label={t("inventory2b4.quick.catalog.manualAria", { label })}
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
  const { t } = useLocale();
  const isPending = policyState === "pending-official-color";
  const isManualValue = Boolean(value) && !options.some((option) => option.value === value);
  const preservedValue = existingColor?.trim();
  const displayValue = isPending ? (preservedValue ?? "") : value;
  return (
    <fieldset className={cn("col-span-2 min-w-0 space-y-1.5", className)}>
      <InventorySelectableField
        id={id}
        label={t("inventory2b4.quick.catalog.color")}
        value={displayValue}
        placeholder={t("inventory2b4.quick.catalog.selectColor")}
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
            aria-label={t("inventory2b4.quick.catalog.colorReadonlyAria")}
          />
        ) : null
      ) : policyState === "generic" ? (
        <Input
          id={`${id}-manual`}
          className="h-11 min-h-11 min-w-0 text-base !text-base lg:h-9 lg:min-h-0 lg:!text-sm"
          value={isManualValue ? value : ""}
          disabled={disabled}
          onChange={(event) => onChange(event.target.value)}
          placeholder={t("inventory2b4.quick.catalog.colorManualPlaceholder")}
          aria-label={t("inventory2b4.quick.catalog.colorManualAria")}
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

function brandMonogram(name: string, fallback: string) {
  return (
    name
      .replace(/[^A-Za-z0-9]/g, "")
      .slice(0, 2)
      .toUpperCase() || fallback
  );
}

function modelMonogram(model: DeviceCatalogModel, fallback: string) {
  return (
    model.series
      .replace(/[^A-Za-z0-9]/g, "")
      .slice(0, 2)
      .toUpperCase() || fallback
  );
}
