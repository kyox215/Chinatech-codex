"use client";

import Link from "next/link";
import { AlertTriangle, CheckCircle2, RefreshCw, ShieldCheck, type LucideIcon } from "lucide-react";

import { Button } from "@/components/ui/button";
import type { StoreLifecycleActionCapability, StoreLifecycleBlocker } from "@/lib/repairdesk/types";
import { cn } from "@/lib/utils";
import { useLocale } from "@/shared/i18n/locale-provider";
import { translateSettingsOperations } from "@/shared/i18n/messages";
import type { AppLocale } from "@/shared/i18n/locales";

export function StoreCloseBlockerList({ blockers }: { blockers: StoreLifecycleBlocker[] }) {
  const { locale } = useLocale();
  const copy = (source: Parameters<typeof translateSettingsOperations>[1]) =>
    translateSettingsOperations(locale, source);
  const blockersPresentation: Record<
    StoreLifecycleBlocker["code"],
    { label: Parameters<typeof translateSettingsOperations>[1]; href?: string }
  > = {
    open_orders: { label: "仍有未完成的维修工单", href: "/orders" },
    unsettled_balance: { label: "仍有客户欠款", href: "/customers" },
    device_in_custody: { label: "仍有客户设备留在店里", href: "/orders" },
    pending_offline_writes: { label: "仍有尚未同步的离线修改" },
    open_kiosk_sessions: { label: "仍有客户 iPad 会话" },
    pending_invitations: { label: "仍有待处理邀请" },
    retention_hold: { label: "资料仍在法定保留期" },
    legal_hold: { label: "资料存在法律保留要求" },
    storage_manifest_unavailable: { label: "资料清单还没有检查完整" },
  };
  return (
    <ul className="space-y-2">
      {blockers.map((blocker) => {
        const item = blockersPresentation[blocker.code];
        return (
          <li
            key={blocker.code}
            className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-[var(--border-panel)] bg-card px-3 py-2 text-sm"
          >
            <span>
              {copy(item.label)}
              {blocker.count !== undefined ? `：${blocker.count}` : ""}
              {blocker.amount !== undefined ? `（€${blocker.amount.toFixed(2)}）` : ""}
            </span>
            {item.href ? (
              <Button asChild type="button" variant="outline" size="sm">
                <Link href={item.href}>{copy("去处理")}</Link>
              </Button>
            ) : null}
          </li>
        );
      })}
    </ul>
  );
}

export function LifecycleUnavailable({
  capability,
}: {
  capability: StoreLifecycleActionCapability;
}) {
  const { locale } = useLocale();
  const copy = (source: Parameters<typeof translateSettingsOperations>[1]) =>
    translateSettingsOperations(locale, source);
  const capabilityPresentation: Record<
    Exclude<StoreLifecycleActionCapability["code"], "available">,
    Parameters<typeof translateSettingsOperations>[1]
  > = {
    feature_disabled: "关闭功能正在准备中，目前只能查看店铺资料。",
    store_context_required: "请先明确选择要管理的店铺。",
    primary_owner_required: "只有系统登记的店铺主账号可以关闭店铺。",
    mfa_required: "请先在账号设置中启用身份验证器。",
    migration_unavailable: "店铺保护尚未安装完成，当前不能关闭。",
    enforcement_unhealthy: "店铺写入保护尚未启用，当前不能关闭。",
    store_unavailable: "当前店铺状态不允许关闭。",
  };
  if (capability.code === "available") return null;
  return (
    <div
      role="status"
      className="rounded-xl border border-[var(--border-panel)] bg-[var(--surface-panel-muted)] px-3 py-3 text-sm leading-5 text-muted-foreground"
    >
      {copy(capabilityPresentation[capability.code])}
    </div>
  );
}

export function PersistentCloseResult({
  state,
  error: _error,
  onCheckAgain,
}: {
  state: "reconciling" | "success" | "unknown";
  error: string;
  onCheckAgain: () => void;
}) {
  const { locale } = useLocale();
  const copy = (source: Parameters<typeof translateSettingsOperations>[1]) =>
    translateSettingsOperations(locale, source);
  if (state === "success") {
    return (
      <StepCard
        icon={CheckCircle2}
        tone="success"
        title={copy("店铺已进入关闭流程")}
        description={copy("资料仍然保留，可以在“已关闭与删除”中恢复或申请永久删除。")}
      >
        <Button asChild type="button">
          <Link href="/settings/closed-stores">{copy("查看已关闭与删除")}</Link>
        </Button>
      </StepCard>
    );
  }
  if (state === "reconciling") {
    return (
      <StepCard
        icon={RefreshCw}
        iconClassName="animate-spin"
        title={copy("正在确认关闭结果")}
        description={copy("网络响应不确定，系统只会核对刚才同一个操作，不会再次关闭。")}
      />
    );
  }
  return (
    <StepCard
      icon={AlertTriangle}
      tone="warn"
      title={copy("暂时无法确认关闭结果")}
      description={copy("暂时无法确认结果。请稍后刷新“已关闭店铺”，不要重复提交关闭请求。")}
    >
      <Button type="button" variant="outline" onClick={onCheckAgain}>
        {copy("核对原操作")}
      </Button>
      <Button asChild type="button" variant="ghost">
        <Link href="/settings/closed-stores">{copy("查看已关闭与删除")}</Link>
      </Button>
    </StepCard>
  );
}

export function StepCard({
  icon: Icon,
  iconClassName,
  title,
  description,
  tone = "neutral",
  children,
}: {
  icon: LucideIcon;
  iconClassName?: string;
  title: string;
  description: string;
  tone?: "neutral" | "success" | "warn" | "danger";
  children?: React.ReactNode;
}) {
  return (
    <section
      role="status"
      aria-live="polite"
      className={cn(
        "space-y-3 rounded-xl border p-3",
        tone === "success" && "border-status-success-foreground/25 bg-status-success/10",
        tone === "warn" && "border-status-warn-foreground/25 bg-status-warn/10",
        tone === "danger" && "border-status-danger-foreground/25 bg-status-danger/10",
        tone === "neutral" && "border-[var(--border-panel)] bg-[var(--surface-panel-muted)]",
      )}
    >
      <div className="flex items-start gap-2.5">
        <Icon className={cn("mt-0.5 size-4 shrink-0", iconClassName)} aria-hidden="true" />
        <div className="min-w-0">
          <h3 className="text-sm font-semibold">{title}</h3>
          <p className="mt-1 text-xs leading-5 text-muted-foreground">{description}</p>
        </div>
      </div>
      {children ? <div className="space-y-3">{children}</div> : null}
    </section>
  );
}

export function getStoreIdSuffix(storeId: string) {
  return storeId.replaceAll("-", "").slice(-8).toLowerCase();
}

export function formatRemaining(milliseconds: number, locale: AppLocale = "zh-CN") {
  const minutes = Math.max(1, Math.ceil(milliseconds / 60_000));
  return minutes <= 1
    ? translateSettingsOperations(locale, "不到 1 分钟")
    : translateSettingsOperations(locale, "约 {minutes} 分钟", { minutes });
}
