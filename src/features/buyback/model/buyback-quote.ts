import type { CreateInventoryIntakeInput, InventoryListItem } from "@/lib/repairdesk/types";

export const buybackQuoteSteps = [
  { key: "basic", label: "基本信息" },
  { key: "appearance", label: "外观检测" },
  { key: "function", label: "功能检测" },
  { key: "result", label: "估价结果" },
] as const;

export type BuybackQuoteStep = (typeof buybackQuoteSteps)[number]["key"];
export type BuybackQuoteRiskLevel = "low" | "medium" | "high";

export interface BuybackQuoteDraft {
  customer_name: string;
  customer_phone: string;
  brand: string;
  model: string;
  storage_capacity: string;
  color: string;
  serial_or_imei: string;
  purchase_region: string;
  warranty_status: string;
  market_price: string;
  target_profit: string;
  estimated_repair_cost: string;
  cosmetic_grade: "s" | "a_plus" | "a" | "b" | "c" | "d";
  screen_condition: "normal" | "light_scratches" | "deep_scratches" | "cracked" | "display_issue";
  body_condition: "normal" | "light_wear" | "heavy_wear" | "bent";
  battery_health: string;
  face_id_status: "pass" | "fail" | "not_applicable";
  camera_status: "pass" | "fail" | "unchecked";
  charging_status: "pass" | "fail" | "unchecked";
  account_unlocked: boolean;
  activation_lock_off: boolean;
  purchase_proof: boolean;
  box_included: boolean;
  manual_offer: string;
  manual_reason: string;
  quote_valid_days: string;
}

export interface BuybackQuoteDeduction {
  key: string;
  label: string;
  amount: number;
}

export interface BuybackInspectionSummaryItem {
  label: string;
  value: string;
  tone: "success" | "warn" | "danger" | "neutral";
}

export interface BuybackQuoteResult {
  resaleReference: number;
  marketMin: number;
  marketMax: number;
  suggestedLow: number;
  suggestedHigh: number;
  systemOffer: number;
  finalOffer: number;
  estimatedRepairCost: number;
  targetProfit: number;
  expectedProfit: number;
  deductions: BuybackQuoteDeduction[];
  riskLevel: BuybackQuoteRiskLevel;
  riskNotes: string[];
  approvalReasons: string[];
  hardBlock: boolean;
  validDays: number;
  inspectionItems: BuybackInspectionSummaryItem[];
}

const cosmeticDeductions: Record<BuybackQuoteDraft["cosmetic_grade"], number> = {
  s: 0,
  a_plus: 15,
  a: 25,
  b: 55,
  c: 110,
  d: 220,
};

const cosmeticLabels: Record<BuybackQuoteDraft["cosmetic_grade"], string> = {
  s: "S 接近全新",
  a_plus: "A+ 极轻微使用痕迹",
  a: "A 轻微使用痕迹",
  b: "B 明显使用痕迹",
  c: "C 重度使用痕迹",
  d: "D 仅适合拆件",
};

const screenDeductions: Record<BuybackQuoteDraft["screen_condition"], number> = {
  normal: 0,
  light_scratches: 15,
  deep_scratches: 45,
  cracked: 120,
  display_issue: 180,
};

const screenLabels: Record<BuybackQuoteDraft["screen_condition"], string> = {
  normal: "屏幕正常",
  light_scratches: "屏幕轻微划痕",
  deep_scratches: "屏幕明显划痕",
  cracked: "屏幕破裂",
  display_issue: "显示异常",
};

const bodyDeductions: Record<BuybackQuoteDraft["body_condition"], number> = {
  normal: 0,
  light_wear: 15,
  heavy_wear: 45,
  bent: 120,
};

const bodyLabels: Record<BuybackQuoteDraft["body_condition"], string> = {
  normal: "外壳正常",
  light_wear: "外观轻微磨损",
  heavy_wear: "外观明显磨损",
  bent: "机身变形",
};

export const defaultBuybackQuoteDraft: BuybackQuoteDraft = {
  customer_name: "",
  customer_phone: "",
  brand: "Apple",
  model: "iPhone 13 Pro",
  storage_capacity: "256GB",
  color: "远峰蓝色",
  serial_or_imei: "",
  purchase_region: "欧盟",
  warranty_status: "已过保",
  market_price: "520",
  target_profit: "120",
  estimated_repair_cost: "0",
  cosmetic_grade: "a",
  screen_condition: "light_scratches",
  body_condition: "light_wear",
  battery_health: "85",
  face_id_status: "pass",
  camera_status: "pass",
  charging_status: "pass",
  account_unlocked: true,
  activation_lock_off: true,
  purchase_proof: false,
  box_included: false,
  manual_offer: "",
  manual_reason: "",
  quote_valid_days: "7",
};

export function calculateBuybackQuote(draft: BuybackQuoteDraft): BuybackQuoteResult {
  const resaleReference = positiveMoney(draft.market_price, 0);
  const targetProfit = positiveMoney(draft.target_profit, 120);
  const estimatedRepairCost = positiveMoney(draft.estimated_repair_cost, 0);
  const validDays = Math.max(1, Math.round(positiveMoney(draft.quote_valid_days, 7)));
  const batteryHealth = clamp(Math.round(positiveMoney(draft.battery_health, 0)), 0, 100);
  const deductions: BuybackQuoteDeduction[] = [];

  pushDeduction(
    deductions,
    "cosmetic",
    cosmeticLabels[draft.cosmetic_grade],
    cosmeticDeductions[draft.cosmetic_grade],
  );
  pushDeduction(
    deductions,
    "screen",
    screenLabels[draft.screen_condition],
    screenDeductions[draft.screen_condition],
  );
  pushDeduction(
    deductions,
    "body",
    bodyLabels[draft.body_condition],
    bodyDeductions[draft.body_condition],
  );

  const batteryDeduction = getBatteryDeduction(batteryHealth);
  pushDeduction(deductions, "battery", `电池健康 ${batteryHealth || "-"}%`, batteryDeduction);
  pushDeduction(
    deductions,
    "face_id",
    "Face ID / Touch ID 异常",
    draft.face_id_status === "fail" ? 80 : 0,
  );
  pushDeduction(deductions, "camera", "相机功能异常", draft.camera_status === "fail" ? 45 : 0);
  pushDeduction(deductions, "charging", "充电功能异常", draft.charging_status === "fail" ? 35 : 0);
  pushDeduction(deductions, "proof", "缺少购买凭证", draft.purchase_proof ? 0 : 10);
  pushDeduction(deductions, "box", "缺少盒子/配件", draft.box_included ? 0 : 5);

  const riskNotes: string[] = [];
  if (!draft.account_unlocked) riskNotes.push("客户暂不能解锁设备");
  if (!draft.activation_lock_off) riskNotes.push("账号锁 / Find My / FRP 未确认关闭");
  if (!draft.purchase_proof) riskNotes.push("缺少购买凭证");
  if (batteryHealth > 0 && batteryHealth < 80) riskNotes.push("电池健康偏低");
  if (draft.screen_condition === "cracked" || draft.screen_condition === "display_issue") {
    riskNotes.push("屏幕存在高维修成本风险");
  }
  if (draft.face_id_status === "fail") riskNotes.push("生物识别异常");
  if (draft.camera_status === "fail" || draft.charging_status === "fail") {
    riskNotes.push("核心功能存在异常");
  }

  const hardBlock = !draft.account_unlocked || !draft.activation_lock_off;
  const riskLevel: BuybackQuoteRiskLevel = hardBlock
    ? "high"
    : riskNotes.length >= 2
      ? "medium"
      : "low";

  const deductionTotal = deductions.reduce((sum, item) => sum + item.amount, 0);
  const systemOffer = roundToFive(
    Math.max(0, resaleReference - targetProfit - estimatedRepairCost - deductionTotal),
  );
  const manualOffer = positiveMoney(draft.manual_offer, 0);
  const finalOffer = manualOffer > 0 ? roundMoney(manualOffer) : systemOffer;
  const suggestedLow = roundToFive(Math.max(0, systemOffer - 30));
  const suggestedHigh = Math.max(systemOffer, roundToFive(systemOffer + 20));
  const marketMin = roundToFive(Math.max(0, resaleReference - 35));
  const marketMax = roundToFive(resaleReference + 45);

  const approvalReasons: string[] = [];
  if (manualOffer > 0 && manualOffer > suggestedHigh * 1.1) {
    approvalReasons.push("人工报价超过系统建议上限 10%");
  }
  if (finalOffer > 500) approvalReasons.push("单台报价超过 €500");
  if (riskLevel === "high") approvalReasons.push("高风险设备需要负责人复核");
  if (resaleReference - finalOffer - estimatedRepairCost < targetProfit * 0.75) {
    approvalReasons.push("预计利润低于目标利润线");
  }

  return {
    resaleReference,
    marketMin,
    marketMax,
    suggestedLow,
    suggestedHigh,
    systemOffer,
    finalOffer,
    estimatedRepairCost,
    targetProfit,
    expectedProfit: roundMoney(resaleReference - finalOffer - estimatedRepairCost),
    deductions,
    riskLevel,
    riskNotes,
    approvalReasons,
    hardBlock,
    validDays,
    inspectionItems: buildInspectionItems(draft, batteryHealth),
  };
}

export function buildBuybackQuoteCreateInput(
  draft: BuybackQuoteDraft,
  result: BuybackQuoteResult,
): CreateInventoryIntakeInput {
  const quoteExpiresAt = new Date(
    Date.now() + result.validDays * 24 * 60 * 60 * 1000,
  ).toISOString();
  return {
    customer_name: optional(draft.customer_name),
    customer_phone: optional(draft.customer_phone),
    category: "phone",
    brand: draft.brand.trim() || "Other",
    model: draft.model.trim(),
    storage_capacity: optional(draft.storage_capacity),
    color: optional(draft.color),
    serial_or_imei: optional(draft.serial_or_imei),
    quoted_offer: result.finalOffer,
    quote_expires_at: quoteExpiresAt,
    list_price: result.resaleReference,
    buyback_price: 0,
    notes: buildBuybackQuoteNotes(draft, result),
    quote_payload: {
      buyback_quote: {
        final_offer: result.finalOffer,
        system_offer: result.systemOffer,
        suggested_low: result.suggestedLow,
        suggested_high: result.suggestedHigh,
        market_min: result.marketMin,
        market_max: result.marketMax,
        expected_profit: result.expectedProfit,
        risk_level: result.riskLevel,
        risk_notes: result.riskNotes,
        approval_reasons: result.approvalReasons,
        hard_block: result.hardBlock,
        deductions: result.deductions,
        quote_expires_at: quoteExpiresAt,
      },
      buyback_device: {
        purchase_region: draft.purchase_region,
        warranty_status: draft.warranty_status,
        battery_health: positiveMoney(draft.battery_health, 0),
        cosmetic_grade: cosmeticLabels[draft.cosmetic_grade],
        screen_condition: screenLabels[draft.screen_condition],
        body_condition: bodyLabels[draft.body_condition],
      },
    },
  };
}

export function getBuybackQuoteOffer(item: InventoryListItem) {
  const finalOffer = getBuybackQuotePayload(item).final_offer;
  return typeof finalOffer === "number" ? finalOffer : (item.buyback_price ?? 0);
}

export function getBuybackRiskLevel(item: InventoryListItem): BuybackQuoteRiskLevel {
  return (getBuybackQuotePayload(item).risk_level as BuybackQuoteRiskLevel | undefined) ?? "low";
}

export function getBuybackQuotePayload(item: InventoryListItem) {
  const payload = item.legacy_payload?.buyback_quote;
  return isRecord(payload) ? payload : {};
}

export function buildWhatsappQuoteMessage(draft: BuybackQuoteDraft, result: BuybackQuoteResult) {
  const customer = draft.customer_name.trim() || "Cliente";
  const device = [draft.brand, draft.model, draft.storage_capacity].filter(Boolean).join(" ");
  const summary = result.deductions.length
    ? result.deductions
        .map((item) => item.label)
        .slice(0, 3)
        .join(", ")
    : "condizioni generali buone";

  return [
    `Ciao ${customer}, abbiamo completato la valutazione del tuo ${device}.`,
    "",
    `Offerta di acquisto: €${result.finalOffer.toFixed(2)}`,
    `Condizione: ${cosmeticLabels[draft.cosmetic_grade]}`,
    `Note principali: ${summary}`,
    `Validità offerta: ${result.validDays} giorni`,
    "",
    "Puoi rispondere a questo messaggio per confermare o passare in negozio.",
    "ChinaTech",
  ].join("\n");
}

export function normalizeWhatsappPhone(phone: string) {
  const digits = phone.replace(/\D/g, "");
  if (digits.startsWith("00")) return digits.slice(2);
  if (digits.startsWith("39")) return digits;
  if (digits.length >= 8) return `39${digits}`;
  return "";
}

function buildBuybackQuoteNotes(draft: BuybackQuoteDraft, result: BuybackQuoteResult) {
  const lines = [
    `回收报价：€${result.finalOffer.toFixed(2)}`,
    `市场参考：€${result.marketMin.toFixed(0)} - €${result.marketMax.toFixed(0)}`,
    `风险等级：${riskLabel(result.riskLevel)}`,
    `检测摘要：${result.inspectionItems.map((item) => `${item.label} ${item.value}`).join(" / ")}`,
  ];
  if (draft.manual_reason.trim()) lines.push(`人工改价原因：${draft.manual_reason.trim()}`);
  if (result.riskNotes.length) lines.push(`风险提示：${result.riskNotes.join("；")}`);
  return lines.join("\n");
}

function buildInspectionItems(
  draft: BuybackQuoteDraft,
  batteryHealth: number,
): BuybackInspectionSummaryItem[] {
  return [
    {
      label: "屏幕",
      value: screenLabels[draft.screen_condition],
      tone: draft.screen_condition === "normal" ? "success" : "warn",
    },
    {
      label: "电池健康",
      value: batteryHealth ? `${batteryHealth}%` : "未检测",
      tone: batteryHealth >= 85 ? "success" : batteryHealth >= 80 ? "warn" : "danger",
    },
    {
      label: "外观成色",
      value: cosmeticLabels[draft.cosmetic_grade],
      tone: ["s", "a_plus", "a"].includes(draft.cosmetic_grade) ? "success" : "warn",
    },
    {
      label: "Face ID",
      value: statusLabel(draft.face_id_status),
      tone: draft.face_id_status === "fail" ? "danger" : "success",
    },
    {
      label: "相机功能",
      value: statusLabel(draft.camera_status),
      tone:
        draft.camera_status === "fail"
          ? "danger"
          : draft.camera_status === "unchecked"
            ? "neutral"
            : "success",
    },
    {
      label: "充电功能",
      value: statusLabel(draft.charging_status),
      tone:
        draft.charging_status === "fail"
          ? "danger"
          : draft.charging_status === "unchecked"
            ? "neutral"
            : "success",
    },
  ];
}

function getBatteryDeduction(health: number) {
  if (health <= 0 || health >= 90) return 0;
  if (health >= 85) return 15;
  if (health >= 80) return 30;
  if (health >= 70) return 55;
  return 85;
}

function pushDeduction(items: BuybackQuoteDeduction[], key: string, label: string, amount: number) {
  if (amount <= 0) return;
  items.push({ key, label, amount: roundMoney(amount) });
}

function positiveMoney(text: string, fallback: number) {
  const value = Number(String(text).replace(",", "."));
  return Number.isFinite(value) && value >= 0 ? value : fallback;
}

function roundToFive(value: number) {
  return Math.floor(roundMoney(value) / 5) * 5;
}

function roundMoney(value: number) {
  return Math.round((Number(value) + Number.EPSILON) * 100) / 100;
}

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value));
}

function optional(value: string) {
  const text = value.trim();
  return text ? text : undefined;
}

function statusLabel(status: "pass" | "fail" | "unchecked" | "not_applicable") {
  if (status === "pass") return "正常";
  if (status === "fail") return "异常";
  if (status === "not_applicable") return "不适用";
  return "未检测";
}

function riskLabel(risk: BuybackQuoteRiskLevel) {
  if (risk === "high") return "高风险";
  if (risk === "medium") return "中风险";
  return "低风险";
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
