import type { AuditActor, OrderDataImportMode } from "@/lib/repairdesk/types";
import { getSupabaseAdmin } from "@/server/supabase";
import { type DbRecord } from "@/server/repairdesk-shared";
import {
  extractOrderDataApplyFailureCode,
  OrderDataApplyRepositoryError,
} from "@/features/orders/model/order-data-errors";
import { ORDER_DATA_TEMPLATE_VERSION } from "@/features/orders/model/order-data-contract";
import { isOrderDataWorkbookV3ImportEnabledForStore } from "@/features/orders/server/order-phase4-feature";

const ORDER_DATA_SELECT = `
  id,
  store_id,
  public_no,
  order_type,
  device_custody_status,
  status,
  workflow_status,
  exception_status,
  approval_status,
  approval_flow_status,
  parts_status,
  notify_status,
  customer_id,
  device_id,
  issue_description,
  diagnosis_result,
  intake_intent_selection,
  reported_symptoms_selection,
  diagnostic_findings_selection,
  quotation_amount,
  deposit_amount,
  balance_amount,
  payment_status,
  technician_name,
  internal_tag,
  accessory_notes,
  warranty_text,
  warranty_months,
  fault_prices,
  approval_sent_at,
  approval_confirmed_at,
  completed_at,
  delivered_at,
  created_at,
  updated_at,
  customer:customers!repair_orders_customer_same_store_fkey(id,name,phone_e164,phone_raw,contact_phones,updated_at),
  device:devices!repair_orders_device_same_store_fkey(id,brand,model,serial_or_imei,device_notes,updated_at)
`;

const EXPORT_PAGE_SIZE = 500;
const MAX_EXPORT_ROWS = 10_000;
const LOOKUP_CHUNK_SIZE = 200;

export interface OrderDataDbRow extends DbRecord {
  id: string;
  store_id: string;
  public_no: string;
  updated_at: string;
}

export interface OrderDataStagedRow {
  row_number: number;
  action: "create" | "update" | "skip";
  status: "ready" | "invalid" | "skipped";
  order_id?: string;
  expected_updated_at?: string;
  customer_id?: string;
  customer_expected_updated_at?: string;
  device_id?: string;
  device_expected_updated_at?: string;
  source_system?: string;
  external_record_id?: string;
  normalized_data: Record<string, unknown>;
  changed_fields: string[];
  warnings: { code: string; message: string; field?: string }[];
  errors: { code: string; message: string; field?: string }[];
}

export async function listOrderDataExportRows(storeId: string) {
  const supabase = getSupabaseAdmin();
  const rows: OrderDataDbRow[] = [];
  for (let from = 0; from <= MAX_EXPORT_ROWS; from += EXPORT_PAGE_SIZE) {
    const { data, error } = await supabase
      .from("repair_orders")
      .select(ORDER_DATA_SELECT)
      .eq("store_id", storeId)
      .order("created_at", { ascending: true })
      .order("id", { ascending: true })
      .range(from, from + EXPORT_PAGE_SIZE - 1);
    failOrderData(error, "读取工单导出数据失败");
    const batch = (data ?? []) as unknown as OrderDataDbRow[];
    if (rows.length + batch.length > MAX_EXPORT_ROWS) {
      throw new Error(`工单数量超过 ${MAX_EXPORT_ROWS} 条同步导出限制，请联系管理员`);
    }
    rows.push(...batch);
    if (batch.length < EXPORT_PAGE_SIZE) return rows;
  }
  throw new Error(`工单数量超过 ${MAX_EXPORT_ROWS} 条同步导出限制，请联系管理员`);
}

export async function listOrderDataOperationHistory(storeId: string, limit = 5_000) {
  const { data, error } = await getSupabaseAdmin()
    .from("order_events")
    .select("order_id,event_type,operator_name,created_at,payload")
    .eq("store_id", storeId)
    .order("created_at", { ascending: false })
    .limit(limit);
  failOrderData(error, "读取工单操作历史失败");
  return (data ?? []) as Array<{
    order_id: string;
    event_type: string;
    operator_name?: string | null;
    created_at: string;
    payload?: Record<string, unknown> | null;
  }>;
}

export async function listOrderExternalRefs(storeId: string, orderIds: string[]) {
  const refs = new Map<string, { sourceSystem: string; externalRecordId: string }>();
  const supabase = getSupabaseAdmin();
  for (const ids of chunk(orderIds, LOOKUP_CHUNK_SIZE)) {
    const { data, error } = await supabase
      .from("order_external_refs")
      .select("order_id,source_system,external_record_id")
      .eq("store_id", storeId)
      .in("order_id", ids);
    failOrderData(error, "读取工单外部引用失败");
    for (const row of (data ?? []) as {
      order_id: string;
      source_system: string;
      external_record_id: string;
    }[]) {
      if (!refs.has(row.order_id)) {
        refs.set(row.order_id, {
          sourceSystem: row.source_system,
          externalRecordId: row.external_record_id,
        });
      }
    }
  }
  return refs;
}

export async function loadOrderDataCandidates(input: {
  storeId: string;
  orderIds: string[];
  publicNos: string[];
  externalRefs: { sourceSystem: string; externalRecordId: string }[];
  customerPhoneRaws: string[];
}) {
  const byId = new Map<string, OrderDataDbRow>();
  const byPublicNo = new Map<string, OrderDataDbRow>();
  const supabase = getSupabaseAdmin();

  for (const ids of chunk(unique(input.orderIds), LOOKUP_CHUNK_SIZE)) {
    const { data, error } = await supabase
      .from("repair_orders")
      .select(ORDER_DATA_SELECT)
      .eq("store_id", input.storeId)
      .in("id", ids);
    failOrderData(error, "匹配工单失败");
    addCandidates((data ?? []) as unknown as OrderDataDbRow[], byId, byPublicNo);
  }

  for (const publicNos of chunk(unique(input.publicNos), LOOKUP_CHUNK_SIZE)) {
    const { data, error } = await supabase
      .from("repair_orders")
      .select(ORDER_DATA_SELECT)
      .eq("store_id", input.storeId)
      .in("public_no", publicNos);
    failOrderData(error, "匹配工单编号失败");
    addCandidates((data ?? []) as unknown as OrderDataDbRow[], byId, byPublicNo);
  }

  const byExternalRef = new Map<string, OrderDataDbRow>();
  for (const refs of chunk(input.externalRefs, LOOKUP_CHUNK_SIZE)) {
    if (refs.length === 0) continue;
    const sourceSystems = unique(refs.map((ref) => ref.sourceSystem));
    const externalIds = unique(refs.map((ref) => ref.externalRecordId));
    const { data, error } = await supabase
      .from("order_external_refs")
      .select("source_system,external_record_id,order_id")
      .eq("store_id", input.storeId)
      .in("source_system", sourceSystems)
      .in("external_record_id", externalIds);
    failOrderData(error, "匹配外部工单引用失败");
    const orderIds = unique(((data ?? []) as { order_id: string }[]).map((row) => row.order_id));
    for (const ids of chunk(orderIds, LOOKUP_CHUNK_SIZE)) {
      const { data: orderRows, error: orderError } = await supabase
        .from("repair_orders")
        .select(ORDER_DATA_SELECT)
        .eq("store_id", input.storeId)
        .in("id", ids);
      failOrderData(orderError, "读取外部引用工单失败");
      addCandidates((orderRows ?? []) as unknown as OrderDataDbRow[], byId, byPublicNo);
    }
    for (const ref of (data ?? []) as {
      source_system: string;
      external_record_id: string;
      order_id: string;
    }[]) {
      const order = byId.get(ref.order_id);
      if (order)
        byExternalRef.set(externalRefKey(ref.source_system, ref.external_record_id), order);
    }
  }

  const customersByPhoneRaw = new Map<string, { id: string; name: string; updated_at: string }>();
  for (const phoneRaws of chunk(unique(input.customerPhoneRaws), LOOKUP_CHUNK_SIZE)) {
    const { data, error } = await supabase
      .from("customers")
      .select("id,name,phone_raw,updated_at")
      .eq("store_id", input.storeId)
      .in("phone_raw", phoneRaws);
    failOrderData(error, "检查导入客户手机号失败");
    for (const row of (data ?? []) as {
      id: string;
      name: string;
      phone_raw: string;
      updated_at: string;
    }[]) {
      customersByPhoneRaw.set(row.phone_raw, row);
    }
  }

  return { byId, byPublicNo, byExternalRef, customersByPhoneRaw };
}

export async function createExportBatch(input: {
  storeId: string;
  actorId: string;
  templateVersion: string;
  parserVersion: string;
}) {
  const expiresAt = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString();
  const { data, error } = await getSupabaseAdmin()
    .from("order_data_batches")
    .insert({
      store_id: input.storeId,
      actor_id: input.actorId,
      kind: "order_export",
      template_version: input.templateVersion,
      parser_version: input.parserVersion,
      status: "building",
      expires_at: expiresAt,
    })
    .select("id,expires_at")
    .single();
  failOrderData(error, "创建导出批次失败");
  return data as { id: string; expires_at: string };
}

export async function completeExportBatch(input: {
  batchId: string;
  storeId: string;
  fileHash: string;
  rowCount: number;
}) {
  const { data, error } = await getSupabaseAdmin()
    .from("order_data_batches")
    .update({
      status: "completed",
      file_hash: input.fileHash,
      summary: { rows: input.rowCount },
    })
    .eq("id", input.batchId)
    .eq("store_id", input.storeId)
    .eq("status", "building")
    .select("id")
    .maybeSingle();
  failOrderData(error, "完成导出批次失败");
  if (!data) throw new Error("完成导出批次失败");
}

export async function assertValidExportBatch(input: {
  batchId: string;
  storeId: string;
  actorId: string;
}) {
  const { data, error } = await getSupabaseAdmin()
    .from("order_data_batches")
    .select("id")
    .eq("id", input.batchId)
    .eq("store_id", input.storeId)
    .eq("actor_id", input.actorId)
    .eq("kind", "order_export")
    .eq("status", "completed")
    .gt("expires_at", new Date().toISOString())
    .maybeSingle();
  failOrderData(error, "验证导出批次失败");
  if (!data) throw new Error("导出文件已过期或不属于当前店铺，请重新导出");
}

export async function createImportBatch(input: {
  storeId: string;
  actorId: string;
  mode: OrderDataImportMode;
  templateVersion: string;
  parserVersion: string;
  sourceBatchId?: string;
  fileHash: string;
  payloadHash: string;
  rows: OrderDataStagedRow[];
  summary: Record<string, number>;
}) {
  const supabase = getSupabaseAdmin();
  const cleanupResult = await supabase.rpc("repairdesk_cleanup_expired_order_data_batches");
  failOrderData(cleanupResult.error, "清理过期工单数据批次失败");
  const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString();
  const { data: batch, error: batchError } = await supabase
    .from("order_data_batches")
    .insert({
      store_id: input.storeId,
      actor_id: input.actorId,
      kind: "import",
      template_version: input.templateVersion,
      parser_version: input.parserVersion,
      mode: input.mode,
      status: "previewed",
      source_batch_id: input.sourceBatchId ?? null,
      file_hash: input.fileHash,
      payload_hash: input.payloadHash,
      summary: input.summary,
      previewed_at: new Date().toISOString(),
      expires_at: expiresAt,
    })
    .select("id,expires_at")
    .single();
  failOrderData(batchError, "保存导入预览失败");
  const batchRecord = batch as { id: string; expires_at: string };

  for (const rows of chunk(input.rows, 250)) {
    const { error: rowError } = await supabase.from("order_data_batch_rows").insert(
      rows.map((row) => ({
        batch_id: batchRecord.id,
        store_id: input.storeId,
        ...row,
      })),
    );
    if (rowError) {
      await supabase.from("order_data_batches").delete().eq("id", batchRecord.id);
      failOrderData(rowError, "保存导入预览行失败");
    }
  }
  return { id: batchRecord.id, expiresAt: batchRecord.expires_at };
}

export async function applyImportBatch(input: {
  batchId: string;
  actor: AuditActor;
  storeId: string;
}) {
  const supabase = getSupabaseAdmin();
  const { data: batch, error: batchError } = await supabase
    .from("order_data_batches")
    .select("template_version")
    .eq("id", input.batchId)
    .eq("store_id", input.storeId)
    .maybeSingle();
  failOrderData(batchError, "读取工单导入批次失败");
  if (!batch) throw new OrderDataApplyRepositoryError("batch_not_found");
  const isV3 = String(batch.template_version) === ORDER_DATA_TEMPLATE_VERSION;
  if (isV3 && !isOrderDataWorkbookV3ImportEnabledForStore(input.storeId)) {
    throw new Error("工作簿 v3 导入已暂停，请重新预览或联系店主");
  }
  const rpcName = isV3
    ? "repairdesk_apply_order_data_batch_v3"
    : "repairdesk_apply_order_data_batch";
  const { data, error } = await supabase.rpc(rpcName, {
    p_batch_id: input.batchId,
    p_store_id: input.storeId,
    p_actor_id: input.actor.id,
    p_actor_email: input.actor.email ?? null,
    p_actor_name: input.actor.displayName,
  });
  if (error) {
    logOrderDataError(error, "应用工单导入失败");
    const safeCode = extractOrderDataApplyFailureCode(error.message);
    if (safeCode) throw new OrderDataApplyRepositoryError(safeCode);
    throw new Error("应用工单导入失败");
  }
  return data;
}

export async function listOrderDataBatchSummaries(input: { storeId: string; limit?: number }) {
  const limit = Math.min(Math.max(input.limit ?? 20, 1), 50);
  const supabase = getSupabaseAdmin();
  const { data, error } = await supabase
    .from("order_data_batches")
    .select(
      "id,store_id,actor_id,kind,mode,status,summary,created_at,previewed_at,applied_at,expires_at",
    )
    .eq("store_id", input.storeId)
    .order("created_at", { ascending: false })
    .limit(limit + 1);
  failOrderData(error, "读取工单数据批次失败");
  const batchRows = (data ?? []) as DbRecord[];
  const actorIds = unique(batchRows.map((row) => stringValue(row.actor_id)));
  const actorNames = new Map<string, string>();
  if (actorIds.length > 0) {
    const { data: actors, error: actorError } = await supabase
      .from("staff_profiles")
      .select("id,display_name")
      .in("id", actorIds);
    failOrderData(actorError, "读取工单数据批次操作人失败");
    for (const actor of (actors ?? []) as DbRecord[]) {
      actorNames.set(stringValue(actor.id), stringValue(actor.display_name));
    }
  }

  return {
    items: batchRows.slice(0, limit).map((row) => ({
      id: stringValue(row.id),
      storeId: stringValue(row.store_id),
      kind: stringValue(row.kind),
      mode: stringValue(row.mode) || undefined,
      status: stringValue(row.status),
      actorDisplayName: actorNames.get(stringValue(row.actor_id)) || undefined,
      createdAt: stringValue(row.created_at),
      previewedAt: stringValue(row.previewed_at) || undefined,
      appliedAt: stringValue(row.applied_at) || undefined,
      expiresAt: stringValue(row.expires_at),
      summary: sanitizeBatchSummary(row.summary),
    })),
    hasMore: batchRows.length > limit,
  };
}

export function relationRecord(value: unknown): DbRecord | undefined {
  if (Array.isArray(value)) return value[0] as DbRecord | undefined;
  if (value && typeof value === "object") return value as DbRecord;
  return undefined;
}

export function externalRefKey(sourceSystem: string, externalRecordId: string) {
  return `${sourceSystem.trim().toLowerCase()}\u0000${externalRecordId.trim()}`;
}

function addCandidates(
  rows: OrderDataDbRow[],
  byId: Map<string, OrderDataDbRow>,
  byPublicNo: Map<string, OrderDataDbRow>,
) {
  for (const row of rows) {
    byId.set(String(row.id), row);
    byPublicNo.set(String(row.public_no), row);
  }
}

function unique(values: string[]) {
  return [...new Set(values.filter(Boolean))];
}

function chunk<T>(values: T[], size: number) {
  const chunks: T[][] = [];
  for (let index = 0; index < values.length; index += size)
    chunks.push(values.slice(index, index + size));
  return chunks;
}

function sanitizeBatchSummary(value: unknown) {
  const source = value && typeof value === "object" ? (value as Record<string, unknown>) : {};
  const keys = [
    "total",
    "ready",
    "create",
    "update",
    "invalid",
    "skipped",
    "rows",
    "applied",
    "conflicts",
    "failed",
  ] as const;
  return Object.fromEntries(
    keys.flatMap((key) => {
      const number = Number(source[key]);
      return Number.isFinite(number) && number >= 0 ? [[key, number]] : [];
    }),
  );
}

function stringValue(value: unknown) {
  return value === null || value === undefined ? "" : String(value);
}

function failOrderData(
  error: { code?: string; message?: string } | null | undefined,
  publicMessage: string,
) {
  if (!error) return;
  logOrderDataError(error, publicMessage);
  throw new Error(publicMessage);
}

function logOrderDataError(error: { code?: string; message?: string }, publicMessage: string) {
  console.error(`[order-data] ${publicMessage}`, {
    code: error.code,
    message: error.message,
  });
}
