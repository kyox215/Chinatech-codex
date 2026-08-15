import type { InventoryProductCategory } from "@/lib/repairdesk/types";
import type { DeviceCatalogColor } from "./device-catalog";

/**
 * A small, local palette for devices that do not have an approved exact-model
 * colour mapping. The order is intentional: it reflects the most common shop
 * intake choices while keeping the list bounded and editable in one place.
 */
export const GENERIC_DEVICE_COLORS = [
  color("black", "黑色", "#1d1d1f"),
  color("gray", "灰色", "#8c8d91"),
  color("dark-blue", "深蓝色", "#233d63"),
  color("green", "绿色", "#4f6657"),
  color("white", "白色", "#f5f5f0"),
  color("silver", "银色", "#d8d9d6"),
  color("blue", "蓝色", "#4776a8"),
  color("red", "红色", "#b6242a"),
  color("purple", "紫色", "#a79ab8"),
  color("yellow", "黄色", "#f2e36d"),
] as const satisfies readonly DeviceCatalogColor[];

export type AppleColorApprovalOverlay = Readonly<Record<string, readonly DeviceCatalogColor[]>>;

export type DeviceColorPolicyState = "generic" | "approved" | "pending-official-color";

export type DeviceColorPolicyInput = {
  brand: string;
  model: string;
  approvedAppleColors?: AppleColorApprovalOverlay;
  existingColor?: string;
  selectedColor?: string;
  colorRequired?: boolean;
  /** Kept in the contract so callers can make category-aware policy decisions. */
  category?: InventoryProductCategory;
};

export type DeviceColorSaveDecision = {
  canSave: boolean;
  blockedReason?: "color-required" | "color-not-approved";
  /** A newly selected value only; pending Apple values are intentionally omitted. */
  payloadColor?: string;
  /** Existing edit/draft value that the UI must retain read-only. */
  preservedExistingColor?: string;
};

export type DeviceColorPolicy = {
  state: DeviceColorPolicyState;
  options: readonly DeviceCatalogColor[];
  allowCustom: boolean;
  canSelect: boolean;
  statusMessage: string;
  existingColor?: string;
  save: DeviceColorSaveDecision;
};

const APPLE_BRAND_VALUES = new Set(["apple", "苹果"]);

function color(id: string, name: string, ...swatches: string[]): DeviceCatalogColor {
  return { id, name, swatches };
}

function normalize(value: string) {
  return value.trim().toLocaleLowerCase("en-US");
}

function dedupeColors(options: readonly DeviceCatalogColor[]) {
  const seen = new Set<string>();
  return options.filter((option) => {
    const key = `${normalize(option.id)}:${normalize(option.name)}`;
    if (!option.id.trim() || !option.name.trim() || seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

/**
 * Returns the curated generic palette in its stable priority order. Optional
 * additions are appended after the five primary choices and deduplicated.
 */
export function listGenericDeviceColors(
  additions: readonly DeviceCatalogColor[] = [],
): readonly DeviceCatalogColor[] {
  return dedupeColors([...GENERIC_DEVICE_COLORS, ...additions]);
}

function findApprovedAppleColors(
  model: string,
  approvedAppleColors: AppleColorApprovalOverlay | undefined,
) {
  const normalizedModel = normalize(model);
  if (!normalizedModel || !approvedAppleColors) return undefined;

  const entry = Object.entries(approvedAppleColors).find(
    ([key, colors]) => normalize(key) === normalizedModel && colors.length > 0,
  );
  return entry ? dedupeColors(entry[1]) : undefined;
}

function isAppleBrand(brand: string) {
  return APPLE_BRAND_VALUES.has(normalize(brand));
}

function hasValue(value: string | undefined): value is string {
  return Boolean(value?.trim());
}

function requiredSaveDecision(
  colorRequired: boolean,
  existingColor: string | undefined,
  payloadColor: string | undefined,
): DeviceColorSaveDecision {
  if (colorRequired && !hasValue(existingColor) && !hasValue(payloadColor)) {
    return { canSave: false, blockedReason: "color-required" };
  }
  return {
    canSave: true,
    ...(hasValue(payloadColor) ? { payloadColor: payloadColor.trim() } : {}),
    ...(hasValue(existingColor) ? { preservedExistingColor: existingColor.trim() } : {}),
  };
}

/**
 * Resolves display and save policy without importing the broad EU catalogue.
 * Apple is selectable only when an exact model is present in an injected,
 * reviewed approval overlay; otherwise it remains pending and offers no
 * generic/custom choice.
 */
export function resolveDeviceColorPolicy(input: DeviceColorPolicyInput): DeviceColorPolicy {
  const existingColor = input.existingColor?.trim() || undefined;
  const selectedColor = input.selectedColor?.trim() || undefined;
  const colorRequired = input.colorRequired === true;

  if (!isAppleBrand(input.brand)) {
    const options = listGenericDeviceColors();
    // Non-Apple inventory keeps the curated choices discoverable while still
    // allowing a directly entered shop-specific colour as a supplement.
    const payloadColor = selectedColor;
    return {
      state: "generic",
      options,
      allowCustom: true,
      canSelect: true,
      statusMessage: "可选择常用颜色，也可以补充自定义颜色。",
      ...(existingColor ? { existingColor } : {}),
      save: requiredSaveDecision(colorRequired, existingColor, payloadColor),
    };
  }

  const approvedColors = findApprovedAppleColors(input.model, input.approvedAppleColors);
  if (!approvedColors) {
    return {
      state: "pending-official-color",
      options: [],
      allowCustom: false,
      canSelect: false,
      statusMessage: "该 Apple 型号尚无已审核的官方颜色映射，暂不能新增颜色。",
      ...(existingColor ? { existingColor } : {}),
      save: {
        ...requiredSaveDecision(colorRequired, existingColor, undefined),
        // A pending Apple mapping never turns a new value into a save payload.
        payloadColor: undefined,
      },
    };
  }

  const validSelection =
    selectedColor && approvedColors.some((option) => option.name === selectedColor);
  const invalidSelection = Boolean(selectedColor && !validSelection);
  const save = invalidSelection
    ? {
        canSave: false,
        blockedReason: "color-not-approved" as const,
        ...(existingColor ? { preservedExistingColor: existingColor } : {}),
      }
    : requiredSaveDecision(
        colorRequired,
        existingColor,
        validSelection ? selectedColor : undefined,
      );

  return {
    state: "approved",
    options: approvedColors,
    allowCustom: false,
    canSelect: true,
    statusMessage: "仅显示该型号已审核的官方颜色。",
    ...(existingColor ? { existingColor } : {}),
    save,
  };
}
