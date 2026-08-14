"use client";

import { CircleAlert, EyeOff, Loader2, LockKeyhole, PowerOff, RefreshCw } from "lucide-react";

import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

import type { InventoryAvailabilityResolution } from "../model/inventory-availability";

export type InventoryAvailabilityStateCardProps = {
  availability: InventoryAvailabilityResolution;
  onRetry?: () => void | Promise<void>;
  onBack?: () => void;
  className?: string;
};

const copy = {
  loading: {
    title: "正在读取生命周期资料",
    body: "正在准备安全的只读页面；尚未显示业务记录，也不会猜测写入动作。",
    role: "status" as const,
  },
  "no-permission": {
    title: "当前账号没有访问权限",
    body: "为保护门店资料，当前页面不显示商品、金额、客户或记录标识。",
    role: "alert" as const,
  },
  "feature-off": {
    title: "生命周期工作流未启用",
    body: "当前门店未开启此工作流；现有库存浏览保持不变。",
    role: "status" as const,
  },
  "not-found-or-hidden": {
    title: "记录不存在或当前不可访问",
    body: "没有显示记录详情，也没有执行任何写入。请返回库存或联系有权限的同事核对。",
    role: "alert" as const,
  },
  "service-unavailable": {
    title: "暂时无法读取生命周期资料",
    body: "服务暂时不可用；没有执行写入。可以只读重试，成功后再继续。",
    role: "alert" as const,
  },
  retrying: {
    title: "正在只读重试",
    body: "正在读取最新资料，不会调用生命周期写入命令。",
    role: "status" as const,
  },
} as const;

export function InventoryAvailabilityStateCard({
  availability,
  onRetry,
  onBack,
  className,
}: InventoryAvailabilityStateCardProps) {
  if (availability.state === "available") return null;
  const stateCopy = copy[availability.state];
  const isLoading = availability.state === "loading";
  const isRetrying = availability.state === "retrying";
  const Icon =
    isLoading || isRetrying
      ? Loader2
      : availability.state === "no-permission"
        ? LockKeyhole
        : availability.state === "feature-off"
          ? PowerOff
          : availability.state === "not-found-or-hidden"
            ? EyeOff
            : CircleAlert;

  return (
    <section
      data-ui="inventory-availability-state-card"
      data-availability-state={availability.state}
      role={stateCopy.role}
      aria-live={stateCopy.role === "alert" ? "assertive" : "polite"}
      aria-busy={isLoading || isRetrying}
      className={cn("grid min-w-0 gap-3 rounded-xl border p-4", className)}
    >
      {isLoading || isRetrying ? (
        <div aria-hidden="true" className="grid gap-2">
          <div className="h-4 w-2/3 animate-pulse rounded bg-muted" />
          <div className="h-3 w-full animate-pulse rounded bg-muted" />
          <div className="h-3 w-4/5 animate-pulse rounded bg-muted" />
        </div>
      ) : null}
      <div className="flex min-w-0 items-start gap-2.5">
        <span
          aria-hidden="true"
          className="grid size-10 shrink-0 place-items-center rounded-lg bg-background/80"
        >
          <Icon
            className={cn(
              "size-5",
              isLoading || isRetrying ? "animate-spin text-primary" : "text-status-warn-foreground",
            )}
          />
        </span>
        <div className="min-w-0">
          <h2 className="text-sm font-semibold">{stateCopy.title}</h2>
          <p className="mt-1 text-xs leading-5 text-muted-foreground">{stateCopy.body}</p>
        </div>
      </div>
      {availability.state === "service-unavailable" && availability.retryable && onRetry ? (
        <Button
          type="button"
          variant="outline"
          className="min-h-11 w-full gap-2 sm:w-fit"
          onClick={() => void onRetry()}
        >
          <RefreshCw className="size-4" aria-hidden="true" />
          只读重试
        </Button>
      ) : null}
      {(availability.state === "no-permission" ||
        availability.state === "feature-off" ||
        availability.state === "not-found-or-hidden") &&
      onBack ? (
        <Button
          type="button"
          variant="outline"
          className="min-h-11 w-full sm:w-fit"
          onClick={onBack}
        >
          返回商品库存
        </Button>
      ) : null}
    </section>
  );
}
