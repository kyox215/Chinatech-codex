import type { FaultPriceItem } from "@/lib/repairdesk/types";

export type FaultDescriptionSourceItem = Pick<FaultPriceItem, "name" | "note" | "price">;

const descriptionSeparators = /[\n\r,，、;；]+/;

function normalizeComparableText(value: string) {
  return value
    .trim()
    .toLocaleLowerCase()
    .replace(/\s*-\s*/g, "-")
    .replace(/\s+/g, " ");
}

function getDescriptionTokens(value: string) {
  return value.split(descriptionSeparators).map(normalizeComparableText).filter(Boolean);
}

function formatFaultDescriptionItem(item: FaultDescriptionSourceItem) {
  return item.name.trim();
}

export function getFaultDescriptionSourceItems(items: FaultDescriptionSourceItem[]) {
  const seen = new Set<string>();
  const sources: FaultDescriptionSourceItem[] = [];

  for (const item of items) {
    const name = item.name.trim();
    const key = normalizeComparableText(name);
    if (!key || seen.has(key)) continue;
    seen.add(key);
    sources.push({ ...item, name });
  }

  return sources;
}

export function hasFaultDescriptionItem(text: string, item: FaultDescriptionSourceItem) {
  const label = normalizeComparableText(formatFaultDescriptionItem(item));
  if (!label) return false;

  const tokens = getDescriptionTokens(text);
  if (tokens.includes(label)) return true;

  const compactText = normalizeComparableText(text);
  return label.length >= 4 && compactText.includes(label);
}

export function getMissingFaultDescriptionItems(text: string, items: FaultDescriptionSourceItem[]) {
  return getFaultDescriptionSourceItems(items).filter(
    (item) => !hasFaultDescriptionItem(text, item),
  );
}

export function countMissingFaultDescriptionItems(
  text: string,
  items: FaultDescriptionSourceItem[],
) {
  return getMissingFaultDescriptionItems(text, items).length;
}

export function appendFaultDescriptionItems(text: string, items: FaultDescriptionSourceItem[]) {
  const current = text.trim();
  const additions = getMissingFaultDescriptionItems(current, items).map(formatFaultDescriptionItem);

  return [current, ...additions].filter(Boolean).join("\n");
}
