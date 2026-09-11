"use client";

import { useEffect, useRef, useState } from "react";
import { Check, LayoutGrid, List, LoaderCircle, LocateFixed } from "lucide-react";
import { Button } from "@/components/ui/button";
import { StatusBadge } from "@/components/orders/badges";
import { OrderTransitionReasonSelector } from "./order-transition-reason-selector";
import {
  getDefaultOrderTransitionReason,
  getOrderTransitionReasonConfig,
} from "../model/order-transition-reasons";
import {
  buildTransitionPickerSequence,
  getTransitionPickerHintTarget,
  getTransitionPickerLabel,
  getTransitionPickerReasonTarget,
  getTransitionPickerRestriction,
  type TransitionPickerAction,
  type TransitionPickerSequenceEntry,
} from "../model/order-transition-picker";
import type { OrderListItem, OrderWorkflow } from "@/lib/repairdesk/types";
import type { RepairOrderStatus } from "@/lib/mock/enums";
import { useLocale } from "@/shared/i18n/locale-provider";
import { cn } from "@/lib/utils";

export interface OrderStatusTransitionPickerProps {
  open: boolean;
  order: Pick<OrderListItem, "id" | "public_no" | "status"> &
    Partial<Pick<OrderListItem, "approval_status" | "approval_flow_status">>;
  canPublishQuote?: boolean;
  onApprovalDecision?: () => void;
  workflow?: OrderWorkflow;
  actions: TransitionPickerAction[];
  pending: boolean;
  getActionHint: (to: RepairOrderStatus) => string;
  getErrorMessage: (error: unknown) => string;
  onOpenChange: (open: boolean) => void;
  onTransition: (to: RepairOrderStatus, reason?: string) => Promise<unknown>;
  className?: string;
}

export function OrderStatusTransitionPicker({
  open,
  order,
  workflow,
  actions,
  canPublishQuote = false,
  onApprovalDecision,
  pending,
  getActionHint,
  getErrorMessage,
  onOpenChange,
  onTransition,
  className,
}: OrderStatusTransitionPickerProps) {
  const { t } = useLocale();
  const [layout, setLayout] = useState<"list" | "grid">("list");
  const [selected, setSelected] = useState<RepairOrderStatus | null>(null);
  const [reasonDraft, setReasonDraft] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<{ failure: unknown } | null>(null);
  const submissionLock = useRef(false);
  const currentEntryRef = useRef<HTMLButtonElement | null>(null);
  const selectedSectionRef = useRef<HTMLElement | null>(null);
  const errorRef = useRef<HTMLParagraphElement | null>(null);
  const entries = buildTransitionPickerSequence(actions, workflow, order.status).map((entry) => {
    const restriction = entry.current
      ? undefined
      : getTransitionPickerRestriction(order, entry.code, workflow);
    const permission =
      entry.code === "quoted" && !canPublishQuote
        ? ("orders2b2.picker.permissionDenied" as const)
        : undefined;
    return {
      ...entry,
      restriction: restriction ?? permission,
      action: restriction || permission ? undefined : entry.action,
    };
  });
  const selectedAction = entries.find((entry) => entry.code === selected && !entry.current)?.action;
  const reasonTarget = selectedAction
    ? getTransitionPickerReasonTarget(selectedAction, workflow)
    : undefined;
  const reasonConfig = reasonTarget ? getOrderTransitionReasonConfig(reasonTarget) : undefined;
  const busy = pending || submitting;
  const canConfirm =
    Boolean(selectedAction) && !busy && (!reasonConfig?.required || Boolean(reasonDraft.trim()));
  const labels = entries.map((entry) => getTransitionPickerLabel(workflow, entry.code, t));
  const currentLabel = getTransitionPickerLabel(workflow, order.status, t);
  const selectedLabel = selectedAction
    ? getTransitionPickerLabel(workflow, selectedAction.to, t)
    : "";
  const locateCurrent = () => currentEntryRef.current?.scrollIntoView?.({ block: "center" });

  useEffect(() => {
    setSelected(null);
    setReasonDraft("");
    setError(null);
  }, [open, order.id]);
  useEffect(() => {
    if (open) currentEntryRef.current?.scrollIntoView?.({ block: "center" });
  }, [open, order.id, order.status, layout]);
  useEffect(() => {
    if (selected) selectedSectionRef.current?.scrollIntoView?.({ block: "nearest" });
  }, [selected]);
  useEffect(() => {
    if (error) errorRef.current?.scrollIntoView?.({ block: "nearest" });
  }, [error]);

  const choose = (action: TransitionPickerAction) => {
    if (busy || action.to === order.status || selected === action.to) return;
    setSelected(action.to);
    const target = getTransitionPickerReasonTarget(action, workflow);
    setReasonDraft(target ? getDefaultOrderTransitionReason(target) : "");
    setError(null);
  };
  const confirm = async () => {
    if (!selectedAction || !canConfirm || submissionLock.current) return;
    submissionLock.current = true;
    setSubmitting(true);
    setError(null);
    try {
      await onTransition(selectedAction.to, reasonDraft.trim() || undefined);
      onOpenChange(false);
    } catch (failure) {
      setError({ failure });
    } finally {
      submissionLock.current = false;
      setSubmitting(false);
    }
  };

  const renderEntry = (
    entry: TransitionPickerSequenceEntry & { restriction?: Parameters<typeof t>[0] },
    index: number,
  ) => {
    const label = labels[index]!;
    const duplicateLabel = labels.filter((value) => value === label).length > 1;
    const active = selected === entry.code && !entry.current;
    const unavailable = !entry.action || entry.current;
    const marker = entry.current ? (
      <span className="flex shrink-0 items-center gap-1 text-[10px] font-semibold text-primary dark:text-foreground">
        <LocateFixed className="size-3.5" aria-hidden="true" />
        {t("orders2b2.sequence.current")}
      </span>
    ) : active ? (
      <span className="flex shrink-0 items-center gap-1 text-[10px] font-semibold text-primary dark:text-foreground">
        <Check className="size-3.5" aria-hidden="true" />
        {t("orders2b2.sequence.selected")}
      </span>
    ) : unavailable ? (
      <span className="text-[10px] leading-4 text-muted-foreground">
        {t("orders2b2.sequence.unavailable")}
      </span>
    ) : (
      <span className="size-4 shrink-0 rounded-full border border-border" aria-hidden="true" />
    );
    return (
      <Button
        key={entry.code}
        ref={entry.current ? currentEntryRef : undefined}
        type="button"
        variant="outline"
        data-status-sequence-entry={entry.code}
        data-status-position={entry.position ?? undefined}
        data-status-current={entry.current ? "true" : undefined}
        data-status-configured={entry.configured ? "true" : "false"}
        data-status-option={entry.action && !entry.current ? entry.code : undefined}
        aria-current={entry.current ? "true" : undefined}
        aria-pressed={entry.action && !entry.current ? active : undefined}
        disabled={busy || unavailable}
        onClick={() => {
          if (entry.action) choose(entry.action);
        }}
        title={duplicateLabel ? `${label} · ${entry.code}` : label}
        className={cn(
          "h-auto min-h-12 w-full min-w-0 gap-2 rounded-lg border-border bg-card px-3 py-2.5 text-left text-xs shadow-none whitespace-normal",
          layout === "list"
            ? "grid grid-cols-[2rem_minmax(0,1fr)_auto] items-center"
            : "flex min-h-[76px] flex-col items-stretch justify-start",
          entry.current && "border-primary/35 bg-primary/5 disabled:opacity-100",
          active &&
            "border-primary/70 bg-primary/10 text-primary hover:bg-primary/15 dark:text-foreground",
          !entry.current &&
            !active &&
            entry.code === "cancelled" &&
            "text-status-danger-foreground",
        )}
      >
        <span
          className={layout === "grid" ? "flex items-center justify-between gap-2" : "contents"}
        >
          <span
            className={cn(
              "inline-flex size-7 shrink-0 items-center justify-center rounded-md font-mono text-[11px] tabular-nums",
              entry.current
                ? "bg-primary text-primary-foreground"
                : "bg-muted/70 text-muted-foreground",
            )}
          >
            {entry.position === null ? "—" : String(entry.position).padStart(2, "0")}
          </span>
          {layout === "grid" ? marker : null}
        </span>
        <span className="min-w-0 break-words font-medium leading-5">
          {label}
          {!entry.current && (entry.restriction || entry.code === "quoted") ? (
            <span className="block text-[10px] font-normal leading-4 text-muted-foreground">
              {t(entry.restriction ?? "orders2b2.picker.publishQuote")}
            </span>
          ) : null}
          {duplicateLabel ? (
            <span className="block break-all font-mono text-[10px] font-normal text-muted-foreground">
              {entry.code}
            </span>
          ) : null}
          {!entry.configured || !entry.enabled ? (
            <span className="block text-[10px] font-normal text-muted-foreground">
              {t(
                entry.configured
                  ? "orders2b2.sequence.disabled"
                  : "orders2b2.sequence.unconfigured",
              )}
            </span>
          ) : null}
        </span>
        {layout === "list" ? marker : null}
      </Button>
    );
  };

  return (
    <div
      data-status-picker="true"
      data-status-layout={layout}
      data-status-pending={busy ? "true" : "false"}
      className={cn("flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden", className)}
      aria-busy={busy}
    >
      <div className="shrink-0 space-y-2 border-b border-border px-4 pb-3 pt-2">
        {getTransitionPickerRestriction(order, "repairing", workflow) ===
        "orders2b2.picker.approvalRequired" ? (
          <div
            data-status-approval-required="true"
            className="flex flex-wrap items-center gap-2 rounded-lg bg-status-warn/10 px-3 py-2 text-xs text-status-warn-foreground"
          >
            <p className="min-w-0 flex-1">{t("orders2b2.picker.approvalRequired")}</p>
            {onApprovalDecision ? (
              <Button
                type="button"
                variant="outline"
                className="min-h-11 text-xs"
                disabled={busy}
                onClick={() => {
                  onOpenChange(false);
                  onApprovalDecision();
                }}
              >
                {t("orders2b2.overview.approvalAction")}
              </Button>
            ) : null}
          </div>
        ) : null}
        <div
          data-status-current-summary="true"
          className="flex min-w-0 items-center justify-between gap-2"
        >
          <span className="font-mono text-xs text-muted-foreground">{order.public_no}</span>
          <Button
            type="button"
            variant="ghost"
            data-status-locate-current="true"
            onClick={locateCurrent}
            aria-label={t("orders2b2.sequence.locate", { status: currentLabel })}
            className="min-h-11 min-w-0 gap-2 rounded-lg px-2"
          >
            <LocateFixed className="size-4 shrink-0" aria-hidden="true" />
            <StatusBadge
              status={order.status}
              label={currentLabel}
              className="max-w-full whitespace-normal text-[11px] leading-4"
            />
          </Button>
        </div>
        <div
          role="group"
          aria-label={t("orders2b2.sequence.layout")}
          className="grid grid-cols-2 gap-1 rounded-lg bg-muted/65 p-1"
        >
          {(["list", "grid"] as const).map((value) => {
            const Icon = value === "list" ? List : LayoutGrid;
            return (
              <Button
                key={value}
                type="button"
                variant="ghost"
                data-status-layout-option={value}
                aria-pressed={layout === value}
                onClick={() => setLayout(value)}
                disabled={busy}
                className={cn(
                  "min-h-11 min-w-0 gap-2 rounded-md px-2 text-xs",
                  layout === value &&
                    "bg-card text-primary shadow-sm hover:bg-card dark:text-foreground",
                )}
              >
                <Icon className="size-4 shrink-0" aria-hidden="true" />
                {t(value === "list" ? "orders2b2.sequence.list" : "orders2b2.sequence.grid")}
              </Button>
            );
          })}
        </div>
        <p className="text-[10px] leading-4 text-muted-foreground">
          {t("orders2b2.sequence.help")}
        </p>
      </div>
      <div
        data-status-scroll="true"
        className="min-h-0 min-w-0 flex-1 space-y-3 overflow-y-auto overscroll-contain px-4 py-3"
      >
        <div
          data-status-sequence="true"
          role="group"
          aria-label={t("orders2b2.sequence.all")}
          className={cn(
            "grid min-w-0 gap-2",
            layout === "grid" ? "grid-cols-2 sm:grid-cols-3" : "grid-cols-1",
          )}
        >
          {entries.map(renderEntry)}
        </div>
        {!actions.length ? (
          <p data-status-empty="true" className="py-2 text-xs leading-5 text-muted-foreground">
            {t("orders2b2.transition.empty")}
          </p>
        ) : null}
        {selectedAction ? (
          <section
            ref={selectedSectionRef}
            data-status-selected={selectedAction.to}
            className="min-w-0 space-y-3 border-t border-border pt-3"
          >
            <div>
              <p className="text-xs font-medium">
                {selectedAction.to === "quoted"
                  ? t("orders2b2.picker.publishQuote")
                  : t("orders2b2.picker.selected", { status: selectedLabel })}
              </p>
              <p
                className="mt-1 text-[11px] leading-5 text-muted-foreground"
                data-status-selected-hint="true"
              >
                {selectedAction.to === "quoted"
                  ? t("orders2b2.picker.publishQuoteHint")
                  : getActionHint(getTransitionPickerHintTarget(selectedAction, workflow))}
              </p>
            </div>
            {reasonTarget ? (
              <OrderTransitionReasonSelector
                target={reasonTarget}
                value={reasonDraft}
                onChange={setReasonDraft}
                disabled={busy}
                compact
              />
            ) : null}
          </section>
        ) : null}
        {error ? (
          <p
            ref={errorRef}
            role="alert"
            data-status-error="true"
            className="rounded-lg border border-status-danger-foreground/20 bg-status-danger/10 px-3 py-2 text-xs leading-5 text-status-danger-foreground"
          >
            {getErrorMessage(error.failure)}
          </p>
        ) : null}
      </div>
      <footer
        data-status-footer="true"
        className="grid shrink-0 grid-cols-[minmax(88px,.42fr)_minmax(0,1fr)] gap-2 border-t border-border bg-card px-4 py-3 pb-[max(.75rem,env(safe-area-inset-bottom))]"
      >
        <Button
          type="button"
          variant="outline"
          data-status-cancel="true"
          disabled={busy}
          className="min-h-11 rounded-lg text-xs"
          onClick={() => onOpenChange(false)}
        >
          {t("common.cancel")}
        </Button>
        <Button
          type="button"
          data-status-confirm="true"
          disabled={!canConfirm}
          onClick={() => void confirm()}
          className="h-auto min-h-11 min-w-0 gap-2 rounded-lg py-2 text-xs whitespace-normal"
        >
          {busy ? <LoaderCircle className="size-4 animate-spin" aria-hidden="true" /> : null}
          <span className="min-w-0 break-words">
            {busy
              ? t("orders2b2.hero.saving")
              : selectedAction
                ? selectedAction.to === "quoted"
                  ? t("orders2b2.picker.publishQuote")
                  : t("orders2b2.picker.confirmTarget", { status: selectedLabel })
                : t("orders2b2.transition.confirm")}
          </span>
        </Button>
      </footer>
    </div>
  );
}
