"use client";

import { CheckCircle2, Eye, Loader2, ShieldAlert } from "lucide-react";

import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

import type { InventoryReadFreshnessResolution } from "../model/inventory-read-freshness";

export type InventoryReadFreshnessPanelProps = {
  freshness: InventoryReadFreshnessResolution;
  onVerify?: () => void | Promise<void>;
  className?: string;
};

const copy = {
  stale: {
    title: "资料需要只读刷新",
    description: "当前画面显示的是本机最后一次成功读取的资料，写入动作已锁定。",
    role: "alert" as const,
  },
  verifying: {
    title: "正在读取最新状态",
    description: "正在只读刷新；不会调用写入操作，也不会轮换写入标识。",
    role: "status" as const,
  },
  "verify-failed": {
    title: "最新状态读取失败",
    description: "资料仍保持只读，写入动作继续锁定；请稍后再次只读刷新。",
    role: "alert" as const,
  },
  recovered: {
    title: "最新状态已读取",
    description: "写入动作已恢复可用；恢复只来自成功读回，不会自动重放写入。",
    role: "status" as const,
  },
  "privacy-redacted": {
    title: "资料已裁剪，写入保持锁定",
    description: "为保护隐私，当前只显示保守的只读状态，不显示业务标识或原始详情。",
    role: "alert" as const,
  },
} as const;

function localReadCopy(lastSuccessAt?: number, redacted?: boolean) {
  if (redacted) return "本机最后成功读取时间已隐藏。";
  if (!lastSuccessAt) return "本机最后成功读取时间暂不可用；不会使用服务端时间代替。";
  return `本机最后成功读取：${new Intl.DateTimeFormat("zh-CN", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(lastSuccessAt)}`;
}

export function InventoryReadFreshnessPanel({
  freshness,
  onVerify,
  className,
}: InventoryReadFreshnessPanelProps) {
  if (freshness.hidden || freshness.state === "fresh") return null;
  const stateCopy = copy[freshness.state];
  const verifying = freshness.state === "verifying";
  const redacted = freshness.state === "privacy-redacted";

  return (
    <section
      data-ui="inventory-read-freshness-panel"
      data-read-freshness-state={freshness.state}
      role={stateCopy.role}
      aria-live={stateCopy.role === "alert" ? "assertive" : "polite"}
      aria-busy={verifying}
      className={cn(
        "grid min-w-0 gap-2 rounded-xl border p-3 text-foreground sm:p-4",
        stateCopy.role === "alert"
          ? "border-status-warn/40 bg-status-warn/10"
          : freshness.state === "recovered"
            ? "border-status-success/40 bg-status-success/10"
            : "border-primary/30 bg-primary/5",
        className,
      )}
    >
      <div className="flex min-w-0 items-start gap-2">
        <span
          aria-hidden="true"
          className="grid size-9 shrink-0 place-items-center rounded-lg bg-background/80"
        >
          {verifying ? (
            <Loader2 className="size-4 animate-spin text-primary" />
          ) : freshness.state === "recovered" ? (
            <CheckCircle2 className="size-4 text-status-success-foreground" />
          ) : (
            <ShieldAlert className="size-4 text-status-warn-foreground" />
          )}
        </span>
        <div className="min-w-0">
          <h2 className="text-sm font-semibold">{stateCopy.title}</h2>
          <p className="mt-1 text-xs leading-5 text-foreground">{stateCopy.description}</p>
        </div>
      </div>
      <p className="text-xs leading-5 text-muted-foreground">
        {localReadCopy(freshness.lastSuccessAt, redacted)}
      </p>
      {!redacted && freshness.state !== "recovered" ? (
        <p className="text-xs leading-5 text-muted-foreground">
          只读刷新成功且返回最新资料后，写入动作才会恢复；此处不会自动提交任何命令。
        </p>
      ) : null}
      {freshness.state === "recovered" ? (
        <p role="status" aria-live="polite" className="text-xs leading-5 text-muted-foreground">
          已完成只读核对；没有自动重放写入。
        </p>
      ) : null}
      {!redacted && onVerify ? (
        <Button
          type="button"
          variant="outline"
          className="min-h-11 w-full gap-2 sm:w-fit"
          disabled={verifying}
          onClick={() => void onVerify()}
        >
          <Eye className="size-4" aria-hidden="true" />
          {verifying ? "正在读取最新状态…" : "只读刷新最新状态"}
        </Button>
      ) : null}
    </section>
  );
}
