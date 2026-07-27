export const REPAIRDESK_REALTIME_SCHEMA_VERSION = 1 as const;
export const REPAIRDESK_REALTIME_BROADCAST_EVENT = "repairdesk.realtime";
export const REPAIRDESK_REALTIME_ENABLED_VALUE = "1";

export const repairDeskRealtimeDomains = [
  "orders",
  "customers",
  "inventory",
  "settings",
  "memos",
] as const;

export type RepairDeskRealtimeDomain = (typeof repairDeskRealtimeDomains)[number];

export const repairDeskRealtimeMutations = [
  "created",
  "updated",
  "deleted",
  "transitioned",
  "settings_updated",
  "membership_changed",
  "workflow_changed",
] as const;

export type RepairDeskRealtimeMutation = (typeof repairDeskRealtimeMutations)[number];

export const repairDeskRealtimeQueryGroups = [
  "orders.all",
  "orders.workflow",
  "orders.options",
  "customers.all",
  "inventory.all",
  "settings.store",
  "settings.templates",
  "suppliers.all",
  "kiosk.devices",
  "kiosk.sessions",
  "stores.context",
  "stores.members",
  "stores.access_requests",
  "memos.all",
] as const;

export type RepairDeskRealtimeQueryGroup = (typeof repairDeskRealtimeQueryGroups)[number];

export type RepairDeskRealtimeEvent = {
  schemaVersion: typeof REPAIRDESK_REALTIME_SCHEMA_VERSION;
  eventId: string;
  emittedAt: string;
  storeId: string;
  domain: RepairDeskRealtimeDomain;
  mutation: RepairDeskRealtimeMutation;
  queryGroups: RepairDeskRealtimeQueryGroup[];
};

export const repairDeskRealtimeSensitiveKeys = [
  "actorEmail",
  "actorName",
  "amount",
  "attachment",
  "body",
  "contactPhone",
  "contactPhones",
  "customerEmail",
  "customerId",
  "customerName",
  "diagnosis",
  "deviceId",
  "email",
  "entity",
  "entityId",
  "fileName",
  "imei",
  "inviteToken",
  "issue",
  "issueDescription",
  "message",
  "memoId",
  "notes",
  "title",
  "content",
  "assignee",
  "dueAt",
  "orderId",
  "paid",
  "passcode",
  "password",
  "payment",
  "phone",
  "publicNo",
  "related",
  "serial",
  "signedUrl",
  "storagePath",
  "unlock",
  "unlockMethod",
  "unlockPattern",
  "unlockValue",
  "url",
] as const;

const allowedTopLevelKeys = new Set([
  // realtime.send() injects transport metadata into the stored Broadcast
  // payload. Application deduplication continues to use eventId.
  "id",
  "schemaVersion",
  "eventId",
  "emittedAt",
  "storeId",
  "domain",
  "mutation",
  "queryGroups",
]);

const normalizedSensitiveKeys = new Set(repairDeskRealtimeSensitiveKeys.map(normalizePayloadKey));

const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export function buildRepairDeskRealtimeTopic(storeId: string, domain: RepairDeskRealtimeDomain) {
  if (!isRepairDeskRealtimeStoreId(storeId)) {
    throw new Error("RepairDesk realtime topic requires a store UUID.");
  }
  if (!isRepairDeskRealtimeDomain(domain)) {
    throw new Error("RepairDesk realtime topic requires a known domain.");
  }
  return `repairdesk:v1:store:${storeId}:${domain}`;
}

export function isRepairDeskRealtimeStoreId(value: unknown): value is string {
  return typeof value === "string" && uuidPattern.test(value);
}

export function shouldProcessRepairDeskRealtimeEvent(
  event: RepairDeskRealtimeEvent,
  activeStoreId?: string | null,
) {
  return Boolean(activeStoreId && event.storeId === activeStoreId);
}

export function parseRepairDeskRealtimeEvent(input: unknown): RepairDeskRealtimeEvent | null {
  if (!isRecord(input)) return null;
  if (containsRealtimeSensitiveKey(input)) return null;
  if (Object.keys(input).some((key) => !allowedTopLevelKeys.has(key))) return null;

  if (input.schemaVersion !== REPAIRDESK_REALTIME_SCHEMA_VERSION) return null;
  if (!isNonEmptyString(input.eventId)) return null;
  if (!isNonEmptyString(input.emittedAt)) return null;
  if (!isNonEmptyString(input.storeId)) return null;
  if (!isRepairDeskRealtimeDomain(input.domain)) return null;
  if (!isRepairDeskRealtimeMutation(input.mutation)) return null;
  if (!isRepairDeskRealtimeQueryGroupList(input.queryGroups)) return null;

  return {
    schemaVersion: REPAIRDESK_REALTIME_SCHEMA_VERSION,
    eventId: input.eventId,
    emittedAt: input.emittedAt,
    storeId: input.storeId,
    domain: input.domain,
    mutation: input.mutation,
    queryGroups: [...input.queryGroups],
  };
}

export function containsRealtimeSensitiveKey(input: unknown): boolean {
  if (Array.isArray(input)) return input.some((value) => containsRealtimeSensitiveKey(value));
  if (!isRecord(input)) return false;

  return Object.entries(input).some(([key, value]) => {
    const normalizedKey = normalizePayloadKey(key);
    return normalizedSensitiveKeys.has(normalizedKey) || containsRealtimeSensitiveKey(value);
  });
}

export function isRepairDeskRealtimeDomain(value: unknown): value is RepairDeskRealtimeDomain {
  return repairDeskRealtimeDomains.includes(value as RepairDeskRealtimeDomain);
}

export function isRepairDeskRealtimeMutation(value: unknown): value is RepairDeskRealtimeMutation {
  return repairDeskRealtimeMutations.includes(value as RepairDeskRealtimeMutation);
}

export function isRepairDeskRealtimeQueryGroup(
  value: unknown,
): value is RepairDeskRealtimeQueryGroup {
  return repairDeskRealtimeQueryGroups.includes(value as RepairDeskRealtimeQueryGroup);
}

function isRepairDeskRealtimeQueryGroupList(
  value: unknown,
): value is RepairDeskRealtimeQueryGroup[] {
  return Array.isArray(value) && value.length > 0 && value.every(isRepairDeskRealtimeQueryGroup);
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isNonEmptyString(value: unknown): value is string {
  return typeof value === "string" && value.trim().length > 0;
}

function normalizePayloadKey(key: string) {
  return key.toLowerCase().replace(/[^a-z0-9]/g, "");
}
