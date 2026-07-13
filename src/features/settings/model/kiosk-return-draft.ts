import type { KioskSession } from "@/lib/repairdesk/types";

const storagePrefix = "repairdesk:settings:kiosk-return-drafts:";

export function kioskReturnDraftKey(session: Pick<KioskSession, "id" | "submission_version">) {
  return `${session.id}:${session.submission_version}`;
}

export function hasKioskReturnDrafts(drafts: Record<string, string>) {
  return Object.values(drafts).some((value) => value.trim().length > 0);
}

export function areKioskReturnDraftsEqual(
  left: Record<string, string>,
  right: Record<string, string>,
) {
  const leftEntries = Object.entries(normalizeKioskReturnDrafts(left)).sort(([a], [b]) =>
    a.localeCompare(b),
  );
  const rightEntries = Object.entries(normalizeKioskReturnDrafts(right)).sort(([a], [b]) =>
    a.localeCompare(b),
  );
  return (
    leftEntries.length === rightEntries.length &&
    leftEntries.every(
      ([key, value], index) =>
        key === rightEntries[index]?.[0] && value === rightEntries[index]?.[1],
    )
  );
}

export function readKioskReturnDrafts(storage: Pick<Storage, "getItem">, storeId: string) {
  try {
    const value = storage.getItem(storageKey(storeId));
    return normalizeKioskReturnDrafts(value ? JSON.parse(value) : null);
  } catch {
    return {};
  }
}

export function writeKioskReturnDrafts(
  storage: Pick<Storage, "setItem" | "removeItem">,
  storeId: string,
  drafts: Record<string, string>,
) {
  const normalized = normalizeKioskReturnDrafts(drafts);
  if (!hasKioskReturnDrafts(normalized)) {
    storage.removeItem(storageKey(storeId));
    return;
  }
  storage.setItem(storageKey(storeId), JSON.stringify(normalized));
}

export function normalizeKioskReturnDrafts(value: unknown): Record<string, string> {
  if (!value || typeof value !== "object" || Array.isArray(value)) return {};
  return Object.fromEntries(
    Object.entries(value as Record<string, unknown>)
      .filter(
        ([key, reason]) =>
          /^[a-zA-Z0-9_-]{1,128}:\d+$/.test(key) &&
          typeof reason === "string" &&
          reason.trim().length > 0,
      )
      .map(([key, reason]) => [key, (reason as string).slice(0, 240)]),
  );
}

function storageKey(storeId: string) {
  return `${storagePrefix}${storeId}`;
}
