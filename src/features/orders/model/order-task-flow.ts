import {
  orderWorkflowMeta,
  orderWorkflowStatuses,
  workflowStatusFromLegacyStatus,
} from "@/features/orders/model/canonical-order-status";
import type { RepairOrderStatus } from "@/lib/mock/enums";
import type { OrderListItem } from "@/lib/repairdesk/api";
import type { OrderWorkflowStatusCode } from "@/lib/repairdesk/types";

export type OrderTaskStage = {
  key: OrderWorkflowStatusCode;
  label: string;
  shortLabel: string;
  task: string;
  nextAction: string;
};

export const orderTaskStages: OrderTaskStage[] = [
  {
    key: "intake",
    label: "收机",
    shortLabel: "收",
    task: "核对客户、设备、故障与留存物品，打印工单二维码。",
    nextAction: "开始检测",
  },
  {
    key: "diagnosis",
    label: "检测",
    shortLabel: "检",
    task: "完成故障检测，填写诊断结果和建议报价。",
    nextAction: "完成检测",
  },
  {
    key: "quote",
    label: "报价",
    shortLabel: "报",
    task: "确认报价项目，发送给客户并等待确认。",
    nextAction: "发送报价",
  },
  {
    key: "parts",
    label: "配件",
    shortLabel: "件",
    task: "登记订件、供应商和到货状态。",
    nextAction: "确认配件",
  },
  {
    key: "repair",
    label: "维修",
    shortLabel: "修",
    task: "执行维修，记录更换项目和维修结果。",
    nextAction: "完成维修",
  },
  {
    key: "pickup",
    label: "取机",
    shortLabel: "取",
    task: "通知客户取机，核对付款和交付状态。",
    nextAction: "通知取机",
  },
  {
    key: "closed",
    label: "结案",
    shortLabel: "结",
    task: "订单已完成归档，可查看历史记录。",
    nextAction: "查看记录",
  },
];

export const orderTaskStageIndex = Object.fromEntries(
  orderTaskStages.map((stage, index) => [stage.key, index]),
) as Record<OrderWorkflowStatusCode, number>;

export function getOrderTaskStage(status: OrderWorkflowStatusCode) {
  return orderTaskStages[orderTaskStageIndex[status]] ?? orderTaskStages[0];
}

export function getOrderWorkflowStatus(input: {
  status: RepairOrderStatus;
  workflow_status?: OrderWorkflowStatusCode;
}) {
  return input.workflow_status ?? workflowStatusFromLegacyStatus(input.status);
}

export function getOrderTaskGuidance(
  input: Pick<OrderListItem, "status" | "workflow_status" | "approval_overdue" | "pickup_overdue">,
) {
  const workflowStatus = getOrderWorkflowStatus(input);
  const stage = getOrderTaskStage(workflowStatus);
  const meta = orderWorkflowMeta[workflowStatus];

  if (input.approval_overdue) {
    return {
      stage,
      workflowStatus,
      label: "报价超期",
      task: "优先联系客户确认报价，必要时重新发送报价消息。",
      nextAction: "联系客户",
      tone: "danger" as const,
    };
  }

  if (input.pickup_overdue) {
    return {
      stage,
      workflowStatus,
      label: "取件超期",
      task: "优先通知客户取机，核对尾款和留存物品。",
      nextAction: "催取机",
      tone: "danger" as const,
    };
  }

  if (input.status === "mail_in_progress") {
    return {
      stage,
      workflowStatus,
      label: "寄修中",
      task: "设备已转给外部维修方处理，请跟进供应商、寄出原因、预计返回时间和维修结果。",
      nextAction: "登记寄修结果",
      tone: "progress" as const,
    };
  }

  if (input.status === "repaired") {
    return {
      stage,
      workflowStatus,
      label: "已修复",
      task: "维修已完成，下一步通知客户取机并核对尾款。",
      nextAction: "通知取机",
      tone: "success" as const,
    };
  }

  return {
    stage,
    workflowStatus,
    label: meta.label,
    task: stage.task,
    nextAction: stage.nextAction,
    tone: meta.tone,
  };
}

export function getOrderTaskUrl(orderId: string, origin?: string) {
  const path = `/orders/${orderId}/task`;
  return origin ? `${origin.replace(/\/$/, "")}${path}` : path;
}

export function getWorkflowProgressValue(status: OrderWorkflowStatusCode) {
  return Math.max(0, orderWorkflowStatuses.indexOf(status));
}
