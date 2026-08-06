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
      }),
    [confirmation, correction, mode, order, reason, reopenTargets, targetStatus],
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
      toast.success(result.replayed ? "操作已确认（重复提交未产生新记录）" : successMessage(mode));
      setMode(null);
      setMutationError("");
      onCompleted();
    },
    onError: (error: Error) => {
      const message = terminalMutationErrorMessage(error);
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
    />
  ) : null;
  const visibleError = mutationError || validationError;
  const footer = (
    <>
      <Button variant="outline" disabled={mutation.isPending} onClick={() => setMode(null)}>
        取消
      </Button>
      <Button
        variant={mode === "void" ? "destructive" : "default"}
        disabled={mutation.isPending || Boolean(validationError)}
        onClick={() => mutation.mutate()}
      >
        {mutation.isPending ? "处理中…" : actionLabel(mode)}
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
          {voided ? "记录已作废" : "工单已结束 · 编辑已锁定"}
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
                <FilePenLine className="size-3" /> 纠正
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
                <RotateCcw className="size-3" /> 重新打开
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
                    aria-label="更多结束工单操作"
                  >
                    <MoreHorizontal className="size-3.5" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  <DropdownMenuItem
                    className="text-destructive focus:text-destructive"
                    onClick={() => open("void")}
                  >
                    <Trash2 className="mr-2 size-3.5" /> 安全作废
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
              {voided ? "该工单记录已作废" : "该工单已结束"}
            </p>
            <p className="mt-0.5 text-xs leading-5 text-muted-foreground">
              {voided
                ? "原订单、付款、附件、消息和审计证据均已保留，并已从有效客户汇总中排除。"
                : "普通编辑和普通状态流转已锁定；纠正与重新打开会记录原因、版本和审计。"}
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
                  <FilePenLine className="size-3.5" /> 纠正记录
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
                  <RotateCcw className="size-3.5" /> 重新打开
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
                  <Trash2 className="size-3.5" /> 安全作废
                </Button>
              ) : null}
            </div>
          ) : null}
        </div>
        {!voided && !capabilities?.canVoid && capabilities?.blockedReasons?.void ? (
          <p className="mt-2 text-xs text-status-warn-foreground" role="status">
            作废受限：{capabilities.blockedReasons.void}
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
              <SheetTitle>{dialogTitle(mode)}</SheetTitle>
              <SheetDescription>{dialogDescription(mode, order.public_no)}</SheetDescription>
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
              <DialogTitle>{dialogTitle(mode)}</DialogTitle>
              <DialogDescription>{dialogDescription(mode, order.public_no)}</DialogDescription>
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
}) {
  return (
    <div className="space-y-3 py-2">
      {mode === "correct" ? (
        <div className="grid gap-3 sm:grid-cols-2">
          <Field id="terminal-correction-issue" label="故障描述" className="sm:col-span-2">
            <Textarea
              id="terminal-correction-issue"
              value={correction.issue_description}
              onChange={(event) =>
                onCorrectionChange({ ...correction, issue_description: event.target.value })
              }
            />
          </Field>
          <Field id="terminal-correction-diagnosis" label="诊断结果" className="sm:col-span-2">
            <Textarea
              id="terminal-correction-diagnosis"
              value={correction.diagnosis_result}
              onChange={(event) =>
                onCorrectionChange({ ...correction, diagnosis_result: event.target.value })
              }
            />
          </Field>
          <Field id="terminal-correction-tag" label="内部标签">
            <Input
              id="terminal-correction-tag"
              value={correction.internal_tag}
              onChange={(event) =>
                onCorrectionChange({ ...correction, internal_tag: event.target.value })
              }
            />
          </Field>
          <Field id="terminal-correction-accessory" label="留存备注">
            <Input
              id="terminal-correction-accessory"
              value={correction.accessory_notes}
              onChange={(event) =>
                onCorrectionChange({ ...correction, accessory_notes: event.target.value })
              }
            />
          </Field>
          <Field id="terminal-correction-warranty-months" label="质保月数">
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
                <SelectValue placeholder="选择质保月数" />
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
          <Field id="terminal-correction-warranty-text" label="质保说明（自动）">
            <Input
              id="terminal-correction-warranty-text"
              value={correction.warranty_text}
              readOnly
            />
          </Field>
          <Field
            id="terminal-correction-warranty-reason"
            label="质保变更原因"
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
        <Field id="terminal-reopen-target" label="重新打开到">
          <Select
            value={targetStatus}
            onValueChange={(value) => onTargetStatusChange(value as RepairOrderStatus)}
          >
            <SelectTrigger id="terminal-reopen-target">
              <SelectValue placeholder="选择状态" />
            </SelectTrigger>
            <SelectContent>
              {reopenTargets.map((status) => (
                <SelectItem key={status.code} value={status.code}>
                  {status.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </Field>
      ) : null}
      {mode === "void" ? (
        <Field id="terminal-void-confirmation" label={`输入工单号 ${order.public_no} 确认`}>
          <Input
            id="terminal-void-confirmation"
            value={confirmation}
            onChange={(event) => onConfirmationChange(event.target.value)}
            autoComplete="off"
          />
          <p className="text-xs leading-5 text-muted-foreground">
            安全作废不会删除付款、附件、消息或审计；如存在任何资金证据，系统会拒绝。
          </p>
        </Field>
      ) : null}
      <Field id="terminal-operation-reason" label="操作原因（必填）">
        <Textarea
          id="terminal-operation-reason"
          value={reason}
          onChange={(event) => onReasonChange(event.target.value)}
          minLength={5}
          maxLength={1000}
          autoFocus
          placeholder="至少 5 个字符，说明为什么需要本次操作"
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
}: {
  mode: TerminalMode | null;
  order: OrderDetail["order"];
  reason: string;
  confirmation: string;
  correction: CorrectionDraft;
  targetStatus: RepairOrderStatus;
  reopenTargets: OrderWorkflow["statuses"];
}) {
  if (!mode) return undefined;
  if (reason.trim().length < 5) return "原因至少需要 5 个字符";
  if (mode === "correct") {
    if (!correction.issue_description.trim()) return "故障描述不能为空";
    try {
      if (!Object.keys(buildTerminalCorrectionChanges(order, correction, reason)).length) {
        return "没有需要纠正的内容";
      }
    } catch (error) {
      return error instanceof Error ? error.message : "纠正内容无效";
    }
  }
  if (mode === "reopen") {
    if (!reopenTargets.length) return "当前工作流没有可重新打开的目标状态";
    if (!reopenTargets.some((status) => status.code === targetStatus)) {
      return "请选择有效的重新打开状态";
    }
  }
  if (mode === "void" && confirmation.trim() !== order.public_no) {
    return `请输入完整工单号 ${order.public_no} 确认`;
  }
  return undefined;
}

function terminalMutationErrorMessage(error: Error) {
  if (!(error instanceof RepairDeskApiError)) return error.message;
  const code = error.code?.toUpperCase();
  const messages: Record<string, string> = {
    STALE_VERSION: "工单已被其他操作更新，页面正在刷新，请核对后重试。",
    IDEMPOTENCY_CONFLICT: "本次操作标识已用于不同请求，请关闭后重新提交。",
    FINANCIAL_HISTORY_REQUIRES_RESOLUTION:
      "存在付款记录或金额异常，必须先完成财务核对与冲销/退款。",
    INVALID_REOPEN_TARGET: "目标状态已不可用，请刷新工作流后重试。",
    ACTOR_FORBIDDEN: "当前账号没有执行此终态操作的权限。",
  };
  return (code && messages[code]) || error.message;
}

function actionLabel(mode: TerminalMode | null) {
  return mode === "correct" ? "确认纠正" : mode === "reopen" ? "确认重新打开" : "确认安全作废";
}
function successMessage(mode: TerminalMode | null) {
  return mode === "correct"
    ? "纠正记录已保存"
    : mode === "reopen"
      ? "工单已重新打开"
      : "工单已安全作废";
}
function dialogTitle(mode: TerminalMode | null) {
  return mode === "correct"
    ? "纠正已结束工单"
    : mode === "reopen"
      ? "重新打开工单"
      : "安全作废工单";
}
function dialogDescription(mode: TerminalMode | null, publicNo: string) {
  if (mode === "correct") return `${publicNo} · 只允许纠正非财务内容，原值与新值会进入审计。`;
  if (mode === "reopen") return `${publicNo} · 选择非终态目标并填写原因，系统会保留完整时间线。`;
  return `${publicNo} · 仅 Owner 可执行；记录会退出有效汇总，但业务证据不会删除。`;
}
