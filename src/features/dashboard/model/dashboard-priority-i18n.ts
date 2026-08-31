import type { DashboardPriorityItem } from "@/lib/repairdesk/types";
import type { MessageKey, MessageValues } from "@/shared/i18n/messages";

type Translate = (key: MessageKey, values?: MessageValues) => string;

const reasonKeys: Record<string, MessageKey> = {
  报价超期: "orders.approvalOverdue",
  取件超期: "orders.pickupOverdue",
  等待客户: "dashboard.waitingCustomer",
  返修优先: "dashboard.reworkPriority",
  修好待通知: "dashboard.repairedReady",
  配件已到: "orders.arrived",
  工单已暂停: "dashboard.pausedOrder",
  无法维修: "dashboard.unrepairableOrder",
  配件缺货: "dashboard.waitingParts",
  等待配件: "dashboard.waitingParts",
  外修跟进: "dashboard.externalRepair",
  等待取机: "dashboard.waitingPickup",
  设备待收机: "dashboard.customerCustody",
  新单待处理: "dashboard.newOrder",
  可继续推进: "dashboard.workflowActionReady",
};

const exactFieldKeys: Record<
  "reasonDescription" | "currentStep" | "nextStep" | "actionLabel",
  Record<string, MessageKey>
> = {
  reasonDescription: {
    "工单已取消；历史余额仅供记录，不计入待收。": "dashboard.cancelledTask",
    "优先联系客户确认报价，必要时重新发送报价消息。": "dashboard.approvalOverdueTask",
    "设备尚未交给门店；需要实机检测或维修前，请先在工单详情确认收机。":
      "dashboard.customerCustodyTask",
    "优先通知客户取机，核对尾款和随附物品。": "dashboard.pickupOverdueTask",
    "设备已转给外部维修方处理，请跟进供应商、寄出原因、预计返回时间和维修结果。":
      "dashboard.mailInTask",
    "维修已完成，下一步通知客户取机并核对尾款。": "dashboard.repairedTask",
    "报价确认已超出约定等待时间，需要优先联系客户。": "dashboard.approvalOverdueDescription",
    "报价已发送，等待客户确认处理方案。": "dashboard.waitingCustomerDescription",
    "配件流程可继续跟进，开始维修前仍需确认收机。": "dashboard.waitingPartsOrderedDescription",
    "配件已经到货，但设备仍未由门店接收。": "dashboard.partsArrivedCustodyDescription",
    "配件已经订购，等待到货后继续处理。": "dashboard.waitingPartsOrderedFullDescription",
    "所需配件暂时缺货，需要跟进替代件或到货时间。": "dashboard.waitingPartsOutDescription",
    "设备仍由客户保管，门店尚未接收设备。": "dashboard.customerCustodyDescription",
    "新接工单需要完成接待核对并开始检测。": "dashboard.newOrderDescription",
    "当前步骤已有明确的下一项工作。": "dashboard.workflowActionDescription",
    "客户取机已超出约定等待时间，需要优先跟进。": "dashboard.pickupOverdueDescription",
    "返修工单需要优先重新检测并确认处理方案。": "dashboard.reworkDescription",
    "设备已经修好，可以通知客户取机。": "dashboard.repairedReadyDescription",
    "配件已经到货，可以继续维修。": "dashboard.partsArrivedDescription",
    "工单处于暂停状态，需要先确认暂停原因和恢复条件。": "dashboard.pausedDescription",
    "当前判断无法维修，需要向客户说明并确认设备安排。": "dashboard.unrepairableDescription",
    "设备正在外修，需要跟进预计返回时间和结果。": "dashboard.externalRepairDescription",
    "客户已经收到通知，等待到店取机。": "dashboard.waitingPickupDescription",
    接单: "dashboard.flowIntakeLabel",
    检测报价: "dashboard.flowQuoteLabel",
    维修处理: "dashboard.flowRepairLabel",
    通知取机: "dashboard.flowPickupLabel",
    收款完成: "dashboard.flowClosedLabel",
  },
  currentStep: {
    取消归档: "dashboard.cancelledLabel",
    报价超期: "orders.approvalOverdue",
    客户持有设备: "dashboard.customerCustodyLabel",
    取件超期: "orders.pickupOverdue",
    寄修中: "dashboard.mailInLabel",
    已修复: "dashboard.repairedLabel",
    等待客户确认报价: "dashboard.waitingCustomerCurrentStep",
    "配件已到，设备未收": "dashboard.partsArrivedCustodyStep",
    设备由客户持有: "dashboard.customerCustodyStep",
    返修待检测: "dashboard.reworkCurrentStep",
    配件已到货: "dashboard.partsArrivedStep",
    等待可用配件: "dashboard.waitingPartsCurrentStep",
    等待配件到货: "dashboard.waitingPartsOrderedStep",
    外部维修处理中: "dashboard.externalRepairCurrentStep",
    等待客户取机: "dashboard.waitingPickupCurrentStep",
    维修已完成: "dashboard.repairedReadyCurrentStep",
    暂停处理中: "dashboard.pausedCurrentStep",
    等待客户确认处理方式: "dashboard.unrepairableCurrentStep",
    接单: "dashboard.flowIntakeLabel",
    检测报价: "dashboard.flowQuoteLabel",
    维修处理: "dashboard.flowRepairLabel",
    通知取机: "dashboard.flowPickupLabel",
    收款完成: "dashboard.flowClosedLabel",
  },
  nextStep: {
    "工单已取消；历史余额仅供记录，不计入待收。": "dashboard.cancelledTask",
    "优先联系客户确认报价，必要时重新发送报价消息。": "dashboard.approvalOverdueTask",
    "设备尚未交给门店；需要实机检测或维修前，请先在工单详情确认收机。":
      "dashboard.customerCustodyTask",
    "优先通知客户取机，核对尾款和随附物品。": "dashboard.pickupOverdueTask",
    "设备已转给外部维修方处理，请跟进供应商、寄出原因、预计返回时间和维修结果。":
      "dashboard.mailInTask",
    "维修已完成，下一步通知客户取机并核对尾款。": "dashboard.repairedTask",
    查看取消原因: "dashboard.cancelledNextAction",
    联系客户: "dashboard.contactCustomer",
    确认收机: "dashboard.confirmIntake",
    催取机: "dashboard.pickupOverdueNextAction",
    登记寄修结果: "dashboard.mailInNextAction",
    通知取机: "dashboard.flowPickupNextAction",
    "联系客户确认报价，必要时重新发送消息。": "dashboard.approvalOverdueNextStep",
    "查看客户回复；同意维修后再确认收机。": "dashboard.waitingCustomerNextStep",
    "客户送来设备后执行“确认收机”，再进入检测或维修。": "dashboard.customerCustodyNextStep",
    "查看客户回复，必要时发送报价提醒。": "dashboard.waitingCustomerReminderNextStep",
    "跟进替代件或预计到货时间，再决定后续维修。": "dashboard.waitingPartsNextStep",
    "跟进配件到货时间，收货后继续维修。": "dashboard.waitingPartsOrderedNextStep",
    "当前步骤已有明确的下一项工作。": "dashboard.workflowActionNextStep",
    "联系客户安排取机，并确认交付所需资料。": "dashboard.pickupOverdueNextStep",
    "重新检测设备并确认返修处理方案。": "dashboard.reworkNextStep",
    "通知客户设备已修好，并安排到店取机。": "dashboard.repairedReadyNextStep",
    "核对到货配件后继续维修。": "dashboard.partsArrivedNextStep",
    "查看暂停原因，并确认何时可以恢复处理。": "dashboard.pausedNextStep",
    "联系客户说明检测结论，并确认退回或取机安排。": "dashboard.unrepairableNextStep",
    "跟进外修预计返回时间和维修结果。": "dashboard.externalRepairNextStep",
    "查看跟进记录，必要时再次联系客户取机。": "dashboard.waitingPickupNextStep",
    "核对客户、设备保管、故障、解锁方式和随附物品，必要时打印工单二维码。":
      "dashboard.flowIntakeTask",
    "完成检测、补充诊断结论，保存报价并记录客户确认。": "dashboard.flowQuoteTask",
    "处理配件、外修和实际维修进度，完成后准备通知客户。": "dashboard.flowRepairTask",
    "通知客户取机，核对尾款、随附物品和交付状态。": "dashboard.flowPickupTask",
    "订单已结清并归档，可查看历史记录或发起返修。": "dashboard.flowClosedTask",
    开始检测: "dashboard.flowIntakeNextAction",
    确认报价: "dashboard.flowQuoteNextAction",
    完成维修: "dashboard.flowRepairNextAction",
    查看记录: "dashboard.flowClosedNextAction",
  },
  actionLabel: {
    联系客户: "dashboard.contactCustomer",
    查看跟进: "dashboard.viewFollowUp",
    确认收机: "dashboard.confirmIntake",
    安排取机: "dashboard.arrangePickup",
    开始返修检测: "dashboard.startRework",
    通知客户: "dashboard.notifyCustomer",
    继续维修: "dashboard.continueRepair",
    查看暂停原因: "dashboard.viewPauseReason",
    查看取消原因: "dashboard.cancelledNextAction",
    催取机: "dashboard.pickupOverdueNextAction",
    登记寄修结果: "dashboard.mailInNextAction",
    开始检测: "dashboard.flowIntakeNextAction",
    确认报价: "dashboard.flowQuoteNextAction",
    完成维修: "dashboard.flowRepairNextAction",
    通知取机: "dashboard.flowPickupNextAction",
    查看记录: "dashboard.flowClosedNextAction",
  },
};

function localizeField(
  field: keyof typeof exactFieldKeys,
  value: string | undefined,
  t: Translate,
) {
  if (!value) return value;
  const key = exactFieldKeys[field][value];
  return key ? t(key) : value;
}

export function localizeDashboardPriorityItem(item: DashboardPriorityItem, t: Translate) {
  const reasonKey = reasonKeys[item.reasonLabel];
  const reason = reasonKey ? t(reasonKey) : item.reasonLabel;
  return {
    ...item,
    reasonLabel: reason,
    assigneeLabel:
      item.assigneeState === "unassigned"
        ? t("orders.unassigned")
        : item.assigneeState === "unavailable"
          ? t("dashboard.assigneeUnavailableLabel")
          : item.assigneeLabel,
    reasonDescription: localizeField("reasonDescription", item.reasonDescription, t) ?? "",
    currentStep: localizeField("currentStep", item.currentStep, t),
    nextStep: localizeField("nextStep", item.nextStep, t),
    action: {
      ...item.action,
      label: localizeField("actionLabel", item.action.label, t) ?? item.action.label,
    },
  };
}
