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
  const { desktopVirtualKeyboardEnabled, preferenceReady, setDesktopVirtualKeyboardEnabled } =
    useDesktopVirtualKeyboardPreference();
  const normalizedName = nameDraft.trim();
  const nameError = normalizedName ? undefined : "显示名称不能为空";
  const email = summary?.email ?? "";
  const emailState = summary?.emailVerificationState ?? "unknown";

  return (
    <section
      id="settings-account"
      data-settings-account-section
      className={cn(repairOs.adminSection, "space-y-3 p-2.5 sm:p-3")}
    >
      <RepairOsSectionHeader icon={UserRound} iconFrame={false} title="我的账号" />
      {isLoading ? (
        <AccountSectionSkeleton />
      ) : (
        <>
          <div className="grid min-w-0 gap-3 lg:grid-cols-[minmax(0,1.1fr)_minmax(280px,0.9fr)]">
            <div className="min-w-0 rounded-xl border border-[var(--border-panel)] bg-card p-3">
              <div className="grid gap-2 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-end">
                <SettingsField
                  label="显示名称"
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
                    placeholder="输入自己的名字"
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
                  {isSaving ? "保存中…" : "保存名称"}
                </Button>
              </div>
              <p className="mt-2 text-[11px] leading-4 text-muted-foreground">
                名称只修改当前登录账号，会用于新建工单、操作记录和成员列表。
              </p>
              {saveError ? (
                <div
                  role="alert"
                  className="mt-2 rounded-lg border border-status-danger-foreground/25 bg-status-danger/10 px-3 py-2 text-[11px] leading-4 text-status-danger-foreground"
                >
                  名称保存失败：{saveError}。草稿仍保留，可再次点击“保存名称”重试。
                </div>
              ) : hasSaved ? (
                <p
                  role="status"
                  aria-live="polite"
                  className="mt-2 text-[11px] font-medium text-status-success-foreground"
                >
                  名称已保存
                </p>
              ) : hasNameChange ? (
                <p role="status" className="mt-2 text-[11px] font-medium text-primary">
                  名称有未保存修改
                </p>
              ) : null}
            </div>

            <div className="grid min-w-0 gap-2 sm:grid-cols-3 lg:grid-cols-1">
              <AccountSummaryTile
                icon={ShieldCheck}
                label="账号性质"
                value={summary?.accountNature ?? "未读取账号性质"}
                hint="账号级身份，不在设置中变更"
              />
              <AccountSummaryTile
                icon={Store}
                label="当前店铺角色"
                value={summary?.currentStoreRole ?? "未读取店铺角色"}
                hint={summary?.activeStoreName ?? "尚未选择店铺"}
              />
              <AccountSummaryTile
                icon={Mail}
                label="登录邮箱"
                value={email || "未读取邮箱"}
                hint={
                  emailState === "verified"
                    ? "邮箱已验证"
                    : emailState === "unverified"
                      ? "邮箱尚未验证"
                      : "验证状态不可用"
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
                  桌面端显示虚拟键盘
                </Label>
              </div>
              <p className="mt-1 text-[11px] leading-4 text-muted-foreground">
                关闭时，电脑使用普通输入框；iPad 和手机始终保留触摸键盘。
              </p>
              <p
                role="status"
                aria-live="polite"
                className="mt-1 text-[10px] leading-3 text-muted-foreground"
              >
                {!preferenceReady
                  ? "正在读取当前账号的浏览器偏好…"
                  : desktopVirtualKeyboardEnabled
                    ? "当前电脑端会显示虚拟键盘。"
                    : "当前电脑端会使用普通输入框。"}
              </p>
            </div>
            <Switch
              id="desktop-virtual-keyboard"
              checked={desktopVirtualKeyboardEnabled}
              disabled={!preferenceReady}
              onCheckedChange={setDesktopVirtualKeyboardEnabled}
            />
          </div>
          <p className="text-[10px] leading-3 text-muted-foreground">
            此偏好只保存在当前账号的此浏览器，不影响店铺设置或其他账号。
          </p>

          <div className="flex min-w-0 flex-col gap-3 rounded-xl border border-[var(--border-panel)] bg-[var(--surface-panel-muted)] px-3 py-3 sm:flex-row sm:items-center sm:justify-between">
            <div className="min-w-0">
              <p className="text-xs font-semibold">账号安全与联系方式</p>
              <p className="mt-1 text-[11px] leading-4 text-muted-foreground">
                邮箱验证、邮箱换绑、联系手机号和密码修改统一在个人中心完成，设置页不复制登录安全流程。
              </p>
            </div>
            <Button
              asChild
              variant="outline"
              size="sm"
              className="min-h-11 w-full shrink-0 gap-1.5 sm:min-h-9 sm:w-auto"
            >
              <Link href="/account">
                <KeyRound className="size-3.5" />
                打开个人中心
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
  return (
    <div className="min-w-0 rounded-xl border border-[var(--border-panel)] bg-[var(--surface-panel-muted)] px-3 py-2.5">
      <div className="flex min-w-0 items-center justify-between gap-2">
        <span className="inline-flex min-w-0 items-center gap-1.5 text-[10px] font-medium text-muted-foreground">
          <Icon className="size-3.5 shrink-0" />
          <span className="truncate">{label}</span>
        </span>
        {status ? (
          <Badge
            variant="outline"
            className={cn(
              "h-5 shrink-0 gap-1 px-1.5 text-[9px]",
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
            {status === "verified" ? "已验证" : status === "unverified" ? "未验证" : "未知"}
          </Badge>
        ) : null}
      </div>
      <p className="mt-1 break-words text-xs font-semibold leading-4">{value}</p>
      <p className="mt-1 break-words text-[10px] leading-3 text-muted-foreground">{hint}</p>
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
