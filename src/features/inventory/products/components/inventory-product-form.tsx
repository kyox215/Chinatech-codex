"use client";

import { useState } from "react";
import type { ComponentType, HTMLAttributes, KeyboardEvent, ReactNode } from "react";

import {
  BatteryMedium,
  Gamepad2,
  Laptop,
  PackageOpen,
  ScanFace,
  Smartphone,
  Tablet,
} from "lucide-react";

import { ImeiScannerField } from "@/components/imei-scanner-field";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { InventoryDeviceCatalogFields } from "./inventory-device-catalog-fields";
import type { CatalogPickerSurface } from "@/features/inventory/components/inventory-phone-catalog-fields";
import {
  resolveDeviceInspectionCapabilities,
  type DeviceInspectionCapabilities,
} from "../model/device-catalog";
import type { InventoryProductFormDraft } from "../model/inventory-product-form";
import type {
  InventoryProductCategory,
  InventoryProductFaceIdStatus,
  InventoryProductIdentifierKind,
  InventoryProductIdentifierSource,
} from "@/lib/repairdesk/types";
import { repairOs } from "@/lib/ui-patterns";
import { cn } from "@/lib/utils";
import { identifierLabels, inventoryProductIdentifierKinds } from "../model/device-data";

export type InventoryProductFormCategory = {
  value: InventoryProductCategory;
  label: string;
  icon?: ComponentType<{ className?: string }>;
};

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
  categoryDisabled?: boolean;
  catalogDisabled?: boolean;
  autoFocusBrand?: boolean;
  brandInvalid?: boolean;
  modelInvalid?: boolean;
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
  categoryDisabled = false,
  catalogDisabled = false,
  autoFocusBrand = false,
  brandInvalid = false,
  modelInvalid = false,
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
          类别 <span className="text-destructive">*</span>
        </legend>
        <div className="grid grid-cols-5 gap-1.5" role="radiogroup" aria-label="商品类别">
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
                  ? "border-primary bg-primary/10 text-primary"
                  : "border-border bg-card",
              )}
              onClick={() => onCategoryChange(value)}
              onKeyDown={onCategoryKeyDown ? (event) => onCategoryKeyDown(event, index) : undefined}
            >
              {Icon ? <Icon className="size-3.5" aria-hidden="true" /> : null}
              {label}
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
        surface={surface}
        disabled={catalogDisabled}
        autoFocusBrand={autoFocusBrand}
        brandInvalid={brandInvalid}
        modelInvalid={modelInvalid}
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
            <h2 className="text-xs font-semibold">设备检测</h2>
            <span className="text-[10px] text-muted-foreground">可选，保存后保留检测记录</span>
          </div>
          <div className="grid min-w-0 gap-2 sm:grid-cols-2">
            {inspectionCapabilities.battery_health ? (
              <div className="min-w-0 space-y-1">
                <label htmlFor={`${idPrefix}-battery-health`} className="text-[11px] font-medium">
                  电池健康度（%）
                </label>
                <input
                  id={`${idPrefix}-battery-health`}
                  type="text"
                  inputMode="numeric"
                  pattern="[0-9]*"
                  value={draft.inspection_battery_health}
                  placeholder="例如 91"
                  maxLength={3}
                  aria-invalid={inspectionBatteryInvalid || undefined}
                  aria-describedby={
                    inspectionBatteryInvalid ? `${idPrefix}-battery-health-error` : undefined
                  }
                  className={cn(
                    "h-11 w-full min-w-0 rounded-lg border border-input bg-background px-3 text-base outline-none transition focus-visible:ring-2 focus-visible:ring-ring lg:h-9 lg:text-sm",
                    inspectionBatteryInvalid && "border-destructive focus-visible:ring-destructive",
                  )}
                  onChange={(event) => onInspectionBatteryHealthChange?.(event.target.value)}
                />
                {inspectionBatteryInvalid ? (
                  <p id={`${idPrefix}-battery-health-error`} className="text-xs text-destructive">
                    电池健康度必须是 0 到 100 的整数或空值
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
                  <div
                    className="grid grid-cols-2 gap-1"
                    role="group"
                    aria-label="Face ID 检测状态"
                  >
                    {faceIdStatusOptions.map((option) => (
                      <button
                        key={option.value}
                        type="button"
                        className={cn(
                          "min-h-11 rounded-lg border px-2 text-[11px] font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                          draft.inspection_face_id_status === option.value
                            ? "border-primary bg-primary/10 text-primary"
                            : "border-border bg-card text-muted-foreground",
                        )}
                        aria-pressed={draft.inspection_face_id_status === option.value}
                        onClick={() => onInspectionFaceIdStatusChange?.(option.value)}
                      >
                        {option.label}
                      </button>
                    ))}
                  </div>
                ) : (
                  <div className="flex min-h-10 items-center rounded-lg border border-border bg-muted/30 px-3 text-xs text-muted-foreground">
                    不适用
                  </div>
                )}
              </div>
            ) : null}
          </div>
          <p className="text-[10px] leading-4 text-muted-foreground">
            只显示目录中明确支持的项目；未收录或手动型号不会自动推断检测能力。
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
  allowPrimarySelection = false,
  invalidKinds,
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
  allowPrimarySelection?: boolean;
  invalidKinds?: Partial<Record<InventoryProductIdentifierKind, boolean>>;
  onIdentifierChange: (kind: InventoryProductIdentifierKind, value: string) => void;
  onIdentifierSource: (
    kind: InventoryProductIdentifierKind,
    source: Extract<InventoryProductIdentifierSource, "manual" | "scan">,
  ) => void;
  onPrimaryIdentifierChange?: (kind: InventoryProductIdentifierKind) => void;
}) {
  return (
    <section
      data-ui="inventory-product-form-identifiers"
      className={cn(repairOs.mobileInfoCard, "space-y-2 p-2.5 md:p-4")}
    >
      <div>
        <h2 className="text-sm font-semibold">设备标识</h2>
        <p className="mt-0.5 text-[10px] leading-4 text-muted-foreground lg:text-xs lg:leading-4">
          {description}
        </p>
      </div>
      <div className="grid min-w-0 gap-2">
        {inventoryProductIdentifierKinds.map((kind) => {
          const id = `${idPrefix}-${kind}`;
          const label = identifierLabels[kind];
          const invalid = invalidKinds?.[kind] === true;
          return (
            <div key={kind} className="min-w-0 space-y-1.5">
              <div className="flex min-h-5 items-center justify-between gap-2">
                <label htmlFor={id} className="text-xs font-medium">
                  {label}
                </label>
                {kind === "eid" ? (
                  <span className="text-[10px] text-muted-foreground">EID 不作为主要标识</span>
                ) : allowPrimarySelection ? (
                  <button
                    type="button"
                    className={cn(
                      "inline-flex min-h-11 min-w-11 items-center justify-center rounded-md px-2 text-[10px] font-medium",
                      draft.primary_identifier_kind === kind
                        ? "bg-primary/10 text-primary"
                        : "text-muted-foreground hover:bg-muted",
                    )}
                    aria-pressed={draft.primary_identifier_kind === kind}
                    onClick={() => onPrimaryIdentifierChange?.(kind)}
                  >
                    {draft.primary_identifier_kind === kind ? "主要标识" : "设为主要"}
                  </button>
                ) : (
                  <span className="text-[10px] text-muted-foreground">保存时自动选择主要标识</span>
                )}
              </div>
              <ImeiScannerField
                inputId={id}
                inputAriaLabel={label}
                identifierLabel={label}
                inputMode={kind === "serial" ? "text" : "numeric"}
                ariaInvalid={invalid}
                ariaDescribedBy={invalid ? `${id}-error` : undefined}
                value={draft.identifiers[kind]}
                onChange={(value) => onIdentifierChange(kind, value)}
                onCommitSource={(source) => onIdentifierSource(kind, source)}
                placeholder={`扫描或输入${label}`}
                density="compact"
                showScanner={showScanner}
              />
              {invalid ? (
                <p id={`${id}-error`} className="text-xs text-destructive">
                  请检查{label}格式
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
  onConditionChange,
  onGtinChange,
  onSpecificationChange,
  onListPriceChange,
  onCostChange,
  onLocationChange,
  onWarrantyChange,
  onNotesChange,
}: InventoryProductFormDetailsProps) {
  const [detailsOpen, setDetailsOpen] = useState(false);
  const specFields = detailsSpecificationFields(draft.category);
  return (
    <section data-ui="inventory-product-form-details" className="grid gap-1.5">
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
          <span className="block text-sm font-semibold">更多信息</span>
          <span className="block text-[10px] leading-4 text-muted-foreground">
            成色、设备标识、售价、库位、保修和备注
          </span>
        </span>
        <span aria-hidden className="text-lg leading-none text-muted-foreground">
          {detailsOpen ? "−" : "+"}
        </span>
      </button>

      {detailsOpen ? (
        <div id={`${idPrefix}-details-content`} className="grid gap-1.5">
          <section
            data-ui="inventory-product-form-specifications"
            className={cn(repairOs.mobileInfoCard, "grid min-w-0 grid-cols-2 gap-2 p-2.5 md:p-4")}
          >
            <ProductDetailField
              id={`${idPrefix}-condition`}
              label="成色"
              value={draft.condition}
              placeholder="例如 全新、良好、有使用痕迹"
              invalid={conditionInvalid}
              onChange={onConditionChange}
            />
            <ProductDetailField
              id={`${idPrefix}-gtin`}
              label="EAN / GTIN（同款条码）"
              value={draft.gtin}
              placeholder="8、13 或 14 位商品条码"
              inputMode="numeric"
              invalid={gtinInvalid}
              onChange={onGtinChange}
            />
            {specFields.map((field) => (
              <ProductDetailField
                key={field.key}
                id={`${idPrefix}-spec-${field.key}`}
                label={field.label}
                value={draft.specifications[field.key] ?? ""}
                placeholder={field.placeholder}
                onChange={(value) => onSpecificationChange(field.key, value)}
              />
            ))}
          </section>

          {identifierSection}

          <section
            data-ui="inventory-product-form-commercial"
            className={cn(repairOs.mobileInfoCard, "grid min-w-0 grid-cols-2 gap-2 p-2.5 md:p-4")}
          >
            <ProductDetailField
              id={`${idPrefix}-price`}
              label="计划售价"
              value={draft.list_price}
              placeholder="未填写"
              inputMode="decimal"
              invalid={listPriceInvalid}
              onChange={onListPriceChange}
            />
            {canEnterCost ? (
              <ProductDetailField
                id={`${idPrefix}-cost`}
                label="入库成本"
                value={draft.cost_amount}
                placeholder="未填写"
                inputMode="decimal"
                invalid={costInvalid}
                onChange={onCostChange}
              />
            ) : null}
            <ProductDetailField
              id={`${idPrefix}-location`}
              label="库位"
              value={draft.location}
              placeholder="例如 A-02"
              onChange={onLocationChange}
            />
            <ProductDetailField
              id={`${idPrefix}-warranty`}
              label="保修（月）"
              value={draft.warranty_months}
              placeholder="未填写"
              inputMode="numeric"
              invalid={warrantyInvalid}
              onChange={onWarrantyChange}
            />
            <div className="col-span-2 min-w-0 space-y-1">
              <Label htmlFor={`${idPrefix}-notes`} className="text-xs">
                内部备注
              </Label>
              <Textarea
                id={`${idPrefix}-notes`}
                className="min-h-20 resize-y text-base lg:text-sm"
                maxLength={2000}
                value={draft.notes}
                placeholder="可选"
                onChange={(event) => onNotesChange(event.target.value)}
              />
            </div>
          </section>
        </div>
      ) : null}
    </section>
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
  const errorId = `${id}-error`;
  return (
    <div className="min-w-0 space-y-1">
      <Label htmlFor={id} className="text-xs">
        {label}
      </Label>
      <Input
        id={id}
        className="h-[38px] min-w-0 text-base lg:h-9 lg:text-sm"
        value={value}
        placeholder={placeholder}
        inputMode={inputMode}
        aria-invalid={invalid}
        aria-describedby={invalid ? errorId : undefined}
        onChange={(event) => onChange(event.target.value)}
      />
      {invalid ? (
        <p id={errorId} className="text-xs text-destructive">
          请检查此字段
        </p>
      ) : null}
    </div>
  );
}

function detailsSpecificationFields(category: InventoryProductCategory) {
  if (category === "computer") {
    return [
      { key: "processor", label: "处理器", placeholder: "例如 Apple M3" },
      { key: "disk_type", label: "硬盘类型", placeholder: "例如 SSD" },
      { key: "graphics", label: "显卡", placeholder: "例如 集成显卡" },
    ];
  }
  if (category === "game_console") {
    return [
      { key: "edition", label: "版本", placeholder: "例如 Slim、OLED" },
      { key: "region", label: "区域", placeholder: "例如 EU" },
      { key: "included_controller_count", label: "手柄数", placeholder: "例如 2" },
    ];
  }
  if (category === "phone")
    return [{ key: "network_variant", label: "网络版本", placeholder: "例如 EU" }];
  if (category === "tablet") {
    return [
      { key: "connectivity", label: "联网版本", placeholder: "例如 Wi-Fi + Cellular" },
      { key: "screen_size_inches", label: "屏幕尺寸", placeholder: "例如 11 英寸" },
    ];
  }
  return [{ key: "short_specification", label: "简短规格", placeholder: "可选" }];
}

const faceIdStatusOptions: Array<{ value: InventoryProductFaceIdStatus; label: string }> = [
  { value: "not_tested", label: "未检测" },
  { value: "normal", label: "正常" },
  { value: "abnormal", label: "异常" },
  { value: "not_applicable", label: "不适用" },
];
