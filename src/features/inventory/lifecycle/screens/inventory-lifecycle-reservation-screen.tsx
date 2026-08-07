"use client";

import { useQuery, useQueryClient } from "@tanstack/react-query";
import { PackageOpen, RefreshCw } from "lucide-react";
import { useRouter } from "next/navigation";

import { Button } from "@/components/ui/button";
import { useStoreShellContext } from "@/features/stores/api/use-store-shell-context";
import { getInventoryProduct } from "@/lib/repairdesk/api";
import { repairOs } from "@/lib/ui-patterns";
import { cn } from "@/lib/utils";

import { inventoryLifecycleSummaryQueryOptions } from "../api/query-options";
import { inventoryLifecycleKeys } from "../api/query-keys";
import {
  InventoryLifecycleLoadingCard,
  InventoryLifecyclePageShell,
} from "../components/inventory-lifecycle-page-shell";
import {
  InventoryLifecycleStatusBadge,
  InventoryLifecycleUnavailableCard,
} from "../components/inventory-lifecycle-status";
import { InventoryReservationForm } from "../forms/inventory-reservation-form";

export function InventoryLifecycleReservationScreen({
  itemId,
  mode = "reservation",
}: {
  itemId: string;
  mode?: "reservation" | "sale";
}) {
  const router = useRouter();
  const queryClient = useQueryClient();
  const shell = useStoreShellContext({ monitorAuthority: true });
  const storeId = shell.activeStore?.id;
  const canRead = Boolean(
    storeId &&
    shell.permissions?.canReadInventory &&
    shell.permissions.inventoryProductsUiEnabled &&
    shell.permissions.inventoryLifecycleUiEnabled === true,
  );
  const productQuery = useQuery({
    queryKey: ["inventory-products", "lifecycle-reserve", storeId, itemId],
    queryFn: () => getInventoryProduct(itemId),
    enabled: canRead,
    retry: false,
  });
  const summaryQuery = useQuery({
    ...inventoryLifecycleSummaryQueryOptions(itemId, storeId),
    enabled: canRead,
  });

  if (shell.isLoading || productQuery.isLoading || summaryQuery.isLoading) {
    return (
      <InventoryLifecyclePageShell
        title={mode === "sale" ? "快速成交" : "新建预订"}
        context="正在读取商品库存"
        onBack={() => router.push("/inventory")}
      >
        <InventoryLifecycleLoadingCard />
        <InventoryLifecycleLoadingCard />
      </InventoryLifecyclePageShell>
    );
  }

  if (!canRead) {
    return (
      <InventoryLifecyclePageShell
        title={mode === "sale" ? "快速成交" : "新建预订"}
        context="商品库存"
        onBack={() => router.push("/inventory")}
      >
        <InventoryLifecycleUnavailableCard
          title="无法开始预订"
          body={
            shell.permissions?.canReadInventory
              ? "当前门店尚未启用商品库存或生命周期功能。"
              : "当前账号没有商品库存查看权限。"
          }
          onBack={() => router.push("/inventory")}
        />
      </InventoryLifecyclePageShell>
    );
  }

  if (productQuery.isError || !productQuery.data) {
    return (
      <InventoryLifecyclePageShell
        title={mode === "sale" ? "快速成交" : "新建预订"}
        context="商品库存"
        onBack={() => router.push("/inventory")}
      >
        <InventoryLifecycleUnavailableCard
          title="商品详情加载失败"
          body="商品可能不存在，或当前网络暂时不可用。没有写入任何预订。"
          onBack={() => router.push("/inventory")}
        />
        <Button
          type="button"
          variant="outline"
          className="min-h-11"
          onClick={() => void productQuery.refetch()}
        >
          <RefreshCw className="mr-2 size-4" aria-hidden="true" />
          重试
        </Button>
      </InventoryLifecyclePageShell>
    );
  }

  const product = productQuery.data;
  const summary = summaryQuery.data;
  const summaryUnavailable = summaryQuery.isError || !summary;
  const canReserve = summary?.allowed_actions?.includes("reservation.create") === true;
  const disabledReason = summaryUnavailable
    ? "商品生命周期数据接口尚未启用，预订提交已禁用。"
    : canReserve
      ? undefined
      : "服务端尚未返回可用动作（allowed_actions），或当前商品不允许预订，提交已禁用。";

  return (
    <InventoryLifecyclePageShell
      title={mode === "sale" ? "快速成交" : "新建预订"}
      context={`${product.brand} ${product.model} · ${product.sku}`}
      status={summary ? <InventoryLifecycleStatusBadge status={summary.business_status} /> : null}
      onBack={() => router.push(`/inventory/${encodeURIComponent(itemId)}`)}
    >
      <section className={cn(repairOs.mobileInfoCard, "p-3 sm:p-4")}>
        <div className="flex min-w-0 items-start gap-3">
          <span className="grid size-12 shrink-0 place-items-center rounded-xl bg-primary/10 text-primary">
            <PackageOpen className="size-6" aria-hidden="true" />
          </span>
          <div className="min-w-0">
            <p className="truncate text-sm font-semibold">
              {product.brand} {product.model}
            </p>
            <p className="mt-1 truncate font-mono text-xs text-primary">{product.sku}</p>
            <p className="mt-1 truncate text-xs text-muted-foreground">
              {[product.specification, product.location].filter(Boolean).join(" · ") || "商品资料"}
            </p>
          </div>
        </div>
      </section>

      {summary ? (
        <InventoryReservationForm
          summary={summary}
          storeId={storeId}
          defaultPrice={product.list_price}
          disabledReason={disabledReason}
          onSuccess={(result) => {
            void queryClient.invalidateQueries({ queryKey: inventoryLifecycleKeys.all });
            void queryClient.invalidateQueries({ queryKey: ["inventory-products"] });
            router.replace(
              mode === "sale"
                ? `/inventory/sales/${encodeURIComponent(result.sale_order_id ?? itemId)}`
                : `/inventory/reservations/${encodeURIComponent(result.sale_order_id ?? itemId)}`,
            );
          }}
        />
      ) : (
        <InventoryLifecycleUnavailableCard body={disabledReason} />
      )}
      {summaryQuery.isError ? (
        <p className="px-1 text-[10px] text-muted-foreground" role="status">
          关闭开关时保留现有商品浏览功能；启用生命周期服务后可继续预订。
        </p>
      ) : null}
    </InventoryLifecyclePageShell>
  );
}
