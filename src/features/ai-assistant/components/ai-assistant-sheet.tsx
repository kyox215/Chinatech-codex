"use client";

import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";
import {
  AlertTriangle,
  Bot,
  ChevronDown,
  Clock3,
  Cpu,
  LoaderCircle,
  Mic,
  RefreshCcw,
  SearchX,
  Send,
  ShieldCheck,
  Sparkles,
  Square,
  UserRound,
  WifiOff,
} from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { Textarea } from "@/components/ui/textarea";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import type {
  AiAssistantCapabilities,
  AiAssistantProcessingMode,
  AiAssistantUsageSummary,
  AiOrderAssistantResponse,
} from "@/features/ai-assistant/model/contracts";
import {
  formatAiUsageInteger,
  formatAiUsageMicroUsd,
} from "@/features/ai-assistant/model/usage-format";
import { useAiAssistantVoiceInput } from "@/features/ai-assistant/components/use-ai-assistant-voice-input";
import {
  isRepairDeskRequestTimeoutError,
  RepairDeskApiError,
  runAiOrderAssistantTurn,
} from "@/lib/repairdesk/api";
import { brandGradientStyle } from "@/lib/ui-patterns";
import { cn } from "@/lib/utils";

type AssistantStatus = "idle" | "loading" | "result" | "error" | "cancelled";

type AssistantErrorState = {
  title: string;
  message: string;
  retryable: boolean;
};

export interface AiAssistantSheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  capabilities?: AiAssistantCapabilities;
  capabilitiesLoading: boolean;
  capabilitiesError: boolean;
  onRetryCapabilities: () => void;
  canReadUsage: boolean;
  usage?: AiAssistantUsageSummary;
  usageLoading: boolean;
  usageError: boolean;
  onRetryUsage: () => void;
  onModelUsageChanged: () => void;
  storeKey: string;
}

const suggestions = ["查找未付款工单", "查看逾期工单", "搜索正在维修的订单"] as const;

export function AiAssistantSheet({
  open,
  onOpenChange,
  capabilities,
  capabilitiesLoading,
  capabilitiesError,
  onRetryCapabilities,
  canReadUsage,
  usage,
  usageLoading,
  usageError,
  onRetryUsage,
  onModelUsageChanged,
  storeKey,
}: AiAssistantSheetProps) {
  const [input, setInput] = useState("");
  const [lastQuestion, setLastQuestion] = useState("");
  const [processingMode, setProcessingMode] = useState<AiAssistantProcessingMode>("local");
  const [lastProcessingMode, setLastProcessingMode] = useState<AiAssistantProcessingMode>("local");
  const [usageDetailsOpen, setUsageDetailsOpen] = useState(false);
  const [processingDetailsOpen, setProcessingDetailsOpen] = useState(false);
  const [status, setStatus] = useState<AssistantStatus>("idle");
  const [response, setResponse] = useState<AiOrderAssistantResponse>();
  const [error, setError] = useState<AssistantErrorState>();
  const [isOnline, setIsOnline] = useState(
    () => typeof navigator === "undefined" || navigator.onLine,
  );
  const controllerRef = useRef<AbortController | undefined>(undefined);
  const messageInputRef = useRef<HTMLTextAreaElement | null>(null);
  const requestSequenceRef = useRef(0);
  const lastClientRequestIdRef = useRef<string | undefined>(undefined);
  const canSubmit = capabilities?.canUseOrderAssistant === true;
  const voiceInput = useAiAssistantVoiceInput({
    value: input,
    onValueChange: setInput,
    maxLength: 800,
    disabled:
      !open || !canSubmit || capabilitiesLoading || capabilitiesError || status === "loading",
    lang: "zh-CN",
  });
  const abortVoiceInput = voiceInput.abort;

  useEffect(() => {
    const syncOnlineState = () => setIsOnline(window.navigator.onLine);
    window.addEventListener("online", syncOnlineState);
    window.addEventListener("offline", syncOnlineState);
    return () => {
      window.removeEventListener("online", syncOnlineState);
      window.removeEventListener("offline", syncOnlineState);
    };
  }, []);

  useEffect(() => {
    abortVoiceInput();
    controllerRef.current?.abort();
    controllerRef.current = undefined;
    requestSequenceRef.current += 1;
    setInput("");
    setLastQuestion("");
    setProcessingMode("local");
    setLastProcessingMode("local");
    setUsageDetailsOpen(false);
    setProcessingDetailsOpen(false);
    setStatus("idle");
    setResponse(undefined);
    setError(undefined);
    lastClientRequestIdRef.current = undefined;
  }, [abortVoiceInput, storeKey]);

  useEffect(() => {
    if (open) return;
    setUsageDetailsOpen(false);
    setProcessingDetailsOpen(false);
  }, [open]);

  useEffect(() => {
    if (open || !controllerRef.current) return;
    abortVoiceInput();
    requestSequenceRef.current += 1;
    controllerRef.current.abort();
    controllerRef.current = undefined;
    setStatus("cancelled");
  }, [abortVoiceInput, open]);

  useEffect(
    () => () => {
      controllerRef.current?.abort();
    },
    [],
  );

  const submit = useCallback(
    async (
      messageOverride?: string,
      reuseLastRequest = false,
      modeOverride?: AiAssistantProcessingMode,
    ) => {
      const message = (messageOverride ?? input).trim();
      if (!message || !canSubmit || !isOnline) return;
      const submittedMode = modeOverride ?? processingMode;

      abortVoiceInput();
      const sequence = requestSequenceRef.current + 1;
      requestSequenceRef.current = sequence;
      controllerRef.current?.abort();
      const controller = new AbortController();
      controllerRef.current = controller;
      setLastQuestion(message);
      setLastProcessingMode(submittedMode);
      setProcessingDetailsOpen(false);
      setStatus("loading");
      setResponse(undefined);
      setError(undefined);
      const clientRequestId =
        reuseLastRequest && lastClientRequestIdRef.current
          ? lastClientRequestIdRef.current
          : crypto.randomUUID();
      lastClientRequestIdRef.current = clientRequestId;

      try {
        const result = await runAiOrderAssistantTurn(
          {
            client_request_id: clientRequestId,
            message,
            locale: "zh-CN",
            processing_mode: submittedMode,
          },
          { signal: controller.signal },
        );
        if (requestSequenceRef.current !== sequence) return;
        controllerRef.current = undefined;
        setResponse(result);
        setInput("");
        setStatus("result");
        if (submittedMode === "model") onModelUsageChanged();
      } catch (caught) {
        if (requestSequenceRef.current !== sequence) return;
        controllerRef.current = undefined;
        if (isAbortError(caught)) {
          setStatus("cancelled");
          return;
        }
        setError(toAssistantError(caught));
        setStatus("error");
      }
    },
    [abortVoiceInput, canSubmit, input, isOnline, onModelUsageChanged, processingMode],
  );

  const cancel = () => {
    const controller = controllerRef.current;
    requestSequenceRef.current += 1;
    controllerRef.current = undefined;
    setStatus("cancelled");
    controller?.abort();
  };

  const voiceButtonLabel =
    voiceInput.support === "unsupported"
      ? "当前浏览器不支持语音输入"
      : voiceInput.phase === "requesting_permission"
        ? "取消语音输入"
        : voiceInput.phase === "listening"
          ? "停止语音输入"
          : voiceInput.phase === "processing"
            ? "正在处理语音输入"
            : "开始语音输入";
  const voiceStatusMessage =
    voiceInput.message ??
    (voiceInput.support === "unsupported"
      ? "当前浏览器不支持语音输入，请使用键盘输入。"
      : undefined);
  const voiceButtonActive =
    voiceInput.phase === "requesting_permission" || voiceInput.phase === "listening";

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        side="right"
        data-ai-assistant-sheet="true"
        className="flex w-full max-w-[30rem] flex-col gap-0 p-0 sm:w-[min(30rem,calc(100vw-24px))] sm:p-0"
        onOpenAutoFocus={(event) => {
          event.preventDefault();
          messageInputRef.current?.focus();
        }}
      >
        <SheetHeader className="shrink-0 space-y-1 border-b border-[var(--border-panel)] px-4 py-3 pr-16 text-left">
          <SheetTitle className="flex items-center gap-2 text-base">
            <span
              className="grid size-8 place-items-center rounded-xl text-primary-foreground shadow-[var(--shadow-action)]"
              style={brandGradientStyle}
            >
              <Sparkles className="size-4" aria-hidden="true" />
            </span>
            RepairDesk AI 小助手
          </SheetTitle>
          <SheetDescription className="text-xs">
            选择本地规则或大模型理解，只读查询当前门店工单。
          </SheetDescription>
        </SheetHeader>

        {canReadUsage ? (
          <AiChatUsageSummary
            usage={usage}
            isLoading={usageLoading}
            isError={usageError}
            onRetry={onRetryUsage}
            open={usageDetailsOpen}
            onOpenChange={setUsageDetailsOpen}
          />
        ) : null}

        <div className="min-h-0 flex-1 overflow-y-auto bg-[var(--surface-workspace)] px-3 py-3 sm:px-4">
          {!isOnline ? <OfflineState /> : null}

          {capabilitiesLoading ? (
            <CenteredState
              icon={<LoaderCircle className="size-5 animate-spin" />}
              title="正在确认使用权限"
              message="读取当前门店的 AI 功能配置…"
            />
          ) : capabilitiesError ? (
            <CenteredState
              icon={<AlertTriangle className="size-5" />}
              title="暂时无法读取 AI 配置"
              message="订单手工搜索仍可正常使用。"
              action={
                <Button type="button" variant="outline" size="sm" onClick={onRetryCapabilities}>
                  重试
                </Button>
              }
            />
          ) : !canSubmit ? (
            <CapabilityUnavailableState reason={capabilities?.reason} />
          ) : (
            <div className="space-y-3" aria-live="polite">
              {status === "idle" ? (
                <IdleState online={isOnline} onSuggestion={(value) => void submit(value)} />
              ) : null}

              {lastQuestion && status !== "idle" ? (
                <div className="ml-auto max-w-[88%] rounded-2xl rounded-br-md bg-primary px-3 py-2 text-sm text-primary-foreground shadow-[var(--shadow-card)]">
                  <span className="mb-0.5 block text-[10px] font-medium text-primary-foreground/75">
                    {lastProcessingMode === "local" ? "本地处理" : "大模型理解"}
                  </span>
                  <span>{lastQuestion}</span>
                </div>
              ) : null}

              {status === "loading" ? <LoadingState mode={lastProcessingMode} /> : null}
              {status === "cancelled" ? <CancelledState /> : null}
              {status === "error" && error ? (
                <ErrorState
                  error={error}
                  onRetry={() => void submit(lastQuestion, true, lastProcessingMode)}
                />
              ) : null}
              {status === "result" && response ? (
                <ResultState response={response} onNavigate={() => onOpenChange(false)} />
              ) : null}
            </div>
          )}
        </div>

        <form
          className="shrink-0 space-y-2 border-t border-[var(--border-panel)] bg-[var(--surface-workspace-strong)] px-3 pb-[calc(env(safe-area-inset-bottom)+0.75rem)] pt-3 sm:px-4"
          onSubmit={(event) => {
            event.preventDefault();
            const submitter = (event.nativeEvent as SubmitEvent).submitter;
            if (
              submitter instanceof HTMLButtonElement &&
              submitter.name === "assistant-action" &&
              submitter.value === "cancel"
            ) {
              cancel();
              return;
            }
            void submit();
          }}
        >
          <AiProcessingDisclosure
            open={processingDetailsOpen}
            onOpenChange={setProcessingDetailsOpen}
            processingMode={processingMode}
            onProcessingModeChange={setProcessingMode}
            canSubmit={canSubmit}
            capabilitiesLoading={capabilitiesLoading}
            capabilitiesError={capabilitiesError}
            isSubmitting={status === "loading"}
            voiceSupported={voiceInput.support === "supported"}
          />
          <label htmlFor="ai-assistant-message" className="sr-only">
            输入工单查询问题
          </label>
          <Textarea
            ref={messageInputRef}
            id="ai-assistant-message"
            value={input}
            maxLength={800}
            disabled={!canSubmit || capabilitiesLoading || capabilitiesError}
            onChange={(event) => {
              if (voiceInput.isActive) abortVoiceInput();
              setInput(event.target.value);
            }}
            onKeyDown={(event) => {
              if (event.key !== "Enter" || event.shiftKey) return;
              event.preventDefault();
              void submit();
            }}
            placeholder="例如：请列出仍在处理且未付款的工单"
            className="min-h-20 resize-none text-base sm:text-sm"
          />
          {voiceStatusMessage ? (
            <p
              role={voiceInput.phase === "error" ? "alert" : "status"}
              aria-live={voiceInput.phase === "error" ? "assertive" : "polite"}
              data-ai-voice-status="true"
              className={
                voiceInput.phase === "error"
                  ? "text-[11px] leading-4 text-status-danger-foreground"
                  : "text-[11px] leading-4 text-muted-foreground"
              }
            >
              {voiceStatusMessage}
            </p>
          ) : null}
          <div className="flex items-center justify-between gap-2">
            <span className="min-w-0 text-[11px] text-muted-foreground">
              {input.length}/800 · 结果来自当前 RepairDesk 数据
            </span>
            <div className="flex shrink-0 items-center gap-1.5">
              <Button
                type="button"
                size="icon"
                variant={voiceInput.phase === "listening" ? "destructive" : "outline"}
                aria-label={voiceButtonLabel}
                aria-pressed={voiceButtonActive}
                title={voiceButtonLabel}
                data-ai-voice-input="true"
                disabled={
                  !canSubmit ||
                  capabilitiesLoading ||
                  capabilitiesError ||
                  status === "loading" ||
                  voiceInput.support !== "supported" ||
                  voiceInput.phase === "processing"
                }
                onClick={voiceInput.toggle}
              >
                {voiceInput.phase === "processing" ? (
                  <LoaderCircle className="animate-spin" aria-hidden="true" />
                ) : voiceButtonActive ? (
                  <Square aria-hidden="true" />
                ) : (
                  <Mic aria-hidden="true" />
                )}
              </Button>
              {status === "loading" ? (
                <Button
                  type="submit"
                  name="assistant-action"
                  value="cancel"
                  variant="outline"
                  size="sm"
                >
                  取消
                </Button>
              ) : (
                <Button
                  type="submit"
                  size="sm"
                  disabled={!canSubmit || !isOnline || input.trim().length === 0}
                  className="gap-1.5"
                >
                  <Send className="size-3.5" aria-hidden="true" />
                  发送
                </Button>
              )}
            </div>
          </div>
        </form>
      </SheetContent>
    </Sheet>
  );
}

function AiChatUsageSummary({
  usage,
  isLoading,
  isError,
  onRetry,
  open,
  onOpenChange,
}: {
  usage?: AiAssistantUsageSummary;
  isLoading: boolean;
  isError: boolean;
  onRetry: () => void;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  if (isLoading) {
    return (
      <section
        data-ai-chat-usage="loading"
        aria-label="正在读取今日对话大模型用量"
        aria-busy="true"
        className="shrink-0 border-b border-[var(--border-panel)] bg-[var(--surface-workspace-strong)]"
      >
        <Collapsible open={open} onOpenChange={onOpenChange}>
          <UsageDisclosureTrigger open={open} summary="读取中…" />
          <CollapsibleContent className="border-t border-[var(--border-panel)] px-3 py-2.5 sm:px-4">
            <div className="grid min-w-0 grid-cols-3 gap-1.5">
              <Skeleton className="h-11 min-w-0 rounded-lg" />
              <Skeleton className="h-11 min-w-0 rounded-lg" />
              <Skeleton className="h-11 min-w-0 rounded-lg" />
            </div>
          </CollapsibleContent>
        </Collapsible>
      </section>
    );
  }

  if (isError || !usage) {
    return (
      <section
        data-ai-chat-usage="error"
        className="shrink-0 border-b border-[var(--border-panel)] bg-[var(--surface-workspace-strong)]"
      >
        <Collapsible open={open} onOpenChange={onOpenChange}>
          <UsageDisclosureTrigger open={open} summary="读取失败" isError />
          <CollapsibleContent className="border-t border-[var(--border-panel)] px-3 py-2 sm:px-4">
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
          </CollapsibleContent>
        </Collapsible>
      </section>
    );
  }

  const metric = usage.today_by_kind.order_text;
  const totalTokens = metric.input_token_count + metric.output_token_count;
  const limitLabel =
    metric.request_limit === null ? "—" : formatAiUsageInteger(metric.request_limit);

  return (
    <section
      data-ai-chat-usage="ready"
      className="shrink-0 border-b border-[var(--border-panel)] bg-[var(--surface-workspace-strong)]"
    >
      <Collapsible open={open} onOpenChange={onOpenChange}>
        <UsageDisclosureTrigger
          open={open}
          summary={`${formatAiUsageInteger(metric.provider_request_count)} / ${limitLabel} · ${formatAiUsageInteger(totalTokens)} Token · ${formatAiUsageMicroUsd(metric.settled_cost_microusd)}`}
        />
        <CollapsibleContent className="border-t border-[var(--border-panel)] px-3 py-2.5 sm:px-4">
          <div className="grid min-w-0 grid-cols-3 gap-1.5">
            <AiChatUsageMetric
              label="请求 / 上限"
              value={`${formatAiUsageInteger(metric.provider_request_count)} / ${limitLabel}`}
            />
            <AiChatUsageMetric label="Token" value={formatAiUsageInteger(totalTokens)} />
            <AiChatUsageMetric
              label="费用估算"
              value={formatAiUsageMicroUsd(metric.settled_cost_microusd)}
            />
          </div>
          <p className="mt-1 truncate text-[9px] text-muted-foreground">
            本地处理不计入
            {metric.reserved_cost_microusd > 0
              ? ` · 另有 ${formatAiUsageMicroUsd(metric.reserved_cost_microusd)} 预留中`
              : ""}
          </p>
        </CollapsibleContent>
      </Collapsible>
    </section>
  );
}

function UsageDisclosureTrigger({
  open,
  summary,
  isError = false,
}: {
  open: boolean;
  summary: string;
  isError?: boolean;
}) {
  return (
    <CollapsibleTrigger asChild>
      <button
        type="button"
        aria-label={`${open ? "收起" : "展开"}今日大模型用量`}
        className="flex min-h-11 w-full min-w-0 items-center gap-2 px-3 py-2 text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring sm:px-4"
      >
        <span className="shrink-0 text-[11px] font-semibold text-foreground">今日大模型用量</span>
        <span
          role="status"
          aria-live="polite"
          aria-atomic="true"
          className={cn(
            "min-w-0 flex-1 truncate text-right font-mono text-[10px] tabular-nums text-muted-foreground",
            isError && "font-sans text-status-warn-foreground",
          )}
          title={summary}
        >
          {summary}
        </span>
        <ChevronDown
          className={cn("size-4 shrink-0 transition-transform", open && "rotate-180")}
          aria-hidden="true"
        />
      </button>
    </CollapsibleTrigger>
  );
}

function AiProcessingDisclosure({
  open,
  onOpenChange,
  processingMode,
  onProcessingModeChange,
  canSubmit,
  capabilitiesLoading,
  capabilitiesError,
  isSubmitting,
  voiceSupported,
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
}) {
  const modeLabel = processingMode === "local" ? "本地处理" : "大模型理解";
  const modeSummary = capabilitiesLoading
    ? "正在确认权限"
    : capabilitiesError || !canSubmit
      ? "当前不可用"
      : processingMode === "local"
        ? isSubmitting
          ? "不调用模型 · 查询中"
          : "不调用模型"
        : isSubmitting
          ? "发送至 OpenAI · 查询中"
          : "发送至 OpenAI · 计入用量";

  return (
    <Collapsible
      open={open}
      onOpenChange={onOpenChange}
      className="rounded-xl border border-[var(--border-panel)] bg-card"
    >
      <CollapsibleTrigger asChild>
        <button
          type="button"
          aria-label={`${open ? "收起" : "展开"}处理方式详情`}
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
          <span className="min-w-0 flex-1 truncate text-right text-[10px] text-muted-foreground">
            {modeSummary}
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
            <ToggleGroupItem
              type="button"
              value="local"
              aria-label="使用本地处理"
              className="h-auto min-h-14 min-w-0 flex-col items-start gap-0.5 rounded-xl border border-[var(--border-panel)] bg-card px-3 py-2 text-left data-[state=on]:border-primary/50 data-[state=on]:bg-primary/10 data-[state=on]:text-foreground"
            >
              <span className="flex items-center gap-1.5 text-xs font-semibold">
                <Cpu className="size-3.5" aria-hidden="true" /> 本地处理
              </span>
              <span className="text-[10px] font-normal text-muted-foreground">
                固定规则 · 不调用模型
              </span>
            </ToggleGroupItem>
            <ToggleGroupItem
              type="button"
              value="model"
              aria-label="使用大模型理解"
              className="h-auto min-h-14 min-w-0 flex-col items-start gap-0.5 rounded-xl border border-[var(--border-panel)] bg-card px-3 py-2 text-left data-[state=on]:border-primary/50 data-[state=on]:bg-primary/10 data-[state=on]:text-foreground"
            >
              <span className="flex items-center gap-1.5 text-xs font-semibold">
                <Sparkles className="size-3.5" aria-hidden="true" /> 大模型理解
              </span>
              <span className="text-[10px] font-normal text-muted-foreground">
                复杂语句 · 计入用量
              </span>
            </ToggleGroupItem>
          </ToggleGroup>
        </fieldset>
        <div className="rounded-xl bg-[var(--surface-panel-muted)] px-3 py-2 text-[11px] leading-4 text-muted-foreground">
          {processingMode === "model" ? (
            <p>
              本次文字会在现有门店审批、出站检查和用量限制后发送至
              OpenAI；请勿输入电话、邮箱、IMEI、证件或银行卡信息。安全监控日志可能保留最多 30 天。
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
              <span>
                语音由浏览器/设备语音服务转成文字；RepairDesk 不保存录音，确认文字后再手动发送。
              </span>
            </p>
          ) : null}
        </div>
      </CollapsibleContent>
    </Collapsible>
  );
}

function AiChatUsageMetric({ label, value }: { label: string; value: string }) {
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

function IdleState({
  online,
  onSuggestion,
}: {
  online: boolean;
  onSuggestion: (value: string) => void;
}) {
  return (
    <div className="space-y-4 py-4 text-center">
      <div
        className="mx-auto grid size-14 place-items-center rounded-2xl text-primary-foreground shadow-[var(--shadow-action)]"
        style={brandGradientStyle}
      >
        <Bot className="size-6" aria-hidden="true" />
      </div>
      <div>
        <h3 className="text-sm font-semibold">想查哪一张工单？</h3>
        <p className="mt-1 text-xs leading-5 text-muted-foreground">
          可按订单号、客户、设备、付款或处理状态查询。结果会以安全卡片显示。
        </p>
      </div>
      <div className="grid gap-2 text-left">
        {suggestions.map((suggestion) => (
          <button
            key={suggestion}
            type="button"
            disabled={!online}
            onClick={() => onSuggestion(suggestion)}
            className="rounded-xl border border-[var(--border-panel)] bg-card px-3 py-2.5 text-left text-sm transition-colors hover:bg-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50"
          >
            {suggestion}
          </button>
        ))}
      </div>
      <div className="flex items-center justify-center gap-1.5 text-[11px] text-muted-foreground">
        <ShieldCheck className="size-3.5" aria-hidden="true" />
        只读模式 · 不向模型返回订单详情
      </div>
    </div>
  );
}

function LoadingState({ mode }: { mode: AiAssistantProcessingMode }) {
  return (
    <div className="rounded-2xl border border-[var(--border-panel)] bg-card p-3 shadow-[var(--shadow-card)]">
      <div className="flex items-center gap-2 text-sm font-medium">
        <LoaderCircle className="size-4 animate-spin text-primary" aria-hidden="true" />
        {mode === "local"
          ? "正在本地解析并查询 RepairDesk…"
          : "正在使用大模型理解并查询 RepairDesk…"}
      </div>
      <p className="mt-1 pl-6 text-xs text-muted-foreground">通常几秒内完成，最多等待 20 秒。</p>
    </div>
  );
}

function CancelledState() {
  return (
    <div className="rounded-2xl border border-[var(--border-panel)] bg-card p-3 text-sm text-muted-foreground">
      已取消本次查询。输入内容仍保留，可修改后重新发送。
    </div>
  );
}

function ErrorState({ error, onRetry }: { error: AssistantErrorState; onRetry: () => void }) {
  return (
    <div className="rounded-2xl border border-status-danger-foreground/25 bg-status-danger/40 p-3 text-status-danger-foreground">
      <div className="flex items-start gap-2">
        <AlertTriangle className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
        <div className="min-w-0 flex-1">
          <p className="text-sm font-semibold">{error.title}</p>
          <p className="mt-1 text-xs leading-5">{error.message}</p>
          {error.retryable ? (
            <Button type="button" variant="outline" size="sm" className="mt-2" onClick={onRetry}>
              重试查询
            </Button>
          ) : null}
        </div>
      </div>
    </div>
  );
}

function ResultState({
  response,
  onNavigate,
}: {
  response: AiOrderAssistantResponse;
  onNavigate: () => void;
}) {
  return (
    <div className="space-y-2">
      <div className="rounded-2xl rounded-tl-md border border-[var(--border-panel)] bg-card p-3 shadow-[var(--shadow-card)]">
        <div className="flex items-start gap-2">
          <span className="grid size-7 shrink-0 place-items-center rounded-lg bg-primary/10 text-primary">
            <Bot className="size-4" aria-hidden="true" />
          </span>
          <div className="min-w-0 flex-1">
            <p className="text-sm leading-5">{response.message}</p>
            <p className="mt-1 text-[10px] text-muted-foreground">
              {response.result_truncated ? "仅显示部分结果 · " : null}
              RepairDesk 实时查询
            </p>
          </div>
        </div>
      </div>

      {response.cards.length === 0 && response.kind === "search_results" ? (
        <div className="rounded-2xl border border-dashed border-[var(--border-panel)] bg-[var(--surface-panel-muted)] p-4 text-center">
          <SearchX className="mx-auto size-5 text-muted-foreground" aria-hidden="true" />
          <p className="mt-2 text-sm font-medium">没有匹配结果</p>
          <p className="mt-1 text-xs text-muted-foreground">
            上方已说明本次检查范围；可换一种说法或调整查询条件。
          </p>
        </div>
      ) : null}

      {response.cards.map((card) => (
        <Link
          key={card.id}
          href={card.href}
          onClick={onNavigate}
          className="block rounded-2xl border border-[var(--border-panel)] bg-card p-3 shadow-[var(--shadow-card)] transition-colors hover:bg-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        >
          <div className="flex min-w-0 items-start justify-between gap-2">
            <div className="min-w-0">
              <p className="truncate font-mono text-sm font-semibold">{card.public_no}</p>
              <p className="mt-0.5 truncate text-sm">{card.device_label}</p>
            </div>
            <Badge variant="secondary" className="max-w-28 shrink-0 truncate">
              {card.status_label}
            </Badge>
          </div>
          <div className="mt-2 grid min-w-0 grid-cols-2 gap-2 text-[11px] text-muted-foreground">
            <span className="flex min-w-0 items-center gap-1">
              <UserRound className="size-3 shrink-0" aria-hidden="true" />
              <span className="truncate">{card.customer_hint}</span>
            </span>
            <span className="flex min-w-0 items-center justify-end gap-1 text-right">
              <Clock3 className="size-3 shrink-0" aria-hidden="true" />
              <span className="truncate">{formatUpdatedAt(card.updated_at)}</span>
            </span>
          </div>
        </Link>
      ))}
    </div>
  );
}

function OfflineState() {
  return (
    <div
      role="status"
      aria-live="polite"
      className="mb-3 flex items-start gap-2 rounded-xl border border-status-warn-foreground/25 bg-status-warn/40 p-3 text-status-warn-foreground"
    >
      <WifiOff className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
      <div>
        <p className="text-sm font-semibold">当前离线</p>
        <p className="mt-0.5 text-xs leading-5">不会排队发送 AI 请求；恢复网络后可继续。</p>
      </div>
    </div>
  );
}

function CapabilityUnavailableState({ reason }: { reason?: AiAssistantCapabilities["reason"] }) {
  const permissionDenied = reason === "permission_denied";
  return (
    <CenteredState
      icon={permissionDenied ? <ShieldCheck className="size-5" /> : <Sparkles className="size-5" />}
      title={permissionDenied ? "当前账号没有使用权限" : "AI 小助手当前未开放"}
      message={
        permissionDenied
          ? "请继续使用订单页面的手工搜索；权限由当前门店角色决定。"
          : "此门店尚未启用只读订单助手，原有查询功能不受影响。"
      }
    />
  );
}

function CenteredState({
  icon,
  title,
  message,
  action,
}: {
  icon: React.ReactNode;
  title: string;
  message: string;
  action?: React.ReactNode;
}) {
  return (
    <div className="py-10 text-center">
      <span className="mx-auto grid size-12 place-items-center rounded-2xl bg-accent text-accent-foreground">
        {icon}
      </span>
      <h3 className="mt-3 text-sm font-semibold">{title}</h3>
      <p className="mx-auto mt-1 max-w-xs text-xs leading-5 text-muted-foreground">{message}</p>
      {action ? <div className="mt-3">{action}</div> : null}
    </div>
  );
}

function toAssistantError(error: unknown): AssistantErrorState {
  if (isRepairDeskRequestTimeoutError(error)) {
    return {
      title: "查询超时",
      message: "本次没有完成，输入内容已保留。可重试或继续使用手工搜索。",
      retryable: true,
    };
  }
  if (error instanceof RepairDeskApiError) {
    if (error.code === "AI_DISABLED") {
      return { title: "功能已关闭", message: "AI 小助手当前未开放。", retryable: false };
    }
    if (error.code === "AI_NOT_AUTHORIZED") {
      return { title: "没有使用权限", message: "当前门店角色不能执行此查询。", retryable: false };
    }
    if (error.code === "AI_QUOTA_EXHAUSTED") {
      return {
        title: "今日 AI 用量已达上限",
        message: "请继续使用订单页面的手工搜索。",
        retryable: false,
      };
    }
    if (error.code === "AI_MISCONFIGURED") {
      return {
        title: "AI 服务尚未配置完成",
        message: "请继续使用订单页面的手工搜索。",
        retryable: false,
      };
    }
    if (error.code === "AI_SENSITIVE_INPUT") {
      return {
        title: "请改用手工搜索",
        message: "系统检测到可能的客户或设备敏感信息，本次不会发送至外部 AI。",
        retryable: false,
      };
    }
    if (error.code === "AI_BUDGET_UNAVAILABLE") {
      return {
        title: "AI 用量账本暂不可用",
        message: "为避免未记账费用，本次已安全停止；请使用手工搜索。",
        retryable: true,
      };
    }
    if (error.code === "AI_REQUEST_CANCELLED") {
      return { title: "已取消", message: "本次请求已取消。", retryable: true };
    }
    if (error.code === "AI_PROVIDER_RATE_LIMITED") {
      return { title: "AI 服务繁忙", message: "稍后可重试，手工搜索仍可使用。", retryable: true };
    }
  }
  return {
    title: "暂时无法完成查询",
    message: "输入内容已保留。请重试或继续使用订单页面的手工搜索。",
    retryable: true,
  };
}

function isAbortError(error: unknown) {
  return error instanceof DOMException && error.name === "AbortError";
}

function formatUpdatedAt(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "更新时间未知";
  return new Intl.DateTimeFormat("zh-CN", {
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  }).format(date);
}
