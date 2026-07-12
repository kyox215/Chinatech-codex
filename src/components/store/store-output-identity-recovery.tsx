"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { ExternalLink, RefreshCw, Settings2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import type { StoreOutputIdentity } from "@/entities/store/model/store-output-identity";
import { cn } from "@/lib/utils";

type RecoveryCallback = () => void | Promise<unknown>;

export interface StoreOutputIdentityRecoveryProps {
  identity: StoreOutputIdentity;
  canReadSettings: boolean;
  canUpdateSettings: boolean;
  onRetrySettings?: RecoveryCallback;
  onReloadStoreContext?: RecoveryCallback;
  openSettingsInNewTab?: boolean;
  className?: string;
}

export function StoreOutputIdentityRecovery({
  identity,
  canReadSettings,
  canUpdateSettings,
  onRetrySettings,
  onReloadStoreContext,
  openSettingsInNewTab = false,
  className,
}: StoreOutputIdentityRecoveryProps) {
  const [pendingAction, setPendingAction] = useState<"retry" | "reload" | null>(null);
  const [actionError, setActionError] = useState("");

  useEffect(() => {
    setPendingAction(null);
    setActionError("");
  }, [identity.blockCode, identity.recoveryTarget]);

  if (identity.canOutput) return null;

  const isWaiting = identity.recoveryTarget === "wait";
  const settingsDestination = getSettingsDestination(identity.recoveryTarget);
  const settingsLabel = getSettingsLabel(identity.recoveryTarget, canUpdateSettings);
  const callbackAction =
    identity.recoveryTarget === "retry_settings"
      ? {
          key: "retry" as const,
          label: "重新读取店铺资料",
          callback: onRetrySettings,
        }
      : identity.recoveryTarget === "reload_store_context"
        ? {
            key: "reload" as const,
            label: "重新加载当前店铺",
            callback: onReloadStoreContext,
          }
        : undefined;
  const canRecheckSettings = Boolean(settingsDestination && onRetrySettings);

  const runRecovery = async (key: "retry" | "reload", callback: RecoveryCallback | undefined) => {
    if (!callback || pendingAction) return;
    setPendingAction(key);
    setActionError("");
    try {
      await callback();
    } catch {
      setActionError("恢复操作未成功，请稍后重试。若问题持续，请联系店主或经理。");
    } finally {
      setPendingAction(null);
    }
  };

  return (
    <div
      role={isWaiting ? "status" : "alert"}
      aria-live={isWaiting ? "polite" : "assertive"}
      aria-busy={isWaiting || pendingAction !== null}
      className={cn(
        "rounded-lg border border-status-warn-foreground/30 bg-status-warn/10 px-3 py-2.5 text-status-warn-foreground",
        className,
      )}
    >
      <div className="flex min-w-0 flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="min-w-0">
          <p className="break-words text-xs leading-5">
            {identity.blockReason ?? "当前店铺资料尚未达到客户输出要求。"}
          </p>
          {settingsDestination && !canUpdateSettings ? (
            <p className="mt-1 text-[11px] leading-4">
              {canReadSettings
                ? "当前账号只能查看设置；请联系店主或经理完成修改。"
                : "当前账号无法打开店铺设置；请联系店主或经理处理。"}
            </p>
          ) : null}
          {canRecheckSettings ? (
            <p className="mt-1 text-[11px] leading-4">
              修改完成后返回本页，点击“重新检查资料”继续。
            </p>
          ) : null}
          {actionError ? (
            <p className="mt-1 text-[11px] leading-4" data-store-output-recovery-error>
              {actionError}
            </p>
          ) : null}
        </div>

        {(settingsDestination && canReadSettings && settingsLabel) ||
        canRecheckSettings ||
        callbackAction?.callback ? (
          <div className="flex w-full shrink-0 flex-col gap-2 sm:w-auto sm:flex-row sm:items-center">
            {settingsDestination && canReadSettings && settingsLabel ? (
              <Button
                asChild
                size="sm"
                variant="outline"
                className="min-h-11 w-full shrink-0 border-status-warn-foreground/30 bg-background px-3 text-status-warn-foreground hover:bg-status-warn/15 sm:min-h-9 sm:w-auto"
              >
                <Link
                  href={settingsDestination}
                  target={openSettingsInNewTab ? "_blank" : undefined}
                  rel={openSettingsInNewTab ? "noopener noreferrer" : undefined}
                  aria-label={
                    openSettingsInNewTab ? `${settingsLabel}（在新标签页打开）` : settingsLabel
                  }
                >
                  <Settings2 aria-hidden="true" />
                  {settingsLabel}
                  {openSettingsInNewTab ? <ExternalLink aria-hidden="true" /> : null}
                </Link>
              </Button>
            ) : null}
            {canRecheckSettings ? (
              <Button
                type="button"
                size="sm"
                variant="outline"
                className="min-h-11 w-full shrink-0 border-status-warn-foreground/30 bg-background px-3 text-status-warn-foreground hover:bg-status-warn/15 sm:min-h-9 sm:w-auto"
                disabled={pendingAction !== null}
                aria-busy={pendingAction === "retry"}
                onClick={() => void runRecovery("retry", onRetrySettings)}
              >
                <RefreshCw
                  aria-hidden="true"
                  className={cn(pendingAction === "retry" && "animate-spin")}
                />
                {pendingAction === "retry" ? "正在检查…" : "重新检查资料"}
              </Button>
            ) : null}
            {!settingsDestination && callbackAction?.callback ? (
              <Button
                type="button"
                size="sm"
                variant="outline"
                className="min-h-11 w-full shrink-0 border-status-warn-foreground/30 bg-background px-3 text-status-warn-foreground hover:bg-status-warn/15 sm:min-h-9 sm:w-auto"
                disabled={pendingAction !== null}
                aria-busy={pendingAction === callbackAction.key}
                onClick={() => void runRecovery(callbackAction.key, callbackAction.callback)}
              >
                <RefreshCw
                  aria-hidden="true"
                  className={cn(pendingAction === callbackAction.key && "animate-spin")}
                />
                {pendingAction === callbackAction.key ? "正在恢复…" : callbackAction.label}
              </Button>
            ) : null}
          </div>
        ) : null}
      </div>
    </div>
  );
}

function getSettingsDestination(recoveryTarget: StoreOutputIdentity["recoveryTarget"]) {
  if (recoveryTarget === "store") return "/settings?section=store";
  if (recoveryTarget === "notifications") return "/settings?section=notifications";
  return undefined;
}

function getSettingsLabel(
  recoveryTarget: StoreOutputIdentity["recoveryTarget"],
  canUpdateSettings: boolean,
) {
  if (recoveryTarget === "store") {
    return canUpdateSettings ? "前往店铺资料" : "查看店铺资料";
  }
  if (recoveryTarget === "notifications") {
    return canUpdateSettings ? "前往通知与打印" : "查看通知与打印";
  }
  return undefined;
}
