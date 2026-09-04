import { Loader2, RotateCcw, Save } from "lucide-react";

import { Button } from "@/components/ui/button";
import { repairOs } from "@/lib/ui-patterns";
import { useLocale } from "@/shared/i18n/locale-provider";
import type { MessageKey } from "@/shared/i18n/messages";

export type SettingsSaveStatus =
  | "clean"
  | "dirty"
  | "saving"
  | "saved"
  | "validation-error"
  | "conflict"
  | "offline"
  | "error";

export interface SettingsSaveBarProps {
  label: string;
  status: SettingsSaveStatus;
  dirty: boolean;
  disabled?: boolean;
  onSave: () => void;
  onDiscard: () => void;
}

export function SettingsSaveBar({
  label,
  status,
  dirty,
  disabled = false,
  onSave,
  onDiscard,
}: SettingsSaveBarProps) {
  const { t } = useLocale();
  if (status !== "dirty" && status !== "saving") return null;

  const saving = status === "saving";
  return (
    <div
      data-settings-save-bar
      data-save-status={status}
      tabIndex={-1}
      className={repairOs.adminSection}
      role="status"
      aria-live="polite"
      aria-busy={saving}
    >
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <div className="min-w-0">
          <p className="truncate text-xs font-medium text-foreground">{label}</p>
          <p className="flex items-center gap-1.5 text-[11px] leading-4 text-muted-foreground lg:text-xs lg:leading-4">
            {status === "saving" ? <Loader2 className="size-3 animate-spin" /> : null}
            {t(settingsSaveStatusKey(status))}
          </p>
        </div>
        <div className="flex min-w-0 gap-2">
          <Button
            type="button"
            size="sm"
            variant="outline"
            className="min-h-11 flex-1 gap-1.5 sm:min-h-8 sm:flex-none"
            disabled={!dirty || saving || disabled}
            onClick={onDiscard}
          >
            <RotateCcw className="size-3.5" /> {t("settings.save.discard")}
          </Button>
          <Button
            type="button"
            size="sm"
            className="min-h-11 flex-1 gap-1.5 sm:min-h-8 sm:flex-none"
            disabled={!dirty || saving || disabled}
            onClick={onSave}
          >
            {saving ? <Loader2 className="size-3.5 animate-spin" /> : <Save className="size-3.5" />}
            {saving ? t("settings.save.saving") : t("settings.save.submit")}
          </Button>
        </div>
      </div>
    </div>
  );
}

function settingsSaveStatusKey(status: SettingsSaveStatus): MessageKey {
  if (status === "clean") return "settings.save.status.clean";
  if (status === "dirty") return "settings.save.status.dirty";
  if (status === "saving") return "settings.save.status.saving";
  if (status === "saved") return "settings.save.status.saved";
  if (status === "validation-error") return "settings.save.status.validation";
  if (status === "conflict") return "settings.save.status.conflict";
  if (status === "offline") return "settings.save.status.offline";
  return "settings.save.status.error";
}
