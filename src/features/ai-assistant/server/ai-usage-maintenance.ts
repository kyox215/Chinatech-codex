import type { AiBudgetRpcInvoker } from "./supabase-provider-budget";
import { getSupabaseAdmin } from "@/server/supabase";

type MaintenanceEnvironment = {
  AI_ASSISTANT_MAINTENANCE_ENABLED?: string;
  AI_ASSISTANT_USAGE_RETENTION_DAYS?: string;
};

type MaintenanceResult = {
  staleSettledCount: number;
  requestDeletedCount: number;
  rateBucketDeletedCount: number;
};

export async function runAiUsageMaintenance({
  rpc,
  env = process.env as MaintenanceEnvironment,
  now = () => new Date(),
}: {
  rpc?: AiBudgetRpcInvoker;
  env?: MaintenanceEnvironment;
  now?: () => Date;
} = {}): Promise<MaintenanceResult> {
  if (env.AI_ASSISTANT_MAINTENANCE_ENABLED !== "1") {
    throw new Error("AI maintenance is disabled");
  }
  const retentionDays = Number(env.AI_ASSISTANT_USAGE_RETENTION_DAYS);
  if (!Number.isSafeInteger(retentionDays) || retentionDays < 30 || retentionDays > 365) {
    throw new Error("AI maintenance retention is invalid");
  }
  const invoke = rpc ?? defaultRpcInvoker();
  const retentionBefore = new Date(now().getTime() - retentionDays * 86_400_000).toISOString();
  let response: Awaited<ReturnType<AiBudgetRpcInvoker>>;
  try {
    response = await invoke("repairdesk_maintain_ai_usage", {
      p_stale_limit: 100,
      p_retention_before: retentionBefore,
      p_delete_limit: 500,
    });
  } catch {
    throw new Error("AI maintenance RPC unavailable");
  }
  if (response.error || !isRecord(response.data) || response.data.ok !== true) {
    throw new Error("AI maintenance RPC unavailable");
  }
  return {
    staleSettledCount: requireCount(response.data.stale_settled_count),
    requestDeletedCount: requireCount(response.data.request_deleted_count),
    rateBucketDeletedCount: requireCount(response.data.rate_bucket_deleted_count),
  };
}

function defaultRpcInvoker(): AiBudgetRpcInvoker {
  const client = getSupabaseAdmin();
  return (functionName, args) => client.rpc(functionName, args);
}

function requireCount(value: unknown) {
  if (!Number.isSafeInteger(value) || (value as number) < 0) {
    throw new Error("AI maintenance RPC returned invalid counts");
  }
  return value as number;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}
