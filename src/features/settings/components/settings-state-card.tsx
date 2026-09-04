import { AlertTriangle, GitCompareArrows, RotateCcw } from "lucide-react";

import { Button } from "@/components/ui/button";
import { useLocale } from "@/shared/i18n/locale-provider";
import type { MessageKey } from "@/shared/i18n/messages";
import type { SettingsSaveStatus } from "./settings-save-bar";

export interface SettingsStateCardProps {
  status: SettingsSaveStatus;
  fieldErrors?: Record<string, string[]>;
  onDiscard: () => void;
  onRetry: () => void;
  onRebase: () => void;
}

export function SettingsStateCard({
  status,
  fieldErrors = {},
  onDiscard,
  onRetry,
  onRebase,
}: SettingsStateCardProps) {
  const { t } = useLocale();
  if (!["validation-error", "conflict", "offline", "error"].includes(status)) return null;
  const validationCount = Object.values(fieldErrors).flat().length;
  return (
    <section
      data-settings-save-state
      data-save-status={status}
      tabIndex={-1}
      role="alert"
      className="rounded-xl border border-status-warn-foreground/25 bg-status-warn/10 px-3 py-3 text-status-warn-foreground shadow-[var(--shadow-card)]"
    >
      <div className="flex items-start gap-2.5">
        <AlertTriangle className="mt-0.5 size-4 shrink-0" />
        <div className="min-w-0 flex-1">
          <h2 className="text-sm font-semibold">{t(stateTitleKey(status))}</h2>
          <p className="mt-1 text-xs leading-5">{t(stateDescriptionKey(status))}</p>
          {validationCount > 0 ? (
            <p className="mt-2 text-xs">
              {t("settings.state.validationSummary", { count: validationCount })}
            </p>
          ) : null}
          {status === "conflict" ? (
            <div className="mt-3 flex flex-col gap-2 sm:flex-row">
              <Button
                type="button"
                size="sm"
                variant="outline"
                className="min-h-11 sm:min-h-8"
                onClick={onDiscard}
              >
                <RotateCcw className="size-3.5" /> {t("settings.state.useServer")}
              </Button>
              <Button type="button" size="sm" className="min-h-11 sm:min-h-8" onClick={onRebase}>
                <GitCompareArrows className="size-3.5" /> {t("settings.state.continueLatest")}
              </Button>
            </div>
          ) : null}
          {status !== "conflict" ? (
            <div className="mt-3 flex flex-col gap-2 sm:flex-row">
              <Button
                type="button"
                size="sm"
                variant="outline"
                className="min-h-11 sm:min-h-8"
                onClick={onDiscard}
              >
                <RotateCcw className="size-3.5" /> {t("settings.save.discard")}
              </Button>
              <Button type="button" size="sm" className="min-h-11 sm:min-h-8" onClick={onRetry}>
                <GitCompareArrows className="size-3.5" /> {t("settings.state.retry")}
              </Button>
            </div>
          ) : null}
        </div>
      </div>
    </section>
  );
}

function stateTitleKey(status: SettingsSaveStatus): MessageKey {
  if (status === "validation-error") return "settings.state.validationTitle";
  if (status === "conflict") return "settings.state.conflictTitle";
  if (status === "offline") return "settings.state.offlineTitle";
  return "settings.state.errorTitle";
}

function stateDescriptionKey(status: SettingsSaveStatus): MessageKey {
  if (status === "validation-error") return "settings.state.validationDescription";
  if (status === "conflict") return "settings.state.conflictDescription";
  if (status === "offline") return "settings.state.offlineDescription";
  return "settings.state.errorDescription";
}
