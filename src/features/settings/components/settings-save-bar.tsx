import { Loader2, RotateCcw, Save } from "lucide-react";

import { Button } from "@/components/ui/button";
import { repairOs } from "@/lib/ui-patterns";

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
            {settingsSaveStatusLabel(status)}
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
            <RotateCcw className="size-3.5" /> 放弃修改
          </Button>
          <Button
            type="button"
            size="sm"
            className="min-h-11 flex-1 gap-1.5 sm:min-h-8 sm:flex-none"
            disabled={!dirty || saving || disabled}
            onClick={onSave}
          >
            {saving ? <Loader2 className="size-3.5 animate-spin" /> : <Save className="size-3.5" />}
            {saving ? "保存中" : "保存设置"}
          </Button>
        </div>
      </div>
    </div>
  );
}

function settingsSaveStatusLabel(status: SettingsSaveStatus) {
  if (status === "clean") return "当前分组没有未保存修改。";
  if (status === "dirty") return "当前分组有未保存修改。";
  if (status === "saving") return "正在保存当前分组，请稍候。";
  if (status === "saved") return "当前分组已保存。";
  if (status === "validation-error") return "请修正标记字段后重试。";
  if (status === "conflict") return "服务器已有新版本，请先处理冲突。";
  if (status === "offline") return "当前离线，本地输入仍保留。";
  return "保存失败，本地输入仍保留。";
}
