import type { OrderQueueGroup, OrderResultGroup, OrderWorkflow } from "@/lib/repairdesk/types";
import type { RepairOrderStatus } from "@/lib/mock/enums";
import type { MessageKey, MessageValues } from "@/shared/i18n/messages";

type Translate = (key: MessageKey, values?: MessageValues) => string;

const orderQueueHintKeys: Record<OrderQueueGroup, MessageKey> = {
  processing: "orders.processingHint",
  ordered: "orders.orderedHint",
  arrived: "orders.arrivedHint",
  arrived_notified: "orders.arrivedNotifiedHint",
  repaired: "orders.repairedHint",
  repaired_notified: "orders.repairedNotifiedHint",
};

const orderQueueMessageKeys: Record<
  OrderQueueGroup,
  { label: MessageKey; shortLabel: MessageKey }
> = {
  processing: { label: "orders.processing", shortLabel: "orders.processingShort" },
  ordered: { label: "orders.ordered", shortLabel: "orders.orderedShort" },
  arrived: { label: "orders.arrived", shortLabel: "orders.arrivedShort" },
  arrived_notified: {
    label: "orders.arrivedNotified",
    shortLabel: "orders.arrivedNotifiedShort",
  },
  repaired: { label: "orders.repaired", shortLabel: "orders.repairedShort" },
  repaired_notified: {
    label: "orders.repairedNotified",
    shortLabel: "orders.repairedNotifiedShort",
  },
};

const orderQueueStageMessageKeys: Record<
  OrderQueueGroup,
  { label: MessageKey; shortLabel: MessageKey; hint: MessageKey }
> = {
  processing: {
    label: "orders.queueStageProcessing",
    shortLabel: "orders.queueStageProcessingShort",
    hint: "orders.processingHint",
  },
  ordered: {
    label: "orders.queueStageOrdered",
    shortLabel: "orders.queueStageOrderedShort",
    hint: "orders.orderedHint",
  },
  arrived: {
    label: "orders.queueStageArrived",
    shortLabel: "orders.queueStageArrivedShort",
    hint: "orders.arrivedHint",
  },
  arrived_notified: {
    label: "orders.queueStageArrivedNotified",
    shortLabel: "orders.queueStageArrivedNotifiedShort",
    hint: "orders.arrivedNotifiedHint",
  },
  repaired: {
    label: "orders.queueStageRepaired",
    shortLabel: "orders.queueStageRepairedShort",
    hint: "orders.repairedHint",
  },
  repaired_notified: {
    label: "orders.queueStageRepairedNotified",
    shortLabel: "orders.queueStageRepairedNotifiedShort",
    hint: "orders.repairedNotifiedHint",
  },
};

const exceptionKeys: Record<string, [MessageKey, MessageKey]> = {
  cancelled: ["orders.exceptionCancelled", "orders.exceptionCancelledShort"],
  unrepairable: ["orders.exceptionUnrepairable", "orders.exceptionUnrepairableShort"],
  returned_unfixed: ["orders.returnedUnfixed", "orders.returnedUnfixedShort"],
  rework: ["orders.exceptionRework", "orders.exceptionReworkShort"],
  waiting_customer: ["orders.exceptionWaitingCustomer", "orders.exceptionWaitingCustomerShort"],
  paused: ["orders.exceptionPaused", "orders.exceptionPausedShort"],
};

const workflowLabelKeys: Partial<Record<RepairOrderStatus, MessageKey>> = {
  new: "orders.workflowIntake",
  diagnosing: "orders.workflowDiagnosis",
  quoted: "orders.workflowQuote",
  waiting_approval: "orders.workflowQuote",
  parts_ordered: "orders.workflowParts",
  parts_arrived: "orders.workflowParts",
  mail_in_progress: "orders.workflowRepair",
  repairing: "orders.workflowRepair",
  repaired: "orders.repaired",
  notified: "orders.workflowPickup",
  waiting_pickup: "orders.workflowPickup",
  unfixed_pickup: "orders.workflowPickup",
  completed: "orders.workflowClosed",
  cancelled: "orders.cancelled",
};

export function localizeWorkflowStatusLabel(
  workflow: OrderWorkflow | undefined,
  code: RepairOrderStatus,
  t: Translate,
) {
  const configured = workflow?.statuses.find((status) => status.code === code);
  if (configured && !configured.is_system) return configured.label;
  const key = workflowLabelKeys[code];
  return key ? t(key) : (configured?.label ?? code);
}

export function localizeBulkTransitionFeedback(
  { count, failures, to }: { count: number; failures: number; to: RepairOrderStatus },
  workflow: OrderWorkflow | undefined,
  t: Translate,
) {
  return t(failures ? "orders.bulkTransitionPartial" : "orders.bulkTransitionComplete", {
    count,
    label: localizeWorkflowStatusLabel(workflow, to, t),
    failures,
  });
}

export function localizeOrderQueueGroup(group: OrderQueueGroup, t: Translate) {
  const keys = orderQueueMessageKeys[group];
  return {
    label: t(keys.label),
    shortLabel: t(keys.shortLabel),
    hint: t(orderQueueHintKeys[group]),
  };
}

export function localizeOrderQueueStage(group: OrderQueueGroup, t: Translate) {
  const keys = orderQueueStageMessageKeys[group];
  return { label: t(keys.label), shortLabel: t(keys.shortLabel), hint: t(keys.hint) };
}

export function localizeOrderResultGroup(group: OrderResultGroup, t: Translate) {
  if (group === "completed")
    return { label: t("orders.completed"), hint: t("orders.completedHint") };
  if (group === "cancelled")
    return { label: t("orders.cancelled"), hint: t("orders.cancelledHint") };
  return localizeOrderQueueGroup(group, t);
}

export function localizeOrderFinancialLabel(
  state: { settlement: string; label: string },
  t: Translate,
) {
  const keyByLabel: Record<string, MessageKey | undefined> = {
    金额受限: "orders.amountRestricted",
    已退款: "orders.refunded",
    已取消: "orders.financialCancelled",
    金额待核对: "orders.amountReview",
    待报价: "orders.quotePending",
    待审批: "orders.awaitingApproval",
    报价已拒绝: "orders.quoteRejected",
    待确认报价: "orders.quoteAwaitingConfirmation",
    免收费: "orders.zeroCharge",
    "报价已拒绝 · 款项待核对": "orders.quoteRejectedBalanceReview",
    已结清: "orders.paid",
    已付押金: "orders.depositPaid",
    待收款: "orders.financialDue",
  };
  const key = keyByLabel[state.label];
  return key ? t(key) : state.label;
}

export function localizeOrderException(status: string, t: Translate) {
  const keys = exceptionKeys[status];
  return keys
    ? { label: t(keys[0]), shortLabel: t(keys[1]) }
    : { label: status, shortLabel: status };
}

const orderTypeKeys: Record<string, MessageKey> = {
  quick_repair: "orders.quickRepair",
  dropoff_repair: "orders.dropoffRepair",
};

export function localizeOrderType(type: string, t: Translate) {
  const key = orderTypeKeys[type];
  return key ? t(key) : type;
}

export function localizeDeviceCustody(
  status: string | null | undefined,
  deliveredAt: string | null | undefined,
  t: Translate,
) {
  if (status === "with_customer" && deliveredAt) return t("orders.custodyReturned");
  if (status === "with_customer") return t("orders.custodyCustomer");
  if (status === "with_shop") return t("orders.custodyShop");
  if (status === "returned") return t("orders.custodyReturned");
  return status ? status : t("orders.custodyUnknown");
}

export function localizeDeviceUnlockMethod(method: string | null | undefined, t: Translate) {
  if (method === "pin") return t("orders.unlockPin");
  if (method === "pattern") return t("orders.unlockPattern");
  if (method === "text") return t("orders.unlockText");
  return method ? method : t("orders.unlockNone");
}

const simpleStageKeys: Record<string, [MessageKey, MessageKey, MessageKey, MessageKey]> = {
  intake: [
    "dashboard.flowIntakeLabel",
    "dashboard.flowIntakeShortLabel",
    "dashboard.flowIntakeTask",
    "dashboard.flowIntakeNextAction",
  ],
  quote: [
    "dashboard.flowQuoteLabel",
    "dashboard.flowQuoteShortLabel",
    "dashboard.flowQuoteTask",
    "dashboard.flowQuoteNextAction",
  ],
  repair: [
    "dashboard.flowRepairLabel",
    "dashboard.flowRepairShortLabel",
    "dashboard.flowRepairTask",
    "dashboard.flowRepairNextAction",
  ],
  pickup: [
    "dashboard.flowPickupLabel",
    "dashboard.flowPickupShortLabel",
    "dashboard.flowPickupTask",
    "dashboard.flowPickupNextAction",
  ],
  closed: [
    "dashboard.flowClosedLabel",
    "dashboard.flowClosedShortLabel",
    "dashboard.flowClosedTask",
    "dashboard.flowClosedNextAction",
  ],
};

export function localizeOrderFlowStage(
  stage: { key: string; label: string; shortLabel: string; task: string; nextAction: string },
  t: Translate,
) {
  const keys = simpleStageKeys[stage.key];
  return keys
    ? {
        ...stage,
        label: t(keys[0]),
        shortLabel: t(keys[1]),
        task: t(keys[2]),
        nextAction: t(keys[3]),
      }
    : stage;
}

export function localizeOrderTaskGuidance(
  guidance: {
    stage: { key: string; label: string; shortLabel: string; task: string; nextAction: string };
    label: string;
    task: string;
    nextAction: string;
    workflowStatus: string;
    tone: string;
  },
  t: Translate,
) {
  const stage = localizeOrderFlowStage(guidance.stage, t);
  const fieldKeys: Record<string, MessageKey | undefined> = {
    ...Object.fromEntries(simpleStageKeysValues()),
    取消归档: "dashboard.cancelledLabel",
    已取消: "dashboard.guidanceCancelledLabel",
    报价超期: "orders.approvalOverdue",
    取件超期: "orders.pickupOverdue",
    客户持有设备: "dashboard.customerCustodyLabel",
    寄修中: "dashboard.mailInLabel",
    已修复: "dashboard.repairedLabel",
    "工单已取消；历史余额仅供记录，不计入待收。": "dashboard.cancelledTask",
    "优先联系客户确认报价，必要时重新发送报价消息。": "dashboard.approvalOverdueTask",
    "设备尚未交给门店；需要实机检测或维修前，请先在工单详情确认收机。":
      "dashboard.customerCustodyTask",
    "优先通知客户取机，核对尾款和随附物品。": "dashboard.pickupOverdueTask",
    "设备已转给外部维修方处理，请跟进供应商、寄出原因、预计返回时间和维修结果。":
      "dashboard.mailInTask",
    "维修已完成，下一步通知客户取机并核对尾款。": "dashboard.repairedTask",
    查看取消原因: "dashboard.cancelledNextAction",
    催取机: "dashboard.pickupOverdueNextAction",
    登记寄修结果: "dashboard.mailInNextAction",
    联系客户: "dashboard.contactCustomer",
    确认收机: "dashboard.confirmIntake",
  };
  const localize = (value: string) => {
    const key = fieldKeys[value];
    return key ? t(key) : value;
  };
  return {
    ...guidance,
    stage,
    label: localize(guidance.label),
    task: localize(guidance.task),
    nextAction: localize(guidance.nextAction),
  };
}

function simpleStageKeysValues() {
  return [
    ["接单", "dashboard.flowIntakeLabel"],
    ["检测报价", "dashboard.flowQuoteLabel"],
    ["维修处理", "dashboard.flowRepairLabel"],
    ["通知取机", "dashboard.flowPickupLabel"],
    ["收款完成", "dashboard.flowClosedLabel"],
    [
      "核对客户、设备保管、故障、解锁方式和随附物品，必要时打印工单二维码。",
      "dashboard.flowIntakeTask",
    ],
    ["完成检测、补充诊断结论，保存报价并记录客户确认。", "dashboard.flowQuoteTask"],
    ["处理配件、外修和实际维修进度，完成后准备通知客户。", "dashboard.flowRepairTask"],
    ["通知客户取机，核对尾款、随附物品和交付状态。", "dashboard.flowPickupTask"],
    ["订单已结清并归档，可查看历史记录或发起返修。", "dashboard.flowClosedTask"],
    ["开始检测", "dashboard.flowIntakeNextAction"],
    ["确认报价", "dashboard.flowQuoteNextAction"],
    ["完成维修", "dashboard.flowRepairNextAction"],
    ["通知取机", "dashboard.flowPickupNextAction"],
    ["查看记录", "dashboard.flowClosedNextAction"],
  ] as Array<[string, MessageKey]>;
}
