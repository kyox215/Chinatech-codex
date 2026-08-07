import type { InventoryProductListItem } from "@/lib/repairdesk/types";

import {
  findEuPhoneBrand,
  findEuPhoneColor,
  findEuPhoneModel,
  type PhoneColorOption,
  phoneColorBackground,
} from "./eu-phone-catalog";

export type InventoryProductReferenceFamily =
  | "switch"
  | "ps4"
  | "ps5"
  | "iphone-classic"
  | "iphone-standard"
  | "iphone-modern";

export type InventoryProductReferenceImage = {
  family: InventoryProductReferenceFamily;
  src: `/inventory-reference/${InventoryProductReferenceFamily}.webp`;
  alt: string;
  label: string;
};

export type InventoryProductColorMatch = {
  value: string;
  option?: PhoneColorOption;
};

export const INVENTORY_PRODUCT_REFERENCE_IMAGES: Record<
  InventoryProductReferenceFamily,
  InventoryProductReferenceImage
> = {
  switch: {
    family: "switch",
    src: "/inventory-reference/switch.webp",
    alt: "Nintendo Switch 设备参考图",
    label: "Switch 参考图",
  },
  ps4: {
    family: "ps4",
    src: "/inventory-reference/ps4.webp",
    alt: "Sony PlayStation 4 设备参考图",
    label: "PS4 参考图",
  },
  ps5: {
    family: "ps5",
    src: "/inventory-reference/ps5.webp",
    alt: "Sony PlayStation 5 设备参考图",
    label: "PS5 参考图",
  },
  "iphone-classic": {
    family: "iphone-classic",
    src: "/inventory-reference/iphone-classic.webp",
    alt: "Apple iPhone 经典机型设备参考图",
    label: "iPhone 经典参考图",
  },
  "iphone-standard": {
    family: "iphone-standard",
    src: "/inventory-reference/iphone-standard.webp",
    alt: "Apple iPhone 标准机型设备参考图",
    label: "iPhone 标准参考图",
  },
  "iphone-modern": {
    family: "iphone-modern",
    src: "/inventory-reference/iphone-modern.webp",
    alt: "Apple iPhone 现代机型设备参考图",
    label: "iPhone 现代参考图",
  },
};

function normalized(value: string) {
  return value
    .trim()
    .toLocaleLowerCase("en-US")
    .normalize("NFKC")
    .replace(/[\s_-]+/g, " ");
}

function compact(value: string) {
  return normalized(value).replace(/[^\p{L}\p{N}]+/gu, "");
}

/** Match only families with an original local illustration. */
export function matchInventoryProductReference(
  item: Pick<InventoryProductListItem, "brand" | "model">,
): InventoryProductReferenceImage | undefined {
  const brand = normalized(item.brand);
  const model = normalized(item.model);
  const combined = `${brand} ${model}`;
  const compactCombined = compact(combined);

  if (compactCombined.includes("switch")) {
    return INVENTORY_PRODUCT_REFERENCE_IMAGES.switch;
  }

  const isPlayStation =
    compactCombined.includes("playstation") ||
    compactCombined.includes("sony") ||
    compactCombined.includes("索尼");
  if (isPlayStation && /ps5|playstation5/.test(compactCombined)) {
    return INVENTORY_PRODUCT_REFERENCE_IMAGES.ps5;
  }
  if (isPlayStation && /ps4|playstation4/.test(compactCombined)) {
    return INVENTORY_PRODUCT_REFERENCE_IMAGES.ps4;
  }

  const isApple =
    compactCombined.includes("apple") ||
    compactCombined.includes("iphone") ||
    compactCombined.includes("苹果");
  const isIPhone = compactCombined.includes("iphone");
  if (!isApple || !isIPhone) return undefined;

  // Specific modern tokens are evaluated before the ordinary generation token;
  // this keeps "iPhone 14 Pro" in modern rather than standard.
  if (/\bpro\b/.test(combined) || /\bair\b/.test(combined) || /\b(?:15|16|17)e?\b/.test(model)) {
    return INVENTORY_PRODUCT_REFERENCE_IMAGES["iphone-modern"];
  }
  if (/\b(?:7|8)\b/.test(model) || /\bse\b/.test(model)) {
    return INVENTORY_PRODUCT_REFERENCE_IMAGES["iphone-classic"];
  }
  if (compactCombined.includes("iphone")) {
    return INVENTORY_PRODUCT_REFERENCE_IMAGES["iphone-standard"];
  }
  return undefined;
}

function isAppleProduct(item: Pick<InventoryProductListItem, "brand" | "model">) {
  const combined = compact(`${item.brand} ${item.model}`);
  return combined.includes("apple") || combined.includes("iphone") || combined.includes("苹果");
}

/**
 * Resolve the product color against the read-only EU catalog. The explicit
 * DTO color wins; the final specification segment is only a compatibility
 * fallback for older list payloads that embedded color in specification.
 */
export function matchInventoryProductColor(
  item: Pick<InventoryProductListItem, "brand" | "model" | "color" | "specification">,
): InventoryProductColorMatch | undefined {
  const explicitValue = item.color?.trim();
  const specificationValues = (item.specification ?? "")
    .split(/[·|,，/]/u)
    .map((value) => value.trim())
    .filter(Boolean);
  const candidates = explicitValue ? [explicitValue, ...specificationValues] : specificationValues;

  if (isAppleProduct(item)) {
    const brandId = findEuPhoneBrand(item.brand)?.id ?? "apple";
    for (const value of candidates) {
      const option = findEuPhoneColor(brandId, item.model, value);
      if (option) return { value, option };
    }
    const legacyColorValue = specificationValues.at(-1);
    if (legacyColorValue && !/^\d+(?:[.,]\d+)?\s*(?:gb|tb)$/iu.test(legacyColorValue)) {
      return { value: legacyColorValue };
    }
  }

  return explicitValue ? { value: explicitValue } : undefined;
}

export function inventoryProductColorStyle(option: PhoneColorOption) {
  return { background: phoneColorBackground(option) };
}

export function isKnownEuPhoneModel(brand: string, model: string) {
  const brandId = findEuPhoneBrand(brand)?.id;
  return Boolean(brandId && findEuPhoneModel(brandId, model));
}
