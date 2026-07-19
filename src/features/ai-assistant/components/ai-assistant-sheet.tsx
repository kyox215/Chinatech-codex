"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import {
  AlertTriangle,
  Bot,
  ChevronDown,
  LoaderCircle,
  Mic,
  SearchX,
  Send,
  ShieldCheck,
  Sparkles,
  Square,
  WifiOff,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { Textarea } from "@/components/ui/textarea";
import type {
  AiAssistantCapabilities,
  AiAssistantProcessingMode,
  AiAssistantUsageSummary,
  AiOrderAssistantResponse,
} from "@/features/ai-assistant/model/contracts";
import { currentAiAssistantLocale } from "@/features/ai-assistant/model/locale";
import { AiOrderResultCard } from "@/features/ai-assistant/components/ai-order-result-card";
import { AiProcessingUsageDisclosure } from "@/features/ai-assistant/components/ai-processing-usage-disclosure";
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
  const [locale] = useState(currentAiAssistantLocale);
  const [controlDetailsOpen, setControlDetailsOpen] = useState(false);
  const [status, setStatus] = useState<AssistantStatus>("idle");
  const [response, setResponse] = useState<AiOrderAssistantResponse>();
  const [error, setError] = useState<AssistantErrorState>();
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const [loadMoreError, setLoadMoreError] = useState<string>();
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
    lang: locale,
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
    setControlDetailsOpen(false);
    setStatus("idle");
    setResponse(undefined);
    setError(undefined);
    setIsLoadingMore(false);
    setLoadMoreError(undefined);
    lastClientRequestIdRef.current = undefined;
  }, [abortVoiceInput, storeKey]);

  useEffect(() => {
    if (open) return;
    setControlDetailsOpen(false);
  }, [open]);

  useEffect(() => {
    if (open || !controllerRef.current) return;
    abortVoiceInput();
    requestSequenceRef.current += 1;
    controllerRef.current.abort();
    controllerRef.current = undefined;
    setStatus("cancelled");
    setIsLoadingMore(false);
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
      setControlDetailsOpen(false);
      setStatus("loading");
      setResponse(undefined);
      setError(undefined);
      setIsLoadingMore(false);
      setLoadMoreError(undefined);
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
            locale,
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
    [abortVoiceInput, canSubmit, input, isOnline, locale, onModelUsageChanged, processingMode],
  );

  const loadMore = useCallback(async () => {
    const current = response;
    if (
      !current ||
      !current.has_more ||
      !current.continuation_token ||
      isLoadingMore ||
      !canSubmit ||
      !isOnline ||
      !lastQuestion
    ) {
      return;
    }

    const sequence = requestSequenceRef.current + 1;
    requestSequenceRef.current = sequence;
    controllerRef.current?.abort();
    const controller = new AbortController();
    controllerRef.current = controller;
    setIsLoadingMore(true);
    setLoadMoreError(undefined);

    try {
      const next = await runAiOrderAssistantTurn(
        {
          client_request_id: crypto.randomUUID(),
          message: lastQuestion,
          locale,
          processing_mode: lastProcessingMode,
          page: current.page + 1,
          continuation_token: current.continuation_token,
        },
        { signal: controller.signal },
      );
      if (requestSequenceRef.current !== sequence) return;
      controllerRef.current = undefined;
      setResponse((previous) => mergeAssistantPages(previous, next));
      setIsLoadingMore(false);
    } catch (caught) {
      if (requestSequenceRef.current !== sequence) return;
      controllerRef.current = undefined;
      setIsLoadingMore(false);
      if (isAbortError(caught)) return;
      setLoadMoreError(toAssistantError(caught).message);
    }
  }, [canSubmit, isLoadingMore, isOnline, lastProcessingMode, lastQuestion, locale, response]);

  const cancel = () => {
    const controller = controllerRef.current;
    requestSequenceRef.current += 1;
    controllerRef.current = undefined;
    setStatus("cancelled");
    setIsLoadingMore(false);
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
            先核对系统实际采用的范围；只有点击按钮才会打开订单或提交受限操作。
          </SheetDescription>
        </SheetHeader>

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
            <div className="space-y-3">
              {status === "idle" ? (
                <IdleState online={isOnline} onSuggestion={(value) => void submit(value)} />
              ) : null}

              {lastQuestion && status !== "idle" ? (
                <div className="ml-auto max-w-[88%] rounded-2xl rounded-br-md bg-primary px-3 py-2 text-sm text-primary-foreground shadow-[var(--shadow-card)]">
                  <span className="mb-0.5 block text-[10px] font-medium text-primary-foreground/75">
                    处理方式 · {lastProcessingMode === "local" ? "本地处理" : "大模型辅助"}
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
                <ResultState
                  response={response}
                  isOnline={isOnline}
                  onNavigate={() => onOpenChange(false)}
                  onAdjustQuery={() => {
                    setInput(lastQuestion);
                    requestAnimationFrame(() => messageInputRef.current?.focus());
                  }}
                  onLoadMore={() => void loadMore()}
                  isLoadingMore={isLoadingMore}
                  loadMoreError={loadMoreError}
                  onCardUpdated={(updatedCard) =>
                    setResponse((current) =>
                      current
                        ? {
                            ...current,
                            cards: current.cards.map((card) =>
                              card.id === updatedCard.id ? updatedCard : card,
                            ),
                          }
                        : current,
                    )
                  }
                />
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
          <AiProcessingUsageDisclosure
            open={controlDetailsOpen}
            onOpenChange={setControlDetailsOpen}
            processingMode={processingMode}
            onProcessingModeChange={setProcessingMode}
            canSubmit={canSubmit}
            capabilitiesLoading={capabilitiesLoading}
            capabilitiesError={capabilitiesError}
            isSubmitting={status === "loading"}
            voiceSupported={voiceInput.support === "supported"}
            canReadUsage={canReadUsage}
            usage={usage}
            usageLoading={usageLoading}
            usageError={usageError}
            onRetryUsage={onRetryUsage}
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
          : "正在使用大模型辅助解析并由系统核对查询条件…"}
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
  onAdjustQuery,
  onLoadMore,
  isLoadingMore,
  loadMoreError,
  isOnline,
  onCardUpdated,
}: {
  response: AiOrderAssistantResponse;
  onNavigate: () => void;
  onAdjustQuery: () => void;
  onLoadMore: () => void;
  isLoadingMore: boolean;
  loadMoreError?: string;
  isOnline: boolean;
  onCardUpdated: (card: AiOrderAssistantResponse["cards"][number]) => void;
}) {
  const shouldStartOpen =
    response.cards.length === 0 ||
    response.interpretation_status === "corrected" ||
    response.interpretation_status === "defaulted" ||
    response.interpretation_status === "permission_limited";
  const [scopeOpen, setScopeOpen] = useState(shouldStartOpen);
  useEffect(() => setScopeOpen(shouldStartOpen), [response.request_id, shouldStartOpen]);
  const scopeSummary = response.applied_filters
    .slice(0, 3)
    .map((filter) => filter.value)
    .join(" · ");
  const interpretationLabel = interpretationStatusLabel(response.interpretation_status);

  return (
    <div className="space-y-2">
      <p className="sr-only" role="status" aria-live="polite">
        共找到 {response.total} 条工单，当前显示 {response.cards.length} 条，采用{" "}
        {response.applied_filters.length} 个查询条件。
      </p>
      <div className="rounded-2xl rounded-tl-md border border-[var(--border-panel)] bg-card p-3 shadow-[var(--shadow-card)]">
        <div className="flex items-start gap-2">
          <span className="grid size-7 shrink-0 place-items-center rounded-lg bg-primary/10 text-primary">
            <Bot className="size-4" aria-hidden="true" />
          </span>
          <div className="min-w-0 flex-1">
            <p className="text-[10px] font-semibold text-primary">{interpretationLabel}</p>
            <p className="text-sm leading-5">{response.message}</p>
            <p className="mt-1 text-[10px] text-muted-foreground">
              {response.result_truncated
                ? `显示 ${response.cards.length} / 共 ${response.total} 条 · `
                : response.kind === "search_results"
                  ? `共 ${response.total} 条 · `
                  : null}
              RepairDesk 实时查询
            </p>
          </div>
        </div>

        {response.applied_filters.length > 0 ? (
          <Collapsible open={scopeOpen} onOpenChange={setScopeOpen} className="mt-2">
            <div className="flex min-w-0 gap-1.5">
              <CollapsibleTrigger asChild>
                <button
                  type="button"
                  className="flex min-h-11 min-w-0 flex-1 items-center gap-2 rounded-xl border border-[var(--border-panel)] bg-[var(--surface-panel-muted)] px-3 py-2 text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                  aria-label={scopeOpen ? "收起查询范围" : "展开查询范围"}
                >
                  <span className="min-w-0 flex-1">
                    <span className="block text-[10px] font-semibold text-muted-foreground">
                      已核对查询范围
                    </span>
                    <span className="block truncate text-xs text-foreground" title={scopeSummary}>
                      {scopeSummary}
                      {response.applied_filters.length > 3
                        ? ` · +${response.applied_filters.length - 3}`
                        : null}
                    </span>
                  </span>
                  <ChevronDown
                    className={cn(
                      "size-4 shrink-0 transition-transform",
                      scopeOpen && "rotate-180",
                    )}
                    aria-hidden="true"
                  />
                </button>
              </CollapsibleTrigger>
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="h-auto min-h-11 shrink-0 px-3"
                onClick={onAdjustQuery}
              >
                修改
              </Button>
            </div>
            <CollapsibleContent>
              <section
                aria-label="系统实际采用的查询条件"
                className="mt-1.5 rounded-xl border border-[var(--border-panel)] bg-[var(--surface-panel-muted)] px-3 py-2"
              >
                <dl className="space-y-1.5">
                  {response.applied_filters.map((filter) => (
                    <div
                      key={`${filter.key}-${filter.value}`}
                      className="grid min-w-0 grid-cols-[4rem_minmax(0,1fr)] gap-2 text-[10px] leading-4"
                    >
                      <dt className="font-semibold text-muted-foreground">{filter.label}</dt>
                      <dd className="min-w-0 break-words text-foreground">
                        {filter.value}
                        <span className="ml-1 text-muted-foreground">
                          · {filterSourceLabel(filter.source)}
                        </span>
                      </dd>
                    </div>
                  ))}
                </dl>
              </section>
            </CollapsibleContent>
          </Collapsible>
        ) : null}

        {response.cards.length === 0 && response.kind === "search_results" ? (
          <div className="mt-3 flex items-center gap-2 border-t border-[var(--border-panel)] pt-3">
            <SearchX className="size-4 shrink-0 text-muted-foreground" aria-hidden="true" />
            <p className="min-w-0 flex-1 text-xs text-muted-foreground">
              已按上方范围完成查询，没有用近似条件替代原意。
            </p>
          </div>
        ) : null}
      </div>

      {response.cards.map((card) => (
        <AiOrderResultCard
          key={card.id}
          card={card}
          isOnline={isOnline}
          onOpenOrder={onNavigate}
          onCardUpdated={onCardUpdated}
        />
      ))}

      {response.has_more && response.continuation_token ? (
        <div className="rounded-xl border border-[var(--border-panel)] bg-card p-2 shadow-[var(--shadow-card)]">
          {loadMoreError ? (
            <p role="alert" className="mb-2 text-xs leading-5 text-status-danger-foreground">
              {loadMoreError}
            </p>
          ) : null}
          <Button
            type="button"
            variant="outline"
            className="h-11 w-full gap-2"
            data-ai-assistant-load-more="true"
            disabled={!isOnline || isLoadingMore}
            onClick={onLoadMore}
          >
            {isLoadingMore ? (
              <LoaderCircle className="size-4 animate-spin" aria-hidden="true" />
            ) : null}
            {isLoadingMore
              ? "正在加载下一批…"
              : `继续加载（已显示 ${response.cards.length} / ${response.total}）`}
          </Button>
        </div>
      ) : response.result_truncated ? (
        <p className="rounded-xl border border-[var(--border-panel)] bg-card px-3 py-2 text-xs text-muted-foreground">
          当前安全会话无法继续加载；请缩小查询范围后重试。
        </p>
      ) : null}
    </div>
  );
}

function interpretationStatusLabel(status: AiOrderAssistantResponse["interpretation_status"]) {
  if (status === "corrected") return "已按原句修正模型偏差";
  if (status === "defaulted") return "已采用安全默认范围";
  if (status === "needs_confirmation") return "需要确认后再查询";
  if (status === "permission_limited") return "已按当前权限限制范围";
  return "已确认查询条件";
}

function mergeAssistantPages(
  previous: AiOrderAssistantResponse | undefined,
  next: AiOrderAssistantResponse,
): AiOrderAssistantResponse {
  if (
    !previous ||
    previous.kind !== "search_results" ||
    next.kind !== "search_results" ||
    next.page <= previous.page
  ) {
    return next;
  }
  const cards = new Map(previous.cards.map((card) => [card.id, card]));
  for (const card of next.cards) cards.set(card.id, card);
  return { ...next, cards: [...cards.values()] };
}

function filterSourceLabel(source: AiOrderAssistantResponse["applied_filters"][number]["source"]) {
  if (source === "user_explicit") return "用户明确";
  if (source === "server_derived") return "系统核对";
  return "系统默认";
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
