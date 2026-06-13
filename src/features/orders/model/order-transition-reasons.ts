import type { RepairOrderStatus } from "@/lib/mock/enums";

export type OrderTransitionReasonPreset = {
  id: string;
  label: string;
  description: string;
  reason: string;
};

export type OrderTransitionReasonConfig = {
  title: string;
  description: string;
  required: boolean;
  presets: OrderTransitionReasonPreset[];
};

const transitionReasonConfigs: Partial<Record<string, OrderTransitionReasonConfig>> = {
  unfixed_pickup: {
    title: "选择未修取机原因",
    description: "用于客户不修、维修风险过高或设备不建议继续维修的情况。",
    required: true,
    presets: [
      {
        id: "repair-risk",
        label: "维修风险过高",
        description: "设备存在进一步损坏风险，客户确认取回。",
        reason: "维修风险过高，客户确认不继续维修并取回设备。",
      },
      {
        id: "quote-too-high",
        label: "报价过高",
        description: "客户认为维修费用不划算。",
        reason: "维修报价较高，客户放弃维修并取回设备。",
      },
      {
        id: "board-damage",
        label: "主板严重损坏",
        description: "主板腐蚀、短路或故障范围过大。",
        reason: "主板损坏较严重，不建议继续维修，客户取回设备。",
      },
      {
        id: "parts-unavailable",
        label: "配件不可用",
        description: "配件无货、停产或等待周期过长。",
        reason: "所需配件暂不可用，客户选择暂不维修并取回设备。",
      },
      {
        id: "data-account-risk",
        label: "资料/账户风险",
        description: "资料、账户锁或隐私风险需要客户自行处理。",
        reason: "涉及资料或账户风险，客户确认取回设备自行处理。",
      },
    ],
  },
  cancelled: {
    title: "选择取消原因",
    description: "取消会终止当前工单，请选择或填写可追溯原因。",
    required: true,
    presets: [
      {
        id: "customer-cancelled",
        label: "客户主动取消",
        description: "客户临时取消或改期处理。",
        reason: "客户主动取消本次维修。",
      },
      {
        id: "quote-rejected",
        label: "客户拒绝报价",
        description: "报价未通过，客户不继续处理。",
        reason: "客户未接受报价，取消本次维修。",
      },
      {
        id: "not-arrived",
        label: "设备未到店",
        description: "邮寄或送修设备未实际到店。",
        reason: "设备未到店，取消本次工单。",
      },
      {
        id: "duplicate-order",
        label: "重复/误建",
        description: "重复录入或创建信息有误。",
        reason: "重复或误建工单，已取消。",
      },
      {
        id: "shop-unable",
        label: "门店无法处理",
        description: "配件、设备或服务范围不支持。",
        reason: "门店暂无法处理该维修，取消本次工单。",
      },
    ],
  },
  rework: {
    title: "选择返修原因",
    description: "用于结案后客户反馈异常，需要重新进入流程。",
    required: true,
    presets: [
      {
        id: "same-issue",
        label: "原故障复发",
        description: "客户反馈与原维修项目相关。",
        reason: "客户反馈原故障复发，转入返修复检。",
      },
      {
        id: "new-symptom",
        label: "出现新现象",
        description: "需要确认是否与原维修相关。",
        reason: "客户反馈出现新的异常现象，转入返修复检。",
      },
    ],
  },
};

export function getOrderTransitionReasonConfig(
  to: RepairOrderStatus,
): OrderTransitionReasonConfig | undefined {
  return transitionReasonConfigs[to];
}

export function orderTransitionRequiresReason(to: RepairOrderStatus) {
  return Boolean(getOrderTransitionReasonConfig(to)?.required);
}

export function getDefaultOrderTransitionReason(to: RepairOrderStatus) {
  return getOrderTransitionReasonConfig(to)?.presets[0]?.reason ?? "";
}
