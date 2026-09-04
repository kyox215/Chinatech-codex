"use client";

import { useEffect, useState } from "react";
import type { ComponentType, HTMLAttributes, KeyboardEvent, ReactNode } from "react";

import {
  BatteryMedium,
  Gamepad2,
  Laptop,
  Minus,
  PackageOpen,
  Plus,
  ScanFace,
  Smartphone,
  Tablet,
} from "lucide-react";

import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { InventoryDeviceCatalogFields } from "./inventory-device-catalog-fields";
import { InventorySelectableField } from "./inventory-selectable-field";
import type {
  CatalogPickerMode,
  CatalogPickerSurface,
} from "@/features/inventory/components/inventory-phone-catalog-fields";
import {
  resolveDeviceInspectionCapabilities,
  type DeviceInspectionCapabilities,
} from "../model/device-catalog";
import type { InventoryProductFormDraft } from "../model/inventory-product-form";
import type {
  InventoryCatalogOption,
  InventoryProductCategory,
  InventoryProductFaceIdStatus,
  InventoryProductIdentifierKind,
  InventoryProductIdentifierSource,
} from "@/lib/repairdesk/types";
import { repairOs } from "@/lib/ui-patterns";
import { cn } from "@/lib/utils";
import { useLocale } from "@/shared/i18n/locale-provider";
import { identifierLabels, inventoryProductIdentifierKinds } from "../model/device-data";
import { listDeviceConditionOptions } from "../model/device-form-options";
import type { AppleColorApprovalOverlay } from "../model/device-color-policy";
import {
  localizeInventoryCondition,
  localizeInventoryIdentifierKind,
  localizeInventoryInspection,
  localizeInventoryProductCategory,
  localizeInventorySpecificationLabel,
} from "../model/inventory-product-i18n";

export type InventoryProductFormCategory = {
  value: InventoryProductCategory;
  label: string;
  icon?: ComponentType<{ className?: string }>;
};

export type InventoryProductIdentifierFieldProps = {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  density?: "default" | "compact";
  showPaste?: boolean;
  showScanner?: boolean;
  inputId?: string;
  inputAriaLabel?: string;
  identifierLabel?: string;
  inputMode?: React.HTMLAttributes<HTMLInputElement>["inputMode"];
  ariaInvalid?: boolean;
  ariaDescribedBy?: string;
  ariaRequired?: boolean;
  onCommitSource?: (source: "manual" | "scan") => void;
};

export type InventoryProductIdentifierFieldComponent =
  ComponentType<InventoryProductIdentifierFieldProps>;

/** One category contract for both the create and edit adapters. */
export const inventoryProductFormCategories = [
  { value: "phone", label: "手机", icon: Smartphone },
  { value: "tablet", label: "平板", icon: Tablet },
  { value: "computer", label: "电脑", icon: Laptop },
  { value: "game_console", label: "游戏机", icon: Gamepad2 },
  { value: "other", label: "其他", icon: PackageOpen },
] satisfies readonly InventoryProductFormCategory[];

export type InventoryProductFormProps = {
  draft: InventoryProductFormDraft;
  categories: readonly InventoryProductFormCategory[];
  idPrefix?: string;
  surface?: CatalogPickerSurface;
  pickerMode?: CatalogPickerMode;
  categoryDisabled?: boolean;
  catalogDisabled?: boolean;
  autoFocusBrand?: boolean;
  brandInvalid?: boolean;
  modelInvalid?: boolean;
  learnedCatalogOptions?: readonly InventoryCatalogOption[];
  existingColor?: string;
  approvedAppleColorOverlay?: AppleColorApprovalOverlay;
  colorRequired?: boolean;
  colorInvalid?: boolean;
  inspectionBatteryInvalid?: boolean;
  categoryNotice?: ReactNode;
  catalogNotice?: ReactNode;
  inspectionEnabled?: boolean;
  children?: ReactNode;
  onCategoryChange: (category: InventoryProductCategory) => void;
  onCategoryKeyDown?: (event: KeyboardEvent<HTMLButtonElement>, index: number) => void;
  onBrandChange: (value: string) => void;
  onModelChange: (value: string) => void;
  onRamChange: (value: string) => void;
  onStorageChange: (value: string) => void;
  onColorChange: (value: string) => void;
  onInspectionBatteryHealthChange?: (value: string) => void;
  onInspectionFaceIdStatusChange?: (value: InventoryProductFaceIdStatus) => void;
};

/**
 * Shared controlled category/catalog form surface.
 *
 * Create and edit keep their own shells, dirty/pending rules, side effects and
 * submit adapters; this component owns the identical controlled controls and
 * stable product-* selector contract.
 */
export function InventoryProductForm({
  draft,
  categories,
  idPrefix = "product",
  surface = "page",
  pickerMode = "auto",
  categoryDisabled = false,
  catalogDisabled = false,
  autoFocusBrand = false,
  brandInvalid = false,
  modelInvalid = false,
  learnedCatalogOptions = [],
  existingColor,
  approvedAppleColorOverlay,
  colorRequired = false,
  colorInvalid = false,
  inspectionBatteryInvalid = false,
  categoryNotice,
  catalogNotice,
  inspectionEnabled = false,
  children,
  onCategoryChange,
  onCategoryKeyDown,
  onBrandChange,
  onModelChange,
  onRamChange,
  onStorageChange,
  onColorChange,
  onInspectionBatteryHealthChange,
  onInspectionFaceIdStatusChange,
}: InventoryProductFormProps) {
  const { t } = useLocale();
  const resolvedInspectionCapabilities = inspectionEnabled
    ? resolveDeviceInspectionCapabilities(draft.category, draft.brand, draft.model)
    : undefined;
  const inspectionCapabilities: DeviceInspectionCapabilities | undefined =
    resolvedInspectionCapabilities &&
    (resolvedInspectionCapabilities.battery_health || resolvedInspectionCapabilities.face_id_status)
      ? resolvedInspectionCapabilities
      : undefined;
  const showFaceId = Boolean(
    inspectionCapabilities?.face_id_status || draft.inspection_face_id_status === "not_applicable",
  );
  return (
    <section className={cn(repairOs.mobileInfoCard, "space-y-2 p-2.5 md:p-4")}>
      <fieldset>
        <legend className="mb-1.5 text-xs font-semibold">
          {t("inventory2b4.quick.form.category")}{" "}
          <span className="text-status-danger-foreground">*</span>
        </legend>
        <div
          className="grid grid-cols-5 gap-1.5"
          role="radiogroup"
          aria-label={t("inventory2b4.quick.form.categoryAria")}
        >
          {categories.map(({ value, label, icon: Icon }, index) => (
            <button
              id={`${idPrefix}-category-${value}`}
              key={value}
              type="button"
              role="radio"
              aria-checked={draft.category === value}
              tabIndex={draft.category === value ? 0 : -1}
              disabled={categoryDisabled}
              className={cn(
                "flex min-h-11 min-w-0 flex-col items-center justify-center gap-0.5 rounded-lg border px-1 text-[10px] font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring lg:text-xs lg:leading-4",
                draft.category === value
                  ? "border-primary bg-primary text-primary-foreground"
                  : "border-border bg-card",
              )}
              onClick={() => onCategoryChange(value)}
              onKeyDown={onCategoryKeyDown ? (event) => onCategoryKeyDown(event, index) : undefined}
            >
              {Icon ? <Icon className="size-3.5" aria-hidden="true" /> : null}
              {localizeInventoryProductCategory(value, label, t)}
            </button>
          ))}
        </div>
        {categoryNotice}
      </fieldset>

      <InventoryDeviceCatalogFields
        idPrefix={idPrefix}
        category={draft.category}
        brand={draft.brand}
        model={draft.model}
        ramCapacity={draft.ram_capacity}
        storageCapacity={draft.storage_capacity}
        color={draft.color}
        existingColor={existingColor}
        approvedAppleColorOverlay={approvedAppleColorOverlay}
        colorRequired={colorRequired}
        colorInvalid={colorInvalid}
        surface={surface}
        disabled={catalogDisabled}
        autoFocusBrand={autoFocusBrand}
        brandInvalid={brandInvalid}
        modelInvalid={modelInvalid}
        learnedCatalogOptions={learnedCatalogOptions}
        pickerMode={pickerMode}
        onBrandChange={onBrandChange}
        onModelChange={onModelChange}
        onRamChange={onRamChange}
        onStorageChange={onStorageChange}
        onColorChange={onColorChange}
      />
      {catalogNotice}
      {inspectionCapabilities ? (
        <section
          data-ui="inventory-product-inspection"
          className="grid min-w-0 gap-2 rounded-lg border border-border/80 bg-background/50 p-2.5"
        >
          <div className="flex items-center gap-1.5">
            <BatteryMedium className="size-4 text-primary" aria-hidden="true" />
            <h2 className="text-xs font-semibold">{t("inventory2b4.quick.form.inspection")}</h2>
            <span className="text-[10px] text-muted-foreground">
              {t("inventory2b4.quick.form.inspectionHint")}
            </span>
          </div>
          <div className="grid min-w-0 gap-2 sm:grid-cols-2">
            {inspectionCapabilities.battery_health ? (
              <div className="min-w-0 space-y-1">
                <label htmlFor={`${idPrefix}-battery-health`} className="text-[11px] font-medium">
                  {t("inventory2b4.quick.form.batteryHealth")}
                </label>
                <input
                  id={`${idPrefix}-battery-health`}
                  type="text"
                  inputMode="numeric"
                  pattern="[0-9]*"
                  value={draft.inspection_battery_health}
                  placeholder={t("inventory2b4.quick.form.batteryExample")}
                  maxLength={3}
                  aria-invalid={inspectionBatteryInvalid || undefined}
                  aria-describedby={
                    inspectionBatteryInvalid ? `${idPrefix}-battery-health-error` : undefined
                  }
                  className={cn(
                    "h-11 w-full min-w-0 rounded-lg border border-input bg-background px-3 text-base !text-base outline-none transition focus-visible:ring-2 focus-visible:ring-ring lg:h-9 lg:!text-sm",
                    inspectionBatteryInvalid && "border-destructive focus-visible:ring-destructive",
                  )}
                  onChange={(event) => onInspectionBatteryHealthChange?.(event.target.value)}
                />
                {inspectionBatteryInvalid ? (
                  <p
                    id={`${idPrefix}-battery-health-error`}
                    className="text-xs text-status-danger-foreground"
                  >
                    {t("inventory2b4.quick.validation.batteryInvalid")}
                  </p>
                ) : null}
              </div>
            ) : null}
            {showFaceId ? (
              <div className="min-w-0 space-y-1">
                <div className="flex items-center gap-1.5 text-[11px] font-medium">
                  <ScanFace className="size-3.5 text-primary" aria-hidden="true" />
                  Face ID
                </div>
                {inspectionCapabilities.face_id_status ? (
                  <InventorySelectableField
                    id={`${idPrefix}-face-id-status`}
                    label={t("inventory2b4.quick.form.faceIdStatus")}
                    value={draft.inspection_face_id_status}
                    options={faceIdStatusOptions.map((option) => ({
                      ...option,
                      label: localizeInventoryInspection(option.value, option.label, t),
                    }))}
                    mode={pickerMode}
                    onChange={(value) =>
                      onInspectionFaceIdStatusChange?.(value as InventoryProductFaceIdStatus)
                    }
                  />
                ) : (
                  <div className="flex min-h-10 items-center rounded-lg border border-border bg-muted/30 px-3 text-xs text-muted-foreground">
                    {t("inventory2b4.inspection.notApplicable")}
                  </div>
                )}
              </div>
            ) : null}
          </div>
          <p className="text-[10px] leading-4 text-muted-foreground">
            {t("inventory2b4.quick.form.inspectionScope")}
          </p>
        </section>
      ) : null}
      {children}
    </section>
  );
}

export type InventoryProductFormDetailsProps = {
  draft: InventoryProductFormDraft;
  idPrefix?: string;
  canEnterCost?: boolean;
  conditionInvalid?: boolean;
  gtinInvalid?: boolean;
  listPriceInvalid?: boolean;
  costInvalid?: boolean;
  warrantyInvalid?: boolean;
  identifierSection: ReactNode;
  layoutMode?: "compact" | "desktop";
  onConditionChange: (value: string) => void;
  onGtinChange: (value: string) => void;
  onSpecificationChange: (key: string, value: string) => void;
  onListPriceChange: (value: string) => void;
  onCostChange: (value: string) => void;
  onLocationChange: (value: string) => void;
  onWarrantyChange: (value: string) => void;
  onNotesChange: (value: string) => void;
};

export function InventoryProductIdentifierSection({
  draft,
  idPrefix = "product",
  description,
  showScanner = true,
  IdentifierField = InventoryProductLocalIdentifierField,
  allowPrimarySelection = false,
  layoutMode = "compact",
  invalidKinds,
  requiredKinds,
  onIdentifierChange,
  onIdentifierSource,
  onPrimaryIdentifierChange,
}: {
  draft: Pick<
    InventoryProductFormDraft,
    "identifiers" | "identifier_sources" | "primary_identifier_kind"
  >;
  idPrefix?: string;
  description: string;
  showScanner?: boolean;
  IdentifierField?: InventoryProductIdentifierFieldComponent;
  allowPrimarySelection?: boolean;
  layoutMode?: "compact" | "desktop";
  invalidKinds?: Partial<Record<InventoryProductIdentifierKind, boolean>>;
  requiredKinds?: Partial<Record<InventoryProductIdentifierKind, boolean>>;
  onIdentifierChange: (kind: InventoryProductIdentifierKind, value: string) => void;
  onIdentifierSource: (
    kind: InventoryProductIdentifierKind,
    source: Extract<InventoryProductIdentifierSource, "manual" | "scan">,
  ) => void;
  onPrimaryIdentifierChange?: (kind: InventoryProductIdentifierKind) => void;
}) {
  const { t } = useLocale();
  return (
    <section
      data-ui="inventory-product-form-identifiers"
      className={cn(repairOs.mobileInfoCard, "space-y-2 p-2.5 md:p-4")}
    >
      <div>
        <h2 className="text-sm font-semibold">{t("inventory2b4.quick.form.identifiers")}</h2>
        <p className="mt-0.5 text-[10px] leading-4 text-muted-foreground lg:text-xs lg:leading-4">
          {description}
        </p>
      </div>
      <div
        className={cn(
          "grid min-w-0 gap-2",
          layoutMode === "desktop" ? "lg:grid-cols-2" : "min-[390px]:grid-cols-2",
        )}
      >
        {inventoryProductIdentifierKinds.map((kind) => {
          const id = `${idPrefix}-${kind}`;
          const label = localizeInventoryIdentifierKind(kind, identifierLabels[kind], t);
          const invalid = invalidKinds?.[kind] === true;
          const required = requiredKinds?.[kind] === true;
          return (
            <div key={kind} className="min-w-0 space-y-1.5">
              <div className="flex min-h-5 items-center justify-between gap-2">
                <label htmlFor={id} className="text-xs font-medium">
                  {label}
                  {required ? (
                    <span className="ml-0.5 text-status-danger-foreground">*</span>
                  ) : null}
                </label>
                {kind === "eid" ? (
                  <span className="text-[10px] text-muted-foreground">
                    {t("inventory2b4.quick.form.eidNotPrimary")}
                  </span>
                ) : allowPrimarySelection ? (
                  <button
                    type="button"
                    className={cn(
                      "inline-flex min-h-11 min-w-11 items-center justify-center rounded-md px-2 text-[10px] font-medium",
                      draft.primary_identifier_kind === kind
                        ? "bg-primary text-primary-foreground"
                        : "text-muted-foreground hover:bg-muted",
                    )}
                    aria-pressed={draft.primary_identifier_kind === kind}
                    onClick={() => onPrimaryIdentifierChange?.(kind)}
                  >
                    {draft.primary_identifier_kind === kind
                      ? t("inventory2b4.quick.form.primaryIdentifier")
                      : t("inventory2b4.quick.form.setPrimary")}
                  </button>
                ) : (
                  <span className="text-[10px] text-muted-foreground">
                    {t("inventory2b4.quick.form.autoPrimary")}
                  </span>
                )}
              </div>
              <IdentifierField
                inputId={id}
                inputAriaLabel={label}
                identifierLabel={label}
                inputMode={kind === "serial" ? "text" : "numeric"}
                ariaInvalid={invalid}
                ariaDescribedBy={invalid ? `${id}-error` : undefined}
                ariaRequired={required}
                value={draft.identifiers[kind]}
                onChange={(value) => onIdentifierChange(kind, value)}
                onCommitSource={(source) => onIdentifierSource(kind, source)}
                placeholder={t("inventory2b4.quick.form.identifierPlaceholder", { label })}
                density="compact"
                showScanner={showScanner}
              />
              {invalid ? (
                <p id={`${id}-error`} className="text-xs text-status-danger-foreground">
                  {t("inventory2b4.quick.form.checkIdentifier", { label })}
                </p>
              ) : null}
            </div>
          );
        })}
      </div>
    </section>
  );
}

/**
 * Story-safe identifier presenter. It deliberately has no camera, file,
 * clipboard, storage, or network capability; production screens inject the
 * real scanner adapter explicitly.
 */
export function InventoryProductLocalIdentifierField({
  value,
  onChange,
  placeholder,
  inputId,
  inputAriaLabel,
  inputMode,
  ariaInvalid,
  ariaDescribedBy,
  ariaRequired,
  onCommitSource,
}: InventoryProductIdentifierFieldProps) {
  return (
    <Input
      id={inputId}
      aria-label={inputAriaLabel}
      inputMode={inputMode}
      aria-invalid={ariaInvalid || undefined}
      aria-describedby={ariaDescribedBy}
      aria-required={ariaRequired || undefined}
      className="h-11 min-h-11 text-base !text-base lg:h-9 lg:!text-sm"
      value={value}
      placeholder={placeholder}
      onChange={(event) => {
        onChange(event.target.value);
        onCommitSource?.("manual");
      }}
    />
  );
}

/**
 * The detail sections after the shared category/catalog/inspection surface.
 * Create and edit both provide the shared identifier section so the field
 * order, controls and responsive widths cannot drift by mode.
 */
export function InventoryProductFormDetails({
  draft,
  idPrefix = "product",
  canEnterCost = false,
  conditionInvalid = false,
  gtinInvalid = false,
  listPriceInvalid = false,
  costInvalid = false,
  warrantyInvalid = false,
  identifierSection,
  layoutMode = "compact",
  onConditionChange,
  onGtinChange,
  onSpecificationChange,
  onListPriceChange,
  onCostChange,
  onLocationChange,
  onWarrantyChange,
  onNotesChange,
}: InventoryProductFormDetailsProps) {
  const { t } = useLocale();
  const [detailsOpen, setDetailsOpen] = useState(layoutMode === "desktop");
  useEffect(() => {
    setDetailsOpen(layoutMode === "desktop");
  }, [layoutMode]);
  const specFields = detailsSpecificationFields(draft.category, t);
  const disclosureSpecFields = specFields.filter((field) => specificationPresets[field.key]);
  const secondarySpecFields = specFields.filter((field) => !specificationPresets[field.key]);
  return (
    <section data-ui="inventory-product-form-details" className="grid gap-1.5">
      <section
        data-ui="inventory-product-form-primary-details"
        className={cn(repairOs.mobileInfoCard, "grid min-w-0 gap-2 p-2.5 md:p-4")}
      >
        <ConditionField
          id={`${idPrefix}-condition`}
          value={draft.condition}
          invalid={conditionInvalid}
          mode={layoutMode === "desktop" ? "desktop" : "mobile"}
          onChange={onConditionChange}
        />
        {identifierSection}
        <section
          data-ui="inventory-product-form-commercial"
          data-inventory-product-form-primary-commercial="true"
          className={cn(repairOs.mobileInfoCard, "grid min-w-0 grid-cols-2 gap-2 p-2.5 md:p-4")}
        >
          <ProductDetailField
            id={`${idPrefix}-price`}
            label={t("inventory2b4.quick.form.plannedSale")}
            value={draft.list_price}
            placeholder={t("inventory2b4.quick.form.notEntered")}
            inputMode="decimal"
            invalid={listPriceInvalid}
            onChange={onListPriceChange}
          />
          {canEnterCost ? (
            <ProductDetailField
              id={`${idPrefix}-cost`}
              label={t("inventory2b4.quick.form.acquisitionCost")}
              value={draft.cost_amount}
              placeholder={t("inventory2b4.quick.form.notEntered")}
              inputMode="decimal"
              invalid={costInvalid}
              onChange={onCostChange}
            />
          ) : null}
        </section>
        <section
          data-ui="inventory-product-form-disclosure-fields"
          className={cn(repairOs.mobileInfoCard, "grid min-w-0 grid-cols-2 gap-2 p-2.5 md:p-4")}
        >
          {disclosureSpecFields.map((field) => (
            <PresetWithManualField
              key={field.key}
              id={`${idPrefix}-spec-${field.key}`}
              label={localizeInventorySpecificationLabel(field.key, field.label, t)}
              value={draft.specifications[field.key] ?? ""}
              placeholder={field.placeholder}
              options={specificationPresets[field.key] ?? []}
              mode={layoutMode === "desktop" ? "desktop" : "mobile"}
              onChange={(value) => onSpecificationChange(field.key, value)}
            />
          ))}
          <PresetWithManualField
            id={`${idPrefix}-warranty`}
            label={t("inventory2b4.quick.form.warrantyMonths")}
            value={draft.warranty_months}
            placeholder={t("inventory2b4.quick.form.notEntered")}
            options={warrantyPresets.map((value) => ({
              value,
              label:
                value === "0"
                  ? t("inventory2b4.quick.form.noWarranty")
                  : t("inventory2b4.quick.form.warrantyValue", { months: value }),
            }))}
            mode={layoutMode === "desktop" ? "desktop" : "mobile"}
            inputMode="numeric"
            invalid={warrantyInvalid}
            onChange={onWarrantyChange}
          />
        </section>
      </section>
      <button
        type="button"
        className={cn(
          repairOs.mobileInfoCard,
          "flex min-h-11 items-center justify-between gap-2 px-2.5 py-2 text-left md:px-4",
        )}
        aria-expanded={detailsOpen}
        aria-controls={`${idPrefix}-details-content`}
        onClick={() => setDetailsOpen((open) => !open)}
      >
        <span>
          <span className="block text-sm font-semibold">
            {t("inventory2b4.quick.form.moreInformation")}
          </span>
          <span className="block text-[10px] leading-4 text-muted-foreground">
            {t("inventory2b4.quick.form.moreInformationHint")}
          </span>
        </span>
        {detailsOpen ? (
          <Minus aria-hidden="true" className="size-4 shrink-0 text-muted-foreground" />
        ) : (
          <Plus aria-hidden="true" className="size-4 shrink-0 text-muted-foreground" />
        )}
      </button>

      {detailsOpen ? (
        <div id={`${idPrefix}-details-content`} className="grid gap-1.5">
          <section
            data-ui="inventory-product-form-specifications"
            className={cn(repairOs.mobileInfoCard, "grid min-w-0 grid-cols-2 gap-2 p-2.5 md:p-4")}
          >
            <ProductDetailField
              id={`${idPrefix}-gtin`}
              label={t("inventory2b4.quick.form.gtin")}
              value={draft.gtin}
              placeholder={t("inventory2b4.quick.form.gtinPlaceholder")}
              inputMode="numeric"
              invalid={gtinInvalid}
              onChange={onGtinChange}
            />
            {secondarySpecFields.map((field) => (
              <ProductDetailField
                key={field.key}
                id={`${idPrefix}-spec-${field.key}`}
                label={localizeInventorySpecificationLabel(field.key, field.label, t)}
                value={draft.specifications[field.key] ?? ""}
                placeholder={field.placeholder}
                onChange={(value) => onSpecificationChange(field.key, value)}
              />
            ))}
          </section>

          <section
            data-ui="inventory-product-form-commercial"
            className={cn(repairOs.mobileInfoCard, "grid min-w-0 grid-cols-2 gap-2 p-2.5 md:p-4")}
          >
            <ProductDetailField
              id={`${idPrefix}-location`}
              label={t("inventory2b4.quick.form.location")}
              value={draft.location}
              placeholder={t("inventory2b4.quick.form.locationExample")}
              onChange={onLocationChange}
            />
            <div className="col-span-2 min-w-0 space-y-1">
              <Label htmlFor={`${idPrefix}-notes`} className="text-xs">
                {t("inventory2b4.quick.form.internalNotes")}
              </Label>
              <Textarea
                id={`${idPrefix}-notes`}
                className="min-h-20 resize-y text-base !text-base lg:!text-sm"
                maxLength={2000}
                value={draft.notes}
                placeholder={t("inventory2b4.quick.form.optional")}
                onChange={(event) => onNotesChange(event.target.value)}
              />
            </div>
          </section>
        </div>
      ) : null}
    </section>
  );
}

const specificationPresets: Record<
  string,
  readonly { value: string; label: string }[] | undefined
> = {
  network_variant: ["EU", "Global", "US", "CN", "JP"].map((value) => ({ value, label: value })),
  connectivity: ["Wi-Fi", "Wi-Fi + Cellular"].map((value) => ({ value, label: value })),
  edition: ["Standard", "Slim", "Digital", "OLED", "Pro"].map((value) => ({
    value,
    label: value,
  })),
  region: ["EU", "US", "JP", "CN"].map((value) => ({ value, label: value })),
  disk_type: ["SSD", "HDD", "NVMe"].map((value) => ({ value, label: value })),
};

const warrantyPresets = ["0", "3", "6", "12", "24"] as const;

function PresetWithManualField({
  id,
  label,
  value,
  options,
  mode,
  onChange,
  placeholder,
  inputMode,
  invalid,
}: {
  id: string;
  label: string;
  value: string;
  options: readonly { value: string; label: string }[];
  mode: "desktop" | "mobile";
  onChange: (value: string) => void;
  placeholder?: string;
  inputMode?: HTMLAttributes<HTMLInputElement>["inputMode"];
  invalid?: boolean;
}) {
  const { t } = useLocale();
  return (
    <fieldset className="min-w-0 space-y-1.5">
      <InventorySelectableField
        id={`${id}-preset`}
        label={t("inventory2b4.quick.form.presets", { label })}
        value={options.some((option) => option.value === value) ? value : ""}
        placeholder={t("inventory2b4.quick.form.choosePreset")}
        options={options}
        mode={mode}
        onChange={onChange}
      />
      <ProductDetailField
        id={id}
        label={label}
        value={value}
        placeholder={placeholder}
        inputMode={inputMode}
        invalid={invalid}
        onChange={onChange}
      />
    </fieldset>
  );
}

function ProductDetailField({
  id,
  label,
  value,
  onChange,
  placeholder,
  inputMode,
  invalid,
}: {
  id: string;
  label: string;
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  inputMode?: HTMLAttributes<HTMLInputElement>["inputMode"];
  invalid?: boolean;
}) {
  const { t } = useLocale();
  const errorId = `${id}-error`;
  return (
    <div className="min-w-0 space-y-1">
      <Label htmlFor={id} className="text-xs">
        {label}
      </Label>
      <Input
        id={id}
        className="h-11 min-h-11 min-w-0 text-base !text-base lg:h-9 lg:min-h-0 lg:!text-sm"
        value={value}
        placeholder={placeholder}
        inputMode={inputMode}
        aria-invalid={invalid}
        aria-describedby={invalid ? errorId : undefined}
        onChange={(event) => onChange(event.target.value)}
      />
      {invalid ? (
        <p id={errorId} className="text-xs text-status-danger-foreground">
          {t("inventory2b4.quick.form.checkField")}
        </p>
      ) : null}
    </div>
  );
}

function ConditionField({
  id,
  value,
  onChange,
  invalid,
  mode,
}: {
  id: string;
  value: string;
  onChange: (value: string) => void;
  invalid?: boolean;
  mode: "desktop" | "mobile";
}) {
  const { t } = useLocale();
  const options = listDeviceConditionOptions().map((option) => ({
    ...option,
    label: localizeInventoryCondition(option.value, option.label, t),
  }));
  const isManualValue = Boolean(value) && !options.some((option) => option.value === value);
  const errorId = `${id}-error`;
  return (
    <div className="min-w-0 space-y-1">
      <InventorySelectableField
        id={`${id}-preset`}
        label={t("inventory2b4.quick.form.condition")}
        value={value}
        placeholder={t("inventory2b4.quick.form.selectCondition")}
        options={options}
        mode={mode}
        invalid={invalid}
        ariaDescribedBy={invalid ? errorId : undefined}
        onChange={onChange}
      />
      <Input
        id={id}
        className="h-11 min-h-11 min-w-0 text-base !text-base lg:h-9 lg:min-h-0 lg:!text-sm"
        value={isManualValue ? value : ""}
        placeholder={t("inventory2b4.quick.form.conditionExample")}
        aria-invalid={invalid}
        aria-describedby={invalid ? errorId : undefined}
        onChange={(event) => onChange(event.target.value)}
      />
      {invalid ? (
        <p id={errorId} className="text-xs text-status-danger-foreground">
          {t("inventory2b4.quick.form.checkField")}
        </p>
      ) : null}
    </div>
  );
}

function detailsSpecificationFields(
  category: InventoryProductCategory,
  t: ReturnType<typeof useLocale>["t"],
) {
  if (category === "computer") {
    return [
      {
        key: "processor",
        label: "处理器",
        placeholder: t("inventory2b4.quick.form.processorExample"),
      },
      {
        key: "disk_type",
        label: "硬盘类型",
        placeholder: t("inventory2b4.quick.form.diskTypeExample"),
      },
      { key: "graphics", label: "显卡", placeholder: t("inventory2b4.quick.form.graphicsExample") },
    ];
  }
  if (category === "game_console") {
    return [
      { key: "edition", label: "版本", placeholder: t("inventory2b4.quick.form.editionExample") },
      { key: "region", label: "区域", placeholder: t("inventory2b4.quick.form.regionExample") },
      {
        key: "included_controller_count",
        label: "手柄数",
        placeholder: t("inventory2b4.quick.form.controllerExample"),
      },
    ];
  }
  if (category === "phone")
    return [
      {
        key: "network_variant",
        label: "网络版本",
        placeholder: t("inventory2b4.quick.form.networkExample"),
      },
    ];
  if (category === "tablet") {
    return [
      {
        key: "connectivity",
        label: "联网版本",
        placeholder: t("inventory2b4.quick.form.connectivityExample"),
      },
      {
        key: "screen_size_inches",
        label: "屏幕尺寸",
        placeholder: t("inventory2b4.quick.form.screenExample"),
      },
    ];
  }
  return [
    {
      key: "short_specification",
      label: "简短规格",
      placeholder: t("inventory2b4.quick.form.optional"),
    },
  ];
}

const faceIdStatusOptions: Array<{ value: InventoryProductFaceIdStatus; label: string }> = [
  { value: "not_tested", label: "未检测" },
  { value: "normal", label: "正常" },
  { value: "abnormal", label: "异常" },
  { value: "not_applicable", label: "不适用" },
];
