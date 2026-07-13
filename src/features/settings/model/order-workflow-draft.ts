import type { RepairOrderStatus } from "@/lib/mock/enums";
import type {
  OrderWorkflow,
  OrderWorkflowStatus,
  OrderWorkflowStatusCreateInput,
  OrderWorkflowStatusUpdateInput,
} from "@/lib/repairdesk/types";

export interface OrderWorkflowDraftState {
  storeId: string;
  base: OrderWorkflow;
  latest: OrderWorkflow;
  value: OrderWorkflow;
  baseFingerprint: string;
  latestFingerprint: string;
  conflict: boolean;
}

export function createOrderWorkflowDraftState(
  workflow: OrderWorkflow,
  storeId = workflow.statuses[0]?.store_id ?? workflow.transitions[0]?.store_id ?? "",
): OrderWorkflowDraftState {
  const snapshot = cloneOrderWorkflow(workflow);
  const fingerprint = orderWorkflowSnapshotFingerprint(snapshot);
  return {
    storeId,
    base: snapshot,
    latest: cloneOrderWorkflow(snapshot),
    value: cloneOrderWorkflow(snapshot),
    baseFingerprint: fingerprint,
    latestFingerprint: fingerprint,
    conflict: false,
  };
}

export function reconcileOrderWorkflowDraftState(
  state: OrderWorkflowDraftState,
  incoming: OrderWorkflow,
): OrderWorkflowDraftState {
  if (
    [...incoming.statuses, ...incoming.transitions].some((item) => item.store_id !== state.storeId)
  ) {
    return { ...state, conflict: true };
  }
  const next = cloneOrderWorkflow(incoming);
  const fingerprint = orderWorkflowSnapshotFingerprint(next);
  if (fingerprint === state.latestFingerprint) return state;
  if (!isOrderWorkflowDraftDirty(state)) {
    return createOrderWorkflowDraftState(next, state.storeId);
  }
  return {
    ...state,
    latest: next,
    latestFingerprint: fingerprint,
    conflict: fingerprint !== state.baseFingerprint,
  };
}

export function discardOrderWorkflowDraft(state: OrderWorkflowDraftState) {
  return createOrderWorkflowDraftState(state.latest, state.storeId);
}

export function isOrderWorkflowDraftDirty(state: OrderWorkflowDraftState) {
  return editableWorkflowSignature(state.value) !== editableWorkflowSignature(state.base);
}

export function addOrderWorkflowStatusDraft(
  state: OrderWorkflowDraftState,
  input: OrderWorkflowStatusCreateInput,
): OrderWorkflowDraftState {
  const code = input.code.trim().toLowerCase();
  if (state.value.statuses.some((status) => status.code.trim().toLowerCase() === code))
    return state;
  const label = input.label.trim();
  const isDefault = Boolean(input.is_default_create_status);
  const nextStatuses = isDefault
    ? state.value.statuses.map((status) => ({ ...status, is_default_create_status: false }))
    : state.value.statuses;
  const status: OrderWorkflowStatus = {
    id: nextDraftStatusId(state.value.statuses, code),
    store_id: state.storeId,
    code,
    label,
    short_label: input.short_label?.trim() || label.slice(0, 4),
    tone: input.tone,
    bucket: input.bucket,
    sort_order:
      input.sort_order ?? Math.max(0, ...nextStatuses.map((item) => item.sort_order)) + 10,
    enabled: isDefault ? true : (input.enabled ?? true),
    show_in_order_filters: input.show_in_order_filters ?? true,
    allowed_for_create: isDefault ? true : (input.allowed_for_create ?? false),
    is_default_create_status: isDefault,
    is_system: false,
    created_at: "",
    updated_at: "",
  };
  return withDraftValue(state, {
    ...state.value,
    statuses: [...nextStatuses, status],
  });
}

export function updateOrderWorkflowStatusDraft(
  state: OrderWorkflowDraftState,
  id: string,
  patch: OrderWorkflowStatusUpdateInput,
): OrderWorkflowDraftState {
  const makeDefault = patch.is_default_create_status === true;
  const statuses = state.value.statuses.map((status) => {
    if (status.id !== id) {
      return makeDefault ? { ...status, is_default_create_status: false } : status;
    }
    const next = { ...status, ...patch };
    if (patch.label !== undefined) next.label = patch.label;
    if (patch.short_label !== undefined) next.short_label = patch.short_label;
    if (makeDefault) {
      next.enabled = true;
      next.allowed_for_create = true;
      next.is_default_create_status = true;
    }
    return next;
  });
  return withDraftValue(state, { ...state.value, statuses });
}

export function moveOrderWorkflowStatusDraft(
  state: OrderWorkflowDraftState,
  id: string,
  direction: -1 | 1,
): OrderWorkflowDraftState {
  const statuses = sortStatuses(state.value.statuses);
  const index = statuses.findIndex((status) => status.id === id);
  const target = index + direction;
  if (index < 0 || target < 0 || target >= statuses.length) return state;
  [statuses[index], statuses[target]] = [statuses[target], statuses[index]];
  return withDraftValue(state, {
    ...state.value,
    statuses: statuses.map((status, itemIndex) => ({
      ...status,
      sort_order: (itemIndex + 1) * 10,
    })),
  });
}

export function updateOrderWorkflowTransitionDraft(
  state: OrderWorkflowDraftState,
  fromStatusCode: RepairOrderStatus,
  toStatusCode: RepairOrderStatus,
  patch: { enabled?: boolean; is_primary?: boolean },
): OrderWorkflowDraftState {
  if (!fromStatusCode || !toStatusCode || fromStatusCode === toStatusCode) return state;
  const key = transitionKey(fromStatusCode, toStatusCode);
  const existing = state.value.transitions.find(
    (transition) => transitionKey(transition.from_status_code, transition.to_status_code) === key,
  );
  const enabled = patch.enabled ?? existing?.enabled ?? false;
  let transitions = state.value.transitions.map((transition) => {
    if (transition.from_status_code !== fromStatusCode) return transition;
    if (patch.is_primary && transition.to_status_code !== toStatusCode) {
      return { ...transition, is_primary: false };
    }
    if (transition.to_status_code !== toStatusCode) return transition;
    return {
      ...transition,
      enabled,
      is_primary: enabled && (patch.is_primary ?? transition.is_primary),
    };
  });
  if (!existing) {
    transitions = [
      ...transitions,
      {
        id: `draft-transition:${fromStatusCode}:${toStatusCode}`,
        store_id: state.storeId,
        from_status_code: fromStatusCode,
        to_status_code: toStatusCode,
        enabled,
        is_primary: Boolean(enabled && patch.is_primary),
        sort_order:
          Math.max(
            0,
            ...transitions
              .filter((transition) => transition.from_status_code === fromStatusCode)
              .map((transition) => transition.sort_order),
          ) + 10,
        created_at: "",
        updated_at: "",
      },
    ];
  }
  const sourceTransitions = transitions.filter(
    (transition) => transition.from_status_code === fromStatusCode && transition.enabled,
  );
  if (
    sourceTransitions.length > 0 &&
    !sourceTransitions.some((transition) => transition.is_primary)
  ) {
    const firstKey = transitionKey(
      sourceTransitions[0].from_status_code,
      sourceTransitions[0].to_status_code,
    );
    transitions = transitions.map((transition) =>
      transitionKey(transition.from_status_code, transition.to_status_code) === firstKey
        ? { ...transition, is_primary: true }
        : transition,
    );
  }
  return withDraftValue(state, { ...state.value, transitions });
}

export function cloneOrderWorkflow(workflow: OrderWorkflow): OrderWorkflow {
  return {
    statuses: sortStatuses(workflow.statuses),
    transitions: workflow.transitions
      .map((transition) => ({ ...transition }))
      .sort(
        (a, b) =>
          a.from_status_code.localeCompare(b.from_status_code) ||
          a.sort_order - b.sort_order ||
          a.to_status_code.localeCompare(b.to_status_code),
      ),
  };
}

function withDraftValue(state: OrderWorkflowDraftState, value: OrderWorkflow) {
  return { ...state, value: cloneOrderWorkflow(value) };
}

function sortStatuses(statuses: OrderWorkflowStatus[]) {
  return statuses
    .map((status) => ({ ...status }))
    .sort((a, b) => a.sort_order - b.sort_order || a.label.localeCompare(b.label));
}

function editableWorkflowSignature(workflow: OrderWorkflow) {
  return JSON.stringify({
    statuses: sortStatuses(workflow.statuses).map(configurableStatus),
    transitions: cloneOrderWorkflow(workflow).transitions.map(configurableTransition),
  });
}

function orderWorkflowSnapshotFingerprint(workflow: OrderWorkflow) {
  return JSON.stringify({
    statuses: sortStatuses(workflow.statuses).map((status) => ({
      ...configurableStatus(status),
      id: status.id,
      store_id: status.store_id,
      updated_at: status.updated_at,
    })),
    transitions: cloneOrderWorkflow(workflow).transitions.map((transition) => ({
      ...configurableTransition(transition),
      id: transition.id,
      store_id: transition.store_id,
      updated_at: transition.updated_at,
    })),
  });
}

function configurableStatus(status: OrderWorkflowStatus) {
  return {
    id: status.id,
    code: status.code,
    label: status.label,
    short_label: status.short_label,
    tone: status.tone,
    bucket: status.bucket,
    sort_order: status.sort_order,
    enabled: status.enabled,
    show_in_order_filters: status.show_in_order_filters,
    allowed_for_create: status.allowed_for_create,
    is_default_create_status: status.is_default_create_status,
    is_system: status.is_system,
  };
}

function configurableTransition(transition: OrderWorkflow["transitions"][number]) {
  return {
    from_status_code: transition.from_status_code,
    to_status_code: transition.to_status_code,
    enabled: transition.enabled,
    is_primary: transition.is_primary,
    sort_order: transition.sort_order,
  };
}

function transitionKey(from: string, to: string) {
  return `${from}→${to}`;
}

function nextDraftStatusId(statuses: OrderWorkflowStatus[], code: string) {
  const base = `draft-status:${code}`;
  if (!statuses.some((status) => status.id === base)) return base;
  let suffix = 2;
  while (statuses.some((status) => status.id === `${base}:${suffix}`)) suffix += 1;
  return `${base}:${suffix}`;
}
