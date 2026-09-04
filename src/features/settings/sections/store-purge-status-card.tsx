"use client";

import { Clock3, Trash2 } from "lucide-react";

import type { StoreLifecycleActionCapability, StorePurgeRequest } from "@/lib/repairdesk/types";
import { Button } from "@/components/ui/button";
import type { StorePurgeManagerState } from "./store-purge-manager-state";
import { useLocale } from "@/shared/i18n/locale-provider";
import { translateSettingsOperations } from "@/shared/i18n/messages";
import type { AppLocale } from "@/shared/i18n/locales";

function useOperationsCopy() {
  const { locale } = useLocale();
  return {
    locale,
    copy: (
      source: Parameters<typeof translateSettingsOperations>[1],
      values?: Record<string, string | number>,
    ) => translateSettingsOperations(locale, source, values),
  };
}

export function StorePurgeUnavailable({ code }: { code: StoreLifecycleActionCapability["code"] }) {
  const { copy } = useOperationsCopy();
  return (
    <span className="max-w-52 text-right text-xs leading-5 text-muted-foreground">
      {copy(purgeUnavailablePresentation[code])}
    </span>
  );
}

export function StorePurgeStatusCard({ state }: { state: StorePurgeManagerState }) {
  const { locale, copy } = useOperationsCopy();
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
          {copy("正在读取永久删除申请状态；当前仅显示只读信息。")}
        </div>
      ) : null}
      {requestQuery.isError ? (
        <div
          role="alert"
          className="w-full rounded-xl border border-status-danger-foreground/25 bg-status-danger/10 p-3 text-xs leading-5 text-status-danger-foreground sm:max-w-md"
          data-testid="purge-status-error"
        >
          <p>{copy("暂时无法读取永久删除申请状态，安全起见不会开放新操作。")}</p>
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="mt-2"
            disabled={requestQuery.isFetching}
            onClick={retryPurgeStatus}
          >
            {requestQuery.isFetching ? copy("正在重试…") : copy("重试读取状态")}
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
              ? copy("上次删除操作结果正在核对，期间不会重复提交、确认或取消。")
              : copy("暂时无法确认上次删除操作结果，安全起见已锁定所有操作。")}
          </p>
          {!isMutationReconciling ? (
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="mt-2"
              onClick={() => void reconcileMutationOutcome()}
            >
              {copy("重试状态核对")}
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
          {copy("正在核对永久删除申请状态，期间不会重复提交操作。")}
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
              <p className="text-xs font-semibold">
                {copy(purgeStatePresentation[purgeRequest.state])}
              </p>
              <p className="mt-1 text-xs leading-5 text-muted-foreground">
                {copy("冷静期截止：{date}", {
                  date: formatPurgeTimestamp(purgeRequest.cooling_until, locale),
                })}
                {purgeRequest.export_state
                  ? ` · ${copy("备份：{state}", {
                      state: copy(purgeExportStatePresentation[purgeRequest.export_state]),
                    })}`
                  : ""}
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
                    {cancelMutation.isPending ? copy("正在取消…") : copy("取消永久删除")}
                  </Button>
                ) : null}
                {readyForConfirmation ? (
                  <Button
                    type="button"
                    size="sm"
                    variant="destructive"
                    onClick={() => void begin("confirm")}
                  >
                    {copy("二次确认并永久删除")}
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
          {copy("永久删除已完成。该店铺已不可恢复，页面不会再次开放永久删除申请。")}
        </div>
      ) : null}
      {canOfferNewRequest ? (
        <Button type="button" variant="destructive" onClick={() => void begin("request")}>
          <Trash2 className="mr-1.5 size-4" aria-hidden="true" />
          {copy("申请永久删除")}
        </Button>
      ) : requestQuery.isSuccess &&
        !isReconcilingPurgeRequest &&
        !outcomeUnknown &&
        purgeRequest === null &&
        !capability.allowed ? (
        <span className="text-xs leading-5 text-muted-foreground">
          {copy("永久删除新申请暂未启用；已有申请状态仍会显示。")}
        </span>
      ) : null}
    </>
  );
}

const purgeStatePresentation: Record<
  StorePurgeRequest["state"],
  Parameters<typeof translateSettingsOperations>[1]
> = {
  cooling: "永久删除冷静期中",
  preparing_export: "正在准备加密备份",
  ready_for_confirmation: "可以进行最终确认",
  scheduled: "已最终确认，等待后台清除",
  cancelled: "已取消",
  purging: "正在永久清除，已不可取消",
  failed: "后台清除暂停，需要平台处理",
  completed: "永久删除已完成",
};

const purgeExportStatePresentation: Record<
  NonNullable<StorePurgeRequest["export_state"]>,
  Parameters<typeof translateSettingsOperations>[1]
> = {
  pending: "等待备份",
  exporting: "正在导出",
  completed: "备份已完成",
  restore_verified: "恢复验证已通过",
  failed: "备份失败",
};

const purgeUnavailablePresentation: Record<
  StoreLifecycleActionCapability["code"],
  Parameters<typeof translateSettingsOperations>[1]
> = {
  available: "当前店铺暂时不能申请永久删除。",
  feature_disabled: "永久删除功能正在准备中。",
  store_context_required: "当前店铺暂时不能申请永久删除。",
  primary_owner_required: "只有系统登记的店铺主账号可以申请永久删除。",
  mfa_required: "请先在账号设置中启用身份验证器。",
  migration_unavailable: "店铺保护尚未安装完成，当前不能申请永久删除。",
  enforcement_unhealthy: "店铺写入保护尚未启用，当前不能申请永久删除。",
  store_unavailable: "当前店铺暂时不能申请永久删除。",
};

export function formatPurgeTimestamp(value: string, locale: AppLocale) {
  const timestamp = new Date(value);
  if (!value || Number.isNaN(timestamp.getTime())) {
    return translateSettingsOperations(locale, "时间不可用");
  }
  return new Intl.DateTimeFormat(locale, {
    dateStyle: "medium",
    timeStyle: "short",
    timeZone: "Europe/Rome",
  }).format(timestamp);
}
