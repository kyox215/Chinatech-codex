import { z } from "zod";

import type { AuditActor } from "@/lib/repairdesk/types";
import { ForbiddenError } from "@/server/auth-context";

import {
  assertRepairDeskOfflineOperationMetadataSafe,
  assertRepairDeskOfflineOrderCreatePermission,
  assertRepairDeskOfflineOrderUpdatePermission,
  createRepairDeskOfflineRequestHash,
  mapRepairDeskOfflineServerResultCodeToHandlerResult,
  parseRepairDeskOfflineOperationErrorCodeSafe,
  parseRepairDeskOfflineOperationResponseSummarySafe,
  repairDeskOfflineOrderCreateSyncSchema,
  repairDeskOfflineOrderUpdateSyncSchema,
  resolveRepairDeskOfflineOperationReplay,
} from "./offline-sync-contract";
import type {
  RepairDeskOfflineOperationResponseSummary,
  RepairDeskOfflineOperationStatus,
  RepairDeskOfflineOperationType,
  RepairDeskOfflineOrderCreateSyncInput,
  RepairDeskOfflineOrderUpdateSyncInput,
  RepairDeskOfflineServerResultCode,
  RepairDeskOfflineStoredOperation,
} from "./offline-sync-contract";

export type RepairDeskOfflineOperationClaimInput = {
  storeId: string;
  actorId: string;
  operationType: RepairDeskOfflineOperationType;
  operationId: string;
  requestHash: string;
  nowIso: string;
};

export type RepairDeskOfflineOperationClaimResult =
  | { status: "claimed" }
  | { status: "existing"; operation: RepairDeskOfflineStoredOperation };

export type RepairDeskOfflineOperationCompletionInput = RepairDeskOfflineOperationClaimInput & {
  status: RepairDeskOfflineOperationStatus;
  resultCode: RepairDeskOfflineServerResultCode;
  responseSummary?: RepairDeskOfflineOperationResponseSummary;
  targetEntityType?: "repair_order";
  targetEntityId?: string;
  errorCode?: string;
};

export type RepairDeskOfflineOperationStorePort = {
  claimOperation(
    input: RepairDeskOfflineOperationClaimInput,
  ): Promise<RepairDeskOfflineOperationClaimResult>;
  completeOperation(input: RepairDeskOfflineOperationCompletionInput): Promise<void>;
};

export type RepairDeskOfflinePreflightResult =
  | { ok: true; scopeSatisfied?: boolean }
  | {
      ok: false;
      resultCode: Extract<
        RepairDeskOfflineServerResultCode,
        "needs_review" | "blocked_operation" | "stale_version" | "forbidden"
      >;
      errorCode?: string;
    };

export type RepairDeskOfflineWriteResult = {
  resultCode: RepairDeskOfflineServerResultCode;
  responseSummary?: RepairDeskOfflineOperationResponseSummary;
  targetEntityId?: string;
  errorCode?: string;
};

export type RepairDeskOfflineSyncServiceResult = {
  operationId: string;
  operationType: RepairDeskOfflineOperationType;
  requestHash?: string;
  resultCode: RepairDeskOfflineServerResultCode;
  handlerResult: ReturnType<typeof mapRepairDeskOfflineServerResultCodeToHandlerResult>;
  responseSummary?: RepairDeskOfflineOperationResponseSummary;
  auditMetadata: Record<string, unknown>;
};

export type RepairDeskOfflineSyncServicePorts = {
  operationStore: RepairDeskOfflineOperationStorePort;
  getRequestHashSecret(): string;
  now(): string;
  validateCreateRelationships(
    input: RepairDeskOfflineOrderCreateSyncInput,
    actor: AuditActor,
  ): Promise<RepairDeskOfflinePreflightResult>;
  validateUpdateTarget(
    input: RepairDeskOfflineOrderUpdateSyncInput,
    actor: AuditActor,
  ): Promise<RepairDeskOfflinePreflightResult>;
  executeCreate(
    input: RepairDeskOfflineOrderCreateSyncInput,
    actor: AuditActor,
  ): Promise<RepairDeskOfflineWriteResult>;
  executeUpdate(
    input: RepairDeskOfflineOrderUpdateSyncInput,
    actor: AuditActor,
  ): Promise<RepairDeskOfflineWriteResult>;
};

export type RepairDeskOfflineSyncService = {
  syncOrderCreate(input: unknown, actor: AuditActor): Promise<RepairDeskOfflineSyncServiceResult>;
  syncOrderUpdate(input: unknown, actor: AuditActor): Promise<RepairDeskOfflineSyncServiceResult>;
};

export function createRepairDeskOfflineSyncService(
  ports: RepairDeskOfflineSyncServicePorts,
): RepairDeskOfflineSyncService {
  return {
    async syncOrderCreate(input, actor) {
      const parsed = repairDeskOfflineOrderCreateSyncSchema.parse(input);
      assertRepairDeskOfflineOrderCreatePermission(actor);
      return runWithOperationClaim({
        actor,
        operationType: "order_create",
        parsed,
        ports,
        execute: async () => {
          const relationships = await ports.validateCreateRelationships(parsed, actor);
          if (!relationships.ok) return resultFromPreflight(relationships);
          return ports.executeCreate(parsed, actor);
        },
      });
    },
    async syncOrderUpdate(input, actor) {
      const parsed = repairDeskOfflineOrderUpdateSyncSchema.parse(input);
      return runWithOperationClaim({
        actor,
        operationType: "order_update",
        parsed,
        ports,
        execute: async () => {
          const target = await ports.validateUpdateTarget(parsed, actor);
          if (!target.ok) return resultFromPreflight(target);
          assertRepairDeskOfflineOrderUpdatePermission(actor, parsed.payload.changes, {
            scopeSatisfied: target.scopeSatisfied,
          });
          return ports.executeUpdate(parsed, actor);
        },
      });
    },
  };
}

async function runWithOperationClaim({
  actor,
  operationType,
  parsed,
  ports,
  execute,
}: {
  actor: AuditActor;
  operationType: RepairDeskOfflineOperationType;
  parsed: RepairDeskOfflineOrderCreateSyncInput | RepairDeskOfflineOrderUpdateSyncInput;
  ports: RepairDeskOfflineSyncServicePorts;
  execute: () => Promise<RepairDeskOfflineWriteResult>;
}): Promise<RepairDeskOfflineSyncServiceResult> {
  const identity = requireOfflineActorIdentity(actor);
  const requestHash = createRepairDeskOfflineRequestHash(parsed, ports.getRequestHashSecret());
  const claimInput: RepairDeskOfflineOperationClaimInput = {
    storeId: identity.storeId,
    actorId: identity.actorId,
    operationType,
    operationId: parsed.operationId,
    requestHash,
    nowIso: ports.now(),
  };

  const claim = await ports.operationStore.claimOperation(claimInput);
  if (claim.status === "existing") {
    const replay = resolveRepairDeskOfflineOperationReplay(claim.operation, requestHash);
    const resultCode =
      replay.decision === "start" ? "retryable_error" : (replay.resultCode ?? "retryable_error");
    const responseSummary = replay.decision === "replay" ? replay.responseSummary : undefined;
    return buildServiceResult({
      operationId: parsed.operationId,
      operationType,
      requestHash,
      resultCode,
      responseSummary,
    });
  }

  try {
    const write = await execute();
    const responseSummary = parseRepairDeskOfflineOperationResponseSummarySafe(
      write.responseSummary,
    );
    const errorCode = parseRepairDeskOfflineOperationErrorCodeSafe(write.errorCode);
    await ports.operationStore.completeOperation({
      ...claimInput,
      status: operationStatusFromResultCode(write.resultCode),
      resultCode: write.resultCode,
      responseSummary,
      targetEntityType: write.targetEntityId ? "repair_order" : undefined,
      targetEntityId: write.targetEntityId,
      errorCode,
    });
    return buildServiceResult({
      operationId: parsed.operationId,
      operationType,
      requestHash,
      resultCode: write.resultCode,
      responseSummary,
    });
  } catch (error) {
    const resultCode = error instanceof ForbiddenError ? "forbidden" : "retryable_error";
    await ports.operationStore.completeOperation({
      ...claimInput,
      status: operationStatusFromResultCode(resultCode),
      resultCode,
      errorCode: resultCode,
    });
    return buildServiceResult({
      operationId: parsed.operationId,
      operationType,
      requestHash,
      resultCode,
    });
  }
}

function requireOfflineActorIdentity(actor: AuditActor): { actorId: string; storeId: string } {
  if (!actor.id || !actor.storeId) {
    throw new ForbiddenError("Offline sync requires an authenticated store actor.");
  }
  return { actorId: actor.id, storeId: actor.storeId };
}

function resultFromPreflight(result: Extract<RepairDeskOfflinePreflightResult, { ok: false }>) {
  return {
    resultCode: result.resultCode,
    errorCode: result.errorCode,
  } satisfies RepairDeskOfflineWriteResult;
}

function operationStatusFromResultCode(
  resultCode: RepairDeskOfflineServerResultCode,
): RepairDeskOfflineOperationStatus {
  if (resultCode === "synced" || resultCode === "idempotent_replay") return "succeeded";
  if (resultCode === "idempotency_conflict" || resultCode === "stale_version") return "conflict";
  if (
    resultCode === "needs_review" ||
    resultCode === "blocked_operation" ||
    resultCode === "unauthorized" ||
    resultCode === "forbidden"
  ) {
    return "blocked";
  }
  return "failed";
}

function buildServiceResult({
  operationId,
  operationType,
  requestHash,
  resultCode,
  responseSummary,
}: {
  operationId: string;
  operationType: RepairDeskOfflineOperationType;
  requestHash?: string;
  resultCode: RepairDeskOfflineServerResultCode;
  responseSummary?: RepairDeskOfflineOperationResponseSummary;
}): RepairDeskOfflineSyncServiceResult {
  const auditMetadata = {
    operationId,
    operationType,
    requestHash,
    resultCode,
    target: responseSummary?.serverOrderId
      ? { entityType: "repair_order", entityId: responseSummary.serverOrderId }
      : undefined,
  };
  assertRepairDeskOfflineOperationMetadataSafe(auditMetadata);

  return {
    operationId,
    operationType,
    requestHash,
    resultCode,
    handlerResult: mapRepairDeskOfflineServerResultCodeToHandlerResult(resultCode, responseSummary),
    responseSummary,
    auditMetadata,
  };
}

export function parseRepairDeskOfflineSyncServiceError(error: unknown): {
  status: number;
  body: { code: RepairDeskOfflineServerResultCode; message: string };
} {
  if (error instanceof ForbiddenError) {
    return { status: 403, body: { code: "forbidden", message: "Offline sync is not allowed." } };
  }
  if (error instanceof z.ZodError) {
    return {
      status: 400,
      body: { code: "blocked_operation", message: "Offline sync payload is invalid." },
    };
  }
  return {
    status: 500,
    body: { code: "retryable_error", message: "Offline sync failed. Please retry later." },
  };
}
