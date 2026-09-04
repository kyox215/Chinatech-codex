"use client";

import { useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  ArrowRight,
  CalendarClock,
  Check,
  Euro,
  Clock3,
  FileClock,
  Filter,
  Loader2,
  MessageCircleMore,
  MinusCircle,
  PencilLine,
  Plus,
  RefreshCw,
  Smartphone,
} from "lucide-react";
import { toast } from "sonner";

import { ImeiScannerField } from "@/components/imei-scanner-field";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { Skeleton } from "@/components/ui/skeleton";
import { Textarea } from "@/components/ui/textarea";
import {
  createTransparentBuybackQuote,
  listBuybackRecords,
  readTransparentBuybackHistory,
  recordTransparentBuybackResponse,
  reviseTransparentBuybackQuote,
} from "@/features/buyback/api/buyback-api";
import { buybackKeys } from "@/features/buyback/api/query-keys";
import { BUYBACK_SENSITIVE_WORKFLOW_ENABLED } from "@/features/buyback/model/buyback-evidence-policy";
import {
  classifyBuybackSafeError,
  formatBuybackDate,
  formatBuybackMoney,
  localizeBuybackDeduction,
  localizeBuybackFilter,
  localizeBuybackNextAction,
  localizeBuybackOutcome,
  localizeBuybackOutcomeAction,
  localizeBuybackRejectReason,
  localizeBuybackRevision,
  localizeBuybackRisk,
  localizeBuybackSafeError,
} from "@/features/buyback/model/buyback-i18n";
import { hasBuybackSensitiveText } from "@/features/buyback/model/buyback-sensitive-text";
import {
  ScanSearchButton,
  consumeScanSearchIntent,
  subscribeScanSearchIntent,
} from "@/features/capture";
import { useStoreShellContext } from "@/features/stores/api/use-store-shell-context";
import { StoreShellUnavailableState } from "@/features/stores/components/store-shell-unavailable-state";
import type {
  BuybackQuoteDeductionInput,
  BuybackQuoteOutcome,
  BuybackQuoteSnapshotInput,
  CreateBuybackQuoteInput,
  InventoryListItem,
  RecordBuybackQuoteResponseInput,
  ReviseBuybackQuoteInput,
} from "@/lib/repairdesk/types";
import { brandGradientStyle, controls, repairOs } from "@/lib/ui-patterns";
import { cn } from "@/lib/utils";
import {
  RepairOsBadge,
  RepairOsBusinessCard,
  RepairOsInfoTile,
  RepairOsListScaffold,
} from "@/shared/ui";
import { useLocale } from "@/shared/i18n/locale-provider";
import type { MessageKey } from "@/shared/i18n/messages";

type ListFilter = "all" | "awaiting" | BuybackQuoteOutcome;
type WorkspaceState =
  | { mode: "create"; item?: undefined }
  | { mode: "revise"; item: InventoryListItem; knownRevisionIds: string[] };
type AuthorityBound<T> = { authorityKey: string; value: T };
type BuybackAttempt = { fingerprint: string; key: string };
type BuybackRecovery = "checking" | "unknown" | "conflict" | "sync";
type CreateQuotePayload = Omit<CreateBuybackQuoteInput, "idempotency_key">;
type ReviseQuotePayload = Omit<ReviseBuybackQuoteInput, "idempotency_key">;
type ResponsePayload = Omit<RecordBuybackQuoteResponseInput, "idempotency_key">;
type WorkspaceValidationCode = "model" | "amount" | "battery" | "reason" | "sensitiveReason";
type BuybackFocusTarget = { authorityKey: string; element: HTMLButtonElement };

const workspaceValidationKeys = {
  model: "buyback2b5.validation.model",
  amount: "buyback2b5.validation.amount",
  battery: "buyback2b5.validation.battery",
  reason: "buyback2b5.validation.reason",
  sensitiveReason: "buyback2b5.validation.sensitive",
} as const satisfies Record<WorkspaceValidationCode, MessageKey>;

const scopeFilters = { sourceTypes: ["buyback"], categories: ["phone"] };
const brands = ["Apple", "Samsung", "Xiaomi", "Google", "Huawei", "OPPO", "OnePlus"];
const storageOptions = ["64GB", "128GB", "256GB", "512GB", "1TB"];
const sheetFloatingStyle = {
  "--repair-os-mobile-floating-offset": "0.75rem",
  // Keep the fixed footer inside the visual viewport while the shared Sheet fade enters.
  // The generic bottom-sheet translate starts the entire viewport-height shell off-screen.
  "--tw-enter-translate-y": "0px",
} as React.CSSProperties;

function operationFingerprint(operation: string, payload: unknown) {
  return JSON.stringify({ operation, payload });
}

function operationAttempt(
  current: BuybackAttempt | null,
  operation: string,
  payload: unknown,
): BuybackAttempt {
  const fingerprint = operationFingerprint(operation, payload);
  return current?.fingerprint === fingerprint ? current : { fingerprint, key: crypto.randomUUID() };
}

function canonicalQuoteSnapshot(value: unknown) {
  const quote = recordValue(value);
  return {
    reference_low: numberValue(quote.reference_low),
    reference_high: numberValue(quote.reference_high),
    final_offer: numberValue(quote.final_offer),
    deductions: deductionsFromQuote(quote),
    manual_adjustment_reason:
      typeof quote.manual_adjustment_reason === "string"
        ? quote.manual_adjustment_reason
        : undefined,
    risk_level: typeof quote.risk_level === "string" ? quote.risk_level : undefined,
    hard_block: quote.hard_block === true,
    expires_at: typeof quote.expires_at === "string" ? quote.expires_at : undefined,
  };
}

function quoteSnapshotsEqual(actual: unknown, expected: BuybackQuoteSnapshotInput) {
  return (
    operationFingerprint("quote.snapshot", canonicalQuoteSnapshot(actual)) ===
    operationFingerprint("quote.snapshot", canonicalQuoteSnapshot(expected))
  );
}

function isConflictError(error: unknown) {
  return classifyBuybackSafeError(error) === "conflict";
}

function isUnknownWriteResult(error: unknown) {
  if (!error || typeof error !== "object") return false;
  const source = error as Record<string, unknown>;
  const status = typeof source.status === "number" ? source.status : 0;
  const name = typeof source.name === "string" ? source.name : "";
  const code = typeof source.code === "string" ? source.code.toUpperCase() : "";
  return (
    name === "AbortError" ||
    name === "TimeoutError" ||
    code === "TIMEOUT" ||
    code === "ETIMEDOUT" ||
    status >= 500
  );
}

export function BuybackScreen() {
  const { t } = useLocale();
  const router = useRouter();
  const searchParams = useSearchParams();
  const searchParamsKey = searchParams.toString();
  const shell = useStoreShellContext();
  const storeId = shell.activeStore?.id;
  const role = shell.activeStore?.role;
  const authorityKey = shell.authorityFingerprint;
  const [isHydrated, setIsHydrated] = useState(false);
  useEffect(() => setIsHydrated(true), []);
  const canCreate = isHydrated && (role === "owner" || role === "manager" || role === "sales");
  const canRevise = isHydrated && (role === "owner" || role === "manager");
  const canRespond = isHydrated && (role === "owner" || role === "manager" || role === "sales");
  const [search, setSearch] = useState(() => searchParams.get("q") ?? "");
  const [filter, setFilter] = useState<ListFilter>("all");
  const [workspaceState, setWorkspaceState] = useState<AuthorityBound<WorkspaceState> | null>(null);
  const [selectedState, setSelectedState] = useState<AuthorityBound<InventoryListItem> | null>(
    null,
  );
  const [renderAuthorityKey, setRenderAuthorityKey] = useState(authorityKey);
  const currentAuthorityKeyRef = useRef(authorityKey);
  currentAuthorityKeyRef.current = authorityKey;
  const workspaceOpenerRef = useRef<BuybackFocusTarget | null>(null);
  const workspaceSheetAuthorityRef = useRef<string | null>(null);
  const detailOpenerRef = useRef<BuybackFocusTarget | null>(null);
  const detailSheetAuthorityRef = useRef<string | null>(null);
  const detailHandoffRef = useRef(false);
  const workspace = workspaceState?.authorityKey === authorityKey ? workspaceState.value : null;
  const selected = selectedState?.authorityKey === authorityKey ? selectedState.value : null;
  const authorityMatches = renderAuthorityKey === authorityKey;
  const isOnline = useOnlineStatus();
  const list = useQuery({
    queryKey: [
      ...buybackKeys.list({ ...scopeFilters, search: search.trim() || undefined }, storeId),
      "authority",
      authorityKey,
    ],
    queryFn: ({ signal }) =>
      listBuybackRecords({ ...scopeFilters, search: search.trim() || undefined }, { signal }),
    enabled: isHydrated && Boolean(storeId) && authorityMatches,
  });
  const items = useMemo(() => {
    const source = list.data ?? [];
    return source.filter((item) => {
      const outcome = quoteProjection(item).intent_outcome;
      if (filter === "all") return true;
      if (filter === "awaiting") return !outcome || outcome === "undecided";
      return outcome === filter;
    });
  }, [filter, list.data]);

  useEffect(() => {
    const query = new URLSearchParams(searchParamsKey).get("q") ?? "";
    setSearch((current) => (current === query ? current : query));
  }, [searchParamsKey]);

  useLayoutEffect(() => {
    if (renderAuthorityKey === authorityKey) return;
    workspaceOpenerRef.current = null;
    detailOpenerRef.current = null;
    detailHandoffRef.current = false;
    setWorkspaceState(null);
    setSelectedState(null);
    setSearch("");
    setFilter("all");
    setRenderAuthorityKey(authorityKey);
  }, [authorityKey, renderAuthorityKey]);

  useEffect(() => {
    if (new URLSearchParams(searchParamsKey).get("new") === "1" && canCreate) {
      workspaceSheetAuthorityRef.current = authorityKey;
      setWorkspaceState((current) =>
        current?.authorityKey === authorityKey
          ? current
          : { authorityKey, value: { mode: "create" } },
      );
    }
  }, [authorityKey, canCreate, searchParamsKey]);

  useEffect(() => {
    const applyIntent = (value: string) => {
      if (value) setSearch(value);
    };
    applyIntent(consumeScanSearchIntent("buyback"));
    return subscribeScanSearchIntent("buyback", applyIntent);
  }, []);

  useEffect(() => {
    const params = new URLSearchParams(searchParamsKey);
    const recordId = params.get("id") ?? params.get("record");
    if (!recordId) return;
    const match = (list.data ?? []).find(
      (item) => item.id === recordId || item.public_no === recordId,
    );
    if (match) {
      detailSheetAuthorityRef.current = authorityKey;
      setSelectedState({ authorityKey, value: match });
    } else setSearch((current) => current || recordId);
  }, [authorityKey, list.data, searchParamsKey]);

  const closeWorkspace = () => {
    setWorkspaceState(null);
    if (new URLSearchParams(searchParamsKey).get("new") === "1") {
      router.replace("/buyback", { scroll: false });
    }
  };

  const restoreSheetFocus = (
    event: Event,
    openerRef: React.MutableRefObject<BuybackFocusTarget | null>,
    sheetAuthorityRef: React.MutableRefObject<string | null>,
  ) => {
    const sheetAuthority = sheetAuthorityRef.current;
    const target = openerRef.current;
    sheetAuthorityRef.current = null;
    openerRef.current = null;
    if (sheetAuthority && sheetAuthority !== currentAuthorityKeyRef.current) {
      event.preventDefault();
      return;
    }
    if (!target) return;
    event.preventDefault();
    if (
      target.authorityKey !== currentAuthorityKeyRef.current ||
      !target.element.isConnected ||
      target.element.getClientRects().length === 0
    ) {
      return;
    }
    target.element.focus({ preventScroll: true });
  };

  if (!isHydrated || !authorityMatches || (shell.status === "loading" && !storeId)) {
    return (
      <Skeleton className="h-[52dvh] w-full rounded-2xl" aria-label={t("buyback2b5.loading")} />
    );
  }
  if (!storeId) {
    const shellError = shell.status === "error";
    return (
      <StoreShellUnavailableState
        shell={shell}
        onRetry={shell.retry}
        title={t(shellError ? "buyback2b5.store.error.title" : "buyback2b5.store.none.title")}
        description={t(
          shellError ? "buyback2b5.store.error.detail" : "buyback2b5.store.none.detail",
        )}
        retryLabel={t("buyback2b5.store.retry")}
        actionLabel={t("buyback2b5.store.action")}
      />
    );
  }

  return (
    <RepairOsListScaffold
      title={t("buyback.title")}
      subtitle={`${localizeBuybackFilter(filter, t)} · ${t("buyback2b5.records", { count: items.length })}`}
      eyebrow={t("buyback2b5.eyebrow")}
      searchValue={search}
      onSearchChange={setSearch}
      searchPlaceholder={t("buyback2b5.search")}
      searchPrefix={t("buyback2b5.searchPrefix")}
      clearSearchLabel={t("buyback2b5.clearSearch")}
      preparingStatus={t("buyback2b5.preparing")}
      searchAction={
        <ScanSearchButton scope="buyback" onSearch={setSearch} className="size-11 rounded-lg" />
      }
      filterAction={<BuybackFilterSelect value={filter} onChange={setFilter} compact />}
      action={
        <Button
          type="button"
          size="iconDense"
          aria-label={t("buyback2b5.new")}
          disabled={!canCreate}
          className="size-11 rounded-lg border-0 text-primary-foreground shadow-[var(--shadow-action)]"
          style={brandGradientStyle}
          onClick={(event) => {
            workspaceOpenerRef.current = { authorityKey, element: event.currentTarget };
            workspaceSheetAuthorityRef.current = authorityKey;
            setWorkspaceState({ authorityKey, value: { mode: "create" } });
          }}
        >
          <Plus className="size-4" />
        </Button>
      }
      desktopAction={
        <Button
          disabled={!canCreate}
          className={cn("gap-2", controls.brandButton)}
          style={brandGradientStyle}
          onClick={(event) => {
            workspaceOpenerRef.current = { authorityKey, element: event.currentTarget };
            workspaceSheetAuthorityRef.current = authorityKey;
            setWorkspaceState({ authorityKey, value: { mode: "create" } });
          }}
        >
          <Plus className="size-4" /> {t("buyback2b5.new")}
        </Button>
      }
    >
      <h1 className="sr-only">{t("buyback.title")}</h1>
      <div className="mb-2 hidden min-w-0 items-center gap-2 md:flex">
        <Input
          value={search}
          onChange={(event) => setSearch(event.target.value)}
          aria-label={t("buyback2b5.search")}
          placeholder={t("buyback2b5.search")}
          className="h-9 min-w-0 flex-1 text-base sm:text-sm"
        />
        <ScanSearchButton scope="buyback" onSearch={setSearch} className="size-9 rounded-lg" />
        <BuybackFilterSelect value={filter} onChange={setFilter} />
      </div>
      <section
        aria-label={t("buyback2b5.overview")}
        className={cn(
          repairOs.mobileInfoCard,
          "mb-2 grid grid-cols-3 divide-x divide-[var(--border-panel)] overflow-hidden p-1.5",
        )}
      >
        <SummaryTile
          label={t("buyback2b5.summary.awaiting")}
          value={(list.data ?? []).filter((item) => !resolvedOutcome(item)).length}
          icon={Clock3}
        />
        <SummaryTile
          label={t("buyback2b5.summary.accepted")}
          value={(list.data ?? []).filter((item) => resolvedOutcome(item) === "accepted").length}
          icon={Check}
        />
        <SummaryTile
          label={t("buyback2b5.summary.followup")}
          value={(list.data ?? []).filter((item) => resolvedOutcome(item) === "deferred").length}
          icon={MessageCircleMore}
        />
      </section>

      {!BUYBACK_SENSITIVE_WORKFLOW_ENABLED ? (
        <div className="mb-2 rounded-xl border border-status-info/25 bg-status-info/10 px-2.5 py-1.5 text-[10px] leading-4 text-status-info-foreground sm:text-xs lg:text-xs lg:leading-[18px]">
          {t("buyback2b5.quoteOnly")}
        </div>
      ) : null}

      {!isOnline ? (
        <div
          role="status"
          className="mb-2 rounded-xl border border-status-warn/30 bg-status-warn/10 px-2.5 py-1.5 text-[10px] leading-4 text-status-warn-foreground sm:text-xs lg:text-xs lg:leading-[18px]"
        >
          {t("buyback2b5.offline")}
        </div>
      ) : null}

      {isHydrated && !canCreate ? (
        <div
          role="note"
          className="mb-2 rounded-xl border border-[var(--border-panel)] bg-[var(--surface-panel-muted)] px-2.5 py-1.5 text-[10px] leading-4 text-muted-foreground sm:text-xs lg:text-xs lg:leading-[18px]"
        >
          {t("buyback2b5.readOnly")}
        </div>
      ) : null}

      {list.isError && list.data ? (
        <div
          role="status"
          className="mb-2 rounded-xl border border-status-warn/30 bg-status-warn/10 px-2.5 py-1.5 text-xs text-status-warn-foreground"
        >
          {t("buyback2b5.stale")}
          <Button type="button" variant="ghost" size="sm" onClick={() => void list.refetch()}>
            {t("buyback2b5.retry")}
          </Button>
        </div>
      ) : null}

      {list.isLoading ? (
        <div
          role="status"
          aria-label={t("buyback2b5.loading")}
          className="grid gap-2 md:grid-cols-2 xl:grid-cols-3"
        >
          {Array.from({ length: 6 }).map((_, index) => (
            <Skeleton key={index} className="h-28 rounded-xl" />
          ))}
        </div>
      ) : list.isError && !list.data ? (
        <EmptyState
          title={t("buyback2b5.loadError.title")}
          detail={
            list.error ? localizeBuybackSafeError(list.error, t) : t("buyback2b5.loadError.detail")
          }
          actionLabel={t("buyback2b5.retry")}
          onAction={() => void list.refetch()}
        />
      ) : items.length === 0 ? (
        <EmptyState
          title={
            search || filter !== "all"
              ? t("buyback2b5.empty.filtered.title")
              : t("buyback2b5.empty.title")
          }
          detail={
            search || filter !== "all"
              ? t("buyback2b5.empty.filtered.detail")
              : t("buyback2b5.empty.detail")
          }
          actionLabel={canCreate ? t("buyback2b5.empty.action") : undefined}
          onAction={
            canCreate
              ? (event) => {
                  workspaceOpenerRef.current = { authorityKey, element: event.currentTarget };
                  workspaceSheetAuthorityRef.current = authorityKey;
                  setWorkspaceState({ authorityKey, value: { mode: "create" } });
                }
              : undefined
          }
        />
      ) : (
        <section
          data-buyback-list="true"
          className="grid min-w-0 gap-2 md:grid-cols-2 xl:grid-cols-3"
        >
          {items.map((item) => (
            <QuoteCard
              key={item.id}
              item={item}
              onOpen={(event) => {
                detailOpenerRef.current = { authorityKey, element: event.currentTarget };
                detailSheetAuthorityRef.current = authorityKey;
                setSelectedState({ authorityKey, value: item });
              }}
            />
          ))}
        </section>
      )}

      {workspace !== null ? (
        <TransparentQuoteWorkspace
          state={workspace}
          isOnline={isOnline}
          onClose={closeWorkspace}
          onCloseAutoFocus={(event) =>
            restoreSheetFocus(event, workspaceOpenerRef, workspaceSheetAuthorityRef)
          }
          onSaved={() => {
            closeWorkspace();
          }}
          onRefresh={async (itemId) => {
            const refreshed = await list.refetch({ throwOnError: true });
            return (refreshed.data ?? []).find((item) => item.id === itemId);
          }}
        />
      ) : null}
      {selected !== null ? (
        <TransparentQuoteDetail
          item={selected}
          canRevise={canRevise}
          canRespond={canRespond}
          isOnline={isOnline}
          storeId={storeId}
          onClose={() => setSelectedState(null)}
          onCloseAutoFocus={(event) => {
            if (detailHandoffRef.current) {
              detailHandoffRef.current = false;
              detailSheetAuthorityRef.current = null;
              event.preventDefault();
              return;
            }
            restoreSheetFocus(event, detailOpenerRef, detailSheetAuthorityRef);
          }}
          onRevise={(item, knownRevisionIds) => {
            workspaceOpenerRef.current = detailOpenerRef.current;
            workspaceSheetAuthorityRef.current = authorityKey;
            detailOpenerRef.current = null;
            detailHandoffRef.current = true;
            setSelectedState(null);
            setWorkspaceState({
              authorityKey,
              value: { mode: "revise", item, knownRevisionIds },
            });
          }}
          onRefresh={async (itemId) => {
            const refreshed = await list.refetch({ throwOnError: true });
            const item = (refreshed.data ?? []).find((candidate) => candidate.id === itemId);
            if (item) setSelectedState({ authorityKey, value: item });
            return item;
          }}
          onSaved={() => {
            setSelectedState(null);
          }}
        />
      ) : null}
    </RepairOsListScaffold>
  );
}

function BuybackFilterSelect({
  value,
  onChange,
  compact = false,
}: {
  value: ListFilter;
  onChange: (value: ListFilter) => void;
  compact?: boolean;
}) {
  const { t } = useLocale();
  return (
    <Select value={value} onValueChange={(next) => onChange(next as ListFilter)}>
      <SelectTrigger
        aria-label={t("buyback2b5.filter.label")}
        className={compact ? "size-11 rounded-lg px-2 [&>span]:sr-only" : "h-9 w-44 rounded-lg"}
      >
        <SelectValue />
        {compact ? <Filter className="size-4" /> : null}
      </SelectTrigger>
      <SelectContent>
        {(["all", "awaiting", "accepted", "deferred", "rejected"] as const).map((code) => (
          <SelectItem key={code} value={code}>
            {localizeBuybackFilter(code, t)}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}

function SummaryTile({
  label,
  value,
  icon: Icon,
}: {
  label: string;
  value: number;
  icon: typeof Clock3;
}) {
  return (
    <div className="flex min-w-0 items-center justify-center gap-1.5 px-1.5 py-1">
      <Icon className="size-3.5 shrink-0 text-primary" />
      <div className="min-w-0">
        <p className="truncate text-[9px] leading-3 text-muted-foreground sm:text-[10px] lg:text-[11px] lg:leading-4">
          {label}
        </p>
        <p className="text-sm font-semibold leading-4 tabular-nums">{value}</p>
      </div>
    </div>
  );
}

function QuoteCard({
  item,
  onOpen,
}: {
  item: InventoryListItem;
  onOpen: (event: React.MouseEvent<HTMLButtonElement>) => void;
}) {
  const { locale, t } = useLocale();
  const quote = quoteProjection(item);
  const outcome = resolvedOutcome(item);
  const expired = quote.expires_at ? Date.parse(String(quote.expires_at)) <= Date.now() : false;
  return (
    <RepairOsBusinessCard
      as="button"
      type="button"
      onClick={onOpen}
      className="h-full min-w-0 grid-cols-1 gap-1.5 p-2 text-left transition-colors hover:border-primary/35 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
    >
      <div className="flex min-w-0 items-start justify-between gap-2">
        <div className="min-w-0">
          <div className="flex items-center gap-1.5">
            <span className="font-mono text-xs font-semibold text-primary">{item.public_no}</span>
            <OutcomeBadge outcome={outcome} />
          </div>
          <h2 className="mt-0.5 truncate text-sm font-semibold leading-4">{item.item_label}</h2>
          <p className="truncate text-[10px] leading-4 text-muted-foreground lg:text-[13px] lg:leading-5">
            {[item.color, item.storage_capacity, maskIdentifier(item.serial_or_imei)]
              .filter(Boolean)
              .join(" · ") || t("buyback2b5.device.pending")}
          </p>
        </div>
        <div className="shrink-0 text-right">
          <p className="font-mono text-base font-semibold leading-5 text-primary">
            {formatBuybackMoney(numberValue(quote.final_offer), locale)}
          </p>
          <p className="text-[9px] text-muted-foreground lg:text-[11px] lg:leading-4">
            {t("buyback2b5.card.currentOffer")}
          </p>
        </div>
      </div>
      <div className="flex min-w-0 items-center gap-1.5 text-[10px] leading-4 text-muted-foreground lg:text-[11px] lg:leading-4">
        <span className="truncate">
          {t("buyback2b5.card.reference", {
            amount: rangeLabel(quote.reference_low, quote.reference_high, locale),
          })}
        </span>
        <span aria-hidden="true">·</span>
        <span className="shrink-0">
          {t("buyback2b5.card.deductions", { count: deductionsFromQuote(quote).length })}
        </span>
        <span aria-hidden="true">·</span>
        <span className={cn("shrink-0", expired && "text-status-danger-foreground")}>
          {expired ? t("buyback2b5.card.expired") : formatBuybackDate(quote.expires_at, locale, t)}
        </span>
      </div>
      <div className="flex min-w-0 items-center justify-between border-t border-[var(--border-panel)] pt-1.5 text-[10px] leading-4 lg:text-[11px] lg:leading-4">
        <span className="truncate text-muted-foreground">
          {localizeBuybackNextAction(outcome, expired, quote.hard_block === true, t)}
        </span>
        <ArrowRight className="size-3.5 text-primary" />
      </div>
    </RepairOsBusinessCard>
  );
}

function TransparentQuoteDetail({
  item,
  canRevise,
  canRespond,
  isOnline,
  storeId,
  onClose,
  onCloseAutoFocus,
  onRevise,
  onRefresh,
  onSaved,
}: {
  item: InventoryListItem | null;
  canRevise: boolean;
  canRespond: boolean;
  isOnline: boolean;
  storeId?: string;
  onClose: () => void;
  onCloseAutoFocus: (event: Event) => void;
  onRevise: (item: InventoryListItem, knownRevisionIds: string[]) => void;
  onRefresh: (itemId: string) => Promise<InventoryListItem | undefined>;
  onSaved: () => void;
}) {
  const { locale, t } = useLocale();
  const client = useQueryClient();
  const [outcome, setOutcome] = useState<BuybackQuoteOutcome | "">("");
  const [reason, setReason] = useState("");
  const [note, setNote] = useState("");
  const [showNote, setShowNote] = useState(false);
  const [showAllDeductions, setShowAllDeductions] = useState(false);
  const [showHistory, setShowHistory] = useState(false);
  const [noteSensitive, setNoteSensitive] = useState(false);
  const [recovery, setRecovery] = useState<BuybackRecovery | null>(null);
  const responseAttemptRef = useRef<BuybackAttempt | null>(null);
  const responseSubmitLockRef = useRef(false);
  const responseActiveRef = useRef(true);
  const noteRef = useRef<HTMLTextAreaElement>(null);
  const itemId = item?.id;
  const history = useQuery({
    queryKey: buybackKeys.history(item?.id ?? "closed", storeId),
    queryFn: () => readTransparentBuybackHistory(item!.id),
    enabled: Boolean(item),
  });
  useEffect(() => {
    setOutcome("");
    setReason("");
    setNote("");
    setShowNote(false);
    setShowAllDeductions(false);
    setShowHistory(false);
    setNoteSensitive(false);
    setRecovery(null);
    responseAttemptRef.current = null;
    responseSubmitLockRef.current = false;
  }, [itemId]);
  useEffect(() => {
    responseActiveRef.current = true;
    return () => {
      responseActiveRef.current = false;
      responseSubmitLockRef.current = true;
    };
  }, []);
  const synchronizeResponse = async () => {
    if (!responseActiveRef.current) return;
    setRecovery("checking");
    try {
      await client.invalidateQueries({ queryKey: buybackKeys.all }, { throwOnError: true });
      if (!responseActiveRef.current) return;
      responseAttemptRef.current = null;
      responseSubmitLockRef.current = false;
      toast.success(t("buyback2b5.detail.responseSaved"));
      onSaved();
    } catch {
      if (responseActiveRef.current) setRecovery("sync");
    }
  };
  const mutation = useMutation({
    mutationFn: async ({
      targetId,
      payload,
      key,
    }: {
      targetId: string;
      payload: ResponsePayload;
      key: string;
      knownResponseIds: string[] | null;
    }) => {
      if (!isOnline || !navigator.onLine) throw { code: "OFFLINE" };
      return recordTransparentBuybackResponse(targetId, { ...payload, idempotency_key: key });
    },
    onSuccess: () => {
      void synchronizeResponse();
    },
    onError: (error, command) => {
      if (!responseActiveRef.current) return;
      if (isConflictError(error)) {
        toast.error(localizeBuybackSafeError(error, t));
        responseSubmitLockRef.current = false;
        setRecovery("conflict");
        return;
      }
      if (!isUnknownWriteResult(error)) {
        toast.error(localizeBuybackSafeError(error, t));
        responseSubmitLockRef.current = false;
        setRecovery(null);
        return;
      }
      setRecovery("checking");
      void readTransparentBuybackHistory(command.targetId)
        .then((result) => {
          if (!responseActiveRef.current) return;
          const known = command.knownResponseIds ? new Set(command.knownResponseIds) : null;
          const committed =
            known !== null &&
            result.responses.some(
              (entry) =>
                !known.has(entry.id) &&
                entry.quote_revision_id === command.payload.quote_revision_id &&
                entry.outcome === command.payload.outcome &&
                (entry.reason_code || undefined) === command.payload.reason_code &&
                (entry.note || undefined) === command.payload.note,
            );
          if (committed) void synchronizeResponse();
          else {
            toast.error(t("buyback2b5.operation.unknown"));
            setRecovery("unknown");
          }
        })
        .catch(() => {
          if (!responseActiveRef.current) return;
          toast.error(t("buyback2b5.operation.unknown"));
          setRecovery("unknown");
        });
    },
  });
  if (!item) return null;
  const quote = quoteProjection(item);
  const currentOutcome = resolvedOutcome(item);
  const deductions = deductionsFromQuote(quote);
  const isExpired = quote.expires_at ? Date.parse(String(quote.expires_at)) <= Date.now() : false;
  const hasRevision = typeof quote.current_revision_id === "string" && quote.current_revision_id;
  const visibleDeductions = showAllDeductions ? deductions : deductions.slice(0, 2);
  const deductionTotal = deductions.reduce((sum, row) => sum + row.amount, 0);
  const suggested = Math.max(0, numberValue(quote.reference_high) - deductionTotal);
  const finalOffer = numberValue(quote.final_offer);
  const manualDelta = finalOffer - suggested;
  const latestRevision = latestByCreatedAt(history.data?.revisions);
  const latestResponse = latestByCreatedAt(history.data?.responses);
  const acceptDisabled =
    isExpired || quote.hard_block === true || numberValue(quote.final_offer) <= 0;
  const responseLocked = currentOutcome === "accepted" || currentOutcome === "rejected";
  const submitResponse = () => {
    if (responseSubmitLockRef.current || !item || !outcome || !hasRevision) return;
    if (note.trim() && hasBuybackSensitiveText(note)) {
      setNoteSensitive(true);
      window.requestAnimationFrame(() => noteRef.current?.focus());
      return;
    }
    setNoteSensitive(false);
    const payload: ResponsePayload = {
      expected_updated_at: item.updated_at,
      quote_revision_id: String(quote.current_revision_id),
      outcome,
      reason_code: outcome === "rejected" ? reason || undefined : undefined,
      note: note.trim() || undefined,
    };
    const attempt = operationAttempt(responseAttemptRef.current, "response.record", {
      targetId: item.id,
      payload,
    });
    responseAttemptRef.current = attempt;
    responseSubmitLockRef.current = true;
    setRecovery(null);
    mutation.mutate({
      targetId: item.id,
      payload,
      key: attempt.key,
      knownResponseIds: history.isSuccess
        ? (history.data?.responses ?? []).map((entry) => entry.id)
        : null,
    });
  };
  return (
    <Sheet open onOpenChange={(open) => !open && onClose()}>
      <SheetContent
        side="bottom"
        closeLabel={t("buyback2b5.detail.close")}
        onCloseAutoFocus={onCloseAutoFocus}
        style={sheetFloatingStyle}
        className="bottom-1 left-1/2 right-auto top-1 flex h-auto max-h-none min-h-0 w-[calc(100vw-0.5rem)] -translate-x-1/2 flex-col gap-0 overflow-hidden rounded-2xl p-0 md:bottom-4 md:top-auto md:h-[min(90svh,780px)] md:max-h-[min(90svh,780px)] md:w-[min(980px,calc(100vw-2rem))]"
      >
        <div
          data-buyback-scroll-body="detail"
          className="min-h-0 flex-1 basis-0 overflow-y-auto overscroll-contain p-2 pb-3 sm:p-4 lg:grid lg:grid-cols-[1.05fr_0.95fr] lg:content-start lg:gap-2"
        >
          <SheetHeader className="text-left lg:col-span-2">
            <SheetTitle className="flex items-center gap-2 text-base">
              <Smartphone className="size-4 text-primary" />
              {item.item_label}
            </SheetTitle>
            <SheetDescription>
              {item.public_no} ·{" "}
              {maskIdentifier(item.serial_or_imei) || t("buyback2b5.value.hiddenIdentifier")}
            </SheetDescription>
          </SheetHeader>
          <section
            className={cn(
              repairOs.mobileInfoCard,
              "mt-2 p-2 lg:col-start-1 lg:row-start-2 lg:mt-0",
            )}
          >
            <div className="flex items-end justify-between gap-3">
              <div>
                <p className="text-[10px] text-muted-foreground lg:text-xs lg:leading-4">
                  {t("buyback2b5.detail.currentOffer")}
                </p>
                <p className="font-mono text-2xl font-semibold leading-7 text-primary">
                  {formatBuybackMoney(finalOffer, locale)}
                </p>
              </div>
              <OutcomeBadge outcome={resolvedOutcome(item)} />
            </div>
            <div className="mt-2 grid grid-cols-2 gap-1.5">
              <MiniTile
                label={t("buyback2b5.detail.initialReference")}
                value={rangeLabel(quote.reference_low, quote.reference_high, locale)}
              />
              <MiniTile
                label={t("buyback2b5.detail.suggestion")}
                value={formatBuybackMoney(suggested, locale)}
              />
              <MiniTile
                label={t("buyback2b5.detail.manualDelta")}
                value={signedMoney(manualDelta, locale)}
                danger={manualDelta < 0}
              />
              <MiniTile
                label={t("buyback2b5.detail.riskExpiry")}
                value={`${localizeBuybackRisk(String(quote.risk_level ?? ""), quote.hard_block === true, t)} · ${formatBuybackDate(quote.expires_at, locale, t)}`}
                danger={isExpired || quote.hard_block === true}
              />
            </div>
          </section>
          <section
            className={cn(repairOs.mobileInfoCard, "mt-2 p-2 lg:col-start-1 lg:row-start-3")}
          >
            <div className="flex items-center justify-between gap-2">
              <h3 className="text-xs font-semibold">{t("buyback2b5.detail.how")}</h3>
              <span className="text-[10px] text-muted-foreground lg:text-[11px] lg:leading-4">
                {t("buyback2b5.detail.deductionCount", { count: deductions.length })}
              </span>
            </div>
            <div id="buyback-deductions-content" className="mt-1.5 space-y-1">
              {deductions.length ? (
                visibleDeductions.map((row) => (
                  <div
                    key={row.code}
                    className="flex min-h-8 items-center justify-between rounded-lg bg-[var(--surface-panel-muted)] px-2 py-1 text-[11px] lg:text-xs lg:leading-4"
                  >
                    <span>{localizeBuybackDeduction(row.code, row.label, t)}</span>
                    <span className="font-mono font-semibold text-status-danger-foreground">
                      -{formatBuybackMoney(row.amount, locale)}
                    </span>
                  </div>
                ))
              ) : (
                <p className="rounded-lg bg-[var(--surface-panel-muted)] px-2 py-1.5 text-[11px] text-muted-foreground lg:text-xs lg:leading-4">
                  {t("buyback2b5.detail.noDeductions")}
                </p>
              )}
            </div>
            {deductions.length > 2 ? (
              <Button
                type="button"
                variant="ghost"
                aria-expanded={showAllDeductions}
                aria-controls="buyback-deductions-content"
                className="mt-1 h-[38px] w-full rounded-lg text-base"
                onClick={() => setShowAllDeductions((value) => !value)}
              >
                {showAllDeductions
                  ? t("buyback2b5.detail.collapseDeductions")
                  : t("buyback2b5.detail.showDeductions", { count: deductions.length })}
              </Button>
            ) : null}
            {typeof quote.manual_adjustment_reason === "string" ? (
              <p className="mt-1.5 rounded-lg border border-[var(--border-panel)] px-2 py-1.5 text-[11px] text-muted-foreground lg:text-xs lg:leading-4">
                {t("buyback2b5.detail.adjustmentReason")}: {quote.manual_adjustment_reason}
              </p>
            ) : null}
          </section>
          <section
            className={cn(
              repairOs.mobileInfoCard,
              "mt-2 p-2 lg:col-start-2 lg:row-start-2 lg:mt-0",
            )}
          >
            <div className="flex items-center justify-between">
              <h3 id="buyback-response-heading" className="text-xs font-semibold">
                {t("buyback2b5.detail.responseTitle")}
              </h3>
              <span className="text-[10px] text-muted-foreground lg:text-[11px] lg:leading-4">
                {t("buyback2b5.detail.verbalOnly")}
              </span>
            </div>
            <RadioGroup
              aria-labelledby="buyback-response-heading"
              value={outcome}
              onValueChange={(value) => setOutcome(value as BuybackQuoteOutcome)}
              className="mt-1.5 grid-cols-3 gap-1"
            >
              {(["accepted", "deferred", "rejected"] as const).map((value) => (
                <label
                  key={value}
                  className={cn(
                    "flex min-h-8 cursor-pointer items-center justify-center gap-1.5 rounded-lg border px-1.5 text-xs",
                    outcome === value && "border-primary bg-primary/5",
                    value === "accepted" && acceptDisabled && "cursor-not-allowed opacity-45",
                  )}
                >
                  <RadioGroupItem
                    value={value}
                    disabled={value === "accepted" && acceptDisabled}
                    aria-describedby={
                      value === "accepted" && acceptDisabled
                        ? "buyback-accept-block-reason"
                        : undefined
                    }
                  />
                  <span>{localizeBuybackOutcomeAction(value, t)}</span>
                </label>
              ))}
            </RadioGroup>
            {outcome === "rejected" ? (
              <Select value={reason} onValueChange={setReason}>
                <SelectTrigger
                  aria-label={t("buyback2b5.detail.rejectPlaceholder")}
                  className="mt-2 h-[38px] rounded-lg"
                >
                  <SelectValue placeholder={t("buyback2b5.detail.rejectPlaceholder")} />
                </SelectTrigger>
                <SelectContent>
                  {(["price_gap", "changed_mind", "other_channel", "other"] as const).map(
                    (code) => (
                      <SelectItem key={code} value={code}>
                        {localizeBuybackRejectReason(code, t)}
                      </SelectItem>
                    ),
                  )}
                </SelectContent>
              </Select>
            ) : null}
            {showNote ? (
              <div>
                <Textarea
                  ref={noteRef}
                  value={note}
                  onChange={(event) => {
                    setNote(event.target.value);
                    setNoteSensitive(false);
                  }}
                  maxLength={240}
                  aria-label={t("buyback2b5.detail.notePlaceholder")}
                  aria-invalid={noteSensitive}
                  aria-describedby={noteSensitive ? "buyback-response-note-error" : undefined}
                  placeholder={t("buyback2b5.detail.notePlaceholder")}
                  className="mt-1.5 min-h-16 rounded-xl text-base sm:text-sm"
                />
                {noteSensitive ? (
                  <p
                    id="buyback-response-note-error"
                    role="alert"
                    className="mt-1 text-[11px] text-status-danger-foreground"
                  >
                    {t("buyback2b5.validation.sensitive")}
                  </p>
                ) : null}
              </div>
            ) : (
              <Button
                type="button"
                variant="ghost"
                className="mt-1 h-[38px] w-full rounded-lg text-base"
                onClick={() => setShowNote(true)}
              >
                {t("buyback2b5.detail.addNote")}
              </Button>
            )}
            {acceptDisabled ? (
              <p
                id="buyback-accept-block-reason"
                className="mt-2 text-[11px] text-status-warn-foreground lg:text-xs lg:leading-[18px]"
              >
                {t("buyback2b5.detail.acceptBlocked")}
              </p>
            ) : null}
            {responseLocked ? (
              <p className="mt-2 text-[11px] text-status-warn-foreground lg:text-xs lg:leading-[18px]">
                {t("buyback2b5.detail.responseLocked")}
              </p>
            ) : null}
            {!hasRevision ? (
              <p className="mt-2 text-[11px] text-status-warn-foreground lg:text-xs lg:leading-[18px]">
                {t("buyback2b5.detail.noConfirmableRevision")}
              </p>
            ) : null}
            <p className="mt-2 rounded-lg border border-status-info/25 bg-status-info/10 px-2 py-1.5 text-[10px] leading-4 text-status-info-foreground lg:text-xs lg:leading-[18px]">
              {t("buyback2b5.detail.quoteOnly")}
            </p>
            {mutation.isError || recovery ? (
              <div
                role="alert"
                className="mt-2 rounded-xl border border-status-danger/25 bg-status-danger/10 p-2"
              >
                <p
                  data-error-kind={
                    recovery ?? (mutation.isError ? classifyBuybackSafeError(mutation.error) : null)
                  }
                  className="text-[11px] text-status-danger-foreground lg:text-xs lg:leading-[18px]"
                >
                  {recovery === "checking"
                    ? t("buyback2b5.operation.checking")
                    : recovery === "unknown"
                      ? t("buyback2b5.operation.unknown")
                      : recovery === "sync"
                        ? t("buyback2b5.operation.syncFailed")
                        : localizeBuybackSafeError(mutation.error, t)}
                </p>
                {recovery && recovery !== "checking" ? (
                  <Button
                    type="button"
                    variant="outline"
                    className="mt-1 h-[38px] rounded-lg text-base"
                    onClick={() => {
                      if (recovery === "sync") {
                        void synchronizeResponse();
                        return;
                      }
                      if (recovery === "unknown") {
                        responseSubmitLockRef.current = false;
                        setRecovery(null);
                        mutation.reset();
                        return;
                      }
                      void onRefresh(item.id)
                        .then((latest) => {
                          if (!latest) throw new Error("buyback-response-refresh-missing");
                          responseSubmitLockRef.current = false;
                          setRecovery(null);
                          mutation.reset();
                        })
                        .catch(() => toast.error(t("buyback2b5.operation.refreshFailed")));
                    }}
                  >
                    {recovery === "sync"
                      ? t("buyback2b5.operation.retrySync")
                      : recovery === "unknown"
                        ? t("buyback2b5.operation.retryWrite")
                        : t("buyback2b5.detail.refresh")}
                  </Button>
                ) : null}
              </div>
            ) : null}
          </section>
          <section
            className={cn(repairOs.mobileInfoCard, "mt-2 p-2 lg:col-start-2 lg:row-start-3")}
          >
            <button
              type="button"
              aria-label={
                showHistory ? t("buyback2b5.detail.collapse") : t("buyback2b5.detail.expand")
              }
              aria-expanded={showHistory}
              aria-controls="buyback-history-content"
              className="flex min-h-9 w-full items-center justify-between gap-2 rounded-lg text-left text-xs font-semibold"
              onClick={() => setShowHistory((value) => !value)}
            >
              <span className="flex items-center gap-2">
                <FileClock className="size-4 text-primary" /> {t("buyback2b5.detail.history")}
              </span>
              <span className="text-[10px] font-normal text-muted-foreground lg:text-[11px] lg:leading-4">
                {showHistory ? t("buyback2b5.detail.collapse") : t("buyback2b5.detail.expand")}
              </span>
            </button>
            <div className="mt-1 grid gap-1 text-[10px] text-muted-foreground sm:grid-cols-2 lg:text-[11px] lg:leading-4">
              {history.isLoading ? (
                <Skeleton className="h-9 rounded-lg sm:col-span-2" />
              ) : history.isError ? (
                <p className="sm:col-span-2">{t("buyback2b5.detail.historyHint")}</p>
              ) : (
                <>
                  <p className="truncate rounded-lg bg-[var(--surface-panel-muted)] px-2 py-1.5">
                    {t("buyback2b5.detail.latestQuote")}:
                    {latestRevision
                      ? `V${latestRevision.revision_no} · ${formatBuybackMoney(latestRevision.quote.final_offer, locale)}`
                      : t("buyback2b5.detail.noRevision")}
                  </p>
                  <p className="truncate rounded-lg bg-[var(--surface-panel-muted)] px-2 py-1.5">
                    {t("buyback2b5.detail.latestResponse")}:
                    {latestResponse
                      ? `${localizeBuybackOutcome(latestResponse.outcome, t)} · ${formatBuybackDate(latestResponse.created_at, locale, t, true)}`
                      : t("buyback2b5.detail.awaitingResponse")}
                  </p>
                </>
              )}
            </div>
            {showHistory ? (
              <div id="buyback-history-content" className="mt-1 space-y-2">
                {history.isLoading ? (
                  <Skeleton className="h-16 rounded-xl" />
                ) : history.isError ? (
                  <div className="rounded-xl border border-status-danger/25 bg-status-danger/10 p-3">
                    <p className="text-xs text-status-danger-foreground">
                      {t("buyback2b5.detail.historyError")}
                    </p>
                    <Button
                      type="button"
                      variant="outline"
                      className="mt-2 h-[38px] rounded-lg"
                      onClick={() => void history.refetch()}
                    >
                      {t("buyback2b5.detail.reloadHistory")}
                    </Button>
                  </div>
                ) : history.data?.revisions.length || history.data?.responses.length ? (
                  <>
                    <div className="space-y-1">
                      <p className="text-[10px] font-semibold text-muted-foreground lg:text-xs lg:leading-4">
                        {t("buyback2b5.detail.quoteVersions")}
                      </p>
                      {sortNewest(history.data?.revisions)
                        .slice(0, 4)
                        .map((revision) => (
                          <div
                            key={revision.id}
                            className="grid grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-2 rounded-lg bg-[var(--surface-panel-muted)] px-2 py-1.5"
                          >
                            <span className="grid size-7 place-items-center rounded-full bg-card text-[10px] font-semibold lg:text-[11px] lg:leading-4">
                              V{revision.revision_no}
                            </span>
                            <div className="min-w-0">
                              <p className="truncate text-xs font-medium">
                                {revision.change_reason ||
                                  localizeBuybackRevision(revision.kind, t)}
                              </p>
                              <p className="truncate text-[10px] text-muted-foreground lg:text-[11px] lg:leading-4">
                                {revision.actor_name} ·{" "}
                                {formatBuybackDate(revision.created_at, locale, t, true)}
                              </p>
                            </div>
                            <span className="font-mono text-xs font-semibold">
                              {formatBuybackMoney(revision.quote.final_offer, locale)}
                            </span>
                          </div>
                        ))}
                    </div>
                    <div className="space-y-1">
                      <p className="text-[10px] font-semibold text-muted-foreground lg:text-xs lg:leading-4">
                        {t("buyback2b5.detail.customerResponses")}
                      </p>
                      {sortNewest(history.data?.responses)
                        .slice(0, 4)
                        .map((response) => (
                          <div
                            key={response.id}
                            className="grid grid-cols-[auto_minmax(0,1fr)] items-center gap-2 rounded-lg bg-[var(--surface-panel-muted)] px-2 py-1.5"
                          >
                            <OutcomeBadge outcome={response.outcome} />
                            <div className="min-w-0">
                              <p className="truncate text-xs font-medium">
                                {response.note || localizeBuybackOutcome(response.outcome, t)}
                              </p>
                              <p className="truncate text-[10px] text-muted-foreground lg:text-[11px] lg:leading-4">
                                {response.actor_name} ·{" "}
                                {formatBuybackDate(response.created_at, locale, t, true)}
                              </p>
                            </div>
                          </div>
                        ))}
                      {!history.data?.responses.length ? (
                        <p className="text-xs text-muted-foreground">
                          {t("buyback2b5.detail.noResponse")}
                        </p>
                      ) : null}
                    </div>
                  </>
                ) : (
                  <p className="text-xs text-muted-foreground">
                    {t("buyback2b5.detail.legacyHistory")}
                  </p>
                )}
              </div>
            ) : null}
          </section>
        </div>
        <div
          data-buyback-fixed-footer="detail"
          className="shrink-0 border-t border-[var(--border-panel)] bg-[var(--surface-workspace-strong)] p-2 pb-[max(0.5rem,env(safe-area-inset-bottom))]"
        >
          <div
            id="buyback-footer-permission-summary"
            className="mb-1 flex min-w-0 items-center justify-between gap-2 text-[10px] leading-4 lg:text-[11px]"
          >
            <span className="shrink-0 font-semibold text-primary">
              {t("buyback2b5.detail.final")} {formatBuybackMoney(finalOffer, locale)}
            </span>
            <span className="truncate text-right text-muted-foreground">
              {!canRespond
                ? t("buyback2b5.detail.readOnly")
                : !canRevise
                  ? t("buyback2b5.detail.revisePermission")
                  : outcome
                    ? t("buyback2b5.detail.selected", {
                        outcome: localizeBuybackOutcomeAction(outcome, t),
                      })
                    : t("buyback2b5.detail.selectResponse")}
            </span>
          </div>
          <div className="grid grid-cols-[1fr_1.5fr] gap-1.5">
            <Button
              variant="outline"
              className="h-auto min-h-11 whitespace-normal rounded-lg text-center leading-tight"
              disabled={!canRevise || !history.isSuccess}
              aria-describedby={!canRevise ? "buyback-footer-permission-summary" : undefined}
              onClick={() =>
                onRevise(
                  item,
                  (history.data?.revisions ?? []).map((revision) => revision.id),
                )
              }
            >
              <PencilLine className="mr-1 size-4" />
              {t("buyback2b5.detail.revise")}
            </Button>
            <Button
              className={cn(
                "h-auto min-h-11 whitespace-normal rounded-lg text-center leading-tight",
                controls.brandButton,
              )}
              style={brandGradientStyle}
              aria-describedby="buyback-footer-permission-summary"
              disabled={
                !canRespond ||
                !isOnline ||
                responseLocked ||
                !hasRevision ||
                !outcome ||
                (outcome === "rejected" && !reason) ||
                mutation.isPending ||
                recovery !== null
              }
              onClick={submitResponse}
            >
              {mutation.isPending ? (
                <Loader2 className="mr-1 size-4 animate-spin" />
              ) : (
                <Check className="mr-1 size-4" />
              )}
              {outcome
                ? t("buyback2b5.detail.saveOutcome", {
                    outcome: localizeBuybackOutcomeAction(outcome, t),
                  })
                : t("buyback2b5.detail.saveResponse")}
            </Button>
          </div>
        </div>
      </SheetContent>
    </Sheet>
  );
}

function TransparentQuoteWorkspace({
  state,
  isOnline,
  onClose,
  onCloseAutoFocus,
  onSaved,
  onRefresh,
}: {
  state: WorkspaceState | null;
  isOnline: boolean;
  onClose: () => void;
  onCloseAutoFocus: (event: Event) => void;
  onSaved: () => void;
  onRefresh: (itemId?: string) => Promise<InventoryListItem | undefined>;
}) {
  const { locale, t } = useLocale();
  const client = useQueryClient();
  const existing = state?.mode === "revise" ? state.item : undefined;
  const [brand, setBrand] = useState("Apple");
  const [model, setModel] = useState("");
  const [color, setColor] = useState("");
  const [storage, setStorage] = useState("128GB");
  const [imei, setImei] = useState("");
  const [battery, setBattery] = useState("");
  const [referenceLow, setReferenceLow] = useState("350");
  const [referenceHigh, setReferenceHigh] = useState("420");
  const [screenDeduction, setScreenDeduction] = useState("0");
  const [batteryDeduction, setBatteryDeduction] = useState("0");
  const [finalOffer, setFinalOffer] = useState("420");
  const [reason, setReason] = useState("");
  const [risk, setRisk] = useState<"low" | "medium" | "high">("low");
  const [recordId, setRecordId] = useState("");
  const [expiresAt, setExpiresAt] = useState("");
  const [expectedUpdatedAt, setExpectedUpdatedAt] = useState("");
  const [validationCodes, setValidationCodes] = useState<WorkspaceValidationCode[]>([]);
  const [recovery, setRecovery] = useState<BuybackRecovery | null>(null);
  const workspaceAttemptRef = useRef<BuybackAttempt | null>(null);
  const workspaceSubmitLockRef = useRef(false);
  const workspaceActiveRef = useRef(true);
  const modelRef = useRef<HTMLInputElement>(null);
  const referenceLowRef = useRef<HTMLInputElement>(null);
  const batteryRef = useRef<HTMLInputElement>(null);
  const reasonRef = useRef<HTMLTextAreaElement>(null);
  useEffect(() => {
    if (!state) return;
    setRecordId(existing?.id ?? crypto.randomUUID());
    setExpiresAt(new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString());
    setExpectedUpdatedAt(existing?.updated_at ?? "");
    setRecovery(null);
    workspaceAttemptRef.current = null;
    workspaceSubmitLockRef.current = false;
    if (existing) {
      const current = quoteProjection(existing);
      setBrand(existing.brand);
      setModel(existing.model);
      setColor(existing.color ?? "");
      setStorage(existing.storage_capacity ?? "128GB");
      setImei("");
      setBattery(existing.battery_health ? String(existing.battery_health) : "");
      setReferenceLow(String(numberValue(current.reference_low)));
      setReferenceHigh(String(numberValue(current.reference_high)));
      setFinalOffer(String(numberValue(current.final_offer)));
      setReason("");
      setRisk(
        current.risk_level === "high" || current.risk_level === "medium"
          ? current.risk_level
          : "low",
      );
      const rows = deductionsFromQuote(current);
      setScreenDeduction(String(rows.find((row) => row.code === "screen")?.amount ?? 0));
      setBatteryDeduction(String(rows.find((row) => row.code === "battery")?.amount ?? 0));
    } else {
      setBrand("Apple");
      setModel("");
      setColor("");
      setStorage("128GB");
      setImei("");
      setBattery("");
      setReferenceLow("350");
      setReferenceHigh("420");
      setScreenDeduction("0");
      setBatteryDeduction("0");
      setFinalOffer("420");
      setReason("");
      setRisk("low");
    }
  }, [existing, state]);
  useEffect(() => {
    workspaceActiveRef.current = true;
    return () => {
      workspaceActiveRef.current = false;
      workspaceSubmitLockRef.current = true;
    };
  }, []);
  const deductions = useMemo<BuybackQuoteDeductionInput[]>(
    () =>
      [
        { code: "screen", label: "屏幕状况调整", amount: amount(screenDeduction) },
        { code: "battery", label: "电池健康调整", amount: amount(batteryDeduction) },
      ].filter((row) => row.amount > 0),
    [batteryDeduction, screenDeduction],
  );
  const suggested = Math.max(
    0,
    amount(referenceHigh) - deductions.reduce((sum, row) => sum + row.amount, 0),
  );
  const isManualOffer = amount(finalOffer) !== suggested;
  const synchronizeWorkspace = async () => {
    if (!workspaceActiveRef.current) return;
    setRecovery("checking");
    try {
      await client.invalidateQueries({ queryKey: buybackKeys.all }, { throwOnError: true });
      if (!workspaceActiveRef.current) return;
      workspaceAttemptRef.current = null;
      workspaceSubmitLockRef.current = false;
      toast.success(t(existing ? "buyback2b5.workspace.revised" : "buyback2b5.workspace.created"));
      onSaved();
    } catch {
      if (workspaceActiveRef.current) setRecovery("sync");
    }
  };
  const mutation = useMutation({
    mutationFn: async (
      command:
        | { operation: "quote.create"; payload: CreateQuotePayload; key: string }
        | {
            operation: "quote.revise";
            targetId: string;
            payload: ReviseQuotePayload;
            key: string;
            knownRevisionIds: string[];
          },
    ) => {
      if (!isOnline || !navigator.onLine) throw { code: "OFFLINE" };
      return command.operation === "quote.create"
        ? createTransparentBuybackQuote({ ...command.payload, idempotency_key: command.key })
        : reviseTransparentBuybackQuote(command.targetId, {
            ...command.payload,
            idempotency_key: command.key,
          });
    },
    onSuccess: () => {
      void synchronizeWorkspace();
    },
    onError: (error, command) => {
      if (!workspaceActiveRef.current) return;
      if (isConflictError(error)) {
        toast.error(localizeBuybackSafeError(error, t));
        workspaceSubmitLockRef.current = false;
        setRecovery("conflict");
        return;
      }
      if (!isUnknownWriteResult(error)) {
        toast.error(localizeBuybackSafeError(error, t));
        workspaceSubmitLockRef.current = false;
        setRecovery(null);
        return;
      }
      setRecovery("checking");
      const readback =
        command.operation === "quote.create"
          ? listBuybackRecords(scopeFilters).then((records) =>
              records.some((item) => item.id === command.payload.record_id),
            )
          : readTransparentBuybackHistory(command.targetId).then((result) => {
              const known = new Set(command.knownRevisionIds);
              return result.revisions.some(
                (revision) =>
                  !known.has(revision.id) &&
                  revision.change_reason === command.payload.change_reason &&
                  quoteSnapshotsEqual(revision.quote, command.payload.quote),
              );
            });
      void readback
        .then((committed) => {
          if (!workspaceActiveRef.current) return;
          if (committed) void synchronizeWorkspace();
          else {
            toast.error(t("buyback2b5.operation.unknown"));
            setRecovery("unknown");
          }
        })
        .catch(() => {
          if (!workspaceActiveRef.current) return;
          toast.error(t("buyback2b5.operation.unknown"));
          setRecovery("unknown");
        });
    },
  });
  if (!state) return null;
  const handleSubmit = () => {
    const moneyValues = [
      referenceLow,
      referenceHigh,
      screenDeduction,
      batteryDeduction,
      finalOffer,
    ];
    const codes: WorkspaceValidationCode[] = [];
    if (!model.trim()) codes.push("model");
    if (moneyValues.some((value) => !isValidAmountInput(value))) codes.push("amount");
    if (battery && (!isValidAmountInput(battery) || amount(battery) > 100)) {
      codes.push("battery");
    }
    if ((Boolean(existing) || isManualOffer) && reason.trim() && hasBuybackSensitiveText(reason)) {
      codes.push("sensitiveReason");
    } else if (isManualOffer && reason.trim().length < 2) codes.push("reason");
    setValidationCodes(codes);
    if (codes.length) {
      const first = codes[0];
      window.requestAnimationFrame(() => {
        if (first === "model") modelRef.current?.focus();
        else if (first === "amount") referenceLowRef.current?.focus();
        else if (first === "battery") batteryRef.current?.focus();
        else reasonRef.current?.focus();
      });
      return;
    }
    if (workspaceSubmitLockRef.current) return;
    const quote: BuybackQuoteSnapshotInput = {
      reference_low: amount(referenceLow),
      reference_high: amount(referenceHigh),
      final_offer: amount(finalOffer),
      deductions,
      manual_adjustment_reason: isManualOffer ? reason.trim() : undefined,
      risk_level: risk,
      hard_block: risk === "high",
      expires_at: expiresAt,
    };
    const command = existing
      ? {
          operation: "quote.revise" as const,
          targetId: existing.id,
          payload: {
            expected_updated_at: expectedUpdatedAt,
            quote,
            change_reason: reason.trim() || "重新检测后更新报价",
          } satisfies ReviseQuotePayload,
          knownRevisionIds: state.mode === "revise" ? state.knownRevisionIds : [],
        }
      : {
          operation: "quote.create" as const,
          payload: {
            record_id: recordId,
            device: {
              brand,
              model: model.trim(),
              color: color.trim() || undefined,
              storage_capacity: storage,
              serial_or_imei: imei.trim() || undefined,
              battery_health: battery ? amount(battery) : undefined,
            },
            quote,
          } satisfies CreateQuotePayload,
        };
    const attempt = operationAttempt(
      workspaceAttemptRef.current,
      command.operation,
      command.operation === "quote.revise"
        ? { targetId: command.targetId, payload: command.payload }
        : command.payload,
    );
    workspaceAttemptRef.current = attempt;
    workspaceSubmitLockRef.current = true;
    setRecovery(null);
    mutation.mutate({ ...command, key: attempt.key });
  };
  return (
    <Sheet open onOpenChange={(open) => !open && onClose()}>
      <SheetContent
        side="bottom"
        closeLabel={t("buyback2b5.detail.close")}
        onCloseAutoFocus={onCloseAutoFocus}
        data-buyback-quote-workspace="true"
        style={sheetFloatingStyle}
        className="bottom-1 left-1/2 right-auto top-1 flex h-auto max-h-none min-h-0 w-[calc(100vw-0.5rem)] -translate-x-1/2 flex-col gap-0 overflow-hidden rounded-2xl p-0 md:bottom-4 md:top-auto md:h-[min(90svh,780px)] md:max-h-[min(90svh,780px)] md:w-[min(920px,calc(100vw-2rem))]"
      >
        <div
          data-buyback-scroll-body="workspace"
          className="min-h-0 flex-1 basis-0 overflow-y-auto overscroll-contain p-2 pb-3 sm:p-4 lg:grid lg:grid-cols-2 lg:content-start lg:gap-2"
        >
          <SheetHeader className="text-left lg:col-span-2">
            <SheetTitle>
              {t(existing ? "buyback2b5.workspace.revise" : "buyback2b5.workspace.create")}
            </SheetTitle>
            <SheetDescription>{t("buyback2b5.workspace.description")}</SheetDescription>
          </SheetHeader>
          {validationCodes.length ? (
            <div
              role="alert"
              aria-labelledby="buyback-validation-title"
              className="mt-2 rounded-xl border border-status-danger/25 bg-status-danger/10 p-2 lg:col-span-2"
            >
              <p id="buyback-validation-title" className="text-xs font-semibold">
                {t("buyback2b5.validation.summary")}
              </p>
              <ul className="mt-1 list-disc pl-5 text-xs">
                {validationCodes.map((code) => (
                  <li key={code}>{t(workspaceValidationKeys[code])}</li>
                ))}
              </ul>
            </div>
          ) : null}
          <section
            className={cn(
              repairOs.mobileInfoCard,
              "mt-2 p-2 lg:col-start-1 lg:row-start-2 lg:mt-0",
            )}
          >
            <SectionTitle icon={Smartphone} title={t("buyback2b5.workspace.device")} />
            <div className="mt-2 grid grid-cols-2 gap-2">
              <Field label={t("buyback2b5.workspace.brand")}>
                <Select value={brand} onValueChange={setBrand} disabled={Boolean(existing)}>
                  <SelectTrigger
                    aria-label={t("buyback2b5.workspace.brand")}
                    className="h-[38px] rounded-lg"
                  >
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {brands.map((value) => (
                      <SelectItem key={value} value={value}>
                        {value}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </Field>
              <Field label={t("buyback2b5.workspace.model")}>
                <Input
                  ref={modelRef}
                  aria-label={t("buyback2b5.workspace.model")}
                  aria-invalid={validationCodes.includes("model")}
                  value={model}
                  disabled={Boolean(existing)}
                  onChange={(event) => setModel(event.target.value)}
                  placeholder={t("buyback2b5.workspace.modelPlaceholder")}
                  className="h-[38px] rounded-lg text-base sm:text-sm"
                />
              </Field>
              <Field label={t("buyback2b5.workspace.color")}>
                <Input
                  aria-label={t("buyback2b5.workspace.color")}
                  value={color}
                  disabled={Boolean(existing)}
                  onChange={(event) => setColor(event.target.value)}
                  placeholder={t("buyback2b5.workspace.colorPlaceholder")}
                  className="h-[38px] rounded-lg text-base sm:text-sm"
                />
              </Field>
              <Field label={t("buyback2b5.workspace.storage")}>
                <Select value={storage} onValueChange={setStorage} disabled={Boolean(existing)}>
                  <SelectTrigger
                    aria-label={t("buyback2b5.workspace.storage")}
                    className="h-[38px] rounded-lg"
                  >
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {storageOptions.map((value) => (
                      <SelectItem key={value} value={value}>
                        {value}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </Field>
              {!existing ? (
                <div className="col-span-2">
                  <Field label={t("buyback2b5.workspace.imei")}>
                    <ImeiScannerField
                      value={imei}
                      onChange={setImei}
                      density="compact"
                      placeholder={t("buyback2b5.workspace.imeiPlaceholder")}
                      inputAriaLabel={t("buyback2b5.workspace.imeiInputAria")}
                      identifierLabel={t("buyback2b5.workspace.imeiIdentifier")}
                    />
                  </Field>
                </div>
              ) : null}
              <Field label={t("buyback2b5.workspace.battery")}>
                <Input
                  ref={batteryRef}
                  aria-label={t("buyback2b5.workspace.battery")}
                  aria-invalid={validationCodes.includes("battery")}
                  value={battery}
                  onChange={(event) => setBattery(event.target.value)}
                  inputMode="decimal"
                  placeholder={t("buyback2b5.workspace.batteryPlaceholder")}
                  className="h-[38px] rounded-lg text-base sm:text-sm"
                />
              </Field>
            </div>
          </section>
          <section
            className={cn(
              repairOs.mobileInfoCard,
              "mt-2 p-2 lg:col-start-2 lg:row-start-2 lg:mt-0",
            )}
          >
            <SectionTitle icon={Euro} title={t("buyback2b5.workspace.quote")} />
            <div className="mt-2 grid grid-cols-2 gap-2">
              <Field label={t("buyback2b5.workspace.referenceLow")}>
                <MoneyInput
                  ref={referenceLowRef}
                  invalid={validationCodes.includes("amount")}
                  label={t("buyback2b5.workspace.referenceLow")}
                  value={referenceLow}
                  onChange={setReferenceLow}
                />
              </Field>
              <Field label={t("buyback2b5.workspace.referenceHigh")}>
                <MoneyInput
                  invalid={validationCodes.includes("amount")}
                  label={t("buyback2b5.workspace.referenceHigh")}
                  value={referenceHigh}
                  onChange={setReferenceHigh}
                />
              </Field>
              <Field label={t("buyback2b5.workspace.screenDeduction")}>
                <MoneyInput
                  invalid={validationCodes.includes("amount")}
                  label={t("buyback2b5.workspace.screenDeduction")}
                  value={screenDeduction}
                  onChange={setScreenDeduction}
                />
              </Field>
              <Field label={t("buyback2b5.workspace.batteryDeduction")}>
                <MoneyInput
                  invalid={validationCodes.includes("amount")}
                  label={t("buyback2b5.workspace.batteryDeduction")}
                  value={batteryDeduction}
                  onChange={setBatteryDeduction}
                />
              </Field>
            </div>
            <div className="mt-2 rounded-xl bg-primary/8 p-2">
              <div className="flex items-end justify-between">
                <div>
                  <p className="text-[10px] text-muted-foreground lg:text-xs lg:leading-4">
                    {t("buyback2b5.workspace.suggestion")}
                  </p>
                  <p className="font-mono text-xl font-semibold leading-6 text-primary">
                    {formatBuybackMoney(suggested, locale)}
                  </p>
                </div>
                <Button
                  type="button"
                  variant="outline"
                  className="h-9 rounded-lg px-3 text-xs"
                  onClick={() => setFinalOffer(String(suggested))}
                >
                  <MinusCircle className="mr-1 size-4" />
                  {t("buyback2b5.workspace.useSuggestion")}
                </Button>
              </div>
            </div>
            <div className="mt-2 grid grid-cols-2 gap-2">
              <Field label={t("buyback2b5.workspace.finalOffer")}>
                <MoneyInput
                  invalid={validationCodes.includes("amount")}
                  label={t("buyback2b5.workspace.finalOffer")}
                  value={finalOffer}
                  onChange={setFinalOffer}
                />
              </Field>
              <Field label={t("buyback2b5.workspace.risk")}>
                <Select value={risk} onValueChange={(value) => setRisk(value as typeof risk)}>
                  <SelectTrigger
                    aria-label={t("buyback2b5.workspace.risk")}
                    className="h-[38px] rounded-lg"
                  >
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="low">{localizeBuybackRisk("low", false, t)}</SelectItem>
                    <SelectItem value="medium">
                      {localizeBuybackRisk("medium", false, t)}
                    </SelectItem>
                    <SelectItem value="high">{t("buyback2b5.workspace.riskHigh")}</SelectItem>
                  </SelectContent>
                </Select>
              </Field>
            </div>
            {isManualOffer || (Boolean(existing) && Boolean(reason)) ? (
              <Field label={t("buyback2b5.workspace.reason")}>
                <Textarea
                  ref={reasonRef}
                  aria-label={t("buyback2b5.workspace.reason")}
                  aria-invalid={
                    validationCodes.includes("reason") ||
                    validationCodes.includes("sensitiveReason")
                  }
                  aria-describedby={
                    validationCodes.includes("reason") ||
                    validationCodes.includes("sensitiveReason")
                      ? "buyback-workspace-reason-error"
                      : undefined
                  }
                  value={reason}
                  onChange={(event) => setReason(event.target.value)}
                  maxLength={160}
                  placeholder={t("buyback2b5.workspace.reasonPlaceholder")}
                  className="mt-1 min-h-16 rounded-xl text-base sm:text-sm"
                />
                {validationCodes.includes("reason") ||
                validationCodes.includes("sensitiveReason") ? (
                  <p
                    id="buyback-workspace-reason-error"
                    className="mt-1 text-[11px] text-status-danger-foreground"
                  >
                    {t(
                      validationCodes.includes("sensitiveReason")
                        ? "buyback2b5.validation.sensitive"
                        : "buyback2b5.validation.reason",
                    )}
                  </p>
                ) : null}
              </Field>
            ) : null}
            <div className="mt-2 flex items-center gap-2 rounded-xl border border-[var(--border-panel)] px-2 py-1.5 text-[10px] text-muted-foreground lg:text-xs lg:leading-[18px]">
              <CalendarClock className="size-4 shrink-0 text-primary" />
              {t("buyback2b5.workspace.expiryHint")}
            </div>
            {mutation.isError || recovery ? (
              <div
                role="alert"
                data-error-kind={
                  recovery ?? (mutation.isError ? classifyBuybackSafeError(mutation.error) : null)
                }
                className="mt-2 rounded-xl border border-status-danger/25 bg-status-danger/10 px-2 py-1.5 text-[11px] text-status-danger-foreground lg:text-xs lg:leading-[18px]"
              >
                <p>
                  {recovery === "checking"
                    ? t("buyback2b5.operation.checking")
                    : recovery === "unknown"
                      ? t("buyback2b5.operation.unknown")
                      : recovery === "sync"
                        ? t("buyback2b5.operation.syncFailed")
                        : localizeBuybackSafeError(mutation.error, t)}
                </p>
                {recovery && recovery !== "checking" ? (
                  <Button
                    type="button"
                    variant="outline"
                    className="mt-1 h-[38px] rounded-lg text-base"
                    onClick={() => {
                      if (recovery === "sync") {
                        void synchronizeWorkspace();
                        return;
                      }
                      if (recovery === "unknown") {
                        workspaceSubmitLockRef.current = false;
                        setRecovery(null);
                        mutation.reset();
                        return;
                      }
                      void onRefresh(existing?.id)
                        .then((latest) => {
                          if (!latest) throw new Error("buyback-revise-refresh-missing");
                          setExpectedUpdatedAt(latest.updated_at);
                          workspaceSubmitLockRef.current = false;
                          setRecovery(null);
                          mutation.reset();
                        })
                        .catch(() => toast.error(t("buyback2b5.operation.refreshFailed")));
                    }}
                  >
                    {recovery === "sync"
                      ? t("buyback2b5.operation.retrySync")
                      : recovery === "unknown"
                        ? t("buyback2b5.operation.retryWrite")
                        : t("buyback2b5.detail.refresh")}
                  </Button>
                ) : null}
              </div>
            ) : null}
          </section>
        </div>
        <div
          data-buyback-fixed-footer="workspace"
          className="shrink-0 border-t border-[var(--border-panel)] bg-[var(--surface-workspace-strong)] p-2 pb-[max(0.5rem,env(safe-area-inset-bottom))]"
        >
          <div className="mb-1 flex items-center justify-between gap-2 text-[10px] leading-4 lg:text-[11px] lg:leading-4">
            <span className="font-semibold text-primary">
              {t("buyback2b5.workspace.finalOffer")}{" "}
              {formatBuybackMoney(amount(finalOffer), locale)}
            </span>
            <span className="truncate text-muted-foreground">
              {isManualOffer ? t("buyback2b5.workspace.manual") : t("buyback2b5.workspace.system")}
            </span>
          </div>
          <div className="grid grid-cols-[1fr_1.5fr] gap-2">
            <Button
              variant="outline"
              className="h-auto min-h-11 whitespace-normal rounded-lg text-center leading-tight"
              onClick={onClose}
            >
              {t("buyback2b5.workspace.cancel")}
            </Button>
            <Button
              className={cn(
                "h-auto min-h-11 whitespace-normal rounded-lg text-center leading-tight",
                controls.brandButton,
              )}
              style={brandGradientStyle}
              disabled={
                !isOnline ||
                mutation.isPending ||
                recovery !== null ||
                !recordId ||
                !expiresAt ||
                (Boolean(existing) && !expectedUpdatedAt)
              }
              onClick={handleSubmit}
            >
              {mutation.isPending ? (
                <Loader2 className="mr-2 size-4 animate-spin" />
              ) : (
                <Check className="mr-2 size-4" />
              )}
              {t(existing ? "buyback2b5.workspace.saveRevision" : "buyback2b5.workspace.save")}
            </Button>
          </div>
        </div>
      </SheetContent>
    </Sheet>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="min-w-0">
      <Label className="text-[11px] text-muted-foreground lg:text-xs lg:leading-4">{label}</Label>
      <div className="mt-1.5">{children}</div>
    </div>
  );
}
function MoneyInput({
  ref,
  invalid,
  label,
  value,
  onChange,
}: {
  ref?: React.Ref<HTMLInputElement>;
  invalid?: boolean;
  label: string;
  value: string;
  onChange: (value: string) => void;
}) {
  return (
    <Input
      ref={ref}
      aria-label={label}
      aria-invalid={invalid}
      value={value}
      onChange={(event) => onChange(event.target.value)}
      inputMode="decimal"
      className="h-[38px] rounded-lg font-mono text-base sm:text-sm"
    />
  );
}
function SectionTitle({ icon: Icon, title }: { icon: typeof Smartphone; title: string }) {
  return (
    <h3 className="flex items-center gap-2 text-xs font-semibold">
      <span className="grid size-7 place-items-center rounded-lg bg-primary/10 text-primary">
        <Icon className="size-4" />
      </span>
      {title}
    </h3>
  );
}
function MiniTile({ label, value, danger }: { label: string; value: string; danger?: boolean }) {
  return (
    <RepairOsInfoTile
      label={label}
      value={value}
      frame="plain"
      className="rounded-xl bg-[var(--surface-panel-muted)] px-2.5 py-2"
      labelClassName="text-[9px] lg:text-[11px] lg:leading-4"
      valueClassName={cn(
        "mt-0.5 truncate text-[11px] font-semibold lg:text-xs lg:leading-4",
        danger && "text-status-danger-foreground",
      )}
    />
  );
}
function EmptyState({
  title,
  detail,
  actionLabel,
  onAction,
}: {
  title: string;
  detail: string;
  actionLabel?: string;
  onAction?: (event: React.MouseEvent<HTMLButtonElement>) => void;
}) {
  return (
    <div className="mx-auto mt-8 max-w-sm rounded-2xl border border-dashed border-[var(--border-panel)] p-6 text-center">
      <RefreshCw className="mx-auto size-6 text-primary" />
      <h2 className="mt-3 text-sm font-semibold">{title}</h2>
      <p className="mt-1 text-xs text-muted-foreground">{detail}</p>
      {actionLabel && onAction ? (
        <Button className="mt-4 h-auto min-h-11 rounded-lg" onClick={onAction}>
          {actionLabel}
        </Button>
      ) : null}
    </div>
  );
}
function OutcomeBadge({ outcome }: { outcome?: string }) {
  const { t } = useLocale();
  const tone =
    outcome === "accepted"
      ? "bg-status-success text-status-success-foreground"
      : outcome === "deferred"
        ? "bg-status-warn text-status-warn-foreground"
        : outcome === "rejected"
          ? "bg-status-danger text-status-danger-foreground"
          : "bg-status-info text-status-info-foreground";
  return <RepairOsBadge className={tone}>{localizeBuybackOutcome(outcome, t)}</RepairOsBadge>;
}
function quoteProjection(item: InventoryListItem): Record<string, unknown> {
  const root = recordValue(item.legacy_payload);
  const quote = recordValue(root.buyback_quote);
  return {
    ...quote,
    reference_low: quote.reference_low ?? quote.suggested_low ?? quote.market_min,
    reference_high: quote.reference_high ?? quote.suggested_high ?? quote.market_max,
    expires_at: quote.expires_at ?? quote.quote_expires_at,
  } as Record<string, unknown>;
}
function resolvedOutcome(item: InventoryListItem) {
  const value = quoteProjection(item).intent_outcome;
  return typeof value === "string" && value ? value : undefined;
}
function deductionsFromQuote(quote: Record<string, unknown>): BuybackQuoteDeductionInput[] {
  return Array.isArray(quote.deductions)
    ? quote.deductions
        .map(recordValue)
        .map((row) => ({
          code: String(row.code ?? "adjustment"),
          label: typeof row.label === "string" ? row.label : "",
          amount: numberValue(row.amount),
        }))
        .filter((row) => row.amount > 0)
    : [];
}
function recordValue(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
}
function numberValue(value: unknown) {
  const parsed =
    typeof value === "number"
      ? value
      : Number(
          String(value ?? "")
            .trim()
            .replace(",", "."),
        );
  return Number.isFinite(parsed) ? parsed : 0;
}
function isValidAmountInput(value: string) {
  return /^\d+(?:[.,]\d{1,2})?$/.test(value.trim());
}
function amount(value: string) {
  return Math.max(0, Math.round(numberValue(value) * 100) / 100);
}
function rangeLabel(low: unknown, high: unknown, locale: Parameters<typeof formatBuybackMoney>[1]) {
  return `${formatBuybackMoney(numberValue(low), locale)}–${formatBuybackMoney(numberValue(high), locale)}`;
}
function maskIdentifier(value: unknown) {
  if (typeof value !== "string") return "";
  const compact = value.trim();
  if (!compact) return "";
  const tail = compact.replace(/\s+/g, "").slice(-4);
  return tail ? `••••${tail}` : "";
}
function signedMoney(value: number, locale: Parameters<typeof formatBuybackMoney>[1]) {
  if (Math.abs(value) < 0.005) return formatBuybackMoney(0, locale);
  return `${value > 0 ? "+" : "-"}${formatBuybackMoney(Math.abs(value), locale)}`;
}
function latestByCreatedAt<T extends { created_at: string }>(values?: T[]) {
  return values?.reduce<T | undefined>((latest, current) => {
    if (!latest) return current;
    return Date.parse(current.created_at) > Date.parse(latest.created_at) ? current : latest;
  }, undefined);
}
function sortNewest<T extends { created_at: string }>(values?: T[]) {
  return [...(values ?? [])].sort(
    (left, right) => Date.parse(right.created_at) - Date.parse(left.created_at),
  );
}
function useOnlineStatus() {
  const [isOnline, setIsOnline] = useState(true);
  useEffect(() => {
    const markOnline = () => setIsOnline(true);
    const markOffline = () => setIsOnline(false);
    setIsOnline(navigator.onLine);
    window.addEventListener("online", markOnline);
    window.addEventListener("offline", markOffline);
    return () => {
      window.removeEventListener("online", markOnline);
      window.removeEventListener("offline", markOffline);
    };
  }, []);
  return isOnline;
}
