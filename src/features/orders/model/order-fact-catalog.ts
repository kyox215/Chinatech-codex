import type { FactSelectionV2 } from "@/lib/repairdesk/types";

export const ORDER_FACT_CATALOG_REVISION = "order-facts-2026-07-21.v1";

export type OrderFactField = "intake_intent" | "reported_symptom" | "diagnostic_finding";

export type OrderFactOption = {
  code: string;
  label: string;
  legacyText: string;
  requiresNote?: boolean;
};

export const intakeIntentOptions: readonly OrderFactOption[] = [
  option("known_problem", "问题明确", "客户已说明明确问题"),
  option("pending_diagnosis", "问题未知，需检测", "客户暂不确定具体问题，需要门店检测"),
  option("customer_cannot_describe", "客户无法描述", "客户无法准确描述问题，需要门店检测"),
  option("diagnostic_only", "仅检测", "客户本次仅委托检测，暂未确认维修"),
];

export const reportedSymptomOptions: readonly OrderFactOption[] = [
  option("will_not_power_on", "无法开机", "无法开机"),
  option("will_not_charge", "无法充电", "无法充电"),
  option("screen_damaged", "屏幕破损", "屏幕破损"),
  option("touch_abnormal", "触控异常", "触控异常"),
  option("battery_drains_fast", "耗电很快", "电池耗电很快"),
  option("camera_abnormal", "相机异常", "相机功能异常"),
  option("audio_abnormal", "声音异常", "听筒、扬声器或麦克风异常"),
  option("liquid_contact", "疑似进液", "疑似进液或受潮"),
  option("software_abnormal", "系统/软件异常", "系统或软件异常"),
  option("other", "其他现象", "", true),
];

export const diagnosticFindingOptions: readonly OrderFactOption[] = [
  option("display_assembly_fault", "屏幕组件故障", "检测确认屏幕组件故障"),
  option("battery_degraded", "电池性能衰减", "检测确认电池性能衰减"),
  option("charging_port_fault", "充电接口故障", "检测确认充电接口故障"),
  option("liquid_damage", "进液/腐蚀", "检测发现进液或腐蚀痕迹"),
  option("mainboard_fault", "主板故障", "检测确认主板相关故障"),
  option("software_fault", "系统/软件故障", "检测确认系统或软件故障"),
  option("no_fault_found", "暂未复现故障", "当前检测暂未复现客户反馈的故障"),
  option("further_diagnosis", "需要继续检测", "当前证据不足，需要继续检测"),
  option("other", "其他结论", "", true),
];

const factConfigs: Record<
  OrderFactField,
  { label: string; prefix: string; options: readonly OrderFactOption[] }
> = {
  intake_intent: {
    label: "接单意图",
    prefix: "接单意图：",
    options: intakeIntentOptions,
  },
  reported_symptom: {
    label: "客户症状",
    prefix: "客户症状：",
    options: reportedSymptomOptions,
  },
  diagnostic_finding: {
    label: "检测发现",
    prefix: "检测发现：",
    options: diagnosticFindingOptions,
  },
};

export function getOrderFactConfig(field: OrderFactField) {
  return factConfigs[field];
}

export function buildFactSelection({
  field,
  codes,
  otherNote,
  catalogRevision = ORDER_FACT_CATALOG_REVISION,
}: {
  field: OrderFactField;
  codes: string[];
  otherNote?: string;
  catalogRevision?: string;
}): FactSelectionV2 | undefined {
  if (!codes.length) return undefined;
  validateFactSelection({
    schema_version: 2,
    field,
    codes: codes as [string, ...string[]],
    ...(otherNote?.trim() ? { other_note: normalizeFactNote(otherNote) } : {}),
    catalog_revision: catalogRevision,
  });
  return {
    schema_version: 2,
    field,
    codes: [...codes] as [string, ...string[]],
    ...(otherNote?.trim() ? { other_note: normalizeFactNote(otherNote) } : {}),
    catalog_revision: catalogRevision,
  };
}

export function validateFactSelection(selection: FactSelectionV2) {
  const config = factConfigs[selection.field];
  if (!config || selection.schema_version !== 2) throw new Error("结构化点选字段无效");
  if (selection.catalog_revision !== ORDER_FACT_CATALOG_REVISION) {
    throw new Error("点选目录已更新，请刷新后重新确认");
  }
  const max = selection.field === "intake_intent" ? 1 : 20;
  if (selection.codes.length < 1 || selection.codes.length > max) {
    throw new Error(
      selection.field === "intake_intent" ? "接单意图必须选择一项" : "点选内容数量无效",
    );
  }
  if (new Set(selection.codes).size !== selection.codes.length) throw new Error("点选内容不能重复");
  for (const code of selection.codes) {
    if (!config.options.some((option) => option.code === code)) {
      throw new Error("点选内容已停用或不可用，请重新确认");
    }
  }
  const hasOther = selection.codes.includes("other");
  const note = normalizeFactNote(selection.other_note ?? "");
  if (hasOther && !note) throw new Error("请填写其他内容");
  if (!hasOther && note) throw new Error("只有选择其他内容时才能填写补充说明");
  if (note.length > 500) throw new Error("其他内容不能超过 500 个字符");
  return selection;
}

export function intakeIntentCodeForMode(
  mode: "reported" | "unknown" | "cannot_describe" | "diagnostic_only",
) {
  if (mode === "unknown") return "pending_diagnosis";
  if (mode === "cannot_describe") return "customer_cannot_describe";
  if (mode === "diagnostic_only") return "diagnostic_only";
  return "known_problem";
}

export function buildFactCompatibilityText({
  existingText,
  field,
  codes,
  otherNote,
  catalogRevision = ORDER_FACT_CATALOG_REVISION,
  clearExistingSelection = false,
}: {
  existingText: string;
  field: OrderFactField;
  codes: string[];
  otherNote?: string;
  catalogRevision?: string;
  clearExistingSelection?: boolean;
}) {
  const config = factConfigs[field];
  const retained = existingText
    .replace(/\r\n?/g, "\n")
    .split("\n")
    .filter((line) => !line.trimStart().startsWith(config.prefix))
    .join("\n")
    .trim();
  if (!codes.length) return clearExistingSelection ? retained : existingText.trim();
  if (catalogRevision !== ORDER_FACT_CATALOG_REVISION) {
    throw new Error("点选目录已更新，请重新确认客户症状或检测结论");
  }
  if (new Set(codes).size !== codes.length) throw new Error("点选内容不能重复");
  const values = codes.map((code) => {
    const item = config.options.find((entry) => entry.code === code);
    if (!item) throw new Error("点选内容已停用或不可用，请重新确认");
    if (item.requiresNote) {
      const note = normalizeFactNote(otherNote ?? "");
      if (!note) throw new Error("请填写其他内容");
      return note;
    }
    return item.legacyText;
  });
  const compatibilityLine = `${config.prefix}${values.join("、")}`;
  return retained ? `${retained}\n${compatibilityLine}` : compatibilityLine;
}

export function normalizeFactNote(value: string) {
  return value.normalize("NFC").replace(/\r\n?/g, "\n").trim();
}

function option(
  code: string,
  label: string,
  legacyText: string,
  requiresNote = false,
): OrderFactOption {
  return { code, label, legacyText, ...(requiresNote ? { requiresNote } : {}) };
}
