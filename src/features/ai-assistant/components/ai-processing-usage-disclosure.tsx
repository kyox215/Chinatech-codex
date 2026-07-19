"use client";

import type { ReactNode } from "react";
import { ChevronDown, Cpu, Mic, RefreshCcw, Sparkles } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { Skeleton } from "@/components/ui/skeleton";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import type {
  AiAssistantProcessingMode,
  AiAssistantUsageSummary,
} from "@/features/ai-assistant/model/contracts";
import {
  formatAiUsageInteger,
  formatAiUsageMicroUsd,
} from "@/features/ai-assistant/model/usage-format";
import { cn } from "@/lib/utils";

export function AiProcessingUsageDisclosure({
  open,
  onOpenChange,
  processingMode,
  onProcessingModeChange,
  canSubmit,
  capabilitiesLoading,
  capabilitiesError,
  isSubmitting,
  voiceSupported,
  canReadUsage,
  usage,
  usageLoading,
  usageError,
  onRetryUsage,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  processingMode: AiAssistantProcessingMode;
  onProcessingModeChange: (mode: AiAssistantProcessingMode) => void;
  canSubmit: boolean;
  capabilitiesLoading: boolean;
  capabilitiesError: boolean;
  isSubmitting: boolean;
  voiceSupported: boolean;
  canReadUsage: boolean;
  usage?: AiAssistantUsageSummary;
  usageLoading: boolean;
  usageError: boolean;
  onRetryUsage: () => void;
}) {
  const modeLabel = processingMode === "local" ? "本地处理" : "大模型理解";
  const metric = usage?.today_by_kind.order_text;
  const summary = compactSummary({
    processingMode,
    canSubmit,
    capabilitiesLoading,
    capabilitiesError,
    isSubmitting,
    canReadUsage,
    usageLoading,
    usageError,
    metric,
  });

  return (
    <Collapsible
      open={open}
      onOpenChange={onOpenChange}
      className="rounded-xl border border-[var(--border-panel)] bg-card"
    >
      <CollapsibleTrigger asChild>
        <button
          type="button"
          aria-label={`${open ? "收起" : "展开"}处理方式和用量`}
          className="flex min-h-11 w-full min-w-0 items-center gap-2 px-3 py-2 text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        >
          <span className="shrink-0 text-[11px] font-semibold text-foreground">处理方式</span>
          <span className="flex shrink-0 items-center gap-1 text-xs font-semibold text-foreground">
            {processingMode === "local" ? (
              <Cpu className="size-3.5" aria-hidden="true" />
            ) : (
              <Sparkles className="size-3.5" aria-hidden="true" />
            )}
            {modeLabel}
          </span>
          <span
            role="status"
            aria-live="polite"
            className={cn(
              "min-w-0 flex-1 truncate text-right text-[10px] text-muted-foreground",
              usageError && canReadUsage && "text-status-warn-foreground",
            )}
          >
            {summary}
          </span>
          <ChevronDown
            className={cn("size-4 shrink-0 transition-transform", open && "rotate-180")}
            aria-hidden="true"
          />
        </button>
      </CollapsibleTrigger>

      <CollapsibleContent className="space-y-2 border-t border-[var(--border-panel)] px-2.5 py-2.5">
        <fieldset
          className="space-y-1.5"
          disabled={isSubmitting || !canSubmit || capabilitiesLoading || capabilitiesError}
        >
          <div className="flex items-center justify-between gap-2 px-0.5">
            <legend className="text-[11px] font-semibold text-foreground">选择处理方式</legend>
            <span className="text-[10px] text-muted-foreground">每次发送前可切换</span>
          </div>
          <ToggleGroup
            type="single"
            value={processingMode}
            aria-label="查询处理方式"
            data-ai-processing-mode={processingMode}
            onValueChange={(value) => {
              if (value === "local" || value === "model") onProcessingModeChange(value);
            }}
            className="grid grid-cols-2 gap-2"
          >
            <ModeToggle
              value="local"
              icon={<Cpu className="size-3.5" />}
              label="本地处理"
              hint="固定规则 · 不调用模型"
            />
            <ModeToggle
              value="model"
              icon={<Sparkles className="size-3.5" />}
              label="大模型理解"
              hint="复杂语句 · 计入用量"
            />
          </ToggleGroup>
        </fieldset>

        {canReadUsage ? (
          <UsageDetails
            usage={usage}
            loading={usageLoading}
            error={usageError}
            onRetry={onRetryUsage}
          />
        ) : null}

        <div className="rounded-xl bg-[var(--surface-panel-muted)] px-3 py-2 text-[11px] leading-4 text-muted-foreground">
          {processingMode === "model" ? (
            <p>
              本次文字会在门店权限、出站检查和用量限制后发送至
              OpenAI；请勿输入电话、邮箱、IMEI、证件、地址或银行卡信息。
            </p>
          ) : (
            <p>
              本地处理只使用 RepairDesk 固定规则，不会把本次文字发送给大模型，也不产生 Token
              费用；仍需联网查询当前门店数据。
            </p>
          )}
          {voiceSupported ? (
            <p className="mt-1 flex items-start gap-1.5">
              <Mic className="mt-0.5 size-3 shrink-0" aria-hidden="true" />
              <span>语音由浏览器/设备语音服务转成文字；RepairDesk 不保存录音。</span>
            </p>
          ) : null}
        </div>
      </CollapsibleContent>
    </Collapsible>
  );
}

function ModeToggle({
  value,
  icon,
  label,
  hint,
}: {
  value: AiAssistantProcessingMode;
  icon: ReactNode;
  label: string;
  hint: string;
}) {
  return (
    <ToggleGroupItem
      type="button"
      value={value}
      aria-label={`使用${label}`}
      className="h-auto min-h-14 min-w-0 flex-col items-start gap-0.5 rounded-xl border border-[var(--border-panel)] bg-card px-3 py-2 text-left data-[state=on]:border-primary/50 data-[state=on]:bg-primary/10 data-[state=on]:text-foreground"
    >
      <span className="flex items-center gap-1.5 text-xs font-semibold" aria-hidden="true">
        {icon} {label}
      </span>
      <span className="text-[10px] font-normal text-muted-foreground">{hint}</span>
    </ToggleGroupItem>
  );
}

function UsageDetails({
  usage,
  loading,
  error,
  onRetry,
}: {
  usage?: AiAssistantUsageSummary;
  loading: boolean;
  error: boolean;
  onRetry: () => void;
}) {
  if (loading) {
    return (
      <div className="grid min-w-0 grid-cols-3 gap-1.5" aria-label="正在读取今日大模型用量">
        <Skeleton className="h-11 min-w-0 rounded-lg" />
        <Skeleton className="h-11 min-w-0 rounded-lg" />
        <Skeleton className="h-11 min-w-0 rounded-lg" />
      </div>
    );
  }
  if (error || !usage) {
    return (
      <div className="flex min-w-0 items-center justify-between gap-2 rounded-lg border border-status-warn-foreground/25 bg-status-warn/25 px-2.5 py-2 text-status-warn-foreground">
        <div className="min-w-0">
          <p className="truncate text-xs font-semibold">今日用量暂时无法读取</p>
          <p className="truncate text-[10px]">不影响本地或大模型查询。</p>
        </div>
        <Button
          type="button"
          size="sm"
          variant="outline"
          className="h-7 shrink-0"
          onClick={onRetry}
        >
          <RefreshCcw className="size-3" aria-hidden="true" /> 重试
        </Button>
      </div>
    );
  }
  const metric = usage.today_by_kind.order_text;
  const limit = metric.request_limit === null ? "—" : formatAiUsageInteger(metric.request_limit);
  const tokens = metric.input_token_count + metric.output_token_count;
  return (
    <div>
      <div className="grid min-w-0 grid-cols-3 gap-1.5">
        <UsageMetric
          label="请求 / 上限"
          value={`${formatAiUsageInteger(metric.provider_request_count)} / ${limit}`}
        />
        <UsageMetric label="Token" value={formatAiUsageInteger(tokens)} />
        <UsageMetric label="费用估算" value={formatAiUsageMicroUsd(metric.settled_cost_microusd)} />
      </div>
      <p className="mt-1 truncate text-[9px] text-muted-foreground">
        本地处理不计入
        {metric.reserved_cost_microusd > 0
          ? ` · 另有 ${formatAiUsageMicroUsd(metric.reserved_cost_microusd)} 预留中`
          : ""}
      </p>
    </div>
  );
}

function UsageMetric({ label, value }: { label: string; value: string }) {
  return (
    <div className="min-w-0 rounded-lg border border-[var(--border-panel)] bg-[var(--surface-panel-muted)] px-2 py-1.5">
      <p className="truncate text-[9px] font-medium text-muted-foreground">{label}</p>
      <p
        className="mt-0.5 truncate font-mono text-xs font-semibold tabular-nums text-foreground"
        title={value}
      >
        {value}
      </p>
    </div>
  );
}

function compactSummary({
  processingMode,
  canSubmit,
  capabilitiesLoading,
  capabilitiesError,
  isSubmitting,
  canReadUsage,
  usageLoading,
  usageError,
  metric,
}: {
  processingMode: AiAssistantProcessingMode;
  canSubmit: boolean;
  capabilitiesLoading: boolean;
  capabilitiesError: boolean;
  isSubmitting: boolean;
  canReadUsage: boolean;
  usageLoading: boolean;
  usageError: boolean;
  metric?: AiAssistantUsageSummary["today_by_kind"]["order_text"];
}) {
  if (capabilitiesLoading) return "正在确认权限";
  if (capabilitiesError || !canSubmit) return "当前不可用";
  if (!canReadUsage) {
    return processingMode === "local" ? "不调用模型" : "发送至 OpenAI";
  }
  if (usageLoading) return "用量读取中";
  if (usageError || !metric) return "用量暂不可用";
  const limit = metric.request_limit === null ? "—" : formatAiUsageInteger(metric.request_limit);
  const usageText = `今日 ${formatAiUsageInteger(metric.provider_request_count)}/${limit}`;
  if (isSubmitting) return `${usageText} · 查询中`;
  return processingMode === "local" ? `本次不计入 · ${usageText}` : usageText;
}
