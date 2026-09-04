"use client";

import Link from "next/link";
import {
  AlertCircle,
  Check,
  CheckCircle2,
  Keyboard,
  KeyRound,
  Mail,
  ShieldCheck,
  Store,
  UserRound,
} from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { Switch } from "@/components/ui/switch";
import { useDesktopVirtualKeyboardPreference } from "@/components/desktop-virtual-keyboard-preference-context";
import { SettingsField } from "@/features/settings/components/settings-field";
import type { AccountSettingsSummary } from "@/features/settings/model/account-settings-summary";
import { brandGradientStyle, repairOs } from "@/lib/ui-patterns";
import { cn } from "@/lib/utils";
import { useLocale } from "@/shared/i18n/locale-provider";
import { RepairOsSectionHeader } from "@/shared/ui";

export interface AccountSettingsSectionProps {
  summary?: AccountSettingsSummary;
  isLoading: boolean;
  nameDraft: string;
  hasNameChange: boolean;
  isSaving: boolean;
  saveError?: string;
  hasSaved?: boolean;
  onNameDraftChange: (value: string) => void;
  onSave: () => void;
}

export function AccountSettingsSection({
  summary,
  isLoading,
  nameDraft,
  hasNameChange,
  isSaving,
  saveError,
  hasSaved = false,
  onNameDraftChange,
  onSave,
}: AccountSettingsSectionProps) {
  const { t } = useLocale();
  const { desktopVirtualKeyboardEnabled, preferenceReady, setDesktopVirtualKeyboardEnabled } =
    useDesktopVirtualKeyboardPreference();
  const normalizedName = nameDraft.trim();
  const nameError = normalizedName ? undefined : t("settings.accountSection.nameRequired");
  const email = summary?.email ?? "";
  const emailState = summary?.emailVerificationState ?? "unknown";

  return (
    <section
      id="settings-account"
      data-settings-account-section
      className={cn(repairOs.adminSection, "space-y-3 p-2.5 sm:p-3")}
    >
      <RepairOsSectionHeader
        icon={UserRound}
        iconFrame={false}
        title={t("settings.accountSection.title")}
      />
      {isLoading ? (
        <AccountSectionSkeleton />
      ) : (
        <>
          <div className="grid min-w-0 gap-3 lg:grid-cols-[minmax(0,1.1fr)_minmax(280px,0.9fr)]">
            <div className="min-w-0 rounded-xl border border-[var(--border-panel)] bg-card p-3">
              <div className="grid gap-2 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-end">
                <SettingsField
                  label={t("settings.accountSection.displayName")}
                  htmlFor="account-display-name"
                  icon={UserRound}
                  error={nameError}
                >
                  <Input
                    id="account-display-name"
                    className="h-10 text-sm"
                    value={nameDraft}
                    maxLength={60}
                    autoComplete="name"
                    placeholder={t("settings.accountSection.namePlaceholder")}
                    disabled={isSaving}
                    aria-invalid={Boolean(nameError)}
                    aria-describedby={nameError ? "account-display-name-error" : undefined}
                    onChange={(event) => onNameDraftChange(event.target.value)}
                    onKeyDown={(event) => {
                      if (event.key === "Enter") {
                        event.preventDefault();
                        if (!nameError) onSave();
                      }
                    }}
                  />
                </SettingsField>
                <Button
                  type="button"
                  className="min-h-10 gap-1.5"
                  style={brandGradientStyle}
                  disabled={!hasNameChange || isSaving || Boolean(nameError)}
                  aria-busy={isSaving}
                  onClick={onSave}
                >
                  <Check className="size-3.5" />
                  {isSaving
                    ? t("settings.accountSection.saving")
                    : t("settings.accountSection.saveName")}
                </Button>
              </div>
              <p className="mt-2 text-[11px] leading-4 text-muted-foreground lg:text-xs lg:leading-4">
                {t("settings.accountSection.nameHint")}
              </p>
              {saveError ? (
                <div
                  role="alert"
                  className="mt-2 rounded-lg border border-status-danger-foreground/25 bg-status-danger/10 px-3 py-2 text-[11px] leading-4 text-status-danger-foreground lg:text-xs lg:leading-[18px]"
                >
                  {t("settings.accountSection.saveError")}
                </div>
              ) : hasSaved ? (
                <p
                  role="status"
                  aria-live="polite"
                  className="mt-2 text-[11px] font-medium text-status-success-foreground lg:text-xs lg:leading-4"
                >
                  {t("settings.accountSection.saved")}
                </p>
              ) : hasNameChange ? (
                <p
                  role="status"
                  className="mt-2 text-[11px] font-medium text-primary lg:text-xs lg:leading-4"
                >
                  {t("settings.accountSection.unsaved")}
                </p>
              ) : null}
            </div>

            <div className="grid min-w-0 gap-2 sm:grid-cols-3 lg:grid-cols-1">
              <AccountSummaryTile
                icon={ShieldCheck}
                label={t("settings.accountSection.nature")}
                value={summary?.accountNature ?? t("settings.accountSection.natureUnavailable")}
                hint={t("settings.accountSection.natureHint")}
              />
              <AccountSummaryTile
                icon={Store}
                label={t("settings.accountSection.currentRole")}
                value={summary?.currentStoreRole ?? t("settings.accountSection.roleUnavailable")}
                hint={summary?.activeStoreName ?? t("settings.account.noStore")}
              />
              <AccountSummaryTile
                icon={Mail}
                label={t("settings.accountSection.loginEmail")}
                value={email || t("settings.accountSection.emailUnavailable")}
                hint={
                  emailState === "verified"
                    ? t("settings.accountSection.emailVerifiedHint")
                    : emailState === "unverified"
                      ? t("settings.accountSection.emailUnverifiedHint")
                      : t("settings.accountSection.emailStatusUnavailable")
                }
                status={emailState}
              />
            </div>
          </div>

          <div className="flex min-w-0 flex-col gap-3 rounded-xl border border-[var(--border-panel)] bg-[var(--surface-panel-muted)] px-3 py-3 sm:flex-row sm:items-center sm:justify-between">
            <div className="min-w-0">
              <div className="flex min-w-0 items-center gap-2">
                <Keyboard className="size-4 shrink-0 text-primary" />
                <Label htmlFor="desktop-virtual-keyboard" className="text-xs font-semibold">
                  {t("settings.accountSection.desktopKeyboard")}
                </Label>
              </div>
              <p className="mt-1 text-[11px] leading-4 text-muted-foreground lg:text-xs lg:leading-4">
                {t("settings.accountSection.desktopKeyboardHint")}
              </p>
              <p
                role="status"
                aria-live="polite"
                className="mt-1 text-[10px] leading-3 text-muted-foreground lg:text-[11px] lg:leading-4"
              >
                {!preferenceReady
                  ? t("settings.accountSection.preferenceLoading")
                  : desktopVirtualKeyboardEnabled
                    ? t("settings.accountSection.preferenceEnabled")
                    : t("settings.accountSection.preferenceDisabled")}
              </p>
            </div>
            <Switch
              id="desktop-virtual-keyboard"
              checked={desktopVirtualKeyboardEnabled}
              disabled={!preferenceReady}
              onCheckedChange={setDesktopVirtualKeyboardEnabled}
            />
          </div>
          <p className="text-[10px] leading-3 text-muted-foreground lg:text-[11px] lg:leading-4">
            {t("settings.accountSection.preferenceScope")}
          </p>

          <div className="flex min-w-0 flex-col gap-3 rounded-xl border border-[var(--border-panel)] bg-[var(--surface-panel-muted)] px-3 py-3 sm:flex-row sm:items-center sm:justify-between">
            <div className="min-w-0">
              <p className="text-xs font-semibold">{t("settings.accountSection.securityTitle")}</p>
              <p className="mt-1 text-[11px] leading-4 text-muted-foreground lg:text-xs lg:leading-4">
                {t("settings.accountSection.securityDescription")}
              </p>
            </div>
            <Button
              asChild
              variant="outline"
              size="sm"
              className="min-h-10 w-full shrink-0 gap-1.5 sm:min-h-9 sm:w-auto"
            >
              <Link href="/account">
                <KeyRound className="size-3.5" />
                {t("settings.accountSection.openAccount")}
              </Link>
            </Button>
          </div>
        </>
      )}
    </section>
  );
}

function AccountSummaryTile({
  icon: Icon,
  label,
  value,
  hint,
  status,
}: {
  icon: typeof UserRound;
  label: string;
  value: string;
  hint: string;
  status?: "verified" | "unverified" | "unknown";
}) {
  const { t } = useLocale();
  return (
    <div className="min-w-0 rounded-xl border border-[var(--border-panel)] bg-[var(--surface-panel-muted)] px-3 py-2.5">
      <div className="flex min-w-0 items-center justify-between gap-2">
        <span className="inline-flex min-w-0 items-center gap-1.5 text-[10px] font-medium text-muted-foreground lg:text-[11px] lg:leading-4">
          <Icon className="size-3.5 shrink-0" />
          <span className="truncate">{label}</span>
        </span>
        {status ? (
          <Badge
            variant="outline"
            className={cn(
              "h-5 shrink-0 gap-1 px-1.5 text-[9px] lg:text-[11px] lg:leading-4",
              status === "verified" &&
                "border-status-success-foreground/30 text-status-success-foreground",
              status === "unverified" &&
                "border-status-warn-foreground/30 text-status-warn-foreground",
            )}
          >
            {status === "verified" ? (
              <CheckCircle2 className="size-3" />
            ) : (
              <AlertCircle className="size-3" />
            )}
            {status === "verified"
              ? t("settings.accountSection.verified")
              : status === "unverified"
                ? t("settings.accountSection.unverified")
                : t("settings.accountSection.unknown")}
          </Badge>
        ) : null}
      </div>
      <p className="mt-1 break-words text-xs font-semibold leading-4">{value}</p>
      <p className="mt-1 break-words text-[10px] leading-3 text-muted-foreground lg:text-[11px] lg:leading-4">
        {hint}
      </p>
    </div>
  );
}

function AccountSectionSkeleton() {
  return (
    <div data-ui="settings-account-loading" className="grid gap-3 lg:grid-cols-2">
      <Skeleton className="h-32 w-full rounded-xl" />
      <Skeleton className="h-32 w-full rounded-xl" />
    </div>
  );
}
