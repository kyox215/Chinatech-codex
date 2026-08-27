"use client";

import { Clock3, Trash2 } from "lucide-react";

import type { StoreLifecycleActionCapability } from "@/lib/repairdesk/types";
import { Button } from "@/components/ui/button";

import {
  formatTimestamp,
  purgeStatusCopy,
  purgeUnavailableCopy,
} from "./store-purge-manager-logic";
import type { StorePurgeManagerState } from "./store-purge-manager-state";

export function StorePurgeUnavailable({ code }: { code: StoreLifecycleActionCapability["code"] }) {
  return (
    <span className="max-w-52 text-right text-xs leading-5 text-muted-foreground">
      {purgeUnavailableCopy(code)}
    </span>
  );
}

export function StorePurgeStatusCard({ state }: { state: StorePurgeManagerState }) {
  const {
    capability,
    requestQuery,
    purgeRequest,
    isReconcilingPurgeRequest,
    isReconciling,
    outcomeUnknown,
    isMutationReconciling,
    reconciliationError,
    hasCompletedRequest,
    canOfferNewRequest,
    cancellable,
    readyForConfirmation,
    isActionLocked,
    cancelMutation,
    begin,
    reconcileMutationOutcome,
    retryPurgeStatus,
  } = state;

  if (!state.canReadStatus) {
    return <StorePurgeUnavailable code={capability.code} />;
  }

  return (
    <>
      {requestQuery.isPending ? (
        <div
          role="status"
          aria-live="polite"
          className="w-full rounded-xl border border-[var(--border-panel)] bg-[var(--surface-panel-muted)] p-3 text-xs text-muted-foreground sm:max-w-md"
          data-testid="purge-status-loading"
        >
          正在读取永久删除申请状态；当前仅显示只读信息。
        </div>
      ) : null}
      {requestQuery.isError ? (
        <div
          role="alert"
          className="w-full rounded-xl border border-status-danger-foreground/25 bg-status-danger/10 p-3 text-xs leading-5 text-status-danger-foreground sm:max-w-md"
          data-testid="purge-status-error"
        >
          <p>暂时无法读取永久删除申请状态，安全起见不会开放新操作。</p>
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="mt-2"
            disabled={requestQuery.isFetching}
            onClick={retryPurgeStatus}
          >
            {requestQuery.isFetching ? "正在重试…" : "重试读取状态"}
          </Button>
        </div>
      ) : null}
      {outcomeUnknown ? (
        <div
          role={reconciliationError ? "alert" : "status"}
          aria-live="polite"
          className="w-full rounded-xl border border-status-warn-foreground/25 bg-status-warn/10 p-3 text-xs leading-5 text-status-warn-foreground sm:max-w-md"
          data-testid="purge-outcome-unknown"
        >
          <p>
            {isMutationReconciling
              ? "上次删除操作结果正在核对，期间不会重复提交、确认或取消。"
              : "暂时无法确认上次删除操作结果，安全起见已锁定所有操作。"}
          </p>
          {!isMutationReconciling ? (
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="mt-2"
              onClick={() => void reconcileMutationOutcome()}
            >
              重试状态核对
            </Button>
          ) : null}
        </div>
      ) : null}
      {requestQuery.isSuccess && (isReconcilingPurgeRequest || isReconciling) ? (
        <div
          role="status"
          aria-live="polite"
          className="w-full rounded-xl border border-status-warn-foreground/25 bg-status-warn/10 p-3 text-xs leading-5 text-status-warn-foreground sm:max-w-md"
          data-testid="purge-status-reconciling"
        >
          正在核对永久删除申请状态，期间不会重复提交操作。
        </div>
      ) : null}
      {requestQuery.isSuccess &&
      !isReconcilingPurgeRequest &&
      !outcomeUnknown &&
      state.purgeRequestStateKnown &&
      purgeRequest &&
      purgeRequest.state !== "cancelled" &&
      !hasCompletedRequest ? (
        <div className="w-full rounded-xl border border-status-warn-foreground/25 bg-status-warn/10 p-3 text-left sm:max-w-md">
          <div className="flex items-start gap-2">
            <Clock3 className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
            <div className="min-w-0 flex-1">
              <p className="text-xs font-semibold">{purgeStatusCopy(purgeRequest.state)}</p>
              <p className="mt-1 text-xs leading-5 text-muted-foreground">
                冷静期截止：{formatTimestamp(purgeRequest.cooling_until)}
                {purgeRequest.export_state ? ` · 备份：${purgeRequest.export_state}` : ""}
              </p>
              <div className="mt-2 flex flex-wrap gap-2">
                {cancellable ? (
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    disabled={isActionLocked}
                    onClick={() => cancelMutation.mutate()}
                  >
                    {cancelMutation.isPending ? "正在取消…" : "取消永久删除"}
                  </Button>
                ) : null}
                {readyForConfirmation ? (
                  <Button
                    type="button"
                    size="sm"
                    variant="destructive"
                    onClick={() => void begin("confirm")}
                  >
                    二次确认并永久删除
                  </Button>
                ) : null}
              </div>
            </div>
          </div>
        </div>
      ) : null}
      {requestQuery.isSuccess &&
      !isReconcilingPurgeRequest &&
      !outcomeUnknown &&
      hasCompletedRequest ? (
        <div
          role="status"
          className="w-full rounded-xl border border-status-success-foreground/25 bg-status-success/10 p-3 text-xs leading-5 text-status-success-foreground sm:max-w-md"
          data-testid="purge-status-completed"
        >
          永久删除已完成。该店铺已不可恢复，页面不会再次开放永久删除申请。
        </div>
      ) : null}
      {canOfferNewRequest ? (
        <Button type="button" variant="destructive" onClick={() => void begin("request")}>
          <Trash2 className="mr-1.5 size-4" aria-hidden="true" />
          申请永久删除
        </Button>
      ) : requestQuery.isSuccess &&
        !isReconcilingPurgeRequest &&
        !outcomeUnknown &&
        purgeRequest === null &&
        !capability.allowed ? (
        <span className="text-xs leading-5 text-muted-foreground">
          永久删除新申请暂未启用；已有申请状态仍会显示。
        </span>
      ) : null}
    </>
  );
}
