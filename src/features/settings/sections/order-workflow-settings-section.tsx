"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { AlertTriangle, GitBranch, LockKeyhole, Plus, RotateCcw } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { OrderWorkflowReviewDialog } from "@/features/settings/components/order-workflow-review-dialog";
import { OrderWorkflowStatusList } from "@/features/settings/components/order-workflow-status-list";
import { OrderWorkflowStatusSheet } from "@/features/settings/components/order-workflow-status-sheet";
import { OrderWorkflowTransitionsPanel } from "@/features/settings/components/order-workflow-transitions-panel";
import { UnsavedSettingsGuard } from "@/features/settings/components/unsaved-settings-guard";
import {
  addOrderWorkflowStatusDraft,
  createOrderWorkflowDraftState,
  discardOrderWorkflowDraft,
  isOrderWorkflowDraftDirty,
  moveOrderWorkflowStatusDraft,
  reconcileOrderWorkflowDraftState,
  updateOrderWorkflowStatusDraft,
  updateOrderWorkflowTransitionDraft,
  type OrderWorkflowDraftState,
} from "@/features/settings/model/order-workflow-draft";
import {
  summarizeOrderWorkflowChanges,
  validateOrderWorkflowDraft,
} from "@/features/settings/model/order-workflow-draft-review";
import { RepairOsBusinessCard, RepairOsSectionHeader } from "@/shared/ui";
import type {
  OrderWorkflow,
  OrderWorkflowStatusCreateInput,
  OrderWorkflowStatusUpdateInput,
} from "@/lib/repairdesk/types";
import { cn } from "@/lib/utils";
import { repairOs } from "@/lib/ui-patterns";

export interface OrderWorkflowSettingsSectionProps {
  storeId: string;
  workflow?: OrderWorkflow;
  isLoading: boolean;
  isError: boolean;
  canEdit: boolean;
  onRetry: () => void;
  onDirtyChange?: (dirty: boolean) => void;
}

export function OrderWorkflowSettingsSection({
  storeId,
  workflow,
  isLoading,
  isError,
  canEdit,
  onRetry,
  onDirtyChange,
}: OrderWorkflowSettingsSectionProps) {
  const [draft, setDraft] = useState<OrderWorkflowDraftState | null>(() =>
    workflow ? createOrderWorkflowDraftState(workflow, storeId) : null,
  );
  const [editorTarget, setEditorTarget] = useState<"new" | string | null>(null);
  const [reviewOpen, setReviewOpen] = useState(false);
  const gateRef = useRef<HTMLDivElement>(null);
  const editorTriggerRef = useRef<HTMLElement | null>(null);
  const reviewTriggerRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (!workflow) return;
    setDraft((current) =>
      current
        ? reconcileOrderWorkflowDraftState(current, workflow)
        : createOrderWorkflowDraftState(workflow, storeId),
    );
  }, [storeId, workflow]);

  const dirty = Boolean(draft && isOrderWorkflowDraftDirty(draft));
  const dirtyRef = useRef(dirty);
  dirtyRef.current = dirty;

  useEffect(() => {
    onDirtyChange?.(dirty);
  }, [dirty, onDirtyChange]);

  useEffect(() => () => onDirtyChange?.(false), [onDirtyChange]);

  const discardDraft = useCallback(() => {
    dirtyRef.current = false;
    setReviewOpen(false);
    setEditorTarget(null);
    setDraft((current) => (current ? discardOrderWorkflowDraft(current) : current));
    onDirtyChange?.(false);
    return { status: "resolved" as const };
  }, [onDirtyChange]);
  const focusApplyGate = useCallback(() => gateRef.current?.focus(), []);
  const openEditor = (target: "new" | string) => {
    editorTriggerRef.current = document.activeElement as HTMLElement | null;
    setEditorTarget(target);
  };
  const statuses = draft?.value.statuses ?? [];
  const selectedStatus =
    editorTarget && editorTarget !== "new"
      ? statuses.find((status) => status.id === editorTarget)
      : undefined;
  const issues = useMemo(() => (draft ? validateOrderWorkflowDraft(draft) : []), [draft]);
  const summary = useMemo(
    () =>
      draft
        ? summarizeOrderWorkflowChanges(draft)
        : {
            hasChanges: false,
            added: 0,
            renamed: 0,
            availabilityChanged: 0,
            defaultChanged: false,
            orderChanged: false,
            transitionsChanged: 0,
            items: [],
            impactedEntrypoints: [],
          },
    [draft],
  );

  const updateDraft = (next: (current: OrderWorkflowDraftState) => OrderWorkflowDraftState) => {
    if (!canEdit) return;
    setDraft((current) => (current ? next(current) : current));
  };

  const createStatus = (input: OrderWorkflowStatusCreateInput) => {
    updateDraft((current) => addOrderWorkflowStatusDraft(current, input));
  };

  const updateStatus = (id: string, input: OrderWorkflowStatusUpdateInput) => {
    updateDraft((current) => updateOrderWorkflowStatusDraft(current, id, input));
  };

  return (
    <section
      id="settings-workflow"
      data-ui="settings-workflow-section"
      className={cn(repairOs.adminSection, "p-3 sm:p-4")}
    >
      <UnsavedSettingsGuard
        id={`settings-workflow-draft:${storeId}`}
        dirty={dirty}
        isDirty={() => dirtyRef.current}
        busy={false}
        canSave={false}
        saveUnavailableReason="状态流需等待带版本校验的事务接口获批后才能应用。"
        label="工单状态流草稿"
        onSave={async () => ({ status: "blocked", focus: focusApplyGate })}
        onDiscard={discardDraft}
        onFocusFallback={focusApplyGate}
      />

      <RepairOsSectionHeader
        icon={GitBranch}
        iconFrame={false}
        title="工单状态流"
        className="items-start max-sm:flex-col"
        bodyClassName="items-start"
        descriptionClassName="mt-0.5 whitespace-normal text-xs leading-5"
        description={
          canEdit
            ? "先编辑店铺级草稿，再集中检查变更；编辑过程不会写入服务器。"
            : "查看当前店铺的状态、顺序与推荐流转规则。"
        }
        action={
          canEdit && draft ? (
            <Button
              type="button"
              variant="outline"
              className="min-h-11"
              data-ui="workflow-add-status"
              onClick={() => openEditor("new")}
            >
              <Plus className="size-4" /> 新增状态草稿
            </Button>
          ) : null
        }
      />

      {isLoading && !draft ? (
        <div className="grid gap-3" aria-busy="true" aria-label="正在读取工单状态流">
          <Skeleton className="h-20 w-full rounded-xl" />
          <Skeleton className="h-20 w-full rounded-xl" />
          <Skeleton className="h-36 w-full rounded-xl" />
        </div>
      ) : isError && !draft ? (
        <RepairOsBusinessCard
          as="div"
          role="alert"
          className="grid-cols-1 gap-3 border-status-danger-foreground/25 bg-status-danger/10 px-3 py-3 text-status-danger-foreground sm:grid-cols-[minmax(0,1fr)_auto]"
          trailing={
            <Button type="button" variant="outline" className="min-h-11" onClick={onRetry}>
              <RotateCcw className="size-4" /> 重新读取
            </Button>
          }
        >
          <div className="flex gap-2">
            <AlertTriangle className="mt-0.5 size-4 shrink-0" />
            <div>
              <p className="text-sm font-semibold">状态流读取失败</p>
              <p className="mt-1 text-xs leading-5">
                当前没有可安全编辑的店铺快照。请重新读取；页面不会建立或保存备用状态。
              </p>
            </div>
          </div>
        </RepairOsBusinessCard>
      ) : draft ? (
        <div className="space-y-4">
          {isError ? (
            <div
              role="alert"
              className="flex flex-col gap-3 rounded-lg border border-status-warn-foreground/25 bg-status-warn px-3 py-3 text-status-warn-foreground sm:flex-row sm:items-center sm:justify-between"
            >
              <p className="text-sm">刷新失败，当前本地草稿仍保留；重新读取前不会覆盖。</p>
              <Button
                type="button"
                variant="outline"
                className="min-h-11 shrink-0"
                onClick={onRetry}
              >
                <RotateCcw className="size-4" /> 再试一次
              </Button>
            </div>
          ) : null}

          {!canEdit ? (
            <div className="rounded-lg border border-[var(--border-panel)] bg-card px-3 py-3 text-sm text-muted-foreground">
              当前为只读访问。页面仅展示语义值，不提供不可用的表单控件。
            </div>
          ) : null}

          {draft.conflict ? (
            <div
              role="alert"
              className="rounded-lg border border-status-warn-foreground/25 bg-status-warn px-3 py-3 text-status-warn-foreground"
            >
              <p className="text-sm font-semibold">服务器版本已变化，本地草稿未被覆盖</p>
              <p className="mt-1 text-xs leading-5">
                可继续核对本地内容，或明确切换到最新服务器版本。当前不执行自动合并。
              </p>
              <Button
                type="button"
                variant="outline"
                className="mt-3 min-h-11"
                onClick={discardDraft}
              >
                使用最新服务器版本
              </Button>
            </div>
          ) : null}

          {canEdit ? (
            <div
              ref={gateRef}
              tabIndex={-1}
              data-ui="workflow-apply-gate"
              className="rounded-xl border border-[var(--border-panel)] bg-card px-3 py-3 outline-none focus-visible:ring-2 focus-visible:ring-ring sm:px-4"
            >
              <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="text-sm font-semibold">
                      {dirty ? "本地草稿有待检查变更" : "已与加载版本一致"}
                    </p>
                    <Badge variant="outline">{issues.length} 项安全提示</Badge>
                  </div>
                  <p className="mt-1 text-xs leading-5 text-muted-foreground">
                    应用状态流仍锁定：需单事务、版本冲突检测及活跃工单兼容性校验。
                  </p>
                </div>
                <div className="flex flex-col gap-2 sm:flex-row">
                  <Button
                    type="button"
                    variant="outline"
                    className="min-h-11"
                    disabled={!dirty}
                    onClick={discardDraft}
                  >
                    放弃草稿
                  </Button>
                  <Button
                    ref={reviewTriggerRef}
                    type="button"
                    className="min-h-11"
                    disabled={!dirty}
                    data-ui="workflow-review-changes"
                    onClick={() => setReviewOpen(true)}
                  >
                    <LockKeyhole className="size-4" /> 检查变更
                  </Button>
                </div>
              </div>
            </div>
          ) : null}

          {!statuses.length ? (
            <div className="rounded-xl border border-dashed border-[var(--border-panel)] bg-card px-4 py-8 text-center">
              <GitBranch className="mx-auto size-7 text-muted-foreground" />
              <p className="mt-2 text-sm font-semibold">当前店铺没有状态流记录</p>
              <p className="mx-auto mt-1 max-w-md text-xs leading-5 text-muted-foreground">
                页面不会使用备用 ID
                或跨店铺默认值代替真实数据。可重新读取，或仅在本地草稿中规划新状态。
              </p>
            </div>
          ) : (
            <div className="grid min-w-0 gap-4 xl:grid-cols-[minmax(0,1fr)_minmax(20rem,0.72fr)] xl:items-start">
              <OrderWorkflowStatusList
                statuses={statuses}
                canEdit={canEdit}
                onEdit={openEditor}
                onMove={(id, direction) =>
                  updateDraft((current) => moveOrderWorkflowStatusDraft(current, id, direction))
                }
              />

              <OrderWorkflowTransitionsPanel
                statuses={statuses}
                transitions={draft.value.transitions}
                canEdit={canEdit}
                onUpdate={(from, to, patch) =>
                  updateDraft((current) =>
                    updateOrderWorkflowTransitionDraft(current, from, to, patch),
                  )
                }
              />
            </div>
          )}
        </div>
      ) : null}

      <OrderWorkflowStatusSheet
        open={editorTarget !== null}
        status={selectedStatus}
        existingCodes={statuses.map((status) => status.code)}
        onOpenChange={(open) => !open && setEditorTarget(null)}
        onRestoreFocus={() => editorTriggerRef.current?.focus()}
        onCreate={createStatus}
        onUpdate={updateStatus}
      />
      <OrderWorkflowReviewDialog
        open={reviewOpen}
        summary={summary}
        issues={issues}
        onOpenChange={setReviewOpen}
        onRestoreFocus={() => reviewTriggerRef.current?.focus()}
      />
    </section>
  );
}
