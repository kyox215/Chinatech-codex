import type { InventoryProductCategory } from "@/lib/repairdesk/types";
import {
  createInventoryProductFormDraft,
  type InventoryProductFormDraft,
} from "./inventory-product-form";

/** Values owned by a category must be reviewed before replacing that category. */
export function hasInventoryCategoryDependentValues(draft: InventoryProductFormDraft) {
  return (
    [
      draft.brand,
      draft.model,
      draft.ram_capacity,
      draft.storage_capacity,
      draft.color,
      draft.condition,
      draft.gtin,
      ...Object.values(draft.identifiers),
      ...Object.values(draft.specifications),
      draft.inspection_battery_health,
      draft.inspection_face_id_status === "not_tested" ? "" : draft.inspection_face_id_status,
    ].some((value) => value.trim()) ||
    draft.inspection_touched ||
    Boolean(draft.primary_identifier_kind)
  );
}

/** Mirrors intake clearing; commercial values and notes belong to the product draft. */
export function changeInventoryProductCategory(
  draft: InventoryProductFormDraft,
  category: InventoryProductCategory,
): InventoryProductFormDraft {
  if (draft.category === category) return draft;
  return {
    ...createInventoryProductFormDraft(category),
    list_price: draft.list_price,
    cost_amount: draft.cost_amount,
    location: draft.location,
    warranty_months: draft.warranty_months,
    notes: draft.notes,
  };
}
