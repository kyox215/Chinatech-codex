import {
  ORDER_DATA_CLEAR_VALUE,
  clearableOrderDataKeys,
  editableOrderDataKeys,
  type OrderDataColumnKey,
} from "@/features/orders/model/order-data-contract";
import {
  externalRefKey,
  relationRecord,
  type OrderDataDbRow,
  type OrderDataStagedRow,
  type loadOrderDataCandidates,
} from "@/features/orders/server/order-data.repository";
import type { ParsedOrderDataWorkbook } from "@/features/orders/server/order-data-workbook";
import type {
  FaultPriceItem,
  OrderDataImportIssue,
  OrderDataImportMode,
  OrderDataImportPreviewRow,
} from "@/lib/repairdesk/types";
import { normalizePhoneBook } from "@/shared/lib/phone";

const ALLOWED_WARRANTY_MONTHS = new Set([0, 3, 6, 12, 24]);

const headerToKey: Record<string, OrderDataColumnKey> = {
  数据版本: "template_version",
  导入动作: "import_action",
  工单ID: "order_id",
  工单编号: "public_no",
  外部来源: "source_system",
  外部记录ID: "external_record_id",
  版本时间: "expected_updated_at",
  订单类型: "order_type",
  状态: "status",
  流程阶段: "workflow_status",
  异常状态: "exception_status",
  审批结果: "approval_status",
  审批流程: "approval_flow_status",
  配件状态: "parts_status",
  通知状态: "notify_status",
  客户姓名: "customer_name",
  客户电话: "customer_phone",
  设备品牌: "device_brand",
  设备型号: "device_model",
  IMEI或序列号: "device_imei",
  设备备注: "device_notes",
  故障描述: "issue_description",
  诊断结果: "diagnosis_result",
  内部标签: "internal_tag",
  随附物品: "accessory_notes",
  质保文本: "warranty_text",
  质保月数: "warranty_months",
  定金: "deposit_amount",
  总报价: "quotation_amount",
  余额: "balance_amount",
  付款状态: "payment_status",
  技师: "technician_name",
  审批发送时间: "approval_sent_at",
  审批确认时间: "approval_confirmed_at",
  完成时间: "completed_at",
  交付时间: "delivered_at",
  创建时间: "created_at",
  更新时间: "updated_at",
};

const editableFieldLabels: Partial<Record<OrderDataColumnKey, string>> = {
  order_type: "订单类型",
  customer_name: "客户姓名",
  customer_phone: "客户电话",
  device_brand: "设备品牌",
  device_model: "设备型号",
  device_imei: "IMEI或序列号",
  device_notes: "设备备注",
  issue_description: "故障描述",
  diagnosis_result: "诊断结果",
  internal_tag: "内部标签",
  accessory_notes: "随附物品",
  warranty_text: "质保文本",
  warranty_months: "质保月数",
  deposit_amount: "定金",
};

type OrderDataCandidates = Awaited<ReturnType<typeof loadOrderDataCandidates>>;

export function toKeyedOrderRows(parsed: ParsedOrderDataWorkbook) {
  return parsed.orderRows.map((row) => {
    const keyed: Record<string, string> = { __row_number: row.__row_number || "" };
    for (const [header, value] of Object.entries(row)) {
      const key = headerToKey[header];
      if (key) keyed[key] = value;
    }
    return keyed;
  });
}

export function normalizeOrderDataRows(input: {
  rawRows: Record<string, string>[];
  repairItemRows: Record<string, string>[];
  mode: OrderDataImportMode;
  candidates: OrderDataCandidates;
}) {
  const repairItems = parseRepairItems(input.repairItemRows);
  const consumedRepairItemKeys = new Set<string>();
  const previewRows: OrderDataImportPreviewRow[] = [];
  const stagedRows: OrderDataStagedRow[] = [];

  input.rawRows.forEach((raw, index) => {
    const rowNumber = Number(raw.__row_number || index + 2);
    const issues: { warnings: OrderDataImportIssue[]; errors: OrderDataImportIssue[] } = {
      warnings: [],
      errors: [],
    };
    const matched = matchOrder(raw, input.candidates, issues.errors);
    let action = normalizeAction(raw.import_action, matched, issues.errors);
    if (action === "create" && input.mode === "update_only") {
      addIssue(issues.errors, "create_disabled", "当前模式只允许更新已有工单", "导入动作");
    }
    if (action === "create" && matched) {
      action = "skip";
      addIssue(issues.warnings, "duplicate_external_ref", "外部记录已导入，本行不会重复创建");
    }
    if (action === "update" && !matched) {
      addIssue(issues.errors, "order_not_found", "当前店铺没有匹配的工单");
    }
    if (action === "update" && raw.expected_updated_at !== matched?.updated_at) {
      addIssue(issues.errors, "version_conflict", "工单在导出后已发生修改，请重新导出", "版本时间");
    }

    const normalizedData = normalizeEditableData(raw, action, issues.errors);
    const rowRepairItems = collectRepairItemsForOrderRow(raw, repairItems, consumedRepairItemKeys);
    if (rowRepairItems) normalizedData.fault_prices = rowRepairItems;
    else if (action === "create") normalizedData.fault_prices = [];
    if (action === "create") {
      validateCreateData(normalizedData, raw, issues.errors);
      const phoneRaw = String(normalizedData.customer_phone_raw ?? "");
      const existingCustomer = input.candidates.customersByPhoneRaw?.get(phoneRaw);
      if (
        existingCustomer &&
        normalizeComparable(existingCustomer.name) !==
          normalizeComparable(normalizedData.customer_name)
      ) {
        addIssue(
          issues.errors,
          "customer_phone_collision",
          "该手机号已属于其他客户姓名，请先在客户资料中确认",
          "客户电话",
        );
      } else if (existingCustomer) {
        addIssue(issues.warnings, "existing_customer_reused", "将复用当前店铺中同手机号的客户档案");
      }
    }

    const changedFields = matched
      ? removeUnchangedFields(normalizedData, matched)
      : Object.keys(normalizedData);
    if (matched) validateUpdateFinance(normalizedData, changedFields, matched, issues.errors);
    if (
      matched &&
      changedFields.some((field) => field === "fault_prices" || field === "deposit_amount") &&
      quoteApprovalWasTouched(matched)
    ) {
      addIssue(
        issues.errors,
        "finance_requires_order_screen",
        "该工单报价已进入审批或维修流程，请在工单详情中修改金额",
      );
    }
    if (
      matched &&
      changedFields.some((field) => field.startsWith("customer_") || field.startsWith("device_"))
    ) {
      addIssue(
        issues.warnings,
        "shared_record_update",
        "客户或设备主档可能被其他工单共用，请确认后再应用",
      );
    }
    if (action === "update" && issues.errors.length === 0 && changedFields.length === 0) {
      action = "skip";
      addIssue(issues.warnings, "no_changes", "本行与当前工单一致，无需更新");
    }

    const status = issues.errors.length > 0 ? "invalid" : action === "skip" ? "skipped" : "ready";
    previewRows.push({
      rowNumber,
      action,
      status,
      orderId: matched?.id,
      publicNo: matched?.public_no ?? raw.public_no,
      changedFields,
      warnings: issues.warnings,
      errors: issues.errors,
    });
    const customer = matched ? relationRecord(matched.customer) : undefined;
    const device = matched ? relationRecord(matched.device) : undefined;
    stagedRows.push({
      row_number: rowNumber,
      action,
      status,
      order_id: matched?.id,
      expected_updated_at: action === "update" ? matched?.updated_at : undefined,
      customer_id: matched?.customer_id ? String(matched.customer_id) : undefined,
      customer_expected_updated_at:
        action === "update" ? stringValue(customer?.updated_at) || undefined : undefined,
      device_id: matched?.device_id ? String(matched.device_id) : undefined,
      device_expected_updated_at:
        action === "update" ? stringValue(device?.updated_at) || undefined : undefined,
      source_system: normalizeSourceSystem(raw.source_system),
      external_record_id: raw.external_record_id?.trim() || undefined,
      normalized_data: pickChangedData(normalizedData, changedFields),
      changed_fields: changedFields,
      warnings: issues.warnings,
      errors: issues.errors,
    });
  });

  assertAllRepairItemsMatched(repairItems, consumedRepairItemKeys);
  markDuplicateAndSharedConflicts(previewRows, stagedRows);

  return { previewRows, stagedRows, summary: summarizePreview(previewRows) };
}

function matchOrder(
  raw: Record<string, string>,
  candidates: OrderDataCandidates,
  errors: OrderDataImportIssue[],
) {
  const matches = [
    raw.order_id ? candidates.byId.get(raw.order_id) : undefined,
    raw.public_no ? candidates.byPublicNo.get(raw.public_no) : undefined,
    raw.source_system && raw.external_record_id
      ? candidates.byExternalRef.get(externalRefKey(raw.source_system, raw.external_record_id))
      : undefined,
  ].filter((row): row is OrderDataDbRow => Boolean(row));
  const uniqueMatches = new Map(matches.map((row) => [row.id, row]));
  if (uniqueMatches.size > 1) {
    addIssue(errors, "identifier_conflict", "工单ID、工单编号与外部记录指向不同工单");
    return undefined;
  }
  return uniqueMatches.values().next().value as OrderDataDbRow | undefined;
}

function normalizeAction(
  value: string | undefined,
  matched: OrderDataDbRow | undefined,
  errors: OrderDataImportIssue[],
): "create" | "update" | "skip" {
  const action = value?.trim().toLowerCase();
  if (action === "create" || action === "update" || action === "skip") return action;
  addIssue(errors, "invalid_action", "导入动作必须是 create、update 或 skip", "导入动作");
  return matched ? "update" : "create";
}

function normalizeEditableData(
  raw: Record<string, string>,
  action: "create" | "update" | "skip",
  errors: OrderDataImportIssue[],
) {
  const result: Record<string, unknown> = {};
  for (const key of editableOrderDataKeys) {
    if (key === "order_type" && action !== "create") continue;
    const value = raw[key]?.trim() ?? "";
    if (!value) continue;
    if (value === ORDER_DATA_CLEAR_VALUE) {
      if (!clearableOrderDataKeys.has(key)) {
        addIssue(
          errors,
          "clear_not_allowed",
          `${editableFieldLabels[key] ?? key}不允许清空`,
          editableFieldLabels[key],
        );
      } else {
        result[key] = null;
      }
      continue;
    }
    if (key === "customer_phone") {
      const phone = normalizePhoneBook(value);
      if (phone.primaryRaw.length < 8) {
        addIssue(errors, "invalid_phone", "客户电话格式无效", "客户电话");
      } else {
        result.customer_phone_e164 = phone.primary;
        result.customer_phone_raw = phone.primaryRaw;
        result.contact_phones = phone.contacts;
      }
      continue;
    }
    if (key === "warranty_months") {
      const months = Number(value);
      if (!Number.isInteger(months) || !ALLOWED_WARRANTY_MONTHS.has(months)) {
        addIssue(errors, "invalid_warranty", "质保月数只能是 0、3、6、12 或 24", "质保月数");
      } else result.warranty_months = months;
      continue;
    }
    if (key === "deposit_amount") {
      const amount = parseMoney(value);
      if (amount === undefined) addIssue(errors, "invalid_deposit", "定金必须是非负金额", "定金");
      else result.deposit_amount = amount;
      continue;
    }
    if (key === "order_type") {
      if (value !== "quick_repair" && value !== "dropoff_repair") {
        addIssue(
          errors,
          "invalid_order_type",
          "订单类型必须是 quick_repair 或 dropoff_repair",
          "订单类型",
        );
      } else result.order_type = value;
      continue;
    }
    result[key] = value;
  }
  return result;
}

function validateCreateData(
  data: Record<string, unknown>,
  raw: Record<string, string>,
  errors: OrderDataImportIssue[],
) {
  const required = [
    [raw.source_system, "外部来源"],
    [raw.external_record_id, "外部记录ID"],
    [data.order_type, "订单类型"],
    [data.customer_name, "客户姓名"],
    [data.customer_phone_raw, "客户电话"],
    [data.device_brand, "设备品牌"],
    [data.device_model, "设备型号"],
    [data.issue_description, "故障描述"],
  ] as const;
  for (const [value, label] of required) {
    if (!value) addIssue(errors, "required", `新建工单必须填写${label}`, label);
  }
  if (Number(data.deposit_amount ?? 0) > faultTotal(data.fault_prices)) {
    addIssue(errors, "deposit_exceeds_quote", "定金不能超过维修项目总额", "定金");
  }
}

function parseRepairItems(rows: Record<string, string>[]) {
  const groups: {
    rows: {
      keys: string[];
      item: FaultPriceItem;
      rowNumber: number;
      consumed: boolean;
    }[];
  } = { rows: [] };
  rows.forEach((row, index) => {
    const keys = repairRowMatchKeys(row);
    if (keys.length === 0)
      throw new Error("维修项目必须填写工单ID、工单编号或外部来源与外部记录ID");
    const name = row["项目名称"]?.trim();
    const price = parseMoney(row["金额"] ?? "");
    if (!name || price === undefined) throw new Error("维修项目名称不能为空，金额必须是非负数字");
    groups.rows.push({
      keys,
      rowNumber: Number(row.__row_number || 0) || index + 2,
      consumed: false,
      item: {
        name,
        price,
        currency_code: "EUR",
        ...(row["备注"] ? { note: row["备注"] } : {}),
      },
    });
  });
  return groups;
}

function repairRowMatchKeys(row: Record<string, string>) {
  const keys: string[] = [];
  if (row["工单ID"]) keys.push(`id:${row["工单ID"]}`);
  if (row["工单编号"]) keys.push(`public:${row["工单编号"]}`);
  if (row["外部来源"] && row["外部记录ID"]) {
    keys.push(`external:${externalRefKey(row["外部来源"], row["外部记录ID"])}`);
  }
  return keys;
}

function rowMatchKeys(row: Record<string, string>) {
  const keys: string[] = [];
  if (row.order_id) keys.push(`id:${row.order_id}`);
  if (row.public_no) keys.push(`public:${row.public_no}`);
  if (row.source_system && row.external_record_id) {
    keys.push(`external:${externalRefKey(row.source_system, row.external_record_id)}`);
  }
  return keys;
}

function collectRepairItemsForOrderRow(
  row: Record<string, string>,
  groups: ReturnType<typeof parseRepairItems>,
  _consumedKeys: Set<string>,
) {
  const items: FaultPriceItem[] = [];
  const orderKeys = new Set(rowMatchKeys(row));
  for (const repairRow of groups.rows) {
    if (repairRow.consumed) continue;
    if (!repairRow.keys.every((key) => orderKeys.has(key))) continue;
    repairRow.consumed = true;
    items.push(repairRow.item);
  }
  return items.length > 0 ? items : undefined;
}

function assertAllRepairItemsMatched(
  groups: ReturnType<typeof parseRepairItems>,
  _consumedKeys: Set<string>,
) {
  const unmatchedRows = groups.rows
    .filter((row) => !row.consumed)
    .map((row) => row.rowNumber)
    .sort((left, right) => left - right);
  if (unmatchedRows.length > 0) {
    throw new Error(
      `维修项目第 ${unmatchedRows.join("、")} 行没有匹配的工单行，请检查工单ID、工单编号或外部记录ID`,
    );
  }
}

function removeUnchangedFields(data: Record<string, unknown>, current: OrderDataDbRow) {
  const customer = relationRecord(current.customer);
  const device = relationRecord(current.device);
  const currentValues: Record<string, unknown> = {
    customer_name: customer?.name,
    customer_phone_e164: customer?.phone_e164,
    customer_phone_raw: normalizePhoneBook(stringValue(customer?.phone_e164)).primaryRaw,
    contact_phones: normalizeContactPhones(customer),
    device_brand: device?.brand,
    device_model: device?.model,
    device_imei: device?.serial_or_imei,
    device_notes: device?.device_notes ?? null,
    issue_description: current.issue_description,
    diagnosis_result: current.diagnosis_result ?? null,
    internal_tag: current.internal_tag ?? null,
    accessory_notes: current.accessory_notes ?? null,
    warranty_text: current.warranty_text ?? null,
    warranty_months: current.warranty_months,
    deposit_amount: Number(current.deposit_amount ?? 0),
    fault_prices: comparableFaultPrices(current.fault_prices),
  };
  const changed: string[] = [];
  for (const [key, value] of Object.entries(data)) {
    if (key === "contact_phones") continue;
    const comparableValue = key === "fault_prices" ? comparableFaultPrices(value) : value;
    if (JSON.stringify(comparableValue) !== JSON.stringify(currentValues[key])) changed.push(key);
  }
  if (changed.includes("customer_phone_e164")) changed.push("contact_phones");
  return [...new Set(changed)];
}

function normalizeContactPhones(customer: ReturnType<typeof relationRecord>) {
  if (!customer) return undefined;
  const contacts = Array.isArray(customer.contact_phones) ? customer.contact_phones : [];
  const primary = normalizePhoneBook(stringValue(customer.phone_e164)).primaryRaw;
  return [...new Set([primary, ...contacts].map((value) => String(value || "")).filter(Boolean))];
}

function validateUpdateFinance(
  data: Record<string, unknown>,
  changedFields: string[],
  current: OrderDataDbRow,
  errors: OrderDataImportIssue[],
) {
  if (!changedFields.some((field) => field === "fault_prices" || field === "deposit_amount")) {
    return;
  }
  const quotation = changedFields.includes("fault_prices")
    ? faultTotal(data.fault_prices)
    : Number(current.quotation_amount ?? 0);
  const deposit = changedFields.includes("deposit_amount")
    ? Number(data.deposit_amount)
    : Number(current.deposit_amount ?? 0);
  if (!Number.isFinite(quotation) || !Number.isFinite(deposit) || deposit > quotation) {
    addIssue(errors, "deposit_exceeds_quote", "定金不能超过维修项目总额", "定金");
  }
}

function comparableFaultPrices(value: unknown) {
  if (!Array.isArray(value)) return [];
  return value.map((item) => {
    const record = item && typeof item === "object" ? (item as Record<string, unknown>) : {};
    return {
      name: String(record.name ?? "").trim(),
      price: Number(record.price ?? 0),
      currency_code: String(record.currency_code ?? "EUR"),
      note: String(record.note ?? "").trim(),
    };
  });
}

function pickChangedData(data: Record<string, unknown>, changedFields: string[]) {
  const changed = new Set(changedFields);
  return Object.fromEntries(Object.entries(data).filter(([key]) => changed.has(key)));
}

function summarizePreview(rows: OrderDataImportPreviewRow[]) {
  return {
    total: rows.length,
    ready: rows.filter((row) => row.status === "ready").length,
    create: rows.filter((row) => row.status === "ready" && row.action === "create").length,
    update: rows.filter((row) => row.status === "ready" && row.action === "update").length,
    invalid: rows.filter((row) => row.status === "invalid").length,
    skipped: rows.filter((row) => row.status === "skipped").length,
  };
}

function addIssue(issues: OrderDataImportIssue[], code: string, message: string, field?: string) {
  issues.push({ code, message, ...(field ? { field } : {}) });
}

function normalizeSourceSystem(value: string | undefined) {
  const normalized = value?.trim().toLowerCase();
  return normalized || undefined;
}

function parseMoney(value: string) {
  const normalized = value.trim().replace(/\s/g, "").replace(",", ".");
  if (!normalized) return undefined;
  const amount = Number(normalized);
  if (!Number.isFinite(amount) || amount < 0 || amount > 99_999_999) return undefined;
  return Math.round(amount * 100) / 100;
}

function faultTotal(value: unknown) {
  if (!Array.isArray(value)) return 0;
  return value.reduce((sum, item) => {
    if (!item || typeof item !== "object") return sum;
    return sum + Number((item as { price?: unknown }).price ?? 0);
  }, 0);
}

function stringValue(value: unknown) {
  return value === null || value === undefined ? "" : String(value);
}

function markDuplicateAndSharedConflicts(
  previewRows: OrderDataImportPreviewRow[],
  stagedRows: OrderDataStagedRow[],
) {
  const targets = new Map<string, number>();
  const sharedTargets = new Map<string, number>();

  stagedRows.forEach((row, rowIndex) => {
    if (row.status === "invalid" || row.action === "skip") return;
    const target =
      row.action === "update"
        ? row.order_id && `order:${row.order_id}`
        : row.source_system &&
          row.external_record_id &&
          `external:${externalRefKey(row.source_system, row.external_record_id)}`;
    if (target) {
      const previousIndex = targets.get(target);
      if (previousIndex !== undefined) {
        markConflict(
          previewRows,
          stagedRows,
          previousIndex,
          "duplicate_target",
          "同一批次不能重复修改或创建同一工单",
        );
        markConflict(
          previewRows,
          stagedRows,
          rowIndex,
          "duplicate_target",
          "同一批次不能重复修改或创建同一工单",
        );
      } else targets.set(target, rowIndex);
    }

    const sharedEntities = [
      {
        key: row.customer_id && `customer:${row.customer_id}`,
        changed: Object.keys(row.normalized_data).some(
          (field) => field.startsWith("customer_") || field === "contact_phones",
        ),
      },
      {
        key: row.device_id && `device:${row.device_id}`,
        changed: Object.keys(row.normalized_data).some((field) => field.startsWith("device_")),
      },
    ];
    for (const entity of sharedEntities) {
      if (!entity.key || !entity.changed) continue;
      const previousIndex = sharedTargets.get(entity.key);
      if (previousIndex !== undefined) {
        markConflict(
          previewRows,
          stagedRows,
          previousIndex,
          "shared_record_conflict",
          "同一批次不能通过多张工单重复修改同一客户或设备",
        );
        markConflict(
          previewRows,
          stagedRows,
          rowIndex,
          "shared_record_conflict",
          "同一批次不能通过多张工单重复修改同一客户或设备",
        );
      } else sharedTargets.set(entity.key, rowIndex);
    }
  });

  const createPhones = new Map<string, { rowIndex: number; name: string }>();
  stagedRows.forEach((row, rowIndex) => {
    if (row.action !== "create" || row.status === "invalid") return;
    const phoneRaw = String(row.normalized_data.customer_phone_raw ?? "");
    if (!phoneRaw) return;
    const name = normalizeComparable(row.normalized_data.customer_name);
    const previous = createPhones.get(phoneRaw);
    if (previous && previous.name !== name) {
      markConflict(
        previewRows,
        stagedRows,
        previous.rowIndex,
        "customer_phone_collision",
        "同一手机号对应了不同客户姓名",
      );
      markConflict(
        previewRows,
        stagedRows,
        rowIndex,
        "customer_phone_collision",
        "同一手机号对应了不同客户姓名",
      );
    } else if (!previous) createPhones.set(phoneRaw, { rowIndex, name });
  });
}

function markConflict(
  previewRows: OrderDataImportPreviewRow[],
  stagedRows: OrderDataStagedRow[],
  rowIndex: number,
  code: string,
  message: string,
) {
  if (!previewRows[rowIndex].errors.some((issue) => issue.code === code)) {
    previewRows[rowIndex].errors.push({ code, message });
    stagedRows[rowIndex].errors.push({ code, message });
  }
  previewRows[rowIndex].status = "invalid";
  stagedRows[rowIndex].status = "invalid";
}

function normalizeComparable(value: unknown) {
  return String(value ?? "")
    .trim()
    .replace(/\s+/g, " ")
    .toLocaleLowerCase();
}

function quoteApprovalWasTouched(order: OrderDataDbRow) {
  return Boolean(
    order.approval_status === "approved" ||
    order.approval_status === "rejected" ||
    order.approval_flow_status === "waiting_customer" ||
    order.approval_sent_at ||
    order.approval_confirmed_at,
  );
}
