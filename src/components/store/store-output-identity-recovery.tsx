"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { ExternalLink, RefreshCw, Settings2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import type {
  StoreOutputIdentity,
  StoreOutputIdentityMissingField,
} from "@/entities/store/model/store-output-identity";
import { cn } from "@/lib/utils";
import { useLocale } from "@/shared/i18n/locale-provider";
import type { MessageKey, MessageValues } from "@/shared/i18n/messages";

type Translate = (key: MessageKey, values?: MessageValues) => string;

const identityReasonKeys = {
  settings_loading: "orders2b2.identity.reason.loading",
  settings_load_failed: "orders2b2.identity.reason.loadFailed",
  store_context_mismatch: "orders2b2.identity.reason.mismatch",
  legacy_identity: "orders2b2.identity.reason.legacy",
  missing_store_name: "orders2b2.identity.reason.missingName",
} as const satisfies Partial<Record<NonNullable<StoreOutputIdentity["blockCode"]>, MessageKey>>;

const missingFieldKeys: Record<StoreOutputIdentityMissingField, MessageKey> = {
  store_name: "orders2b2.identity.field.storeName",
  store_address: "orders2b2.identity.field.storeAddress",
  contact: "orders2b2.identity.field.contact",
  public_base_url: "orders2b2.identity.field.publicUrl",
  message_signature: "orders2b2.identity.field.signature",
  print_footer: "orders2b2.identity.field.footer",
};

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
  const { t } = useLocale();
  const [pendingAction, setPendingAction] = useState<"retry" | "reload" | null>(null);
  const [actionError, setActionError] = useState("");

  useEffect(() => {
    setPendingAction(null);
    setActionError("");
  }, [identity.blockCode, identity.recoveryTarget]);

  if (identity.canOutput) return null;

  const isWaiting = identity.recoveryTarget === "wait";
  const settingsDestination = getSettingsDestination(identity.recoveryTarget);
  const settingsLabel = getSettingsLabel(identity.recoveryTarget, canUpdateSettings, t);
  const callbackAction =
    identity.recoveryTarget === "retry_settings"
      ? {
          key: "retry" as const,
          label: t("orders2b2.identity.retrySettings"),
          callback: onRetrySettings,
        }
      : identity.recoveryTarget === "reload_store_context"
        ? {
            key: "reload" as const,
            label: t("orders2b2.identity.reloadStore"),
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
      setActionError(t("orders2b2.identity.recoveryFailed"));
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
          <p className="break-words text-xs leading-5">{localizeIdentityReason(identity, t)}</p>
          {settingsDestination && !canUpdateSettings ? (
            <p className="mt-1 text-[11px] leading-4">
              {canReadSettings
                ? t("orders2b2.identity.readonly")
                : t("orders2b2.identity.noAccess")}
            </p>
          ) : null}
          {canRecheckSettings ? (
            <p className="mt-1 text-[11px] leading-4">{t("orders2b2.identity.recheckHelp")}</p>
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
                    openSettingsInNewTab
                      ? t("orders2b2.identity.newTab", { label: settingsLabel })
                      : settingsLabel
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
                {pendingAction === "retry"
                  ? t("orders2b2.identity.checking")
                  : t("orders2b2.identity.recheck")}
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
                {pendingAction === callbackAction.key
                  ? t("orders2b2.identity.recovering")
                  : callbackAction.label}
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
  t: Translate,
) {
  if (recoveryTarget === "store") {
    return canUpdateSettings
      ? t("orders2b2.identity.editStore")
      : t("orders2b2.identity.viewStore");
  }
  if (recoveryTarget === "notifications") {
    return canUpdateSettings
      ? t("orders2b2.identity.editNotifications")
      : t("orders2b2.identity.viewNotifications");
  }
  return undefined;
}

function localizeIdentityReason(identity: StoreOutputIdentity, t: Translate) {
  if (identity.blockCode === "missing_required_fields") {
    return t("orders2b2.identity.reason.missingFields", {
      fields: identity.missingFields
        .map((field) => t(missingFieldKeys[field]))
        .join(t("orders2b2.event.fieldSeparator")),
    });
  }
  const key = identity.blockCode ? identityReasonKeys[identity.blockCode] : undefined;
  if (key) return t(key);
  return identity.blockReason ?? t("orders2b2.identity.reason.default");
}
