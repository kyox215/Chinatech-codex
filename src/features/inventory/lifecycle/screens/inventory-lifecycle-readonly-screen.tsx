"use client";

import { useRouter } from "next/navigation";
import { ArrowRight, ClipboardList, History, ShieldCheck } from "lucide-react";

import { Button } from "@/components/ui/button";
import { repairOs } from "@/lib/ui-patterns";
import { cn } from "@/lib/utils";

import { InventoryLifecyclePageShell } from "../components/inventory-lifecycle-page-shell";
import { InventoryLifecycleUnavailableCard } from "../components/inventory-lifecycle-status";

type ReadonlyKind = "reservation" | "sale" | "after-sales" | "after-sales-case";

const copy: Record<
  ReadonlyKind,
  { title: string; context: string; description: string; next: string }
> = {
  reservation: {
    title: "预订详情",
    context: "客户预订与定金",
    description:
      "当前服务端尚未提供按预订编号读取付款历史、客户和尾款的投影。页面保留独立工作流入口，避免用旧库存字段猜测业务状态。",
    next: "等待生命周期详情接口",
  },
  sale: {
    title: "销售详情",
    context: "成交、取走与保修",
    description:
      "当前服务端尚未提供销售订单详情、付款余额和可用动作。成交与取走不会在此页执行，避免重复写入旧销售账。",
    next: "等待销售详情接口",
  },
  "after-sales": {
    title: "售后队列",
    context: "返修与保修案件",
    description:
      "当前服务端尚未提供售后队列读模型。原商品资料仍可查看，返修状态不会由前端推测或覆盖原销售记录。",
    next: "等待售后队列接口",
  },
  "after-sales-case": {
    title: "售后详情",
    context: "检测、维修与返还",
    description:
      "当前服务端尚未提供售后案件详情与可用动作投影。此页面仅作为安全的工作流壳，暂不执行状态更新。",
    next: "等待售后详情接口",
  },
};

export function InventoryLifecycleReadonlyScreen({
  kind,
  recordId,
}: {
  kind: ReadonlyKind;
  recordId?: string;
}) {
  const router = useRouter();
  const text = copy[kind];

  return (
    <InventoryLifecyclePageShell
      title={text.title}
      context={recordId ? `${text.context} · ${recordId}` : text.context}
      onBack={() => router.push("/inventory")}
    >
      <section className={cn(repairOs.mobileInfoCard, "grid gap-2 p-3 sm:grid-cols-3 sm:p-4")}>
        <ReadOnlySignal icon={ClipboardList} label="工作流入口" value="已保留" />
        <ReadOnlySignal icon={History} label="历史账本" value="服务端维护" />
        <ReadOnlySignal icon={ShieldCheck} label="写入保护" value="默认关闭" />
      </section>
      <InventoryLifecycleUnavailableCard title={text.next} body={text.description} />
      <div className="flex flex-wrap gap-2">
        <Button
          type="button"
          variant="outline"
          className="min-h-11"
          onClick={() => router.push("/inventory")}
        >
          返回商品库存
        </Button>
        {kind === "after-sales" ? (
          <Button type="button" variant="ghost" className="min-h-11" disabled>
            新建售后（接口未启用）
            <ArrowRight className="ml-1.5 size-4" aria-hidden="true" />
          </Button>
        ) : null}
      </div>
    </InventoryLifecyclePageShell>
  );
}

function ReadOnlySignal({
  icon: Icon,
  label,
  value,
}: {
  icon: typeof ClipboardList;
  label: string;
  value: string;
}) {
  return (
    <div className="flex min-w-0 items-center gap-2 rounded-lg bg-[var(--surface-panel-muted)] px-2.5 py-2">
      <Icon className="size-4 shrink-0 text-primary" aria-hidden="true" />
      <span className="min-w-0">
        <span className="block truncate text-[10px] text-muted-foreground">{label}</span>
        <strong className="block truncate text-xs">{value}</strong>
      </span>
    </div>
  );
}
