"use client";

import type { ReactNode, RefObject } from "react";
import { ArrowRight, ClipboardList, RefreshCw, Wrench } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import type {
  InventoryAfterSalesStatus,
  InventoryLifecycleAfterSalesQueueItem,
  InventoryLifecycleAfterSalesCaseDetail,
} from "@/lib/repairdesk/types";
import { repairOs } from "@/lib/ui-patterns";
import { cn } from "@/lib/utils";
import { useLocale } from "@/shared/i18n/locale-provider";

import { InventoryLifecyclePageShell } from "./inventory-lifecycle-page-shell";
import {
  InventoryLifecycleField,
  InventoryLifecycleValidationSummary,
  type InventoryLifecycleValidationIssue,
} from "./inventory-lifecycle-field-feedback";
import { InventoryLifecycleUnavailableCard } from "./inventory-lifecycle-status";
import {
  formatInventoryLifecycleDate,
  localizeInventoryAfterSalesStatus,
  localizeInventoryCoverage,
} from "../model/inventory-lifecycle-i18n";

const statusCopy = {
  open: "待检测",
  in_progress: "处理中",
  waiting_customer: "等客户",
  returned: "已返还",
  closed: "已关闭",
} as const;

export type InventoryLifecycleSaleWorkspaceProps = {
  title: string;
  context: string;
  status?: ReactNode;
  onBack: () => void;
  overview?: ReactNode;
  feedback?: ReactNode;
  children: ReactNode;
};

/**
 * Shared lifecycle sale workspace composition. The production adapter owns
 * query/mutation/router/authority state and supplies the same presentational
 * slots that local Storybook workbench states use.
 */
export function InventoryLifecycleSaleWorkspace({
  title,
  context,
  status,
  onBack,
  overview,
  feedback,
  children,
}: InventoryLifecycleSaleWorkspaceProps) {
  return (
    <InventoryLifecyclePageShell title={title} context={context} status={status} onBack={onBack}>
      {overview}
      {feedback}
      <div data-inventory-lifecycle-body="sale" className="grid gap-2">
        {children}
      </div>
    </InventoryLifecyclePageShell>
  );
}

export type InventoryAfterSalesQueueBodyProps = {
  items: InventoryLifecycleAfterSalesQueueItem[];
  onOpen: (item: InventoryLifecycleAfterSalesQueueItem) => void;
  emptyTitle?: string;
  emptyBody?: string;
  privacyRedacted?: boolean;
};

/** Queue body used by both the route adapter and the local synthetic story. */
export function InventoryAfterSalesQueueBody({
  items,
  onOpen,
  emptyTitle,
  emptyBody,
  privacyRedacted = false,
}: InventoryAfterSalesQueueBodyProps) {
  const { locale, t } = useLocale();
  const visibleItems = privacyRedacted ? [] : items;
  return (
    <div data-inventory-lifecycle-body="after-sales-queue" className="grid gap-2">
      <section
        className="grid grid-cols-3 gap-2"
        aria-label={t("inventory2b4.afterSales.summaryAria")}
      >
        <QueueMetric
          label={t("inventory2b4.afterSales.active")}
          value={visibleItems.length}
          icon={ClipboardList}
        />
        <QueueMetric
          label={t("inventory2b4.afterSales.open")}
          value={visibleItems.filter((item) => item.status === "open").length}
          icon={Wrench}
        />
        <QueueMetric
          label={t("inventory2b4.afterSales.waitingCustomer")}
          value={visibleItems.filter((item) => item.status === "waiting_customer").length}
          icon={RefreshCw}
        />
      </section>
      {privacyRedacted ? (
        <InventoryLifecycleUnavailableCard
          title={t("inventory2b4.afterSales.privacyTitle")}
          body={t("inventory2b4.afterSales.privacyBody")}
        />
      ) : visibleItems.length === 0 ? (
        <InventoryLifecycleUnavailableCard
          title={emptyTitle ?? t("inventory2b4.afterSales.emptyTitle")}
          body={emptyBody ?? t("inventory2b4.afterSales.emptyBody")}
        />
      ) : null}
      <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
        {visibleItems.map((item) => (
          <button
            key={item.case_id}
            type="button"
            onClick={() => onOpen(item)}
            className={cn(
              repairOs.mobileInfoCard,
              "group min-h-28 w-full p-3 text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
            )}
            aria-label={t("inventory2b4.afterSales.openCase", { issue: item.issue_summary })}
          >
            <div className="flex items-start justify-between gap-2">
              <div className="min-w-0">
                <p className="truncate font-mono text-xs text-primary">{item.sku}</p>
                <h2 className="mt-1 line-clamp-2 text-sm font-semibold">{item.issue_summary}</h2>
              </div>
              <span className="shrink-0 rounded-full bg-status-warn px-2 py-1 text-[10px] text-status-warn-foreground">
                {localizeInventoryAfterSalesStatus(
                  item.status,
                  statusCopy[item.status] ?? item.status,
                  t,
                )}
              </span>
            </div>
            <div className="mt-3 flex items-center justify-between text-[10px] text-muted-foreground">
              <span>{formatInventoryLifecycleDate(item.received_at, locale, t)}</span>
              <span className="inline-flex min-h-11 items-center gap-1 text-primary">
                {t("inventory2b4.afterSales.openAction")}
                <ArrowRight className="size-3" aria-hidden="true" />
              </span>
            </div>
          </button>
        ))}
      </div>
    </div>
  );
}

/** The read-only case overview shared by the route adapter and workbench stories. */
export function InventoryAfterSalesCaseOverview({
  item,
}: {
  item: InventoryLifecycleAfterSalesCaseDetail;
}) {
  const { locale, t } = useLocale();
  return (
    <section className={cn(repairOs.mobileInfoCard, "p-3 sm:p-4")}>
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="font-mono text-xs text-primary">{item.sku}</p>
          <h2 className="mt-1 text-sm font-semibold">{item.issue_summary}</h2>
        </div>
        <span className="shrink-0 rounded-full bg-status-warn px-2 py-1 text-[10px] text-status-warn-foreground">
          {localizeInventoryAfterSalesStatus(
            item.status,
            statusCopy[item.status] ?? item.status,
            t,
          )}
        </span>
      </div>
      <div className="mt-3 grid grid-cols-2 gap-2 text-xs">
        <div className="rounded-xl bg-[var(--surface-panel-muted)] p-2">
          <span className="text-[10px] text-muted-foreground">
            {t("inventory2b4.afterSales.receivedAt")}
          </span>
          <strong className="mt-1 block">
            {formatInventoryLifecycleDate(item.received_at, locale, t)}
          </strong>
        </div>
        <div className="rounded-xl bg-[var(--surface-panel-muted)] p-2">
          <span className="text-[10px] text-muted-foreground">
            {t("inventory2b4.afterSales.coverage")}
          </span>
          <strong className="mt-1 block">
            {localizeInventoryCoverage(
              item.coverage_decision ?? "pending",
              coverageLabel(item.coverage_decision),
              t,
            )}
          </strong>
        </div>
      </div>
    </section>
  );
}

export type InventoryAfterSalesCaseEditorProps = {
  status: InventoryAfterSalesStatus;
  nextStatuses: InventoryAfterSalesStatus[];
  coverage: string;
  diagnosis: string;
  diagnosisError?: string;
  validationIssues?: readonly InventoryLifecycleValidationIssue[];
  validationAttempt?: number;
  writePending: boolean;
  mutationPending?: boolean;
  onStatusChange: (status: InventoryAfterSalesStatus) => void;
  onCoverageChange: (coverage: string) => void;
  onDiagnosisChange: (diagnosis: string) => void;
  onPrimary: () => void;
  primaryLabel?: string;
  closeTriggerRef?: RefObject<HTMLButtonElement | null>;
};

/**
 * Shared controlled case editor. It owns only fields and visual feedback;
 * mutation, idempotency, authority, and close semantics remain in adapters.
 */
export function InventoryAfterSalesCaseEditor({
  status,
  nextStatuses,
  coverage,
  diagnosis,
  diagnosisError,
  validationIssues = [],
  validationAttempt = 0,
  writePending,
  mutationPending = false,
  onStatusChange,
  onCoverageChange,
  onDiagnosisChange,
  onPrimary,
  primaryLabel,
  closeTriggerRef,
}: InventoryAfterSalesCaseEditorProps) {
  const { t } = useLocale();
  return (
    <fieldset disabled={writePending} className="contents">
      <section className={cn(repairOs.mobileInfoCard, "grid gap-3 p-3 sm:p-4")}>
        <div className="flex items-center gap-2">
          <Wrench className="size-4 text-primary" aria-hidden="true" />
          <h2 className="text-sm font-semibold">{t("inventory2b4.afterSales.advance")}</h2>
        </div>
        <div className="grid gap-1.5">
          <Label className="text-xs" htmlFor="inventory-after-sales-next-status">
            {t("inventory2b4.afterSales.nextStatus")}
          </Label>
          <select
            id="inventory-after-sales-next-status"
            className="h-11 rounded-md border bg-background px-3 text-sm"
            value={status}
            onChange={(event) => onStatusChange(event.target.value as InventoryAfterSalesStatus)}
          >
            {nextStatuses.map((nextStatus) => (
              <option key={nextStatus} value={nextStatus}>
                {localizeInventoryAfterSalesStatus(
                  nextStatus,
                  statusCopy[nextStatus] ?? nextStatus,
                  t,
                )}
              </option>
            ))}
          </select>
        </div>
        <div className="grid gap-1.5">
          <Label className="text-xs" htmlFor="inventory-after-sales-coverage">
            {t("inventory2b4.afterSales.coverage")}
          </Label>
          <select
            id="inventory-after-sales-coverage"
            className="h-11 rounded-md border bg-background px-3 text-sm"
            value={coverage}
            onChange={(event) => onCoverageChange(event.target.value)}
          >
            {coverage !== "pending" && coverage !== "covered" && coverage !== "not_covered" ? (
              <option value={coverage}>{coverage}</option>
            ) : null}
            <option value="pending">{localizeInventoryCoverage("pending", "待判断", t)}</option>
            <option value="covered">{localizeInventoryCoverage("covered", "在保障范围", t)}</option>
            <option value="not_covered">
              {localizeInventoryCoverage("not_covered", "不在保障范围", t)}
            </option>
          </select>
        </div>
        <InventoryLifecycleValidationSummary
          issues={validationIssues}
          focusRequestKey={validationAttempt}
          onFocusField={(fieldId) => document.getElementById(fieldId)?.focus()}
        />
        <InventoryLifecycleField
          id="inventory-after-sales-diagnosis"
          label={t("inventory2b4.afterSales.diagnosis")}
          required
          error={diagnosisError}
        >
          <Textarea
            id="inventory-after-sales-diagnosis"
            required
            value={diagnosis}
            onChange={(event) => onDiagnosisChange(event.target.value)}
            aria-invalid={Boolean(diagnosisError) || undefined}
            aria-describedby={diagnosisError ? "inventory-after-sales-diagnosis-error" : undefined}
            className="min-h-24"
          />
        </InventoryLifecycleField>
        <Button
          className="min-h-11"
          ref={closeTriggerRef}
          disabled={writePending}
          onClick={onPrimary}
        >
          {primaryLabel ?? t("inventory2b4.afterSales.save")}
        </Button>
        {mutationPending ? (
          <p role="status" aria-live="polite" className="text-xs text-muted-foreground">
            {t("inventory2b4.afterSales.pending")}
          </p>
        ) : null}
      </section>
    </fieldset>
  );
}

export type InventoryAfterSalesCaseWorkspaceProps = {
  item?: InventoryLifecycleAfterSalesCaseDetail;
  title: string;
  context: string;
  onBack: () => void;
  overview?: ReactNode;
  feedback?: ReactNode;
  editor?: ReactNode;
  timeline?: ReactNode;
  closeDialog?: ReactNode;
  noAction?: ReactNode;
  children?: ReactNode;
};

/**
 * Shared after-sales case page composition. Only props/slots are accepted so
 * stories can exercise the body without mounting query or mutation adapters.
 */
export function InventoryAfterSalesCaseWorkspace({
  title,
  context,
  onBack,
  overview,
  feedback,
  editor,
  timeline,
  closeDialog,
  noAction,
  children,
}: InventoryAfterSalesCaseWorkspaceProps) {
  return (
    <InventoryLifecyclePageShell title={title} context={context} onBack={onBack}>
      <div data-inventory-lifecycle-body="after-sales-case" className="grid gap-2">
        {overview}
        {feedback}
        {children}
        {editor ?? noAction}
        {timeline}
        {closeDialog}
      </div>
    </InventoryLifecyclePageShell>
  );
}

function QueueMetric({
  label,
  value,
  icon: Icon,
}: {
  label: string;
  value: number;
  icon: typeof ClipboardList;
}) {
  return (
    <div className={cn(repairOs.metricCardDense, "min-w-0 p-2.5")}>
      <Icon className="size-4 text-primary" aria-hidden="true" />
      <strong className="mt-1 block text-lg">{value}</strong>
      <span className="block truncate text-[10px] text-muted-foreground">{label}</span>
    </div>
  );
}

function coverageLabel(value?: string) {
  if (!value || value === "pending") return "待判断";
  if (value === "covered") return "保障范围内";
  if (value === "not_covered") return "不在保障范围";
  return value;
}
