import type { InventoryV2IdentifierInput } from "@/lib/repairdesk/types";

export function mergeVisionIdentifiersWithoutOverwrite(
  current: readonly InventoryV2IdentifierInput[],
  incoming: readonly InventoryV2IdentifierInput[],
) {
  const currentValues = current.filter((identifier) => identifier.value.trim());
  const incomingValues = incoming.filter((identifier) => identifier.value.trim());
  if (incomingValues.length === 0) return [...current];

  const merged = currentValues.length > 0 ? [...currentValues] : [];
  const seen = new Set(merged.map(identifierKey));
  for (const identifier of incomingValues) {
    const key = identifierKey(identifier);
    if (seen.has(key)) continue;
    seen.add(key);
    merged.push({ ...identifier, primary: currentValues.length === 0 && identifier.primary });
  }

  if (merged.length > 0 && !merged.some((identifier) => identifier.primary)) {
    merged[0] = { ...merged[0], primary: true };
  }
  if (merged.filter((identifier) => identifier.primary).length > 1) {
    let primarySeen = false;
    return merged.map((identifier) => {
      if (!identifier.primary) return identifier;
      if (!primarySeen) {
        primarySeen = true;
        return identifier;
      }
      return { ...identifier, primary: false };
    });
  }
  return merged;
}

export function preferExistingInventoryValue(
  current: string | undefined,
  incoming: string | undefined,
) {
  return current?.trim() ? current : (incoming ?? current ?? "");
}

function identifierKey(identifier: InventoryV2IdentifierInput) {
  return `${identifier.kind}:${identifier.value.replace(/[\s\-:：_.,/\\|]+/g, "").toUpperCase()}`;
}
