import { repairOrderStatus } from "@/lib/mock/enums";
import type {
  OrderWorkflow,
  OrderWorkflowBucket,
  OrderWorkflowStatus,
  OrderWorkflowTone,
} from "@/lib/repairdesk/types";

import type { OrderWorkflowDraftState } from "./order-workflow-draft";

const workflowCodePattern = /^[a-z][a-z0-9_]{1,47}$/;
const defaultStatusCodes = new Set<string>(repairOrderStatus);

export interface OrderWorkflowDraftIssue {
  code: string;
  message: string;
  statusId?: string;
  severity: "error" | "warning";
}

export interface OrderWorkflowChangeSummary {
  hasChanges: boolean;
  added: number;
  renamed: number;
  availabilityChanged: number;
  defaultChanged: boolean;
  orderChanged: boolean;
  transitionsChanged: number;
  items: string[];
  impactedEntrypoints: string[];
}

export function validateOrderWorkflowDraft(state: OrderWorkflowDraftState) {
  const issues: OrderWorkflowDraftIssue[] = [];
  const statuses = state.value.statuses;
  const statusByCode = new Map<string, OrderWorkflowStatus>();
  const codeCounts = new Map<string, number>();
  for (const status of statuses) {
    const code = status.code.trim();
    codeCounts.set(code, (codeCounts.get(code) ?? 0) + 1);
    statusByCode.set(code, status);
    if (!workflowCodePattern.test(code)) {
      issues.push(issue("invalid_code", `「${code || "未命名状态"}」的代码格式不正确`, status.id));
    }
    if (!status.label.trim() || status.label.trim().length > 24) {
      issues.push(issue("invalid_label", `「${code}」的状态名称需为 1–24 个字符`, status.id));
    }
    if (status.short_label.trim().length > 8) {
      issues.push(
        issue(
          "invalid_short_label",
          `「${status.label || code}」的短标签不能超过 8 个字符`,
          status.id,
        ),
      );
    }
    if (status.store_id !== state.storeId) {
      issues.push(
        issue("store_mismatch", `「${status.label || code}」不属于当前店铺草稿`, status.id),
      );
    }
    if (status.is_system && !status.enabled) {
      issues.push(
        issue("system_disabled", `系统状态「${status.label}」不能在当前安全阶段停用`, status.id),
      );
    }
    const baseStatus = state.base.statuses.find((item) => item.id === status.id);
    if (status.is_system && baseStatus && baseStatus.bucket !== status.bucket) {
      issues.push(
        issue(
          "system_bucket_changed",
          `系统状态「${status.label}」的主流程分组不能在当前安全阶段修改`,
          status.id,
        ),
      );
    }
    if (!defaultStatusCodes.has(code)) {
      issues.push(
        issue(
          "custom_status_unmapped",
          `自定义状态「${status.label || code}」尚未绑定主流程语义，暂不能应用到真实工单`,
          status.id,
        ),
      );
    }
  }
  for (const [code, count] of codeCounts) {
    if (count > 1) issues.push(issue("duplicate_code", `状态代码「${code}」重复`));
  }

  const defaults = statuses.filter((status) => status.is_default_create_status);
  if (defaults.length !== 1) {
    issues.push(issue("invalid_default_count", "必须且只能有一个默认新建状态"));
  } else if (!defaults[0].enabled || !defaults[0].allowed_for_create) {
    issues.push(issue("invalid_default", "默认新建状态必须启用并允许用于新建工单", defaults[0].id));
  }
  if (!statuses.some((status) => status.enabled && status.allowed_for_create)) {
    issues.push(issue("no_create_status", "至少需要一个已启用且可用于新建工单的状态"));
  }

  const seenTransitions = new Set<string>();
  const primaryBySource = new Map<string, number>();
  for (const transition of state.value.transitions) {
    const key = transitionKey(transition.from_status_code, transition.to_status_code);
    if (transition.store_id !== state.storeId) {
      issues.push(issue("store_mismatch", `流转关系「${key}」不属于当前店铺草稿`));
    }
    if (seenTransitions.has(key))
      issues.push(issue("duplicate_transition", `流转关系「${key}」重复`));
    seenTransitions.add(key);
    if (transition.from_status_code === transition.to_status_code) {
      issues.push(issue("self_transition", `状态「${transition.from_status_code}」不能流转到自身`));
    }
    const from = statusByCode.get(transition.from_status_code);
    const to = statusByCode.get(transition.to_status_code);
    if (!from || !to) {
      issues.push(issue("missing_transition_status", `流转关系「${key}」引用了不存在的状态`));
      continue;
    }
    if (transition.enabled && (!from.enabled || !to.enabled)) {
      issues.push(
        issue(
          "disabled_transition_status",
          `已启用流转「${from.label} → ${to.label}」引用了停用状态`,
        ),
      );
    }
    if (transition.enabled && transition.is_primary) {
      primaryBySource.set(from.code, (primaryBySource.get(from.code) ?? 0) + 1);
    }
  }
  for (const status of statuses) {
    const enabled = state.value.transitions.filter(
      (transition) => transition.from_status_code === status.code && transition.enabled,
    );
    if (enabled.length > 0 && (primaryBySource.get(status.code) ?? 0) !== 1) {
      issues.push(
        issue(
          "invalid_primary",
          `「${status.label}」的启用流转必须且只能有一个推荐下一步`,
          status.id,
        ),
      );
    }
  }
  return issues;
}

export function summarizeOrderWorkflowChanges(
  state: OrderWorkflowDraftState,
): OrderWorkflowChangeSummary {
  const baseById = new Map(state.base.statuses.map((status) => [status.id, status]));
  const valueById = new Map(state.value.statuses.map((status) => [status.id, status]));
  const addedStatuses = state.value.statuses.filter((status) => !baseById.has(status.id));
  const renamedStatuses = state.value.statuses.filter((status) => {
    const base = baseById.get(status.id);
    return base && (base.label !== status.label || base.short_label !== status.short_label);
  });
  const availabilityStatuses = state.value.statuses.filter((status) => {
    const base = baseById.get(status.id);
    return (
      base &&
      (base.enabled !== status.enabled ||
        base.show_in_order_filters !== status.show_in_order_filters ||
        base.allowed_for_create !== status.allowed_for_create)
    );
  });
  const baseDefault = state.base.statuses.find((status) => status.is_default_create_status)?.code;
  const valueDefault = state.value.statuses.find((status) => status.is_default_create_status)?.code;
  const baseOrder = sortStatuses(state.base.statuses).map((status) => status.id);
  const valueOrder = sortStatuses(state.value.statuses).map((status) => status.id);
  const orderChanged = JSON.stringify(baseOrder) !== JSON.stringify(valueOrder);
  const baseTransitions = transitionConfigMap(state.base);
  const valueTransitions = transitionConfigMap(state.value);
  const transitionKeys = new Set([...baseTransitions.keys(), ...valueTransitions.keys()]);
  const transitionsChanged = [...transitionKeys].filter(
    (key) => baseTransitions.get(key) !== valueTransitions.get(key),
  ).length;
  const metadataChanged = state.value.statuses.some((status) => {
    const base = baseById.get(status.id);
    return base && (base.tone !== status.tone || base.bucket !== status.bucket);
  });
  const removed = state.base.statuses.filter((status) => !valueById.has(status.id));
  const items = [
    ...addedStatuses.map((status) => `新增状态「${status.label || status.code}」`),
    ...removed.map((status) => `移除状态「${status.label}」`),
    ...renamedStatuses.map(
      (status) => `修改状态名称「${baseById.get(status.id)?.label}」→「${status.label}」`,
    ),
    ...(availabilityStatuses.length
      ? [`${availabilityStatuses.length} 个状态的启用/入口可见性发生变化`]
      : []),
    ...(baseDefault !== valueDefault
      ? [`默认新建状态「${baseDefault ?? "无"}」→「${valueDefault ?? "无"}」`]
      : []),
    ...(orderChanged ? ["状态显示顺序发生变化"] : []),
    ...(transitionsChanged ? [`${transitionsChanged} 条流转关系发生变化`] : []),
    ...(metadataChanged ? ["状态分组或语义色发生变化"] : []),
  ];
  const impactedEntrypoints = new Set<string>();
  if (addedStatuses.length || availabilityStatuses.length || orderChanged) {
    impactedEntrypoints.add("工单列表与状态筛选");
  }
  if (
    baseDefault !== valueDefault ||
    availabilityStatuses.some((status) => status.allowed_for_create)
  ) {
    impactedEntrypoints.add("新建工单默认状态");
  }
  if (transitionsChanged) impactedEntrypoints.add("工单详情、任务页与批量流转");
  if (renamedStatuses.length || metadataChanged) impactedEntrypoints.add("状态徽章与时间线显示");
  if (addedStatuses.length || availabilityStatuses.some((status) => !status.enabled)) {
    impactedEntrypoints.add("已有工单兼容性（需服务端复核）");
  }
  return {
    hasChanges: items.length > 0,
    added: addedStatuses.length,
    renamed: renamedStatuses.length,
    availabilityChanged: availabilityStatuses.length,
    defaultChanged: baseDefault !== valueDefault,
    orderChanged,
    transitionsChanged,
    items,
    impactedEntrypoints: [...impactedEntrypoints],
  };
}

export const orderWorkflowToneOptions: readonly { value: OrderWorkflowTone; label: string }[] = [
  { value: "neutral", label: "中性" },
  { value: "info", label: "信息" },
  { value: "progress", label: "进行" },
  { value: "warn", label: "提醒" },
  { value: "success", label: "完成" },
  { value: "danger", label: "异常" },
];

export const orderWorkflowBucketOptions: readonly {
  value: OrderWorkflowBucket;
  label: string;
}[] = [
  { value: "intake", label: "受理" },
  { value: "diagnosing", label: "检测报价" },
  { value: "quote", label: "检测报价" },
  { value: "parts", label: "配件" },
  { value: "repair", label: "维修" },
  { value: "pickup", label: "取机" },
  { value: "done", label: "结案" },
  { value: "cancelled", label: "异常" },
  { value: "custom", label: "自定义" },
];

function sortStatuses(statuses: OrderWorkflowStatus[]) {
  return [...statuses].sort(
    (a, b) => a.sort_order - b.sort_order || a.label.localeCompare(b.label),
  );
}

function transitionConfigMap(workflow: OrderWorkflow) {
  return new Map(
    workflow.transitions.map((transition) => [
      transitionKey(transition.from_status_code, transition.to_status_code),
      JSON.stringify({
        from_status_code: transition.from_status_code,
        to_status_code: transition.to_status_code,
        enabled: transition.enabled,
        is_primary: transition.is_primary,
        sort_order: transition.sort_order,
      }),
    ]),
  );
}

function transitionKey(from: string, to: string) {
  return `${from}→${to}`;
}

function issue(code: string, message: string, statusId?: string): OrderWorkflowDraftIssue {
  return { code, message, statusId, severity: "error" };
}
