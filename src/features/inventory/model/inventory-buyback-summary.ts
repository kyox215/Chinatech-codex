import type {
  InventoryCheckStatus,
  InventoryItem,
  InventoryItemStatus,
} from "@/lib/repairdesk/types";

export interface InventoryBuybackProofRow {
  key: string;
  label: string;
  done: boolean;
}

export interface InventoryBuybackDeductionRow {
  label: string;
  amount: number;
}

export interface InventoryBuybackRepairRow {
  key: string;
  label: string;
  detail: string;
  priority: "low" | "medium" | "high";
}

export interface InventoryBuybackSummary {
  hasBuybackQuote: boolean;
  offer: number;
  purchaseCost: number;
  repairCost: number;
  fees: number;
  costBasis: number;
  quoteExpiresAt?: string;
  riskLevel: "low" | "medium" | "high" | "unknown";
  hardBlock: boolean;
  statusLabel: string;
  statusTone: "neutral" | "info" | "warning" | "success" | "danger";
  statusDetail: string;
  proofDone: number;
  proofTotal: number;
  proofRows: InventoryBuybackProofRow[];
  riskNotes: string[];
  deductions: InventoryBuybackDeductionRow[];
  repairIssueSummary: string;
  repairRows: InventoryBuybackRepairRow[];
}

type InventoryBuybackSummaryInput = Pick<
  InventoryItem,
  | "source_type"
  | "legacy_payload"
  | "buyback_price"
  | "repair_cost_amount"
  | "fees_amount"
  | "status"
  | "imei_check_status"
  | "activation_lock_status"
  | "data_wipe_status"
>;

export function buildInventoryBuybackSummary(
  item: InventoryBuybackSummaryInput,
): InventoryBuybackSummary | null {
  const payload = asRecord(item.legacy_payload);
  const quote = asRecord(payload.buyback_quote);
  const customer = asRecord(payload.buyback_customer);
  const device = asRecord(payload.buyback_device);
  const repairPlan = asRecord(payload.buyback_repair_plan);
  const hasBuybackQuote = payload.has_buyback_quote === true || Object.keys(quote).length > 0;

  if (item.source_type !== "buyback" && !hasBuybackQuote) return null;

  const proofRows = buildProofRows(customer, device);
  const riskLevel = riskLevelValue(quote.risk_level);
  const hardBlock = quote.hard_block === true;
  const riskNotes = buildRiskNotes({
    quote,
    hardBlock,
    riskLevel,
    imei: item.imei_check_status,
    activationLock: item.activation_lock_status,
    dataWipe: item.data_wipe_status,
  });
  const deductions = buildDeductions(quote.deductions);
  const repairRows = buildRepairRows(repairPlan.items);
  const repairCost = numberValue(
    repairPlan.estimated_repair_cost,
    numberValue(quote.estimated_repair_cost, item.repair_cost_amount),
  );
  const purchaseCost = item.buyback_price;
  const fees = item.fees_amount;

  return {
    hasBuybackQuote,
    offer: numberValue(quote.final_offer, item.buyback_price),
    purchaseCost,
    repairCost,
    fees,
    costBasis: purchaseCost + repairCost + fees,
    quoteExpiresAt: stringValue(quote.quote_expires_at),
    riskLevel,
    hardBlock,
    ...buildStatus({
      status: item.status,
      hardBlock,
      riskLevel,
      proofRows,
      riskNotes,
      dataWipe: item.data_wipe_status,
    }),
    proofDone: proofRows.filter((row) => row.done).length,
    proofTotal: proofRows.length,
    proofRows,
    riskNotes,
    deductions,
    repairIssueSummary:
      stringValue(repairPlan.issue_summary) ??
      (repairRows.length ? repairRows.map((row) => row.label).join(" / ") : "未记录明确故障"),
    repairRows,
  };
}

function buildStatus({
  status,
  hardBlock,
  riskLevel,
  proofRows,
  riskNotes,
  dataWipe,
}: {
  status: InventoryItemStatus;
  hardBlock: boolean;
  riskLevel: InventoryBuybackSummary["riskLevel"];
  proofRows: InventoryBuybackProofRow[];
  riskNotes: string[];
  dataWipe: InventoryCheckStatus;
}): Pick<InventoryBuybackSummary, "statusLabel" | "statusTone" | "statusDetail"> {
  if (hardBlock || riskLevel === "high") {
    return {
      statusLabel: "回收风险复核",
      statusTone: "danger",
      statusDetail: riskNotes[0] ?? "存在账号锁、IMEI、抹除或高维修成本风险",
    };
  }

  const missingProof = proofRows.filter((row) => !row.done);
  if (missingProof.length > 0) {
    return {
      statusLabel: "凭证待补齐",
      statusTone: "warning",
      statusDetail: `还缺 ${missingProof.map((row) => row.label).join("、")}`,
    };
  }

  if (["purchased", "data_wipe", "refurbishing"].includes(status) || dataWipe !== "pass") {
    return {
      statusLabel: "回收整备中",
      statusTone: "info",
      statusDetail: dataWipe === "pass" ? "凭证已齐，继续整备上架" : "成交后先完成资料清除",
    };
  }

  if (["ready_for_sale", "listed", "reserved", "sold"].includes(status)) {
    return {
      statusLabel: "可售链路",
      statusTone: "success",
      statusDetail: status === "sold" ? "已完成售出，保留回收凭证" : "可继续挂牌、预留或售出",
    };
  }

  return {
    statusLabel: "回收记录",
    statusTone: "neutral",
    statusDetail: "这台库存来自回收报价流程",
  };
}

function buildProofRows(
  customer: Record<string, unknown>,
  device: Record<string, unknown>,
): InventoryBuybackProofRow[] {
  const purchaseProof = device.purchase_proof === true;
  const boxIncluded = device.box_included === true;
  return [
    { key: "signature", label: "客户签名", done: customer.signature_captured === true },
    { key: "id_front", label: "证件正面", done: customer.id_front_captured === true },
    { key: "id_back", label: "证件反面", done: customer.id_back_captured === true },
    { key: "device_photo", label: "设备照片", done: customer.device_photo_captured === true },
    {
      key: "invoice",
      label: purchaseProof ? "发票/凭证" : "无票确认",
      done: purchaseProof || customer.invoice_photo_captured === true,
    },
    {
      key: "box",
      label: boxIncluded ? "原装盒" : "无盒确认",
      done: boxIncluded || customer.box_photo_captured === true,
    },
  ];
}

function buildRiskNotes({
  quote,
  hardBlock,
  riskLevel,
  imei,
  activationLock,
  dataWipe,
}: {
  quote: Record<string, unknown>;
  hardBlock: boolean;
  riskLevel: InventoryBuybackSummary["riskLevel"];
  imei: InventoryCheckStatus;
  activationLock: InventoryCheckStatus;
  dataWipe: InventoryCheckStatus;
}) {
  const notes = stringArray(quote.risk_notes);
  if (hardBlock && !notes.length) notes.push("存在硬阻断，成交前必须复核");
  if (riskLevel === "high" && !notes.some((note) => note.includes("高风险"))) {
    notes.push("系统标记为高风险回收");
  }
  if (imei === "fail") notes.push("IMEI / 序列号检查未通过");
  if (activationLock === "fail") notes.push("账号锁 / Find My 未关闭");
  if (dataWipe === "fail") notes.push("资料无法抹除");
  return Array.from(new Set(notes));
}

function buildDeductions(value: unknown): InventoryBuybackDeductionRow[] {
  if (!Array.isArray(value)) return [];
  return value
    .map((row) => asRecord(row))
    .map((row) => ({
      label: stringValue(row.label) ?? stringValue(row.key) ?? "扣减项",
      amount: numberValue(row.amount, 0),
    }))
    .filter((row) => row.amount > 0);
}

function buildRepairRows(value: unknown): InventoryBuybackRepairRow[] {
  if (!Array.isArray(value)) return [];
  return value
    .map((row) => asRecord(row))
    .map((row, index) => ({
      key: stringValue(row.key) ?? `repair-${index}`,
      label: stringValue(row.label) ?? "待维修项目",
      detail: stringValue(row.detail) ?? "维修后记录实际成本",
      priority: priorityValue(row.priority),
    }));
}

function asRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
}

function stringValue(value: unknown) {
  return typeof value === "string" && value.trim() ? value : undefined;
}

function numberValue(value: unknown, fallback: number) {
  return typeof value === "number" && Number.isFinite(value) ? value : fallback;
}

function stringArray(value: unknown) {
  if (!Array.isArray(value)) return [];
  return value.filter((item): item is string => typeof item === "string" && item.trim().length > 0);
}

function riskLevelValue(value: unknown): InventoryBuybackSummary["riskLevel"] {
  if (value === "low" || value === "medium" || value === "high") return value;
  return "unknown";
}

function priorityValue(value: unknown): InventoryBuybackRepairRow["priority"] {
  if (value === "low" || value === "medium" || value === "high") return value;
  return "medium";
}
