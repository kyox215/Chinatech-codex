"use client";

import { useEffect, useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Boxes, PackagePlus, Plus } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  costCurrencyQueryOptions,
  partsProcurementQueryOptions,
} from "@/features/procurement/api/query-options";
import { procurementKeys } from "@/features/procurement/api/query-keys";
import { COST_CURRENCY_LABELS } from "@/features/procurement/model/cost-currencies";
import { createPartCatalogItem, receivePartLot } from "@/lib/repairdesk/api";
import type { CostCurrencyCode } from "@/lib/repairdesk/types";
import { formatMoney } from "@/lib/money";
import { repairOs } from "@/lib/ui-patterns";
import { cn } from "@/lib/utils";

export function PartsProcurementCard({
  storeId,
  multiCurrencyEnabled = false,
}: {
  storeId: string;
  multiCurrencyEnabled?: boolean;
}) {
  const client = useQueryClient();
  const query = useQuery(partsProcurementQueryOptions(storeId));
  const currencyQuery = useQuery({
    ...costCurrencyQueryOptions(storeId, "options"),
    enabled: multiCurrencyEnabled,
  });
  const [sku, setSku] = useState("");
  const [name, setName] = useState("");
  const [partId, setPartId] = useState("");
  const [supplierId, setSupplierId] = useState("unlinked");
  const [lotCode, setLotCode] = useState("");
  const [quantity, setQuantity] = useState("1");
  const [unitCost, setUnitCost] = useState("");
  const [currencyCode, setCurrencyCode] = useState<CostCurrencyCode>("EUR");
  const selectedCurrency = useMemo(
    () => currencyQuery.data?.items.find((item) => item.currency_code === currencyCode),
    [currencyCode, currencyQuery.data?.items],
  );
  const eurPreview =
    multiCurrencyEnabled && selectedCurrency?.rate_to_eur !== null && selectedCurrency?.rate_to_eur
      ? Math.round(Number(unitCost) * selectedCurrency.rate_to_eur * 100) / 100
      : Number(unitCost);

  useEffect(() => {
    if (!multiCurrencyEnabled || currencyCode === "EUR") return;
    if (!currencyQuery.data?.items.some((item) => item.currency_code === currencyCode)) {
      setCurrencyCode("EUR");
    }
  }, [currencyCode, currencyQuery.data?.items, multiCurrencyEnabled]);

  const refresh = async () => {
    await client.invalidateQueries({ queryKey: procurementKeys.all });
  };
  const create = useMutation({
    mutationFn: () =>
      createPartCatalogItem({
        expected_store_id: storeId,
        sku: sku.trim(),
        name: name.trim(),
        compatible_models: [],
        idempotency_key: crypto.randomUUID(),
      }),
    onSuccess: async () => {
      setSku("");
      setName("");
      await refresh();
      toast.success("配件目录项目已创建");
    },
    onError: (error: Error) => toast.error(error.message),
  });
  const receive = useMutation({
    mutationFn: () =>
      receivePartLot({
        expected_store_id: storeId,
        part_item_id: partId,
        supplier_id: supplierId === "unlinked" ? undefined : supplierId,
        lot_code: lotCode.trim(),
        quantity: Number(quantity),
        original_unit_cost: Number(unitCost),
        original_currency_code: multiCurrencyEnabled ? currencyCode : "EUR",
        ...(multiCurrencyEnabled
          ? {}
          : {
              fx_rate_to_eur: 1,
              fx_rate_at: new Date().toISOString(),
              fx_rate_source: "store_base",
            }),
        idempotency_key: crypto.randomUUID(),
      }),
    onSuccess: async () => {
      setLotCode("");
      setUnitCost("");
      await refresh();
      toast.success("采购批次已入库");
    },
    onError: (error: Error) => toast.error(error.message),
  });

  return (
    <section
      aria-label="配件采购成本与库存"
      className={cn(repairOs.mobileInfoCard, "min-w-0 space-y-4 p-3 sm:p-4")}
    >
      <div>
        <div className="flex items-center gap-2 text-sm font-semibold">
          <Boxes className="size-4 text-primary" /> 配件采购成本与库存
        </div>
        <p className="mt-1 text-xs leading-5 text-muted-foreground">
          采购批次保留供应商与单价快照；分配给维修项目后自动写入内部成本。加权均价仅作选批参考，不代替可追溯批次。
        </p>
      </div>

      {query.isPending ? <p className="text-xs text-muted-foreground">正在读取配件库存…</p> : null}
      {query.isError ? (
        <p role="alert" className="text-xs text-destructive">
          配件库存读取失败。
        </p>
      ) : null}
      {query.data ? (
        <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-3">
          {query.data.items.map((item) => (
            <div key={item.id} className="rounded-xl border border-border/70 bg-card p-3">
              <p className="truncate text-xs font-semibold">{item.name}</p>
              <p className="mt-1 font-mono text-[10px] text-muted-foreground lg:text-[11px] lg:leading-4">
                {item.sku}
              </p>
              <div className="mt-2 flex items-end justify-between gap-2">
                <span className="text-xs">可用 {item.available_quantity}</span>
                <span className="text-right text-[10px] text-muted-foreground lg:text-[11px] lg:leading-4">
                  加权均价
                  <br />
                  <b className="font-mono text-foreground">
                    {item.weighted_average_unit_cost_eur === null
                      ? "未知"
                      : formatMoney(item.weighted_average_unit_cost_eur)}
                  </b>
                </span>
              </div>
            </div>
          ))}
          {query.data.items.length === 0 ? (
            <p className="text-xs text-muted-foreground">尚未建立配件目录。</p>
          ) : null}
        </div>
      ) : null}

      <div className="grid gap-3 border-t border-border/60 pt-4 xl:grid-cols-2">
        <div className="grid gap-2 rounded-xl bg-muted/25 p-3 sm:grid-cols-2">
          <p className="col-span-full flex items-center gap-1.5 text-xs font-semibold">
            <Plus className="size-3.5" /> 新建配件目录
          </p>
          <Label className="text-xs">
            SKU
            <Input value={sku} onChange={(e) => setSku(e.target.value)} maxLength={80} />
          </Label>
          <Label className="text-xs">
            配件名称
            <Input value={name} onChange={(e) => setName(e.target.value)} maxLength={160} />
          </Label>
          <Button
            type="button"
            className="col-span-full sm:justify-self-end"
            size="sm"
            disabled={create.isPending || !sku.trim() || !name.trim()}
            onClick={() => create.mutate()}
          >
            创建目录
          </Button>
        </div>

        <div className="grid gap-2 rounded-xl bg-muted/25 p-3 sm:grid-cols-2">
          <p className="col-span-full flex items-center gap-1.5 text-xs font-semibold">
            <PackagePlus className="size-3.5" /> 登记采购批次
          </p>
          <Label className="col-span-full text-xs">
            配件
            <Select value={partId} onValueChange={setPartId}>
              <SelectTrigger>
                <SelectValue placeholder="选择配件" />
              </SelectTrigger>
              <SelectContent>
                {query.data?.items.map((item) => (
                  <SelectItem key={item.id} value={item.id}>
                    {item.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </Label>
          <Label className="text-xs">
            供应商
            <Select value={supplierId} onValueChange={setSupplierId}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="unlinked">未关联</SelectItem>
                {query.data?.suppliers.map((supplier) => (
                  <SelectItem key={supplier.id} value={supplier.id}>
                    {supplier.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </Label>
          <Label className="text-xs">
            批次号
            <Input value={lotCode} onChange={(e) => setLotCode(e.target.value)} />
          </Label>
          <Label className="text-xs">
            数量
            <Input
              type="number"
              min={1}
              step={1}
              value={quantity}
              onChange={(e) => setQuantity(e.target.value)}
            />
          </Label>
          {multiCurrencyEnabled ? (
            <Label className="text-xs">
              成本币种
              <Select
                value={currencyCode}
                onValueChange={(value) => setCurrencyCode(value as CostCurrencyCode)}
              >
                <SelectTrigger aria-label="采购成本币种">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {currencyQuery.data?.items.map((item) => (
                    <SelectItem
                      key={item.currency_code}
                      value={item.currency_code}
                      disabled={item.stale}
                    >
                      {COST_CURRENCY_LABELS[item.currency_code]}
                      {item.stale ? "（汇率已过期）" : ""}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </Label>
          ) : null}
          <Label className="text-xs">
            单位成本 {multiCurrencyEnabled ? currencyCode : "€"}
            <Input
              type="number"
              min={0}
              step="0.01"
              value={unitCost}
              onChange={(e) => setUnitCost(e.target.value)}
            />
          </Label>
          {multiCurrencyEnabled ? (
            <div className="col-span-full rounded-lg border border-border/60 bg-card px-3 py-2 text-[11px] text-muted-foreground lg:text-xs lg:leading-4">
              {currencyQuery.isPending
                ? "正在读取店主设置的采购汇率…"
                : selectedCurrency?.stale
                  ? "该汇率已超过 30 天，请店主先更新。"
                  : selectedCurrency?.rate_to_eur === null || !selectedCurrency
                    ? "当前币种没有可用汇率。"
                    : `1 ${currencyCode} = ${selectedCurrency.rate_to_eur} EUR；当前单位成本约 ${formatMoney(Number.isFinite(eurPreview) ? eurPreview : 0)}。入库后保存不可变快照。`}
            </div>
          ) : null}
          <Button
            type="button"
            className="col-span-full sm:justify-self-end"
            size="sm"
            disabled={
              receive.isPending ||
              !partId ||
              !lotCode.trim() ||
              Number(quantity) < 1 ||
              !Number.isFinite(Number(unitCost)) ||
              Number(unitCost) < 0 ||
              (multiCurrencyEnabled &&
                (currencyQuery.isPending ||
                  !selectedCurrency ||
                  selectedCurrency.stale ||
                  selectedCurrency.rate_to_eur === null))
            }
            onClick={() => receive.mutate()}
          >
            登记入库
          </Button>
        </div>
      </div>
    </section>
  );
}
