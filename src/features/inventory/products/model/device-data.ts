import type {
  InventoryProductCategory,
  InventoryProductIdentifierInput,
  InventoryProductIdentifierKind,
} from "@/lib/repairdesk/types";

export const inventoryProductIdentifierKinds = ["imei1", "imei2", "serial", "eid"] as const;

export const identifierLabels: Record<InventoryProductIdentifierKind, string> = {
  imei1: "IMEI 1",
  imei2: "IMEI 2",
  serial: "序列号",
  eid: "EID",
};

export const deviceBrandSuggestions: Record<InventoryProductCategory, string[]> = {
  phone: ["Apple", "Samsung", "Xiaomi", "Google", "Huawei", "Oppo", "OnePlus", "Motorola"],
  tablet: ["Apple", "Samsung", "Lenovo", "Microsoft", "Huawei", "Xiaomi", "Amazon"],
  computer: ["Apple", "Dell", "HP", "Lenovo", "Asus", "Acer", "Microsoft", "MSI"],
  game_console: ["Sony", "Microsoft", "Nintendo", "Valve", "Asus", "Lenovo"],
  other: ["Apple", "Samsung", "Sony", "JBL", "Marshall", "Logitech", "Xiaomi", "Anker"],
};

export function normalizeDeviceIdentifier(value: string) {
  return value
    .trim()
    .replace(/[^A-Za-z0-9]/g, "")
    .toUpperCase();
}

export function isValidImei(value: string) {
  const normalized = normalizeDeviceIdentifier(value);
  if (!/^\d{15}$/.test(normalized)) return false;
  const sum = [...normalized].reduce((total, character, index) => {
    let digit = Number(character);
    if ((index + 1) % 2 === 0) {
      digit *= 2;
      if (digit > 9) digit -= 9;
    }
    return total + digit;
  }, 0);
  return sum % 10 === 0;
}

export function isValidGtin(value: string) {
  const normalized = normalizeDeviceIdentifier(value);
  if (!/^(?:\d{8}|\d{13}|\d{14})$/.test(normalized)) return false;
  const digits = [...normalized].map(Number);
  const checkDigit = digits.pop()!;
  const sum = digits
    .reverse()
    .reduce((total, digit, index) => total + digit * (index % 2 === 0 ? 3 : 1), 0);
  return (10 - (sum % 10)) % 10 === checkDigit;
}

export function validateProductIdentifier(kind: InventoryProductIdentifierKind, value: string) {
  const normalized = normalizeDeviceIdentifier(value);
  if (!normalized) return undefined;
  if (kind === "imei1" || kind === "imei2") {
    return isValidImei(normalized) ? undefined : `${identifierLabels[kind]} 必须是有效的 15 位号码`;
  }
  if (kind === "eid") {
    return /^\d{32}$/.test(normalized) ? undefined : "EID 必须是 32 位数字";
  }
  return normalized.length >= 3 && normalized.length <= 128
    ? undefined
    : "序列号应为 3 到 128 个字母或数字";
}

export function validateProductIdentifiers(identifiers: InventoryProductIdentifierInput[]) {
  const populated = identifiers.filter((identifier) => identifier.value.trim());
  const seenKinds = new Set<InventoryProductIdentifierKind>();
  const seenValues = new Set<string>();
  for (const identifier of populated) {
    if (identifier.primary === true && identifier.kind === "eid") {
      return "EID 不能作为主要设备标识";
    }
    const error = validateProductIdentifier(identifier.kind, identifier.value);
    if (error) return error;
    const normalized = normalizeDeviceIdentifier(identifier.value);
    if (seenKinds.has(identifier.kind)) return `${identifierLabels[identifier.kind]} 只能填写一次`;
    if (seenValues.has(normalized)) return "设备标识不能重复";
    seenKinds.add(identifier.kind);
    seenValues.add(normalized);
  }
  return undefined;
}
