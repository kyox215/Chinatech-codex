"use client";

import { useMemo, useState } from "react";
import type { ReactNode } from "react";
import { AlertTriangle, FilePenLine, MoreHorizontal, RotateCcw, Trash2 } from "lucide-react";
import { useMutation } from "@tanstack/react-query";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { Textarea } from "@/components/ui/textarea";
import { useIsMobile } from "@/hooks/use-mobile";
import {
  correctTerminalOrder,
  RepairDeskApiError,
  reopenOrder,
  voidOrder,
  type CorrectTerminalOrderInput,
  type OrderCapabilities,
  type OrderDetail,
  type OrderWorkflow,
} from "@/lib/repairdesk/api";
import type { RepairOrderStatus } from "@/lib/mock/enums";
import { cn } from "@/lib/utils";
import {
  formatWarrantyText,
  ORDER_WARRANTY_OPTIONS,
  parseWarrantyMonths,
} from "@/features/orders/model/order-warranty";
import { localizeWorkflowStatusLabel } from "@/features/orders/model/order-i18n";
import { getOrderDetailSafeErrorMessage } from "@/features/orders/model/order-detail-i18n";
import { useLocale } from "@/shared/i18n/locale-provider";
import type { MessageKey, MessageValues } from "@/shared/i18n/messages";

type Translate = (key: MessageKey, values?: MessageValues) => string;

type TerminalMode = "correct" | "reopen" | "void";

export function OrderTerminalActions({
  detail,
  workflow,
  onCompleted,
  className,
  variant = "banner",
}: {
  detail: OrderDetail;
  workflow?: OrderWorkflow;
  onCompleted: () => void;
  className?: string;
  variant?: "banner" | "compact";
}) {
  const { t } = useLocale();
  const order = detail.order;
  const capabilities = detail.capabilities;
  const [mode, setMode] = useState<TerminalMode | null>(null);
  const [reason, setReason] = useState("");
  const [confirmation, setConfirmation] = useState("");
  const [targetStatus, setTargetStatus] = useState<RepairOrderStatus>("diagnosing");
  const [mutationError, setMutationError] = useState("");
  const [idempotencyKey, setIdempotencyKey] = useState(() => crypto.randomUUID());
  const [correction, setCorrection] = useState(() => buildTerminalCorrectionDraft(order));
  const isMobile = useIsMobile();
  const reopenTargets = useMemo(
    () =>
      (workflow?.statuses ?? []).filter(
        (status) =>
          status.enabled &&
          status.code !== order.status &&
          !["done", "cancelled", "custom"].includes(status.bucket),
      ),
    [order.status, workflow?.statuses],
  );
  const validationError = useMemo(
    () =>
      terminalFormError({
        mode,
        order,
        reason,
        confirmation,
        correction,
        targetStatus,
        reopenTargets,
        t,
      }),
    [confirmation, correction, mode, order, reason, reopenTargets, t, targetStatus],
  );

  const mutation = useMutation({
    mutationFn: async () => {
      if (!mode) throw new Error("请选择操作");
      if (validationError) throw new Error(validationError);
      const cleanReason = reason.trim();
      if (cleanReason.length < 5) throw new Error("原因至少需要 5 个字符");
      if (mode === "correct") {
        const changes = buildTerminalCorrectionChanges(order, correction, cleanReason);
        if (!Object.keys(changes).length) throw new Error("没有需要纠正的内容");
        return correctTerminalOrder(order.id, {
          expected_updated_at: order.updated_at,
          idempotency_key: idempotencyKey,
          reason: cleanReason,
          changes,
        });
      }
      if (mode === "reopen") {
        return reopenOrder(order.id, {
          expected_updated_at: order.updated_at,
          idempotency_key: idempotencyKey,
          reason: cleanReason,
          to_status: targetStatus,
        });
      }
      return voidOrder(order.id, {
        expected_updated_at: order.updated_at,
        idempotency_key: idempotencyKey,
        reason: cleanReason,
        confirm_public_no: confirmation,
      });
    },
    onSuccess: (result) => {
      toast.success(result.replayed ? t("orders2b2.terminal.replayed") : successMessage(mode, t));
      setMode(null);
      setMutationError("");
      onCompleted();
    },
    onError: (error: Error) => {
      const message = terminalMutationErrorMessage(error, t);
      setMutationError(message);
      toast.error(message);
      if (error instanceof RepairDeskApiError && error.code === "STALE_VERSION") {
        setMode(null);
        setCorrection(buildTerminalCorrectionDraft(order));
        onCompleted();
      }
    },
  });

  const voided = order.record_state === "voided" || Boolean(order.deleted_at);
  const terminal =
    order.status === "completed" ||
    order.status === "cancelled" ||
    order.exception_status === "cancelled" ||
    (order.workflow_bucket !== undefined
      ? order.workflow_bucket === "done" || order.workflow_bucket === "cancelled"
      : order.workflow_status === "closed");
  if (!terminal && !voided) return null;

  function open(nextMode: TerminalMode) {
    if (mutation.isPending) return;
    setMode(nextMode);
    setReason("");
    setConfirmation("");
    setMutationError("");
    setIdempotencyKey(crypto.randomUUID());
    setCorrection(buildTerminalCorrectionDraft(order));
    const preferred =
      reopenTargets.find((status) => status.code === "diagnosing") ?? reopenTargets[0];
    setTargetStatus(preferred?.code ?? "");
  }

  const body = mode ? (
    <TerminalActionForm
      mode={mode}
      order={order}
      capabilities={capabilities}
      reason={reason}
      onReasonChange={(value) => {
        setReason(value);
        setMutationError("");
      }}
      confirmation={confirmation}
      onConfirmationChange={(value) => {
        setConfirmation(value);
        setMutationError("");
      }}
      correction={correction}
      onCorrectionChange={(value) => {
        setCorrection(value);
        setMutationError("");
      }}
      targetStatus={targetStatus}
      onTargetStatusChange={(value) => {
        setTargetStatus(value);
        setMutationError("");
      }}
      reopenTargets={reopenTargets}
      workflow={workflow}
    />
  ) : null;
  const visibleError = mutationError || validationError;
  const footer = (
    <>
      <Button variant="outline" disabled={mutation.isPending} onClick={() => setMode(null)}>
        {t("common.cancel")}
      </Button>
      <Button
        variant={mode === "void" ? "destructive" : "default"}
        disabled={mutation.isPending || Boolean(validationError)}
        onClick={() => mutation.mutate()}
      >
        {mutation.isPending ? t("orders2b2.terminal.processing") : actionLabel(mode, t)}
      </Button>
    </>
  );

  const statusContent =
    variant === "compact" ? (
      <div
        data-order-terminal-actions="true"
        className={cn(
          "flex min-w-0 flex-wrap items-center gap-1.5 rounded-md border px-2 py-1",
          voided
            ? "border-status-danger-foreground/20 bg-status-danger/60 text-status-danger-foreground"
            : "border-status-warn-foreground/20 bg-status-warn/45 text-foreground",
          className,
        )}
      >
        <span className="inline-flex min-w-0 items-center gap-1 text-[10px] font-semibold lg:text-xs lg:leading-4">
          <AlertTriangle className="size-3 shrink-0" aria-hidden="true" />
          {voided ? t("orders2b2.terminal.compact.voided") : t("orders2b2.terminal.compact.ended")}
        </span>
        {!voided ? (
          <div className="ml-auto flex shrink-0 items-center gap-1">
            {capabilities?.canCorrect ? (
              <Button
                size="sm"
                variant="ghost"
                className="h-6 gap-1 px-1.5 text-[10px] lg:text-xs lg:leading-4"
                disabled={mutation.isPending}
                onClick={() => open("correct")}
              >
                <FilePenLine className="size-3" /> {t("orders2b2.terminal.correct")}
              </Button>
            ) : null}
            {capabilities?.canReopen ? (
              <Button
                size="sm"
                variant="ghost"
                className="h-6 gap-1 px-1.5 text-[10px] lg:text-xs lg:leading-4"
                disabled={mutation.isPending || reopenTargets.length === 0}
                onClick={() => open("reopen")}
              >
                <RotateCcw className="size-3" /> {t("orders2b2.terminal.reopen")}
              </Button>
            ) : null}
            {capabilities?.canVoid ? (
              <DropdownMenu modal={false}>
                <DropdownMenuTrigger asChild>
                  <Button
                    size="icon"
                    variant="ghost"
                    className="size-6"
                    disabled={mutation.isPending}
                    aria-label={t("orders2b2.terminal.more")}
                  >
                    <MoreHorizontal className="size-3.5" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  <DropdownMenuItem
                    className="text-destructive focus:text-destructive"
                    onClick={() => open("void")}
                  >
                    <Trash2 className="mr-2 size-3.5" /> {t("orders2b2.terminal.void")}
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            ) : null}
          </div>
        ) : null}
      </div>
    ) : (
      <section
        data-order-terminal-actions="true"
        className={cn(
          "rounded-xl border px-3 py-2.5 shadow-[var(--shadow-card)]",
          voided
            ? "border-status-danger-foreground/20 bg-status-danger text-status-danger-foreground"
            : "border-status-warn-foreground/20 bg-status-warn/60 text-foreground",
          className,
        )}
      >
        <div className="flex min-w-0 flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          <div className="min-w-0">
            <p className="flex items-center gap-1.5 text-sm font-semibold">
              <AlertTriangle className="size-4 shrink-0" aria-hidden="true" />
              {voided ? t("orders2b2.terminal.title.voided") : t("orders2b2.terminal.title.ended")}
            </p>
            <p className="mt-0.5 text-xs leading-5 text-muted-foreground">
              {voided ? t("orders2b2.terminal.help.voided") : t("orders2b2.terminal.help.ended")}
            </p>
          </div>
          {!voided ? (
            <div className="flex shrink-0 flex-wrap gap-1.5">
              {capabilities?.canCorrect ? (
                <Button
                  size="sm"
                  variant="outline"
                  className="h-8 gap-1.5"
                  disabled={mutation.isPending}
                  onClick={() => open("correct")}
                >
                  <FilePenLine className="size-3.5" /> {t("orders2b2.terminal.correctRecord")}
                </Button>
              ) : null}
              {capabilities?.canReopen ? (
                <Button
                  size="sm"
                  variant="outline"
                  className="h-8 gap-1.5"
                  disabled={mutation.isPending || reopenTargets.length === 0}
                  onClick={() => open("reopen")}
                >
                  <RotateCcw className="size-3.5" /> {t("orders2b2.terminal.reopen")}
                </Button>
              ) : null}
              {capabilities?.canVoid ? (
                <Button
                  size="sm"
                  variant="destructive"
                  className="h-8 gap-1.5"
                  disabled={mutation.isPending}
                  onClick={() => open("void")}
                >
                  <Trash2 className="size-3.5" /> {t("orders2b2.terminal.void")}
                </Button>
              ) : null}
            </div>
          ) : null}
        </div>
        {!voided && !capabilities?.canVoid && capabilities?.blockedReasons?.void ? (
          <p className="mt-2 text-xs text-status-warn-foreground" role="status">
            {t("orders2b2.terminal.voidBlocked", { reason: capabilities.blockedReasons.void })}
          </p>
        ) : null}
      </section>
    );

  return (
    <>
      {statusContent}

      {isMobile ? (
        <Sheet
          open={Boolean(mode)}
          onOpenChange={(openState) => {
            if (!openState && !mutation.isPending) setMode(null);
          }}
        >
          <SheetContent
            side="bottom"
            className="max-h-[calc(100svh-24px)] overflow-y-auto rounded-t-xl"
          >
            <SheetHeader className="text-left">
              <SheetTitle>{dialogTitle(mode, t)}</SheetTitle>
              <SheetDescription>{dialogDescription(mode, order.public_no, t)}</SheetDescription>
            </SheetHeader>
            {body}
            {visibleError ? (
              <p
                className="mt-2 rounded-md bg-status-danger px-2 py-1.5 text-xs text-status-danger-foreground"
                role="alert"
              >
                {visibleError}
              </p>
            ) : null}
            <SheetFooter className="mt-4 gap-2">{footer}</SheetFooter>
          </SheetContent>
        </Sheet>
      ) : (
        <Dialog
          open={Boolean(mode)}
          onOpenChange={(openState) => {
            if (!openState && !mutation.isPending) setMode(null);
          }}
        >
          <DialogContent className="max-h-[85vh] overflow-y-auto sm:max-w-xl">
            <DialogHeader>
              <DialogTitle>{dialogTitle(mode, t)}</DialogTitle>
              <DialogDescription>{dialogDescription(mode, order.public_no, t)}</DialogDescription>
            </DialogHeader>
            {body}
            {visibleError ? (
              <p
                className="rounded-md bg-status-danger px-2 py-1.5 text-xs text-status-danger-foreground"
                role="alert"
              >
                {visibleError}
              </p>
            ) : null}
            <DialogFooter>{footer}</DialogFooter>
          </DialogContent>
        </Dialog>
      )}
    </>
  );
}

type CorrectionDraft = ReturnType<typeof buildTerminalCorrectionDraft>;

function TerminalActionForm({
  mode,
  order,
  reason,
  onReasonChange,
  confirmation,
  onConfirmationChange,
  correction,
  onCorrectionChange,
  targetStatus,
  onTargetStatusChange,
  reopenTargets,
  workflow,
}: {
  mode: TerminalMode;
  order: OrderDetail["order"];
  capabilities?: OrderCapabilities;
  reason: string;
  onReasonChange: (value: string) => void;
  confirmation: string;
  onConfirmationChange: (value: string) => void;
  correction: CorrectionDraft;
  onCorrectionChange: (value: CorrectionDraft) => void;
  targetStatus: RepairOrderStatus;
  onTargetStatusChange: (value: RepairOrderStatus) => void;
  reopenTargets: OrderWorkflow["statuses"];
  workflow?: OrderWorkflow;
}) {
  const { t } = useLocale();
  return (
    <div className="space-y-3 py-2">
      {mode === "correct" ? (
        <div className="grid gap-3 sm:grid-cols-2">
          <Field
            id="terminal-correction-issue"
            label={t("orders2b2.terminal.field.issue")}
            className="sm:col-span-2"
          >
            <Textarea
              id="terminal-correction-issue"
              value={correction.issue_description}
              onChange={(event) =>
                onCorrectionChange({ ...correction, issue_description: event.target.value })
              }
            />
          </Field>
          <Field
            id="terminal-correction-diagnosis"
            label={t("orders2b2.terminal.field.diagnosis")}
            className="sm:col-span-2"
          >
            <Textarea
              id="terminal-correction-diagnosis"
              value={correction.diagnosis_result}
              onChange={(event) =>
                onCorrectionChange({ ...correction, diagnosis_result: event.target.value })
              }
            />
          </Field>
          <Field id="terminal-correction-tag" label={t("orders2b2.terminal.field.tag")}>
            <Input
              id="terminal-correction-tag"
              value={correction.internal_tag}
              onChange={(event) =>
                onCorrectionChange({ ...correction, internal_tag: event.target.value })
              }
            />
          </Field>
          <Field id="terminal-correction-accessory" label={t("orders2b2.terminal.field.accessory")}>
            <Input
              id="terminal-correction-accessory"
              value={correction.accessory_notes}
              onChange={(event) =>
                onCorrectionChange({ ...correction, accessory_notes: event.target.value })
              }
            />
          </Field>
          <Field
            id="terminal-correction-warranty-months"
            label={t("orders2b2.terminal.field.warrantyMonths")}
          >
            <Select
              value={correction.warranty_months}
              onValueChange={(value) =>
                onCorrectionChange({
                  ...correction,
                  warranty_months: value,
                  warranty_text: formatWarrantyText(Number(value)),
                })
              }
            >
              <SelectTrigger id="terminal-correction-warranty-months">
                <SelectValue placeholder={t("orders2b2.terminal.selectWarranty")} />
              </SelectTrigger>
              <SelectContent>
                {ORDER_WARRANTY_OPTIONS.map((option) => (
                  <SelectItem key={option.months} value={String(option.months)}>
                    {option.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </Field>
          <Field
            id="terminal-correction-warranty-text"
            label={t("orders2b2.terminal.field.warrantyText")}
          >
            <Input
              id="terminal-correction-warranty-text"
              value={correction.warranty_text}
              readOnly
            />
          </Field>
          <Field
            id="terminal-correction-warranty-reason"
            label={t("orders2b2.terminal.field.warrantyReason")}
            className="sm:col-span-2"
          >
            <Input
              id="terminal-correction-warranty-reason"
              value={correction.warranty_change_reason}
              onChange={(event) =>
                onCorrectionChange({ ...correction, warranty_change_reason: event.target.value })
              }
            />
          </Field>
        </div>
      ) : null}
      {mode === "reopen" ? (
        <Field id="terminal-reopen-target" label={t("orders2b2.terminal.field.reopenTarget")}>
          <Select
            value={targetStatus}
            onValueChange={(value) => onTargetStatusChange(value as RepairOrderStatus)}
          >
            <SelectTrigger id="terminal-reopen-target">
              <SelectValue placeholder={t("orders2b2.terminal.selectStatus")} />
            </SelectTrigger>
            <SelectContent>
              {reopenTargets.map((status) => (
                <SelectItem key={status.code} value={status.code}>
                  {localizeWorkflowStatusLabel(workflow, status.code, t)}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </Field>
      ) : null}
      {mode === "void" ? (
        <Field
          id="terminal-void-confirmation"
          label={t("orders2b2.terminal.confirmNumber", { publicNo: order.public_no })}
        >
          <Input
            id="terminal-void-confirmation"
            value={confirmation}
            onChange={(event) => onConfirmationChange(event.target.value)}
            autoComplete="off"
          />
          <p className="text-xs leading-5 text-muted-foreground">
            {t("orders2b2.terminal.voidEvidence")}
          </p>
        </Field>
      ) : null}
      <Field id="terminal-operation-reason" label={t("orders2b2.terminal.reason")}>
        <Textarea
          id="terminal-operation-reason"
          value={reason}
          onChange={(event) => onReasonChange(event.target.value)}
          minLength={5}
          maxLength={1000}
          autoFocus
          placeholder={t("orders2b2.terminal.reasonPlaceholder")}
        />
      </Field>
    </div>
  );
}

function Field({
  id,
  label,
  children,
  className,
}: {
  id: string;
  label: string;
  children: ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("space-y-1.5", className)}>
      <Label htmlFor={id}>{label}</Label>
      {children}
    </div>
  );
}

export function buildTerminalCorrectionDraft(order: OrderDetail["order"]) {
  const warrantyMonths = terminalWarrantyMonths(order);
  return {
    issue_description: order.issue_description ?? "",
    diagnosis_result: order.diagnosis_result ?? "",
    internal_tag: order.internal_tag ?? "",
    accessory_notes: order.accessory_notes ?? "",
    warranty_text: formatWarrantyText(warrantyMonths),
    warranty_months: String(warrantyMonths),
    warranty_change_reason: order.warranty_change_reason ?? "",
  };
}

export function buildTerminalCorrectionChanges(
  order: OrderDetail["order"],
  draft: CorrectionDraft,
  operationReason: string,
): CorrectTerminalOrderInput["changes"] {
  const changes: CorrectTerminalOrderInput["changes"] = {};
  for (const field of [
    "issue_description",
    "diagnosis_result",
    "internal_tag",
    "accessory_notes",
  ] as const) {
    if ((order[field] ?? "").trim() !== draft[field].trim()) changes[field] = draft[field].trim();
  }
  const months = Number(draft.warranty_months);
  if (![0, 3, 6, 12, 24].includes(months)) throw new Error("质保月数无效");
  const warrantyText = formatWarrantyText(months);
  const warrantyEdited =
    terminalWarrantyMonths(order) !== months ||
    (order.warranty_change_reason ?? "").trim() !== draft.warranty_change_reason.trim();
  if (warrantyEdited) {
    const warrantyReason = draft.warranty_change_reason.trim() || operationReason.trim();
    changes.warranty_months = months;
    changes.warranty_text = warrantyText;
    changes.warranty_change_reason = warrantyReason;
  }
  return changes;
}

function terminalWarrantyMonths(order: OrderDetail["order"]) {
  return order.warranty_months == null
    ? parseWarrantyMonths(order.warranty_text, 0)
    : order.warranty_months;
}

function terminalFormError({
  mode,
  order,
  reason,
  confirmation,
  correction,
  targetStatus,
  reopenTargets,
  t,
}: {
  mode: TerminalMode | null;
  order: OrderDetail["order"];
  reason: string;
  confirmation: string;
  correction: CorrectionDraft;
  targetStatus: RepairOrderStatus;
  reopenTargets: OrderWorkflow["statuses"];
  t: Translate;
}) {
  if (!mode) return undefined;
  if (reason.trim().length < 5) return t("orders2b2.terminal.validation.reason");
  if (mode === "correct") {
    if (!correction.issue_description.trim()) return t("orders2b2.terminal.validation.issue");
    try {
      if (!Object.keys(buildTerminalCorrectionChanges(order, correction, reason)).length) {
        return t("orders2b2.terminal.validation.noChanges");
      }
    } catch {
      return t("orders2b2.terminal.validation.invalidCorrection");
    }
  }
  if (mode === "reopen") {
    if (!reopenTargets.length) return t("orders2b2.terminal.validation.noTargets");
    if (!reopenTargets.some((status) => status.code === targetStatus)) {
      return t("orders2b2.terminal.validation.invalidTarget");
    }
  }
  if (mode === "void" && confirmation.trim() !== order.public_no) {
    return t("orders2b2.terminal.validation.confirmNumber", { publicNo: order.public_no });
  }
  return undefined;
}

function terminalMutationErrorMessage(error: Error, t: Translate) {
  if (!(error instanceof RepairDeskApiError)) {
    return getOrderDetailSafeErrorMessage(error, "save", t);
  }
  const code = error.code?.toUpperCase();
  const messages: Record<string, MessageKey> = {
    STALE_VERSION: "orders2b2.terminal.error.stale",
    IDEMPOTENCY_CONFLICT: "orders2b2.terminal.error.idempotency",
    FINANCIAL_HISTORY_REQUIRES_RESOLUTION: "orders2b2.terminal.error.finance",
    INVALID_REOPEN_TARGET: "orders2b2.terminal.error.target",
    ACTOR_FORBIDDEN: "orders2b2.terminal.error.permission",
  };
  const key = code ? messages[code] : undefined;
  return key ? t(key) : getOrderDetailSafeErrorMessage(error, "save", t);
}

function actionLabel(mode: TerminalMode | null, t: Translate) {
  return mode === "correct"
    ? t("orders2b2.terminal.action.correct")
    : mode === "reopen"
      ? t("orders2b2.terminal.action.reopen")
      : t("orders2b2.terminal.action.void");
}
function successMessage(mode: TerminalMode | null, t: Translate) {
  return mode === "correct"
    ? t("orders2b2.terminal.success.correct")
    : mode === "reopen"
      ? t("orders2b2.terminal.success.reopen")
      : t("orders2b2.terminal.success.void");
}
function dialogTitle(mode: TerminalMode | null, t: Translate) {
  return mode === "correct"
    ? t("orders2b2.terminal.dialog.correct")
    : mode === "reopen"
      ? t("orders2b2.terminal.dialog.reopen")
      : t("orders2b2.terminal.dialog.void");
}
function dialogDescription(mode: TerminalMode | null, publicNo: string, t: Translate) {
  if (mode === "correct") {
    return t("orders2b2.terminal.description.correct", { publicNo });
  }
  if (mode === "reopen") {
    return t("orders2b2.terminal.description.reopen", { publicNo });
  }
  return t("orders2b2.terminal.description.void", { publicNo });
}
