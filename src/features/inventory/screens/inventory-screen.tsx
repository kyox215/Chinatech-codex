"use client";

import type * as React from "react";
import { useEffect, useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { motion } from "framer-motion";
import {
  ClipboardCheck,
  DatabaseZap,
  FileUp,
  Layers3,
  Plus,
  Search,
  ShoppingBag,
  TrendingUp,
} from "lucide-react";
import { toast } from "sonner";

import { MoneyText, PhoneText } from "@/components/orders/badges";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { Textarea } from "@/components/ui/textarea";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { inventoryKeys } from "@/features/inventory/api/query-keys";
import {
  getInventoryNextStatuses,
  inventoryStatusMeta,
} from "@/features/inventory/model/inventory-workflow";
import {
  applyElectronicsCsvImport,
  createInventoryIntake,
  getInventoryItem,
  getInventoryStats,
  importElectronicsCsvPreview,
  listInventoryItems,
  recordInventoryCheck,
  sellInventoryItem,
  transitionInventoryItem,
  type CreateInventoryIntakeInput,
  type InventoryDetail,
  type InventoryItemStatus,
  type InventoryListItem,
  type InventoryQualityCheckInput,
  type SellInventoryItemInput,
} from "@/lib/repairdesk/api";
import { fadeUp, stagger } from "@/lib/motion";
import {
  brandGradientStyle,
  controls,
  dataDisplay,
  formLayout,
  layoutGuards,
  pageHeader,
  pageShell,
  surfaces,
} from "@/lib/ui-patterns";
import { cn } from "@/lib/utils";

type StatusFilter = "all" | InventoryItemStatus;

const statusFilters: StatusFilter[] = [
  "all",
  "intake",
  "evaluating",
  "purchased",
  "data_wipe",
  "refurbishing",
  "ready_for_sale",
  "listed",
  "reserved",
  "sold",
  "returned",
];

const checkOptions = ["unchecked", "pass", "fail", "unknown"] as const;
const cosmeticOptions = ["unknown", "new", "mint", "good", "fair", "poor", "for_parts"] as const;
const functionalOptions = ["untested", "passed", "needs_repair", "failed", "for_parts"] as const;

export function InventoryScreen() {
  const queryClient = useQueryClient();
  const searchParams = useSearchParams();
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState<StatusFilter>("all");
  const [selectedId, setSelectedId] = useState<string>();
  const [intakeOpen, setIntakeOpen] = useState(false);
  const [action, setAction] = useState<"check" | "transition" | "sell" | "import" | null>(null);

  const filters = useMemo(
    () => ({
      search: search.trim() || undefined,
      statuses: status === "all" ? undefined : [status],
    }),
    [search, status],
  );

  const { data: stats, isLoading: statsLoading } = useQuery({
    queryKey: inventoryKeys.stats(),
    queryFn: getInventoryStats,
  });
  const { data: items = [], isLoading } = useQuery({
    queryKey: inventoryKeys.list(filters),
    queryFn: () => listInventoryItems(filters),
  });

  const selectedItem = items.find((item) => item.id === selectedId);

  useEffect(() => {
    if (searchParams.get("new") === "1") setIntakeOpen(true);
  }, [searchParams]);

  function invalidate(id?: string) {
    queryClient.invalidateQueries({ queryKey: inventoryKeys.all });
    if (id) queryClient.invalidateQueries({ queryKey: inventoryKeys.detail(id) });
  }

  return (
    <div className={pageShell.list}>
      <motion.div
        variants={stagger(0.05)}
        initial="hidden"
        animate="show"
        className="mb-4 space-y-4"
      >
        <div className={pageHeader.root}>
          <motion.div variants={fadeUp}>
            <p className={pageHeader.eyebrow}>RepairDesk / 回收库存</p>
            <h1 className={pageHeader.title}>
              <span className="gradient-text">回收库存</span>
              <span className="ml-2 align-middle text-base font-normal text-muted-foreground">
                共 {items.length} 台
              </span>
            </h1>
            <p className={pageHeader.subtitle}>
              从收机、检测、资料清除、整备上架到售出，保留每一步员工操作记录。
            </p>
          </motion.div>
          <motion.div variants={fadeUp} className={pageHeader.actions}>
            <Button variant="outline" className="gap-2" onClick={() => setAction("import")}>
              <FileUp className="size-4" /> 导入电子产品
            </Button>
            <Button
              className={cn("gap-2", controls.brandButton)}
              style={brandGradientStyle}
              onClick={() => setIntakeOpen(true)}
            >
              <Plus className="size-4" /> 新增回收
            </Button>
          </motion.div>
        </div>

        <motion.div variants={fadeUp} className={dataDisplay.kpiGrid}>
          <InventoryKpi
            icon={Layers3}
            label="库存总数"
            value={statsLoading ? "-" : (stats?.total ?? 0)}
          />
          <InventoryKpi icon={ClipboardCheck} label="检测/整备中" value={stats?.inPipeline ?? 0} />
          <InventoryKpi icon={ShoppingBag} label="待售/售卖中" value={stats?.readyOrListed ?? 0} />
          <InventoryKpi
            icon={TrendingUp}
            label="已实现利润"
            value={<MoneyText amount={stats?.realizedProfit ?? 0} />}
          />
        </motion.div>
      </motion.div>

      <section className={cn(surfaces.toolbar, "mb-4")}>
        <div className="flex flex-col gap-2 md:flex-row md:items-center">
          <div className="relative flex-1">
            <Search className="pointer-events-none absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="搜索编号、客户、型号、IMEI、备注"
              className={controls.searchInput}
            />
          </div>
        </div>
        <div className="flex flex-wrap gap-1.5">
          {statusFilters.map((value) => (
            <button
              key={value}
              type="button"
              onClick={() => setStatus(value)}
              className={cn(
                controls.segmentedButton,
                status === value ? controls.segmentedActive : controls.segmentedInactive,
              )}
            >
              {value === "all" ? "全部" : inventoryStatusMeta[value].shortLabel}
            </button>
          ))}
        </div>
      </section>

      {isLoading ? (
        <div className={dataDisplay.mobileCardList}>
          {Array.from({ length: 6 }).map((_, index) => (
            <Skeleton key={index} className="h-20 w-full" />
          ))}
        </div>
      ) : items.length === 0 ? (
        <div className={surfaces.empty}>
          <DatabaseZap className="mb-3 size-9 text-muted-foreground" />
          <h3 className="font-display text-lg font-semibold">暂无回收库存</h3>
          <p className="mt-1 text-sm text-muted-foreground">
            新增一台客户交来的设备，开始闭环跟踪。
          </p>
        </div>
      ) : (
        <>
          <div className={cn(dataDisplay.tableWrap, "lg:block")}>
            <Table className="table-fixed text-xs">
              <TableHeader>
                <TableRow>
                  <TableHead className="w-[118px]">编号 / 状态</TableHead>
                  <TableHead>商品</TableHead>
                  <TableHead className="w-[150px]">客户</TableHead>
                  <TableHead className="w-[118px] text-right">回收价</TableHead>
                  <TableHead className="w-[118px] text-right">挂牌/成交</TableHead>
                  <TableHead className="w-[118px] text-right">利润</TableHead>
                  <TableHead className="w-[180px]">检测</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {items.map((item) => (
                  <InventoryTableRow
                    key={item.id}
                    item={item}
                    onSelect={() => setSelectedId(item.id)}
                  />
                ))}
              </TableBody>
            </Table>
          </div>

          <div className="space-y-3 lg:hidden">
            {items.map((item) => (
              <InventoryMobileCard
                key={item.id}
                item={item}
                onSelect={() => setSelectedId(item.id)}
              />
            ))}
          </div>
        </>
      )}

      <IntakeDialog
        open={intakeOpen}
        onOpenChange={setIntakeOpen}
        onDone={(id) => {
          invalidate(id);
          setSelectedId(id);
        }}
      />
      <InventoryDetailDialog
        id={selectedId}
        onOpenChange={(open) => !open && setSelectedId(undefined)}
        onAction={setAction}
      />
      <InventoryActionDialog
        action={action}
        item={selectedItem}
        onOpenChange={(open) => !open && setAction(null)}
        onDone={(id) => invalidate(id)}
      />
    </div>
  );
}

function InventoryTableRow({ item, onSelect }: { item: InventoryListItem; onSelect: () => void }) {
  return (
    <TableRow className="cursor-pointer" onClick={onSelect}>
      <TableCell>
        <div className="font-mono font-semibold text-primary">{item.public_no}</div>
        <InventoryStatusBadge status={item.status} className="mt-1" />
      </TableCell>
      <TableCell className="min-w-0">
        <div className="truncate font-medium">{item.item_label}</div>
        <div className="truncate font-mono text-[11px] text-muted-foreground">
          {[item.color, item.storage_capacity, item.serial_or_imei].filter(Boolean).join(" · ") ||
            "-"}
        </div>
      </TableCell>
      <TableCell className="min-w-0">
        <div className="truncate font-medium">{item.customer_name || "-"}</div>
        {item.customer_phone ? <PhoneText value={item.customer_phone} /> : null}
      </TableCell>
      <TableCell className="text-right">
        <MoneyText amount={item.buyback_price} />
      </TableCell>
      <TableCell className="text-right">
        <MoneyText amount={item.sale_price || item.list_price} />
      </TableCell>
      <TableCell className="text-right">
        <MoneyText
          amount={item.profit}
          className={
            item.profit >= 0 ? "text-status-success-foreground" : "text-status-danger-foreground"
          }
        />
      </TableCell>
      <TableCell>
        <div className="truncate">
          外观 {gradeLabel(item.cosmetic_grade)} · 功能 {gradeLabel(item.functional_grade)}
        </div>
        <div className="truncate text-[11px] text-muted-foreground">
          电池 {item.battery_health ?? "-"}% · 清除 {checkLabel(item.data_wipe_status)}
        </div>
      </TableCell>
    </TableRow>
  );
}

function InventoryMobileCard({
  item,
  onSelect,
}: {
  item: InventoryListItem;
  onSelect: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onSelect}
      className="glass-card grid w-full grid-cols-[auto_minmax(0,1fr)_auto] gap-3 p-3 text-left active:scale-[0.99]"
    >
      <InventoryStatusBadge status={item.status} className="mt-0.5" />
      <div className="min-w-0">
        <div className="font-mono text-xs font-semibold text-primary">{item.public_no}</div>
        <div className="truncate font-medium">{item.item_label}</div>
        <div className="truncate text-xs text-muted-foreground">
          {item.customer_name || "-"} · {item.serial_or_imei || "无 IMEI"}
        </div>
      </div>
      <div className="text-right text-xs">
        <MoneyText amount={item.sale_price || item.list_price || item.buyback_price} />
        <div className="mt-1 text-muted-foreground">{item.battery_health ?? "-"}%</div>
      </div>
    </button>
  );
}

function InventoryDetailDialog({
  id,
  onOpenChange,
  onAction,
}: {
  id?: string;
  onOpenChange: (open: boolean) => void;
  onAction: (action: "check" | "transition" | "sell") => void;
}) {
  const { data, isLoading } = useQuery({
    queryKey: id ? inventoryKeys.detail(id) : inventoryKeys.detail(""),
    queryFn: () => getInventoryItem(id || ""),
    enabled: Boolean(id),
  });

  return (
    <Dialog open={Boolean(id)} onOpenChange={onOpenChange}>
      <DialogContent className={cn(layoutGuards.responsiveDialog, "gap-4")}>
        <DialogHeader>
          <DialogTitle>{data?.item.public_no ?? "库存详情"}</DialogTitle>
          <DialogDescription>
            {data?.item.item_label ?? "读取商品检测、财务和时间线"}
          </DialogDescription>
        </DialogHeader>
        {isLoading || !data ? (
          <div className="space-y-2">
            <Skeleton className="h-24 w-full" />
            <Skeleton className="h-40 w-full" />
          </div>
        ) : (
          <InventoryDetailBody data={data} onAction={onAction} />
        )}
      </DialogContent>
    </Dialog>
  );
}

function InventoryDetailBody({
  data,
  onAction,
}: {
  data: InventoryDetail;
  onAction: (action: "check" | "transition" | "sell") => void;
}) {
  const item = data.item;
  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        <InventoryStatusBadge status={item.status} />
        <Button size="sm" variant="outline" onClick={() => onAction("transition")}>
          推进状态
        </Button>
        <Button size="sm" variant="outline" onClick={() => onAction("check")}>
          登记检测
        </Button>
        <Button
          size="sm"
          className={cn("gap-2", controls.brandButton)}
          style={brandGradientStyle}
          onClick={() => onAction("sell")}
        >
          售出
        </Button>
      </div>

      <div className="grid gap-3 md:grid-cols-3">
        <InfoBox label="回收价" value={<MoneyText amount={item.buyback_price} />} />
        <InfoBox label="挂牌价" value={<MoneyText amount={item.list_price} />} />
        <InfoBox label="利润" value={<MoneyText amount={item.profit} />} />
      </div>

      <div className="grid gap-3 md:grid-cols-2">
        <section className={surfaces.section}>
          <h3 className="mb-3 text-sm font-semibold">商品</h3>
          <InfoGrid
            rows={[
              ["类别", item.category],
              ["品牌型号", item.item_label],
              ["颜色/容量", [item.color, item.storage_capacity].filter(Boolean).join(" / ") || "-"],
              ["IMEI/序列号", item.serial_or_imei || "-"],
              ["备注", item.notes || "-"],
            ]}
          />
        </section>
        <section className={surfaces.section}>
          <h3 className="mb-3 text-sm font-semibold">检测</h3>
          <InfoGrid
            rows={[
              ["外观", gradeLabel(item.cosmetic_grade)],
              ["功能", gradeLabel(item.functional_grade)],
              ["电池", item.battery_health === undefined ? "-" : `${item.battery_health}%`],
              ["IMEI", checkLabel(item.imei_check_status)],
              ["激活锁", checkLabel(item.activation_lock_status)],
              ["资料清除", checkLabel(item.data_wipe_status)],
            ]}
          />
        </section>
      </div>

      <section className={surfaces.section}>
        <h3 className="mb-3 text-sm font-semibold">时间线</h3>
        <div className="space-y-2">
          {data.events.slice(0, 8).map((event) => (
            <div
              key={event.id}
              className="flex min-w-0 gap-3 border-b border-border/30 pb-2 last:border-0"
            >
              <div className="mt-1 size-2 rounded-full bg-primary" />
              <div className="min-w-0 flex-1">
                <div className="truncate text-sm font-medium">
                  {eventLabel(event.event_type)}
                  {event.to_status ? ` · ${inventoryStatusMeta[event.to_status].label}` : ""}
                </div>
                <div className="text-xs text-muted-foreground">
                  {event.operator_name} · {formatDateTime(event.created_at)}
                </div>
              </div>
            </div>
          ))}
          {data.events.length === 0 ? (
            <p className="text-sm text-muted-foreground">暂无时间线记录。</p>
          ) : null}
        </div>
      </section>
    </div>
  );
}

function IntakeDialog({
  open,
  onOpenChange,
  onDone,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onDone: (id: string) => void;
}) {
  const mutation = useMutation({
    mutationFn: createInventoryIntake,
    onSuccess: ({ id }) => {
      toast.success("已创建回收记录");
      onDone(id);
      onOpenChange(false);
    },
    onError: (error) => toast.error((error as Error).message),
  });

  function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    mutation.mutate(intakeInput(new FormData(event.currentTarget)));
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="w-[min(860px,calc(100vw-24px))] max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>新增回收</DialogTitle>
          <DialogDescription>
            登记客户交来的设备，后续检测、清除、上架和售出都会进入时间线。
          </DialogDescription>
        </DialogHeader>
        <form className={formLayout.stack} onSubmit={handleSubmit}>
          <div className={formLayout.grid}>
            <Field name="customer_name" label="客户姓名" required />
            <Field name="customer_phone" label="客户电话" required />
            <Field name="brand" label="品牌" required />
            <Field name="model" label="型号" required />
            <Field name="category" label="类别" defaultValue="phone" />
            <Field name="color" label="颜色" />
            <Field name="storage_capacity" label="容量" />
            <Field name="serial_or_imei" label="IMEI/序列号" />
            <Field name="buyback_price" label="回收价" type="number" step="0.01" />
            <Field name="list_price" label="预估挂牌价" type="number" step="0.01" />
            <Field name="payment_method" label="付款方式" />
          </div>
          <div className={formLayout.field}>
            <Label htmlFor="notes">备注</Label>
            <Textarea id="notes" name="notes" rows={3} />
          </div>
          <DialogFooter className="gap-2">
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              取消
            </Button>
            <Button
              type="submit"
              disabled={mutation.isPending}
              className={controls.brandButton}
              style={brandGradientStyle}
            >
              创建
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function InventoryActionDialog({
  action,
  item,
  onOpenChange,
  onDone,
}: {
  action: "check" | "transition" | "sell" | "import" | null;
  item?: InventoryListItem;
  onOpenChange: (open: boolean) => void;
  onDone: (id?: string) => void;
}) {
  const transitionMutation = useMutation({
    mutationFn: ({ id, to, reason }: { id: string; to: InventoryItemStatus; reason?: string }) =>
      transitionInventoryItem(id, to, { reason }),
    onSuccess: ({ to }, { id }) => {
      toast.success(`已推进至 ${inventoryStatusMeta[to].label}`);
      onDone(id);
      onOpenChange(false);
    },
    onError: (error) => toast.error((error as Error).message),
  });
  const checkMutation = useMutation({
    mutationFn: ({ id, input }: { id: string; input: InventoryQualityCheckInput }) =>
      recordInventoryCheck(id, input),
    onSuccess: (_, { id }) => {
      toast.success("已记录检测");
      onDone(id);
      onOpenChange(false);
    },
    onError: (error) => toast.error((error as Error).message),
  });
  const sellMutation = useMutation({
    mutationFn: ({ id, input }: { id: string; input: SellInventoryItemInput }) =>
      sellInventoryItem(id, input),
    onSuccess: (_, { id }) => {
      toast.success("已登记售出");
      onDone(id);
      onOpenChange(false);
    },
    onError: (error) => toast.error((error as Error).message),
  });

  if (action === "import") {
    return <ImportDialog open onOpenChange={onOpenChange} onDone={() => onDone()} />;
  }

  if (!item || !action) return null;

  const currentItem = item;
  const nextStatuses = getInventoryNextStatuses(currentItem.status);

  function handleTransition(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const formData = new FormData(event.currentTarget);
    transitionMutation.mutate({
      id: currentItem.id,
      to: textValue(formData, "to") as InventoryItemStatus,
      reason: optionalValue(formData, "reason"),
    });
  }

  function handleCheck(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const formData = new FormData(event.currentTarget);
    checkMutation.mutate({ id: currentItem.id, input: checkInput(formData) });
  }

  function handleSell(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const formData = new FormData(event.currentTarget);
    sellMutation.mutate({ id: currentItem.id, input: sellInput(formData) });
  }

  return (
    <Dialog open onOpenChange={onOpenChange}>
      <DialogContent className="w-[min(760px,calc(100vw-24px))] max-h-[90vh] overflow-y-auto">
        {action === "transition" ? (
          <ActionForm
            title="推进状态"
            description={currentItem.item_label}
            onSubmit={handleTransition}
          >
            <SelectField
              name="to"
              label="下一状态"
              options={nextStatuses}
              optionLabel={(value) => inventoryStatusMeta[value].label}
            />
            <TextAreaField name="reason" label="备注" />
            <DialogFooter>
              <Button
                type="submit"
                disabled={transitionMutation.isPending || nextStatuses.length === 0}
              >
                确认推进
              </Button>
            </DialogFooter>
          </ActionForm>
        ) : null}
        {action === "check" ? (
          <ActionForm title="登记检测" description={currentItem.item_label} onSubmit={handleCheck}>
            <div className={formLayout.grid}>
              <SelectField
                name="cosmetic_grade"
                label="外观等级"
                options={cosmeticOptions}
                optionLabel={gradeLabel}
              />
              <SelectField
                name="functional_grade"
                label="功能等级"
                options={functionalOptions}
                optionLabel={gradeLabel}
              />
              <Field name="battery_health" label="电池健康" type="number" min="0" max="100" />
              <SelectField
                name="imei_check_status"
                label="IMEI 检查"
                options={checkOptions}
                optionLabel={checkLabel}
              />
              <SelectField
                name="activation_lock_status"
                label="激活锁"
                options={checkOptions}
                optionLabel={checkLabel}
              />
              <SelectField
                name="data_wipe_status"
                label="资料清除"
                options={checkOptions}
                optionLabel={checkLabel}
              />
            </div>
            <TextAreaField name="notes" label="检测备注" />
            <DialogFooter>
              <Button type="submit" disabled={checkMutation.isPending}>
                保存检测
              </Button>
            </DialogFooter>
          </ActionForm>
        ) : null}
        {action === "sell" ? (
          <ActionForm title="登记售出" description={currentItem.item_label} onSubmit={handleSell}>
            <div className={formLayout.grid}>
              <Field name="buyer_name" label="买家姓名" />
              <Field name="buyer_phone" label="买家电话" />
              <Field
                name="sale_price"
                label="成交价"
                type="number"
                step="0.01"
                defaultValue={String(currentItem.list_price || currentItem.sale_price || 0)}
                required
              />
              <Field name="payment_method" label="付款方式" />
              <Field name="sale_channel" label="售卖渠道" defaultValue="store" />
              <Field name="warranty_months" label="保修月数" type="number" defaultValue="12" />
            </div>
            <TextAreaField name="notes" label="售卖备注" />
            <DialogFooter>
              <Button type="submit" disabled={sellMutation.isPending}>
                确认售出
              </Button>
            </DialogFooter>
          </ActionForm>
        ) : null}
      </DialogContent>
    </Dialog>
  );
}

function ImportDialog({
  open,
  onOpenChange,
  onDone,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onDone: () => void;
}) {
  const [csv, setCsv] = useState("");
  const [preview, setPreview] = useState<Awaited<ReturnType<typeof importElectronicsCsvPreview>>>();
  const previewMutation = useMutation({
    mutationFn: importElectronicsCsvPreview,
    onSuccess: setPreview,
    onError: (error) => toast.error((error as Error).message),
  });
  const applyMutation = useMutation({
    mutationFn: applyElectronicsCsvImport,
    onSuccess: (report) => {
      toast.success(`已导入 ${report.itemCount} 台电子产品`);
      onDone();
      onOpenChange(false);
    },
    onError: (error) => toast.error((error as Error).message),
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="w-[min(860px,calc(100vw-24px))] max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>导入 SeaTable 电子产品</DialogTitle>
          <DialogDescription>
            粘贴 `电子产品` 表导出的 CSV，先预览字段映射再应用。
          </DialogDescription>
        </DialogHeader>
        <Textarea value={csv} onChange={(event) => setCsv(event.target.value)} rows={8} />
        {preview ? (
          <div className="rounded-md border border-border/60 bg-surface-muted p-3 text-sm">
            <div>
              识别 {preview.report.itemCount} 台，客户 {preview.report.customerCount} 个，流水{" "}
              {preview.report.transactionCount} 条。
            </div>
            <div className="mt-1 text-muted-foreground">
              回收合计 <MoneyText amount={preview.report.totalBuyback} />
              ，售价合计{" "}
              <MoneyText amount={preview.report.totalSalePrice || preview.report.totalListPrice} />
              。
            </div>
          </div>
        ) : null}
        <DialogFooter className="gap-2">
          <Button
            type="button"
            variant="outline"
            onClick={() => previewMutation.mutate(csv)}
            disabled={!csv.trim() || previewMutation.isPending}
          >
            预览
          </Button>
          <Button
            type="button"
            onClick={() => applyMutation.mutate(csv)}
            disabled={!preview || applyMutation.isPending}
          >
            应用导入
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function ActionForm({
  title,
  description,
  onSubmit,
  children,
}: {
  title: string;
  description: string;
  onSubmit: (event: React.FormEvent<HTMLFormElement>) => void;
  children: React.ReactNode;
}) {
  return (
    <form className="space-y-4" onSubmit={onSubmit}>
      <DialogHeader>
        <DialogTitle>{title}</DialogTitle>
        <DialogDescription>{description}</DialogDescription>
      </DialogHeader>
      {children}
    </form>
  );
}

function InventoryKpi({
  icon: Icon,
  label,
  value,
}: {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  value: React.ReactNode;
}) {
  return (
    <div className="glass-card p-3">
      <div className="flex items-center justify-between gap-3">
        <div>
          <div className="text-[10px] uppercase tracking-widest text-muted-foreground/70">
            {label}
          </div>
          <div className="mt-1 font-display text-2xl font-semibold tabular-nums">{value}</div>
        </div>
        <div className="grid size-9 place-items-center rounded-lg bg-primary/10 text-primary">
          <Icon className="size-4" />
        </div>
      </div>
    </div>
  );
}

function InventoryStatusBadge({
  status,
  className,
}: {
  status: InventoryItemStatus;
  className?: string;
}) {
  const meta = inventoryStatusMeta[status];
  return (
    <span
      className={cn(
        "inline-flex shrink-0 items-center rounded-md px-1.5 py-0.5 text-xs font-medium ring-1 ring-inset",
        statusToneClass(meta.tone),
        className,
      )}
    >
      {meta.shortLabel}
    </span>
  );
}

function InfoBox({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="rounded-md border border-border/60 bg-surface-muted p-3">
      <div className="text-xs text-muted-foreground">{label}</div>
      <div className="mt-1 font-display text-xl font-semibold">{value}</div>
    </div>
  );
}

function InfoGrid({ rows }: { rows: [string, React.ReactNode][] }) {
  return (
    <dl className="grid gap-2 text-sm">
      {rows.map(([label, value]) => (
        <div key={label} className="grid grid-cols-[96px_minmax(0,1fr)] gap-3">
          <dt className="text-muted-foreground">{label}</dt>
          <dd className="min-w-0 break-words">{value}</dd>
        </div>
      ))}
    </dl>
  );
}

function Field(
  props: React.InputHTMLAttributes<HTMLInputElement> & { label: string; name: string },
) {
  const { label, name, required, ...inputProps } = props;
  return (
    <div className={formLayout.field}>
      <Label htmlFor={name}>
        {label}
        {required ? <span className="text-destructive"> *</span> : null}
      </Label>
      <Input id={name} name={name} required={required} {...inputProps} />
    </div>
  );
}

function TextAreaField({ name, label }: { name: string; label: string }) {
  return (
    <div className={formLayout.field}>
      <Label htmlFor={name}>{label}</Label>
      <Textarea id={name} name={name} rows={3} />
    </div>
  );
}

function SelectField<T extends string>({
  name,
  label,
  options,
  optionLabel,
}: {
  name: string;
  label: string;
  options: readonly T[];
  optionLabel: (value: T) => string;
}) {
  return (
    <div className={formLayout.field}>
      <Label htmlFor={name}>{label}</Label>
      <select
        id={name}
        name={name}
        className="h-9 rounded-md border border-border/60 bg-surface/60 px-2 text-sm text-foreground"
      >
        {options.map((value) => (
          <option key={value} value={value}>
            {optionLabel(value)}
          </option>
        ))}
      </select>
    </div>
  );
}

function intakeInput(formData: FormData): CreateInventoryIntakeInput {
  return {
    customer_name: optionalValue(formData, "customer_name"),
    customer_phone: optionalValue(formData, "customer_phone"),
    category: optionalValue(formData, "category"),
    brand: textValue(formData, "brand"),
    model: textValue(formData, "model"),
    color: optionalValue(formData, "color"),
    storage_capacity: optionalValue(formData, "storage_capacity"),
    serial_or_imei: optionalValue(formData, "serial_or_imei"),
    buyback_price: numberValue(formData, "buyback_price"),
    list_price: numberValue(formData, "list_price"),
    payment_method: optionalValue(formData, "payment_method"),
    notes: optionalValue(formData, "notes"),
  };
}

function checkInput(formData: FormData): InventoryQualityCheckInput {
  return {
    cosmetic_grade: textValue(
      formData,
      "cosmetic_grade",
    ) as InventoryQualityCheckInput["cosmetic_grade"],
    functional_grade: textValue(
      formData,
      "functional_grade",
    ) as InventoryQualityCheckInput["functional_grade"],
    battery_health: numberValue(formData, "battery_health"),
    imei_check_status: textValue(
      formData,
      "imei_check_status",
    ) as InventoryQualityCheckInput["imei_check_status"],
    activation_lock_status: textValue(
      formData,
      "activation_lock_status",
    ) as InventoryQualityCheckInput["activation_lock_status"],
    data_wipe_status: textValue(
      formData,
      "data_wipe_status",
    ) as InventoryQualityCheckInput["data_wipe_status"],
    notes: optionalValue(formData, "notes"),
  };
}

function sellInput(formData: FormData): SellInventoryItemInput {
  return {
    buyer_name: optionalValue(formData, "buyer_name"),
    buyer_phone: optionalValue(formData, "buyer_phone"),
    sale_price: numberValue(formData, "sale_price") ?? 0,
    payment_method: optionalValue(formData, "payment_method"),
    sale_channel: optionalValue(formData, "sale_channel"),
    warranty_months: numberValue(formData, "warranty_months"),
    notes: optionalValue(formData, "notes"),
  };
}

function textValue(formData: FormData, key: string) {
  return String(formData.get(key) ?? "").trim();
}

function optionalValue(formData: FormData, key: string) {
  const value = textValue(formData, key);
  return value || undefined;
}

function numberValue(formData: FormData, key: string) {
  const value = optionalValue(formData, key);
  if (value === undefined) return undefined;
  const number = Number(value);
  return Number.isFinite(number) ? number : undefined;
}

function statusToneClass(tone: (typeof inventoryStatusMeta)[InventoryItemStatus]["tone"]) {
  if (tone === "success")
    return "bg-status-success text-status-success-foreground ring-status-success-foreground/30";
  if (tone === "danger")
    return "bg-status-danger text-status-danger-foreground ring-status-danger-foreground/30";
  if (tone === "warning")
    return "bg-status-warn text-status-warn-foreground ring-status-warn-foreground/30";
  if (tone === "info")
    return "bg-status-info text-status-info-foreground ring-status-info-foreground/30";
  return "bg-status-neutral text-status-neutral-foreground ring-status-neutral-foreground/20";
}

function gradeLabel(value?: string) {
  const labels: Record<string, string> = {
    unknown: "未定",
    new: "全新",
    mint: "近新",
    good: "良好",
    fair: "一般",
    poor: "差",
    for_parts: "配件机",
    untested: "未测",
    passed: "通过",
    needs_repair: "需维修",
    failed: "不通过",
  };
  return labels[value || "unknown"] ?? value ?? "-";
}

function checkLabel(value?: string) {
  const labels: Record<string, string> = {
    unchecked: "未检查",
    pass: "通过",
    fail: "不通过",
    unknown: "未知",
  };
  return labels[value || "unchecked"] ?? value ?? "-";
}

function eventLabel(value: string) {
  const labels: Record<string, string> = {
    created: "创建",
    updated: "更新",
    status_changed: "状态推进",
    quality_checked: "检测记录",
    transaction: "财务流水",
    sold: "售出",
    imported: "导入",
  };
  return labels[value] ?? value;
}

function formatDateTime(value: string) {
  return new Intl.DateTimeFormat("zh-CN", {
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(value));
}
