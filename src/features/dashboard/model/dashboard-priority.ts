import { isOrderArchivedForQueue } from "@/features/orders/model/order-list-visibility";
import { getOrderQueueGroup } from "@/features/orders/model/order-queue-classification";
import { getOrderTaskGuidance, getOrderTaskUrl } from "@/features/orders/model/order-task-flow";
import { buildOrderDetailWorkspaceHref } from "@/features/orders/model/order-workspace-intent";
import type {
  DashboardPriorityCoverage,
  DashboardPriorityItem,
  DashboardPriorityReasonCode,
  DashboardPriorityTier,
  DashboardSummary,
  OrderListItem,
} from "@/lib/repairdesk/types";

const DEFAULT_LIMIT = 8;
const MAX_LIMIT = 20;

interface DashboardPriorityOptions {
  coverage: DashboardPriorityCoverage;
  currentMembershipId?: string;
  limit?: number;
  now?: Date;
}

interface ClassifiedOrder {
  order: OrderListItem;
  tier: DashboardPriorityTier;
  tierOrder: number;
  reasonOrder: number;
  reasonCode: DashboardPriorityReasonCode;
  reasonLabel: string;
  reasonDescription: string;
  currentStep?: string;
  nextStep?: string;
  actionLabel?: string;
  referenceAt?: string;
  isActionable: boolean;
}

export function buildDashboardPrioritySummary(
  orders: OrderListItem[],
  options: DashboardPriorityOptions,
): DashboardSummary {
  const generatedAt = (options.now ?? new Date()).toISOString();
  const candidates = orders
    .filter((order) => !isOrderArchivedForQueue(order))
    .map(classifyOrder)
    .sort(compareClassifiedOrders);
  const limit = clampLimit(options.limit);
  const counts = { overdue: 0, ready: 0, active: 0, waiting: 0 };

  for (const candidate of candidates) counts[candidate.tier] += 1;

  return {
    coverage: options.coverage,
    policyVersion: "dashboard-priority-v1",
    generatedAt,
    totalCandidates: candidates.length,
    hasMore: candidates.length > limit,
    counts,
    items: candidates
      .slice(0, limit)
      .map((candidate, index) => toPriorityItem(candidate, index + 1, options.currentMembershipId)),
  };
}

function classifyOrder(order: OrderListItem): ClassifiedOrder {
  const queueGroup = getOrderQueueGroup(order);
  if (order.approval_overdue) {
    return classified(order, {
      tier: "overdue",
      tierOrder: 0,
      reasonOrder: 0,
      reasonCode: "approval_overdue",
      reasonLabel: "报价超期",
      reasonDescription: "报价确认已超出约定等待时间，需要优先联系客户。",
      currentStep: "等待客户确认报价",
      nextStep: "联系客户确认报价，必要时重新发送消息。",
      actionLabel: "联系客户",
      referenceAt: order.approval_sent_at,
      isActionable: true,
    });
  }
  if (order.device_custody_status === "with_customer") {
    const waitingForApproval =
      order.status === "waiting_approval" ||
      order.approval_flow_status === "waiting_customer" ||
      order.exception_status === "waiting_customer";
    if (waitingForApproval) {
      return classified(order, {
        tier: "waiting",
        tierOrder: 3,
        reasonOrder: 0,
        reasonCode: "waiting_customer",
        reasonLabel: "等待客户",
        reasonDescription: "报价已发送，等待客户确认处理方案。",
        currentStep: "等待客户确认报价",
        nextStep: "查看客户回复；同意维修后再确认收机。",
        actionLabel: "查看跟进",
        referenceAt: order.approval_sent_at ?? order.updated_at,
        isActionable: false,
      });
    }

    const partsContext =
      queueGroup === "arrived" || queueGroup === "arrived_notified"
        ? "配件已到货，但设备仍未由门店接收。"
        : queueGroup === "ordered" || order.parts_status === "out_of_stock"
          ? "配件流程可继续跟进，开始维修前仍需确认收机。"
          : "设备仍由客户保管，门店尚未接收设备。";
    return classified(order, {
      tier: "active",
      tierOrder: 2,
      reasonOrder: 0,
      reasonCode: "workflow_action_ready",
      reasonLabel: "设备待收机",
      reasonDescription: partsContext,
      currentStep:
        queueGroup === "arrived" || queueGroup === "arrived_notified"
          ? "配件已到，设备未收"
          : "设备由客户持有",
      nextStep: "客户送来设备后执行“确认收机”，再进入检测或维修。",
      actionLabel: "确认收机",
      referenceAt: order.updated_at,
      isActionable: true,
    });
  }
  if (order.pickup_overdue) {
    return classified(order, {
      tier: "overdue",
      tierOrder: 0,
      reasonOrder: 1,
      reasonCode: "pickup_overdue",
      reasonLabel: "取件超期",
      reasonDescription: "客户取机已超出约定等待时间，需要优先跟进。",
      currentStep: "等待客户取机",
      nextStep: "联系客户安排取机，并确认交付所需资料。",
      actionLabel: "安排取机",
      referenceAt: order.completed_at ?? order.updated_at,
      isActionable: true,
    });
  }
  if (order.status === "rework" || order.exception_status === "rework") {
    return classified(order, {
      tier: "ready",
      tierOrder: 1,
      reasonOrder: 0,
      reasonCode: "rework",
      reasonLabel: "返修优先",
      reasonDescription: "返修工单需要优先重新检测并确认处理方案。",
      currentStep: "返修待检测",
      nextStep: "重新检测设备并确认返修处理方案。",
      actionLabel: "开始返修检测",
      referenceAt: order.updated_at,
      isActionable: true,
    });
  }

  if (queueGroup === "repaired") {
    return classified(order, {
      tier: "ready",
      tierOrder: 1,
      reasonOrder: 1,
      reasonCode: "repaired_ready",
      reasonLabel: "修好待通知",
      reasonDescription: "设备已经修好，可以通知客户取机。",
      currentStep: "维修已完成",
      nextStep: "通知客户设备已修好，并安排到店取机。",
      actionLabel: "通知客户",
      referenceAt: order.completed_at ?? order.updated_at,
      isActionable: true,
    });
  }
  if (queueGroup === "arrived" || queueGroup === "arrived_notified") {
    return classified(order, {
      tier: "ready",
      tierOrder: 1,
      reasonOrder: 2,
      reasonCode: "parts_arrived",
      reasonLabel: "配件已到",
      reasonDescription: "配件已经到货，可以继续维修。",
      currentStep: "配件已到货",
      nextStep: "核对到货配件后继续维修。",
      actionLabel: "继续维修",
      referenceAt: order.updated_at,
      isActionable: true,
    });
  }
  if (
    order.status === "waiting_approval" ||
    order.approval_flow_status === "waiting_customer" ||
    order.exception_status === "waiting_customer"
  ) {
    return classified(order, {
      tier: "waiting",
      tierOrder: 3,
      reasonOrder: 0,
      reasonCode: "waiting_customer",
      reasonLabel: "等待客户",
      reasonDescription: "报价已发送，等待客户确认处理方案。",
      currentStep: "等待客户确认报价",
      nextStep: "查看客户回复，必要时发送报价提醒。",
      actionLabel: "查看跟进",
      referenceAt: order.approval_sent_at ?? order.updated_at,
      isActionable: false,
    });
  }
  if (order.exception_status === "paused") {
    return classified(order, {
      tier: "waiting",
      tierOrder: 3,
      reasonOrder: 1,
      reasonCode: "paused",
      reasonLabel: "工单已暂停",
      reasonDescription: "工单处于暂停状态，需要先确认暂停原因和恢复条件。",
      currentStep: "暂停处理中",
      nextStep: "查看暂停原因，并确认何时可以恢复处理。",
      actionLabel: "查看暂停原因",
      referenceAt: order.updated_at,
      isActionable: false,
    });
  }
  if (order.exception_status === "unrepairable") {
    return classified(order, {
      tier: "waiting",
      tierOrder: 3,
      reasonOrder: 2,
      reasonCode: "unrepairable",
      reasonLabel: "无法维修",
      reasonDescription: "当前判断无法维修，需要向客户说明并确认设备安排。",
      currentStep: "等待客户确认处理方式",
      nextStep: "联系客户说明检测结论，并确认退回或取机安排。",
      actionLabel: "联系客户",
      referenceAt: order.updated_at,
      isActionable: false,
    });
  }
  if (order.parts_status === "out_of_stock") {
    return classified(order, {
      tier: "waiting",
      tierOrder: 3,
      reasonOrder: 3,
      reasonCode: "waiting_parts",
      reasonLabel: "配件缺货",
      reasonDescription: "所需配件暂时缺货，需要跟进替代件或到货时间。",
      currentStep: "等待可用配件",
      nextStep: "跟进替代件或预计到货时间，再决定后续维修。",
      actionLabel: "查看跟进",
      referenceAt: order.updated_at,
      isActionable: false,
    });
  }
  if (queueGroup === "ordered") {
    return classified(order, {
      tier: "waiting",
      tierOrder: 3,
      reasonOrder: 4,
      reasonCode: "waiting_parts",
      reasonLabel: "等待配件",
      reasonDescription: "配件已经订购，等待到货后继续处理。",
      currentStep: "等待配件到货",
      nextStep: "跟进配件到货时间，收货后继续维修。",
      actionLabel: "查看跟进",
      referenceAt: order.updated_at,
      isActionable: false,
    });
  }
  if (order.status === "mail_in_progress") {
    return classified(order, {
      tier: "waiting",
      tierOrder: 3,
      reasonOrder: 5,
      reasonCode: "external_repair",
      reasonLabel: "外修跟进",
      reasonDescription: "设备正在外修，需要跟进预计返回时间和结果。",
      currentStep: "外部维修处理中",
      nextStep: "跟进外修预计返回时间和维修结果。",
      actionLabel: "查看跟进",
      referenceAt: order.updated_at,
      isActionable: false,
    });
  }
  if (
    queueGroup === "repaired_notified" ||
    order.exception_status === "returned_unfixed" ||
    order.status === "notified" ||
    order.status === "waiting_pickup" ||
    order.status === "unfixed_pickup"
  ) {
    return classified(order, {
      tier: "waiting",
      tierOrder: 3,
      reasonOrder: 6,
      reasonCode: "waiting_pickup",
      reasonLabel: "等待取机",
      reasonDescription: "客户已经收到通知，等待到店取机。",
      currentStep: "等待客户取机",
      nextStep: "查看跟进记录，必要时再次联系客户取机。",
      actionLabel: "查看跟进",
      referenceAt: order.completed_at ?? order.updated_at,
      isActionable: false,
    });
  }

  return classified(order, {
    tier: "active",
    tierOrder: 2,
    reasonOrder: order.status === "new" ? 0 : 1,
    reasonCode: "workflow_action_ready",
    reasonLabel: order.status === "new" ? "新单待处理" : "可继续推进",
    reasonDescription:
      order.status === "new"
        ? "新接工单需要完成接待核对并开始检测。"
        : "当前步骤已有明确的下一项工作。",
    referenceAt: order.updated_at,
    isActionable: true,
  });
}

function classified(
  order: OrderListItem,
  classification: Omit<ClassifiedOrder, "order">,
): ClassifiedOrder {
  return { order, ...classification };
}

function toPriorityItem(
  candidate: ClassifiedOrder,
  rank: number,
  currentMembershipId?: string,
): DashboardPriorityItem {
  const { order } = candidate;
  const guidance = getOrderTaskGuidance(order);
  const assignee = getAssigneeProjection(order);

  return {
    rank,
    orderId: order.id,
    publicNo: order.public_no,
    customerName: order.customer_name,
    deviceLabel: order.device_label,
    tier: candidate.tier,
    reasonCode: candidate.reasonCode,
    reasonLabel: candidate.reasonLabel,
    reasonDescription: candidate.reasonDescription,
    currentStep: candidate.currentStep ?? guidance.stage.label,
    nextStep: candidate.nextStep ?? guidance.task,
    assigneeLabel: assignee.label,
    assigneeState: assignee.state,
    isMine: Boolean(currentMembershipId && order.assignee_membership_id === currentMembershipId),
    isOverdue: candidate.tier === "overdue",
    isActionable: candidate.isActionable,
    updatedAt: order.updated_at,
    action: {
      kind: "open_task",
      label: candidate.actionLabel ?? guidance.nextAction,
      href: getOrderTaskUrl(order.id),
    },
    detailHref: buildOrderDetailWorkspaceHref(order.id, { source: "dashboard" }),
  };
}

function getAssigneeProjection(order: OrderListItem): {
  label: string;
  state: DashboardPriorityItem["assigneeState"];
} {
  const label = order.technician_name?.trim();
  const assignmentFieldKnown = Object.prototype.hasOwnProperty.call(
    order,
    "assignee_membership_id",
  );
  if (order.assignee_membership_id && label && label !== "未分配") {
    return { label, state: "assigned" };
  }
  if (assignmentFieldKnown && !order.assignee_membership_id) {
    return { label: "未分配", state: "unassigned" };
  }
  if (label && label !== "未分配") return { label, state: "assigned" };
  return assignmentFieldKnown
    ? { label: "未分配", state: "unassigned" }
    : { label: "负责人暂不可用", state: "unavailable" };
}

function compareClassifiedOrders(left: ClassifiedOrder, right: ClassifiedOrder) {
  return (
    left.tierOrder - right.tierOrder ||
    left.reasonOrder - right.reasonOrder ||
    compareTimestamp(left.referenceAt, right.referenceAt) ||
    compareTimestamp(left.order.updated_at, right.order.updated_at) ||
    compareTimestamp(left.order.created_at, right.order.created_at) ||
    left.order.public_no.localeCompare(right.order.public_no, undefined, {
      numeric: true,
      sensitivity: "base",
    }) ||
    left.order.id.localeCompare(right.order.id)
  );
}

function compareTimestamp(left?: string, right?: string) {
  return timestampValue(left) - timestampValue(right);
}

function timestampValue(value?: string) {
  if (!value) return Number.MAX_SAFE_INTEGER;
  const parsed = Date.parse(value);
  return Number.isFinite(parsed) ? parsed : Number.MAX_SAFE_INTEGER;
}

function clampLimit(value?: number) {
  if (!Number.isFinite(value)) return DEFAULT_LIMIT;
  return Math.min(MAX_LIMIT, Math.max(1, Math.floor(value ?? DEFAULT_LIMIT)));
}
