import type { AuditActor } from "@/lib/repairdesk/types";
import { writeAuditLog } from "@/server/audit";

export type AiAssistantAuditStatus =
  | "succeeded"
  | "rejected"
  | "failed"
  | "rate_limited"
  | "cancelled";

export type WriteAiAssistantAuditInput = {
  actor: AuditActor;
  event: "order_plan" | "order_tool" | "vision_recognition" | "draft_review" | "draft_apply";
  requestId: string;
  status: AiAssistantAuditStatus;
  provider: "none" | "fake" | "openai";
  modelVersion: string;
  promptVersion: string;
  schemaVersion: string;
  toolName?: "search_orders" | "get_order_summary" | "clarify_order_query";
  inputImageCount?: number;
  inputBytesBucket?: "0" | "1-256k" | "256k-1m" | "1m-4m" | "over-4m";
  resultCount?: number;
  acceptedFieldCount?: number;
  changedFieldCount?: number;
  rejectedFieldCount?: number;
  inputTokens?: number;
  outputTokens?: number;
  latencyBucket?: "under-1s" | "1-5s" | "5-20s" | "20-60s" | "over-60s";
  errorCode?: string;
};

export async function writeAiAssistantAudit(input: WriteAiAssistantAuditInput) {
  return writeAuditLog({
    actor: input.actor,
    action: input.event,
    entityType: "ai_assistant_request",
    entityId: input.requestId,
    metadata: {
      status: input.status,
      provider: input.provider,
      model_version: input.modelVersion,
      prompt_version: input.promptVersion,
      schema_version: input.schemaVersion,
      ...(input.toolName ? { tool_name: input.toolName } : {}),
      ...(input.inputImageCount !== undefined ? { input_image_count: input.inputImageCount } : {}),
      ...(input.inputBytesBucket ? { input_bytes_bucket: input.inputBytesBucket } : {}),
      ...(input.resultCount !== undefined ? { result_count: input.resultCount } : {}),
      ...(input.acceptedFieldCount !== undefined
        ? { accepted_field_count: input.acceptedFieldCount }
        : {}),
      ...(input.changedFieldCount !== undefined
        ? { changed_field_count: input.changedFieldCount }
        : {}),
      ...(input.rejectedFieldCount !== undefined
        ? { rejected_field_count: input.rejectedFieldCount }
        : {}),
      ...(input.inputTokens !== undefined ? { input_token_count: input.inputTokens } : {}),
      ...(input.outputTokens !== undefined ? { output_token_count: input.outputTokens } : {}),
      ...(input.latencyBucket ? { latency_bucket: input.latencyBucket } : {}),
      ...(input.errorCode ? { error_code: normalizeErrorCode(input.errorCode) } : {}),
    },
  });
}

export function bucketAiAssistantLatency(latencyMs: number) {
  if (latencyMs < 1_000) return "under-1s" as const;
  if (latencyMs < 5_000) return "1-5s" as const;
  if (latencyMs < 20_000) return "5-20s" as const;
  if (latencyMs <= 60_000) return "20-60s" as const;
  return "over-60s" as const;
}

export function bucketAiAssistantInputBytes(bytes: number) {
  if (bytes <= 0) return "0" as const;
  if (bytes <= 256 * 1024) return "1-256k" as const;
  if (bytes <= 1024 * 1024) return "256k-1m" as const;
  if (bytes <= 4 * 1024 * 1024) return "1m-4m" as const;
  return "over-4m" as const;
}

function normalizeErrorCode(value: string) {
  const normalized = value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9_.-]+/g, "_");
  return normalized.slice(0, 80) || "unknown";
}
