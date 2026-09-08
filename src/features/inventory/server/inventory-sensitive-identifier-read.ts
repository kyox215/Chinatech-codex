import { createHash } from "node:crypto";
import type { AuditActor } from "@/lib/repairdesk/types";
import { getSupabaseAdmin } from "@/server/supabase";

// Shared original inventory identifier scope, membership rule, read bucket and errors.
export async function consumeSensitiveIdentifierRead(actor: AuditActor, storeId: string) {
  const membershipId = actor.activeMembershipId;
  if (!membershipId) {
    throw identifierReadError("INVENTORY_IDENTIFIER_READ_FORBIDDEN", "当前员工身份无效", 403);
  }
  const scopeHash = createHash("sha256")
    .update(`inventory-identifiers:${storeId}:${membershipId}`)
    .digest("hex");
  const { data, error } = await getSupabaseAdmin().rpc(
    "repairdesk_consume_authenticated_rate_limit_rpc",
    { p_scope_hash: scopeHash, p_bucket: "read" },
  );
  if (error) {
    throw identifierReadError(
      "INVENTORY_IDENTIFIER_RATE_LIMIT_UNAVAILABLE",
      "设备标识暂时不可读取，请稍后重试",
      503,
    );
  }
  const result = data as { allowed?: boolean } | null;
  if (!result?.allowed) {
    throw identifierReadError(
      "INVENTORY_IDENTIFIER_RATE_LIMITED",
      "读取设备标识过于频繁，请稍后重试",
      429,
    );
  }
}

function identifierReadError(code: string, message: string, status: number) {
  return Object.assign(new Error(message), { code, status });
}
