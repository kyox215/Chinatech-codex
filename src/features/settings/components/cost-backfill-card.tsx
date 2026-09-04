"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { AlertTriangle, History, RotateCcw, ShieldCheck } from "lucide-react";
import { toast } from "sonner";

import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { costBackfillKeys } from "@/features/profit/api/query-keys";
import {
  applyCostBackfill,
  previewCostBackfill,
  readCostBackfillRuns,
  revertCostBackfill,
} from "@/lib/repairdesk/api";
import type { CostBackfillRun } from "@/lib/repairdesk/types";
import { formatMoney } from "@/lib/money";
import { repairOs } from "@/lib/ui-patterns";
import { cn } from "@/lib/utils";
import { useLocale } from "@/shared/i18n/locale-provider";
import { translateSettingsOperations } from "@/shared/i18n/messages";

function localDate(date: Date) {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Europe/Rome",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(date);
}

function initialRange() {
  const end = new Date();
  const start = new Date(end);
  start.setUTCDate(start.getUTCDate() - 365);
  return { start_date: localDate(start), end_date: localDate(end) };
}

export function CostBackfillCard({ storeId, canApply }: { storeId: string; canApply: boolean }) {
  const { locale } = useLocale();
  const copy = (
    source: Parameters<typeof translateSettingsOperations>[1],
    values?: Parameters<typeof translateSettingsOperations>[2],
  ) => translateSettingsOperations(locale, source, values);
  const client = useQueryClient();
  const initial = useMemo(initialRange, []);
  const [range, setRange] = useState(initial);
  const [maxCandidates, setMaxCandidates] = useState("500");
  const [selected, setSelected] = useState<CostBackfillRun>();
  const mountedRef = useRef(true);
  const storeIdRef = useRef(storeId);
  const epochRef = useRef(0);
  const previewLockRef = useRef(false);
  const applyLockRef = useRef(false);
  const revertLockRef = useRef(false);
  const selectLockRef = useRef(false);
  const previewAttemptRef = useRef<
    { fingerprint: string; request: Parameters<typeof previewCostBackfill>[0] } | undefined
  >(undefined);

  useEffect(() => {
    if (storeIdRef.current !== storeId) {
      storeIdRef.current = storeId;
      epochRef.current += 1;
      previewLockRef.current = false;
      applyLockRef.current = false;
      revertLockRef.current = false;
      selectLockRef.current = false;
      previewAttemptRef.current = undefined;
      setSelected(undefined);
    }
  }, [storeId]);

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
      epochRef.current += 1;
    };
  }, []);

  const isCurrent = (epoch: number, expectedStoreId = storeId) =>
    mountedRef.current && epochRef.current === epoch && storeIdRef.current === expectedStoreId;
  const history = useQuery({
    queryKey: costBackfillKeys.runs(storeId),
    queryFn: () => readCostBackfillRuns({ expected_store_id: storeId }),
  });
  const refresh = async () => {
    await client.invalidateQueries({ queryKey: costBackfillKeys.all });
  };
  const preview = useMutation({
    mutationFn: (variables: {
      request: Parameters<typeof previewCostBackfill>[0];
      epoch: number;
    }) => previewCostBackfill(variables.request),
    onSuccess: async (run, variables) => {
      if (!isCurrent(variables.epoch, variables.request.expected_store_id)) return;
      setSelected(run);
      previewAttemptRef.current = undefined;
      await refresh();
      if (!isCurrent(variables.epoch, variables.request.expected_store_id)) return;
      toast.success(copy("历史成本候选预览已生成，尚未修改订单"));
    },
    onError: (_error, variables) => {
      if (isCurrent(variables.epoch, variables.request.expected_store_id)) {
        toast.error(copy("操作失败，请稍后重试。"));
      }
    },
    onSettled: (_data, _error, variables) => {
      if (isCurrent(variables.epoch, variables.request.expected_store_id))
        previewLockRef.current = false;
    },
  });
  const apply = useMutation({
    mutationFn: (variables: { run: CostBackfillRun; epoch: number }) =>
      applyCostBackfill({
        expected_store_id: storeId,
        run_id: variables.run.id,
        expected_fixture_hash: variables.run.fixture_hash,
        batch_size: 50,
        idempotency_key: variables.run.id,
      }),
    onSuccess: async (run, variables) => {
      if (!isCurrent(variables.epoch)) return;
      setSelected(run);
      await refresh();
      if (!isCurrent(variables.epoch)) return;
      toast.success(copy(run.state === "applied" ? "回填运行已完成" : "已应用一批，可继续执行"));
    },
    onError: (_error, variables) => {
      if (isCurrent(variables.epoch)) toast.error(copy("操作失败，请稍后重试。"));
    },
    onSettled: (_data, _error, variables) => {
      if (isCurrent(variables.epoch)) applyLockRef.current = false;
    },
  });
  const revert = useMutation({
    mutationFn: (variables: { run: CostBackfillRun; epoch: number }) =>
      revertCostBackfill({
        expected_store_id: storeId,
        run_id: variables.run.id,
        batch_size: 50,
        idempotency_key: variables.run.id,
      }),
    onSuccess: async (run, variables) => {
      if (!isCurrent(variables.epoch)) return;
      setSelected(run);
      await refresh();
      if (!isCurrent(variables.epoch)) return;
      toast.success(copy(run.state === "reverted" ? "补偿撤销已完成" : "撤销完成但存在冲突"));
    },
    onError: (_error, variables) => {
      if (isCurrent(variables.epoch)) toast.error(copy("操作失败，请稍后重试。"));
    },
    onSettled: (_data, _error, variables) => {
      if (isCurrent(variables.epoch)) revertLockRef.current = false;
    },
  });
  const active = selected;
  const rangeInvalid = range.end_date < range.start_date;
  const maxValue = Number(maxCandidates);
  const previewDisabled =
    preview.isPending ||
    rangeInvalid ||
    !Number.isInteger(maxValue) ||
    maxValue < 1 ||
    maxValue > 5_000;

  const submitPreview = () => {
    if (previewLockRef.current || previewDisabled) return;
    const canonical = {
      expected_store_id: storeId,
      start_date: range.start_date,
      end_date: range.end_date,
      max_candidates: Number(maxCandidates),
    };
    const fingerprint = JSON.stringify(canonical);
    if (previewAttemptRef.current?.fingerprint !== fingerprint) {
      previewAttemptRef.current = {
        fingerprint,
        request: { ...canonical, idempotency_key: crypto.randomUUID() },
      };
    }
    previewLockRef.current = true;
    preview.mutate({ request: previewAttemptRef.current.request, epoch: epochRef.current });
  };

  const submitApply = (run: CostBackfillRun) => {
    if (!canApply || applyLockRef.current) return;
    applyLockRef.current = true;
    apply.mutate({ run, epoch: epochRef.current });
  };

  const submitRevert = (run: CostBackfillRun) => {
    if (!canApply || revertLockRef.current) return;
    revertLockRef.current = true;
    revert.mutate({ run, epoch: epochRef.current });
  };

  const selectRun = async (run: { id: string }) => {
    if (selectLockRef.current) return;
    const epoch = epochRef.current;
    selectLockRef.current = true;
    try {
      const result = await readCostBackfillRuns({ expected_store_id: storeId, run_id: run.id });
      if (isCurrent(epoch) && result.selected) setSelected(result.selected);
    } catch {
      if (isCurrent(epoch)) toast.error(copy("读取失败，请稍后重试。"));
    } finally {
      if (isCurrent(epoch)) selectLockRef.current = false;
    }
  };

  return (
    <section className={cn(repairOs.mobileInfoCard, "min-w-0 space-y-4 p-3 sm:p-4")}>
      <div>
        <div className="flex items-center gap-2 text-sm font-semibold">
          <History className="size-4 text-primary" /> {copy("历史订单成本回填")}
        </div>
        <p className="mt-1 text-xs leading-5 text-muted-foreground">
          {copy(
            "先生成只读候选；历史有效默认值仅标记为估算，没有历史证据的项目保持未知。发布与部署不会自动应用任何运行。",
          )}
        </p>
      </div>

      <div className="grid gap-2 rounded-xl border border-border/70 bg-muted/20 p-3 sm:grid-cols-3">
        <Label className="text-xs">
          {copy("开始日期")}
          <Input
            type="date"
            value={range.start_date}
            onChange={(event) =>
              setRange((value) => ({ ...value, start_date: event.target.value }))
            }
          />
        </Label>
        <Label className="text-xs">
          {copy("结束日期")}
          <Input
            type="date"
            value={range.end_date}
            onChange={(event) => setRange((value) => ({ ...value, end_date: event.target.value }))}
          />
        </Label>
        <Label className="text-xs">
          {copy("最大候选数")}
          <Input
            type="number"
            min={1}
            max={5000}
            value={maxCandidates}
            onChange={(event) => setMaxCandidates(event.target.value)}
          />
        </Label>
        <div className="sm:col-span-3 sm:justify-self-end">
          <Button type="button" size="sm" disabled={previewDisabled} onClick={submitPreview}>
            <ShieldCheck className="mr-1.5 size-3.5" />
            {copy(preview.isPending ? "正在生成预览" : "生成只读预览")}
          </Button>
        </div>
        {rangeInvalid ? (
          <p className="sm:col-span-3 text-xs text-destructive">
            {copy("结束日期不能早于开始日期。")}
          </p>
        ) : null}
      </div>

      {history.isPending ? (
        <p className="text-xs text-muted-foreground">{copy("正在读取回填运行…")}</p>
      ) : null}
      {history.isError ? (
        <p role="alert" className="text-xs text-destructive">
          {copy("回填运行读取失败。")}
        </p>
      ) : null}

      {active ? (
        <div className="space-y-3 rounded-xl border border-border/70 p-3">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div>
              <p className="text-xs font-semibold">
                {copy("运行 {id}", { id: active.id.slice(0, 8) })}
              </p>
              <p className="font-mono text-[10px] text-muted-foreground lg:text-xs lg:leading-4">
                {copy("校验 {hash}…", { hash: active.fixture_hash.slice(0, 16) })}
              </p>
            </div>
            <Badge variant="outline">{stateLabel(active.state, copy)}</Badge>
          </div>
          <div className="grid grid-cols-2 gap-2 text-xs sm:grid-cols-4">
            <Metric label={copy("候选")} value={active.candidate_count} />
            <Metric label={copy("历史估算")} value={active.estimated_count} />
            <Metric label={copy("保持未知")} value={active.unknown_count} />
            <Metric
              label={copy("冲突 / 失败")}
              value={`${active.conflict_count} / ${active.failed_count}`}
            />
          </div>
          <div className="max-h-56 overflow-auto rounded-lg border border-border/60">
            {active.candidates.map((candidate) => (
              <div
                key={candidate.id}
                className="flex items-center justify-between gap-3 border-b border-border/50 px-2.5 py-2 text-xs last:border-b-0"
              >
                <div className="min-w-0">
                  <p className="truncate font-medium">{candidate.line_name}</p>
                  <p className="font-mono text-[10px] text-muted-foreground lg:text-xs lg:leading-4">
                    {copy("{id} · 第 {line} 行", {
                      id: candidate.order_id.slice(0, 8),
                      line: candidate.line_ordinal,
                    })}
                  </p>
                </div>
                <span className="shrink-0 text-right">
                  {candidate.proposed_cost_amount === null
                    ? copy("未知")
                    : copy("{amount} · 估算", {
                        amount: formatMoney(candidate.proposed_cost_amount),
                      })}
                </span>
              </div>
            ))}
          </div>
          {canApply ? (
            <div className="flex flex-wrap justify-end gap-2 border-t border-border/60 pt-3">
              {active.state === "previewed" || active.state === "partially_applied" ? (
                <AlertDialog>
                  <AlertDialogTrigger asChild>
                    <Button type="button" size="sm" disabled={apply.isPending}>
                      {copy("应用下一批")}
                    </Button>
                  </AlertDialogTrigger>
                  <AlertDialogContent>
                    <AlertDialogHeader>
                      <AlertDialogTitle>{copy("应用这个历史成本候选批次？")}</AlertDialogTitle>
                      <AlertDialogDescription>
                        {copy(
                          "仅处理仍与预览哈希和预期修订一致的订单；后续人工编辑会被跳过。每批最多 50 个订单，可安全续跑。",
                        )}
                      </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                      <AlertDialogCancel>{copy("取消")}</AlertDialogCancel>
                      <AlertDialogAction onClick={() => submitApply(active)}>
                        {copy("确认应用")}
                      </AlertDialogAction>
                    </AlertDialogFooter>
                  </AlertDialogContent>
                </AlertDialog>
              ) : null}
              {active.applied_count > 0 &&
              !["reverted", "revert_partial"].includes(active.state) ? (
                <AlertDialog>
                  <AlertDialogTrigger asChild>
                    <Button type="button" size="sm" variant="outline" disabled={revert.isPending}>
                      <RotateCcw className="mr-1.5 size-3.5" />
                      {copy("补偿撤销")}
                    </Button>
                  </AlertDialogTrigger>
                  <AlertDialogContent>
                    <AlertDialogHeader>
                      <AlertDialogTitle>{copy("撤销这个运行写入的成本？")}</AlertDialogTitle>
                      <AlertDialogDescription>
                        {copy(
                          "只追加补偿记录，不删除历史；检测到后续人工成本修改时会停止该订单并报告冲突。已补齐的稳定维修行 ID 会保留。",
                        )}
                      </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                      <AlertDialogCancel>{copy("取消")}</AlertDialogCancel>
                      <AlertDialogAction onClick={() => submitRevert(active)}>
                        {copy("确认撤销")}
                      </AlertDialogAction>
                    </AlertDialogFooter>
                  </AlertDialogContent>
                </AlertDialog>
              ) : null}
            </div>
          ) : (
            <p className="flex items-center gap-1.5 border-t border-border/60 pt-3 text-xs text-muted-foreground">
              <AlertTriangle className="size-3.5" />
              {copy("你可以生成预览；只有店主可应用或撤销。")}
            </p>
          )}
        </div>
      ) : null}

      {!active && (history.data?.runs.length ?? 0) > 0 ? (
        <div className="space-y-2">
          <p className="text-xs font-semibold">{copy("最近运行")}</p>
          {history.data?.runs.slice(0, 3).map((run) => (
            <button
              key={run.id}
              type="button"
              className="flex w-full items-center justify-between rounded-xl border border-border/70 px-3 py-2 text-left text-xs"
              onClick={() => void selectRun(run)}
            >
              <span>{copy("{start} 至 {end}", { start: run.start_date, end: run.end_date })}</span>
              <span>
                {copy("{state} · {count} 条", {
                  state: stateLabel(run.state, copy),
                  count: run.candidate_count,
                })}
              </span>
            </button>
          ))}
        </div>
      ) : null}
    </section>
  );
}

function Metric({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="rounded-lg bg-muted/30 px-2.5 py-2">
      <p className="text-[10px] text-muted-foreground lg:text-xs lg:leading-4">{label}</p>
      <p className="mt-0.5 font-semibold">{value}</p>
    </div>
  );
}

function stateLabel(state: CostBackfillRun["state"], copy: Copy) {
  return copy(
    (
      {
        draft: "准备中",
        previewed: "已预览",
        applying: "应用中",
        applied: "已应用",
        partially_applied: "部分应用",
        reverting: "撤销中",
        reverted: "已撤销",
        revert_partial: "撤销有冲突",
        rejected: "已拒绝",
      } as const
    )[state],
  );
}

type Copy = (
  source: Parameters<typeof translateSettingsOperations>[1],
  values?: Parameters<typeof translateSettingsOperations>[2],
) => string;
