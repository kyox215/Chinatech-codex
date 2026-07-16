import type { StatusTone } from "@/lib/mock/enums";
import type { OrderWorkflowStatusCode } from "@/lib/repairdesk/types";

export type SimpleOrderFlowStageKey = "intake" | "quote" | "repair" | "pickup" | "closed";

export interface SimpleOrderFlowStage {
  key: SimpleOrderFlowStageKey;
  label: string;
  shortLabel: string;
  task: string;
  nextAction: string;
  tone: StatusTone;
  workflowStatuses: readonly OrderWorkflowStatusCode[];
}

export const simpleOrderFlowStages = [
  {
    key: "intake",
    label: "接单",
    shortLabel: "接",
    task: "核对客户、设备保管、故障、解锁方式和随附物品，必要时打印工单二维码。",
    nextAction: "开始检测",
    tone: "info",
    workflowStatuses: ["intake"],
  },
  {
    key: "quote",
    label: "检测报价",
    shortLabel: "报",
    task: "完成检测、补充诊断结论，保存报价并记录客户确认。",
    nextAction: "确认报价",
    tone: "warn",
    workflowStatuses: ["diagnosis", "quote"],
  },
  {
    key: "repair",
    label: "维修处理",
    shortLabel: "修",
    task: "处理配件、外修和实际维修进度，完成后准备通知客户。",
    nextAction: "完成维修",
    tone: "progress",
    workflowStatuses: ["parts", "repair"],
  },
  {
    key: "pickup",
    label: "通知取机",
    shortLabel: "取",
    task: "通知客户取机，核对尾款、随附物品和交付状态。",
    nextAction: "通知取机",
    tone: "warn",
    workflowStatuses: ["pickup"],
  },
  {
    key: "closed",
    label: "收款完成",
    shortLabel: "完",
    task: "订单已结清并归档，可查看历史记录或发起返修。",
    nextAction: "查看记录",
    tone: "success",
    workflowStatuses: ["closed"],
  },
] as const satisfies readonly SimpleOrderFlowStage[];

export const simpleOrderFlowStageByKey = Object.fromEntries(
  simpleOrderFlowStages.map((stage) => [stage.key, stage]),
) as unknown as Record<SimpleOrderFlowStageKey, SimpleOrderFlowStage>;

export const simpleOrderFlowStageIndexes = Object.fromEntries(
  simpleOrderFlowStages.map((stage, index) => [stage.key, index]),
) as Record<SimpleOrderFlowStageKey, number>;

export function getSimpleOrderFlowStageForWorkflow(status: OrderWorkflowStatusCode) {
  return (
    simpleOrderFlowStages.find((stage) =>
      (stage.workflowStatuses as readonly OrderWorkflowStatusCode[]).includes(status),
    ) ?? simpleOrderFlowStageByKey.intake
  );
}

export function getSimpleOrderFlowStageIndexForWorkflow(status: OrderWorkflowStatusCode) {
  return simpleOrderFlowStageIndexes[getSimpleOrderFlowStageForWorkflow(status).key] ?? 0;
}

export function getSimpleOrderFlowWorkflowStatuses(
  key: SimpleOrderFlowStageKey | "all",
): OrderWorkflowStatusCode[] | undefined {
  if (key === "all") return undefined;
  return [...simpleOrderFlowStageByKey[key].workflowStatuses];
}

export function getSimpleOrderFlowCounts(
  workflowCounts?: Partial<Record<OrderWorkflowStatusCode | "all", number>>,
) {
  const counts = {
    all: workflowCounts?.all ?? 0,
    intake: 0,
    quote: 0,
    repair: 0,
    pickup: 0,
    closed: 0,
  } satisfies Record<SimpleOrderFlowStageKey | "all", number>;

  for (const stage of simpleOrderFlowStages) {
    counts[stage.key] = stage.workflowStatuses.reduce(
      (sum, status) => sum + (workflowCounts?.[status] ?? 0),
      0,
    );
  }

  return counts;
}
