import {
  EU_PHONE_BRANDS,
  EU_PHONE_MODELS,
  findEuPhoneBrand,
} from "@/features/inventory/model/eu-phone-catalog";
import { appleDeviceModelSuggestions } from "./new-order-form";
import verifiedDeviceModels from "./verified-order-device-models.json";

export type DeviceSuggestion = { value: string; aliases?: readonly string[]; brand?: string };

// Order suggestions consume only verified identity data; inventory colors/stock stay untouched.
const verifiedOrderModelAliases: DeviceSuggestion[] = verifiedDeviceModels
  .filter((model) => model.evidence_status === "verified")
  .map((model) => ({
    value: model.marketing_name,
    brand: model.brand,
    aliases: [...model.model_codes, ...model.aliases],
  }));

const normalize = (value: string) =>
  value
    .normalize("NFKC")
    .toLocaleLowerCase("en-US")
    .replace(/\+/g, "plus")
    .replace(/[^\p{L}\p{N}]/gu, "");

export const orderBrandSuggestions: DeviceSuggestion[] = [
  ...EU_PHONE_BRANDS.map((brand) => ({ value: brand.name, aliases: brand.aliases })),
  ...[...new Set(verifiedOrderModelAliases.map((model) => model.brand!))]
    .filter((brand) => !findEuPhoneBrand(brand))
    .map((value) => ({ value })),
];

function findOrderBrand(value: string) {
  const known = findEuPhoneBrand(value);
  if (known) return known.name;
  if (!value.trim() || value.trim() === "苹果") return "Apple";
  return orderBrandSuggestions.find((brand) => normalize(brand.value) === normalize(value))?.value;
}

export function getOrderModelSuggestions(brand: string): DeviceSuggestion[] {
  const name = findOrderBrand(brand);
  if (!name) return [];
  const brandId = findEuPhoneBrand(name)?.id;
  const all: DeviceSuggestion[] = [
    ...verifiedOrderModelAliases.filter(
      (model) => normalize(model.brand ?? "") === normalize(name),
    ),
    ...(brandId === "apple"
      ? appleDeviceModelSuggestions.map((value) => ({ value, brand: "Apple" }))
      : []),
    ...EU_PHONE_MODELS.filter((model) => model.brandId === brandId).map((model) => ({
      value: model.name,
      aliases: model.aliases,
      brand: name,
    })),
  ];
  const byName = new Map<string, DeviceSuggestion>();
  for (const item of all) {
    const key = normalize(item.value);
    const previous = byName.get(key);
    byName.set(
      key,
      previous
        ? {
            ...previous,
            aliases: [...new Set([...(previous.aliases ?? []), ...(item.aliases ?? [])])],
          }
        : item,
    );
  }
  return [...byName.values()];
}

/** Exact and prefix matches precede token/substring matches; unknown text remains editable. */
export function rankDeviceSuggestions(options: readonly DeviceSuggestion[], query: string) {
  const needle = normalize(query);
  return options
    .map((option, index) => {
      const values = [option.value, ...(option.aliases ?? [])].map(normalize);
      const rank = !needle
        ? 0
        : values.some((value) => value === needle)
          ? 0
          : values.some((value) => value.startsWith(needle))
            ? 1
            : values.some((value) => value.includes(needle))
              ? 2
              : 3;
      return { option, index, rank };
    })
    .filter(({ rank }) => rank < 3)
    .sort((a, b) => a.rank - b.rank || a.index - b.index)
    .map(({ option }) => option);
}

export function shouldClearModelOnBrandChange(
  previousBrand: string,
  nextBrand: string,
  model: string,
) {
  // Blank or unknown prior brands do not silently discard a manually entered model.
  const previous = previousBrand.trim() ? findOrderBrand(previousBrand) : undefined;
  const next = nextBrand.trim() ? findOrderBrand(nextBrand) : undefined;
  if (!previous || previous === next || !model.trim()) return false;
  return getOrderModelSuggestions(previousBrand).some((option) =>
    [option.value, ...(option.aliases ?? [])].some(
      (value) => normalize(value) === normalize(model),
    ),
  );
}
