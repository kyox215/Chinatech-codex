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
import { useLocale } from "@/shared/i18n/locale-provider";
import { getAiAssistantPresentationCopy } from "@/shared/i18n/messages";
import type { AppLocale } from "@/shared/i18n/locales";

export function AiProcessingUsageDisclosure({
  open,
  onOpenChange,
  processingMode,
  onProcessingModeChange,
  canUseModel,
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
  canUseModel: boolean;
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
  const { locale } = useLocale();
  const copy = getAiAssistantPresentationCopy(locale);
  const modeLabel = processingMode === "local" ? copy.local : copy.model;
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
    locale,
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
          aria-label={open ? copy.disclosureAriaOpen : copy.disclosureAriaClosed}
          className="flex min-h-11 w-full min-w-0 items-center gap-2 px-3 py-2 text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        >
          <span className="shrink-0 text-[11px] font-semibold text-foreground lg:text-xs lg:leading-4">
            {copy.processingMode}
          </span>
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
              "min-w-0 flex-1 truncate text-right text-[10px] text-muted-foreground lg:text-[11px] lg:leading-4",
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
            <legend className="text-[11px] font-semibold text-foreground lg:text-xs lg:leading-4">
              {copy.selectMode}
            </legend>
            <span className="text-[10px] text-muted-foreground lg:text-[11px] lg:leading-4">
              {copy.switchEach}
            </span>
          </div>
          <ToggleGroup
            type="single"
            value={processingMode}
            aria-label={copy.modeAria}
            data-ai-processing-mode={processingMode}
            onValueChange={(value) => {
              if (value === "local" || value === "model") onProcessingModeChange(value);
            }}
            className={cn("grid gap-2", canUseModel ? "grid-cols-2" : "grid-cols-1")}
          >
            <ModeToggle
              value="local"
              icon={<Cpu className="size-3.5" />}
              label={copy.local}
              hint={copy.localHint}
              useLabel={copy.useMode}
            />
            {canUseModel ? (
              <ModeToggle
                value="model"
                icon={<Sparkles className="size-3.5" />}
                label={copy.model}
                hint={copy.modelHint}
                useLabel={copy.useMode}
              />
            ) : null}
          </ToggleGroup>
        </fieldset>

        {canReadUsage ? (
          <UsageDetails
            usage={usage}
            loading={usageLoading}
            error={usageError}
            onRetry={onRetryUsage}
            locale={locale}
          />
        ) : null}

        <div className="rounded-xl bg-[var(--surface-panel-muted)] px-3 py-2 text-[11px] leading-4 text-muted-foreground lg:text-xs lg:leading-[18px]">
          {processingMode === "model" ? <p>{copy.modelPrivacy}</p> : <p>{copy.localPrivacy}</p>}
          {!canUseModel ? <p className="mt-1">{copy.modelUnavailable}</p> : null}
          {voiceSupported ? (
            <p className="mt-1 flex items-start gap-1.5">
              <Mic className="mt-0.5 size-3 shrink-0" aria-hidden="true" />
              <span>{copy.voicePrivacy}</span>
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
  useLabel,
}: {
  value: AiAssistantProcessingMode;
  icon: ReactNode;
  label: string;
  hint: string;
  useLabel: string;
}) {
  return (
    <ToggleGroupItem
      type="button"
      value={value}
      aria-label={useLabel.replace("{mode}", label)}
      className="h-auto min-h-14 min-w-0 flex-col items-start gap-0.5 rounded-xl border border-[var(--border-panel)] bg-card px-3 py-2 text-left data-[state=on]:border-primary/50 data-[state=on]:bg-primary/10 data-[state=on]:text-foreground"
    >
      <span className="flex items-center gap-1.5 text-xs font-semibold" aria-hidden="true">
        {icon} {label}
      </span>
      <span className="text-[10px] font-normal text-muted-foreground lg:text-[11px] lg:leading-4">
        {hint}
      </span>
    </ToggleGroupItem>
  );
}

function UsageDetails({
  usage,
  loading,
  error,
  onRetry,
  locale,
}: {
  usage?: AiAssistantUsageSummary;
  loading: boolean;
  error: boolean;
  onRetry: () => void;
  locale: AppLocale;
}) {
  const copy = getAiAssistantPresentationCopy(locale);
  if (loading) {
    return (
      <div className="grid min-w-0 grid-cols-3 gap-1.5" aria-label={copy.usageLoadingAria}>
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
          <p className="truncate text-xs font-semibold">{copy.usageError}</p>
          <p className="truncate text-[10px] lg:text-[11px] lg:leading-4">{copy.usageErrorHint}</p>
        </div>
        <Button
          type="button"
          size="sm"
          variant="outline"
          className="h-7 shrink-0"
          onClick={onRetry}
        >
          <RefreshCcw className="size-3" aria-hidden="true" /> {copy.retry}
        </Button>
      </div>
    );
  }
  const metric = usage.today_by_kind.order_text;
  const limit =
    metric.request_limit === null ? "—" : formatAiUsageInteger(metric.request_limit, locale);
  const tokens = metric.input_token_count + metric.output_token_count;
  return (
    <div>
      <div className="grid min-w-0 grid-cols-3 gap-1.5">
        <UsageMetric
          label={copy.requestsLimit}
          value={`${formatAiUsageInteger(metric.provider_request_count, locale)} / ${limit}`}
        />
        <UsageMetric label="Token" value={formatAiUsageInteger(tokens, locale)} />
        <UsageMetric
          label={copy.cost}
          value={formatAiUsageMicroUsd(metric.settled_cost_microusd)}
        />
      </div>
      <p className="mt-1 truncate text-[9px] text-muted-foreground lg:text-[11px] lg:leading-4">
        {copy.localExcluded}
        {metric.reserved_cost_microusd > 0
          ? copy.reserved.replace("{cost}", formatAiUsageMicroUsd(metric.reserved_cost_microusd))
          : ""}
      </p>
    </div>
  );
}

function UsageMetric({ label, value }: { label: string; value: string }) {
  return (
    <div className="min-w-0 rounded-lg border border-[var(--border-panel)] bg-[var(--surface-panel-muted)] px-2 py-1.5">
      <p className="truncate text-[9px] font-medium text-muted-foreground lg:text-[11px] lg:leading-4">
        {label}
      </p>
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
  locale,
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
  locale: AppLocale;
}) {
  const copy = getAiAssistantPresentationCopy(locale);
  if (capabilitiesLoading) return copy.checking;
  if (capabilitiesError || !canSubmit) return copy.unavailable;
  if (!canReadUsage) {
    return processingMode === "local" ? copy.noModel : copy.sendsOpenAi;
  }
  if (usageLoading) return copy.usageLoading;
  if (usageError || !metric) return copy.usageUnavailable;
  const limit =
    metric.request_limit === null ? "—" : formatAiUsageInteger(metric.request_limit, locale);
  const usageText = copy.todayUsage
    .replace("{used}", formatAiUsageInteger(metric.provider_request_count, locale))
    .replace("{limit}", limit);
  if (isSubmitting) return `${usageText} · ${copy.querying}`;
  return processingMode === "local" ? `${copy.excludedThis} · ${usageText}` : usageText;
}
