"use client";

import { useEffect, useMemo, useState } from "react";
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
  ShieldAlert,
  Smartphone,
  X,
} from "lucide-react";
import { toast } from "sonner";

import { ImeiScannerField } from "@/components/imei-scanner-field";
import { MoneyText } from "@/components/orders/badges";
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
import { ScanSearchButton } from "@/features/capture";
import { useStoreShellContext } from "@/features/stores/api/use-store-shell-context";
import type {
  BuybackQuoteDeductionInput,
  BuybackQuoteOutcome,
  BuybackQuoteSnapshotInput,
  InventoryListItem,
} from "@/lib/repairdesk/types";
import { brandGradientStyle, controls, repairOs } from "@/lib/ui-patterns";
import { cn } from "@/lib/utils";
import {
  RepairOsBadge,
  RepairOsBusinessCard,
  RepairOsHeaderActionButton,
  RepairOsInfoTile,
  RepairOsListScaffold,
} from "@/shared/ui";

type ListFilter = "all" | "awaiting" | BuybackQuoteOutcome;
type WorkspaceState =
  | { mode: "create"; item?: undefined }
  | { mode: "revise"; item: InventoryListItem };

const scopeFilters = { sourceTypes: ["buyback"], categories: ["phone"] };
const brands = ["Apple", "Samsung", "Xiaomi", "Google", "Huawei", "OPPO", "OnePlus"];
const storageOptions = ["64GB", "128GB", "256GB", "512GB", "1TB"];
const sheetFloatingStyle = {
  "--repair-os-mobile-floating-offset": "0.75rem",
} as React.CSSProperties;

export function BuybackScreen() {
  const shell = useStoreShellContext();
  const storeId = shell.activeStore?.id;
  const role = shell.activeStore?.role;
  const [isHydrated, setIsHydrated] = useState(false);
  useEffect(() => setIsHydrated(true), []);
  const canCreate = isHydrated && (role === "owner" || role === "manager" || role === "sales");
  const canRevise = isHydrated && (role === "owner" || role === "manager");
  const canRespond = isHydrated && (role === "owner" || role === "manager" || role === "sales");
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState<ListFilter>("all");
  const [workspace, setWorkspace] = useState<WorkspaceState | null>(null);
  const [selected, setSelected] = useState<InventoryListItem | null>(null);
  const isOnline = useOnlineStatus();
  const list = useQuery({
    queryKey: buybackKeys.list({ ...scopeFilters, search: search.trim() || undefined }, storeId),
    queryFn: ({ signal }) =>
      listBuybackRecords({ ...scopeFilters, search: search.trim() || undefined }, { signal }),
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

  return (
    <RepairOsListScaffold
      title="回收管理"
      subtitle={`${filterLabel(filter)} · ${items.length} 条`}
      eyebrow="工作台 / 透明协商报价"
      searchValue={search}
      onSearchChange={setSearch}
      searchPlaceholder="搜索回收单或设备"
      searchAction={
        <ScanSearchButton scope="buyback" onSearch={setSearch} className="size-11 rounded-xl" />
      }
      filterAction={
        <Select value={filter} onValueChange={(value) => setFilter(value as ListFilter)}>
          <SelectTrigger
            aria-label="筛选回收记录"
            className="size-11 rounded-xl px-2 [&>span]:sr-only"
          >
            <SelectValue />
            <Filter className="size-4" />
          </SelectTrigger>
          <SelectContent>
            {(["all", "awaiting", "accepted", "deferred", "rejected"] as const).map((value) => (
              <SelectItem key={value} value={value}>
                {filterLabel(value)}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      }
      action={
        <RepairOsHeaderActionButton
          ariaLabel="新建透明报价"
          disabled={!canCreate}
          onClick={() => setWorkspace({ mode: "create" })}
        >
          <Plus className="size-4" />
        </RepairOsHeaderActionButton>
      }
      desktopAction={
        <Button
          disabled={!canCreate}
          className={cn("gap-2", controls.brandButton)}
          style={brandGradientStyle}
          onClick={() => setWorkspace({ mode: "create" })}
        >
          <Plus className="size-4" /> 新建透明报价
        </Button>
      }
    >
      <h1 className="sr-only">回收管理</h1>
      <section className="mb-3 grid gap-2 sm:grid-cols-3">
        <SummaryTile
          label="待答复"
          value={(list.data ?? []).filter((item) => !resolvedOutcome(item)).length}
          icon={Clock3}
        />
        <SummaryTile
          label="已接受（仅记录）"
          value={(list.data ?? []).filter((item) => resolvedOutcome(item) === "accepted").length}
          icon={Check}
        />
        <SummaryTile
          label="需跟进"
          value={(list.data ?? []).filter((item) => resolvedOutcome(item) === "deferred").length}
          icon={MessageCircleMore}
        />
      </section>

      {!BUYBACK_SENSITIVE_WORKFLOW_ENABLED ? (
        <div className="mb-3 rounded-xl border border-status-info/25 bg-status-info/10 px-3 py-2 text-xs text-status-info-foreground">
          当前只记录报价与客户口头答复，不会付款、采集证件/签名、标记已回收或联动商品库存。
        </div>
      ) : null}

      {!isOnline ? (
        <div
          role="status"
          className="mb-3 rounded-xl border border-status-warn/30 bg-status-warn/10 px-3 py-2 text-xs text-status-warn-foreground"
        >
          当前处于离线状态。可继续查看已有资料，恢复网络后才能保存报价或客户答复。
        </div>
      ) : null}

      {list.isLoading ? (
        <div className="grid gap-2 md:grid-cols-2 xl:grid-cols-3">
          {Array.from({ length: 6 }).map((_, index) => (
            <Skeleton key={index} className="h-40 rounded-xl" />
          ))}
        </div>
      ) : list.isError ? (
        <EmptyState
          title="回收记录加载失败"
          detail="检查网络后重试。"
          actionLabel="重新加载"
          onAction={() => void list.refetch()}
        />
      ) : items.length === 0 ? (
        <EmptyState
          title={search || filter !== "all" ? "没有符合条件的记录" : "还没有透明报价"}
          detail={
            search || filter !== "all"
              ? "调整搜索或筛选条件。"
              : "先录入设备和参考区间，再与客户确认。"
          }
          actionLabel={canCreate ? "新建报价" : undefined}
          onAction={canCreate ? () => setWorkspace({ mode: "create" }) : undefined}
        />
      ) : (
        <section className="grid min-w-0 gap-2 md:grid-cols-2 xl:grid-cols-3">
          {items.map((item) => (
            <QuoteCard key={item.id} item={item} onOpen={() => setSelected(item)} />
          ))}
        </section>
      )}

      <TransparentQuoteWorkspace
        state={workspace}
        isOnline={isOnline}
        onClose={() => setWorkspace(null)}
        onSaved={() => {
          setWorkspace(null);
          void list.refetch();
        }}
      />
      <TransparentQuoteDetail
        item={selected}
        canRevise={canRevise}
        canRespond={canRespond}
        isOnline={isOnline}
        storeId={storeId}
        onClose={() => setSelected(null)}
        onRevise={(item) => {
          setSelected(null);
          setWorkspace({ mode: "revise", item });
        }}
        onSaved={() => {
          setSelected(null);
          void list.refetch();
        }}
      />
    </RepairOsListScaffold>
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
    <RepairOsBusinessCard
      className="items-center gap-2 p-2.5"
      leading={
        <span className="grid size-9 place-items-center rounded-xl bg-primary/10 text-primary">
          <Icon className="size-4" />
        </span>
      }
    >
      <div className="min-w-0">
        <p className="text-[10px] text-muted-foreground">{label}</p>
        <p className="text-lg font-semibold tabular-nums">{value}</p>
      </div>
    </RepairOsBusinessCard>
  );
}

function QuoteCard({ item, onOpen }: { item: InventoryListItem; onOpen: () => void }) {
  const quote = quoteProjection(item);
  const outcome = resolvedOutcome(item);
  const expired = quote.expires_at ? Date.parse(String(quote.expires_at)) <= Date.now() : false;
  return (
    <button
      type="button"
      onClick={onOpen}
      className="min-w-0 rounded-2xl text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
    >
      <RepairOsBusinessCard className="h-full grid-cols-1 gap-3 p-3 transition-colors hover:border-primary/35">
        <div className="flex min-w-0 items-start justify-between gap-3">
          <div className="min-w-0">
            <div className="flex items-center gap-1.5">
              <span className="font-mono text-xs font-semibold text-primary">{item.public_no}</span>
              <OutcomeBadge outcome={outcome} />
            </div>
            <h2 className="mt-1 truncate text-sm font-semibold">{item.item_label}</h2>
            <p className="truncate text-[11px] text-muted-foreground">
              {[item.color, item.storage_capacity, item.serial_or_imei]
                .filter(Boolean)
                .join(" · ") || "设备资料待补充"}
            </p>
          </div>
          <div className="shrink-0 text-right">
            <p className="font-mono text-lg font-semibold text-primary">
              <MoneyText amount={numberValue(quote.final_offer)} />
            </p>
            <p className="text-[9px] text-muted-foreground">当前报价</p>
          </div>
        </div>
        <div className="grid grid-cols-3 gap-1.5">
          <MiniTile
            label="参考区间"
            value={rangeLabel(quote.reference_low, quote.reference_high)}
          />
          <MiniTile label="调整项目" value={`${deductionsFromQuote(quote).length} 项`} />
          <MiniTile
            label="有效期"
            value={expired ? "已过期" : shortDate(quote.expires_at)}
            danger={expired}
          />
        </div>
        <div className="flex items-center justify-between border-t border-[var(--border-panel)] pt-2 text-[11px]">
          <span className="text-muted-foreground">
            {nextAction(outcome, expired, quote.hard_block === true)}
          </span>
          <ArrowRight className="size-3.5 text-primary" />
        </div>
      </RepairOsBusinessCard>
    </button>
  );
}

function TransparentQuoteDetail({
  item,
  canRevise,
  canRespond,
  isOnline,
  storeId,
  onClose,
  onRevise,
  onSaved,
}: {
  item: InventoryListItem | null;
  canRevise: boolean;
  canRespond: boolean;
  isOnline: boolean;
  storeId?: string;
  onClose: () => void;
  onRevise: (item: InventoryListItem) => void;
  onSaved: () => void;
}) {
  const client = useQueryClient();
  const [outcome, setOutcome] = useState<BuybackQuoteOutcome | "">("");
  const [reason, setReason] = useState("");
  const [note, setNote] = useState("");
  const [responseOperationKey, setResponseOperationKey] = useState("");
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
    setResponseOperationKey(itemId ? crypto.randomUUID() : "");
  }, [itemId]);
  const mutation = useMutation({
    mutationFn: async () => {
      if (!isOnline || !navigator.onLine) throw new Error("当前离线，恢复网络后再保存答复");
      if (!item || !outcome) throw new Error("请选择客户答复");
      const quote = quoteProjection(item);
      const revisionId =
        typeof quote.current_revision_id === "string" ? quote.current_revision_id : "";
      if (!revisionId) throw new Error("当前记录没有可确认的报价版本");
      return recordTransparentBuybackResponse(item.id, {
        expected_updated_at: item.updated_at,
        idempotency_key: responseOperationKey,
        quote_revision_id: revisionId,
        outcome,
        reason_code: outcome === "rejected" ? reason || undefined : undefined,
        note: note.trim() || undefined,
      });
    },
    onSuccess: async () => {
      toast.success("已记录客户现场口头答复");
      await client.invalidateQueries({ queryKey: buybackKeys.all });
      onSaved();
    },
    onError: (error) => toast.error(error instanceof Error ? error.message : "保存失败"),
  });
  if (!item) return null;
  const quote = quoteProjection(item);
  const currentOutcome = resolvedOutcome(item);
  const deductions = deductionsFromQuote(quote);
  const isExpired = quote.expires_at ? Date.parse(String(quote.expires_at)) <= Date.now() : false;
  const acceptDisabled =
    isExpired || quote.hard_block === true || numberValue(quote.final_offer) <= 0;
  const responseLocked = currentOutcome === "accepted" || currentOutcome === "rejected";
  return (
    <Sheet open onOpenChange={(open) => !open && onClose()}>
      <SheetContent
        side="bottom"
        style={sheetFloatingStyle}
        className={cn(
          "left-1/2 right-auto flex h-[min(92svh,820px)] w-[min(760px,calc(100vw-0.5rem))] -translate-x-1/2 flex-col gap-0 rounded-t-2xl p-0 md:bottom-4 md:rounded-2xl",
          repairOs.mobileFloatingPage,
        )}
      >
        <div className="min-h-0 flex-1 overflow-y-auto px-3 pb-4 pt-3 sm:px-5">
          <SheetHeader className="text-left">
            <SheetTitle className="flex items-center gap-2 text-base">
              <Smartphone className="size-4 text-primary" />
              {item.item_label}
            </SheetTitle>
            <SheetDescription>
              {item.public_no} · {item.serial_or_imei || "标识已隐藏"}
            </SheetDescription>
          </SheetHeader>
          <section className={cn(repairOs.mobileInfoCard, "mt-3 p-3")}>
            <div className="flex items-end justify-between gap-3">
              <div>
                <p className="text-[10px] text-muted-foreground">当前透明报价</p>
                <p className="mt-1 font-mono text-3xl font-semibold text-primary">
                  <MoneyText amount={numberValue(quote.final_offer)} />
                </p>
              </div>
              <OutcomeBadge outcome={resolvedOutcome(item)} />
            </div>
            <div className="mt-3 grid grid-cols-2 gap-2">
              <MiniTile
                label="初始参考"
                value={rangeLabel(quote.reference_low, quote.reference_high)}
              />
              <MiniTile label="报价有效期" value={shortDate(quote.expires_at)} danger={isExpired} />
            </div>
          </section>
          <section className={cn(repairOs.mobileInfoCard, "mt-2 p-3")}>
            <h3 className="text-xs font-semibold">价格怎么得出</h3>
            <div className="mt-2 space-y-1.5">
              {deductions.length ? (
                deductions.map((row) => (
                  <div
                    key={row.code}
                    className="flex items-center justify-between rounded-xl bg-[var(--surface-panel-muted)] px-3 py-2 text-xs"
                  >
                    <span>{row.label}</span>
                    <span className="font-mono font-semibold text-status-danger-foreground">
                      -€{row.amount.toFixed(2)}
                    </span>
                  </div>
                ))
              ) : (
                <p className="rounded-xl bg-[var(--surface-panel-muted)] px-3 py-2 text-xs text-muted-foreground">
                  没有扣减项目。
                </p>
              )}
            </div>
            {typeof quote.manual_adjustment_reason === "string" ? (
              <p className="mt-2 rounded-xl border border-[var(--border-panel)] px-3 py-2 text-xs text-muted-foreground">
                调整说明：{quote.manual_adjustment_reason}
              </p>
            ) : null}
          </section>
          <section className={cn(repairOs.mobileInfoCard, "mt-2 p-3")}>
            <div className="flex items-center justify-between">
              <h3 className="text-xs font-semibold">现场记录客户答复</h3>
              <span className="text-[10px] text-muted-foreground">非签名确认</span>
            </div>
            <RadioGroup
              value={outcome}
              onValueChange={(value) => setOutcome(value as BuybackQuoteOutcome)}
              className="mt-2 grid-cols-3"
            >
              {(["accepted", "deferred", "rejected"] as const).map((value) => (
                <label
                  key={value}
                  className={cn(
                    "flex min-h-12 cursor-pointer items-center gap-2 rounded-xl border px-2.5 text-xs",
                    outcome === value && "border-primary bg-primary/5",
                    value === "accepted" && acceptDisabled && "cursor-not-allowed opacity-45",
                  )}
                >
                  <RadioGroupItem value={value} disabled={value === "accepted" && acceptDisabled} />
                  <span>{outcomeLabel(value)}</span>
                </label>
              ))}
            </RadioGroup>
            {outcome === "rejected" ? (
              <Select value={reason} onValueChange={setReason}>
                <SelectTrigger className="mt-2 h-11 rounded-xl">
                  <SelectValue placeholder="选择拒绝原因" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="price_gap">价格未达预期</SelectItem>
                  <SelectItem value="changed_mind">客户改变主意</SelectItem>
                  <SelectItem value="other_channel">已选择其他渠道</SelectItem>
                  <SelectItem value="other">其他原因</SelectItem>
                </SelectContent>
              </Select>
            ) : null}
            <Textarea
              value={note}
              onChange={(event) => setNote(event.target.value)}
              maxLength={240}
              placeholder="可选备注（不要填写证件号或完整电话）"
              className="mt-2 min-h-20 rounded-xl"
            />
            {acceptDisabled ? (
              <p className="mt-2 text-[11px] text-status-warn-foreground">
                报价已过期或存在阻断风险，不能记录为接受；可以暂缓或拒绝。
              </p>
            ) : null}
            {responseLocked ? (
              <p className="mt-2 text-[11px] text-status-warn-foreground">
                当前答复已锁定；如需更正，请由负责人先发布新报价版本。
              </p>
            ) : null}
          </section>
          <section className={cn(repairOs.mobileInfoCard, "mt-2 p-3")}>
            <h3 className="flex items-center gap-2 text-xs font-semibold">
              <FileClock className="size-4 text-primary" />
              最近报价记录
            </h3>
            <div className="mt-2 space-y-1.5">
              {history.isLoading ? (
                <Skeleton className="h-16 rounded-xl" />
              ) : history.isError ? (
                <div className="rounded-xl border border-status-danger/25 bg-status-danger/10 p-3">
                  <p className="text-xs text-status-danger-foreground">报价历史加载失败。</p>
                  <Button
                    type="button"
                    variant="outline"
                    className="mt-2 h-11 rounded-xl"
                    onClick={() => void history.refetch()}
                  >
                    重新加载历史
                  </Button>
                </div>
              ) : history.data?.revisions.length ? (
                history.data.revisions.slice(0, 4).map((revision) => (
                  <div
                    key={revision.id}
                    className="grid grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-2 rounded-xl bg-[var(--surface-panel-muted)] px-3 py-2"
                  >
                    <span className="grid size-7 place-items-center rounded-full bg-card text-[10px] font-semibold">
                      V{revision.revision_no}
                    </span>
                    <div className="min-w-0">
                      <p className="truncate text-xs font-medium">
                        {revision.change_reason || "报价更新"}
                      </p>
                      <p className="truncate text-[10px] text-muted-foreground">
                        {revision.actor_name} · {shortDateTime(revision.created_at)}
                      </p>
                    </div>
                    <MoneyText
                      amount={revision.quote.final_offer}
                      className="font-mono text-xs font-semibold"
                    />
                  </div>
                ))
              ) : (
                <p className="text-xs text-muted-foreground">
                  旧记录尚未版本化；下次改价后会从 V1 开始留痕。
                </p>
              )}
            </div>
          </section>
        </div>
        <div className="grid shrink-0 grid-cols-3 gap-2 border-t border-[var(--border-panel)] bg-[var(--surface-workspace-strong)] p-3">
          <Button variant="outline" className="h-11 rounded-xl" onClick={onClose}>
            关闭
          </Button>
          <Button
            variant="outline"
            className="h-11 rounded-xl"
            disabled={!canRevise}
            onClick={() => onRevise(item)}
          >
            <PencilLine className="mr-1 size-4" />
            改价
          </Button>
          <Button
            className={cn("h-11 rounded-xl", controls.brandButton)}
            style={brandGradientStyle}
            disabled={
              !canRespond ||
              !isOnline ||
              responseLocked ||
              !responseOperationKey ||
              !outcome ||
              (outcome === "rejected" && !reason) ||
              mutation.isPending
            }
            onClick={() => mutation.mutate()}
          >
            {mutation.isPending ? (
              <Loader2 className="mr-1 size-4 animate-spin" />
            ) : (
              <Check className="mr-1 size-4" />
            )}
            保存答复
          </Button>
        </div>
      </SheetContent>
    </Sheet>
  );
}

function TransparentQuoteWorkspace({
  state,
  isOnline,
  onClose,
  onSaved,
}: {
  state: WorkspaceState | null;
  isOnline: boolean;
  onClose: () => void;
  onSaved: () => void;
}) {
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
  const [operationKey, setOperationKey] = useState("");
  const [expiresAt, setExpiresAt] = useState("");
  useEffect(() => {
    if (!state) return;
    setRecordId(existing?.id ?? crypto.randomUUID());
    setOperationKey(crypto.randomUUID());
    setExpiresAt(new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString());
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
  const mutation = useMutation({
    mutationFn: async () => {
      if (!isOnline || !navigator.onLine) throw new Error("当前离线，恢复网络后再保存报价");
      if (!model.trim()) throw new Error("请输入设备型号");
      const moneyValues = [
        referenceLow,
        referenceHigh,
        screenDeduction,
        batteryDeduction,
        finalOffer,
      ];
      if (moneyValues.some((value) => !isValidAmountInput(value))) {
        throw new Error("金额格式无效；可使用 350.50 或 350,50，最多两位小数");
      }
      if (battery && (!isValidAmountInput(battery) || amount(battery) > 100)) {
        throw new Error("电池健康必须是 0–100 之间的数字");
      }
      const manual = amount(finalOffer) !== suggested;
      if (manual && reason.trim().length < 2) throw new Error("手动调整最终报价时请填写原因");
      const quote: BuybackQuoteSnapshotInput = {
        reference_low: amount(referenceLow),
        reference_high: amount(referenceHigh),
        final_offer: amount(finalOffer),
        deductions,
        manual_adjustment_reason: manual ? reason.trim() : undefined,
        risk_level: risk,
        hard_block: risk === "high",
        expires_at: expiresAt,
      };
      if (existing)
        return reviseTransparentBuybackQuote(existing.id, {
          expected_updated_at: existing.updated_at,
          idempotency_key: operationKey,
          quote,
          change_reason: reason.trim() || "重新检测后更新报价",
        });
      return createTransparentBuybackQuote({
        record_id: recordId,
        idempotency_key: operationKey,
        device: {
          brand,
          model: model.trim(),
          color: color.trim() || undefined,
          storage_capacity: storage,
          serial_or_imei: imei.trim() || undefined,
          battery_health: battery ? amount(battery) : undefined,
        },
        quote,
      });
    },
    onSuccess: async () => {
      toast.success(existing ? "新报价版本已保存" : "透明报价已创建");
      await client.invalidateQueries({ queryKey: buybackKeys.all });
      onSaved();
    },
    onError: (error) => toast.error(error instanceof Error ? error.message : "保存失败"),
  });
  if (!state) return null;
  return (
    <Sheet open onOpenChange={(open) => !open && onClose()}>
      <SheetContent
        side="bottom"
        style={sheetFloatingStyle}
        className={cn(
          "left-1/2 right-auto flex h-[min(94svh,860px)] w-[min(720px,calc(100vw-0.5rem))] -translate-x-1/2 flex-col gap-0 rounded-t-2xl p-0 md:bottom-4 md:rounded-2xl",
          repairOs.mobileFloatingPage,
        )}
      >
        <div className="min-h-0 flex-1 overflow-y-auto px-3 pb-5 pt-3 sm:px-5">
          <SheetHeader className="text-left">
            <SheetTitle>{existing ? "重新报价" : "新建透明报价"}</SheetTitle>
            <SheetDescription>
              一页完成设备录入、价格说明和保存；不进入付款或商品库存。
            </SheetDescription>
          </SheetHeader>
          <section className={cn(repairOs.mobileInfoCard, "mt-3 p-3")}>
            <SectionTitle icon={Smartphone} title="设备" />
            <div className="mt-3 grid gap-3 sm:grid-cols-2">
              <Field label="品牌">
                <Select value={brand} onValueChange={setBrand} disabled={Boolean(existing)}>
                  <SelectTrigger className="h-11 rounded-xl">
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
              <Field label="型号">
                <Input
                  value={model}
                  disabled={Boolean(existing)}
                  onChange={(event) => setModel(event.target.value)}
                  placeholder="例如 iPhone 15 Pro"
                  className="h-11 rounded-xl"
                />
              </Field>
              <Field label="颜色">
                <Input
                  value={color}
                  disabled={Boolean(existing)}
                  onChange={(event) => setColor(event.target.value)}
                  placeholder="例如 原色钛金属"
                  className="h-11 rounded-xl"
                />
              </Field>
              <Field label="容量">
                <Select value={storage} onValueChange={setStorage} disabled={Boolean(existing)}>
                  <SelectTrigger className="h-11 rounded-xl">
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
                <div className="sm:col-span-2">
                  <Field label="IMEI（可扫码）">
                    <ImeiScannerField
                      value={imei}
                      onChange={setImei}
                      density="compact"
                      placeholder="摄像头扫码或手动输入"
                    />
                  </Field>
                </div>
              ) : null}
              <Field label="电池健康 %">
                <Input
                  value={battery}
                  onChange={(event) => setBattery(event.target.value)}
                  inputMode="decimal"
                  placeholder="例如 87"
                  className="h-11 rounded-xl"
                />
              </Field>
            </div>
          </section>
          <section className={cn(repairOs.mobileInfoCard, "mt-2 p-3")}>
            <SectionTitle icon={Euro} title="透明报价" />
            <div className="mt-3 grid grid-cols-2 gap-3">
              <Field label="参考最低 €">
                <MoneyInput label="参考最低 €" value={referenceLow} onChange={setReferenceLow} />
              </Field>
              <Field label="参考最高 €">
                <MoneyInput label="参考最高 €" value={referenceHigh} onChange={setReferenceHigh} />
              </Field>
              <Field label="屏幕扣减 €">
                <MoneyInput
                  label="屏幕扣减 €"
                  value={screenDeduction}
                  onChange={setScreenDeduction}
                />
              </Field>
              <Field label="电池扣减 €">
                <MoneyInput
                  label="电池扣减 €"
                  value={batteryDeduction}
                  onChange={setBatteryDeduction}
                />
              </Field>
            </div>
            <div className="mt-3 rounded-2xl bg-primary/8 p-3">
              <div className="flex items-end justify-between">
                <div>
                  <p className="text-[10px] text-muted-foreground">系统建议（参考最高 − 扣减）</p>
                  <p className="mt-1 font-mono text-2xl font-semibold text-primary">
                    <MoneyText amount={suggested} />
                  </p>
                </div>
                <Button
                  type="button"
                  variant="outline"
                  className="h-11 rounded-xl px-3 text-xs"
                  onClick={() => setFinalOffer(String(suggested))}
                >
                  <MinusCircle className="mr-1 size-4" />
                  采用建议
                </Button>
              </div>
            </div>
            <div className="mt-3 grid gap-3 sm:grid-cols-2">
              <Field label="最终报价 €">
                <MoneyInput label="最终报价 €" value={finalOffer} onChange={setFinalOffer} />
              </Field>
              <Field label="风险">
                <Select value={risk} onValueChange={(value) => setRisk(value as typeof risk)}>
                  <SelectTrigger className="h-11 rounded-xl">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="low">低风险</SelectItem>
                    <SelectItem value="medium">需复核</SelectItem>
                    <SelectItem value="high">高风险 / 禁止接受</SelectItem>
                  </SelectContent>
                </Select>
              </Field>
            </div>
            <Field
              label={amount(finalOffer) === suggested ? "调整说明（可选）" : "调整说明（必填）"}
            >
              <Textarea
                value={reason}
                onChange={(event) => setReason(event.target.value)}
                maxLength={160}
                placeholder="例如：边框明显磕碰，现场与客户协商后调整"
                className="mt-1.5 min-h-20 rounded-xl"
              />
            </Field>
            <div className="mt-3 flex items-center gap-2 rounded-xl border border-[var(--border-panel)] px-3 py-2 text-[11px] text-muted-foreground">
              <CalendarClock className="size-4 shrink-0 text-primary" />
              报价默认有效 7 天；过期后需要重新报价。
            </div>
          </section>
        </div>
        <div className="grid shrink-0 grid-cols-[1fr_1.5fr] gap-2 border-t border-[var(--border-panel)] bg-[var(--surface-workspace-strong)] p-3">
          <Button variant="outline" className="h-11 rounded-xl" onClick={onClose}>
            取消
          </Button>
          <Button
            className={cn("h-11 rounded-xl", controls.brandButton)}
            style={brandGradientStyle}
            disabled={!isOnline || mutation.isPending || !operationKey || !recordId || !expiresAt}
            onClick={() => mutation.mutate()}
          >
            {mutation.isPending ? (
              <Loader2 className="mr-2 size-4 animate-spin" />
            ) : (
              <Check className="mr-2 size-4" />
            )}
            {existing ? "保存新版本" : "保存透明报价"}
          </Button>
        </div>
      </SheetContent>
    </Sheet>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="min-w-0">
      <Label className="text-[11px] text-muted-foreground">{label}</Label>
      <div className="mt-1.5">{children}</div>
    </div>
  );
}
function MoneyInput({
  label,
  value,
  onChange,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
}) {
  return (
    <Input
      aria-label={label}
      value={value}
      onChange={(event) => onChange(event.target.value)}
      inputMode="decimal"
      className="h-11 rounded-xl font-mono"
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
      labelClassName="text-[9px]"
      valueClassName={cn(
        "mt-0.5 truncate text-[11px] font-semibold",
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
  onAction?: () => void;
}) {
  return (
    <div className="mx-auto mt-8 max-w-sm rounded-2xl border border-dashed border-[var(--border-panel)] p-6 text-center">
      <RefreshCw className="mx-auto size-6 text-primary" />
      <h2 className="mt-3 text-sm font-semibold">{title}</h2>
      <p className="mt-1 text-xs text-muted-foreground">{detail}</p>
      {actionLabel && onAction ? (
        <Button className="mt-4 h-11 rounded-xl" onClick={onAction}>
          {actionLabel}
        </Button>
      ) : null}
    </div>
  );
}
function OutcomeBadge({ outcome }: { outcome?: string }) {
  const meta =
    outcome === "accepted"
      ? ["已接受", "bg-status-success text-status-success-foreground"]
      : outcome === "deferred"
        ? ["暂缓", "bg-status-warn text-status-warn-foreground"]
        : outcome === "rejected"
          ? ["已拒绝", "bg-status-danger text-status-danger-foreground"]
          : ["待答复", "bg-status-info text-status-info-foreground"];
  return <RepairOsBadge className={meta[1]}>{meta[0]}</RepairOsBadge>;
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
  return value === "accepted" || value === "deferred" || value === "rejected" ? value : undefined;
}
function deductionsFromQuote(quote: Record<string, unknown>): BuybackQuoteDeductionInput[] {
  return Array.isArray(quote.deductions)
    ? quote.deductions
        .map(recordValue)
        .map((row) => ({
          code: String(row.code ?? "adjustment"),
          label: String(row.label ?? "价格调整"),
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
function rangeLabel(low: unknown, high: unknown) {
  return `€${numberValue(low).toFixed(0)}–€${numberValue(high).toFixed(0)}`;
}
function shortDate(value: unknown) {
  if (typeof value !== "string" || !value) return "未设置";
  return new Intl.DateTimeFormat("zh-CN", { month: "numeric", day: "numeric" }).format(
    new Date(value),
  );
}
function shortDateTime(value: string) {
  return new Intl.DateTimeFormat("zh-CN", {
    month: "numeric",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(value));
}
function filterLabel(value: ListFilter) {
  return (
    {
      all: "全部记录",
      awaiting: "待答复",
      accepted: "已接受",
      deferred: "暂缓跟进",
      rejected: "已拒绝",
    } as const
  )[value];
}
function outcomeLabel(value: BuybackQuoteOutcome) {
  return value === "accepted" ? "接受" : value === "deferred" ? "暂缓" : "拒绝";
}
function nextAction(outcome: string | undefined, expired: boolean, blocked: boolean) {
  if (blocked) return "需负责人复核";
  if (expired) return "报价已过期，建议重报";
  if (outcome === "accepted") return "已记录口头接受，等待线下后续";
  if (outcome === "deferred") return "等待客户决定";
  if (outcome === "rejected") return "本次协商已结束";
  return "等待记录客户答复";
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
