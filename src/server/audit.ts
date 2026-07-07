import { getSupabaseAdmin, hasSupabaseConfig } from "@/server/supabase";
import type { AuditActor } from "@/lib/repairdesk/types";

export interface WriteAuditLogInput {
  actor?: AuditActor;
  action: string;
  entityType: string;
  entityId: string;
  before?: Record<string, unknown> | null;
  after?: Record<string, unknown> | null;
  metadata?: Record<string, unknown>;
}

const defaultAuditActor: AuditActor = {
  displayName: "系统",
  isSystem: true,
};

const REDACTED_AUDIT_VALUE = "[redacted]";
const MAX_AUDIT_STRING_LENGTH = 512;
const MAX_AUDIT_DEPTH = 8;

const sensitiveAuditKeyPatterns = [
  /data[_-]?base64/i,
  /signed[_-]?url/i,
  /public[_-]?url/i,
  /storage[_-]?path/i,
  /password/i,
  /secret/i,
  /service[_-]?role/i,
  /token/i,
  /cookie/i,
  /authorization/i,
  /message[_-]?body/i,
  /body[_-]?template/i,
  /(^|[._-])body$/i,
  /rendered[_-]?body/i,
  /customer[._-]?.*name/i,
  /display[_-]?name/i,
  /phone/i,
  /email/i,
  /imei/i,
  /serial/i,
  /unlock/i,
  /address/i,
  /contact[_-]?phones/i,
  /file[_-]?name/i,
  /(^|_)notes?$/i,
  /request[_-]?note/i,
  /decision[_-]?note/i,
];

export async function writeAuditLog({
  actor = defaultAuditActor,
  action,
  entityType,
  entityId,
  before,
  after,
  metadata = {},
}: WriteAuditLogInput) {
  if (!hasSupabaseConfig()) return { ok: true };

  const supabase = getSupabaseAdmin();
  const { error } = await supabase.from("audit_logs").insert({
    id: crypto.randomUUID(),
    actor_id: actor.id ?? null,
    actor_email: actor.email ?? null,
    actor_name: actor.displayName,
    store_id: actor.storeId ?? null,
    action,
    entity_type: entityType,
    entity_id: entityId,
    before_data: sanitizeAuditRecord(before),
    after_data: sanitizeAuditRecord(after),
    metadata: sanitizeAuditRecord(metadata) ?? {},
  });

  if (error) throw new Error(`写入审计日志失败：${error.message}`);
  return { ok: true };
}

export function sanitizeAuditRecord(
  record: Record<string, unknown> | null | undefined,
): Record<string, unknown> | null {
  if (!record) return null;
  return sanitizeAuditValue(record) as Record<string, unknown>;
}

function sanitizeAuditValue(value: unknown, key = "", depth = 0): unknown {
  if (isSensitiveAuditKey(key)) {
    if (typeof value === "boolean" && key.split(".").pop()?.startsWith("has_")) return value;
    return REDACTED_AUDIT_VALUE;
  }
  if (value === null || value === undefined) return value;
  if (typeof value === "string") return sanitizeAuditString(value);
  if (typeof value === "number" || typeof value === "boolean") return value;
  if (depth >= MAX_AUDIT_DEPTH) return "[redacted:depth]";

  if (Array.isArray(value)) {
    return value.map((item) => sanitizeAuditValue(item, key, depth + 1));
  }

  if (typeof value === "object") {
    return Object.fromEntries(
      Object.entries(value as Record<string, unknown>).map(([entryKey, entryValue]) => [
        entryKey,
        sanitizeAuditValue(entryValue, key ? `${key}.${entryKey}` : entryKey, depth + 1),
      ]),
    );
  }

  return REDACTED_AUDIT_VALUE;
}

function sanitizeAuditString(value: string) {
  if (value.startsWith("data:")) return REDACTED_AUDIT_VALUE;
  if (value.length > MAX_AUDIT_STRING_LENGTH) {
    return `[redacted:${value.length} chars]`;
  }
  return value;
}

function isSensitiveAuditKey(key: string) {
  if (!key) return false;
  return sensitiveAuditKeyPatterns.some((pattern) => pattern.test(key));
}
