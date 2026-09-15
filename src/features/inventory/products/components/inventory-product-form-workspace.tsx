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
  ProductDetailField,
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
  presentation?: "standard" | "fullscreen";
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
  presentation = "standard",
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
      presentation={presentation === "fullscreen" ? "dossier" : "standard"}
      conditionInvalid={conditionInvalid}
      onConditionChange={onConditionChange}
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
  const identifierSection = (
    <InventoryProductIdentifierSection
      draft={draft}
      idPrefix={idPrefix}
      description={identifierDescription ?? t("inventory2b4.quick.workspace.identifierDescription")}
      showScanner={showScanner}
      IdentifierField={identifierField}
      allowPrimarySelection={allowPrimarySelection}
      layoutMode={presentation === "fullscreen" ? "dossier" : resolvedLayoutMode}
      invalidKinds={invalidKinds}
      requiredKinds={requiredIdentifierKinds}
      onIdentifierChange={onIdentifierChange}
      onIdentifierSource={onIdentifierSource}
      onPrimaryIdentifierChange={onPrimaryIdentifierChange}
    >
      {presentation === "fullscreen" ? (
        <ProductDetailField
          id={`${idPrefix}-gtin`}
          label={t("inventory2b4.quick.form.gtin")}
          value={draft.gtin}
          placeholder={t("inventory2b4.quick.form.gtinPlaceholder")}
          inputMode="numeric"
          invalid={gtinInvalid}
          onChange={onGtinChange}
        />
      ) : null}
    </InventoryProductIdentifierSection>
  );
  const detailsForm = (
    <InventoryProductFormDetails
      draft={draft}
      idPrefix={idPrefix}
      canEnterCost={false}
      preserveDisclosureState={presentation === "fullscreen"}
      presentation={presentation === "fullscreen" ? "dossier" : "standard"}
      layoutMode={resolvedLayoutMode}
      conditionInvalid={conditionInvalid}
      gtinInvalid={gtinInvalid}
      listPriceInvalid={listPriceInvalid}
      costInvalid={costInvalid}
      warrantyInvalid={warrantyInvalid}
      identifierSection={
        presentation !== "fullscreen" && resolvedLayoutMode !== "desktop"
          ? identifierSection
          : undefined
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

  // Intake keeps one form tree while CSS reflows it; rotating a tablet must not
  // replace the form/details owners or create a second set of field IDs.
  if (presentation === "fullscreen") {
    return (
      <div className="@container/inventory-form min-w-0">
        <div
          data-inventory-product-form-layout={resolvedLayoutMode}
          data-inventory-product-form-shell="fullscreen-workbench"
          className="grid min-w-0 items-start gap-2.5 md:gap-4 @[900px]/inventory-form:grid-cols-[minmax(0,2fr)_minmax(260px,1fr)]"
        >
          <div data-inventory-product-form-primary="true" className="grid min-w-0 gap-2.5 md:gap-4">
            {primaryForm}
            {identifierSection}
          </div>
          <div data-inventory-product-form-details-column="true" className="min-w-0">
            {detailsForm}
          </div>
        </div>
      </div>
    );
  }

  if (resolvedLayoutMode === "desktop") {
    return (
      <div
        data-inventory-product-form-layout="desktop"
        data-inventory-product-form-shell="desktop-workbench"
        className="grid min-w-0 gap-3 lg:grid-cols-3"
      >
        <div data-inventory-product-form-primary="true" className="min-w-0">
          {primaryForm}
        </div>
        <div data-inventory-product-form-identifiers-column="true" className="min-w-0">
          {identifierSection}
        </div>
        <div data-inventory-product-form-details-column="true" className="min-w-0">
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
