"use client";

import { useEffect, useId, useRef, useState, type RefObject } from "react";
import { ChevronDown, Check, FileText, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Sheet, SheetContent, SheetTitle, SheetDescription } from "@/components/ui/sheet";
import { useViewportMode } from "@/hooks/use-mobile";
import { componentOverlay } from "@/lib/component-patterns";
import type { OrderDetail, PatchOrderChanges } from "@/lib/repairdesk/types";
import { cn } from "@/lib/utils";
import { useLocale } from "@/shared/i18n/locale-provider";
import {
  appendFaultDescriptionItems,
  getFaultDescriptionSourceItems,
  hasFaultDescriptionItem,
  type FaultDescriptionSourceItem,
} from "@/features/orders/model/order-fault-description";

export type FaultDescriptionSave = {
  changes: Pick<PatchOrderChanges, "issue_description" | "diagnosis_result">;
  expectedUpdatedAt: string;
};
type FaultOrder = Pick<
  OrderDetail["order"],
  "id" | "updated_at" | "issue_description" | "diagnosis_result" | "fault_prices" | "public_no"
>;
type Baseline = { id: string; version: string; issue: string; diagnosis: string };
const baselineOf = (order: FaultOrder): Baseline => ({
  id: order.id,
  version: order.updated_at,
  issue: order.issue_description || "",
  diagnosis: order.diagnosis_result || "",
});

export function OrderFaultDescriptionEditor({
  open,
  order,
  canEditIntake,
  canEditRepair,
  pending,
  onOpenChange,
  onSave,
  onReload,
  getErrorMessage,
  embedded = false,
  closeRequestRef,
  returnFocusRef,
}: {
  open: boolean;
  embedded?: boolean;
  returnFocusRef?: RefObject<HTMLElement | null>;
  closeRequestRef?: RefObject<((reason: "close" | "escape" | "outside") => void) | null>;
  order: FaultOrder;
  canEditIntake: boolean;
  canEditRepair: boolean;
  pending: boolean;
  onOpenChange: (open: boolean) => void;
  onSave: (input: FaultDescriptionSave) => Promise<void>;
  onReload: () => Promise<FaultOrder | void>;
  getErrorMessage: (error: unknown) => string;
}) {
  const { t } = useLocale();
  const desktop = useViewportMode() === "desktop";
  const id = useId();
  const [baseline, setBaseline] = useState(() => baselineOf(order));
  const [issue, setIssue] = useState(baseline.issue);
  const [diagnosis, setDiagnosis] = useState(baseline.diagnosis);
  const [error, setError] = useState("");
  const [announcement, setAnnouncement] = useState("");
  const [conflict, setConflict] = useState(false);
  const [busy, setBusy] = useState(false);
  const [step, setStep] = useState<"edit" | "confirmDiscard" | "confirmReload">("edit");
  const headingRef = useRef<HTMLHeadingElement>(null);
  const issueRef = useRef<HTMLTextAreaElement>(null);
  const diagnosisRef = useRef<HTMLTextAreaElement>(null);
  const continueRef = useRef<HTMLButtonElement>(null);
  const previousFocus = useRef<HTMLElement | null>(null);
  const inFlight = useRef(false);
  const wasOpen = useRef(false);
  const trigger = useRef<HTMLElement | null>(null);
  const dirty = issue !== baseline.issue || diagnosis !== baseline.diagnosis;
  const blocked = pending || busy;
  const quoteItems = getFaultDescriptionSourceItems(order.fault_prices);
  const reset = (next: Baseline) => {
    setBaseline(next);
    setIssue(next.issue);
    setDiagnosis(next.diagnosis);
    setError("");
    setConflict(false);
    setAnnouncement("");
    setStep("edit");
  };
  useEffect(() => {
    if (!open) {
      wasOpen.current = false;
      return;
    }
    if (!wasOpen.current || baseline.id !== order.id) {
      trigger.current =
        document.activeElement instanceof HTMLElement ? document.activeElement : null;
      reset(baselineOf(order));
    } else if (baseline.version !== order.updated_at) {
      if (dirty || conflict) setConflict(true);
      else reset(baselineOf(order));
    }
    wasOpen.current = true;
  }, [open, order, baseline.id, baseline.version, dirty, conflict]);
  const confirm = (next: "confirmDiscard" | "confirmReload") => {
    previousFocus.current =
      document.activeElement instanceof HTMLElement ? document.activeElement : null;
    setStep(next);
  };
  const continueEditing = () => {
    setStep("edit");
    requestAnimationFrame(() => previousFocus.current?.focus({ preventScroll: true }));
  };
  useEffect(() => {
    if (step !== "edit") continueRef.current?.focus({ preventScroll: true });
  }, [step]);
  const close = (next: boolean) => {
    if (inFlight.current || blocked) return;
    if (!next && step !== "edit") {
      continueEditing();
      return;
    }
    if (!next && dirty) {
      confirm("confirmDiscard");
      return;
    }
    onOpenChange(next);
  };
  // The list workspace owns the only modal. Its close events are routed through this guard.
  useEffect(() => {
    if (!embedded || !open || !closeRequestRef) return;
    closeRequestRef.current = (reason) => {
      if (reason === "outside" && step !== "edit") return;
      close(false);
    };
    return () => {
      closeRequestRef.current = null;
    };
  });
  useEffect(() => {
    if (!embedded || !open) return;
    const opener = returnFocusRef?.current;
    return () => {
      requestAnimationFrame(() => opener?.focus({ preventScroll: true }));
    };
  }, [embedded, open, returnFocusRef]);
  useEffect(() => {
    if (!embedded || !open) return;
    requestAnimationFrame(() =>
      (canEditIntake
        ? issueRef.current
        : canEditRepair
          ? diagnosisRef.current
          : headingRef.current
      )?.focus({ preventScroll: true }),
    );
  }, [embedded, open, canEditIntake, canEditRepair]);
  const append = (target: "issue" | "diagnosis", items: FaultDescriptionSourceItem[]) => {
    if (blocked || conflict || (target === "issue" ? !canEditIntake : !canEditRepair)) return;
    const current = target === "issue" ? issue : diagnosis;
    const count = items.filter((item) => !hasFaultDescriptionItem(current, item)).length;
    setAnnouncement(
      t("orders.faultEditor.added", {
        count,
        target: t(target === "issue" ? "orders2b2.overview.issue" : "orders2b2.overview.diagnosis"),
      }),
    );
    if (target === "issue") setIssue((current) => appendFaultDescriptionItems(current, items));
    else setDiagnosis((current) => appendFaultDescriptionItems(current, items));
  };
  const changes: FaultDescriptionSave["changes"] = {};
  if (canEditIntake && issue.trim() !== baseline.issue.trim())
    changes.issue_description = issue.trim();
  if (canEditRepair && diagnosis.trim() !== baseline.diagnosis.trim())
    changes.diagnosis_result = diagnosis.trim();
  const save = async () => {
    if (inFlight.current || blocked || conflict || !Object.keys(changes).length) return;
    if (canEditIntake && !issue.trim()) {
      setError(t("orders2b2.validation.issue"));
      issueRef.current?.focus();
      return;
    }
    inFlight.current = true;
    setBusy(true);
    setError("");
    try {
      await onSave({ changes, expectedUpdatedAt: baseline.version });
      onOpenChange(false);
    } catch (cause) {
      setError(getErrorMessage(cause));
      if (
        typeof cause === "object" &&
        cause &&
        "status" in cause &&
        (cause.status === 409 ||
          (cause.status === 400 &&
            "message" in cause &&
            cause.message === "工单已被更新，请刷新后再试"))
      )
        setConflict(true);
    } finally {
      inFlight.current = false;
      setBusy(false);
    }
  };
  const reload = async () => {
    if (inFlight.current || blocked) return;
    inFlight.current = true;
    setBusy(true);
    try {
      const fresh = await onReload();
      reset(baselineOf(fresh || order));
      requestAnimationFrame(() => headingRef.current?.focus({ preventScroll: true }));
    } catch {
      setError(t("orders.faultEditor.reloadFailed"));
      continueEditing();
    } finally {
      inFlight.current = false;
      setBusy(false);
    }
  };
  const Title = embedded ? "h2" : desktop ? DialogTitle : SheetTitle;
  const Description = embedded ? "p" : desktop ? DialogDescription : SheetDescription;
  const issueInvalid = Boolean(error && canEditIntake && !issue.trim());
  const hasChanges = Boolean(Object.keys(changes).length);
  const stateText = t(
    blocked
      ? "orders2b2.hero.saving"
      : conflict
        ? "orders.faultEditor.conflictState"
        : error
          ? "orders.faultEditor.errorState"
          : hasChanges
            ? "orders.faultEditor.dirty"
            : dirty
              ? "orders.faultEditor.normalized"
              : "orders.faultEditor.unchanged",
  );
  const body = (
    <div
      className="flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden"
      data-order-fault-editor="true"
    >
      <header
        className={cn(
          componentOverlay.mobileHeader,
          componentOverlay.editorHeader,
          "shrink-0 pr-12 lg:px-5 lg:py-4",
          embedded && "relative",
        )}
      >
        <Title
          ref={headingRef}
          tabIndex={-1}
          className="flex items-center gap-2 text-base leading-6 outline-none"
        >
          <FileText className="size-4 shrink-0 text-muted-foreground" aria-hidden="true" />
          {t("orders.faultEditor.title")}
        </Title>
        <Description className="text-xs text-muted-foreground">{order.public_no}</Description>
        {embedded ? (
          <Button
            variant="ghost"
            size="icon"
            aria-label={t("common.cancel")}
            className="absolute right-3 top-3 size-8"
            disabled={blocked}
            onClick={() => close(false)}
          >
            <X className="size-4" />
          </Button>
        ) : null}
      </header>
      <div
        hidden={step === "edit"}
        className="min-h-0 overflow-y-auto p-4 pb-[calc(env(safe-area-inset-bottom)+1rem)] lg:p-5"
        data-editor-confirmation={step === "edit" ? undefined : step}
      >
        <h3 id={`${id}-confirm-title`} className="text-base font-semibold">
          {t(step === "confirmReload" ? "orders.faultEditor.reload" : "orders.faultEditor.discard")}
        </h3>
        <p id={`${id}-confirm-help`} className="mt-2 text-sm leading-6 text-muted-foreground">
          {t("orders.faultEditor.confirmHelp")}
        </p>
        <div className="mt-5 flex flex-col gap-2 sm:flex-row sm:justify-end">
          <Button
            ref={continueRef}
            aria-describedby={`${id}-confirm-title ${id}-confirm-help`}
            variant="outline"
            className="min-h-11"
            disabled={blocked}
            onClick={continueEditing}
          >
            {t("orders.faultEditor.keep")}
          </Button>
          <Button
            variant={step === "confirmDiscard" ? "destructive" : "default"}
            className="min-h-11"
            disabled={blocked}
            onClick={() => (step === "confirmReload" ? void reload() : onOpenChange(false))}
          >
            {blocked
              ? t("orders.faultEditor.reloading")
              : t(
                  step === "confirmReload"
                    ? "orders.faultEditor.confirmReload"
                    : "orders.faultEditor.confirmDiscard",
                )}
          </Button>
        </div>
      </div>
      <div
        hidden={step !== "edit"}
        className="min-h-0 flex-1 overflow-y-auto overscroll-contain"
        data-editor-scroll="true"
      >
        <div
          className={cn(
            componentOverlay.body,
            componentOverlay.editorBody,
            "space-y-4 py-4 lg:grid lg:grid-cols-[minmax(0,1fr)_240px] lg:items-start lg:gap-x-5 lg:gap-y-3 lg:space-y-0 lg:px-5 lg:py-5",
          )}
        >
          <section className="grid min-w-0 gap-4">
            <div className="grid gap-1.5">
              <div className="flex items-center justify-between gap-3">
                <label className="text-sm font-medium" htmlFor={`${id}-issue`}>
                  {t("orders2b2.overview.issue")}
                </label>
                <span className="text-xs text-muted-foreground">
                  {t(canEditIntake ? "orders.faultEditor.required" : "orders2b2.fault.readonly")}
                </span>
              </div>
              <Textarea
                ref={issueRef}
                id={`${id}-issue`}
                value={issue}
                onChange={(event) => {
                  setIssue(event.target.value);
                  if (issueInvalid) setError("");
                }}
                readOnly={!canEditIntake}
                disabled={blocked}
                required={canEditIntake}
                aria-describedby={`${id}-issue-help${issueInvalid ? ` ${id}-issue-error` : ""}`}
                aria-invalid={issueInvalid}
                className={cn(
                  componentOverlay.editorField,
                  "h-28 min-h-28 resize-none leading-6 lg:resize-y",
                )}
              />
              <p id={`${id}-issue-help`} className="text-xs leading-5 text-muted-foreground">
                {t("orders.faultEditor.issueHelp")}
              </p>
              {issueInvalid ? (
                <p
                  id={`${id}-issue-error`}
                  role="alert"
                  className="text-xs text-status-danger-foreground"
                >
                  {error}
                </p>
              ) : null}
            </div>
            <div className="grid gap-1.5">
              <div className="flex items-center justify-between gap-3">
                <label className="text-sm font-medium" htmlFor={`${id}-diagnosis`}>
                  {t("orders2b2.overview.diagnosis")}
                </label>
                <span className="text-xs text-muted-foreground">
                  {t(canEditRepair ? "orders.faultEditor.optional" : "orders2b2.fault.readonly")}
                </span>
              </div>
              <Textarea
                ref={diagnosisRef}
                id={`${id}-diagnosis`}
                value={diagnosis}
                onChange={(event) => setDiagnosis(event.target.value)}
                readOnly={!canEditRepair}
                disabled={blocked}
                aria-describedby={`${id}-diagnosis-help`}
                className={cn(
                  componentOverlay.editorField,
                  "h-24 min-h-24 resize-none leading-6 lg:resize-y",
                )}
              />
              <p id={`${id}-diagnosis-help`} className="text-xs leading-5 text-muted-foreground">
                {t("orders.faultEditor.diagnosisHelp")}
              </p>
            </div>
          </section>
          <details
            className="group min-w-0 rounded-lg border border-[var(--border-panel)] bg-[var(--surface-panel-muted)] p-3"
            open={desktop ? true : undefined}
          >
            <summary className="flex min-h-8 cursor-pointer list-none items-center gap-2 text-sm font-medium [&::-webkit-details-marker]:hidden">
              <span className="min-w-0 flex-1">{t("orders.faultEditor.references")}</span>
              <span className="text-xs tabular-nums text-muted-foreground">
                {quoteItems.length}
              </span>
              <ChevronDown
                className="size-4 shrink-0 transition-transform duration-150 group-open:rotate-180 motion-reduce:transition-none"
                aria-hidden="true"
              />
            </summary>
            <div className="mt-2 grid min-w-0 gap-2">
              <p className="text-xs leading-5 text-muted-foreground">
                {t("orders.faultEditor.referencesHelp")}
              </p>
              <div className="grid gap-1.5">
                {(["issue", "diagnosis"] as const).map((target) => (
                  <Button
                    key={target}
                    size="sm"
                    variant="outline"
                    className="h-auto min-h-9 whitespace-normal py-1.5 text-xs"
                    disabled={
                      blocked ||
                      conflict ||
                      (target === "issue" ? !canEditIntake : !canEditRepair) ||
                      !quoteItems.length ||
                      quoteItems.every((item) =>
                        hasFaultDescriptionItem(target === "issue" ? issue : diagnosis, item),
                      )
                    }
                    onClick={() => append(target, quoteItems)}
                  >
                    {t(
                      target === "issue"
                        ? "orders.faultEditor.allIssue"
                        : "orders.faultEditor.allDiagnosis",
                    )}
                  </Button>
                ))}
              </div>
              {quoteItems.length ? (
                quoteItems.map((item, index) => (
                  <div
                    key={`${item.name}-${index}`}
                    className="min-w-0 space-y-2 border-t border-[var(--border-panel)] pt-2"
                  >
                    <p className="whitespace-pre-wrap break-words text-sm leading-5 [overflow-wrap:anywhere]">
                      {item.name}
                    </p>
                    <div className="grid grid-cols-2 gap-1.5">
                      {(["issue", "diagnosis"] as const).map((target) => {
                        const appended = hasFaultDescriptionItem(
                          target === "issue" ? issue : diagnosis,
                          item,
                        );
                        return (
                          <Button
                            key={target}
                            size="sm"
                            variant="ghost"
                            className="h-auto min-h-9 whitespace-normal px-1 py-1.5 text-xs"
                            disabled={
                              blocked ||
                              conflict ||
                              (target === "issue" ? !canEditIntake : !canEditRepair) ||
                              appended
                            }
                            aria-label={t(
                              target === "issue"
                                ? "orders2b2.fault.addIssue"
                                : "orders2b2.fault.addDiagnosis",
                              { name: item.name },
                            )}
                            onClick={() => append(target, [item])}
                          >
                            {appended ? (
                              <Check className="size-3 shrink-0" aria-hidden="true" />
                            ) : null}
                            {t(
                              appended
                                ? target === "issue"
                                  ? "orders.faultEditor.inIssue"
                                  : "orders.faultEditor.inDiagnosis"
                                : target === "issue"
                                  ? "orders.faultEditor.toIssue"
                                  : "orders.faultEditor.toDiagnosis",
                            )}
                          </Button>
                        );
                      })}
                    </div>
                  </div>
                ))
              ) : (
                <p className="text-xs leading-5 text-muted-foreground">
                  {t("orders2b2.fault.empty")}
                </p>
              )}
            </div>
          </details>
          <p
            role="status"
            aria-live="polite"
            className={cn(componentOverlay.editorStatus, "empty:hidden lg:col-span-2")}
          >
            {announcement}
          </p>
          {conflict || (error && !issueInvalid) ? (
            <div className="space-y-2 rounded-lg border border-[var(--border-panel)] bg-[var(--surface-panel-muted)] p-3 lg:col-span-2">
              {conflict ? (
                <div role="alert" className="space-y-2 text-sm text-status-danger-foreground">
                  <p>{t("orders2b2.conflict.description")}</p>
                  <Button
                    variant="outline"
                    className="h-auto min-h-10 whitespace-normal"
                    disabled={blocked}
                    onClick={() => confirm("confirmReload")}
                  >
                    {t("orders2b2.conflict.reload")}
                  </Button>
                </div>
              ) : null}
              {error && !issueInvalid ? (
                <p role="alert" className="text-sm text-status-danger-foreground">
                  {error}
                </p>
              ) : null}
            </div>
          ) : null}
        </div>
      </div>
      <footer
        hidden={step !== "edit"}
        className={cn(
          componentOverlay.mobileFooter,
          "shrink-0 !flex-col gap-2 bg-[var(--surface-panel-muted)] lg:!flex-row lg:items-center lg:justify-between lg:px-5",
        )}
      >
        <p className={componentOverlay.editorStatus} data-editor-state="true">
          {stateText}
        </p>
        <div className="grid grid-cols-2 gap-2 lg:flex lg:shrink-0">
          <Button
            variant="outline"
            className="min-h-11 lg:min-h-9 lg:min-w-20"
            disabled={blocked}
            onClick={() => close(false)}
          >
            {t("common.cancel")}
          </Button>
          <Button
            className="min-h-11 lg:min-h-9 lg:min-w-24"
            disabled={blocked || conflict || !hasChanges}
            onClick={() => void save()}
          >
            {blocked ? t("orders2b2.hero.saving") : t("orders2b2.hero.save")}
          </Button>
        </div>
      </footer>
    </div>
  );
  const events = {
    onEscapeKeyDown: (event: Event) => {
      if (blocked || step !== "edit") event.preventDefault();
      if (!blocked && step !== "edit") continueEditing();
    },
    onInteractOutside: (event: Event) => {
      if (blocked || step !== "edit") event.preventDefault();
    },
    onCloseAutoFocus: (event: Event) => {
      event.preventDefault();
      trigger.current?.focus({ preventScroll: true });
    },
    onOpenAutoFocus: (event: Event) => {
      event.preventDefault();
      if (!desktop) headingRef.current?.focus({ preventScroll: true });
      else
        (canEditIntake
          ? issueRef.current
          : canEditRepair
            ? diagnosisRef.current
            : headingRef.current
        )?.focus({ preventScroll: true });
    },
  };
  if (embedded) return open ? body : null;
  return desktop ? (
    <Dialog open={open} onOpenChange={close}>
      <DialogContent
        {...events}
        closeLabel={t("common.cancel")}
        className={cn(
          componentOverlay.modalLg,
          componentOverlay.editorSurface,
          "flex max-h-[calc(100svh-24px)] flex-col gap-0 p-0 sm:p-0",
        )}
      >
        {body}
      </DialogContent>
    </Dialog>
  ) : (
    <Sheet open={open} onOpenChange={close}>
      <SheetContent
        {...events}
        side="bottom"
        closeLabel={t("common.cancel")}
        className={cn(
          componentOverlay.bottomSheet,
          componentOverlay.editorSurface,
          "flex flex-col gap-0 p-0 sm:p-0",
        )}
      >
        {body}
      </SheetContent>
    </Sheet>
  );
}
