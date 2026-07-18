import { z } from "zod";

import type { AuditActor } from "@/lib/repairdesk/types";
import { assertStoreLifecycleActive } from "@/features/stores/server/store-lifecycle-access";
import { ForbiddenError } from "@/server/auth-context";
import { getSupabaseAdmin } from "@/server/supabase";

import {
  assertRepairDeskOfflineOperationMetadataSafe,
  assertRepairDeskOfflineOrderCreatePermission,
  createRepairDeskOfflineRequestHash,
  mapRepairDeskOfflineServerResultCodeToHandlerResult,
  parseRepairDeskOfflineOperationResponseSummarySafe,
  repairDeskOfflineOrderCreateSyncSchema,
  repairDeskOfflineServerResultCodes,
} from "./offline-sync-contract";
import type {
  RepairDeskOfflineHandlerResult,
  RepairDeskOfflineOperationResponseSummary,
  RepairDeskOfflineOrderCreateSyncInput,
  RepairDeskOfflineServerResultCode,
} from "./offline-sync-contract";
import { isRepairDeskOfflineSyncEnabled } from "../model/offline-sync-feature";

const rpcResultSchema = z
  .object({
    resultCode: z.enum(repairDeskOfflineServerResultCodes),
    responseSummary: z.unknown().optional(),
  })
  .strict();

export type RepairDeskOfflineOrderCreateSyncResult = {
  handlerResult: RepairDeskOfflineHandlerResult;
  resultCode: RepairDeskOfflineServerResultCode;
  responseSummary?: RepairDeskOfflineOperationResponseSummary;
  auditMetadata: Record<string, unknown>;
};

type OfflineCreateRpc = (
  input: RepairDeskOfflineOrderCreateSyncInput,
  context: { storeId: string; actorId: string; requestHash: string },
) => Promise<unknown>;

export async function syncRepairDeskOfflineOrderCreate(
  input: unknown,
  actor: AuditActor,
  options: {
    getSecret?: () => string;
    rpc?: OfflineCreateRpc;
    isEnabled?: () => boolean;
    assertLifecycleActive?: (storeId: string) => Promise<void>;
  } = {},
): Promise<RepairDeskOfflineOrderCreateSyncResult> {
  if (!(options.isEnabled ?? isRepairDeskOfflineSyncEnabled)()) {
    throw new ForbiddenError("离线工单同步尚未启用");
  }
  const parsed = repairDeskOfflineOrderCreateSyncSchema.parse(input);
  assertRepairDeskOfflineOrderCreatePermission(actor);
  if (!actor.id || !actor.storeId || actor.isSystem) {
    throw new ForbiddenError("离线同步需要已登录的店铺员工身份");
  }
  if (parsed.expectedStoreId !== actor.storeId) {
    throw new ForbiddenError("离线工单需要切回原店铺后再同步");
  }
  await (options.assertLifecycleActive ?? assertStoreLifecycleActive)(actor.storeId);

  const secret = (options.getSecret ?? readOfflineSyncSecret)();
  const requestHash = createRepairDeskOfflineRequestHash(parsed, secret);
  const rpcResult = await (options.rpc ?? executeOfflineCreateRpc)(parsed, {
    storeId: actor.storeId,
    actorId: actor.id,
    requestHash,
  });
  const result = rpcResultSchema.parse(rpcResult);
  const responseSummary = parseRepairDeskOfflineOperationResponseSummarySafe(
    result.responseSummary,
  );
  const handlerResult = mapRepairDeskOfflineServerResultCodeToHandlerResult(
    result.resultCode,
    responseSummary,
  );
  const auditMetadata = {
    operationId: parsed.operationId,
    operationType: "order_create",
    requestHash,
    resultCode: result.resultCode,
    target: responseSummary?.serverOrderId
      ? { entityType: "repair_order", entityId: responseSummary.serverOrderId }
      : undefined,
  };
  assertRepairDeskOfflineOperationMetadataSafe(auditMetadata);

  return {
    handlerResult,
    resultCode: result.resultCode,
    responseSummary,
    auditMetadata,
  };
}

function readOfflineSyncSecret() {
  return process.env.REPAIRDESK_OFFLINE_SYNC_HMAC_SECRET ?? "";
}

async function executeOfflineCreateRpc(
  input: RepairDeskOfflineOrderCreateSyncInput,
  context: { storeId: string; actorId: string; requestHash: string },
) {
  const { data, error } = await getSupabaseAdmin().rpc("repairdesk_offline_sync_order_create_rpc", {
    p_store_id: context.storeId,
    p_actor_id: context.actorId,
    p_operation_id: input.operationId,
    p_request_hash: context.requestHash,
    p_payload: input,
  });
  if (error) throw new Error("离线工单同步失败，请稍后重试");
  return data;
}
