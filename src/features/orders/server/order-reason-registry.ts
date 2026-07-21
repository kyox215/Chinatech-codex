import type { RepairOrderStatus } from "@/lib/mock/enums";
import type {
  BusinessReasonSelectionV2,
  StoredBusinessReasonSelectionV2,
} from "@/lib/repairdesk/types";
import type { OrderCapabilities } from "@/lib/repairdesk/types";

import {
  getOrderReasonCatalog,
  getOrderTransitionReasonContext,
  getWarrantyReasonContext,
  type ActorScopedOrderReasonCatalog,
  normalizeOrderReasonNote,
  type OrderReasonContext,
} from "@/features/orders/model/order-reason-catalog";

export type OrderReasonCatalogRequest =
  | { action: "transition"; target: RepairOrderStatus }
  | { action: "approval_reject" }
  | { action: "initial_deposit_correction" }
  | { action: "warranty"; fromMonths: number; toMonths: number }
  | { action: "terminal_correct" }
  | { action: "terminal_reopen" }
  | { action: "terminal_void" };

export function getActorScopedOrderReasonCatalog(input: {
  orderStatus: RepairOrderStatus;
  capabilities: OrderCapabilities | undefined;
  request: OrderReasonCatalogRequest;
}): ActorScopedOrderReasonCatalog {
  const context = deriveAuthorizedContext(input);
  const catalog = getOrderReasonCatalog(context);
  return {
    context,
    policy: "required" as const,
    catalog_revision: catalog.catalogRevision,
    cardinality: { primary: 1 as const, detail_min: 0, detail_max: 0 },
    title: catalog.title,
    description: catalog.description,
    options: catalog.options.map(({ code, staffLabel, staffDescription, requiresNote }) => ({
      code,
      staff_label: staffLabel,
      ...(staffDescription ? { staff_description: staffDescription } : {}),
      requires_note: Boolean(requiresNote),
    })),
  };
}

function deriveAuthorizedContext(input: {
  orderStatus: RepairOrderStatus;
  capabilities: OrderCapabilities | undefined;
  request: OrderReasonCatalogRequest;
}): OrderReasonContext {
  const capabilities = input.capabilities;
  const deny = () => {
    const error = reasonError("REASON_CATALOG_FORBIDDEN", "当前工单不允许此原因操作", 403);
    throw error;
  };

  switch (input.request.action) {
    case "transition": {
      if (capabilities?.canTransition !== true) return deny();
      const context = getOrderTransitionReasonContext(input.request.target);
      if (!context) throw reasonError("REASON_NOT_SUPPORTED", "该状态流转不需要原因目录");
      if (
        context === "transition.rework" &&
        input.orderStatus !== "completed" &&
        input.orderStatus !== "cancelled"
      ) {
        throw reasonError("REWORK_SOURCE_INVALID", "返修只用于已结束工单重新进入复检");
      }
      return context;
    }
    case "approval_reject":
      if (capabilities?.canTransition !== true) return deny();
      return "approval.reject";
    case "initial_deposit_correction":
      if (capabilities?.canCorrectInitialDeposit !== true) return deny();
      return "finance.initial_deposit_correction";
    case "warranty": {
      if (capabilities?.canEditRepair !== true) return deny();
      const context = getWarrantyReasonContext(input.request.fromMonths, input.request.toMonths);
      if (!context) throw reasonError("REASON_NOT_REQUIRED", "默认质保不需要原因目录");
      return context;
    }
    case "terminal_correct":
      if (capabilities?.canCorrect !== true) return deny();
      return "terminal.correct";
    case "terminal_reopen":
      if (capabilities?.canReopen !== true) return deny();
      return "terminal.reopen";
    case "terminal_void":
      if (capabilities?.canVoid !== true) return deny();
      return "terminal.void";
  }
}

function hasForbiddenControlCharacter(value: string) {
  return Array.from(value).some((character) => {
    const code = character.charCodeAt(0);
    return (code < 32 && code !== 9 && code !== 10) || code === 127;
  });
}

export type ResolvedOrderReason = {
  context: OrderReasonContext;
  legacyText: string;
  selection: BusinessReasonSelectionV2;
  storedSelection: StoredBusinessReasonSelectionV2;
  auditMetadata: {
    schema_version: 2;
    context: OrderReasonContext;
    primary_code: string;
    detail_codes: string[];
    catalog_revision: string;
    has_note: boolean;
  };
};

export function resolveOrderTransitionReasonSelection(input: {
  from: RepairOrderStatus;
  to: RepairOrderStatus;
  selection: BusinessReasonSelectionV2;
}): ResolvedOrderReason {
  const context = getOrderTransitionReasonContext(input.to);
  if (!context) throw reasonError("REASON_NOT_SUPPORTED", "该状态流转不支持新版原因选择");
  if (context === "transition.rework" && input.from !== "completed" && input.from !== "cancelled") {
    throw reasonError("REWORK_SOURCE_INVALID", "返修只用于已结束工单重新进入复检");
  }
  return resolveOrderReasonSelection(context, input.selection);
}

export function resolveOrderReasonSelection(
  context: OrderReasonContext,
  selection: BusinessReasonSelectionV2,
): ResolvedOrderReason {
  const catalog = getOrderReasonCatalog(context);
  if (selection.catalog_revision !== catalog.catalogRevision) {
    throw reasonError("REASON_CATALOG_STALE", "原因选项目录已更新，请保留当前操作并重新确认", 409);
  }

  const option = catalog.options.find((entry) => entry.code === selection.primary_code);
  if (!option) throw reasonError("REASON_CODE_INVALID", "所选原因已不可用，请重新选择");
  if (option.code === "other" && selection.kind !== "other") {
    throw reasonError("REASON_KIND_INVALID", "其他原因必须填写实际说明");
  }
  if (option.code !== "other" && selection.kind !== "preset") {
    throw reasonError("REASON_KIND_INVALID", "预设原因类型无效");
  }

  const detailCodes = selection.detail_codes ?? [];
  if (detailCodes.length) {
    throw reasonError("REASON_DETAILS_UNSUPPORTED", "当前操作尚不支持附加原因");
  }

  const note = normalizeOrderReasonNote(selection.note ?? "");
  if (hasForbiddenControlCharacter(note)) {
    throw reasonError("REASON_NOTE_INVALID", "原因说明包含不支持的控制字符");
  }
  if (option.requiresNote && !note) {
    throw reasonError("REASON_NOTE_REQUIRED", "请填写其他原因");
  }
  if (note.length > 500) {
    throw reasonError("REASON_NOTE_TOO_LONG", "原因说明不能超过 500 个字符");
  }

  const legacyText = option.requiresNote
    ? note
    : note
      ? `${option.legacyText}\n补充：${note}`
      : option.legacyText;
  if (!legacyText) throw reasonError("REASON_REQUIRED", "请选择原因");

  const normalizedSelection: BusinessReasonSelectionV2 =
    selection.kind === "other"
      ? {
          schema_version: 2,
          kind: "other",
          primary_code: "other",
          note,
          catalog_revision: catalog.catalogRevision,
        }
      : {
          schema_version: 2,
          kind: "preset",
          primary_code: option.code,
          ...(note ? { note } : {}),
          catalog_revision: catalog.catalogRevision,
        };

  return {
    context,
    legacyText,
    selection: normalizedSelection,
    storedSelection: {
      ...normalizedSelection,
      context,
      internal_snapshot: {
        locale: "zh-CN",
        labels: [option.staffLabel],
        text: legacyText,
      },
    },
    auditMetadata: {
      schema_version: 2,
      context,
      primary_code: option.code,
      detail_codes: [],
      catalog_revision: catalog.catalogRevision,
      has_note: Boolean(note),
    },
  };
}

function reasonError(code: string, message: string, status = 422) {
  const error = new Error(message) as Error & { status: number; code: string };
  error.status = status;
  error.code = code;
  return error;
}
