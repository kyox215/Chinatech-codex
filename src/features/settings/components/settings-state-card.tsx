import { AlertTriangle, GitCompareArrows, RotateCcw } from "lucide-react";

import { Button } from "@/components/ui/button";
import type { SettingsSaveStatus } from "./settings-save-bar";

export interface SettingsStateCardProps {
  status: SettingsSaveStatus;
  fieldErrors?: Record<string, string[]>;
  onDiscard: () => void;
  onRebase: () => void;
}

export function SettingsStateCard({
  status,
  fieldErrors = {},
  onDiscard,
  onRebase,
}: SettingsStateCardProps) {
  if (!["validation-error", "conflict", "offline", "error"].includes(status)) return null;
  const validationMessages = Object.values(fieldErrors).flat();
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
          <h2 className="text-sm font-semibold">{stateTitle(status)}</h2>
          <p className="mt-1 text-xs leading-5">{stateDescription(status)}</p>
          {validationMessages.length > 0 ? (
            <ul className="mt-2 list-disc space-y-1 pl-4 text-xs">
              {validationMessages.map((message, index) => (
                <li key={`${message}-${index}`}>{message}</li>
              ))}
            </ul>
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
                <RotateCcw className="size-3.5" /> 使用服务器版本
              </Button>
              <Button type="button" size="sm" className="min-h-11 sm:min-h-8" onClick={onRebase}>
                <GitCompareArrows className="size-3.5" /> 基于最新版继续编辑
              </Button>
            </div>
          ) : null}
        </div>
      </div>
    </section>
  );
}

function stateTitle(status: SettingsSaveStatus) {
  if (status === "validation-error") return "部分内容需要修正";
  if (status === "conflict") return "检测到设置版本冲突";
  if (status === "offline") return "当前无法连接服务器";
  return "设置保存失败";
}

function stateDescription(status: SettingsSaveStatus) {
  if (status === "validation-error") return "服务器没有写入任何内容，本地输入仍完整保留。";
  if (status === "conflict") {
    return "服务器版本和本地草稿都已保留。请使用服务器版本，或在确认当前输入后重建基线再手动保存；系统不会强制覆盖。";
  }
  if (status === "offline") return "请恢复网络后重试；本阶段不会把草稿写入浏览器持久存储。";
  return "没有写入设置。您可以检查网络或稍后重试。";
}
