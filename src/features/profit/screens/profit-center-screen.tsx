"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  AlertTriangle,
  CalendarDays,
  CheckCircle2,
  CircleHelp,
  Download,
  RefreshCw,
  TrendingDown,
  WalletCards,
} from "lucide-react";
import Link from "next/link";
import { useEffect, useMemo, useRef, useState, useSyncExternalStore } from "react";
import {
  CartesianGrid,
  Legend,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

import { MoneyText } from "@/components/orders/badges";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { profitCenterQueryOptions } from "@/features/profit/api/query-options";
import { storesKeys } from "@/features/stores/api/query-keys";
import { useStoreShellContext } from "@/features/stores/api/use-store-shell-context";
import { exportCostReport, isRepairDeskAuthorizationError } from "@/lib/repairdesk/api";
import type {
  ProfitCenterInput,
  ProfitBreakdownItem,
  ProfitOrderDrilldownItem,
  ProfitPeriodSummary,
  StoreContext,
} from "@/lib/repairdesk/types";
import { cn } from "@/lib/utils";
import { buildOrderDetailWorkspaceHref } from "@/features/orders/model/order-workspace-intent";
import { RepairOsListScaffold } from "@/shared/ui";
import { useLocale } from "@/shared/i18n/locale-provider";
import { getProfitCenterCopy, type ProfitCenterCopy } from "@/shared/i18n/messages";

const FALLBACK_TIMEZONE = "Europe/Rome";

export function localDate(date: Date, timeZone = FALLBACK_TIMEZONE) {
  if (Number.isNaN(date.getTime())) return "";
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(date);
  const value = Object.fromEntries(parts.map((part) => [part.type, part.value]));
  return `${value.year}-${value.month}-${value.day}`;
}

export function defaultRange(now = new Date()): ProfitCenterInput {
  const end = localDate(now);
  if (!end) return { start_date: "", end_date: "" };
  const [year, month, day] = end.split("-").map(Number);
  const start = new Date(Date.UTC(year, month - 1, day - 29, 12));
  return { start_date: localDate(start, "UTC"), end_date: end };
}

function formatCopy(template: string, values: Record<string, string | number>) {
  return template.replace(/\{(\w+)\}/g, (match, name: string) =>
    values[name] === undefined ? match : String(values[name]),
  );
}

function useDesktopProfitLayout() {
  return useSyncExternalStore(
    (onStoreChange) => {
      const query = window.matchMedia("(min-width: 1024px)");
      query.addEventListener("change", onStoreChange);
      return () => query.removeEventListener("change", onStoreChange);
    },
    () => window.matchMedia("(min-width: 1024px)").matches,
    () => false,
  );
}

interface ProfitExportRequest {
  operationId: number;
  storeId: string;
  membershipId?: string;
  role?: string;
  membershipStatus?: string;
  authorityEpoch: number;
  authorityKey: string;
  input: {
    expected_store_id: string;
    start_date: string;
    end_date: string;
  };
}

function percent(numerator: number, denominator: number) {
  if (denominator <= 0) return "—";
  return `${Math.round((numerator / denominator) * 100)}%`;
}

function ProfitMetric({
  label,
  value,
  detail,
  warning = false,
}: {
  label: string;
  value: React.ReactNode;
  detail: React.ReactNode;
  warning?: boolean;
}) {
  return (
    <Card className="min-w-0 rounded-2xl border-border/70 shadow-[var(--shadow-card)]">
      <CardContent className="p-3.5 sm:p-4">
        <p className="truncate text-xs font-medium text-muted-foreground">{label}</p>
        <div className={cn("mt-1.5 text-xl font-semibold", warning && "text-destructive")}>
          {value}
        </div>
        <div className="mt-1 text-xs leading-5 text-muted-foreground">{detail}</div>
      </CardContent>
    </Card>
  );
}

function PeriodCards({
  expected,
  completed,
  copy,
}: {
  expected: ProfitPeriodSummary;
  completed: ProfitPeriodSummary;
  copy: ProfitCenterCopy;
}) {
  return (
    <div className="grid min-w-0 grid-cols-2 gap-2.5 lg:grid-cols-4">
      <ProfitMetric
        label={copy.expectedMargin}
        value={<MoneyText amount={expected.exact_margin_amount} />}
        detail={formatCopy(copy.completeOrdersDetail, {
          complete: expected.exact_order_count,
          pending: expected.incomplete_order_count,
        })}
        warning={expected.exact_margin_amount < 0}
      />
      <ProfitMetric
        label={copy.completedMargin}
        value={<MoneyText amount={completed.exact_margin_amount} />}
        detail={formatCopy(copy.completedOrdersDetail, { complete: completed.exact_order_count })}
        warning={completed.exact_margin_amount < 0}
      />
      <ProfitMetric
        label={copy.knownCost}
        value={<MoneyText amount={expected.known_cost_amount} />}
        detail={formatCopy(copy.coverageDetail, {
          coverage: percent(expected.exact_order_count, expected.eligible_order_count),
        })}
      />
      <ProfitMetric
        label={copy.completeCostOrders}
        value={percent(expected.exact_order_count, expected.eligible_order_count)}
        detail={formatCopy(copy.estimateDetail, {
          estimated: expected.estimated_order_count,
          negative: expected.negative_margin_order_count,
        })}
        warning={expected.negative_margin_order_count > 0}
      />
    </div>
  );
}

function ProfitTrend({
  data,
  copy,
}: {
  data: Array<Record<string, string | number>>;
  copy: ProfitCenterCopy;
}) {
  if (data.length === 0) {
    return <p className="py-10 text-center text-sm text-muted-foreground">{copy.trendEmpty}</p>;
  }
  return (
    <>
      <div className="h-64 w-full" aria-hidden="true">
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={data} margin={{ top: 8, right: 8, left: -16, bottom: 0 }}>
            <CartesianGrid vertical={false} stroke="var(--border)" strokeDasharray="3 3" />
            <XAxis dataKey="date" tick={{ fontSize: 11 }} minTickGap={24} />
            <YAxis tick={{ fontSize: 11 }} width={54} />
            <Tooltip
              formatter={(value, name) => [
                typeof value === "number" ? `€${value.toFixed(2)}` : value,
                name === "expected" ? copy.expectedMargin : copy.completedMargin,
              ]}
            />
            <Legend
              formatter={(value) =>
                value === "expected" ? copy.expectedMargin : copy.completedMargin
              }
            />
            <Line
              type="monotone"
              dataKey="expected"
              stroke="var(--chart-1)"
              strokeWidth={2}
              dot={false}
              connectNulls
            />
            <Line
              type="monotone"
              dataKey="completed"
              stroke="var(--chart-2)"
              strokeWidth={2}
              dot={false}
              connectNulls
            />
          </LineChart>
        </ResponsiveContainer>
      </div>
      <details className="mt-2 rounded-xl border border-border/60 bg-muted/20 px-3 py-2 text-xs">
        <summary className="min-h-11 cursor-pointer py-3 font-medium">
          {copy.trendTableSummary}
        </summary>
        <div className="mt-2 max-h-64 overflow-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>{copy.date}</TableHead>
                <TableHead className="text-right">{copy.expectedMarginShort}</TableHead>
                <TableHead className="text-right">{copy.completedMarginShort}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {data.map((row) => (
                <TableRow key={String(row.date)}>
                  <TableCell>{row.date}</TableCell>
                  <TableCell className="text-right">
                    <MoneyText amount={Number(row.expected)} />
                  </TableCell>
                  <TableCell className="text-right">
                    <MoneyText amount={Number(row.completed)} />
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      </details>
    </>
  );
}

function CompletenessBadge({
  order,
  copy,
}: {
  order: ProfitOrderDrilldownItem;
  copy: ProfitCenterCopy;
}) {
  if (order.cost_completeness === "incomplete") {
    return (
      <Badge variant="outline" className="gap-1">
        <CircleHelp className="size-3" />
        {copy.incompleteCost}
      </Badge>
    );
  }
  if (order.cost_completeness === "estimated") {
    return (
      <Badge variant="secondary" className="gap-1">
        <AlertTriangle className="size-3" />
        {copy.estimatedCost}
      </Badge>
    );
  }
  return (
    <Badge variant="outline" className="gap-1">
      <CheckCircle2 className="size-3" />
      {copy.confirmedCost}
    </Badge>
  );
}

function OrderBadges({ order, copy }: { order: ProfitOrderDrilldownItem; copy: ProfitCenterCopy }) {
  return (
    <div className="mt-1 flex flex-wrap gap-1">
      {order.is_refunded ? <Badge variant="destructive">{copy.refundedExcluded}</Badge> : null}
      {order.is_rework ? <Badge variant="secondary">{copy.rework}</Badge> : null}
    </div>
  );
}

function CurrencyCosts({
  order,
  copy,
}: {
  order: ProfitOrderDrilldownItem;
  copy: ProfitCenterCopy;
}) {
  if (!order.currency_costs?.length) return null;
  return (
    <details className="mt-1.5 text-[11px] leading-4 text-muted-foreground">
      <summary className="flex min-h-11 cursor-pointer items-center">
        {formatCopy(copy.originalCurrencySnapshot, { count: order.currency_costs.length })}
      </summary>
      <div className="mt-1 space-y-1 rounded-lg bg-muted/30 p-2">
        {order.currency_costs.map((cost) => (
          <p className="break-words" key={cost.line_id}>
            <span className="font-medium text-foreground">{cost.line_name}</span>
            {" · "}
            <span className="font-mono">
              {cost.original_amount.toFixed(2)} {cost.original_currency_code} ×{" "}
              {cost.fx_rate_to_eur} = €{cost.cost_amount_eur.toFixed(2)}
            </span>
          </p>
        ))}
      </div>
    </details>
  );
}

function OrderDrilldown({
  orders,
  copy,
  isDesktop,
}: {
  orders: ProfitOrderDrilldownItem[];
  copy: ProfitCenterCopy;
  isDesktop: boolean;
}) {
  if (orders.length === 0) {
    return <p className="py-10 text-center text-sm text-muted-foreground">{copy.ordersEmpty}</p>;
  }
  if (!isDesktop) {
    return (
      <div className="space-y-2" data-layout="mobile-cards">
        {orders.map((order) => (
          <article className="min-w-0 rounded-xl border border-border/70 p-3" key={order.order_id}>
            <div className="flex min-w-0 items-start justify-between gap-2">
              <div className="min-w-0">
                <Link
                  className="inline-flex min-h-11 items-center font-mono text-sm font-semibold text-primary hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                  href={buildOrderDetailWorkspaceHref(order.order_id, { source: "profit" })}
                >
                  {order.public_no}
                </Link>
                <OrderBadges order={order} copy={copy} />
              </div>
              <CompletenessBadge order={order} copy={copy} />
            </div>
            <dl className="mt-3 grid grid-cols-2 gap-x-3 gap-y-2 text-xs">
              <div>
                <dt className="text-muted-foreground">{copy.quote}</dt>
                <dd className="mt-0.5 font-medium">
                  <MoneyText amount={order.quote_amount} />
                </dd>
              </div>
              <div>
                <dt className="text-muted-foreground">{copy.knownCost}</dt>
                <dd className="mt-0.5 font-medium">
                  <MoneyText amount={order.known_cost_amount} />
                </dd>
              </div>
              <div className="col-span-2">
                <dt className="text-muted-foreground">{copy.quoteMargin}</dt>
                <dd
                  className={cn(
                    "mt-0.5 font-medium",
                    order.quote_gross_margin !== null &&
                      order.quote_gross_margin < 0 &&
                      "text-destructive",
                  )}
                >
                  {order.quote_gross_margin === null ? (
                    copy.pendingCost
                  ) : (
                    <>
                      <MoneyText amount={order.quote_gross_margin} />{" "}
                      <span className="text-muted-foreground">
                        {order.quote_gross_margin_percent?.toFixed(1)}%
                      </span>
                    </>
                  )}
                </dd>
              </div>
            </dl>
            <CurrencyCosts order={order} copy={copy} />
          </article>
        ))}
      </div>
    );
  }
  return (
    <div className="min-w-0 rounded-xl border border-border/70" data-layout="desktop-table">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>{copy.order}</TableHead>
            <TableHead>{copy.costEvidence}</TableHead>
            <TableHead className="text-right">{copy.quote}</TableHead>
            <TableHead className="text-right">{copy.knownCost}</TableHead>
            <TableHead className="text-right">{copy.quoteMargin}</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {orders.map((order) => (
            <TableRow key={order.order_id}>
              <TableCell>
                <Link
                  className="inline-flex min-h-11 items-center font-mono text-xs font-semibold text-primary hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                  href={buildOrderDetailWorkspaceHref(order.order_id, { source: "profit" })}
                >
                  {order.public_no}
                </Link>
                <OrderBadges order={order} copy={copy} />
              </TableCell>
              <TableCell>
                <CompletenessBadge order={order} copy={copy} />
                <CurrencyCosts order={order} copy={copy} />
              </TableCell>
              <TableCell className="text-right">
                <MoneyText amount={order.quote_amount} />
              </TableCell>
              <TableCell className="text-right">
                <MoneyText amount={order.known_cost_amount} />
              </TableCell>
              <TableCell
                className={cn(
                  "text-right",
                  order.quote_gross_margin !== null &&
                    order.quote_gross_margin < 0 &&
                    "text-destructive",
                )}
              >
                {order.quote_gross_margin === null ? (
                  <span className="text-xs text-muted-foreground">{copy.pendingCost}</span>
                ) : (
                  <>
                    <MoneyText amount={order.quote_gross_margin} />
                    <span className="ml-1 text-xs text-muted-foreground">
                      {order.quote_gross_margin_percent?.toFixed(1)}%
                    </span>
                  </>
                )}
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}

function BreakdownTable({
  items,
  empty,
  copy,
  isDesktop,
}: {
  items: ProfitBreakdownItem[];
  empty: string;
  copy: ProfitCenterCopy;
  isDesktop: boolean;
}) {
  if (items.length === 0)
    return <p className="py-6 text-center text-xs text-muted-foreground">{empty}</p>;
  if (!isDesktop) {
    return (
      <div className="space-y-2 p-2" data-layout="mobile-cards">
        {items.map((item) => (
          <article className="min-w-0 rounded-lg border border-border/60 p-3" key={item.key}>
            <p className="break-words text-sm font-medium">{item.label}</p>
            <p className="mt-0.5 text-xs text-muted-foreground">
              {formatCopy(copy.ordersCount, { count: item.order_count })}
            </p>
            <dl className="mt-3 grid grid-cols-2 gap-2 text-xs">
              <div>
                <dt className="text-muted-foreground">{copy.quote}</dt>
                <dd className="mt-0.5 font-medium">
                  <MoneyText amount={item.quote_amount} />
                </dd>
              </div>
              <div>
                <dt className="text-muted-foreground">{copy.knownCost}</dt>
                <dd className="mt-0.5 font-medium">
                  <MoneyText amount={item.known_cost_amount} />
                </dd>
              </div>
              <div>
                <dt className="text-muted-foreground">{copy.exactLineMargin}</dt>
                <dd
                  className={cn(
                    "mt-0.5 font-medium",
                    item.exact_margin_amount < 0 && "text-destructive",
                  )}
                >
                  <MoneyText amount={item.exact_margin_amount} />
                </dd>
              </div>
              <div>
                <dt className="text-muted-foreground">{copy.pending}</dt>
                <dd className="mt-0.5 font-medium">{item.incomplete_line_count}</dd>
              </div>
            </dl>
          </article>
        ))}
      </div>
    );
  }
  return (
    <Table data-layout="desktop-table">
      <TableHeader>
        <TableRow>
          <TableHead>{copy.group}</TableHead>
          <TableHead className="text-right">{copy.quote}</TableHead>
          <TableHead className="text-right">{copy.knownCost}</TableHead>
          <TableHead className="text-right">{copy.exactLineMargin}</TableHead>
          <TableHead className="text-right">{copy.pending}</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {items.map((item) => (
          <TableRow key={item.key}>
            <TableCell>
              <span className="font-medium">{item.label}</span>
              <span className="ml-1 text-[10px] text-muted-foreground lg:text-[11px] lg:leading-4">
                {formatCopy(copy.ordersCount, { count: item.order_count })}
              </span>
            </TableCell>
            <TableCell className="text-right">
              <MoneyText amount={item.quote_amount} />
            </TableCell>
            <TableCell className="text-right">
              <MoneyText amount={item.known_cost_amount} />
            </TableCell>
            <TableCell
              className={cn("text-right", item.exact_margin_amount < 0 && "text-destructive")}
            >
              <MoneyText amount={item.exact_margin_amount} />
            </TableCell>
            <TableCell className="text-right">{item.incomplete_line_count}</TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
}

function ProfitLoading({ label }: { label: string }) {
  return (
    <div className="space-y-3" aria-label={label} role="status">
      <div className="grid grid-cols-2 gap-2.5 lg:grid-cols-4">
        {Array.from({ length: 4 }, (_, index) => (
          <Skeleton key={index} className="h-28 rounded-2xl" />
        ))}
      </div>
      <Skeleton className="h-80 rounded-2xl" />
      <Skeleton className="h-64 rounded-2xl" />
    </div>
  );
}

export function ProfitCenterScreen() {
  const { locale, t } = useLocale();
  const copy = getProfitCenterCopy(locale);
  const queryClient = useQueryClient();
  const shell = useStoreShellContext();
  const activeStoreId = shell.activeStore?.id;
  const canRead = shell.permissions?.canReadRepairProfitReports === true;
  const canExport = shell.permissions?.canExportRepairCosts === true;
  const cachedStoreContext = queryClient.getQueryData<StoreContext>(storesKeys.context);
  const cachedIdentityMatches = Boolean(
    activeStoreId &&
    cachedStoreContext?.activeStore?.id === activeStoreId &&
    cachedStoreContext.activeStore.membershipId === shell.activeStore?.membershipId &&
    cachedStoreContext.activeStore.role === shell.activeStore?.role &&
    cachedStoreContext.activeStore.status === shell.activeStore?.status,
  );
  const hasLiveReadAuthority = Boolean(
    cachedIdentityMatches && cachedStoreContext?.permissions?.canReadRepairProfitReports === true,
  );
  const hasLiveExportAuthority = Boolean(
    hasLiveReadAuthority && cachedStoreContext?.permissions?.canExportRepairCosts === true,
  );
  const isDesktop = useDesktopProfitLayout();
  const initialRange = useMemo(defaultRange, []);
  const [draft, setDraft] = useState(initialRange);
  const [range, setRange] = useState(initialRange);
  const [trendMode, setTrendMode] = useState<"daily" | "monthly">("daily");
  const [exportNotice, setExportNotice] = useState<{
    authorityKey: string;
    kind: "success" | "failure";
    fileName?: string;
  }>();
  const endDateRef = useRef<HTMLInputElement>(null);
  const mountedRef = useRef(false);
  const exportLockRef = useRef<number | null>(null);
  const operationSequenceRef = useRef(0);
  const authorityKey = [
    shell.authorityFingerprint,
    activeStoreId ?? "no-store",
    shell.activeStore?.membershipId ?? "no-membership",
    shell.activeStore?.role ?? "no-role",
    shell.activeStore?.status ?? "no-status",
    canRead ? "read" : "no-read",
    canExport ? "export" : "no-export",
  ].join("|");
  const authorityRef = useRef({
    key: authorityKey,
    epoch: 0,
    storeId: activeStoreId,
    canRead,
    canExport,
  });
  if (authorityRef.current.key !== authorityKey) {
    authorityRef.current = {
      key: authorityKey,
      epoch: authorityRef.current.epoch + 1,
      storeId: activeStoreId,
      canRead,
      canExport,
    };
    exportLockRef.current = null;
  }

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
      authorityRef.current = {
        ...authorityRef.current,
        epoch: authorityRef.current.epoch + 1,
      };
      exportLockRef.current = null;
    };
  }, []);

  function isCurrentExportAuthority(request: ProfitExportRequest) {
    const current = authorityRef.current;
    if (
      !mountedRef.current ||
      current.key !== request.authorityKey ||
      current.epoch !== request.authorityEpoch ||
      current.storeId !== request.storeId ||
      !current.canRead ||
      !current.canExport
    ) {
      return false;
    }
    const cached = queryClient.getQueryData<StoreContext>(storesKeys.context);
    return Boolean(
      cached?.activeStore?.id === request.storeId &&
      cached.activeStore.membershipId === request.membershipId &&
      cached.activeStore.role === request.role &&
      cached.activeStore.status === request.membershipStatus &&
      cached.permissions?.canReadRepairProfitReports === true &&
      cached.permissions?.canExportRepairCosts === true,
    );
  }

  const rangeInvalid = draft.end_date < draft.start_date;
  useEffect(() => {
    if (rangeInvalid) endDateRef.current?.focus();
  }, [rangeInvalid]);
  const query = useQuery({
    ...profitCenterQueryOptions(range, activeStoreId),
    enabled: Boolean(activeStoreId && canRead && hasLiveReadAuthority && !shell.isLoading),
    refetchOnWindowFocus: false,
  });
  const exportMutation = useMutation({
    mutationFn: async (request: ProfitExportRequest) => {
      if (!isCurrentExportAuthority(request)) throw new Error("stale-profit-export-authority");
      const result = await exportCostReport(request.input);
      if (!isCurrentExportAuthority(request)) throw new Error("stale-profit-export-authority");
      return { request, result };
    },
    onSuccess: ({ request, result }) => {
      if (!isCurrentExportAuthority(request)) return;
      downloadBlob(result.blob, result.fileName);
      setExportNotice({
        authorityKey: request.authorityKey,
        kind: "success",
        fileName: result.fileName,
      });
    },
    onError: (_error, request) => {
      if (!isCurrentExportAuthority(request)) return;
      setExportNotice({ authorityKey: request.authorityKey, kind: "failure" });
    },
    onSettled: (_data, _error, request) => {
      if (exportLockRef.current === request.operationId) exportLockRef.current = null;
    },
  });

  function handleExport() {
    if (
      exportLockRef.current !== null ||
      !activeStoreId ||
      !canRead ||
      !canExport ||
      !hasLiveExportAuthority
    )
      return;
    const operationId = ++operationSequenceRef.current;
    exportLockRef.current = operationId;
    exportMutation.mutate({
      operationId,
      storeId: activeStoreId,
      membershipId: shell.activeStore?.membershipId,
      role: shell.activeStore?.role,
      membershipStatus: shell.activeStore?.status,
      authorityEpoch: authorityRef.current.epoch,
      authorityKey: authorityRef.current.key,
      input: {
        expected_store_id: activeStoreId,
        start_date: range.start_date,
        end_date: range.end_date,
      },
    });
  }

  function handleRefresh() {
    const current = authorityRef.current;
    const cached = queryClient.getQueryData<StoreContext>(storesKeys.context);
    const allowed = Boolean(
      mountedRef.current &&
      current.key === authorityKey &&
      current.storeId === activeStoreId &&
      current.canRead &&
      activeStoreId &&
      cached?.activeStore?.id === activeStoreId &&
      cached.activeStore.membershipId === shell.activeStore?.membershipId &&
      cached.activeStore.role === shell.activeStore?.role &&
      cached.activeStore.status === shell.activeStore?.status &&
      cached.permissions?.canReadRepairProfitReports === true,
    );
    if (!allowed) return;
    void query.refetch();
  }

  if (!shell.isLoading && !activeStoreId) {
    return (
      <RepairOsListScaffold
        title={t("profit.title")}
        subtitle={copy.noStoreDescription}
        eyebrow={t("page.workspaceFinance")}
      >
        <Card className="mx-auto max-w-xl rounded-2xl">
          <CardContent className="p-3 text-center sm:p-6">
            <WalletCards className="mx-auto size-8 text-muted-foreground" />
            <h2 className="mt-3 font-semibold">{copy.noStoreTitle}</h2>
            <p className="mt-2 text-sm text-muted-foreground">{copy.noStoreDescription}</p>
          </CardContent>
        </Card>
      </RepairOsListScaffold>
    );
  }

  if (!shell.isLoading && (!canRead || !hasLiveReadAuthority)) {
    return (
      <RepairOsListScaffold
        title={t("profit.title")}
        subtitle={t("profit.permissionSubtitle")}
        eyebrow={t("page.workspaceFinance")}
      >
        <Card className="mx-auto max-w-xl rounded-2xl">
          <CardContent className="p-3 text-center sm:p-6">
            <WalletCards className="mx-auto size-8 text-muted-foreground" />
            <h2 className="mt-3 font-semibold">{t("profit.restrictedTitle")}</h2>
            <p className="mt-2 text-sm leading-6 text-muted-foreground">
              {copy.restrictedDescription}
            </p>
          </CardContent>
        </Card>
      </RepairOsListScaffold>
    );
  }

  const authorizationLost = query.isError && isRepairDeskAuthorizationError(query.error);
  const hardError = authorizationLost || (query.isError && !query.data);
  const trend = (() => {
    const daily = query.data?.trend ?? [];
    if (trendMode === "daily") {
      return daily.map((point) => ({
        date: point.date,
        expected: point.expected_exact_margin_amount,
        completed: point.completed_exact_margin_amount,
      }));
    }
    const monthly = new Map<string, { date: string; expected: number; completed: number }>();
    daily.forEach((point) => {
      const month = point.date.slice(0, 7);
      const current = monthly.get(month) ?? { date: month, expected: 0, completed: 0 };
      current.expected += point.expected_exact_margin_amount;
      current.completed += point.completed_exact_margin_amount;
      monthly.set(month, current);
    });
    return [...monthly.values()];
  })();
  const financeActions = (
    <div className="flex items-center gap-2">
      {canExport && hasLiveExportAuthority ? (
        <Button
          variant="outline"
          size="sm"
          onClick={handleExport}
          disabled={exportLockRef.current !== null || exportMutation.isPending || !activeStoreId}
        >
          <Download className="mr-1.5 size-3.5" />
          {exportMutation.isPending ? copy.exportInProgress : copy.exportCsv}
        </Button>
      ) : null}
      <Button
        variant="outline"
        size="sm"
        onClick={handleRefresh}
        disabled={query.isFetching || !canRead}
      >
        <RefreshCw className={cn("mr-1.5 size-3.5", query.isFetching && "animate-spin")} />
        {copy.refresh}
      </Button>
    </div>
  );
  const financeMobileActions = (
    <div className="flex items-center gap-1">
      {canExport && hasLiveExportAuthority ? (
        <Button
          variant="outline"
          size="icon"
          className="min-h-11 min-w-11"
          aria-label={exportMutation.isPending ? copy.exportInProgress : copy.exportCsv}
          onClick={handleExport}
          disabled={exportLockRef.current !== null || exportMutation.isPending || !activeStoreId}
        >
          <Download className="size-4" />
        </Button>
      ) : null}
      <Button
        variant="outline"
        size="icon"
        className="min-h-11 min-w-11"
        aria-label={copy.refresh}
        onClick={handleRefresh}
        disabled={query.isFetching || !canRead}
      >
        <RefreshCw className={cn("size-4", query.isFetching && "animate-spin")} />
      </Button>
    </div>
  );

  return (
    <RepairOsListScaffold
      title={t("profit.title")}
      subtitle={query.isFetching ? t("profit.updating") : `${range.start_date} – ${range.end_date}`}
      eyebrow={t("page.workspaceFinance")}
      action={financeMobileActions}
      desktopAction={financeActions}
    >
      <div className="min-w-0 space-y-2 sm:space-y-3">
        {exportNotice?.authorityKey === authorityKey ? (
          <p
            className="rounded-xl border border-border/70 bg-muted/30 px-3 py-2 text-xs"
            role="status"
          >
            {exportNotice.kind === "success"
              ? formatCopy(copy.exportSuccess, { fileName: exportNotice.fileName ?? "" })
              : copy.exportFailed}
          </p>
        ) : null}
        <Card className="rounded-2xl border-border/70">
          <CardContent className="flex flex-col gap-2 p-2.5 sm:flex-row sm:items-end sm:gap-3 sm:p-4">
            <label className="min-w-0 flex-1 text-xs font-medium text-muted-foreground">
              {copy.startDate}
              <Input
                className="mt-1.5 min-h-11 lg:min-h-0"
                type="date"
                value={draft.start_date}
                onChange={(event) =>
                  setDraft((current) => ({ ...current, start_date: event.target.value }))
                }
              />
            </label>
            <label className="min-w-0 flex-1 text-xs font-medium text-muted-foreground">
              {copy.endDate}
              <Input
                ref={endDateRef}
                className="mt-1.5 min-h-11 lg:min-h-0"
                type="date"
                value={draft.end_date}
                aria-invalid={rangeInvalid || undefined}
                aria-describedby={rangeInvalid ? "profit-date-range-error" : undefined}
                onChange={(event) =>
                  setDraft((current) => ({ ...current, end_date: event.target.value }))
                }
              />
            </label>
            <Button
              className="min-h-11 lg:min-h-0"
              disabled={rangeInvalid || !draft.start_date || !draft.end_date || query.isFetching}
              onClick={() => setRange(draft)}
            >
              <CalendarDays className="mr-1.5 size-4" />
              {copy.applyDate}
            </Button>
          </CardContent>
          {rangeInvalid ? (
            <p
              id="profit-date-range-error"
              className="px-4 pb-3 text-xs text-destructive"
              role="alert"
            >
              {copy.rangeInvalid}
            </p>
          ) : null}
        </Card>

        {shell.isLoading || (query.isLoading && !query.data) ? (
          <ProfitLoading label={copy.loadingAria} />
        ) : null}

        {hardError ? (
          <Card className="rounded-2xl border-destructive/30">
            <CardContent className="p-3 text-center sm:p-6">
              <AlertTriangle className="mx-auto size-7 text-destructive" />
              <h2 className="mt-3 font-semibold">
                {authorizationLost ? copy.authorizationLostTitle : copy.readFailedTitle}
              </h2>
              <p className="mt-2 text-sm text-muted-foreground">
                {authorizationLost ? copy.authorizationLostDescription : copy.readFailedDescription}
              </p>
              {!authorizationLost ? (
                <Button className="mt-4" variant="outline" onClick={handleRefresh}>
                  {copy.retry}
                </Button>
              ) : null}
            </CardContent>
          </Card>
        ) : null}

        {query.isError && query.data && !authorizationLost ? (
          <p
            className="rounded-xl border border-border/70 bg-muted/30 px-3 py-2 text-xs"
            role="status"
          >
            {copy.refreshFailed}
          </p>
        ) : null}

        {query.data && !authorizationLost && activeStoreId && hasLiveReadAuthority ? (
          <>
            <div className="rounded-2xl border border-border/70 bg-muted/30 px-2.5 py-2 text-[11px] leading-4 text-muted-foreground sm:px-3.5 sm:py-3 sm:text-xs sm:leading-5 lg:text-[13px]">
              {copy.methodology}
            </div>
            <PeriodCards
              expected={query.data.summary.expected}
              completed={query.data.summary.completed}
              copy={copy}
            />

            <Card className="rounded-2xl border-border/70">
              <CardHeader className="p-3 pb-1.5 sm:p-4 sm:pb-2">
                <CardTitle className="text-sm">{copy.dataQualityTitle}</CardTitle>
              </CardHeader>
              <CardContent className="grid grid-cols-2 gap-1.5 p-3 pt-1.5 text-xs sm:gap-2 sm:p-4 sm:pt-2 sm:text-sm lg:grid-cols-4">
                <div>
                  <p className="text-xs text-muted-foreground">{copy.unknownCostLines}</p>
                  <p className="mt-1 font-semibold">
                    {query.data.summary.data_quality.unknown_line_count}
                  </p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">{copy.refundedOrders}</p>
                  <p className="mt-1 font-semibold">
                    {query.data.summary.data_quality.refunded_order_count}
                  </p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">{copy.reworkOrders}</p>
                  <p className="mt-1 font-semibold">
                    {query.data.summary.data_quality.rework_order_count}
                  </p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">{copy.collectionReference}</p>
                  <p className="mt-1 font-semibold">
                    <MoneyText amount={query.data.summary.collection_reference.amount} />
                  </p>
                </div>
              </CardContent>
            </Card>

            <Card className="min-w-0 rounded-2xl border-border/70">
              <CardHeader className="flex-row items-center justify-between gap-2 p-3 pb-1.5 sm:gap-3 sm:p-4 sm:pb-2">
                <CardTitle className="text-sm">
                  {trendMode === "daily" ? copy.dailyTrend : copy.monthlyTrend}
                </CardTitle>
                <div className="flex rounded-lg border border-border/70 bg-muted/30 p-0.5">
                  <Button
                    type="button"
                    size="sm"
                    variant={trendMode === "daily" ? "secondary" : "ghost"}
                    className="min-h-11 px-2 text-xs lg:h-7 lg:min-h-0 lg:px-2.5"
                    onClick={() => setTrendMode("daily")}
                  >
                    {copy.daily}
                  </Button>
                  <Button
                    type="button"
                    size="sm"
                    variant={trendMode === "monthly" ? "secondary" : "ghost"}
                    className="min-h-11 px-2 text-xs lg:h-7 lg:min-h-0 lg:px-2.5"
                    onClick={() => setTrendMode("monthly")}
                  >
                    {copy.monthly}
                  </Button>
                </div>
              </CardHeader>
              <CardContent className="min-w-0 p-3 pt-1.5 sm:p-4 sm:pt-2">
                <ProfitTrend data={trend} copy={copy} />
              </CardContent>
            </Card>

            {query.data.breakdowns ? (
              <Card className="min-w-0 rounded-2xl border-border/70">
                <CardHeader className="p-3 pb-1.5 sm:p-4 sm:pb-2">
                  <CardTitle className="text-sm">{copy.breakdownTitle}</CardTitle>
                </CardHeader>
                <CardContent className="grid min-w-0 gap-2.5 p-3 pt-1.5 sm:gap-4 sm:p-4 sm:pt-2 xl:grid-cols-2">
                  <div className="min-w-0 rounded-xl border border-border/70">
                    <p className="border-b border-border/60 px-3 py-2 text-xs font-semibold">
                      {copy.byCategory}
                    </p>
                    <BreakdownTable
                      items={query.data.breakdowns.categories}
                      empty={copy.noCategory}
                      copy={copy}
                      isDesktop={isDesktop}
                    />
                  </div>
                  <div className="min-w-0 rounded-xl border border-border/70">
                    <p className="border-b border-border/60 px-3 py-2 text-xs font-semibold">
                      {copy.bySupplier}
                    </p>
                    <BreakdownTable
                      items={query.data.breakdowns.suppliers}
                      empty={copy.noSupplier}
                      copy={copy}
                      isDesktop={isDesktop}
                    />
                  </div>
                </CardContent>
              </Card>
            ) : null}

            <Card className="min-w-0 rounded-2xl border-border/70">
              <CardHeader className="p-3 pb-1.5 sm:p-4 sm:pb-2">
                <CardTitle className="flex items-center justify-between gap-2 text-sm">
                  <span>{copy.orderReview}</span>
                  {query.data.summary.expected.negative_margin_order_count > 0 ? (
                    <Badge variant="destructive" className="gap-1">
                      <TrendingDown className="size-3" />
                      {formatCopy(copy.negativeMarginOrders, {
                        count: query.data.summary.expected.negative_margin_order_count,
                      })}
                    </Badge>
                  ) : null}
                </CardTitle>
              </CardHeader>
              <CardContent className="min-w-0 p-3 pt-1.5 sm:p-4 sm:pt-2">
                <OrderDrilldown orders={query.data.orders} copy={copy} isDesktop={isDesktop} />
              </CardContent>
            </Card>
          </>
        ) : null}
      </div>
    </RepairOsListScaffold>
  );
}

function downloadBlob(blob: Blob, fileName: string) {
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = fileName;
  anchor.hidden = true;
  document.body.append(anchor);
  anchor.click();
  anchor.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 0);
}
