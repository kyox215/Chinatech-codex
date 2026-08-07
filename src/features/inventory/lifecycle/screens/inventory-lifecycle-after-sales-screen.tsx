"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ArrowRight, ClipboardList, RefreshCw, ShieldCheck, Wrench } from "lucide-react";
import { useRouter } from "next/navigation";

import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { useStoreShellContext } from "@/features/stores/api/use-store-shell-context";
import { runInventoryLifecycleCommand } from "@/lib/repairdesk/api";
import type { InventoryLifecycleAfterSalesCaseDetail } from "@/lib/repairdesk/types";
import { repairOs } from "@/lib/ui-patterns";
import { cn } from "@/lib/utils";

import { inventoryLifecycleKeys } from "../api/query-keys";
import {
  inventoryLifecycleAfterSalesCaseQueryOptions,
  inventoryLifecycleAfterSalesQueryOptions,
} from "../api/query-options";
import { InventoryLifecyclePageShell } from "../components/inventory-lifecycle-page-shell";
import { InventoryLifecycleUnavailableCard } from "../components/inventory-lifecycle-status";

const statusCopy = {
  open: "待检测",
  in_progress: "处理中",
  waiting_customer: "等客户",
  returned: "已返还",
  closed: "已关闭",
} as const;

export function InventoryLifecycleAfterSalesQueueScreen() {
  const router = useRouter();
  const shell = useStoreShellContext({ monitorAuthority: true });
  const storeId = shell.activeStore?.id;
  const enabled = Boolean(
    storeId &&
    shell.permissions?.canReadInventory &&
    shell.permissions.inventoryLifecycleUiEnabled === true,
  );
  const query = useQuery({ ...inventoryLifecycleAfterSalesQueryOptions(storeId), enabled });

  if (!enabled) {
    return <Disabled title="售后队列" onBack={() => router.push("/inventory")} />;
  }
  return (
    <InventoryLifecyclePageShell
      title="售后队列"
      context="返修、保修判断与返还"
      onBack={() => router.push("/inventory")}
    >
      <section className="grid grid-cols-3 gap-2" aria-label="售后队列摘要">
        <QueueMetric label="全部进行中" value={query.data?.length ?? 0} icon={ClipboardList} />
        <QueueMetric
          label="待检测"
          value={query.data?.filter((item) => item.status === "open").length ?? 0}
          icon={Wrench}
        />
        <QueueMetric
          label="等客户"
          value={query.data?.filter((item) => item.status === "waiting_customer").length ?? 0}
          icon={RefreshCw}
        />
      </section>
      {query.isLoading ? (
        <div className={cn(repairOs.mobileInfoCard, "h-40 animate-pulse")} />
      ) : null}
      {query.isError ? (
        <InventoryLifecycleUnavailableCard
          title="售后队列加载失败"
          body="没有执行任何写入，请检查网络后重试。"
        />
      ) : null}
      {query.data?.length === 0 ? (
        <InventoryLifecycleUnavailableCard
          title="当前没有进行中的售后"
          body="新案件会从已交付商品的销售详情中登记。"
        />
      ) : null}
      <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
        {query.data?.map((item) => (
          <Link
            key={item.case_id}
            href={`/inventory/after-sales/${encodeURIComponent(item.case_id)}`}
            className={cn(
              repairOs.mobileInfoCard,
              "group min-h-28 p-3 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
            )}
          >
            <div className="flex items-start justify-between gap-2">
              <div className="min-w-0">
                <p className="truncate font-mono text-xs text-primary">{item.sku}</p>
                <h2 className="mt-1 line-clamp-2 text-sm font-semibold">{item.issue_summary}</h2>
              </div>
              <span className="shrink-0 rounded-full bg-status-warn px-2 py-1 text-[10px] text-status-warn-foreground">
                {statusCopy[item.status]}
              </span>
            </div>
            <div className="mt-3 flex items-center justify-between text-[10px] text-muted-foreground">
              <span>{formatDate(item.received_at)}</span>
              <span className="inline-flex items-center gap-1 text-primary">
                打开案件
                <ArrowRight className="size-3" aria-hidden="true" />
              </span>
            </div>
          </Link>
        ))}
      </div>
    </InventoryLifecyclePageShell>
  );
}

export function InventoryLifecycleAfterSalesCaseScreen({ caseId }: { caseId: string }) {
  const router = useRouter();
  const queryClient = useQueryClient();
  const shell = useStoreShellContext({ monitorAuthority: true });
  const storeId = shell.activeStore?.id;
  const enabled = Boolean(
    storeId &&
    shell.permissions?.canReadInventory &&
    shell.permissions.inventoryLifecycleUiEnabled === true,
  );
  const query = useQuery({
    ...inventoryLifecycleAfterSalesCaseQueryOptions(caseId, storeId),
    enabled,
  });
  const [diagnosis, setDiagnosis] = useState("");
  const [coverage, setCoverage] = useState("pending");
  const [status, setStatus] = useState("in_progress");
  const [message, setMessage] = useState("");
  const idempotencyKey = useRef(crypto.randomUUID());
  const mutation = useMutation({
    mutationFn: runInventoryLifecycleCommand,
    onSuccess: async () => {
      idempotencyKey.current = crypto.randomUUID();
      setMessage("售后状态已保存，历史事件已追加。");
      await queryClient.invalidateQueries({ queryKey: inventoryLifecycleKeys.all });
      await query.refetch();
    },
  });
  useEffect(() => {
    if (!query.data) return;
    setStatus(query.data.status);
    setCoverage(query.data.coverage_decision ?? "pending");
    setDiagnosis(query.data.diagnosis ?? "");
  }, [query.data]);
  if (!enabled) return <Disabled title="售后详情" onBack={() => router.push("/inventory")} />;
  if (query.isLoading)
    return (
      <InventoryLifecyclePageShell
        title="售后详情"
        context="正在读取案件"
        onBack={() => router.push("/inventory/after-sales")}
      >
        <div className={cn(repairOs.mobileInfoCard, "h-40 animate-pulse")} />
      </InventoryLifecyclePageShell>
    );
  if (query.isError || !query.data)
    return (
      <InventoryLifecyclePageShell
        title="售后详情"
        context="案件不可用"
        onBack={() => router.push("/inventory/after-sales")}
      >
        <InventoryLifecycleUnavailableCard
          title="无法读取售后案件"
          body="案件可能已关闭、不属于当前门店，或服务暂时不可用。"
        />
      </InventoryLifecyclePageShell>
    );
  const item = query.data;
  const canUpdate = item.allowed_actions.includes("after_sales.update");
  return (
    <InventoryLifecyclePageShell
      title="售后详情"
      context={`${item.sku} · ${statusCopy[item.status]}`}
      onBack={() => router.push("/inventory/after-sales")}
    >
      <CaseOverview item={item} />
      {message ? (
        <p
          className="rounded-xl bg-status-success px-3 py-2 text-xs text-status-success-foreground"
          role="status"
        >
          {message}
        </p>
      ) : null}
      {mutation.isError ? (
        <p className="rounded-xl bg-destructive/10 px-3 py-2 text-xs text-destructive" role="alert">
          {mutation.error instanceof Error ? mutation.error.message : "保存失败，请刷新后重试。"}
        </p>
      ) : null}
      {canUpdate ? (
        <section className={cn(repairOs.mobileInfoCard, "grid gap-3 p-3 sm:p-4")}>
          <div className="flex items-center gap-2">
            <Wrench className="size-4 text-primary" aria-hidden="true" />
            <h2 className="text-sm font-semibold">推进案件</h2>
          </div>
          <div className="grid gap-1.5">
            <Label className="text-xs">下一状态</Label>
            <select
              className="h-11 rounded-md border bg-background px-3 text-sm"
              value={status}
              onChange={(event) => setStatus(event.target.value)}
            >
              <option value="in_progress">处理中</option>
              <option value="open">待检测</option>
              <option value="waiting_customer">等待客户</option>
              <option value="returned">已返还客户</option>
              <option value="closed">关闭案件</option>
            </select>
          </div>
          <div className="grid gap-1.5">
            <Label className="text-xs">保障判断</Label>
            <select
              className="h-11 rounded-md border bg-background px-3 text-sm"
              value={coverage}
              onChange={(event) => setCoverage(event.target.value)}
            >
              <option value="pending">待判断</option>
              <option value="covered">在保障范围</option>
              <option value="not_covered">不在保障范围</option>
            </select>
          </div>
          <div className="grid gap-1.5">
            <Label className="text-xs">检测与处理说明</Label>
            <Textarea
              value={diagnosis}
              onChange={(event) => setDiagnosis(event.target.value)}
              className="min-h-24"
            />
          </div>
          <Button
            className="min-h-11"
            disabled={mutation.isPending || !diagnosis.trim()}
            onClick={() =>
              mutation.mutate({
                command: status === "closed" ? "after_sales.close" : "after_sales.update",
                idempotency_key: idempotencyKey.current,
                payload: {
                  case_id: item.case_id,
                  expected_case_version: item.version,
                  status,
                  diagnosis: diagnosis.trim(),
                  coverage_decision: coverage,
                  ...(status === "returned" ? { returned_at: new Date().toISOString() } : {}),
                },
              })
            }
          >
            {status === "closed" ? "确认关闭案件" : "保存并追加历史"}
          </Button>
        </section>
      ) : (
        <InventoryLifecycleUnavailableCard
          title="当前账号只能查看"
          body="状态动作由服务端权限和案件版本控制。"
        />
      )}
      <section className={cn(repairOs.mobileInfoCard, "p-3 sm:p-4")}>
        <div className="flex items-center gap-2">
          <ShieldCheck className="size-4 text-primary" aria-hidden="true" />
          <h2 className="text-sm font-semibold">案件历史</h2>
        </div>
        <ol className="mt-3 grid gap-2">
          {item.events.map((event, index) => (
            <li
              key={`${event.occurred_at}-${index}`}
              className="rounded-xl bg-[var(--surface-panel-muted)] p-2.5 text-xs"
            >
              <div className="flex items-center justify-between gap-2">
                <strong>{eventTypeLabel(event.event_type)}</strong>
                <time className="text-[10px] text-muted-foreground">
                  {formatDate(event.occurred_at)}
                </time>
              </div>
              {event.to_status ? (
                <p className="mt-1 text-[10px] text-muted-foreground">
                  {event.from_status
                    ? statusCopy[event.from_status as keyof typeof statusCopy]
                    : "新建"}{" "}
                  → {statusCopy[event.to_status as keyof typeof statusCopy] ?? event.to_status}
                </p>
              ) : null}
            </li>
          ))}
        </ol>
      </section>
    </InventoryLifecyclePageShell>
  );
}

function CaseOverview({ item }: { item: InventoryLifecycleAfterSalesCaseDetail }) {
  return (
    <section className={cn(repairOs.mobileInfoCard, "p-3 sm:p-4")}>
      <div className="flex items-start justify-between gap-2">
        <div>
          <p className="font-mono text-xs text-primary">{item.sku}</p>
          <h2 className="mt-1 text-sm font-semibold">{item.issue_summary}</h2>
        </div>
        <span className="rounded-full bg-status-warn px-2 py-1 text-[10px] text-status-warn-foreground">
          {statusCopy[item.status]}
        </span>
      </div>
      <div className="mt-3 grid grid-cols-2 gap-2 text-xs">
        <div className="rounded-xl bg-[var(--surface-panel-muted)] p-2">
          <span className="text-[10px] text-muted-foreground">收回时间</span>
          <strong className="mt-1 block">{formatDate(item.received_at)}</strong>
        </div>
        <div className="rounded-xl bg-[var(--surface-panel-muted)] p-2">
          <span className="text-[10px] text-muted-foreground">保障判断</span>
          <strong className="mt-1 block">{coverageLabel(item.coverage_decision)}</strong>
        </div>
      </div>
    </section>
  );
}
function QueueMetric({
  label,
  value,
  icon: Icon,
}: {
  label: string;
  value: number;
  icon: typeof ClipboardList;
}) {
  return (
    <div className={cn(repairOs.metricCardDense, "min-w-0 p-2.5")}>
      <Icon className="size-4 text-primary" aria-hidden="true" />
      <strong className="mt-1 block text-lg">{value}</strong>
      <span className="block truncate text-[10px] text-muted-foreground">{label}</span>
    </div>
  );
}
function Disabled({ title, onBack }: { title: string; onBack: () => void }) {
  return (
    <InventoryLifecyclePageShell title={title} context="商品生命周期" onBack={onBack}>
      <InventoryLifecycleUnavailableCard
        title="当前门店尚未开放此工作流"
        body="功能开关关闭时不会读取或写入生命周期账本。"
        onBack={onBack}
      />
    </InventoryLifecyclePageShell>
  );
}
function formatDate(value: string) {
  return new Intl.DateTimeFormat("zh-CN", { dateStyle: "medium", timeStyle: "short" }).format(
    new Date(value),
  );
}

function coverageLabel(value?: "pending" | "covered" | "not_covered") {
  return value === "covered" ? "保障范围内" : value === "not_covered" ? "不在保障范围" : "待判断";
}

function eventTypeLabel(value: string) {
  return value === "created" ? "建立案件" : value === "status_changed" ? "状态更新" : value;
}
