"use client";

import { useEffect, useId, useRef, useState, type RefObject } from "react";
import { FileText, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Sheet, SheetContent, SheetTitle, SheetDescription } from "@/components/ui/sheet";
import { useViewportMode } from "@/hooks/use-mobile";
import { componentOverlay } from "@/lib/component-patterns";
import type { OrderDetail, PatchOrderChanges } from "@/lib/repairdesk/types";
import { cn } from "@/lib/utils";
import { useLocale } from "@/shared/i18n/locale-provider";

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
  const [error, setError] = useState("");
  const [conflict, setConflict] = useState(false);
  const [busy, setBusy] = useState(false);
  const [step, setStep] = useState<"edit" | "confirmDiscard" | "confirmReload">("edit");
  const headingRef = useRef<HTMLHeadingElement>(null);
  const issueRef = useRef<HTMLTextAreaElement>(null);
  const continueRef = useRef<HTMLButtonElement>(null);
  const previousFocus = useRef<HTMLElement | null>(null);
  const inFlight = useRef(false);
  const wasOpen = useRef(false);
  const trigger = useRef<HTMLElement | null>(null);
  const dirty = issue !== baseline.issue;
  const blocked = pending || busy;
  const reset = (next: Baseline) => {
    setBaseline(next);
    setIssue(next.issue);
    setError("");
    setConflict(false);
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
      (canEditIntake ? issueRef.current : headingRef.current)?.focus({ preventScroll: true }),
    );
  }, [embedded, open, canEditIntake]);
  const changes: FaultDescriptionSave["changes"] = {};
  if (canEditIntake && issue.trim() !== baseline.issue.trim())
    changes.issue_description = issue.trim();
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
      <header className={cn(componentOverlay.denseEditorHeader, embedded && "relative")}>
        <Title
          ref={headingRef}
          tabIndex={-1}
          className="flex items-center gap-2 text-base leading-6 outline-none"
        >
          <span className={componentOverlay.denseEditorIcon} aria-hidden="true">
            <FileText />
          </span>
          {t("orders.faultEditor.title")}
        </Title>
        <Description className="min-w-0 truncate text-[10px] text-muted-foreground">
          {order.public_no}
        </Description>
        {embedded ? (
          <Button
            variant="ghost"
            size="icon"
            aria-label={t("common.cancel")}
            className="absolute right-1 top-1 size-11 lg:right-3 lg:top-3 lg:size-8"
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
            componentOverlay.denseEditorBody,
          )}
        >
          <section className="grid min-w-0 gap-2">
            <div className="grid gap-1">
              <div
                className={canEditIntake ? "sr-only" : "flex items-center justify-between gap-3"}
              >
                <label className="text-sm font-medium" htmlFor={`${id}-issue`}>
                  {t("orders.notes.label")}
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
                  "h-[104px] lg:h-[200px] min-h-[104px] lg:h-[200px] resize-none leading-6 lg:resize-y",
                )}
              />
              <p id={`${id}-issue-help`} className="sr-only">
                {t("orders.faultEditor.issueHelp")}
              </p>
              <p className="text-right text-[10px] leading-4 text-muted-foreground" aria-live="off">
                {t("orders.notes.characterCount", { count: issue.length })}
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
          </section>
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
          "shrink-0 border-t border-[var(--border-panel)] px-3 pt-1.5 pb-[calc(env(safe-area-inset-bottom)+0.5rem)]",
        )}
      >
        <p
          className={cn(
            componentOverlay.editorStatus,
            dirty || blocked || error || conflict ? "mb-1" : "sr-only",
          )}
          data-editor-state="true"
        >
          {stateText}
        </p>
        <div className="grid grid-cols-2 gap-2">
          <Button
            variant="outline"
            className="min-h-11 lg:min-w-20"
            disabled={blocked}
            onClick={() => close(false)}
          >
            {t("common.cancel")}
          </Button>
          <Button
            className="min-h-11 lg:min-w-24"
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
      else (canEditIntake ? issueRef.current : headingRef.current)?.focus({ preventScroll: true });
    },
  };
  if (embedded) return open ? body : null;
  return desktop ? (
    <Dialog open={open} onOpenChange={close}>
      <DialogContent
        initialFocus="container"
        editorLayout
        {...events}
        closeLabel={t("common.cancel")}
        className={cn(
          componentOverlay.modalLg,
          componentOverlay.editorSurface,
          componentOverlay.denseEditorSurface,
          "flex max-h-[calc(100svh-24px)] flex-col gap-0 p-0 sm:p-0",
        )}
      >
        {body}
      </DialogContent>
    </Dialog>
  ) : (
    <Sheet open={open} onOpenChange={close}>
      <SheetContent
        initialFocus="container"
        editorLayout
        {...events}
        side="bottom"
        closeLabel={t("common.cancel")}
        className={cn(
          componentOverlay.bottomSheet,
          componentOverlay.editorSurface,
          componentOverlay.denseEditorSurface,
          "flex flex-col gap-0 p-0 sm:p-0",
        )}
      >
        {body}
      </SheetContent>
    </Sheet>
  );
}
