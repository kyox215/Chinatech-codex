import { getStatusMeta, repairOrderStatus, type RepairOrderStatus } from "@/lib/mock/enums";
import type {
  OrderWorkflow,
  OrderWorkflowBucket,
  OrderWorkflowStatus,
} from "@/lib/repairdesk/types";

export type OrderListStatusGroupKey =
  | "all"
  | "intake"
  | "diagnosis_quote"
  | "parts"
  | "repair"
  | "pickup"
  | "done"
  | "cancelled"
  | "custom";

export type OrderListStatusGroup = {
  key: OrderListStatusGroupKey;
  label: string;
  statuses: OrderWorkflowStatus[];
};

export type OrderListStatusTab = {
  key: string;
  label: string;
  statuses?: RepairOrderStatus[];
};

const orderListStatusGroupDefs: { key: OrderListStatusGroupKey; label: string }[] = [
  { key: "intake", label: "受理" },
  { key: "diagnosis_quote", label: "检测报价" },
  { key: "parts", label: "配件" },
  { key: "repair", label: "维修" },
  { key: "pickup", label: "取机" },
  { key: "done", label: "结案" },
  { key: "cancelled", label: "异常" },
  { key: "custom", label: "自定义" },
];

const bucketGroupMap: Record<OrderWorkflowBucket, OrderListStatusGroupKey> = {
  intake: "intake",
  diagnosing: "diagnosis_quote",
  quote: "diagnosis_quote",
  parts: "parts",
  repair: "repair",
  pickup: "pickup",
  done: "done",
  cancelled: "cancelled",
  custom: "custom",
};

export const orderWorkflowBucketLabels: Record<OrderWorkflowBucket, string> = {
  intake: "受理",
  diagnosing: "检测报价",
  quote: "检测报价",
  parts: "配件",
  repair: "维修",
  pickup: "取机",
  done: "结案",
  cancelled: "异常",
  custom: "自定义",
};

export function getOrderWorkflowBucketLabel(bucket: OrderWorkflowBucket) {
  return orderWorkflowBucketLabels[bucket] ?? bucket;
}

function getOrderListStatusGroupKey(status: OrderWorkflowStatus): OrderListStatusGroupKey {
  if (status.code === "repaired") return "repair";
  return bucketGroupMap[status.bucket] ?? "custom";
}

function getFallbackStatusBucket(code: RepairOrderStatus): OrderWorkflowBucket {
  if (code === "cancelled") return "cancelled";
  if (code === "completed") return "done";
  if (["notified", "waiting_pickup", "unfixed_pickup"].includes(code)) return "pickup";
  if (["repairing", "repaired"].includes(code)) return "repair";
  if (["parts_ordered", "parts_arrived"].includes(code)) return "parts";
  if (["quoted", "waiting_approval"].includes(code)) return "quote";
  if (code === "diagnosing") return "diagnosing";
  return "intake";
}

export const fallbackOrderWorkflowStatuses: OrderWorkflowStatus[] = repairOrderStatus.map(
  (code, index) => {
    const meta = getStatusMeta(code);
    return {
      id: `fallback-${code}`,
      store_id: "fallback",
      code,
      label: meta.label,
      short_label: meta.shortLabel ?? meta.label,
      tone: meta.tone,
      bucket: getFallbackStatusBucket(code),
      sort_order: (index + 1) * 10,
      enabled: true,
      show_in_order_filters: true,
      allowed_for_create: ["new", "diagnosing", "mail_in_progress"].includes(code),
      is_default_create_status: code === "new",
      is_system: true,
      created_at: "",
      updated_at: "",
    };
  },
);

export const fallbackOrderWorkflow: OrderWorkflow = {
  statuses: fallbackOrderWorkflowStatuses,
  transitions: [],
};

export function getWorkflowStatuses(workflow?: OrderWorkflow) {
  return (workflow?.statuses?.length ? workflow.statuses : fallbackOrderWorkflowStatuses).sort(
    (a, b) => a.sort_order - b.sort_order || a.label.localeCompare(b.label),
  );
}

export function getWorkflowStatus(workflow: OrderWorkflow | undefined, code: RepairOrderStatus) {
  return getWorkflowStatuses(workflow).find((status) => status.code === code);
}

export function getWorkflowStatusLabel(
  workflow: OrderWorkflow | undefined,
  code: RepairOrderStatus,
) {
  return getWorkflowStatus(workflow, code)?.label ?? getStatusMeta(code).label;
}

export function getWorkflowStatusTone(
  workflow: OrderWorkflow | undefined,
  code: RepairOrderStatus,
) {
  return getWorkflowStatus(workflow, code)?.tone ?? getStatusMeta(code).tone;
}

export function getWorkflowNextActions(
  workflow: OrderWorkflow | undefined,
  current: RepairOrderStatus,
) {
  const statuses = getWorkflowStatuses(workflow);
  const transitions = (workflow?.transitions ?? [])
    .filter((transition) => transition.enabled && transition.from_status_code === current)
    .sort((a, b) => Number(b.is_primary) - Number(a.is_primary) || a.sort_order - b.sort_order);
  const actions = transitions.map((transition) => {
    const status = statuses.find((item) => item.code === transition.to_status_code);
    return {
      to: transition.to_status_code,
      label: status?.label ?? getStatusMeta(transition.to_status_code).label,
      tone: status?.tone ?? getStatusMeta(transition.to_status_code).tone,
      isPrimary: transition.is_primary,
    };
  });
  return { primary: actions[0], secondary: actions.slice(1) };
}

export function getCommonWorkflowTargets(
  workflow: OrderWorkflow | undefined,
  currents: RepairOrderStatus[],
) {
  if (!currents.length) return [] as RepairOrderStatus[];
  const statuses = getWorkflowStatuses(workflow);
  const transitions = workflow?.transitions ?? [];
  const targetSets = currents.map(
    (current) =>
      new Set(
        transitions
          .filter((transition) => transition.enabled && transition.from_status_code === current)
          .map((transition) => transition.to_status_code),
      ),
  );
  return statuses
    .map((status) => status.code)
    .filter((code) => targetSets.every((targets) => targets.has(code)) && !currents.includes(code));
}

export function getOrderListStatusGroups(workflow: OrderWorkflow | undefined) {
  const statuses = getWorkflowStatuses(workflow).filter((status) => status.enabled);
  const groups: OrderListStatusGroup[] = [
    {
      key: "all",
      label: "全部",
      statuses,
    },
  ];

  for (const definition of orderListStatusGroupDefs) {
    const groupStatuses = statuses.filter(
      (status) => getOrderListStatusGroupKey(status) === definition.key,
    );
    if (groupStatuses.length > 0 || definition.key !== "custom") {
      groups.push({ ...definition, statuses: groupStatuses });
    }
  }

  return groups;
}

export function getOrderListSubStatusTabs(
  workflow: OrderWorkflow | undefined,
  groupKey: OrderListStatusGroupKey | string,
): OrderListStatusTab[] {
  const group = getOrderListStatusGroups(workflow).find((item) => item.key === groupKey);
  if (!group || group.key === "all") {
    return [{ key: "all", label: "全部状态" }];
  }

  return [
    {
      key: "all",
      label: `全部${group.label}`,
      statuses: group.statuses.map((status) => status.code),
    },
    ...group.statuses
      .filter((status) => status.show_in_order_filters)
      .map((status) => ({
        key: status.code,
        label: status.short_label || status.label,
        statuses: [status.code],
      })),
  ];
}

export function getOrderListStatusTabs(workflow: OrderWorkflow | undefined) {
  return [
    { key: "all", label: "全部" },
    ...getWorkflowStatuses(workflow)
      .filter((status) => status.enabled && status.show_in_order_filters)
      .map((status) => ({
        key: status.code,
        label: status.short_label || status.label,
        statuses: [status.code],
      })),
  ];
}
