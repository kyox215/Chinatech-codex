"use client";

import type { FormEvent, MouseEvent, ReactNode, RefObject } from "react";
import { ArrowLeft, Loader2, X } from "lucide-react";

import { Button } from "@/components/ui/button";
import { InventoryConsequenceDialog } from "../../components/inventory-consequence-dialog";
import {
  InventorySyncStatusPanel,
  type InventorySyncStatus,
} from "../../components/inventory-sync-status-panel";
import { repairOs, surfaces } from "@/lib/ui-patterns";
import { cn } from "@/lib/utils";
import { useLocale } from "@/shared/i18n/locale-provider";

export type InventoryProductPageLeaveGuard = {
  leaveDialogOpen: boolean;
  isConfirmingLeave: boolean;
  leaveReturnFocusRef: RefObject<HTMLElement | null>;
  confirmLeave: () => void | Promise<void>;
  cancelLeave: () => void;
};

export type InventoryProductPageFrameProps = {
  mode: "intake" | "edit";
  surface?: "page" | "dialog";
  title: string;
  mobileTitle?: string;
  subtitle: string;
  mobileSubtitle?: string;
  children: ReactNode;
  error?: string;
  syncStatus?: InventorySyncStatus;
  syncPrivacyRedacted?: boolean;
  syncTargetId?: string;
  onRetrySync?: () => void | Promise<void>;
  onOpenCommitted?: () => void | Promise<void>;
  recoveryMessage?: string;
  conflict?: ReactNode;
  mutationPending?: boolean;
  syncBlocked?: boolean;
  onSubmit?: (event: FormEvent<HTMLFormElement>) => void;
  onBack: (event?: MouseEvent<HTMLButtonElement>) => void;
  leaveGuard?: InventoryProductPageLeaveGuard;
  onContinue?: () => void | Promise<void>;
  continueLabel?: string;
  primaryLabel: string;
  onPrimary?: () => void | Promise<void>;
  primaryDisabled?: boolean;
  secondaryLabel?: string;
  secondaryDisabled?: boolean;
  onSecondary?: () => void | Promise<void>;
};

/**
 * Shared full-page shell for inventory intake/edit adapters.
 *
 * The screen adapters keep their query, mutation, authority and leave-guard
 * state; this component owns only the responsive page composition and action
 * surface so Storybook can exercise the same real page body without a network
 * provider or a fake API.
 */
export function InventoryProductPageFrame({
  mode,
  surface = "page",
  title,
  mobileTitle = title,
  subtitle,
  mobileSubtitle = subtitle,
  children,
  error,
  syncStatus,
  syncPrivacyRedacted = false,
  onRetrySync,
  onOpenCommitted,
  recoveryMessage,
  conflict,
  mutationPending = false,
  syncBlocked = false,
  onSubmit,
  onBack,
  leaveGuard,
  onContinue,
  continueLabel,
  primaryLabel,
  onPrimary,
  primaryDisabled = false,
  secondaryLabel,
  secondaryDisabled = false,
  onSecondary,
}: InventoryProductPageFrameProps) {
  const { t } = useLocale();
  const resolvedContinueLabel = continueLabel ?? t("inventory2b4.quick.frame.saveAndContinue");
  // Providers owns the single application content landmark. This frame is a
  // route body and therefore remains a layout container even for full-page
  // stories; those stories provide their AppShell main explicitly.
  const IntakeRoot = "div";
  const isIntake = mode === "intake";
  const canSubmit = Boolean(onSubmit || onPrimary);
  const submit = (event: FormEvent<HTMLFormElement>) => {
    if (onSubmit) {
      onSubmit(event);
      return;
    }
    event.preventDefault();
    void onPrimary?.();
  };

  return (
    <IntakeRoot
      data-inventory-product-page-frame={mode}
      data-testid="inventory-product-page-frame"
      data-inventory-product-intake-surface={isIntake ? surface : undefined}
      className={cn(
        surface === "page" &&
          cn(
            repairOs.mobileFloatingPage,
            "mx-auto w-full max-w-[430px] px-2 pb-28 pt-[var(--repair-os-mobile-floating-offset,5.25rem)] lg:max-w-4xl lg:px-0 lg:pb-8 lg:pt-0",
          ),
        surface === "dialog" &&
          "flex h-[calc(100svh-16px)] max-h-[calc(100svh-16px)] min-h-0 w-full flex-col overflow-hidden rounded-[var(--radius-lg)] border border-[var(--border-panel)] bg-[var(--surface-workspace-strong)] p-2 shadow-[var(--shadow-overlay)] sm:h-auto sm:max-h-[calc(100svh-32px)] sm:p-3",
      )}
    >
      {surface === "page" ? (
        <>
          <div className={cn(repairOs.mobileFloatingHeaderShell, "lg:static lg:mb-4")}>
            <section className={repairOs.mobileFloatingHeaderCard}>
              <header className={repairOs.mobileFloatingHeaderNav}>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  className="size-11 rounded-lg"
                  aria-label={
                    isIntake
                      ? t("inventory2b4.quick.frame.backInventory")
                      : t("inventory2b4.quick.frame.backDetail")
                  }
                  onClick={onBack}
                >
                  <ArrowLeft className="size-5" />
                </Button>
                <div className="min-w-0 text-center">
                  <h1 className="truncate text-sm font-semibold">{mobileTitle}</h1>
                  <p className="text-[10px] text-muted-foreground lg:text-[11px] lg:leading-4">
                    {mobileSubtitle}
                  </p>
                </div>
                <span className="size-11" aria-hidden />
              </header>
            </section>
          </div>

          <header className="hidden items-center justify-between gap-4 pb-3 lg:flex">
            <div className="min-w-0">
              <h1 className="truncate text-xl font-semibold">{title}</h1>
              <p className="text-sm text-muted-foreground">{subtitle}</p>
            </div>
            {isIntake ? (
              <Button type="button" variant="outline" className="min-h-11" onClick={onBack}>
                <ArrowLeft className="mr-2 size-4" />
                {t("inventory2b4.quick.frame.backInventoryShort")}
              </Button>
            ) : null}
          </header>
        </>
      ) : (
        <header className="mb-2 flex min-w-0 shrink-0 items-center gap-2 rounded-[var(--radius-lg)] border border-[var(--border-panel)] bg-[var(--surface-panel)] p-2 sm:px-3 sm:py-2.5">
          <div className="min-w-0 flex-1">
            <p className="text-[9px] font-medium leading-3 text-muted-foreground sm:text-[10px]">
              {t("inventory2b4.quick.frame.dialogEyebrow")}
            </p>
            <h1 className="truncate text-sm font-semibold leading-5 sm:text-base">{title}</h1>
            <p className="truncate text-[10px] leading-4 text-muted-foreground sm:text-xs">
              {subtitle}
            </p>
          </div>
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="size-11 shrink-0 rounded-lg sm:size-9"
            aria-label={t("inventory2b4.quick.frame.closeDialog")}
            onClick={onBack}
          >
            <X className="size-4" />
          </Button>
        </header>
      )}

      {syncStatus ? (
        <InventorySyncStatusPanel
          status={syncStatus}
          pending={syncStatus === "committed-refreshing"}
          privacyRedacted={syncPrivacyRedacted}
          onRetry={syncStatus === "committed-refresh-failed" ? onRetrySync : undefined}
          onOpenCommitted={syncStatus === "committed-refresh-failed" ? onOpenCommitted : undefined}
        />
      ) : null}

      <form
        className={cn(
          "space-y-1.5",
          surface === "dialog" &&
            "min-h-0 min-w-0 max-w-full flex-1 overflow-x-hidden overflow-y-auto overscroll-contain px-0.5 pb-0.5 scroll-pb-24 sm:max-h-[calc(100svh-9.5rem)] sm:px-1",
        )}
        aria-busy={mutationPending || syncBlocked}
        onSubmit={canSubmit ? submit : undefined}
      >
        <fieldset disabled={syncBlocked} className="contents">
          {children}
        </fieldset>

        {conflict}
        {recoveryMessage ? (
          <p
            role="status"
            aria-live="polite"
            className="rounded-xl bg-status-success px-4 py-3 text-sm text-status-success-foreground"
          >
            {recoveryMessage}
          </p>
        ) : null}
        {error ? (
          <div
            role="alert"
            className="rounded-xl border border-status-danger-foreground/30 bg-status-danger px-4 py-3 text-sm text-status-danger-foreground"
          >
            {error}
          </div>
        ) : null}

        <div
          data-ui="inventory-product-actions"
          className={cn(
            surfaces.stickyActions,
            surface === "page" &&
              "fixed bottom-[calc(env(safe-area-inset-bottom)+0.5rem)] left-1/2 z-30 mx-0 grid w-[calc(100%_-_1rem)] max-w-[414px] -translate-x-1/2 grid-cols-2 gap-1.5 rounded-xl border border-border bg-background/95 px-2 py-2 shadow-[var(--shadow-card)] sm:mx-0 lg:sticky lg:bottom-0 lg:left-auto lg:w-auto lg:max-w-none lg:translate-x-0 lg:px-0 lg:pb-0",
            surface === "dialog" &&
              "sticky bottom-0 z-20 grid grid-cols-2 gap-1.5 rounded-xl border border-border bg-background/95 px-2 py-2 shadow-[var(--shadow-card)]",
          )}
        >
          {isIntake && onContinue ? (
            <Button
              type="button"
              variant="outline"
              className="h-auto min-h-11 whitespace-normal text-center leading-tight"
              disabled={mutationPending || syncBlocked || secondaryDisabled}
              onClick={() => void onContinue()}
            >
              {mutationPending ? <Loader2 className="mr-2 size-4 animate-spin" /> : null}
              {resolvedContinueLabel}
            </Button>
          ) : null}
          {isIntake ? (
            <Button
              type="submit"
              className="h-auto min-h-11 whitespace-normal text-center leading-tight"
              disabled={mutationPending || syncBlocked || primaryDisabled}
            >
              {mutationPending ? <Loader2 className="mr-2 size-4 animate-spin" /> : null}
              {primaryLabel}
            </Button>
          ) : (
            <>
              <Button
                type="button"
                variant="outline"
                className="h-auto min-h-11 whitespace-normal text-center leading-tight"
                disabled={mutationPending || syncBlocked || secondaryDisabled}
                onClick={() => void onSecondary?.()}
              >
                {secondaryLabel ?? t("inventory2b4.quick.frame.cancel")}
              </Button>
              <Button
                type="submit"
                className="h-auto min-h-11 whitespace-normal text-center leading-tight"
                disabled={mutationPending || syncBlocked || primaryDisabled}
              >
                {mutationPending ? <Loader2 className="mr-2 size-4 animate-spin" /> : null}
                {primaryLabel}
              </Button>
            </>
          )}
          {isIntake && surface === "page" ? (
            <Button
              type="button"
              variant="ghost"
              className="col-span-2 min-h-11 text-muted-foreground"
              onClick={onBack}
              disabled={mutationPending}
            >
              {t("inventory2b4.quick.frame.cancelAndBack")}
            </Button>
          ) : null}
        </div>
      </form>

      {leaveGuard ? (
        <InventoryConsequenceDialog
          open={leaveGuard.leaveDialogOpen}
          title={
            isIntake
              ? t("inventory2b4.quick.frame.leaveCreateTitle")
              : t("inventory2b4.quick.frame.leaveEditTitle")
          }
          description={
            isIntake
              ? t("inventory2b4.quick.frame.leaveCreateDescription")
              : t("inventory2b4.quick.frame.leaveEditDescription")
          }
          consequences={
            isIntake
              ? [
                  t("inventory2b4.quick.frame.leaveCreateConsequence"),
                  t("inventory2b4.quick.frame.leaveCreateRecovery"),
                ]
              : [
                  t("inventory2b4.quick.frame.leaveEditConsequence"),
                  t("inventory2b4.quick.frame.leaveEditRecovery"),
                ]
          }
          confirmLabel={t("inventory2b4.quick.frame.leaveConfirm")}
          cancelLabel={
            isIntake
              ? t("inventory2b4.quick.frame.continueCreate")
              : t("inventory2b4.quick.frame.continueEdit")
          }
          tone="warning"
          pending={leaveGuard.isConfirmingLeave}
          onConfirm={leaveGuard.confirmLeave}
          onOpenChange={(open) => {
            if (!open) leaveGuard.cancelLeave();
          }}
          returnFocusRef={leaveGuard.leaveReturnFocusRef}
        />
      ) : null}
    </IntakeRoot>
  );
}
