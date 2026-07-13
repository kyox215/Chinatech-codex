import { createHash } from "node:crypto";
import { Buffer } from "node:buffer";

import { ORDER_DATA_PARSER_VERSION } from "@/features/orders/model/order-data-contract";
import { OrderDataApplyRepositoryError } from "@/features/orders/model/order-data-errors";
import { assertOrderDataAccess } from "@/features/orders/server/order-data-access";
import {
  normalizeOrderDataRows,
  toKeyedOrderRows,
} from "@/features/orders/server/order-data-import-normalizer";
import {
  applyImportBatch,
  assertValidExportBatch,
  createImportBatch,
  listOrderDataBatchSummaries,
  loadOrderDataCandidates,
} from "@/features/orders/server/order-data.repository";
import { parseOrderDataWorkbook } from "@/features/orders/server/order-data-workbook";
import type {
  AuditActor,
  OrderDataBatchHistory,
  OrderDataImportApplyResult,
  OrderDataImportMode,
  OrderDataImportPreview,
} from "@/lib/repairdesk/types";
import { writeAuditLog } from "@/server/audit";
import { normalizePhoneBook } from "@/shared/lib/phone";

export {
  downloadOrderDataTemplate,
  exportCustomerStats,
  exportOrderData,
} from "@/features/orders/server/order-data-export.service";

export async function listOrderDataBatchHistory(input: {
  actor: AuditActor;
  expectedStoreId: string;
}): Promise<OrderDataBatchHistory> {
  const { storeId } = await assertOrderDataAccess(
    input.actor,
    "order:export",
    input.expectedStoreId,
  );
  const history = await listOrderDataBatchSummaries({ storeId, limit: 20 });
  return {
    storeId,
    items: history.items as OrderDataBatchHistory["items"],
    hasMore: history.hasMore,
  };
}

export async function previewOrderDataImport(input: {
  actor: AuditActor;
  expectedStoreId: string;
  mode: OrderDataImportMode;
  fileName: string;
  mimeType?: string;
  bytes: Buffer;
}): Promise<OrderDataImportPreview> {
  const { actorId, storeId } = await assertOrderDataAccess(
    input.actor,
    "order:import_preview",
    input.expectedStoreId,
  );
  const parsed = await parseOrderDataWorkbook({
    bytes: input.bytes,
    fileName: input.fileName,
    mimeType: input.mimeType,
  });
  const rawRows = toKeyedOrderRows(parsed);
  if (rawRows.length === 0) throw new Error("工单工作表没有可导入的数据行");

  const usesInternalMatch = rawRows.some(
    (row) => row.order_id || row.public_no || row.import_action === "update",
  );
  if (usesInternalMatch) {
    if (!parsed.exportBatchId) {
      throw new Error("更新工单必须使用本店铺导出的工作簿，请重新导出后编辑");
    }
    await assertValidExportBatch({ batchId: parsed.exportBatchId, storeId, actorId });
  }

  const candidates = await loadOrderDataCandidates({
    storeId,
    orderIds: rawRows.map((row) => row.order_id ?? ""),
    publicNos: rawRows.map((row) => row.public_no ?? ""),
    externalRefs: rawRows
      .filter((row) => row.source_system && row.external_record_id)
      .map((row) => ({
        sourceSystem: row.source_system!.trim().toLowerCase(),
        externalRecordId: row.external_record_id!.trim(),
      })),
    customerPhoneRaws: rawRows
      .map((row) => (row.customer_phone ? normalizePhoneBook(row.customer_phone).primaryRaw : ""))
      .filter(Boolean),
  });
  const normalized = normalizeOrderDataRows({
    rawRows,
    repairItemRows: parsed.repairItemRows,
    mode: input.mode,
    candidates,
  });
  const payloadHash = sha256(Buffer.from(JSON.stringify(normalized.stagedRows)));
  const fileHash = sha256(input.bytes);
  const batch = await createImportBatch({
    storeId,
    actorId,
    mode: input.mode,
    templateVersion: parsed.templateVersion,
    parserVersion: ORDER_DATA_PARSER_VERSION,
    sourceBatchId: parsed.exportBatchId,
    fileHash,
    payloadHash,
    rows: normalized.stagedRows,
    summary: normalized.summary,
  });
  await writeAuditLog({
    actor: input.actor,
    action: "import_preview",
    entityType: "order_data_batch",
    entityId: batch.id,
    metadata: {
      template_version: parsed.templateVersion,
      mode: input.mode,
      file_hash: fileHash,
      payload_hash: payloadHash,
      ...normalized.summary,
    },
  });

  return {
    batchId: batch.id,
    storeId,
    templateVersion: parsed.templateVersion,
    mode: input.mode,
    expiresAt: batch.expiresAt,
    summary: normalized.summary,
    rows: normalized.previewRows,
  };
}

export async function applyOrderDataImport(input: {
  actor: AuditActor;
  expectedStoreId: string;
  batchId: string;
}): Promise<OrderDataImportApplyResult> {
  const { storeId } = await assertOrderDataAccess(
    input.actor,
    "order:import_apply",
    input.expectedStoreId,
  );
  let result: unknown;
  try {
    result = await applyImportBatch({ batchId: input.batchId, actor: input.actor, storeId });
  } catch (error) {
    if (error instanceof OrderDataApplyRepositoryError) {
      if (error.code === "batch_not_found") throw new Error("导入批次不存在或不属于当前店铺");
      if (error.code === "batch_not_applicable") throw new Error("导入预览已过期或已处理");
      if (error.code === "batch_has_invalid_rows") throw new Error("预览仍有错误行，不能应用");
      if (error.code === "batch_has_no_ready_rows") throw new Error("没有可应用的数据行");
    }
    throw new Error("应用工单导入失败，请重新生成预览后重试");
  }
  if (!result || typeof result !== "object") throw new Error("导入结果格式无效");
  return result as OrderDataImportApplyResult;
}

function sha256(bytes: Buffer) {
  return createHash("sha256").update(bytes).digest("hex");
}
