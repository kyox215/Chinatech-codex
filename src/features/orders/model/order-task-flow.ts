import { workflowStatusFromLegacyStatus } from "@/features/orders/model/canonical-order-status";
import {
  getSimpleOrderFlowStageForWorkflow,
  getSimpleOrderFlowStageIndexForWorkflow,
  simpleOrderFlowStageIndexes,
  simpleOrderFlowStages,
  type SimpleOrderFlowStage,
} from "@/features/orders/model/order-simple-flow";
import type { RepairOrderStatus } from "@/lib/mock/enums";
import type { OrderListItem } from "@/lib/repairdesk/api";
import type { OrderWorkflowStatusCode } from "@/lib/repairdesk/types";

export type OrderTaskStage = SimpleOrderFlowStage;

export const orderTaskStages = simpleOrderFlowStages;

export const orderTaskStageIndex = simpleOrderFlowStageIndexes;

export function getOrderTaskStage(status: OrderWorkflowStatusCode) {
  return getSimpleOrderFlowStageForWorkflow(status);
}

export function getOrderWorkflowStatus(input: {
  status: RepairOrderStatus;
  workflow_status?: OrderWorkflowStatusCode;
  exception_status?: OrderListItem["exception_status"];
}) {
  if (input.status === "cancelled" || input.exception_status === "cancelled") return "closed";
  return input.workflow_status ?? workflowStatusFromLegacyStatus(input.status);
}

export function getOrderTaskGuidance(
  input: Pick<
    OrderListItem,
    "status" | "workflow_status" | "exception_status" | "approval_overdue" | "pickup_overdue"
  >,
) {
  const cancelled = input.status === "cancelled" || input.exception_status === "cancelled";
  const workflowStatus = cancelled ? "closed" : getOrderWorkflowStatus(input);
  const stage = getOrderTaskStage(workflowStatus);

  if (cancelled) {
    const cancelledStage: OrderTaskStage = {
      ...stage,
      label: "取消归档",
      shortLabel: "消",
      task: "工单已取消；历史余额仅供记录，不计入待收。",
      nextAction: "查看取消原因",
      tone: "neutral",
    };
    return {
      stage: cancelledStage,
      workflowStatus,
      label: "已取消",
      task: cancelledStage.task,
      nextAction: cancelledStage.nextAction,
      tone: "neutral" as const,
    };
  }

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
    label: stage.label,
    task: stage.task,
    nextAction: stage.nextAction,
    tone: stage.tone,
  };
}

export function getOrderTaskUrl(orderId: string, origin?: string) {
  const path = `/orders/${orderId}/task`;
  return origin ? `${origin.replace(/\/$/, "")}${path}` : path;
}

export function getWorkflowProgressValue(status: OrderWorkflowStatusCode) {
  return getSimpleOrderFlowStageIndexForWorkflow(status);
}
