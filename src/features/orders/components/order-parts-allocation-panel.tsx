"use client";

import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Link2, PackageCheck, Undo2 } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { ordersKeys } from "@/features/orders/api/query-keys";
import { procurementKeys } from "@/features/procurement/api/query-keys";
import { partsProcurementQueryOptions } from "@/features/procurement/api/query-options";
import { allocateOrderPart, releaseOrderPart } from "@/lib/repairdesk/api";
import type { FaultPriceItem } from "@/lib/repairdesk/types";
import { formatMoney } from "@/lib/money";

export function OrderPartsAllocationPanel({
  orderId,
  storeId,
  faultPrices,
}: {
  orderId: string;
  storeId: string;
  faultPrices: FaultPriceItem[];
}) {
  const client = useQueryClient();
  const query = useQuery(partsProcurementQueryOptions(storeId, orderId));
  const [lotByLine, setLotByLine] = useState<Record<string, string>>({});
  const lines = useMemo(() => faultPrices.filter((line) => Boolean(line.line_id)), [faultPrices]);
  const refresh = async () => {
    await Promise.all([
      client.invalidateQueries({ queryKey: procurementKeys.all }),
      client.invalidateQueries({ queryKey: ordersKeys.detail(orderId, storeId) }),
    ]);
  };
  const allocate = useMutation({
    mutationFn: ({ lineId, lotId }: { lineId: string; lotId: string }) =>
      allocateOrderPart(orderId, {
        expected_store_id: storeId,
        line_id: lineId,
        lot_id: lotId,
        quantity: 1,
        idempotency_key: crypto.randomUUID(),
      }),
    onSuccess: async () => {
      await refresh();
      toast.success("采购批次已分配，内部成本已更新");
    },
    onError: (error: Error) => toast.error(error.message),
  });
  const release = useMutation({
    mutationFn: (allocationId: string) =>
      releaseOrderPart({
        expected_store_id: storeId,
        allocation_id: allocationId,
        reason: "工单配件分配纠正",
        idempotency_key: crypto.randomUUID(),
      }),
    onSuccess: async () => {
      await refresh();
      toast.success("配件已退回原采购批次");
    },
    onError: (error: Error) => toast.error(error.message),
  });

  return (
    <div className="space-y-2 border-t border-border/60 pt-2" data-order-part-allocation="true">
      <div className="flex items-start gap-2">
        <Link2 className="mt-0.5 size-3.5 shrink-0 text-primary" />
        <div>
          <p className="text-[11px] font-semibold lg:text-xs lg:leading-4">配件批次联动</p>
          <p className="text-[9px] leading-4 text-muted-foreground lg:text-xs lg:leading-4">
            每个报价行绑定一个可追溯采购批次；当前版本按件分配 1 个。
          </p>
        </div>
      </div>
      {query.isPending ? (
        <p className="text-[10px] text-muted-foreground lg:text-xs lg:leading-4">
          正在读取可用采购批次…
        </p>
      ) : null}
      {query.isError ? (
        <p role="alert" className="text-[10px] text-destructive lg:text-xs lg:leading-[18px]">
          采购批次读取失败。
        </p>
      ) : null}
      {query.data &&
        lines.map((line) => {
          const lineId = line.line_id!;
          const active = query.data.allocations.find(
            (item) => item.line_id === lineId && item.state === "allocated",
          );
          const availableLots = query.data.lots.filter(
            (lot) =>
              lot.available_quantity > 0 &&
              (!line.catalog_key || lot.catalog_key === line.catalog_key),
          );
          const selected = lotByLine[lineId] ?? availableLots[0]?.id ?? "";
          return (
            <div
              key={lineId}
              className="grid gap-2 rounded-lg border border-border/70 bg-muted/20 p-2 sm:grid-cols-[minmax(0,1fr)_minmax(180px,0.8fr)_auto] sm:items-center"
            >
              <div className="min-w-0">
                <p className="truncate text-[10px] font-medium lg:text-xs lg:leading-4">
                  {line.name}
                </p>
                {active ? (
                  <p className="mt-0.5 text-[9px] text-muted-foreground lg:text-xs lg:leading-4">
                    {active.part_name} · {active.supplier_name ?? "未关联供应商"} ·{" "}
                    {formatMoney(active.total_cost_eur)}
                  </p>
                ) : (
                  <p className="mt-0.5 text-[9px] text-muted-foreground lg:text-xs lg:leading-4">
                    尚未绑定采购批次
                  </p>
                )}
              </div>
              {active ? (
                <span className="text-[10px] font-medium text-status-success-foreground lg:text-xs lg:leading-4">
                  <PackageCheck className="mr-1 inline size-3" />
                  已分配
                </span>
              ) : (
                <Select
                  value={selected}
                  onValueChange={(value) =>
                    setLotByLine((current) => ({ ...current, [lineId]: value }))
                  }
                >
                  <SelectTrigger className="h-8 text-[10px] lg:text-xs lg:leading-4">
                    <SelectValue placeholder="无匹配批次" />
                  </SelectTrigger>
                  <SelectContent>
                    {availableLots.map((lot) => (
                      <SelectItem key={lot.id} value={lot.id}>
                        {lot.part_name} · 可用 {lot.available_quantity} ·{" "}
                        {formatMoney(lot.unit_cost_eur)}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
              {active ? (
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  className="h-8 text-[10px] lg:text-xs lg:leading-4"
                  disabled={release.isPending}
                  onClick={() => release.mutate(active.id)}
                >
                  <Undo2 className="mr-1 size-3" />
                  释放
                </Button>
              ) : (
                <Button
                  type="button"
                  size="sm"
                  className="h-8 text-[10px] lg:text-xs lg:leading-4"
                  disabled={!selected || allocate.isPending}
                  onClick={() => allocate.mutate({ lineId, lotId: selected })}
                >
                  分配 1 件
                </Button>
              )}
            </div>
          );
        })}
    </div>
  );
}
