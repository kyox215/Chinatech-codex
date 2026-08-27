"use client";

import Link from "next/link";
import { ShieldAlert, Trash2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import type { ActorStoreMembership } from "@/lib/repairdesk/types";
import { repairOs } from "@/lib/ui-patterns";
import { cn } from "@/lib/utils";
import { RepairOsSectionHeader } from "@/shared/ui";

export function StoreDeleteEntry({
  store,
  canStart,
  isPreflighting,
  onStart,
}: {
  store: ActorStoreMembership;
  canStart: boolean;
  isPreflighting: boolean;
  onStart: () => void;
}) {
  return (
    <section
      data-store-delete-entry
      className={cn(
        repairOs.adminSection,
        "space-y-3 border-status-danger-foreground/25 bg-status-danger/5 p-2.5 sm:p-3",
      )}
    >
      <RepairOsSectionHeader
        icon={ShieldAlert}
        iconFrame={false}
        title="关闭与删除店铺"
        description="店铺删除分两步：先安全关闭（可恢复），归档后才可以申请永久删除。"
      />
      <p className="text-xs leading-5 text-muted-foreground">
        当前店铺：<span className="font-semibold text-foreground">{store.name}</span>
        。安全检查只读取状态，不会立刻删除资料。
      </p>
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
        <Button
          type="button"
          variant="destructive"
          className="min-h-11 gap-1.5 sm:min-h-10"
          disabled={!canStart || isPreflighting}
          aria-busy={isPreflighting}
          onClick={onStart}
        >
          <Trash2 className="size-4" aria-hidden="true" />
          {isPreflighting ? "正在检查…" : canStart ? "开始安全检查" : "关闭功能暂未启用"}
        </Button>
        <Button asChild type="button" variant="ghost" className="min-h-11 sm:min-h-10">
          <Link href="/settings/closed-stores">查看已关闭与删除</Link>
        </Button>
      </div>
      {!canStart ? (
        <p role="status" className="text-[11px] leading-4 text-muted-foreground">
          店铺保护尚未准备完成，当前不会修改店铺状态。
        </p>
      ) : null}
    </section>
  );
}
