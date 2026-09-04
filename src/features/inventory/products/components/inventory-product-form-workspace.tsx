"use client";

import type { ReactNode } from "react";
import { useViewportMode, type ViewportMode } from "@/hooks/use-mobile";

import type {
  InventoryCatalogOption,
  InventoryProductCategory,
  InventoryProductFaceIdStatus,
  InventoryProductIdentifierKind,
  InventoryProductIdentifierSource,
} from "@/lib/repairdesk/types";

import {
  InventoryProductForm,
  InventoryProductFormDetails,
  InventoryProductIdentifierSection,
  type InventoryProductIdentifierFieldComponent,
  inventoryProductFormCategories,
} from "./inventory-product-form";
import type { CatalogPickerSurface } from "@/features/inventory/components/inventory-phone-catalog-fields";
import type { InventoryProductFormDraft } from "../model/inventory-product-form";
import type { AppleColorApprovalOverlay } from "../model/device-color-policy";
import { useLocale } from "@/shared/i18n/locale-provider";

export type InventoryProductFormWorkspaceProps = {
  draft: InventoryProductFormDraft;
  idPrefix?: string;
  surface?: CatalogPickerSurface;
  layoutMode?: Exclude<ViewportMode, "pending"> | "auto";
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
  conditionInvalid?: boolean;
  gtinInvalid?: boolean;
  listPriceInvalid?: boolean;
  costInvalid?: boolean;
  warrantyInvalid?: boolean;
  categoryNotice?: ReactNode;
  catalogNotice?: ReactNode;
  canEnterCost?: boolean;
  inspectionEnabled?: boolean;
  identifierDescription?: string;
  showScanner?: boolean;
  identifierField?: InventoryProductIdentifierFieldComponent;
  allowPrimarySelection?: boolean;
  invalidKinds?: Partial<Record<InventoryProductIdentifierKind, boolean>>;
  requiredIdentifierKinds?: Partial<Record<InventoryProductIdentifierKind, boolean>>;
  onCategoryChange: (category: InventoryProductCategory) => void;
  onCategoryKeyDown?: (event: React.KeyboardEvent<HTMLButtonElement>, index: number) => void;
  onBrandChange: (value: string) => void;
  onModelChange: (value: string) => void;
  onRamChange: (value: string) => void;
  onStorageChange: (value: string) => void;
  onColorChange: (value: string) => void;
  onInspectionBatteryHealthChange?: (value: string) => void;
  onInspectionFaceIdStatusChange?: (value: InventoryProductFaceIdStatus) => void;
  onIdentifierChange: (kind: InventoryProductIdentifierKind, value: string) => void;
  onIdentifierSource: (
    kind: InventoryProductIdentifierKind,
    source: Extract<InventoryProductIdentifierSource, "manual" | "scan">,
  ) => void;
  onPrimaryIdentifierChange?: (kind: InventoryProductIdentifierKind) => void;
  onConditionChange: (value: string) => void;
  onGtinChange: (value: string) => void;
  onSpecificationChange: (key: string, value: string) => void;
  onListPriceChange: (value: string) => void;
  onCostChange: (value: string) => void;
  onLocationChange: (value: string) => void;
  onWarrantyChange: (value: string) => void;
  onNotesChange: (value: string) => void;
};

/**
 * The single product form body shared by production Intake/Edit adapters and
 * their Storybook full-page compositions. Side effects stay in the adapters;
 * this component owns the exact controlled form/identifier/detail structure.
 */
export function InventoryProductFormWorkspace({
  draft,
  idPrefix = "product",
  surface = "page",
  layoutMode = "auto",
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
  conditionInvalid = false,
  gtinInvalid = false,
  listPriceInvalid = false,
  costInvalid = false,
  warrantyInvalid = false,
  categoryNotice,
  catalogNotice,
  canEnterCost = false,
  inspectionEnabled = false,
  identifierDescription,
  showScanner = false,
  identifierField,
  allowPrimarySelection = true,
  invalidKinds,
  requiredIdentifierKinds,
  onCategoryChange,
  onCategoryKeyDown,
  onBrandChange,
  onModelChange,
  onRamChange,
  onStorageChange,
  onColorChange,
  onInspectionBatteryHealthChange,
  onInspectionFaceIdStatusChange,
  onIdentifierChange,
  onIdentifierSource,
  onPrimaryIdentifierChange,
  onConditionChange,
  onGtinChange,
  onSpecificationChange,
  onListPriceChange,
  onCostChange,
  onLocationChange,
  onWarrantyChange,
  onNotesChange,
}: InventoryProductFormWorkspaceProps) {
  const { t } = useLocale();
  const viewportMode = useViewportMode();
  if (layoutMode === "auto" && viewportMode === "pending") {
    return (
      <div
        data-inventory-product-form-layout="pending"
        data-inventory-product-form-shell="viewport-pending"
        className="min-h-32 animate-pulse rounded-[var(--radius-lg)] border border-border/60 bg-muted/20"
        aria-busy="true"
        aria-label={t("inventory2b4.quick.workspace.preparing")}
      />
    );
  }
  const resolvedLayoutMode =
    layoutMode === "auto" ? (viewportMode === "desktop" ? "desktop" : "compact") : layoutMode;
  const pickerMode = resolvedLayoutMode === "desktop" ? "desktop" : "mobile";
  const primaryForm = (
    <InventoryProductForm
      draft={draft}
      categories={inventoryProductFormCategories}
      idPrefix={idPrefix}
      surface={surface}
      pickerMode={pickerMode}
      categoryDisabled={categoryDisabled}
      catalogDisabled={catalogDisabled}
      autoFocusBrand={autoFocusBrand}
      brandInvalid={brandInvalid}
      modelInvalid={modelInvalid}
      learnedCatalogOptions={learnedCatalogOptions}
      existingColor={existingColor}
      approvedAppleColorOverlay={approvedAppleColorOverlay}
      colorRequired={colorRequired}
      colorInvalid={colorInvalid}
      inspectionBatteryInvalid={inspectionBatteryInvalid}
      categoryNotice={categoryNotice}
      catalogNotice={catalogNotice}
      inspectionEnabled={inspectionEnabled}
      onCategoryChange={onCategoryChange}
      onCategoryKeyDown={onCategoryKeyDown}
      onBrandChange={onBrandChange}
      onModelChange={onModelChange}
      onRamChange={onRamChange}
      onStorageChange={onStorageChange}
      onColorChange={onColorChange}
      onInspectionBatteryHealthChange={onInspectionBatteryHealthChange}
      onInspectionFaceIdStatusChange={onInspectionFaceIdStatusChange}
    />
  );
  const detailsForm = (
    <InventoryProductFormDetails
      draft={draft}
      idPrefix={idPrefix}
      canEnterCost={canEnterCost}
      layoutMode={resolvedLayoutMode}
      conditionInvalid={conditionInvalid}
      gtinInvalid={gtinInvalid}
      listPriceInvalid={listPriceInvalid}
      costInvalid={costInvalid}
      warrantyInvalid={warrantyInvalid}
      identifierSection={
        <InventoryProductIdentifierSection
          draft={draft}
          idPrefix={idPrefix}
          description={
            identifierDescription ?? t("inventory2b4.quick.workspace.identifierDescription")
          }
          showScanner={showScanner}
          IdentifierField={identifierField}
          allowPrimarySelection={allowPrimarySelection}
          layoutMode={resolvedLayoutMode}
          invalidKinds={invalidKinds}
          requiredKinds={requiredIdentifierKinds}
          onIdentifierChange={onIdentifierChange}
          onIdentifierSource={onIdentifierSource}
          onPrimaryIdentifierChange={onPrimaryIdentifierChange}
        />
      }
      onConditionChange={onConditionChange}
      onGtinChange={onGtinChange}
      onSpecificationChange={onSpecificationChange}
      onListPriceChange={onListPriceChange}
      onCostChange={onCostChange}
      onLocationChange={onLocationChange}
      onWarrantyChange={onWarrantyChange}
      onNotesChange={onNotesChange}
    />
  );

  if (resolvedLayoutMode === "desktop") {
    return (
      <div
        data-inventory-product-form-layout="desktop"
        data-inventory-product-form-shell="desktop-workbench"
        className="grid min-w-0 gap-3 lg:grid-cols-3"
      >
        <div data-inventory-product-form-primary="true" className="min-w-0 lg:col-span-2">
          {primaryForm}
        </div>
        <div data-inventory-product-form-details-column="true" className="min-w-0 lg:col-span-1">
          {detailsForm}
        </div>
      </div>
    );
  }

  return (
    <div
      data-inventory-product-form-layout="compact"
      data-inventory-product-form-shell="mobile-compact"
      className="grid min-w-0 gap-1.5"
    >
      <div data-inventory-product-form-primary="true" className="min-w-0">
        {primaryForm}
      </div>
      <div data-inventory-product-form-details-column="true" className="min-w-0">
        {detailsForm}
      </div>
    </div>
  );
}
