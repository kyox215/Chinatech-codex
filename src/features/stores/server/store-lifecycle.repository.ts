import { createHash } from "node:crypto";

import {
  assertPrimaryStoreOwner,
  assertPrimaryStoreOwnerForStore,
} from "@/features/stores/server/primary-store-owner";
import {
  getStorePurgeConfirmationPhrase,
  getStorePurgeStoreIdSuffix,
  type StorePurgeConfirmationOperation,
} from "@/entities/store/model/store-purge-confirmation";
import {
  clearActiveStoreCookie,
  setActiveStoreCookie,
} from "@/features/stores/server/store.repository";
import type {
  AuditActor,
  StoreCloseInput,
  StoreExportPrepareInput,
  StoreExportPrepareResult,
  StoreLifecycleChallengeInput,
  StoreLifecycleChallengeResult,
  StoreLifecycleBlocker,
  StoreLifecycleMutationResult,
  StoreLifecycleOperationStatus,
  StoreLifecyclePreflight,
  StoreLifecycleState,
  StorePurgeCancelInput,
  StorePurgeConfirmInput,
  StorePurgeRequest,
  StorePurgeRequestInput,
  StorePurgeScheduleInput,
  StoreRenameInput,
  StoreRestoreInput,
} from "@/lib/repairdesk/types";
import { ForbiddenError } from "@/server/auth-context";
import { type DbRecord, fail, requiredString } from "@/server/repairdesk-shared";
import { getSupabaseAdmin } from "@/server/supabase";
import {
  isStoreLifecycleMutationSafeEnabled,
  isStoreLifecyclePurgeSchedulingEnabled,
} from "./store-lifecycle-feature-flags";
import { assertRecentLifecycleAal2 } from "./store-lifecycle-auth";

const PREFLIGHT_TTL_MS = 10 * 60 * 1000;
const STORAGE_OBJECT_LIMIT = 10_000;
const STORAGE_BUCKETS = [
  "repairdesk-order-attachments",
  "repairdesk-inventory-attachments",
  "repairdesk-buyback-evidence",
] as const;
const CHALLENGE_TTL_MS = 5 * 60 * 1000;

const COUNT_TABLES = [
  "repair_orders",
  "customers",
  "devices",
  "inventory_items",
  "suppliers",
  "store_memberships",
] as const;

export async function createStoreLifecyclePreflight(
  expectedStoreId: string,
  actor: AuditActor,
): Promise<StoreLifecyclePreflight> {
  const owner = await assertPrimaryStoreOwnerForStore(expectedStoreId, actor);
  if (owner.storeId !== expectedStoreId) {
    throw new ForbiddenError("店铺上下文已经变化，请重新选择店铺");
  }

  const supabase = getSupabaseAdmin();
  const lifecycle = await readStoreLifecycle(supabase, expectedStoreId);
  if (lifecycle.phase !== "active" && lifecycle.phase !== "archived") {
    throw new ForbiddenError("当前店铺状态不允许生成新的安全预检");
  }

  const [
    storeResult,
    countEntries,
    fullCountsResult,
    openOrders,
    balances,
    custody,
    openKiosk,
    pendingInvites,
  ] = await Promise.all([
    supabase
      .from("stores")
      .select("id, name, status")
      .eq("id", expectedStoreId)
      .eq("status", "active")
      .maybeSingle(),
    Promise.all(
      COUNT_TABLES.map(
        async (table) => [table, await countStoreRows(supabase, table, expectedStoreId)] as const,
      ),
    ),
    supabase.rpc("repairdesk_store_row_counts", { p_store_id: expectedStoreId }),
    countOpenOrders(supabase, expectedStoreId),
    readUnsettledBalance(supabase, expectedStoreId),
    countRowsWithFilter(supabase, "repair_orders", expectedStoreId, (query) =>
      query.eq("device_custody_status", "with_shop"),
    ),
    countRowsWithFilter(supabase, "customer_kiosk_sessions", expectedStoreId, (query) =>
      query.in("status", ["queued", "active", "submitted", "returned"]),
    ),
    readPendingInviteCount(supabase, expectedStoreId),
  ]);
  fail(storeResult.error, "读取店铺预检身份失败");
  fail(fullCountsResult.error, "读取店铺完整数据计数失败");
  if (!storeResult.data) throw new ForbiddenError("店铺不存在或不可用");

  const counts = {
    ...((fullCountsResult.data ?? {}) as Record<string, number>),
    ...Object.fromEntries(countEntries),
  };
  counts.open_orders = openOrders;
  counts.devices_in_custody = custody;
  counts.open_kiosk_sessions = openKiosk;
  counts.pending_invitations = pendingInvites;

  const blockers: StoreLifecycleBlocker[] = [];
  if (openOrders > 0) blockers.push({ code: "open_orders", count: openOrders });
  if (balances.amount > 0) {
    blockers.push({
      code: "unsettled_balance",
      count: balances.count,
      amount: balances.amount,
    });
  }
  if (custody > 0) blockers.push({ code: "device_in_custody", count: custody });
  const storage =
    lifecycle.phase === "archived"
      ? await buildStorageSummary(supabase, expectedStoreId)
      : { complete: true, buckets: [] };
  if (lifecycle.phase === "archived") {
    if (lifecycle.retention_until && new Date(lifecycle.retention_until).getTime() > Date.now()) {
      blockers.push({ code: "retention_hold" });
    }
    if (lifecycle.legal_hold_until && new Date(lifecycle.legal_hold_until).getTime() > Date.now()) {
      blockers.push({ code: "legal_hold" });
    }
    if (!storage.complete) blockers.push({ code: "storage_manifest_unavailable" });
  }

  const id = crypto.randomUUID();
  const expiresAt = new Date(Date.now() + PREFLIGHT_TTL_MS).toISOString();
  const state = blockers.length === 0 ? "eligible" : "blocked";
  const catalogFingerprint = sha256(JSON.stringify([...COUNT_TABLES, ...STORAGE_BUCKETS]));
  const snapshotHash = sha256(
    stableJson({
      id,
      store_id: expectedStoreId,
      lifecycle_revision: lifecycle.revision,
      counts,
      blockers,
      storage,
      expires_at: expiresAt,
    }),
  );

  const { error: snapshotError } = await supabase.from("store_lifecycle_preflights").insert({
    id,
    store_id: expectedStoreId,
    lifecycle_revision: lifecycle.revision,
    catalog_fingerprint: catalogFingerprint,
    snapshot_hash: snapshotHash,
    state,
    counts,
    blockers,
    holds: blockers.filter(
      (blocker) => blocker.code === "retention_hold" || blocker.code === "legal_hold",
    ),
    storage_summary: storage,
    actor_id: owner.actorId,
    expires_at: expiresAt,
  });
  fail(snapshotError, "保存店铺预检快照失败");

  return {
    id,
    store_id: expectedStoreId,
    store_name: requiredString((storeResult.data as DbRecord).name),
    lifecycle,
    state,
    counts,
    blockers,
    automatic_effects: {
      pending_invitations: pendingInvites,
      open_kiosk_sessions: openKiosk,
    },
    snapshot_hash: snapshotHash,
    expires_at: expiresAt,
  };
}

export async function getStoreLifecycleState(
  expectedStoreId: string,
  actor: AuditActor,
): Promise<StoreLifecycleState> {
  await assertPrimaryStoreOwnerForStore(expectedStoreId, actor);
  return readStoreLifecycle(getSupabaseAdmin(), expectedStoreId);
}

export async function getStoreLifecycleOperationStatus(
  expectedStoreId: string,
  operationId: string,
  actor: AuditActor,
): Promise<StoreLifecycleOperationStatus> {
  await assertPrimaryStoreOwnerForStore(expectedStoreId, actor);
  const supabase = getSupabaseAdmin();
  const { data, error } = await supabase
    .from("store_lifecycle_operations")
    .select("operation_id, store_id, kind, state, result_revision")
    .eq("operation_id", operationId)
    .eq("store_id", expectedStoreId)
    .maybeSingle();
  fail(error, "核对店铺操作结果失败");
  if (!data) {
    return { operation_id: operationId, store_id: expectedStoreId, state: "missing" };
  }
  const row = data as DbRecord;
  const state = requiredString(row.state);
  const kind = requiredString(row.kind);
  const projectedState =
    state === "completed" ? "completed" : state === "failed" ? "failed" : "running";
  const result: StoreLifecycleOperationStatus = {
    operation_id: operationId,
    store_id: expectedStoreId,
    ...(kind === "rename" || kind === "request_close" || kind === "restore" ? { kind } : {}),
    state: projectedState,
    ...(typeof row.result_revision === "number" ? { result_revision: row.result_revision } : {}),
    ...(projectedState === "completed"
      ? { lifecycle: await readStoreLifecycle(supabase, expectedStoreId) }
      : {}),
  };
  if (projectedState === "completed" && kind === "restore") {
    await setActiveStoreCookie(expectedStoreId);
    result.next_active_store_id = expectedStoreId;
  } else if (projectedState === "completed" && kind === "request_close") {
    const nextStore = (actor.stores ?? []).find(
      (store) =>
        store.id !== expectedStoreId && (!store.lifecycle || store.lifecycle.phase === "active"),
    );
    if (nextStore) {
      await setActiveStoreCookie(nextStore.id);
      result.next_active_store_id = nextStore.id;
    } else {
      await clearActiveStoreCookie();
      result.active_store_cleared = true;
    }
  }
  return result;
}

export async function readStoreLifecycle(
  supabase: ReturnType<typeof getSupabaseAdmin>,
  storeId: string,
): Promise<StoreLifecycleState> {
  const { data, error } = await supabase
    .from("store_lifecycles")
    .select(
      "store_id, phase, revision, close_requested_at, access_cutoff_at, archive_eligible_at, archived_at, purge_after, retention_until, legal_hold_until",
    )
    .eq("store_id", storeId)
    .maybeSingle();
  fail(error, "读取店铺生命周期失败");
  if (!data) throw new Error("店铺生命周期尚未初始化");
  const row = data as DbRecord;
  return {
    store_id: requiredString(row.store_id),
    phase: row.phase as StoreLifecycleState["phase"],
    revision: Number(row.revision),
    ...optionalIso("close_requested_at", row.close_requested_at),
    ...optionalIso("access_cutoff_at", row.access_cutoff_at),
    ...optionalIso("archive_eligible_at", row.archive_eligible_at),
    ...optionalIso("archived_at", row.archived_at),
    ...optionalIso("purge_after", row.purge_after),
    ...optionalIso("retention_until", row.retention_until),
    ...optionalIso("legal_hold_until", row.legal_hold_until),
  };
}

export async function issueStoreLifecycleChallenge(
  input: StoreLifecycleChallengeInput,
  actor: AuditActor,
): Promise<StoreLifecycleChallengeResult> {
  await assertLifecycleMutationsEnabled();
  const owner = ["restore", "request_purge", "confirm_purge"].includes(input.operationKind)
    ? await assertPrimaryStoreOwnerForStore(input.expectedStoreId, actor)
    : await assertPrimaryStoreOwner(actor);
  if (owner.storeId !== input.expectedStoreId) {
    throw new ForbiddenError("店铺上下文已经变化，请重新选择店铺");
  }
  assertRecentLifecycleAal2(actor);

  const supabase = getSupabaseAdmin();
  const lifecycle = await readStoreLifecycle(supabase, owner.storeId);
  if (lifecycle.revision !== input.expectedRevision) {
    throw new Error("店铺状态已更新，请刷新后重试");
  }
  const allowed =
    (input.operationKind === "rename" && lifecycle.phase === "active") ||
    (input.operationKind === "request_close" && lifecycle.phase === "active") ||
    (input.operationKind === "restore" &&
      (lifecycle.phase === "closing" || lifecycle.phase === "archived")) ||
    ((input.operationKind === "schedule_purge" || input.operationKind === "request_purge") &&
      lifecycle.phase === "archived") ||
    (input.operationKind === "confirm_purge" && lifecycle.phase === "archived");
  if (!allowed) throw new ForbiddenError("当前店铺状态不允许执行此操作");

  if (
    input.operationKind === "request_close" ||
    input.operationKind === "schedule_purge" ||
    input.operationKind === "request_purge" ||
    input.operationKind === "confirm_purge"
  ) {
    if (!input.preflightSnapshotHash) throw new Error("关闭店铺前需要有效安全预检");
    await assertEligiblePreflight(supabase, {
      storeId: owner.storeId,
      revision: input.expectedRevision,
      snapshotHash: input.preflightSnapshotHash,
    });
  }

  const now = new Date();
  const id = crypto.randomUUID();
  const expiresAt = new Date(now.getTime() + CHALLENGE_TTL_MS).toISOString();
  await supabase
    .from("store_lifecycle_challenges")
    .update({ status: "expired" })
    .eq("store_id", owner.storeId)
    .eq("actor_id", owner.actorId)
    .eq("operation_kind", input.operationKind)
    .eq("status", "issued");
  const { error } = await supabase.from("store_lifecycle_challenges").insert({
    id,
    store_id: owner.storeId,
    actor_id: owner.actorId,
    operation_kind: input.operationKind,
    lifecycle_revision: input.expectedRevision,
    preflight_snapshot_hash: input.preflightSnapshotHash ?? null,
    assurance_level: "aal2",
    status: "issued",
    expires_at: expiresAt,
  });
  fail(error, "签发店铺安全挑战失败");
  return {
    id,
    store_id: owner.storeId,
    operation_kind: input.operationKind,
    lifecycle_revision: input.expectedRevision,
    assurance_level: "aal2",
    expires_at: expiresAt,
  };
}

export async function renameStoreWorkspace(
  input: StoreRenameInput,
  actor: AuditActor,
): Promise<StoreLifecycleMutationResult> {
  return executeOwnerLifecycleRpc("repairdesk_rename_store_rpc", input, actor, {
    p_new_name: input.name,
    p_sync_customer_facing_name: input.syncCustomerFacingName,
  });
}

export async function requestStoreClose(
  input: StoreCloseInput,
  actor: AuditActor,
): Promise<StoreLifecycleMutationResult> {
  return executeOwnerLifecycleRpc("repairdesk_request_store_close_rpc", input, actor, {
    p_preflight_snapshot_hash: input.preflightSnapshotHash,
    p_confirmation_store_name: input.confirmationStoreName,
    p_confirmation_store_id_suffix: input.confirmationStoreIdSuffix,
    p_reason_code: input.reasonCode,
  });
}

export async function restoreStoreWorkspace(
  input: StoreRestoreInput,
  actor: AuditActor,
): Promise<StoreLifecycleMutationResult> {
  return executeOwnerLifecycleRpc("repairdesk_restore_store_rpc", input, actor, {}, true);
}

export async function getStorePurgeRequest(
  expectedStoreId: string,
  actor: AuditActor,
): Promise<StorePurgeRequest | null> {
  await assertPrimaryStoreOwnerForStore(expectedStoreId, actor);
  const purgeContractVersion = await readStorePurgeContractVersion();
  if (purgeContractVersion === null || purgeContractVersion < 3) return null;
  const supabase = getSupabaseAdmin();
  const { data, error } = await supabase
    .from("store_purge_requests")
    .select(
      "id, store_id, state, requested_at, cooling_until, export_job_id, purge_job_id, cancelled_at",
    )
    .eq("store_id", expectedStoreId)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  fail(error, "读取永久删除申请失败");
  if (!data) return null;
  const row = data as DbRecord;
  const exportJobId = requiredString(row.export_job_id);
  const purgeJobId = requiredString(row.purge_job_id);
  const [{ data: exportJob, error: exportError }, { data: purgeJob, error: purgeError }] =
    await Promise.all([
      supabase
        .from("store_export_jobs")
        .select("state, error_code")
        .eq("id", exportJobId)
        .eq("store_id", expectedStoreId)
        .maybeSingle(),
      purgeJobId
        ? supabase
            .from("store_purge_jobs")
            .select("state, store_id, purge_after, destructive_step_started, last_error_code")
            .eq("id", purgeJobId)
            .eq("store_id", expectedStoreId)
            .maybeSingle()
        : Promise.resolve({ data: null, error: null }),
    ]);
  fail(exportError, "读取永久删除导出状态失败");
  fail(purgeError, "读取永久删除任务状态失败");
  const exportRow = (exportJob ?? {}) as DbRecord;
  const purgeRow = (purgeJob ?? {}) as DbRecord;
  const storedState = requiredString(row.state) as StorePurgeRequest["state"];
  const exportState = requiredString(exportRow.state) as StorePurgeRequest["export_state"];
  const purgeJobState = requiredString(purgeRow.state);
  const coolingComplete = new Date(requiredString(row.cooling_until)).getTime() <= Date.now();
  const derivedState = projectStorePurgeRequestState({
    storedState,
    exportState,
    purgeJobState,
    coolingComplete,
  });
  return {
    request_id: requiredString(row.id),
    store_id: requiredString(row.store_id),
    state: derivedState,
    requested_at: requiredString(row.requested_at),
    cooling_until: requiredString(row.cooling_until),
    export_job_id: exportJobId,
    ...(exportState ? { export_state: exportState } : {}),
    ...(purgeJobId ? { purge_job_id: purgeJobId } : {}),
    ...(requiredString(purgeRow.purge_after)
      ? { purge_after: requiredString(purgeRow.purge_after) }
      : {}),
    ...(typeof purgeRow.destructive_step_started === "boolean"
      ? { destructive_step_started: purgeRow.destructive_step_started }
      : {}),
    ...(requiredString(row.cancelled_at) ? { cancelled_at: requiredString(row.cancelled_at) } : {}),
    ...(requiredString(purgeRow.last_error_code) || requiredString(exportRow.error_code)
      ? {
          failure_code:
            requiredString(purgeRow.last_error_code) || requiredString(exportRow.error_code),
        }
      : {}),
  };
}

export async function requestStorePurge(
  input: StorePurgeRequestInput,
  actor: AuditActor,
): Promise<StorePurgeRequest> {
  const owner = await assertPrimaryStoreOwnerForStore(input.expectedStoreId, actor);
  const target = await readAuthoritativePurgeTarget(owner.storeId);
  assertStorePurgeConfirmation(input.confirmationPhrase, target.id, "request_purge");
  if (!isStoreLifecyclePurgeSchedulingEnabled()) {
    throw new ForbiddenError("店铺永久删除申请暂未启用");
  }
  await assertStorePurgeContractEnabled();
  const { data, error } = await getSupabaseAdmin().rpc("repairdesk_request_store_purge_rpc", {
    p_store_id: owner.storeId,
    p_actor_id: owner.actorId,
    p_expected_revision: input.expectedRevision,
    p_challenge_id: input.reauthChallengeId,
    p_preflight_snapshot_hash: input.preflightSnapshotHash,
    p_confirmation_store_name: target.name,
    p_confirmation_store_id_suffix: getStorePurgeStoreIdSuffix(target.id).toLowerCase(),
  });
  if (error) throw lifecycleRpcError(error);
  const result = (data ?? {}) as DbRecord;
  return {
    request_id: requiredString(result.request_id),
    store_id: requiredString(result.store_id),
    state: requiredString(result.state) as StorePurgeRequest["state"],
    requested_at: requiredString(result.requested_at),
    cooling_until: requiredString(result.cooling_until),
    export_job_id: requiredString(result.export_job_id),
    export_state: "pending",
  };
}

export async function cancelStorePurgeRequest(
  input: StorePurgeCancelInput,
  actor: AuditActor,
): Promise<StorePurgeRequest> {
  const owner = await assertPrimaryStoreOwnerForStore(input.expectedStoreId, actor);
  await assertStorePurgeContractEnabled();
  const { data, error } = await getSupabaseAdmin().rpc(
    "repairdesk_cancel_store_purge_request_rpc",
    {
      p_store_id: owner.storeId,
      p_actor_id: owner.actorId,
      p_request_id: input.requestId,
    },
  );
  if (error) throw lifecycleRpcError(error);
  const result = (data ?? {}) as DbRecord;
  return {
    request_id: requiredString(result.request_id),
    store_id: requiredString(result.store_id),
    state: "cancelled",
    requested_at: "",
    cooling_until: "",
    export_job_id: "",
    cancelled_at: requiredString(result.cancelled_at),
  };
}

export async function confirmStorePurgeRequest(
  input: StorePurgeConfirmInput,
  actor: AuditActor,
): Promise<StorePurgeRequest> {
  const owner = await assertPrimaryStoreOwnerForStore(input.expectedStoreId, actor);
  const target = await readAuthoritativePurgeTarget(owner.storeId);
  assertStorePurgeConfirmation(input.confirmationPhrase, target.id, "confirm_purge");
  if (!isStoreLifecyclePurgeSchedulingEnabled()) {
    throw new ForbiddenError("店铺永久删除申请暂未启用");
  }
  await assertStorePurgeContractEnabled();
  const { data, error } = await getSupabaseAdmin().rpc(
    "repairdesk_confirm_store_purge_request_rpc",
    {
      p_store_id: owner.storeId,
      p_actor_id: owner.actorId,
      p_request_id: input.requestId,
      p_expected_revision: input.expectedRevision,
      p_challenge_id: input.reauthChallengeId,
      p_preflight_snapshot_hash: input.preflightSnapshotHash,
      p_confirmation_store_name: target.name,
      p_confirmation_store_id_suffix: getStorePurgeStoreIdSuffix(target.id).toLowerCase(),
    },
  );
  if (error) throw lifecycleRpcError(error);
  const result = (data ?? {}) as DbRecord;
  return {
    request_id: requiredString(result.request_id),
    store_id: requiredString(result.store_id),
    state: "scheduled",
    requested_at: requiredString(result.requested_at),
    cooling_until: requiredString(result.cooling_until),
    export_job_id: requiredString(result.export_job_id),
    export_state: "restore_verified",
    purge_job_id: requiredString(result.purge_job_id),
    purge_after: requiredString(result.purge_after),
    destructive_step_started: false,
  };
}

export async function scheduleStorePurge(
  input: StorePurgeScheduleInput,
  actor: AuditActor,
): Promise<StoreLifecycleMutationResult & { purge_job_id: string; purge_after: string }> {
  if (!isStoreLifecyclePurgeSchedulingEnabled()) {
    throw new ForbiddenError("店铺永久清除排程未启用");
  }
  await assertLifecycleMutationsEnabled();
  const owner = await assertPrimaryStoreOwner(actor);
  if (owner.storeId !== input.expectedStoreId) {
    throw new ForbiddenError("店铺上下文已经变化，请重新选择店铺");
  }
  const supabase = getSupabaseAdmin();
  const { data, error } = await supabase.rpc("repairdesk_schedule_store_purge_rpc", {
    p_store_id: owner.storeId,
    p_actor_id: owner.actorId,
    p_operation_id: input.operationId,
    p_expected_revision: input.expectedRevision,
    p_challenge_id: input.reauthChallengeId,
    p_preflight_snapshot_hash: input.preflightSnapshotHash,
    p_export_job_id: input.exportJobId,
    p_approval_ref_hash: input.approvalRefHash,
    p_purge_after: input.purgeAfter,
  });
  if (error) throw lifecycleRpcError(error);
  const result = (data ?? {}) as DbRecord;
  return {
    operation_id: requiredString(result.operation_id) || input.operationId,
    replayed: result.replayed === true,
    lifecycle: await readStoreLifecycle(supabase, owner.storeId),
    purge_job_id: requiredString(result.purge_job_id),
    purge_after: requiredString(result.purge_after),
  };
}

export async function prepareStoreExport(
  input: StoreExportPrepareInput,
  actor: AuditActor,
): Promise<StoreExportPrepareResult> {
  await assertLifecycleMutationsEnabled();
  const owner = await assertPrimaryStoreOwner(actor);
  if (owner.storeId !== input.expectedStoreId) {
    throw new ForbiddenError("店铺上下文已经变化，请重新选择店铺");
  }
  const supabase = getSupabaseAdmin();
  const lifecycle = await readStoreLifecycle(supabase, owner.storeId);
  if (lifecycle.phase !== "archived") {
    throw new ForbiddenError("只有已归档店铺可以准备完整导出");
  }
  const { data: preflight, error: preflightError } = await supabase
    .from("store_lifecycle_preflights")
    .select("id")
    .eq("store_id", owner.storeId)
    .eq("lifecycle_revision", lifecycle.revision)
    .eq("snapshot_hash", input.preflightSnapshotHash)
    .eq("state", "eligible")
    .gt("expires_at", new Date().toISOString())
    .maybeSingle();
  fail(preflightError, "验证店铺导出预检失败");
  if (!preflight) throw new Error("完整导出需要当前生命周期版本的有效预检");
  const exportJobId = crypto.randomUUID();
  const { error } = await supabase.from("store_export_jobs").insert({
    id: exportJobId,
    store_id: owner.storeId,
    preflight_id: requiredString((preflight as DbRecord).id),
    state: "pending",
    schema_version: input.schemaVersion,
    app_version: input.appVersion,
    actor_id: owner.actorId,
  });
  fail(error, "创建店铺完整导出任务失败");
  return { export_job_id: exportJobId, store_id: owner.storeId, state: "pending" };
}

export async function finalizeDueStoreArchive(input: {
  storeId: string;
  expectedRevision: number;
  operationId: string;
  workerId: string;
}) {
  await assertLifecycleMutationsEnabled();
  const { data, error } = await getSupabaseAdmin().rpc("repairdesk_finalize_store_archive_rpc", {
    p_store_id: input.storeId,
    p_operation_id: input.operationId,
    p_expected_revision: input.expectedRevision,
    p_worker_id: input.workerId,
  });
  if (error) throw lifecycleRpcError(error);
  return data;
}

async function executeOwnerLifecycleRpc(
  rpcName:
    | "repairdesk_rename_store_rpc"
    | "repairdesk_request_store_close_rpc"
    | "repairdesk_restore_store_rpc",
  input: StoreRenameInput | StoreCloseInput | StoreRestoreInput,
  actor: AuditActor,
  extra: Record<string, unknown>,
  allowRecoveryTarget = false,
): Promise<StoreLifecycleMutationResult> {
  await assertLifecycleMutationsEnabled();
  const owner = allowRecoveryTarget
    ? await assertPrimaryStoreOwnerForStore(input.expectedStoreId, actor)
    : await assertPrimaryStoreOwner(actor);
  if (owner.storeId !== input.expectedStoreId) {
    throw new ForbiddenError("店铺上下文已经变化，请重新选择店铺");
  }
  const supabase = getSupabaseAdmin();
  const { data, error } = await supabase.rpc(rpcName, {
    p_store_id: owner.storeId,
    p_actor_id: owner.actorId,
    p_operation_id: input.operationId,
    p_expected_revision: input.expectedRevision,
    p_challenge_id: input.reauthChallengeId,
    ...extra,
  });
  if (error) throw lifecycleRpcError(error);
  const result = (data ?? {}) as DbRecord;
  const lifecycle = await readStoreLifecycle(supabase, owner.storeId);
  const response: StoreLifecycleMutationResult = {
    operation_id: requiredString(result.operation_id) || input.operationId,
    replayed: result.replayed === true,
    lifecycle,
    ...(typeof result.store_name === "string"
      ? {
          store: {
            id: owner.storeId,
            name: result.store_name,
            slug: actor.stores?.find((store) => store.id === owner.storeId)?.slug ?? "store",
            role: "owner" as const,
            status: "active" as const,
          },
        }
      : {}),
  };
  if (rpcName === "repairdesk_request_store_close_rpc") {
    const nextStore = (actor.stores ?? []).find(
      (store) =>
        store.id !== owner.storeId && (!store.lifecycle || store.lifecycle.phase === "active"),
    );
    if (nextStore) {
      await setActiveStoreCookie(nextStore.id);
      response.next_active_store_id = nextStore.id;
    } else {
      await clearActiveStoreCookie();
      response.active_store_cleared = true;
    }
  } else if (rpcName === "repairdesk_restore_store_rpc") {
    await setActiveStoreCookie(owner.storeId);
    response.next_active_store_id = owner.storeId;
  }
  return response;
}

async function assertEligiblePreflight(
  supabase: ReturnType<typeof getSupabaseAdmin>,
  input: { storeId: string; revision: number; snapshotHash: string },
) {
  const { data, error } = await supabase
    .from("store_lifecycle_preflights")
    .select("id")
    .eq("store_id", input.storeId)
    .eq("lifecycle_revision", input.revision)
    .eq("snapshot_hash", input.snapshotHash)
    .eq("state", "eligible")
    .gt("expires_at", new Date().toISOString())
    .maybeSingle();
  fail(error, "验证店铺预检快照失败");
  if (!data) throw new Error("店铺安全预检已失效或仍有阻断，请重新预检");
}

async function readAuthoritativePurgeTarget(storeId: string) {
  const { data, error } = await getSupabaseAdmin()
    .from("stores")
    .select("id, name")
    .eq("id", storeId)
    .maybeSingle();
  fail(error, "读取删除目标店铺身份失败");
  if (!data) throw new ForbiddenError("店铺不存在或不可用");
  const row = data as DbRecord;
  return {
    id: requiredString(row.id),
    name: requiredString(row.name),
  };
}

function assertStorePurgeConfirmation(
  confirmationPhrase: string,
  storeId: string,
  operation: StorePurgeConfirmationOperation,
) {
  if (confirmationPhrase !== getStorePurgeConfirmationPhrase(storeId, operation)) {
    throw new ForbiddenError("删除确认提示词不正确，请按页面提示逐字输入");
  }
}

async function readStorePurgeContractVersion() {
  const { data, error } = await getSupabaseAdmin().rpc(
    "repairdesk_store_lifecycle_contract_version",
  );
  if (error) return null;
  const version = Number(data);
  return Number.isFinite(version) ? version : null;
}

async function assertStorePurgeContractEnabled() {
  if (!isStoreLifecycleMutationSafeEnabled()) {
    throw new ForbiddenError("店铺保护尚未准备完成，当前不能进行永久删除操作");
  }
  const version = await readStorePurgeContractVersion();
  if (version === null || version < 3) {
    throw new ForbiddenError("店铺保护尚未安装完成，当前不能进行永久删除操作");
  }
}

export function projectStorePurgeRequestState({
  storedState,
  exportState,
  purgeJobState,
  coolingComplete,
}: {
  storedState: StorePurgeRequest["state"];
  exportState?: StorePurgeRequest["export_state"];
  purgeJobState: string;
  coolingComplete: boolean;
}): StorePurgeRequest["state"] {
  if (storedState === "cancelled" || storedState === "completed") return storedState;
  if (purgeJobState === "completed") return "completed";
  if (purgeJobState === "running") return "purging";
  if (purgeJobState === "retry" || purgeJobState === "failed") return "failed";
  if (purgeJobState === "queued") return "scheduled";
  if (storedState === "cooling" && exportState === "failed") return "failed";
  if (storedState === "cooling" && exportState === "restore_verified" && coolingComplete) {
    return "ready_for_confirmation";
  }
  if (storedState === "cooling" && coolingComplete) return "preparing_export";
  return storedState;
}

async function assertLifecycleMutationsEnabled() {
  if (!isStoreLifecycleMutationSafeEnabled()) {
    throw new ForbiddenError("店铺保护尚未准备完成，当前不能修改店铺状态");
  }
  const { data, error } = await getSupabaseAdmin().rpc(
    "repairdesk_store_lifecycle_contract_version",
  );
  if (error || Number(data) < 2) {
    throw new ForbiddenError("店铺保护尚未安装完成，当前不能修改店铺状态");
  }
}

function lifecycleRpcError(error: { message?: string }) {
  const message = error.message ?? "STORE_LIFECYCLE_OPERATION_FAILED";
  if (message.includes("STORE_LIFECYCLE_REAUTH_REQUIRED")) {
    return new ForbiddenError("安全挑战已失效，请重新完成双重验证");
  }
  if (message.includes("STORE_LIFECYCLE_FORBIDDEN")) {
    return new ForbiddenError("只有当前店铺的主店主可以执行此操作");
  }
  if (message.includes("STORE_LIFECYCLE_VERSION_CONFLICT")) {
    return new Error("店铺状态已更新，请刷新后重试");
  }
  if (message.includes("STORE_LIFECYCLE_IDEMPOTENCY_CONFLICT")) {
    return new Error("操作编号已用于不同请求，请重新开始");
  }
  if (message.includes("STORE_LIFECYCLE_OPERATION_IN_PROGRESS")) {
    return new Error("操作正在服务器处理中，请核对原操作结果，不要重复提交");
  }
  if (message.includes("STORE_LIFECYCLE_BLOCKED")) {
    return new Error("店铺仍有安全阻断，无法进入关闭流程");
  }
  return new Error("店铺生命周期操作失败，请刷新后重试");
}

async function countStoreRows(
  supabase: ReturnType<typeof getSupabaseAdmin>,
  table: string,
  storeId: string,
) {
  return countRowsWithFilter(supabase, table, storeId, (query) => query);
}

async function countRowsWithFilter(
  supabase: ReturnType<typeof getSupabaseAdmin>,
  table: string,
  storeId: string,
  filter: (query: StoreCountQuery) => StoreCountQuery,
) {
  const query = supabase
    .from(table)
    .select("*", { count: "exact", head: true })
    .eq("store_id", storeId);
  const { count, error } = await filter(query as unknown as StoreCountQuery);
  fail(error, `读取 ${table} 预检计数失败`);
  return count ?? 0;
}

async function countOpenOrders(supabase: ReturnType<typeof getSupabaseAdmin>, storeId: string) {
  const { count, error } = await supabase
    .from("repair_orders")
    .select("*", { count: "exact", head: true })
    .eq("store_id", storeId)
    .not("status", "in", "(completed,cancelled)")
    .or("exception_status.neq.cancelled,exception_status.is.null");
  fail(error, "读取开放工单计数失败");
  return count ?? 0;
}

async function readUnsettledBalance(
  supabase: ReturnType<typeof getSupabaseAdmin>,
  storeId: string,
) {
  const { data, error } = await supabase
    .from("repair_orders")
    .select("balance_amount")
    .eq("store_id", storeId)
    .gt("balance_amount", 0);
  fail(error, "读取未结余额摘要失败");
  const balances = ((data ?? []) as DbRecord[])
    .map((row) => Number(row.balance_amount))
    .filter((value) => Number.isFinite(value) && value > 0);
  return {
    count: balances.length,
    amount: Number(balances.reduce((total, value) => total + value, 0).toFixed(2)),
  };
}

async function readPendingInviteCount(
  supabase: ReturnType<typeof getSupabaseAdmin>,
  storeId: string,
) {
  const [invitations, links] = await Promise.all([
    countRowsWithFilter(supabase, "store_invitations", storeId, (query) =>
      query.eq("status", "invited"),
    ),
    countRowsWithFilter(supabase, "store_invite_links", storeId, (query) =>
      query.eq("status", "active"),
    ),
  ]);
  return invitations + links;
}

async function buildStorageSummary(supabase: ReturnType<typeof getSupabaseAdmin>, storeId: string) {
  const objects: string[] = [];
  let objectCount = 0;
  let totalBytes = 0;
  try {
    for (const bucket of STORAGE_BUCKETS) {
      const pending = [storeId];
      while (pending.length > 0) {
        const prefix = pending.pop()!;
        let offset = 0;
        for (;;) {
          const { data, error } = await supabase.storage
            .from(bucket)
            .list(prefix, { limit: 100, offset, sortBy: { column: "name", order: "asc" } });
          if (error) throw error;
          const entries = data ?? [];
          for (const entry of entries) {
            const path = `${prefix}/${entry.name}`;
            const size = Number(entry.metadata?.size ?? 0);
            if (entry.id || entry.metadata) {
              objectCount += 1;
              totalBytes += Number.isFinite(size) ? size : 0;
              objects.push(`${bucket}:${path}:${Number.isFinite(size) ? size : 0}`);
              if (objectCount > STORAGE_OBJECT_LIMIT) throw new Error("storage_object_limit");
            } else {
              pending.push(path);
            }
          }
          if (entries.length < 100) break;
          offset += entries.length;
        }
      }
    }
    return {
      complete: true,
      object_count: objectCount,
      total_bytes: totalBytes,
      manifest_sha256: sha256(objects.sort().join("\n")),
    };
  } catch {
    return {
      complete: false,
      object_count: objectCount,
      total_bytes: totalBytes,
      manifest_sha256: null,
    };
  }
}

function optionalIso<Key extends string>(key: Key, value: unknown): Partial<Record<Key, string>> {
  return typeof value === "string" && value ? ({ [key]: value } as Record<Key, string>) : {};
}

function stableJson(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(stableJson).join(",")}]`;
  if (value && typeof value === "object") {
    return `{${Object.entries(value as Record<string, unknown>)
      .sort(([left], [right]) => left.localeCompare(right))
      .map(([key, entry]) => `${JSON.stringify(key)}:${stableJson(entry)}`)
      .join(",")}}`;
  }
  return JSON.stringify(value);
}

function sha256(value: string) {
  return createHash("sha256").update(value).digest("hex");
}

type StoreCountQuery = PromiseLike<{ count: number | null; error: { message: string } | null }> & {
  eq: (column: string, value: unknown) => StoreCountQuery;
  in: (column: string, values: readonly unknown[]) => StoreCountQuery;
};
