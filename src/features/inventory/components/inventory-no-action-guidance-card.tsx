"use client";

import { CircleAlert, ClipboardCheck, Eye, Loader2, ShieldCheck } from "lucide-react";

import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

import type { InventoryNoActionGuidance } from "../model/inventory-no-action-guidance";

export type InventoryNoActionGuidanceCardProps = {
  guidance: InventoryNoActionGuidance;
  onReadOnly?: () => void | Promise<void>;
  privacyRedacted?: boolean;
  className?: string;
};

const copy = {
  "projection-unavailable": {
    title: "生命周期投影暂不可用",
    body: "已读取当前资料，但服务端未返回可用的生命周期投影；页面不会猜测写入动作。请只读核对库存与业务事实。",
    role: "alert" as const,
    icon: CircleAlert,
  },
  "facts-need-review": {
    title: "资料需要人工核对",
    body: "已确认的业务事实存在待核对项；页面暂不提供写入动作。请只读核对库存、订单或案件资料。",
    role: "alert" as const,
    icon: ClipboardCheck,
  },
  "terminal-complete": {
    title: "当前流程已完成",
    body: "已确认当前业务事实处于完成或终止状态；下一步仅查看记录或返回库存，不会重复写入。",
    role: "status" as const,
    icon: ShieldCheck,
  },
  "server-readonly": {
    title: "服务端未提供可执行动作",
    body: "服务端已确认当前没有可执行动作；页面不会猜测权限原因。请只读核对最新状态或返回库存。",
    role: "status" as const,
    icon: Eye,
  },
  "target-unavailable": {
    title: "当前目标动作不可用",
    body: "服务端返回了其他业务动作，但当前页面目标未被允许。请只读核对最新状态，不会把它解释为权限结论。",
    role: "status" as const,
    icon: Eye,
  },
  loading: {
    title: "正在读取下一动作",
    body: "正在读取服务端事实；在读取完成前不会猜测或展示写入动作。",
    role: "status" as const,
    icon: Loader2,
  },
} as const;

export function InventoryNoActionGuidanceCard({
  guidance,
  onReadOnly,
  privacyRedacted = false,
  className,
}: InventoryNoActionGuidanceCardProps) {
  const stateCopy = copy[guidance.state];
  const isLoading = guidance.state === "loading";
  const Icon = stateCopy.icon;
  const body = privacyRedacted
    ? "已读取安全状态；业务详情已裁剪。请只读核对当前页面，不会执行写入。"
    : stateCopy.body;

  return (
    <section
      data-ui="inventory-no-action-guidance"
      data-guidance-state={guidance.state}
      role={stateCopy.role}
      aria-live={stateCopy.role === "alert" ? "assertive" : "polite"}
      aria-busy={isLoading}
      className={cn("grid min-w-0 gap-3 rounded-xl border p-3", className)}
    >
      <div className="flex min-w-0 items-start gap-2.5">
        <span
          aria-hidden="true"
          className="grid size-10 shrink-0 place-items-center rounded-lg bg-background/80"
        >
          <Icon
            className={cn(
              "size-5",
              isLoading ? "animate-spin text-primary" : "text-status-warn-foreground",
            )}
          />
        </span>
        <div className="min-w-0">
          <h3 className="text-sm font-semibold">{stateCopy.title}</h3>
          <p className="mt-1 text-xs leading-5 text-muted-foreground">{body}</p>
        </div>
      </div>
      {onReadOnly && !isLoading ? (
        <Button
          type="button"
          variant="outline"
          className="min-h-11 w-full gap-2 sm:w-fit"
          onClick={() => void onReadOnly()}
        >
          <Eye className="size-4" aria-hidden="true" />
          只读核对最新状态
        </Button>
      ) : null}
    </section>
  );
}
