import type { CatalogOption } from "@/features/inventory/components/inventory-phone-catalog-fields";
import type { InventoryCatalogOption } from "@/lib/repairdesk/types";

function normalized(value: string) {
  return value.trim().toLocaleLowerCase();
}

/**
 * Curated options stay first. Learned rows only widen the picker and never
 * participate in inspection capability resolution.
 */
export function mergeInventoryCatalogOptions(
  curated: readonly CatalogOption[],
  learned: readonly CatalogOption[],
) {
  const seen = new Set<string>();
  return [...curated, ...learned].filter((option) => {
    const key = normalized(option.value);
    if (!key || seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

export function learnedCatalogOptionsForBrand(
  learned: readonly InventoryCatalogOption[],
  category: InventoryCatalogOption["category"],
  brand: string,
) {
  const normalizedBrand = normalized(brand);
  return learned
    .filter((item) => item.category === category && normalized(item.brand) === normalizedBrand)
    .map<CatalogOption>((item) => ({
      value: item.model,
      description: "已录入型号",
      group: "已录入型号",
    }));
}

export function learnedCatalogBrandsForCategory(
  learned: readonly InventoryCatalogOption[],
  category: InventoryCatalogOption["category"],
) {
  return mergeInventoryCatalogOptions(
    [],
    learned
      .filter((item) => item.category === category)
      .map<CatalogOption>((item) => ({
        value: item.brand,
        description: "已录入品牌",
        group: "已录入品牌",
      })),
  );
}

export function hasLearnedCatalogModel(
  learned: readonly InventoryCatalogOption[],
  category: InventoryCatalogOption["category"],
  brand: string,
  model: string,
) {
  const normalizedBrand = normalized(brand);
  const normalizedModel = normalized(model);
  return learned.some(
    (item) =>
      item.category === category &&
      normalized(item.brand) === normalizedBrand &&
      normalized(item.model) === normalizedModel,
  );
}
