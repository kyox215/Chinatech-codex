import type { RepairOrderStatus } from "@/lib/mock/enums";
import type { OrderEvent, OrderWorkflow } from "@/lib/repairdesk/types";
import { formatCurrency } from "@/shared/i18n/format";
import type { AppLocale } from "@/shared/i18n/locales";
import type { MessageKey, MessageValues } from "@/shared/i18n/messages";

import { localizeDeviceCustody, localizeWorkflowStatusLabel } from "./order-i18n";

type Translate = (key: MessageKey, values?: MessageValues) => string;

export type OrderDetailOperation =
  | "load"
  | "save"
  | "finance"
  | "payment"
  | "transition"
  | "cancelledReturn"
  | "custody"
  | "diagnosis"
  | "quote"
  | "unlock"
  | "supplier"
  | "assignee"
  | "attachment"
  | "quoteConfirmation"
  | "approval"
  | "notification"
  | "kiosk"
  | "print"
  | "customerStatus"
  | "imei"
  | "ocr";

const operationKeys: Record<OrderDetailOperation, MessageKey> = {
  load: "orders2b2.operation.load",
  save: "orders2b2.operation.save",
  finance: "orders2b2.operation.finance",
  payment: "orders2b2.operation.payment",
  transition: "orders2b2.operation.transition",
  cancelledReturn: "orders2b2.operation.cancelledReturn",
  custody: "orders2b2.operation.custody",
  diagnosis: "orders2b2.operation.diagnosis",
  quote: "orders2b2.operation.quote",
  unlock: "orders2b2.operation.unlock",
  supplier: "orders2b2.operation.supplier",
  assignee: "orders2b2.operation.assignee",
  attachment: "orders2b2.operation.attachment",
  quoteConfirmation: "orders2b2.operation.quoteConfirmation",
  approval: "orders2b2.operation.approval",
  notification: "orders2b2.operation.notification",
  kiosk: "orders2b2.operation.kiosk",
  print: "orders2b2.operation.print",
  customerStatus: "orders2b2.operation.customerStatus",
  imei: "orders2b2.operation.imei",
  ocr: "orders2b2.operation.ocr",
};

type StableApiFailure = { code?: unknown; status?: unknown };

function readStableApiFailure(error: unknown) {
  if (!error || typeof error !== "object") return {};
  const candidate = error as StableApiFailure;
  return {
    code: typeof candidate.code === "string" ? candidate.code : undefined,
    status: typeof candidate.status === "number" ? candidate.status : undefined,
  };
}

export function getOrderDetailSafeErrorMessage(
  error: unknown,
  operation: OrderDetailOperation,
  t: Translate,
) {
  const { code, status } = readStableApiFailure(error);
  const operationLabel = t(operationKeys[operation]);
  if (status === 404 || code === "NOT_FOUND" || code === "ORDER_NOT_FOUND") {
    return t("orders2b2.error.notFound", { operation: operationLabel });
  }
  if (
    status === 401 ||
    status === 403 ||
    code === "UNAUTHORIZED" ||
    code === "FORBIDDEN" ||
    code === "AUTH_REQUIRED"
  ) {
    return t("orders2b2.error.permission", { operation: operationLabel });
  }
  if (status === 409 || code === "ORDER_WRITE_CONFLICT" || code === "CONFLICT") {
    return t("orders2b2.error.conflict", { operation: operationLabel });
  }
  if (status !== undefined && status >= 500) {
    return t("orders2b2.error.unavailable", { operation: operationLabel });
  }
  return t("orders2b2.error.generic", { operation: operationLabel });
}

export function localizeOrderDetailStatus(
  status: { code: RepairOrderStatus; label: string; is_system: boolean },
  workflow: OrderWorkflow | undefined,
  t: Translate,
) {
  if (!status.is_system) return status.label;
  return localizeWorkflowStatusLabel(workflow, status.code, t);
}

const badgeKeys: Record<string, MessageKey> = {
  "custody-with-shop": "orders.custodyShop",
  "custody-returned": "orders.custodyReturned",
  "custody-with-customer": "orders.custodyCustomer",
  "custody-unknown": "orders.custodyUnknown",
  "logistics-mail": "orders2b2.badge.mail",
  "external-repair": "orders2b2.badge.external",
  "exception-cancelled": "orders.exceptionCancelled",
  "exception-unrepairable": "orders.exceptionUnrepairable",
  "exception-returned_unfixed": "orders.returnedUnfixed",
  "exception-rework": "orders.exceptionRework",
  "exception-waiting_customer": "orders.exceptionWaitingCustomer",
  "exception-paused": "orders.exceptionPaused",
  "approval-waiting_customer": "orders2b2.badge.approvalWaiting",
  "approval-approved": "orders2b2.badge.approvalApproved",
  "approval-rejected": "orders2b2.badge.approvalRejected",
  "parts-needed": "orders2b2.badge.partsNeeded",
  "parts-ordered": "orders2b2.badge.partsOrdered",
  "parts-arrived": "orders2b2.badge.partsArrived",
  "parts-out_of_stock": "orders2b2.badge.partsUnavailable",
  "notify-sent": "orders2b2.badge.notifySent",
  "notify-contacted": "orders2b2.badge.notifyContacted",
};

export function localizeOrderDetailBadge(
  badge: { key: string; label: string; supplierName?: string },
  t: Translate,
) {
  if (badge.key === "logistics-mail" && badge.supplierName) {
    return t("orders2b2.badge.mailSupplier", { supplier: badge.supplierName });
  }
  if (badge.key === "external-repair" && badge.supplierName) {
    return t("orders2b2.badge.externalSupplier", { supplier: badge.supplierName });
  }
  const key = badgeKeys[badge.key];
  return key ? t(key) : badge.label;
}

export function localizeOrderDetailApproval(status: string, t: Translate) {
  if (status === "approved") return t("orders2b2.overview.approved");
  if (status === "rejected") return t("orders2b2.overview.rejected");
  if (status === "pending") return t("orders2b2.overview.approvalPending");
  if (status === "not_required") return t("orders2b2.overview.approvalNotRequired");
  return status;
}

export function localizeOrderDetailFinancialState(
  state: { quote: string; settlement: string; label: string },
  t: Translate,
) {
  if (state.settlement === "hidden") return t("orders.amountRestricted");
  if (state.settlement === "cancelled") return t("orders.financialCancelled");
  if (state.settlement === "refunded") return t("orders.refunded");
  if (state.settlement === "review" && state.quote === "rejected") {
    return t("orders.quoteRejectedBalanceReview");
  }
  if (state.settlement === "review") return t("orders.amountReview");
  if (state.settlement === "settled") return t("orders.paid");
  if (state.settlement === "zero_charge") return t("orders.zeroCharge");
  if (state.settlement === "partial") return t("orders.depositPaid");
  if (state.settlement === "unpaid") return t("orders.financialDue");
  if (state.quote === "awaiting_approval") return t("orders.awaitingApproval");
  if (state.quote === "rejected") return t("orders.quoteRejected");
  if (state.quote === "draft") return t("orders.quoteAwaitingConfirmation");
  if (state.quote === "not_quoted") return t("orders.quotePending");
  return state.label;
}

const custodyActions = new Set([
  "device_custody_changed",
  "device_custody_backfilled",
  "device_custody_received",
  "device_custody_returned",
  "device_custody_corrected",
  "terminal_custody_correction",
  "device_custody_import_rolled_back",
  "custody_return_confirmed",
]);

function localizeCustodyEvent(payload: Record<string, unknown>, t: Translate) {
  const action = typeof payload.action === "string" ? payload.action : "";
  if (!custodyActions.has(action)) return null;
  const from = typeof payload.from === "string" ? payload.from : undefined;
  const to = typeof payload.to === "string" ? payload.to : undefined;
  const prefixKey: MessageKey =
    action === "custody_return_confirmed"
      ? "orders2b2.event.custodyReturnConfirmed"
      : action === "device_custody_import_rolled_back"
        ? "orders2b2.event.custodyImportRolledBack"
        : action === "device_custody_corrected" || action === "terminal_custody_correction"
          ? "orders2b2.event.custodyCorrected"
          : !from || action === "device_custody_backfilled"
            ? "orders2b2.event.custodyBackfilled"
            : to === "with_shop" || action === "device_custody_received"
              ? "orders2b2.event.custodyReceived"
              : to === "with_customer" || action === "device_custody_returned"
                ? "orders2b2.event.custodyReturned"
                : "orders2b2.event.custodyUpdated";
  const route = to
    ? t("orders2b2.event.route", {
        from: localizeDeviceCustody(from, undefined, t),
        to: localizeDeviceCustody(
          to,
          action === "custody_return_confirmed" ? "confirmed" : undefined,
          t,
        ),
      })
    : "";
  const originalReason = typeof payload.reason === "string" ? payload.reason : "";
  const reason = originalReason.trim()
    ? t("orders2b2.event.reason", { reason: originalReason })
    : "";
  const credentialsCleared =
    payload.credentials_cleared === true ? t("orders2b2.event.credentialsCleared") : "";
  return `${t(prefixKey)}${route}${reason}${credentialsCleared}`;
}

function statusLabel(value: unknown, workflow: OrderWorkflow | undefined, t: Translate) {
  return typeof value === "string"
    ? localizeWorkflowStatusLabel(workflow, value as RepairOrderStatus, t)
    : "";
}

export function localizeOrderDetailEvent(
  event: Pick<OrderEvent, "event_type" | "payload">,
  workflow: OrderWorkflow | undefined,
  t: Translate,
  locale: AppLocale = "zh-CN",
) {
  const payload = event.payload;
  const custody = localizeCustodyEvent(payload, t);
  if (custody) return custody;
  switch (event.event_type) {
    case "created":
      return t("orders2b2.event.created");
    case "status_changed": {
      const from = statusLabel(payload.from, workflow, t);
      const to = statusLabel(payload.to, workflow, t);
      const summary =
        from && to
          ? t("orders2b2.event.statusRoute", { from, to })
          : t("orders2b2.event.statusChanged");
      const originalReason = typeof payload.reason === "string" ? payload.reason : "";
      const reason = originalReason.trim()
        ? t("orders2b2.event.reason", { reason: originalReason })
        : "";
      return `${summary}${reason}`;
    }
    case "quoted": {
      const amount = Number(payload.quotation_amount ?? payload.amount);
      return Number.isFinite(amount)
        ? t("orders2b2.event.quotedAmount", { amount: formatCurrency(amount, locale) })
        : t("orders2b2.event.quoted");
    }
    case "approval_sent": {
      if (payload.status_changed !== true) return t("orders2b2.event.approvalSent");
      const from = statusLabel(payload.from, workflow, t);
      const to = statusLabel(payload.to, workflow, t);
      return from && to
        ? t("orders2b2.event.approvalSentTransition", { from, to })
        : t("orders2b2.event.approvalSentChanged");
    }
    case "approval_result": {
      const result =
        payload.result === "approved"
          ? t("orders2b2.event.approved")
          : payload.result === "rejected"
            ? t("orders2b2.event.rejected")
            : typeof payload.result === "string"
              ? payload.result
              : t("orders2b2.event.approvalUpdated");
      const from = statusLabel(payload.from, workflow, t);
      const to = statusLabel(payload.to, workflow, t);
      const route = from && to ? t("orders2b2.event.route", { from, to }) : "";
      const originalReason = typeof payload.reason === "string" ? payload.reason : "";
      const reason = originalReason.trim()
        ? t("orders2b2.event.reason", { reason: originalReason })
        : "";
      return `${t("orders2b2.event.approvalResult", { result })}${route}${reason}`;
    }
    case "payment": {
      const method =
        payload.method === "现金"
          ? t("orders2b2.payment.cash")
          : payload.method === "刷卡"
            ? t("orders2b2.payment.card")
            : String(payload.method ?? "");
      return t("orders2b2.event.payment", {
        amount: formatCurrency(Number(payload.amount ?? 0), locale),
        method,
      });
    }
    case "message_sent":
      return payload.status_changed === true
        ? t("orders2b2.event.messageTransition", {
            from: statusLabel(payload.from, workflow, t),
            to: statusLabel(payload.to, workflow, t),
          })
        : t("orders2b2.event.messageSent");
    case "delivered":
      return t("orders2b2.event.delivered");
    case "note": {
      const action = typeof payload.action === "string" ? payload.action : "";
      if (action === "order_updated" || action === "order_patched") {
        const fields = Array.isArray(payload.changed_fields)
          ? payload.changed_fields.filter((field): field is string => typeof field === "string")
          : [];
        return fields.length
          ? t("orders2b2.event.orderFieldsUpdated", {
              fields: fields.join(t("orders2b2.event.fieldSeparator")),
            })
          : t("orders2b2.event.orderUpdated");
      }
      if (action === "order_finance_updated") return t("orders2b2.event.financeUpdated");
      if (action === "attachment_uploaded") {
        const file = typeof payload.file_name === "string" ? payload.file_name : "";
        return t("orders2b2.event.attachmentUploaded", { file });
      }
      if (action === "warranty_changed") {
        const from = String(payload.from_text ?? payload.from_months ?? "");
        const to = String(payload.to_text ?? payload.to_months ?? "");
        const originalReason = typeof payload.reason === "string" ? payload.reason : "";
        const reason = originalReason.trim()
          ? t("orders2b2.event.reason", { reason: originalReason })
          : "";
        return `${t("orders2b2.event.warrantyChanged", { from, to })}${reason}`;
      }
      return action || t("orders2b2.event.note");
    }
    default:
      return event.event_type;
  }
}

const attachmentKindKeys: Record<string, MessageKey> = {
  device_front: "orders2b2.photo.front",
  device_back: "orders2b2.photo.back",
  screen_on: "orders2b2.photo.screen",
  fault_photo: "orders2b2.photo.fault",
  signature: "orders2b2.photo.signature",
  other: "orders2b2.photo.other",
};

export function localizeOrderAttachmentKind(kind: string, t: Translate) {
  const key = attachmentKindKeys[kind];
  return key ? t(key) : kind;
}

export function localizeOrderMessageChannel(channel: string, t: Translate) {
  if (channel === "whatsapp") return "WhatsApp";
  if (channel === "sms") return t("orders2b2.channel.sms");
  return channel;
}

export function localizeOrderMessageStatus(status: string, t: Translate) {
  const key = (
    {
      sent: "orders2b2.message.sent",
      delivered: "orders2b2.message.delivered",
      read: "orders2b2.message.read",
      failed: "orders2b2.message.failed",
    } as const
  )[status as "sent" | "delivered" | "read" | "failed"];
  return key ? t(key) : status;
}
