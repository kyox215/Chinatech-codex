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
import { useLocale } from "@/shared/i18n/locale-provider";
import { getAiAssistantPresentationCopy } from "@/shared/i18n/messages";
import type { AppLocale } from "@/shared/i18n/locales";

type AssistantStatus = "idle" | "loading" | "result" | "error" | "cancelled";

type AssistantErrorState = {
  title: string;
  message: string;
  retryable: boolean;
};

const canonicalSuggestions = ["查找未付款工单", "查看逾期工单", "搜索正在维修的订单"] as const;

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
  const { locale: serverSafeLocale } = useLocale();
  const locale = typeof document === "undefined" ? serverSafeLocale : currentAiAssistantLocale();
  const copy = getAiAssistantPresentationCopy(locale);
  const [input, setInput] = useState("");
  const [lastQuestion, setLastQuestion] = useState("");
  const [processingMode, setProcessingMode] = useState<AiAssistantProcessingMode>("local");
  const [lastProcessingMode, setLastProcessingMode] = useState<AiAssistantProcessingMode>("local");
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
  const canUseOrderModel = capabilities?.canUseOrderModel === true;
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
    if (!canUseOrderModel) setProcessingMode("local");
  }, [canUseOrderModel]);

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
        setError(toAssistantError(caught, locale));
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
      setLoadMoreError(toAssistantError(caught, locale).message);
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
      ? copy.voiceUnsupported
      : voiceInput.phase === "requesting_permission"
        ? copy.voiceCancel
        : voiceInput.phase === "listening"
          ? copy.voiceStop
          : voiceInput.phase === "processing"
            ? copy.voiceProcessing
            : copy.voiceStart;
  const voiceStatusMessage =
    voiceInput.message ??
    (voiceInput.support === "unsupported" ? copy.voiceUnsupportedHint : undefined);
  const voiceButtonActive =
    voiceInput.phase === "requesting_permission" || voiceInput.phase === "listening";

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        side="right"
        closeLabel={copy.close}
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
            {copy.assistantTitle}
          </SheetTitle>
          <SheetDescription className="text-xs">{copy.assistantDescription}</SheetDescription>
        </SheetHeader>

        <div className="min-h-0 flex-1 overflow-y-auto bg-[var(--surface-workspace)] px-3 py-3 sm:px-4">
          {!isOnline ? <OfflineState locale={locale} /> : null}

          {capabilitiesLoading ? (
            <CenteredState
              icon={<LoaderCircle className="size-5 animate-spin" />}
              title={copy.checkingAccess}
              message={copy.readingConfig}
            />
          ) : capabilitiesError ? (
            <CenteredState
              icon={<AlertTriangle className="size-5" />}
              title={copy.configUnavailable}
              message={copy.manualStillWorks}
              action={
                <Button type="button" variant="outline" size="sm" onClick={onRetryCapabilities}>
                  {copy.retry}
                </Button>
              }
            />
          ) : !canSubmit ? (
            <CapabilityUnavailableState reason={capabilities?.reason} locale={locale} />
          ) : (
            <div className="space-y-3">
              {status === "idle" ? (
                <IdleState
                  locale={locale}
                  online={isOnline}
                  onSuggestion={(value) => void submit(value)}
                />
              ) : null}

              {lastQuestion && status !== "idle" ? (
                <div className="ml-auto max-w-[88%] rounded-2xl rounded-br-md bg-primary px-3 py-2 text-sm text-primary-foreground shadow-[var(--shadow-card)]">
                  <span className="mb-0.5 block text-[10px] font-medium text-primary-foreground/75 lg:text-[11px] lg:leading-4">
                    {copy.processingMode} ·{" "}
                    {lastProcessingMode === "local" ? copy.local : copy.model}
                  </span>
                  <span>{lastQuestion}</span>
                </div>
              ) : null}

              {status === "loading" ? (
                <LoadingState mode={lastProcessingMode} locale={locale} />
              ) : null}
              {status === "cancelled" ? <CancelledState locale={locale} /> : null}
              {status === "error" && error ? (
                <ErrorState
                  error={error}
                  onRetry={() => void submit(lastQuestion, true, lastProcessingMode)}
                  locale={locale}
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
                  locale={locale}
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
            canUseModel={canUseOrderModel}
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
            {copy.inputLabel}
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
            placeholder={copy.inputPlaceholder}
            className="min-h-20 resize-none text-base sm:text-sm"
          />
          {voiceStatusMessage ? (
            <p
              role={voiceInput.phase === "error" ? "alert" : "status"}
              aria-live={voiceInput.phase === "error" ? "assertive" : "polite"}
              data-ai-voice-status="true"
              className={
                voiceInput.phase === "error"
                  ? "text-[11px] leading-4 text-status-danger-foreground lg:text-xs lg:leading-[18px]"
                  : "text-[11px] leading-4 text-muted-foreground lg:text-xs lg:leading-[18px]"
              }
            >
              {voiceStatusMessage}
            </p>
          ) : null}
          <div className="flex items-center justify-between gap-2">
            <span className="min-w-0 text-[11px] text-muted-foreground lg:text-xs lg:leading-4">
              {input.length}/800 · {copy.inputHint}
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
                  {copy.cancel}
                </Button>
              ) : (
                <Button
                  type="submit"
                  size="sm"
                  disabled={!canSubmit || !isOnline || input.trim().length === 0}
                  className="gap-1.5"
                >
                  <Send className="size-3.5" aria-hidden="true" />
                  {copy.send}
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
  locale,
  online,
  onSuggestion,
}: {
  locale: AppLocale;
  online: boolean;
  onSuggestion: (value: string) => void;
}) {
  const copy = getAiAssistantPresentationCopy(locale);
  return (
    <div className="space-y-4 py-4 text-center">
      <div
        className="mx-auto grid size-14 place-items-center rounded-2xl text-primary-foreground shadow-[var(--shadow-action)]"
        style={brandGradientStyle}
      >
        <Bot className="size-6" aria-hidden="true" />
      </div>
      <div>
        <h3 className="text-sm font-semibold">{copy.idleTitle}</h3>
        <p className="mt-1 text-xs leading-5 text-muted-foreground">{copy.idleDescription}</p>
      </div>
      <div className="grid gap-2 text-left">
        {canonicalSuggestions.map((message, index) => (
          <button
            key={message}
            type="button"
            disabled={!online}
            onClick={() => onSuggestion(message)}
            className="rounded-xl border border-[var(--border-panel)] bg-card px-3 py-2.5 text-left text-sm transition-colors hover:bg-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50"
          >
            {copy.suggestions[index]}
          </button>
        ))}
      </div>
      <div className="flex items-center justify-center gap-1.5 text-[11px] text-muted-foreground lg:text-xs lg:leading-4">
        <ShieldCheck className="size-3.5" aria-hidden="true" />
        {copy.readonlyHint}
      </div>
    </div>
  );
}

function LoadingState({ mode, locale }: { mode: AiAssistantProcessingMode; locale: AppLocale }) {
  const copy = getAiAssistantPresentationCopy(locale);
  return (
    <div className="rounded-2xl border border-[var(--border-panel)] bg-card p-3 shadow-[var(--shadow-card)]">
      <div className="flex items-center gap-2 text-sm font-medium">
        <LoaderCircle className="size-4 animate-spin text-primary" aria-hidden="true" />
        {mode === "local" ? copy.loadingLocal : copy.loadingModel}
      </div>
      <p className="mt-1 pl-6 text-xs text-muted-foreground">{copy.waitHint}</p>
    </div>
  );
}

function CancelledState({ locale }: { locale: AppLocale }) {
  return (
    <div className="rounded-2xl border border-[var(--border-panel)] bg-card p-3 text-sm text-muted-foreground">
      {getAiAssistantPresentationCopy(locale).cancelled}
    </div>
  );
}

function ErrorState({
  error,
  onRetry,
  locale,
}: {
  error: AssistantErrorState;
  onRetry: () => void;
  locale: AppLocale;
}) {
  return (
    <div className="rounded-2xl border border-status-danger-foreground/25 bg-status-danger/40 p-3 text-status-danger-foreground">
      <div className="flex items-start gap-2">
        <AlertTriangle className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
        <div className="min-w-0 flex-1">
          <p className="text-sm font-semibold">{error.title}</p>
          <p className="mt-1 text-xs leading-5">{error.message}</p>
          {error.retryable ? (
            <Button type="button" variant="outline" size="sm" className="mt-2" onClick={onRetry}>
              {getAiAssistantPresentationCopy(locale).retryQuery}
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
  locale,
}: {
  response: AiOrderAssistantResponse;
  onNavigate: () => void;
  onAdjustQuery: () => void;
  onLoadMore: () => void;
  isLoadingMore: boolean;
  loadMoreError?: string;
  isOnline: boolean;
  onCardUpdated: (card: AiOrderAssistantResponse["cards"][number]) => void;
  locale: AppLocale;
}) {
  const copy = getAiAssistantPresentationCopy(locale);
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
  const interpretationLabel = interpretationStatusLabel(response.interpretation_status, locale);

  return (
    <div className="space-y-2">
      <p className="sr-only" role="status" aria-live="polite">
        {copy.resultStatus
          .replace("{total}", String(response.total))
          .replace("{shown}", String(response.cards.length))
          .replace("{filters}", String(response.applied_filters.length))}
      </p>
      <div className="rounded-2xl rounded-tl-md border border-[var(--border-panel)] bg-card p-3 shadow-[var(--shadow-card)]">
        <div className="flex items-start gap-2">
          <span className="grid size-7 shrink-0 place-items-center rounded-lg bg-primary/10 text-primary">
            <Bot className="size-4" aria-hidden="true" />
          </span>
          <div className="min-w-0 flex-1">
            <p className="text-[10px] font-semibold text-primary lg:text-xs lg:leading-4">
              {interpretationLabel}
            </p>
            <p className="text-sm leading-5">{response.message}</p>
            <p className="mt-1 text-[10px] text-muted-foreground lg:text-xs lg:leading-4">
              {response.result_truncated
                ? copy.shownTotal
                    .replace("{shown}", String(response.cards.length))
                    .replace("{total}", String(response.total))
                : response.kind === "search_results"
                  ? copy.total.replace("{total}", String(response.total))
                  : null}
              {copy.realtime}
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
                  aria-label={scopeOpen ? copy.collapseScope : copy.expandScope}
                >
                  <span className="min-w-0 flex-1">
                    <span className="block text-[10px] font-semibold text-muted-foreground lg:text-xs lg:leading-4">
                      {copy.verifiedScope}
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
                {copy.adjust}
              </Button>
            </div>
            <CollapsibleContent>
              <section
                aria-label={copy.appliedFiltersAria}
                className="mt-1.5 rounded-xl border border-[var(--border-panel)] bg-[var(--surface-panel-muted)] px-3 py-2"
              >
                <dl className="space-y-1.5">
                  {response.applied_filters.map((filter) => (
                    <div
                      key={`${filter.key}-${filter.value}`}
                      className="grid min-w-0 grid-cols-[4rem_minmax(0,1fr)] gap-2 text-[10px] leading-4 lg:text-xs lg:leading-4"
                    >
                      <dt className="font-semibold text-muted-foreground">{filter.label}</dt>
                      <dd className="min-w-0 break-words text-foreground">
                        {filter.value}
                        <span className="ml-1 text-muted-foreground">
                          · {filterSourceLabel(filter.source, locale)}
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
            <p className="min-w-0 flex-1 text-xs text-muted-foreground">{copy.noApproximation}</p>
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
              ? copy.loadingMore
              : copy.loadMore
                  .replace("{shown}", String(response.cards.length))
                  .replace("{total}", String(response.total))}
          </Button>
        </div>
      ) : response.result_truncated ? (
        <p className="rounded-xl border border-[var(--border-panel)] bg-card px-3 py-2 text-xs text-muted-foreground">
          {copy.truncated}
        </p>
      ) : null}
    </div>
  );
}

function interpretationStatusLabel(
  status: AiOrderAssistantResponse["interpretation_status"],
  locale: AppLocale,
) {
  const copy = getAiAssistantPresentationCopy(locale);
  if (status === "corrected") return copy.statusCorrected;
  if (status === "defaulted") return copy.statusDefaulted;
  if (status === "needs_confirmation") return copy.statusConfirm;
  if (status === "permission_limited") return copy.statusLimited;
  return copy.statusVerified;
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

function filterSourceLabel(
  source: AiOrderAssistantResponse["applied_filters"][number]["source"],
  locale: AppLocale,
) {
  const copy = getAiAssistantPresentationCopy(locale);
  if (source === "user_explicit") return copy.sourceUser;
  if (source === "server_derived") return copy.sourceServer;
  return copy.sourceDefault;
}

function OfflineState({ locale }: { locale: AppLocale }) {
  const copy = getAiAssistantPresentationCopy(locale);
  return (
    <div
      role="status"
      aria-live="polite"
      className="mb-3 flex items-start gap-2 rounded-xl border border-status-warn-foreground/25 bg-status-warn/40 p-3 text-status-warn-foreground"
    >
      <WifiOff className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
      <div>
        <p className="text-sm font-semibold">{copy.offline}</p>
        <p className="mt-0.5 text-xs leading-5">{copy.offlineHint}</p>
      </div>
    </div>
  );
}

function CapabilityUnavailableState({
  reason,
  locale,
}: {
  reason?: AiAssistantCapabilities["reason"];
  locale: AppLocale;
}) {
  const copy = getAiAssistantPresentationCopy(locale);
  const permissionDenied = reason === "permission_denied";
  return (
    <CenteredState
      icon={permissionDenied ? <ShieldCheck className="size-5" /> : <Sparkles className="size-5" />}
      title={permissionDenied ? copy.deniedTitle : copy.unavailableTitle}
      message={permissionDenied ? copy.deniedHint : copy.unavailableHint}
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

function toAssistantError(error: unknown, locale: AppLocale): AssistantErrorState {
  const copy = getAiAssistantPresentationCopy(locale);
  if (isRepairDeskRequestTimeoutError(error)) {
    return {
      title: copy.timeoutTitle,
      message: copy.timeoutMessage,
      retryable: true,
    };
  }
  if (error instanceof RepairDeskApiError) {
    if (error.code === "AI_DISABLED") {
      return { title: copy.disabledError, message: copy.unavailableTitle, retryable: false };
    }
    if (error.code === "AI_NOT_AUTHORIZED") {
      return { title: copy.unauthorizedError, message: copy.unauthorizedMessage, retryable: false };
    }
    if (error.code === "AI_QUOTA_EXHAUSTED") {
      return {
        title: copy.quotaError,
        message: copy.manualSearch,
        retryable: false,
      };
    }
    if (error.code === "AI_MISCONFIGURED") {
      return {
        title: copy.misconfigured,
        message: copy.manualSearch,
        retryable: false,
      };
    }
    if (error.code === "AI_SENSITIVE_INPUT") {
      return {
        title: copy.sensitiveTitle,
        message: copy.sensitiveMessage,
        retryable: false,
      };
    }
    if (error.code === "AI_BUDGET_UNAVAILABLE") {
      return {
        title: copy.budgetTitle,
        message: copy.budgetMessage,
        retryable: true,
      };
    }
    if (error.code === "AI_REQUEST_CANCELLED") {
      return { title: copy.cancelledTitle, message: copy.cancelledMessage, retryable: true };
    }
    if (error.code === "AI_PROVIDER_RATE_LIMITED") {
      return { title: copy.busyTitle, message: copy.busyMessage, retryable: true };
    }
  }
  return {
    title: copy.genericTitle,
    message: copy.genericMessage,
    retryable: true,
  };
}

function isAbortError(error: unknown) {
  return error instanceof DOMException && error.name === "AbortError";
}
