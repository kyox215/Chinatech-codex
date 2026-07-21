import type { RepairOrderStatus } from "@/lib/mock/enums";
import type { BusinessReasonSelectionV2 } from "@/lib/repairdesk/types";

export const ORDER_REASON_CATALOG_REVISION = "order-reasons-2026-07-21.v1";

export type OrderReasonContext =
  | "transition.cancel"
  | "transition.unfixed_pickup"
  | "transition.mail_in"
  | "transition.rework"
  | "approval.reject"
  | "finance.initial_deposit_correction"
  | "warranty.zero"
  | "warranty.shorten"
  | "warranty.extend"
  | "terminal.correct"
  | "terminal.reopen"
  | "terminal.void";

export type OrderReasonOption = {
  code: string;
  staffLabel: string;
  staffDescription?: string;
  legacyText: string;
  requiresNote?: boolean;
};

export type OrderReasonCatalog = {
  context: OrderReasonContext;
  title: string;
  description: string;
  required: boolean;
  catalogRevision: string;
  options: readonly OrderReasonOption[];
};

export type ActorScopedOrderReasonCatalog = {
  context: OrderReasonContext;
  policy: "required";
  catalog_revision: string;
  cardinality: { primary: 1; detail_min: 0; detail_max: 0 };
  title: string;
  description: string;
  options: Array<{
    code: string;
    staff_label: string;
    staff_description?: string;
    requires_note: boolean;
  }>;
};

export type OrderReasonDraft = {
  primaryCode: string;
  note: string;
};

const otherOption: OrderReasonOption = {
  code: "other",
  staffLabel: "其他原因",
  staffDescription: "只有现有选项都不适用时才填写。",
  legacyText: "",
  requiresNote: true,
};

const catalogs: Record<OrderReasonContext, OrderReasonCatalog> = {
  "transition.cancel": catalog(
    "transition.cancel",
    "选择取消原因",
    "取消会终止当前工单。请选择最接近的实际原因。",
    [
      option(
        "customer_cancelled",
        "客户主动取消",
        "客户临时取消或改期处理。",
        "客户主动取消本次维修。",
      ),
      option(
        "duplicate_order",
        "重复或误建",
        "重复录入或工单信息创建有误。",
        "重复或误建工单，取消本次工单。",
      ),
      option(
        "device_not_arrived",
        "设备未到店",
        "邮寄或送修设备没有实际到店。",
        "设备未到店，取消本次工单。",
      ),
      option(
        "shop_unable",
        "门店无法处理",
        "当前设备、配件或服务范围不支持。",
        "门店当前无法承接该维修，取消本次工单。",
      ),
      option(
        "parts_unavailable",
        "配件不可用",
        "配件无货、停产或等待周期无法接受。",
        "所需配件暂不可用，取消本次工单。",
      ),
      option(
        "risk_too_high",
        "维修风险过高",
        "继续处理可能造成不可接受的风险。",
        "维修风险过高，取消本次工单。",
      ),
      otherOption,
    ],
  ),
  "transition.unfixed_pickup": catalog(
    "transition.unfixed_pickup",
    "选择未修取机原因",
    "原因只说明为何未修交还，不会自动新增诊断结论。",
    [
      option(
        "customer_declined",
        "客户放弃维修",
        "客户选择不再继续本次维修。",
        "客户选择不继续维修，设备未修复交还。",
      ),
      option(
        "unable_to_repair",
        "无法完成维修",
        "当前检测和能力范围内无法修复。",
        "当前检测结果无法完成维修，设备未修复交还。",
      ),
      option(
        "parts_unavailable",
        "配件不可获得",
        "所需配件无货、停产或无法采购。",
        "所需配件不可获得，设备未修复交还。",
      ),
      option(
        "risk_unacceptable",
        "风险不可接受",
        "继续维修的损坏或资料风险过高。",
        "维修风险不可接受，设备未修复交还。",
      ),
      otherOption,
    ],
  ),
  "transition.mail_in": catalog(
    "transition.mail_in",
    "选择转外修原因",
    "这里只记录转外修原因；外修商、时间和物流证据另行记录。",
    [
      option(
        "board_repair",
        "主板外修",
        "需要主板级维修或显微焊接。",
        "门店检测后需要转主板级外修处理。",
      ),
      option(
        "after_shop_diagnosis",
        "门店检测后转外修",
        "店内检测后需要外部设备或技术继续处理。",
        "门店检测后需要转外部维修方继续处理。",
      ),
      option(
        "supplier_review",
        "供应商复检",
        "需要外部维修方确认可行性、周期或成本。",
        "需要外部维修方复检维修可行性、周期或成本。",
      ),
      option(
        "specialist_risk",
        "高风险专项处理",
        "资料、进水、短路等需要专项处理。",
        "设备需要外部专项高风险处理。",
      ),
      otherOption,
    ],
  ),
  "transition.rework": catalog(
    "transition.rework",
    "选择返修复检原因",
    "返修只表示结案后重新进入复检，不自动承诺免费或保修责任。",
    [
      option(
        "suspected_same_issue",
        "疑似原故障复发",
        "客户反馈与原维修现象相近。",
        "客户反馈疑似原故障复发，转入返修复检。",
      ),
      option(
        "new_symptom",
        "出现新现象",
        "先复检是否与原维修有关。",
        "客户反馈出现新的异常现象，转入返修复检并等待判定。",
      ),
      option(
        "closed_too_early",
        "状态可能误结案",
        "工单可能在工作完成前被结案。",
        "工单状态可能误结案，重新打开核查。",
      ),
      option(
        "missed_followup",
        "仍有遗漏处理",
        "结案后发现仍有事项需要继续。",
        "仍有遗漏事项需要继续处理，重新打开工单。",
      ),
      otherOption,
    ],
  ),
  "approval.reject": catalog(
    "approval.reject",
    "选择客户拒绝原因",
    "拒绝原因与下一步状态分开记录。",
    [
      option(
        "price_too_high",
        "报价过高",
        "客户认为维修费用不合适。",
        "客户认为报价过高，拒绝本次维修方案。",
      ),
      option(
        "no_longer_needed",
        "不再维修",
        "客户决定不再处理该设备。",
        "客户决定不再维修，拒绝本次维修方案。",
      ),
      option(
        "needs_time",
        "需要继续考虑",
        "客户暂不确认当前方案。",
        "客户需要继续考虑，暂未接受本次维修方案。",
      ),
      option(
        "wait_too_long",
        "时间无法接受",
        "维修或配件等待时间不符合客户需求。",
        "客户无法接受预计处理时间，拒绝本次维修方案。",
      ),
      otherOption,
    ],
  ),
  "finance.initial_deposit_correction": catalog(
    "finance.initial_deposit_correction",
    "选择初始定金更正原因",
    "仅用于修正建单时记录的初始定金，不处理退款、支付方式或后续收款。",
    [
      option(
        "entered_too_high",
        "建单时多录",
        "初始定金金额录得高于实际。",
        "建单时初始定金金额多录，现按实际金额更正。",
      ),
      option(
        "entered_too_low",
        "建单时少录",
        "初始定金金额录得低于实际。",
        "建单时初始定金金额少录，现按实际金额更正。",
      ),
      option(
        "not_received",
        "实际未收但误录",
        "建单时误记为已经收到定金。",
        "建单时误录已收初始定金，现更正为实际金额。",
      ),
      option(
        "duplicate_entry",
        "同一金额重复录入",
        "同一笔初始金额被重复计入。",
        "同一笔初始定金被重复录入，现更正为实际金额。",
      ),
      option(
        "historical_value",
        "历史建单值更正",
        "核对旧单后修正初始记录。",
        "核对历史建单记录后，更正初始定金金额。",
      ),
      otherOption,
    ],
  ),
  "warranty.zero": warrantyCatalog("warranty.zero", "选择无质保原因", [
    option(
      "no_warranty_item",
      "不含质保项目",
      "本项目本身不包含门店质保。",
      "该维修项目不包含门店质保。",
    ),
    option(
      "customer_part",
      "客户自带配件",
      "配件由客户提供。",
      "客户自带配件，本次不提供配件质保。",
    ),
    option(
      "software_service",
      "软件服务",
      "属于软件或资料类服务。",
      "本次为软件或资料类服务，不提供硬件质保。",
    ),
    option(
      "high_risk",
      "高风险维修",
      "维修风险和设备状态不适合承诺质保。",
      "本次属于高风险维修，不提供门店质保。",
    ),
    otherOption,
  ]),
  "warranty.shorten": warrantyCatalog("warranty.shorten", "选择缩短质保原因", [
    option(
      "service_scope",
      "服务范围调整",
      "质保期按实际维修范围缩短。",
      "根据实际维修范围缩短质保期。",
    ),
    option(
      "customer_part",
      "客户自带配件",
      "配件来源影响质保范围。",
      "客户自带配件，质保期按门店承诺调整。",
    ),
    option(
      "high_risk",
      "高风险维修",
      "设备状态需要缩短质保承诺。",
      "因设备维修风险调整并缩短质保期。",
    ),
    option(
      "historical_correction",
      "历史记录更正",
      "原质保月数录入不准确。",
      "原质保记录有误，现按实际承诺更正。",
    ),
    otherOption,
  ]),
  "warranty.extend": warrantyCatalog("warranty.extend", "选择延长质保原因", [
    option(
      "shop_commitment",
      "门店特别承诺",
      "门店对本次维修提供更长质保。",
      "门店对本次维修提供特别延长质保。",
    ),
    option(
      "service_package",
      "维修方案包含延保",
      "所选方案包含更长质保。",
      "本次维修方案包含延长质保。",
    ),
    option(
      "historical_correction",
      "历史记录更正",
      "原质保月数录入不准确。",
      "原质保记录有误，现按实际承诺更正。",
    ),
    otherOption,
  ]),
  "terminal.correct": catalog(
    "terminal.correct",
    "选择结案记录纠正原因",
    "纠正会保留原记录并写入审计，不会删除历史。",
    [
      option(
        "record_inaccurate",
        "原记录不准确",
        "结案内容与实际情况不一致。",
        "结案记录与实际情况不一致，现进行纠正。",
      ),
      option(
        "missing_information",
        "遗漏必要信息",
        "结案时漏录了需要保留的信息。",
        "结案记录遗漏必要信息，现进行补充纠正。",
      ),
      option(
        "customer_device_mismatch",
        "客户或设备信息错误",
        "客户或设备资料需要纠正。",
        "结案记录中的客户或设备信息有误，现进行纠正。",
      ),
      option(
        "historical_correction",
        "历史记录更正",
        "核对后更正历史工单内容。",
        "核对历史记录后，对结案工单进行纠正。",
      ),
      otherOption,
    ],
  ),
  "terminal.reopen": catalog(
    "terminal.reopen",
    "选择重新打开原因",
    "重新打开不会自动承诺保修或免费处理。",
    [
      option(
        "suspected_warranty_rework",
        "疑似保修返修",
        "先重新检测，再判断是否属于原项目保修。",
        "客户反馈疑似原项目问题，重新打开工单复检。",
      ),
      option(
        "closed_too_early",
        "状态误结案",
        "工单在工作完成前被结案。",
        "工单状态误结案，重新打开继续处理。",
      ),
      option(
        "missed_followup",
        "遗漏后续处理",
        "仍有未完成事项需要继续。",
        "结案后发现仍有遗漏事项，重新打开继续处理。",
      ),
      option(
        "record_followup",
        "资料需要补充",
        "需要继续处理与原单相关的资料。",
        "结案后仍需补充处理资料，重新打开工单。",
      ),
      otherOption,
    ],
  ),
  "terminal.void": catalog(
    "terminal.void",
    "选择安全作废原因",
    "作废保留订单、付款、附件、消息和审计证据。",
    [
      option(
        "duplicate_order",
        "重复工单",
        "同一业务被重复建立。",
        "该记录为重复工单，现安全作废。",
      ),
      option("test_data", "测试数据", "该工单仅用于测试。", "该记录为测试数据，现安全作废。"),
      option(
        "wrong_binding",
        "客户或设备绑定错误",
        "工单绑定到错误客户或设备。",
        "该工单绑定的客户或设备错误，现安全作废。",
      ),
      option(
        "creation_residue",
        "创建失败残留",
        "创建过程中留下不可用记录。",
        "该记录为创建失败残留，现安全作废。",
      ),
      otherOption,
    ],
  ),
};

function option(
  code: string,
  staffLabel: string,
  staffDescription: string,
  legacyText: string,
): OrderReasonOption {
  return { code, staffLabel, staffDescription, legacyText };
}

function catalog(
  context: OrderReasonContext,
  title: string,
  description: string,
  options: readonly OrderReasonOption[],
): OrderReasonCatalog {
  return {
    context,
    title,
    description,
    required: true,
    catalogRevision: ORDER_REASON_CATALOG_REVISION,
    options,
  };
}

function warrantyCatalog(
  context: Extract<OrderReasonContext, `warranty.${string}`>,
  title: string,
  options: readonly OrderReasonOption[],
) {
  return catalog(context, title, "非默认质保会记录原因、员工和时间。", options);
}

export function createEmptyOrderReasonDraft(): OrderReasonDraft {
  return { primaryCode: "", note: "" };
}

export function getOrderReasonCatalog(context: OrderReasonContext): OrderReasonCatalog {
  return catalogs[context];
}

export function getOrderTransitionReasonContext(
  target: RepairOrderStatus,
): OrderReasonContext | undefined {
  if (target === "cancelled") return "transition.cancel";
  if (target === "unfixed_pickup") return "transition.unfixed_pickup";
  if (target === "mail_in_progress") return "transition.mail_in";
  if (target === "rework") return "transition.rework";
  return undefined;
}

export function getWarrantyReasonContext(
  fromMonths: number,
  toMonths: number,
): Extract<OrderReasonContext, `warranty.${string}`> | undefined {
  if (fromMonths === toMonths) return undefined;
  if (toMonths === 0) return "warranty.zero";
  return toMonths < fromMonths ? "warranty.shorten" : "warranty.extend";
}

export function isOrderReasonDraftComplete(catalog: OrderReasonCatalog, draft: OrderReasonDraft) {
  if (!draft.primaryCode) return !catalog.required;
  const selected = catalog.options.find((entry) => entry.code === draft.primaryCode);
  if (!selected) return false;
  return !selected.requiresNote || Boolean(normalizeOrderReasonNote(draft.note));
}

export function buildBusinessReasonSelection(
  catalog: OrderReasonCatalog,
  draft: OrderReasonDraft,
): BusinessReasonSelectionV2 | undefined {
  if (!isOrderReasonDraftComplete(catalog, draft)) return undefined;
  const note = normalizeOrderReasonNote(draft.note);
  if (draft.primaryCode === "other") {
    return {
      schema_version: 2,
      kind: "other",
      primary_code: "other",
      note,
      catalog_revision: catalog.catalogRevision,
    };
  }
  return {
    schema_version: 2,
    kind: "preset",
    primary_code: draft.primaryCode,
    ...(note ? { note } : {}),
    catalog_revision: catalog.catalogRevision,
  };
}

export function getOrderReasonLegacyPreview(catalog: OrderReasonCatalog, draft: OrderReasonDraft) {
  const selected = catalog.options.find((entry) => entry.code === draft.primaryCode);
  if (!selected) return "";
  const note = normalizeOrderReasonNote(draft.note);
  if (selected.requiresNote) return note;
  return note ? `${selected.legacyText}\n补充：${note}` : selected.legacyText;
}

export function normalizeOrderReasonNote(value: string) {
  return value.normalize("NFC").replace(/\r\n?/g, "\n").trim();
}
