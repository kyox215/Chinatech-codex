"use client";

import { keepPreviousData, useMutation, useQuery } from "@tanstack/react-query";
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
import { useMemo, useState } from "react";
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
import { useStoreShellContext } from "@/features/stores/api/use-store-shell-context";
import { exportCostReport, isRepairDeskAuthorizationError } from "@/lib/repairdesk/api";
import type {
  ProfitCenterInput,
  ProfitBreakdownItem,
  ProfitOrderDrilldownItem,
  ProfitPeriodSummary,
} from "@/lib/repairdesk/types";
import { cn } from "@/lib/utils";
import { buildOrderDetailWorkspaceHref } from "@/features/orders/model/order-workspace-intent";
import { RepairOsListScaffold } from "@/shared/ui";

const FALLBACK_TIMEZONE = "Europe/Rome";

function localDate(date: Date, timeZone = FALLBACK_TIMEZONE) {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(date);
  const value = Object.fromEntries(parts.map((part) => [part.type, part.value]));
  return `${value.year}-${value.month}-${value.day}`;
}

function defaultRange(): ProfitCenterInput {
  const end = new Date();
  const start = new Date(end);
  start.setUTCDate(start.getUTCDate() - 29);
  return { start_date: localDate(start), end_date: localDate(end) };
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
}: {
  expected: ProfitPeriodSummary;
  completed: ProfitPeriodSummary;
}) {
  return (
    <div className="grid min-w-0 grid-cols-2 gap-2.5 lg:grid-cols-4">
      <ProfitMetric
        label="预计维修毛利"
        value={<MoneyText amount={expected.exact_margin_amount} />}
        detail={`${expected.exact_order_count} 单成本完整 · ${expected.incomplete_order_count} 单待补成本`}
        warning={expected.exact_margin_amount < 0}
      />
      <ProfitMetric
        label="已完工报价毛利"
        value={<MoneyText amount={completed.exact_margin_amount} />}
        detail={`${completed.exact_order_count} 单成本完整 · 按交付日期`}
        warning={completed.exact_margin_amount < 0}
      />
      <ProfitMetric
        label="已知成本"
        value={<MoneyText amount={expected.known_cost_amount} />}
        detail={`覆盖率 ${percent(expected.exact_order_count, expected.eligible_order_count)} · 未知不按 0 计算`}
      />
      <ProfitMetric
        label="完整成本订单"
        value={percent(expected.exact_order_count, expected.eligible_order_count)}
        detail={`${expected.estimated_order_count} 单含估算 · ${expected.negative_margin_order_count} 单负毛利`}
        warning={expected.negative_margin_order_count > 0}
      />
    </div>
  );
}

function ProfitTrend({ data }: { data: Array<Record<string, string | number>> }) {
  if (data.length === 0) {
    return (
      <p className="py-10 text-center text-sm text-muted-foreground">当前日期范围暂无趋势数据。</p>
    );
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
                name === "expected" ? "预计维修毛利" : "已完工报价毛利",
              ]}
            />
            <Legend
              formatter={(value) => (value === "expected" ? "预计维修毛利" : "已完工报价毛利")}
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
        <summary className="cursor-pointer font-medium">查看趋势数据表</summary>
        <div className="mt-2 max-h-64 overflow-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>日期</TableHead>
                <TableHead className="text-right">预计毛利</TableHead>
                <TableHead className="text-right">完工毛利</TableHead>
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

function CompletenessBadge({ order }: { order: ProfitOrderDrilldownItem }) {
  if (order.cost_completeness === "incomplete") {
    return (
      <Badge variant="outline" className="gap-1">
        <CircleHelp className="size-3" />
        成本不完整
      </Badge>
    );
  }
  if (order.cost_completeness === "estimated") {
    return (
      <Badge variant="secondary" className="gap-1">
        <AlertTriangle className="size-3" />
        含估算
      </Badge>
    );
  }
  return (
    <Badge variant="outline" className="gap-1">
      <CheckCircle2 className="size-3" />
      已确认
    </Badge>
  );
}

function OrderDrilldown({ orders }: { orders: ProfitOrderDrilldownItem[] }) {
  if (orders.length === 0) {
    return (
      <p className="py-10 text-center text-sm text-muted-foreground">当前日期范围暂无维修工单。</p>
    );
  }
  return (
    <div className="min-w-0 overflow-hidden rounded-xl border border-border/70">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>工单</TableHead>
            <TableHead>成本证据</TableHead>
            <TableHead className="text-right">报价</TableHead>
            <TableHead className="text-right">已知成本</TableHead>
            <TableHead className="text-right">报价毛利</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {orders.map((order) => (
            <TableRow key={order.order_id}>
              <TableCell>
                <Link
                  className="font-mono text-xs font-semibold text-primary hover:underline"
                  href={buildOrderDetailWorkspaceHref(order.order_id, { source: "profit" })}
                >
                  {order.public_no}
                </Link>
                <div className="mt-1 flex flex-wrap gap-1">
                  {order.is_refunded ? (
                    <Badge variant="destructive">已退款 · 汇总排除</Badge>
                  ) : null}
                  {order.is_rework ? <Badge variant="secondary">返修</Badge> : null}
                </div>
              </TableCell>
              <TableCell>
                <CompletenessBadge order={order} />
                {order.currency_costs?.length ? (
                  <details className="mt-1.5 text-[10px] text-muted-foreground">
                    <summary className="cursor-pointer">
                      原币成本快照 {order.currency_costs.length} 项
                    </summary>
                    <div className="mt-1 space-y-1 rounded-lg bg-muted/30 p-2">
                      {order.currency_costs.map((cost) => (
                        <p key={cost.line_id}>
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
                ) : null}
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
                  <span className="text-xs text-muted-foreground">待补成本</span>
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

function BreakdownTable({ items, empty }: { items: ProfitBreakdownItem[]; empty: string }) {
  if (items.length === 0)
    return <p className="py-6 text-center text-xs text-muted-foreground">{empty}</p>;
  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>分组</TableHead>
          <TableHead className="text-right">报价</TableHead>
          <TableHead className="text-right">已知成本</TableHead>
          <TableHead className="text-right">完整行毛利</TableHead>
          <TableHead className="text-right">待补</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {items.map((item) => (
          <TableRow key={item.key}>
            <TableCell>
              <span className="font-medium">{item.label}</span>
              <span className="ml-1 text-[10px] text-muted-foreground">{item.order_count} 单</span>
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

function ProfitLoading() {
  return (
    <div className="space-y-3" aria-label="正在读取维修毛利">
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
  const shell = useStoreShellContext();
  const activeStoreId = shell.activeStore?.id;
  const canRead = shell.permissions?.canReadRepairProfitReports === true;
  const canExport = shell.permissions?.canExportRepairCosts === true;
  const initialRange = useMemo(defaultRange, []);
  const [draft, setDraft] = useState(initialRange);
  const [range, setRange] = useState(initialRange);
  const [trendMode, setTrendMode] = useState<"daily" | "monthly">("daily");
  const [exportNotice, setExportNotice] = useState<string>();
  const rangeInvalid = draft.end_date < draft.start_date;
  const query = useQuery({
    ...profitCenterQueryOptions(range, activeStoreId),
    enabled: Boolean(activeStoreId && canRead),
    placeholderData: keepPreviousData,
    refetchOnWindowFocus: false,
  });
  const exportMutation = useMutation({
    mutationFn: () => {
      if (!activeStoreId) throw new Error("缺少当前店铺");
      return exportCostReport({
        expected_store_id: activeStoreId,
        start_date: range.start_date,
        end_date: range.end_date,
      });
    },
    onSuccess: ({ blob, fileName }) => {
      downloadBlob(blob, fileName);
      setExportNotice(`${fileName} 已生成并开始下载。`);
    },
    onError: (error) => {
      setExportNotice(error instanceof Error ? error.message : "生成成本导出失败");
    },
  });

  if (!shell.isLoading && !canRead) {
    return (
      <RepairOsListScaffold
        title="维修毛利"
        subtitle="需要财务利润查看权限"
        eyebrow="工作台 / 财务"
      >
        <Card className="mx-auto max-w-xl rounded-2xl">
          <CardContent className="p-3 text-center sm:p-6">
            <WalletCards className="mx-auto size-8 text-muted-foreground" />
            <h2 className="mt-3 font-semibold">此页面仅对获授权人员开放</h2>
            <p className="mt-2 text-sm leading-6 text-muted-foreground">
              成本、毛利、趋势及订单级财务数据均未向当前账号请求或展示。
            </p>
          </CardContent>
        </Card>
      </RepairOsListScaffold>
    );
  }

  const hardError = query.isError && !query.data;
  const authorizationLost = hardError && isRepairDeskAuthorizationError(query.error);
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

  return (
    <RepairOsListScaffold
      title="维修毛利"
      subtitle={query.isFetching ? "正在更新经营毛利" : `${range.start_date} 至 ${range.end_date}`}
      eyebrow="工作台 / 财务"
      desktopAction={
        <div className="flex items-center gap-2">
          {canExport ? (
            <Button
              variant="outline"
              size="sm"
              onClick={() => exportMutation.mutate()}
              disabled={exportMutation.isPending || !activeStoreId}
            >
              <Download className="mr-1.5 size-3.5" />
              {exportMutation.isPending ? "正在导出" : "导出成本 CSV"}
            </Button>
          ) : null}
          <Button
            variant="outline"
            size="sm"
            onClick={() => void query.refetch()}
            disabled={query.isFetching || !canRead}
          >
            <RefreshCw className={cn("mr-1.5 size-3.5", query.isFetching && "animate-spin")} />
            刷新
          </Button>
        </div>
      }
    >
      <div className="min-w-0 space-y-2 sm:space-y-3">
        {exportNotice ? (
          <p
            className="rounded-xl border border-border/70 bg-muted/30 px-3 py-2 text-xs"
            role="status"
          >
            {exportNotice}
          </p>
        ) : null}
        <Card className="rounded-2xl border-border/70">
          <CardContent className="flex flex-col gap-2 p-2.5 sm:flex-row sm:items-end sm:gap-3 sm:p-4">
            <label className="min-w-0 flex-1 text-xs font-medium text-muted-foreground">
              开始日期
              <Input
                className="mt-1.5"
                type="date"
                value={draft.start_date}
                onChange={(event) =>
                  setDraft((current) => ({ ...current, start_date: event.target.value }))
                }
              />
            </label>
            <label className="min-w-0 flex-1 text-xs font-medium text-muted-foreground">
              结束日期
              <Input
                className="mt-1.5"
                type="date"
                value={draft.end_date}
                onChange={(event) =>
                  setDraft((current) => ({ ...current, end_date: event.target.value }))
                }
              />
            </label>
            <Button
              disabled={rangeInvalid || !draft.start_date || !draft.end_date || query.isFetching}
              onClick={() => setRange(draft)}
            >
              <CalendarDays className="mr-1.5 size-4" />
              应用日期
            </Button>
          </CardContent>
          {rangeInvalid ? (
            <p className="px-4 pb-3 text-xs text-destructive">结束日期不能早于开始日期。</p>
          ) : null}
        </Card>

        {shell.isLoading || (query.isLoading && !query.data) ? <ProfitLoading /> : null}

        {hardError ? (
          <Card className="rounded-2xl border-destructive/30">
            <CardContent className="p-3 text-center sm:p-6">
              <AlertTriangle className="mx-auto size-7 text-destructive" />
              <h2 className="mt-3 font-semibold">
                {authorizationLost ? "利润查看权限已失效" : "维修毛利读取失败"}
              </h2>
              <p className="mt-2 text-sm text-muted-foreground">
                {authorizationLost
                  ? "页面已停止请求，请联系店主重新分配权限。"
                  : "没有展示不完整的财务汇总，请稍后重试。"}
              </p>
              {!authorizationLost ? (
                <Button className="mt-4" variant="outline" onClick={() => void query.refetch()}>
                  重试
                </Button>
              ) : null}
            </CardContent>
          </Card>
        ) : null}

        {query.data ? (
          <>
            <div className="rounded-2xl border border-border/70 bg-muted/30 px-2.5 py-2 text-[11px] leading-4 text-muted-foreground sm:px-3.5 sm:py-3 sm:text-xs sm:leading-5">
              按含税最终报价计算的经营毛利，不是会计净利润；收款参考未扣退款。退款订单不进入报价毛利汇总，未知成本不会按
              0 计算。
            </div>
            <PeriodCards
              expected={query.data.summary.expected}
              completed={query.data.summary.completed}
            />

            <Card className="rounded-2xl border-border/70">
              <CardHeader className="p-3 pb-1.5 sm:p-4 sm:pb-2">
                <CardTitle className="text-sm">数据质量与收款参考</CardTitle>
              </CardHeader>
              <CardContent className="grid grid-cols-2 gap-1.5 p-3 pt-1.5 text-xs sm:gap-2 sm:p-4 sm:pt-2 sm:text-sm lg:grid-cols-4">
                <div>
                  <p className="text-xs text-muted-foreground">未知成本行</p>
                  <p className="mt-1 font-semibold">
                    {query.data.summary.data_quality.unknown_line_count}
                  </p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">退款订单</p>
                  <p className="mt-1 font-semibold">
                    {query.data.summary.data_quality.refunded_order_count}
                  </p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">返修订单</p>
                  <p className="mt-1 font-semibold">
                    {query.data.summary.data_quality.rework_order_count}
                  </p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">收款参考（未扣退款）</p>
                  <p className="mt-1 font-semibold">
                    <MoneyText amount={query.data.summary.collection_reference.amount} />
                  </p>
                </div>
              </CardContent>
            </Card>

            <Card className="min-w-0 rounded-2xl border-border/70">
              <CardHeader className="flex-row items-center justify-between gap-2 p-3 pb-1.5 sm:gap-3 sm:p-4 sm:pb-2">
                <CardTitle className="text-sm">
                  {trendMode === "daily" ? "每日毛利趋势" : "每月毛利趋势"}
                </CardTitle>
                <div className="flex rounded-lg border border-border/70 bg-muted/30 p-0.5">
                  <Button
                    type="button"
                    size="sm"
                    variant={trendMode === "daily" ? "secondary" : "ghost"}
                    className="min-h-11 px-2 text-xs lg:h-7 lg:min-h-0 lg:px-2.5"
                    onClick={() => setTrendMode("daily")}
                  >
                    按日
                  </Button>
                  <Button
                    type="button"
                    size="sm"
                    variant={trendMode === "monthly" ? "secondary" : "ghost"}
                    className="min-h-11 px-2 text-xs lg:h-7 lg:min-h-0 lg:px-2.5"
                    onClick={() => setTrendMode("monthly")}
                  >
                    按月
                  </Button>
                </div>
              </CardHeader>
              <CardContent className="min-w-0 p-3 pt-1.5 sm:p-4 sm:pt-2">
                <ProfitTrend data={trend} />
              </CardContent>
            </Card>

            {query.data.breakdowns ? (
              <Card className="min-w-0 rounded-2xl border-border/70">
                <CardHeader className="p-3 pb-1.5 sm:p-4 sm:pb-2">
                  <CardTitle className="text-sm">维修类别与供应商毛利拆分</CardTitle>
                </CardHeader>
                <CardContent className="grid min-w-0 gap-2.5 p-3 pt-1.5 sm:gap-4 sm:p-4 sm:pt-2 xl:grid-cols-2">
                  <div className="min-w-0 overflow-auto rounded-xl border border-border/70">
                    <p className="border-b border-border/60 px-3 py-2 text-xs font-semibold">
                      按维修类别
                    </p>
                    <BreakdownTable items={query.data.breakdowns.categories} empty="暂无类别数据" />
                  </div>
                  <div className="min-w-0 overflow-auto rounded-xl border border-border/70">
                    <p className="border-b border-border/60 px-3 py-2 text-xs font-semibold">
                      按采购供应商
                    </p>
                    <BreakdownTable
                      items={query.data.breakdowns.suppliers}
                      empty="暂无供应商关联数据"
                    />
                  </div>
                </CardContent>
              </Card>
            ) : null}

            <Card className="min-w-0 rounded-2xl border-border/70">
              <CardHeader className="p-3 pb-1.5 sm:p-4 sm:pb-2">
                <CardTitle className="flex items-center justify-between gap-2 text-sm">
                  <span>订单级核对</span>
                  {query.data.summary.expected.negative_margin_order_count > 0 ? (
                    <Badge variant="destructive" className="gap-1">
                      <TrendingDown className="size-3" />
                      {query.data.summary.expected.negative_margin_order_count} 单负毛利
                    </Badge>
                  ) : null}
                </CardTitle>
              </CardHeader>
              <CardContent className="min-w-0 p-3 pt-1.5 sm:p-4 sm:pt-2">
                <OrderDrilldown orders={query.data.orders} />
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
