import type { InventoryProductCategory } from "@/lib/repairdesk/types";
import { listDeviceCatalogColors, type DeviceCatalogColor } from "./device-catalog";

/** Shared inventory entry presets. Values remain the existing string payload. */
export const DEVICE_STORAGE_OPTIONS = [
  "8 GB",
  "16 GB",
  "32 GB",
  "64 GB",
  "128 GB",
  "256 GB",
  "512 GB",
  "1 TB",
  "2 TB",
  "4 TB",
  "8 TB",
] as const;

export const DEVICE_RAM_OPTIONS = ["2 GB", "4 GB", "8 GB", "16 GB"] as const;
export const COMPUTER_RAM_OPTIONS = ["32 GB", "64 GB", "128 GB"] as const;

export const DEVICE_CONDITION_OPTIONS = [
  { value: "100", label: "全新 · 100%" },
  { value: "90", label: "近新 · 90%" },
  { value: "80", label: "良好 · 80%" },
  { value: "70", label: "正常 · 70%" },
  { value: "60", label: "明显使用痕迹 · 60%" },
] as const;

function mergeOptions(preferred: readonly string[] | undefined, fallback: readonly string[]) {
  const seen = new Set<string>();
  return [...(preferred ?? []), ...fallback].filter((value) => {
    const normalized = value.trim().toLocaleLowerCase();
    if (!normalized || seen.has(normalized)) return false;
    seen.add(normalized);
    return true;
  });
}

function sortCapacityOptions(options: readonly string[]) {
  const capacity = (value: string) => {
    const match = value.trim().match(/^(\d+(?:\.\d+)?)\s*(GB|TB)$/i);
    if (!match) return Number.POSITIVE_INFINITY;
    const amount = Number(match[1]);
    return match[2].toUpperCase() === "TB" ? amount * 1024 : amount;
  };
  return [...options].sort((left, right) => {
    const delta = capacity(left) - capacity(right);
    return Number.isFinite(delta) && delta !== 0 ? delta : left.localeCompare(right);
  });
}

export function listDeviceStorageOptions(
  category: InventoryProductCategory,
  modelOptions?: readonly string[],
) {
  if (category === "other") return [...(modelOptions ?? [])];
  return sortCapacityOptions(mergeOptions(modelOptions, DEVICE_STORAGE_OPTIONS));
}

export function listDeviceRamOptions(
  category: InventoryProductCategory,
  modelOptions?: readonly string[],
) {
  if (category === "other" || category === "game_console") return [...(modelOptions ?? [])];
  const fallback =
    category === "computer" ? [...DEVICE_RAM_OPTIONS, ...COMPUTER_RAM_OPTIONS] : DEVICE_RAM_OPTIONS;
  return mergeOptions(modelOptions, fallback);
}

export function listDeviceConditionOptions() {
  return [...DEVICE_CONDITION_OPTIONS];
}

export function listDeviceColorOptions(
  category: InventoryProductCategory,
  modelOptions?: readonly DeviceCatalogColor[],
) {
  const preferred = modelOptions ?? [];
  const fallback = listDeviceCatalogColors(category);
  const seen = new Set<string>();
  return [...preferred, ...fallback].filter((option) => {
    if (seen.has(option.id)) return false;
    seen.add(option.id);
    return true;
  });
}
