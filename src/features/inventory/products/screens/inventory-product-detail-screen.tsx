"use client";

import { useRouter } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import { PackageOpen, RefreshCw } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { useStoreShellContext } from "@/features/stores/api/use-store-shell-context";
import { repairOs } from "@/lib/ui-patterns";
import { cn } from "@/lib/utils";

import { inventoryLifecycleSummaryQueryOptions } from "@/features/inventory/lifecycle/api/query-options";

import { inventoryProductDetailQueryOptions } from "../api/query-options";
import { InventoryProductDetailWorkbench } from "../components/inventory-product-detail-workbench";

export function InventoryProductDetailScreen({ id }: { id: string }) {
  const router = useRouter();
  const shell = useStoreShellContext();
  const storeId = shell.activeStore?.id;
  const query = useQuery({
    ...inventoryProductDetailQueryOptions(id, storeId),
    enabled: Boolean(
      storeId &&
      shell.permissions?.canReadInventory &&
      shell.permissions.inventoryProductsUiEnabled,
    ),
  });
  const lifecycleSummaryQuery = useQuery({
    ...inventoryLifecycleSummaryQueryOptions(id, storeId),
    enabled: Boolean(
      storeId &&
      shell.permissions?.canReadInventory &&
      shell.permissions.inventoryProductsUiEnabled &&
      shell.permissions.inventoryLifecycleUiEnabled === true,
    ),
  });

  if (shell.isLoading || query.isLoading) return <DetailSkeleton />;
  if (
    !storeId ||
    !shell.permissions?.canReadInventory ||
    !shell.permissions.inventoryProductsUiEnabled
  ) {
    return (
      <DetailMessage
        title="无法查看商品"
        body={
          shell.permissions?.canReadInventory
            ? "当前门店尚未启用新版商品库存。"
            : "当前账号没有商品库存查看权限。"
        }
        onBack={() => router.push("/inventory")}
      />
    );
  }
  if (query.isError || !query.data) {
    return (
      <DetailMessage
        title="商品详情加载失败"
        body="商品可能不存在，或当前网络暂时不可用。"
        onBack={() => router.push("/inventory")}
        action={
          <Button
            type="button"
            variant="outline"
            className="min-h-9"
            onClick={() => void query.refetch()}
          >
            <RefreshCw className="mr-2 size-4" aria-hidden="true" />
            重试
          </Button>
        }
      />
    );
  }

  const item = query.data;
  const canEdit = Boolean(
    shell.permissions?.canUpdateInventory && !["sold", "removed"].includes(item.status),
  );
  return (
    <InventoryProductDetailWorkbench
      item={item}
      lifecycleSummary={lifecycleSummaryQuery.data}
      lifecycleSummaryState={
        shell.permissions.inventoryLifecycleUiEnabled === true
          ? lifecycleSummaryQuery.isLoading
            ? "loading"
            : lifecycleSummaryQuery.isError
              ? "unavailable"
              : "ready"
          : "dormant"
      }
      canEdit={canEdit}
      onBack={() => router.push("/inventory")}
      onEdit={() => router.push(`/inventory/${item.id}/edit`)}
    />
  );
}

function DetailSkeleton() {
  return (
    <main className={cn(repairOs.mobileFloatingPage, "mx-auto w-full max-w-5xl")} aria-busy="true">
      <span className="sr-only">正在加载商品详情</span>
      <Skeleton className="mb-3 h-24 rounded-3xl" />
      <div className="grid gap-3 lg:grid-cols-2">
        <Skeleton className="h-64 rounded-2xl" />
        <Skeleton className="h-64 rounded-2xl" />
      </div>
    </main>
  );
}

function DetailMessage({
  title,
  body,
  onBack,
  action,
}: {
  title: string;
  body: string;
  onBack: () => void;
  action?: React.ReactNode;
}) {
  return (
    <main className={cn(repairOs.mobileFloatingPage, "grid min-h-[55dvh] place-items-center p-4")}>
      <section className={cn(repairOs.mobileInfoCard, "max-w-sm p-6 text-center")} role="alert">
        <PackageOpen className="mx-auto mb-3 size-9 text-muted-foreground" aria-hidden="true" />
        <h1 className="font-semibold">{title}</h1>
        <p className="mt-2 text-sm text-muted-foreground">{body}</p>
        <div className="mt-4 flex flex-wrap justify-center gap-2">
          <Button type="button" variant="outline" className="min-h-9" onClick={onBack}>
            返回商品库存
          </Button>
          {action}
        </div>
      </section>
    </main>
  );
}
