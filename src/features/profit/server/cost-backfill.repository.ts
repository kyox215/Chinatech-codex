import type {
  ApplyCostBackfillInput,
  AuditActor,
  CostBackfillCandidate,
  CostBackfillCandidateStatus,
  CostBackfillRun,
  CostBackfillRunState,
  CostBackfillRunsResult,
  CostBackfillRunSummary,
  PreviewCostBackfillInput,
  RevertCostBackfillInput,
} from "@/lib/repairdesk/types";
import { fail, maybeString, requiredString } from "@/server/repairdesk-shared";
import { getSupabaseAdmin } from "@/server/supabase";

type Row = Record<string, unknown>;

const runStates: CostBackfillRunState[] = [
  "draft",
  "previewed",
  "applying",
  "applied",
  "partially_applied",
  "reverting",
  "reverted",
  "revert_partial",
  "rejected",
];
const candidateStates: CostBackfillCandidateStatus[] = [
  "previewed",
  "applied",
  "skipped_conflict",
  "failed",
  "reverted",
  "revert_conflict",
];

export class CostBackfillOperationError extends Error {
  constructor(
    message: string,
    readonly code: string,
    readonly status: number,
  ) {
    super(message);
    this.name = "CostBackfillOperationError";
  }
}

function requireActorId(actor: AuditActor) {
  if (!actor.id) throw new CostBackfillOperationError("缺少回填操作人", "missing_actor", 403);
  return actor.id;
}

function finiteNumber(value: unknown) {
  const parsed = Number(value ?? 0);
  return Number.isFinite(parsed) ? parsed : 0;
}

function nullableNumber(value: unknown) {
  if (value === null || value === undefined || value === "") return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function candidate(value: unknown): CostBackfillCandidate | undefined {
  if (!value || typeof value !== "object" || Array.isArray(value)) return undefined;
  const row = value as Row;
  const status = requiredString(row.status) as CostBackfillCandidateStatus;
  const source = requiredString(row.proposed_source);
  const evidence = requiredString(row.proposed_evidence_status);
  if (
    !candidateStates.includes(status) ||
    !["historical_unknown", "backfill_estimate"].includes(source) ||
    !["unknown", "estimated"].includes(evidence)
  )
    return undefined;
  return {
    id: requiredString(row.id),
    order_id: requiredString(row.order_id),
    line_ordinal: finiteNumber(row.line_ordinal),
    planned_line_id: requiredString(row.planned_line_id),
    line_id_was_missing: row.line_id_was_missing === true,
    catalog_key: maybeString(row.catalog_key),
    line_name: requiredString(row.line_name),
    proposed_cost_amount: nullableNumber(row.proposed_cost_amount),
    proposed_source: source as CostBackfillCandidate["proposed_source"],
    proposed_evidence_status: evidence as CostBackfillCandidate["proposed_evidence_status"],
    status,
    error_code: maybeString(row.error_code),
    applied_projection_revision: nullableNumber(row.applied_projection_revision) ?? undefined,
    applied_at: maybeString(row.applied_at),
    reverted_at: maybeString(row.reverted_at),
  };
}

function summary(value: unknown): CostBackfillRunSummary | undefined {
  if (!value || typeof value !== "object" || Array.isArray(value)) return undefined;
  const row = value as Row;
  const state = requiredString(row.state) as CostBackfillRunState;
  const fixtureHash = requiredString(row.fixture_hash);
  if (!runStates.includes(state) || !/^[a-f0-9]{64}$/.test(fixtureHash)) return undefined;
  return {
    id: requiredString(row.id),
    state,
    start_date: requiredString(row.start_date).slice(0, 10),
    end_date: requiredString(row.end_date).slice(0, 10),
    fixture_hash: fixtureHash,
    candidate_count: finiteNumber(row.candidate_count),
    estimated_count: finiteNumber(row.estimated_count),
    unknown_count: finiteNumber(row.unknown_count),
    applied_count: finiteNumber(row.applied_count),
    conflict_count: finiteNumber(row.conflict_count),
    failed_count: finiteNumber(row.failed_count),
    reverted_count: finiteNumber(row.reverted_count),
    revert_conflict_count: finiteNumber(row.revert_conflict_count),
    created_at: requiredString(row.created_at),
    applied_at: maybeString(row.applied_at),
    reverted_at: maybeString(row.reverted_at),
  };
}

function run(value: unknown): CostBackfillRun {
  const parsed = summary(value);
  if (!parsed || !value || typeof value !== "object" || Array.isArray(value)) {
    throw new CostBackfillOperationError("历史成本回填返回无效", "invalid_result", 502);
  }
  const row = value as Row;
  return {
    ...parsed,
    store_id: requiredString(row.store_id),
    max_candidates: finiteNumber(row.max_candidates),
    candidates: (Array.isArray(row.candidates) ? row.candidates : []).flatMap((item) => {
      const parsedCandidate = candidate(item);
      return parsedCandidate ? [parsedCandidate] : [];
    }),
  };
}

function assertResult(data: unknown, error: { message: string } | null) {
  fail(error, "历史成本回填操作失败");
  if (!data || typeof data !== "object" || Array.isArray(data)) {
    throw new CostBackfillOperationError("历史成本回填返回无效", "invalid_result", 502);
  }
  const result = data as Row;
  if (result.ok === true) return result;
  const code = requiredString(result.code) || "cost_backfill_failed";
  const status = code === "actor_forbidden" ? 403 : code.includes("not_found") ? 404 : 409;
  const messages: Record<string, string> = {
    actor_forbidden: "无权执行历史成本回填操作",
    candidate_limit_exceeded: "候选数量超过限制，请缩短日期范围",
    fixture_hash_mismatch: "预览内容已变化，请重新生成预览",
    run_not_applicable: "该回填运行当前不可应用",
    run_not_revertible: "该回填运行当前不可撤销",
    idempotency_conflict: "重复操作标识对应了不同的预览条件",
    apply_idempotency_conflict: "应用批次的重复操作标识不一致",
    revert_idempotency_conflict: "撤销批次的重复操作标识不一致",
  };
  throw new CostBackfillOperationError(messages[code] ?? `历史成本回填失败：${code}`, code, status);
}

export async function readCostBackfillRunsRepository(
  input: { expected_store_id: string; run_id?: string },
  actor: AuditActor,
): Promise<CostBackfillRunsResult> {
  const { data, error } = await getSupabaseAdmin().rpc("repairdesk_read_cost_backfill_runs_rpc", {
    p_store_id: input.expected_store_id,
    p_actor_id: requireActorId(actor),
    p_run_id: input.run_id ?? null,
  });
  const result = assertResult(data, error);
  return {
    runs: (Array.isArray(result.runs) ? result.runs : []).flatMap((item) => {
      const parsed = summary(item);
      return parsed ? [parsed] : [];
    }),
    ...(result.selected ? { selected: run(result.selected) } : {}),
  };
}

export async function previewCostBackfillRepository(
  input: PreviewCostBackfillInput,
  actor: AuditActor,
) {
  const { data, error } = await getSupabaseAdmin().rpc("repairdesk_preview_cost_backfill_rpc", {
    p_store_id: input.expected_store_id,
    p_actor_id: requireActorId(actor),
    p_start_date: input.start_date,
    p_end_date: input.end_date,
    p_max_candidates: input.max_candidates,
    p_idempotency_key: input.idempotency_key,
  });
  return run(assertResult(data, error));
}

export async function applyCostBackfillRepository(
  input: ApplyCostBackfillInput,
  actor: AuditActor,
) {
  const { data, error } = await getSupabaseAdmin().rpc("repairdesk_apply_cost_backfill_rpc", {
    p_store_id: input.expected_store_id,
    p_run_id: input.run_id,
    p_actor_id: requireActorId(actor),
    p_expected_fixture_hash: input.expected_fixture_hash,
    p_batch_size: input.batch_size,
    p_idempotency_key: input.idempotency_key,
  });
  return run(assertResult(data, error));
}

export async function revertCostBackfillRepository(
  input: RevertCostBackfillInput,
  actor: AuditActor,
) {
  const { data, error } = await getSupabaseAdmin().rpc("repairdesk_revert_cost_backfill_rpc", {
    p_store_id: input.expected_store_id,
    p_run_id: input.run_id,
    p_actor_id: requireActorId(actor),
    p_batch_size: input.batch_size,
    p_idempotency_key: input.idempotency_key,
  });
  return run(assertResult(data, error));
}
