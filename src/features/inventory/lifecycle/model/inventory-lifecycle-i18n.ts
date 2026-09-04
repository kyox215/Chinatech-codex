import type {
  InventoryAfterSalesStatus,
  InventoryLifecycleCommand,
  InventoryLifecycleProjection,
  InventoryLifecycleProjectionConfidence,
  InventoryLifecycleProjectionMode,
  InventoryLifecycleProjectionStatus,
} from "@/lib/repairdesk/types";
import type { InventoryNoActionGuidance } from "@/features/inventory/model/inventory-no-action-guidance";
import type { InventoryOperationReceipt } from "@/features/inventory/model/inventory-operation-receipt";
import type {
  InventoryLifecycleTimelineEntry,
  InventoryLifecycleTimelineResult,
} from "@/features/inventory/lifecycle/model/inventory-lifecycle-timeline";
import type { InventoryLifecycleProjectionMeta } from "@/features/inventory/lifecycle/model/projection";
import { formatCurrency, formatDateTime } from "@/shared/i18n/format";
import type { AppLocale } from "@/shared/i18n/locales";
import type { MessageKey, MessageValues } from "@/shared/i18n/messages";

type Translate = (key: MessageKey, values?: MessageValues) => string;

const commandKeys: Record<InventoryLifecycleCommand, MessageKey> = {
  "acquisition.save": "inventory2b4.command.acquisitionSave",
  "inspection.save": "inventory2b4.command.inspectionSave",
  "reservation.create": "inventory2b4.command.reservationCreate",
  "payment.append": "inventory2b4.command.paymentAppend",
  "sale.complete": "inventory2b4.command.saleComplete",
  "pickup.confirm": "inventory2b4.command.pickupConfirm",
  "reservation.cancel": "inventory2b4.command.reservationCancel",
  "warranty.adjust": "inventory2b4.command.warrantyAdjust",
  "after_sales.create": "inventory2b4.command.afterSalesCreate",
  "after_sales.update": "inventory2b4.command.afterSalesUpdate",
  "after_sales.close": "inventory2b4.command.afterSalesClose",
};

const projectionStatusKeys: Record<InventoryLifecycleProjectionStatus, MessageKey> = {
  processing: "inventory2b4.lifecycle.status.processing",
  in_stock: "inventory2b4.lifecycle.status.inStock",
  reserved: "inventory2b4.lifecycle.status.reserved",
  sold_pending_pickup: "inventory2b4.lifecycle.status.soldPendingPickup",
  delivered: "inventory2b4.lifecycle.status.delivered",
  after_sales: "inventory2b4.lifecycle.status.afterSales",
  removed: "inventory2b4.lifecycle.status.removed",
};

const projectionModeKeys: Record<InventoryLifecycleProjectionMode, MessageKey> = {
  exact: "inventory2b4.lifecycle.mode.exact",
  compatible: "inventory2b4.lifecycle.mode.compatible",
  unavailable: "inventory2b4.lifecycle.mode.unavailable",
};

const confidenceKeys: Record<InventoryLifecycleProjectionConfidence, MessageKey> = {
  high: "inventory2b4.lifecycle.confidence.high",
  medium: "inventory2b4.lifecycle.confidence.medium",
  low: "inventory2b4.lifecycle.confidence.low",
};

const afterSalesKeys: Record<InventoryAfterSalesStatus, MessageKey> = {
  open: "inventory2b4.afterSales.open",
  in_progress: "inventory2b4.afterSales.inProgress",
  waiting_customer: "inventory2b4.afterSales.waitingCustomer",
  returned: "inventory2b4.afterSales.returned",
  closed: "inventory2b4.afterSales.closed",
};

const paymentKindKeys: Record<string, MessageKey> = {
  deposit: "inventory2b4.paymentKind.deposit",
  balance: "inventory2b4.paymentKind.balance",
  payment: "inventory2b4.paymentKind.payment",
  refund: "inventory2b4.paymentKind.refund",
  reversal: "inventory2b4.paymentKind.reversal",
};

const paymentMethodKeys: Record<string, MessageKey> = {
  cash: "inventory2b4.paymentMethod.cash",
  card: "inventory2b4.paymentMethod.card",
  bancomat: "inventory2b4.paymentMethod.bancomat",
  transfer: "inventory2b4.paymentMethod.transfer",
  other: "inventory2b4.paymentMethod.other",
};

const dispositionKeys: Record<string, MessageKey> = {
  refund_pending: "inventory2b4.disposition.refundPending",
  retain: "inventory2b4.disposition.retain",
  pending: "inventory2b4.disposition.pending",
};

const coverageKeys: Record<string, MessageKey> = {
  pending: "inventory2b4.coverage.pending",
  covered: "inventory2b4.coverage.covered",
  not_covered: "inventory2b4.coverage.notCovered",
};

const warrantyBasisKeys: Record<string, MessageKey> = {
  legal: "inventory2b4.warrantyBasis.legal",
  commercial: "inventory2b4.warrantyBasis.commercial",
};

const projectionMetaKeys: Record<
  InventoryLifecycleProjectionStatus,
  { label: MessageKey; shortLabel: MessageKey; description: MessageKey; nextStep?: MessageKey }
> = {
  processing: {
    label: "inventory2b4.projection.processing.label",
    shortLabel: "inventory2b4.projection.processing.short",
    description: "inventory2b4.projection.processing.description",
    nextStep: "inventory2b4.projection.processing.next",
  },
  in_stock: {
    label: "inventory2b4.projection.inStock.label",
    shortLabel: "inventory2b4.projection.inStock.short",
    description: "inventory2b4.projection.inStock.description",
    nextStep: "inventory2b4.projection.inStock.next",
  },
  reserved: {
    label: "inventory2b4.projection.reserved.label",
    shortLabel: "inventory2b4.projection.reserved.short",
    description: "inventory2b4.projection.reserved.description",
    nextStep: "inventory2b4.projection.reserved.next",
  },
  sold_pending_pickup: {
    label: "inventory2b4.projection.soldPendingPickup.label",
    shortLabel: "inventory2b4.projection.soldPendingPickup.short",
    description: "inventory2b4.projection.soldPendingPickup.description",
    nextStep: "inventory2b4.projection.soldPendingPickup.next",
  },
  delivered: {
    label: "inventory2b4.projection.delivered.label",
    shortLabel: "inventory2b4.projection.delivered.short",
    description: "inventory2b4.projection.delivered.description",
    nextStep: "inventory2b4.projection.delivered.next",
  },
  after_sales: {
    label: "inventory2b4.projection.afterSales.label",
    shortLabel: "inventory2b4.projection.afterSales.short",
    description: "inventory2b4.projection.afterSales.description",
    nextStep: "inventory2b4.projection.afterSales.next",
  },
  removed: {
    label: "inventory2b4.projection.removed.label",
    shortLabel: "inventory2b4.projection.removed.short",
    description: "inventory2b4.projection.removed.description",
  },
};

export function localizeInventoryLifecycleCommand(code: string, fallback: string, t: Translate) {
  const key = commandKeys[code as InventoryLifecycleCommand];
  return key ? t(key) : fallback;
}

export function localizeInventoryLifecycleStatus(code: string, fallback: string, t: Translate) {
  const key = projectionStatusKeys[code as InventoryLifecycleProjectionStatus];
  return key ? t(key) : fallback;
}

export function localizeInventoryLifecycleMode(code: string, fallback: string, t: Translate) {
  const key = projectionModeKeys[code as InventoryLifecycleProjectionMode];
  return key ? t(key) : fallback;
}

export function localizeInventoryLifecycleConfidence(code: string, fallback: string, t: Translate) {
  const key = confidenceKeys[code as InventoryLifecycleProjectionConfidence];
  return key ? t(key) : fallback;
}

export function localizeInventoryAfterSalesStatus(code: string, fallback: string, t: Translate) {
  const key = afterSalesKeys[code as InventoryAfterSalesStatus];
  return key ? t(key) : fallback;
}

function localizeStable(
  code: string,
  fallback: string,
  keys: Record<string, MessageKey>,
  t: Translate,
) {
  const key = keys[code];
  return key ? t(key) : fallback;
}

export const localizeInventoryPaymentKind = (code: string, fallback: string, t: Translate) =>
  localizeStable(code, fallback, paymentKindKeys, t);
export const localizeInventoryPaymentMethod = (code: string, fallback: string, t: Translate) =>
  localizeStable(code, fallback, paymentMethodKeys, t);
export const localizeInventoryCancelDisposition = (code: string, fallback: string, t: Translate) =>
  localizeStable(code, fallback, dispositionKeys, t);
export const localizeInventoryCoverage = (code: string, fallback: string, t: Translate) =>
  localizeStable(code, fallback, coverageKeys, t);
export const localizeInventoryWarrantyBasis = (code: string, fallback: string, t: Translate) =>
  localizeStable(code, fallback, warrantyBasisKeys, t);

export function localizeInventoryProjectionMeta(
  projection: InventoryLifecycleProjection,
  raw: InventoryLifecycleProjectionMeta,
  legacyStatus: string | null | undefined,
  t: Translate,
): InventoryLifecycleProjectionMeta {
  let keys = projectionMetaKeys[projection.status];
  if (projection.mode === "compatible" && legacyStatus === "sold") {
    keys = {
      label: "inventory2b4.projection.compatibleSold.label",
      shortLabel: "inventory2b4.projection.compatibleSold.short",
      description: "inventory2b4.projection.compatibleSold.description",
      nextStep: "inventory2b4.projection.compatibleSold.next",
    };
  } else if (projection.status === "sold_pending_pickup" && projection.needs_review) {
    keys = {
      label: "inventory2b4.projection.soldReview.label",
      shortLabel: "inventory2b4.projection.soldReview.short",
      description: "inventory2b4.projection.soldReview.description",
      nextStep: "inventory2b4.projection.soldReview.next",
    };
  } else if (projection.status === "processing" && projection.needs_review) {
    keys = {
      label:
        legacyStatus === "returned"
          ? "inventory2b4.projection.returnedReview.label"
          : "inventory2b4.projection.processingReview.label",
      shortLabel: "inventory2b4.projection.processingReview.short",
      description: "inventory2b4.projection.processingReview.description",
      nextStep: "inventory2b4.projection.processingReview.next",
    };
  }
  return {
    ...raw,
    label: t(keys.label),
    shortLabel: t(keys.shortLabel),
    description: t(keys.description),
    nextStep: keys.nextStep ? t(keys.nextStep) : undefined,
  };
}

const noActionKeys: Record<InventoryNoActionGuidance["state"], MessageKey> = {
  "projection-unavailable": "inventory2b4.noAction.projectionUnavailable",
  "facts-need-review": "inventory2b4.noAction.factsNeedReview",
  "terminal-complete": "inventory2b4.noAction.terminalComplete",
  "server-readonly": "inventory2b4.noAction.serverReadonly",
  "target-unavailable": "inventory2b4.noAction.targetUnavailable",
  loading: "inventory2b4.noAction.loading",
};

export function localizeInventoryNoActionGuidance(
  guidance: InventoryNoActionGuidance,
  t: Translate,
) {
  const action = guidance.targetCommand
    ? localizeInventoryLifecycleCommand(guidance.targetCommand, guidance.targetCommand, t)
    : "";
  return t(noActionKeys[guidance.state], { action });
}

type ReceiptPresentationKeys = {
  title: MessageKey;
  description: MessageKey;
  ledgerSemantics: MessageKey;
  nextStep: MessageKey;
};

const receiptPresentationKeys: Record<InventoryLifecycleCommand, ReceiptPresentationKeys> = {
  "acquisition.save": {
    title: "inventory2b4.receipt.acquisitionSave.title",
    description: "inventory2b4.receipt.acquisitionSave.description",
    ledgerSemantics: "inventory2b4.receipt.acquisitionSave.ledger",
    nextStep: "inventory2b4.receipt.acquisitionSave.next",
  },
  "inspection.save": {
    title: "inventory2b4.receipt.inspectionSave.title",
    description: "inventory2b4.receipt.inspectionSave.description",
    ledgerSemantics: "inventory2b4.receipt.inspectionSave.ledger",
    nextStep: "inventory2b4.receipt.inspectionSave.next",
  },
  "reservation.create": {
    title: "inventory2b4.receipt.reservationCreate.title",
    description: "inventory2b4.receipt.reservationCreate.description",
    ledgerSemantics: "inventory2b4.receipt.reservationCreate.ledger",
    nextStep: "inventory2b4.receipt.reservationCreate.next",
  },
  "payment.append": {
    title: "inventory2b4.receipt.paymentAppend.title",
    description: "inventory2b4.receipt.paymentAppend.description",
    ledgerSemantics: "inventory2b4.receipt.paymentAppend.ledger",
    nextStep: "inventory2b4.receipt.paymentAppend.next",
  },
  "sale.complete": {
    title: "inventory2b4.receipt.saleComplete.title",
    description: "inventory2b4.receipt.saleComplete.description",
    ledgerSemantics: "inventory2b4.receipt.saleComplete.ledger",
    nextStep: "inventory2b4.receipt.saleComplete.next",
  },
  "pickup.confirm": {
    title: "inventory2b4.receipt.pickupConfirm.title",
    description: "inventory2b4.receipt.pickupConfirm.description",
    ledgerSemantics: "inventory2b4.receipt.pickupConfirm.ledger",
    nextStep: "inventory2b4.receipt.pickupConfirm.next",
  },
  "reservation.cancel": {
    title: "inventory2b4.receipt.reservationCancel.title",
    description: "inventory2b4.receipt.reservationCancel.description",
    ledgerSemantics: "inventory2b4.receipt.reservationCancel.ledger",
    nextStep: "inventory2b4.receipt.reservationCancel.next",
  },
  "warranty.adjust": {
    title: "inventory2b4.receipt.warrantyAdjust.title",
    description: "inventory2b4.receipt.warrantyAdjust.description",
    ledgerSemantics: "inventory2b4.receipt.warrantyAdjust.ledger",
    nextStep: "inventory2b4.receipt.warrantyAdjust.next",
  },
  "after_sales.create": {
    title: "inventory2b4.receipt.afterSalesCreate.title",
    description: "inventory2b4.receipt.afterSalesCreate.description",
    ledgerSemantics: "inventory2b4.receipt.afterSalesCreate.ledger",
    nextStep: "inventory2b4.receipt.afterSalesCreate.next",
  },
  "after_sales.update": {
    title: "inventory2b4.receipt.afterSalesUpdate.title",
    description: "inventory2b4.receipt.afterSalesUpdate.description",
    ledgerSemantics: "inventory2b4.receipt.afterSalesUpdate.ledger",
    nextStep: "inventory2b4.receipt.afterSalesUpdate.next",
  },
  "after_sales.close": {
    title: "inventory2b4.receipt.afterSalesClose.title",
    description: "inventory2b4.receipt.afterSalesClose.description",
    ledgerSemantics: "inventory2b4.receipt.afterSalesClose.ledger",
    nextStep: "inventory2b4.receipt.afterSalesClose.next",
  },
};

export function localizeInventoryOperationReceipt(
  receipt: InventoryOperationReceipt,
  t: Translate,
): InventoryOperationReceipt {
  const keys = receiptPresentationKeys[receipt.command];
  const action = keys
    ? localizeInventoryLifecycleCommand(receipt.command, "", t)
    : t("nav.inventory.short");
  const description = keys
    ? t(keys.description)
    : t("inventory2b4.receipt.description", { action });
  return {
    ...receipt,
    title:
      receipt.kind === "idempotent-replay"
        ? t("inventory2b4.receipt.replayedTitle", { action })
        : keys
          ? t(keys.title)
          : t("inventory2b4.receipt.confirmedTitle", { action }),
    description:
      receipt.kind === "idempotent-replay"
        ? t("inventory2b4.receipt.replayedDescription", {
            details: description,
          })
        : description,
    ledgerSemantics: t(keys?.ledgerSemantics ?? "inventory2b4.receipt.ledger"),
    nextStep: t(keys?.nextStep ?? "inventory2b4.receipt.next"),
  };
}

const timelineStatusKeys: Record<string, MessageKey> = {
  ...projectionStatusKeys,
  ...afterSalesKeys,
  open: "inventory2b4.timeline.status.awaitingInspection",
};

const timelineEventKeys: Record<string, MessageKey> = {
  created: "inventory2b4.timeline.event.created",
  status_changed: "inventory2b4.timeline.event.statusChanged",
};

const milestoneKeys: Record<string, MessageKey> = {
  inspection: "inventory2b4.timeline.milestone.inspection",
  reserved: "inventory2b4.timeline.milestone.reserved",
  sold: "inventory2b4.timeline.milestone.sold",
  pickup: "inventory2b4.timeline.milestone.pickup",
  "after-sales": "inventory2b4.timeline.milestone.afterSales",
};

function milestoneCode(entry: InventoryLifecycleTimelineEntry) {
  if (entry.source !== "milestone-summary") return undefined;
  return Object.keys(milestoneKeys).find((code) => entry.id === `milestone:${code}:${entry.at}`);
}

function localizeTimelineEntry(entry: InventoryLifecycleTimelineEntry, t: Translate) {
  const milestone = milestoneCode(entry);
  const eventKey = entry.eventType ? timelineEventKeys[entry.eventType] : undefined;
  const milestoneKey = milestone ? milestoneKeys[milestone] : undefined;
  const fromKey = entry.fromStatus ? timelineStatusKeys[entry.fromStatus] : undefined;
  const toKey = entry.toStatus ? timelineStatusKeys[entry.toStatus] : undefined;
  return {
    ...entry,
    label: eventKey
      ? t(eventKey)
      : entry.source === "ledger-event"
        ? t("inventory2b4.timeline.event.generic")
        : milestoneKey
          ? t(milestoneKey)
          : entry.label,
    fromStatusLabel: fromKey ? t(fromKey) : (entry.fromStatusLabel ?? entry.fromStatus),
    toStatusLabel: toKey ? t(toKey) : (entry.toStatusLabel ?? entry.toStatus),
  };
}

export function localizeInventoryTimeline(
  timeline: InventoryLifecycleTimelineResult,
  t: Translate,
): InventoryLifecycleTimelineResult {
  return {
    ...timeline,
    items: timeline.items.map((entry) => localizeTimelineEntry(entry, t)),
    scope: {
      ...timeline.scope,
      label: t(
        timeline.scope.source === "milestone-summary"
          ? "inventory2b4.timeline.scope.milestones"
          : "inventory2b4.timeline.scope.events",
        { count: timeline.scope.displayedCount },
      ),
    },
  };
}

export function formatInventoryLifecycleDate(
  value: Date | string | number | null | undefined,
  locale: AppLocale,
  t: Translate,
) {
  if (value === null || value === undefined || value === "") {
    return t("inventory2b4.common.dateUnavailable");
  }
  const date = new Date(value);
  if (!Number.isFinite(date.getTime())) return t("inventory2b4.common.dateUnavailable");
  return formatDateTime(date, locale);
}

export function formatInventoryLifecycleMoney(
  value: number | null | undefined,
  locale: AppLocale,
  t: Translate,
) {
  return typeof value === "number" && Number.isFinite(value)
    ? formatCurrency(value, locale)
    : t("inventory2b4.common.amountUnavailable");
}
