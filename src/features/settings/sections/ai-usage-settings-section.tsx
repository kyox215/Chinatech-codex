import { Bot, Camera, Clock3, Coins, DatabaseZap, RefreshCcw, Sparkles } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import type {
  AiAssistantUsageKindMetric,
  AiAssistantUsageMetric,
  AiAssistantUsageSummary,
} from "@/features/ai-assistant/model/contracts";
import {
  formatAiUsageInteger,
  formatAiUsageMicroUsd,
} from "@/features/ai-assistant/model/usage-format";
import { RepairOsBusinessCard, RepairOsSectionHeader } from "@/shared/ui";

export interface AiUsageSettingsSectionProps {
  usage?: AiAssistantUsageSummary;
  isLoading: boolean;
  isError: boolean;
  onRetry: () => void;
}

export function AiUsageSettingsSection({
  usage,
  isLoading,
  isError,
  onRetry,
}: AiUsageSettingsSectionProps) {
  return (
    <section data-ai-usage-settings="true" className="space-y-3">
      <RepairOsBusinessCard as="div" className="block px-3 py-3 sm:px-4">
        <RepairOsSectionHeader
          icon={Sparkles}
          iconFrame={false}
          title="AI 使用量"
          description="只读统计当前门店的大模型请求、Token 与美元费用估算。"
        />
        <p className="mt-2 text-[11px] leading-4 text-muted-foreground">
          “本地处理”不调用大模型，因此不会计入这里的请求、Token 或费用。
        </p>
      </RepairOsBusinessCard>

      {isLoading ? <UsageLoadingState /> : null}
      {isError ? <UsageErrorState onRetry={onRetry} /> : null}
      {!isLoading && !isError && usage ? <UsageContent usage={usage} /> : null}
    </section>
  );
}

function UsageContent({ usage }: { usage: AiAssistantUsageSummary }) {
  const hasUsage = usage.last_30_days.provider_request_count > 0;
  return (
    <>
      {!hasUsage ? (
        <div className="rounded-xl border border-dashed border-[var(--border-panel)] bg-[var(--surface-panel-muted)] px-4 py-5 text-center">
          <DatabaseZap className="mx-auto size-5 text-muted-foreground" aria-hidden="true" />
          <p className="mt-2 text-sm font-semibold">最近 30 天尚无大模型用量</p>
          <p className="mt-1 text-xs text-muted-foreground">
            选择“大模型理解”并完成请求后，用量会显示在这里。
          </p>
        </div>
      ) : null}

      <UsagePeriodCard title="今天" metric={usage.today} />
      <UsagePeriodCard title="最近 30 天" metric={usage.last_30_days} />

      <RepairOsBusinessCard as="div" className="block px-3 py-3 sm:px-4">
        <div className="flex items-start justify-between gap-3">
          <div>
            <h3 className="text-sm font-semibold">今日分类</h3>
            <p className="mt-0.5 text-[11px] text-muted-foreground">
              每类请求使用独立的门店每日上限。
            </p>
          </div>
          <Clock3 className="mt-0.5 size-4 text-muted-foreground" aria-hidden="true" />
        </div>
        <div className="mt-3 grid gap-2 sm:grid-cols-2">
          <UsageKindRow icon={Bot} label="工单文字理解" metric={usage.today_by_kind.order_text} />
          <UsageKindRow
            icon={Camera}
            label="库存图片识别"
            metric={usage.today_by_kind.inventory_vision}
          />
        </div>
      </RepairOsBusinessCard>

      {usage.today.reserved_cost_microusd > 0 ? (
        <div
          role="status"
          className="rounded-xl border border-status-warn-foreground/25 bg-status-warn/30 px-3 py-2 text-xs text-status-warn-foreground"
        >
          当前有 {formatAiUsageMicroUsd(usage.today.reserved_cost_microusd)}{" "}
          预留费用尚待结算；已与上方估算费用分开。
        </div>
      ) : null}

      <p className="px-1 text-[10px] leading-4 text-muted-foreground">
        更新时间：{formatDateTime(usage.generated_at, usage.timezone)} · Token
        来自模型响应的用量字段；费用按当前 RepairDesk 价格策略估算，并非最终账单。
      </p>
    </>
  );
}

function UsagePeriodCard({ title, metric }: { title: string; metric: AiAssistantUsageMetric }) {
  return (
    <RepairOsBusinessCard as="div" className="block px-3 py-3 sm:px-4">
      <div className="flex items-center justify-between gap-2">
        <h3 className="text-sm font-semibold">{title}</h3>
        <Coins className="size-4 text-muted-foreground" aria-hidden="true" />
      </div>
      <div className="mt-3 grid grid-cols-2 gap-2 lg:grid-cols-4">
        <UsageMetric
          label="大模型请求"
          value={formatAiUsageInteger(metric.provider_request_count)}
        />
        <UsageMetric
          label="输入 Token"
          value={formatAiUsageInteger(metric.input_token_count)}
          detail={
            metric.cached_input_token_count > 0
              ? `其中缓存 ${formatAiUsageInteger(metric.cached_input_token_count)}`
              : undefined
          }
        />
        <UsageMetric label="输出 Token" value={formatAiUsageInteger(metric.output_token_count)} />
        <UsageMetric
          label="估算费用"
          value={formatAiUsageMicroUsd(metric.settled_cost_microusd)}
          detail="美元 · 已结算"
        />
      </div>
    </RepairOsBusinessCard>
  );
}

function UsageMetric({ label, value, detail }: { label: string; value: string; detail?: string }) {
  return (
    <div className="min-w-0 rounded-lg border border-[var(--border-panel)] bg-[var(--surface-panel-muted)] px-3 py-2">
      <p className="text-[10px] font-medium text-muted-foreground">{label}</p>
      <p className="mt-0.5 truncate text-base font-semibold tabular-nums text-foreground">
        {value}
      </p>
      {detail ? <p className="mt-0.5 truncate text-[9px] text-muted-foreground">{detail}</p> : null}
    </div>
  );
}

function UsageKindRow({
  icon: Icon,
  label,
  metric,
}: {
  icon: typeof Bot;
  label: string;
  metric: AiAssistantUsageKindMetric;
}) {
  const limit = metric.request_limit;
  const percentage =
    limit && limit > 0 ? Math.min(100, (metric.provider_request_count / limit) * 100) : 0;
  return (
    <div className="rounded-lg border border-[var(--border-panel)] bg-[var(--surface-panel-muted)] px-3 py-2.5">
      <div className="flex items-center gap-2">
        <span className="grid size-7 place-items-center rounded-lg bg-primary/10 text-primary">
          <Icon className="size-3.5" aria-hidden="true" />
        </span>
        <div className="min-w-0 flex-1">
          <p className="truncate text-xs font-semibold">{label}</p>
          <p className="text-[10px] tabular-nums text-muted-foreground">
            {formatAiUsageInteger(metric.provider_request_count)} /{" "}
            {limit === null ? "—" : formatAiUsageInteger(limit)} 次
          </p>
        </div>
      </div>
      <div
        role="progressbar"
        aria-label={`${label}今日用量`}
        aria-valuemin={0}
        aria-valuemax={limit ?? undefined}
        aria-valuenow={metric.provider_request_count}
        className="mt-2 h-1.5 overflow-hidden rounded-full bg-border"
      >
        <div className="h-full rounded-full bg-primary" style={{ width: `${percentage}%` }} />
      </div>
    </div>
  );
}

function UsageLoadingState() {
  return (
    <div data-ai-usage-loading="true" className="space-y-3" aria-label="正在读取 AI 使用量">
      <Skeleton className="h-32 w-full rounded-xl" />
      <Skeleton className="h-32 w-full rounded-xl" />
      <Skeleton className="h-28 w-full rounded-xl" />
    </div>
  );
}

function UsageErrorState({ onRetry }: { onRetry: () => void }) {
  return (
    <RepairOsBusinessCard
      as="div"
      role="alert"
      className="grid-cols-[auto_minmax(0,1fr)_auto] border-status-danger-foreground/25 bg-status-danger/10 text-status-danger-foreground hover:bg-status-danger/10"
      leading={
        <span className="grid size-8 place-items-center rounded-lg bg-status-danger/10">
          <DatabaseZap className="size-4" aria-hidden="true" />
        </span>
      }
      trailing={
        <Button type="button" size="sm" variant="outline" onClick={onRetry}>
          <RefreshCcw className="size-3.5" aria-hidden="true" /> 重试
        </Button>
      }
    >
      <span className="block text-sm font-semibold">AI 使用量读取失败</span>
      <span className="mt-0.5 block text-[11px] leading-4">其他设置与 AI 本地处理不受影响。</span>
    </RepairOsBusinessCard>
  );
}

function formatDateTime(value: string, timeZone: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "未知";
  try {
    return new Intl.DateTimeFormat("zh-CN", {
      timeZone,
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
    }).format(date);
  } catch {
    return new Intl.DateTimeFormat("zh-CN", {
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
    }).format(date);
  }
}
