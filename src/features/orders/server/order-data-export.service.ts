import { createHash } from "node:crypto";
import { Buffer } from "node:buffer";

import { listCustomersPage } from "@/features/customers/server/customer.service";
import { deviceCustodyLabel, isDeviceCustodyStatus } from "@/features/orders/model/device-custody";
import {
  ORDER_DATA_PARSER_VERSION,
  ORDER_DATA_MAX_REPAIR_ITEM_ROWS,
  ORDER_DATA_TEMPLATE_VERSION,
} from "@/features/orders/model/order-data-contract";
import { assertOrderDataAccess } from "@/features/orders/server/order-data-access";
import {
  completeExportBatch,
  createExportBatch,
  listOrderDataExportRows,
  listOrderExternalRefs,
  relationRecord,
  type OrderDataDbRow,
} from "@/features/orders/server/order-data.repository";
import {
  buildCustomerStatsWorkbook,
  buildOrderDataWorkbook,
  workbookDownloadHeaders,
  type WorkbookDataRow,
} from "@/features/orders/server/order-data-workbook";
import type { AuditActor, CustomerStats, FaultPriceItem } from "@/lib/repairdesk/types";
import { writeAuditLog } from "@/server/audit";

const MAX_CUSTOMER_STATS_ROWS = 10_000;

export async function downloadOrderDataTemplate(input: {
  expectedStoreId: string;
  actor: AuditActor;
}) {
  const { storeId } = await assertOrderDataAccess(
    input.actor,
    "order:import_preview",
    input.expectedStoreId,
  );
  const bytes = await buildOrderDataWorkbook({ kind: "template" });
  await writeAuditLog({
    actor: input.actor,
    action: "download_template",
    entityType: "order_data",
    entityId: ORDER_DATA_TEMPLATE_VERSION,
    metadata: { template_version: ORDER_DATA_TEMPLATE_VERSION, store_id: storeId },
  });
  return fileResult(bytes, `repairdesk-order-template-${dateStamp()}.xlsx`);
}

export async function exportOrderData(input: { expectedStoreId: string; actor: AuditActor }) {
  const { actorId, storeId } = await assertOrderDataAccess(
    input.actor,
    "order:export",
    input.expectedStoreId,
  );
  const batch = await createExportBatch({
    storeId,
    actorId,
    templateVersion: ORDER_DATA_TEMPLATE_VERSION,
    parserVersion: ORDER_DATA_PARSER_VERSION,
  });
  const rows = await listOrderDataExportRows(storeId);
  const refs = await listOrderExternalRefs(
    storeId,
    rows.map((row) => String(row.id)),
  );
  const workbookRows = rows.map((row) => exportOrderRow(row, refs.get(String(row.id))));
  const repairRows: WorkbookDataRow[] = [];
  for (const row of rows) {
    const nextRows = exportRepairItemRows(row, refs.get(String(row.id)));
    if (repairRows.length + nextRows.length > ORDER_DATA_MAX_REPAIR_ITEM_ROWS) {
      throw new Error(
        `维修项目超过 ${ORDER_DATA_MAX_REPAIR_ITEM_ROWS} 行同步导出限制，请联系管理员`,
      );
    }
    repairRows.push(...nextRows);
  }
  const bytes = await buildOrderDataWorkbook({
    kind: "export",
    exportBatchId: batch.id,
    orderRows: workbookRows,
    repairItemRows: repairRows,
  });
  const fileHash = sha256(bytes);
  await completeExportBatch({ batchId: batch.id, storeId, fileHash, rowCount: rows.length });
  await writeAuditLog({
    actor: input.actor,
    action: "export",
    entityType: "order_data_batch",
    entityId: batch.id,
    metadata: {
      template_version: ORDER_DATA_TEMPLATE_VERSION,
      row_count: rows.length,
      repair_item_count: repairRows.length,
      file_hash: fileHash,
    },
  });
  return fileResult(bytes, `repairdesk-orders-${dateStamp()}.xlsx`);
}

export async function exportCustomerStats(input: { expectedStoreId: string; actor: AuditActor }) {
  await assertOrderDataAccess(input.actor, "customer:export", input.expectedStoreId);
  const customerRows: WorkbookDataRow[] = [];
  let customerStats: CustomerStats | undefined;
  let page = 1;
  let pageCount = 1;
  while (page <= pageCount) {
    const result = await listCustomersPage({ page, pageSize: 100 }, input.actor);
    customerStats ??= result.stats;
    pageCount = result.pageCount;
    for (const customer of result.items) {
      customerRows.push({
        customer_id: customer.id,
        name: customer.name,
        phone: customer.phone_e164,
        order_count: customer.order_count,
        valid_order_count: customer.valid_order_count,
        active_order_count: customer.active_order_count,
        device_count: customer.device_count,
        total_spent: customer.total_spent,
        unpaid_amount: customer.unpaid_amount,
        last_order_at: customer.last_order_at,
        next_followup_at: customer.next_followup_at,
        tags: customer.tags.map((tag) => tag.name).join("、"),
      });
    }
    if (customerRows.length > MAX_CUSTOMER_STATS_ROWS) {
      throw new Error(`客户数量超过 ${MAX_CUSTOMER_STATS_ROWS} 条同步导出限制`);
    }
    page += 1;
  }

  const bytes = await buildCustomerStatsWorkbook(
    customerRows,
    customerStats ?? emptyCustomerStats(),
  );
  const fileHash = sha256(bytes);
  await writeAuditLog({
    actor: input.actor,
    action: "export",
    entityType: "customer_stats",
    entityId: crypto.randomUUID(),
    metadata: { row_count: customerRows.length, file_hash: fileHash },
  });
  return fileResult(bytes, `repairdesk-customer-stats-${dateStamp()}.xlsx`);
}

function exportOrderRow(
  row: OrderDataDbRow,
  externalRef?: { sourceSystem: string; externalRecordId: string },
): WorkbookDataRow {
  const customer = relationRecord(row.customer);
  const device = relationRecord(row.device);
  return {
    template_version: ORDER_DATA_TEMPLATE_VERSION,
    import_action: "update",
    order_id: String(row.id),
    public_no: String(row.public_no),
    source_system: externalRef?.sourceSystem,
    external_record_id: externalRef?.externalRecordId,
    expected_updated_at: String(row.updated_at),
    order_type: stringValue(row.order_type),
    device_custody_status: isDeviceCustodyStatus(row.device_custody_status)
      ? row.device_custody_status
      : "",
    device_custody_label: deviceCustodyLabel(
      isDeviceCustodyStatus(row.device_custody_status) ? row.device_custody_status : null,
    ),
    status: stringValue(row.status),
    workflow_status: stringValue(row.workflow_status),
    exception_status: stringValue(row.exception_status),
    approval_status: stringValue(row.approval_status),
    approval_flow_status: stringValue(row.approval_flow_status),
    parts_status: stringValue(row.parts_status),
    notify_status: stringValue(row.notify_status),
    customer_name: stringValue(customer?.name),
    customer_phone: stringValue(customer?.phone_e164),
    device_brand: stringValue(device?.brand),
    device_model: stringValue(device?.model),
    device_imei: stringValue(device?.serial_or_imei),
    device_notes: stringValue(device?.device_notes),
    issue_description: stringValue(row.issue_description),
    diagnosis_result: stringValue(row.diagnosis_result),
    internal_tag: stringValue(row.internal_tag),
    accessory_notes: stringValue(row.accessory_notes),
    warranty_text: stringValue(row.warranty_text),
    warranty_months: numberValue(row.warranty_months),
    deposit_amount: numberValue(row.deposit_amount),
    quotation_amount: numberValue(row.quotation_amount),
    balance_amount: numberValue(row.balance_amount),
    payment_status: stringValue(row.payment_status),
    technician_name: stringValue(row.technician_name),
    approval_sent_at: stringValue(row.approval_sent_at),
    approval_confirmed_at: stringValue(row.approval_confirmed_at),
    completed_at: stringValue(row.completed_at),
    delivered_at: stringValue(row.delivered_at),
    created_at: stringValue(row.created_at),
    updated_at: stringValue(row.updated_at),
  };
}

function exportRepairItemRows(
  row: OrderDataDbRow,
  externalRef?: { sourceSystem: string; externalRecordId: string },
) {
  const faults = Array.isArray(row.fault_prices) ? (row.fault_prices as FaultPriceItem[]) : [];
  return faults.map(
    (fault, index): WorkbookDataRow => ({
      order_id: String(row.id),
      public_no: String(row.public_no),
      source_system: externalRef?.sourceSystem,
      external_record_id: externalRef?.externalRecordId,
      sequence: index + 1,
      name: fault.name,
      price: Number(fault.price),
      note: fault.note,
    }),
  );
}

function fileResult(bytes: Buffer, fileName: string) {
  return { bytes, headers: workbookDownloadHeaders(fileName), fileName };
}

function sha256(bytes: Buffer) {
  return createHash("sha256").update(bytes).digest("hex");
}

function dateStamp() {
  return new Date().toISOString().slice(0, 10);
}

function stringValue(value: unknown) {
  return value === null || value === undefined ? "" : String(value);
}

function numberValue(value: unknown) {
  const number = Number(value);
  return Number.isFinite(number) ? number : undefined;
}

function emptyCustomerStats(): CustomerStats {
  return {
    total: 0,
    repeat: 0,
    activeRepairs: 0,
    unpaid: 0,
    withDevices: 0,
    dueFollowups: 0,
    marketable: 0,
  };
}
