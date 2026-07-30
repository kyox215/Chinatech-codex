"use client";

import { useRouter } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import {
  ArrowLeft,
  Gamepad2,
  Laptop,
  PackageOpen,
  Pencil,
  RefreshCw,
  Smartphone,
  Tablet,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { useStoreShellContext } from "@/features/stores/api/use-store-shell-context";
import type {
  InventoryProductCategory,
  InventoryProductDisplayStatus,
} from "@/lib/repairdesk/types";
import { repairOs } from "@/lib/ui-patterns";
import { cn } from "@/lib/utils";

import { inventoryProductDetailQueryOptions } from "../api/query-options";

const categories: Record<InventoryProductCategory, { label: string; icon: typeof Smartphone }> = {
  phone: { label: "手机", icon: Smartphone },
  tablet: { label: "平板", icon: Tablet },
  computer: { label: "电脑", icon: Laptop },
  game_console: { label: "游戏机", icon: Gamepad2 },
  other: { label: "其他", icon: PackageOpen },
};

const statuses: Record<InventoryProductDisplayStatus, string> = {
  in_stock: "在库",
  reserved: "已预留",
  sold: "已售",
  removed: "已移除",
  returned: "已退回",
};

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
          <Button type="button" variant="outline" onClick={() => void query.refetch()}>
            <RefreshCw className="mr-2 size-4" />
            重试
          </Button>
        }
      />
    );
  }

  const item = query.data;
  const meta = categories[item.category];
  const Icon = meta.icon;
  const businessFields = [
    item.list_price !== undefined
      ? { label: "计划售价", value: formatPrice(item.list_price) }
      : undefined,
    item.cost_amount !== undefined
      ? { label: "入库成本", value: formatPrice(item.cost_amount) }
      : undefined,
    item.location ? { label: "库位", value: item.location } : undefined,
    item.warranty_months !== undefined
      ? { label: "保修", value: `${item.warranty_months} 个月` }
      : undefined,
  ].filter((value): value is { label: string; value: string } => Boolean(value));

  return (
    <main
      className={cn(
        repairOs.mobileFloatingPage,
        "mx-auto w-full max-w-3xl pb-10 pt-[var(--repair-os-mobile-floating-offset,5.25rem)] lg:pt-0",
      )}
    >
      <div className={cn(repairOs.mobileFloatingHeaderShell, "lg:static lg:mb-4")}>
        <section className={repairOs.mobileFloatingHeaderCard}>
          <header className={repairOs.mobileFloatingHeaderNav}>
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className="size-11 rounded-xl"
              aria-label="返回商品库存"
              onClick={() => router.push("/inventory")}
            >
              <ArrowLeft className="size-5" />
            </Button>
            <div className="min-w-0 text-center">
              <h1 className="truncate text-sm font-semibold">
                {item.brand} {item.model}
              </h1>
              <p className="text-[10px] text-muted-foreground">
                {meta.label} · {statuses[item.status]}
              </p>
            </div>
            {shell.permissions?.canUpdateInventory && !["sold", "removed"].includes(item.status) ? (
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="size-11 rounded-xl"
                aria-label="编辑商品"
                onClick={() => router.push(`/inventory/${item.id}/edit`)}
              >
                <Pencil className="size-4" />
              </Button>
            ) : (
              <span className="size-11" aria-hidden />
            )}
          </header>
        </section>
      </div>

      <div className="space-y-3">
        <header className="hidden items-center justify-between gap-4 pb-1 lg:flex">
          <div className="min-w-0">
            <h1 className="truncate text-xl font-semibold">
              {item.brand} {item.model}
            </h1>
            <p className="text-sm text-muted-foreground">
              {item.sku} · {statuses[item.status]}
            </p>
          </div>
          {shell.permissions?.canUpdateInventory && !["sold", "removed"].includes(item.status) ? (
            <Button type="button" onClick={() => router.push(`/inventory/${item.id}/edit`)}>
              <Pencil className="mr-2 size-4" />
              编辑商品
            </Button>
          ) : null}
        </header>
        <section className={cn(repairOs.mobileInfoCard, "p-4 md:p-5")}>
          <div className="flex min-w-0 items-start gap-3">
            <span className="grid size-12 shrink-0 place-items-center rounded-2xl bg-primary/10 text-primary">
              <Icon className="size-6" />
            </span>
            <div className="min-w-0">
              <p className="text-xs font-medium text-muted-foreground">{meta.label}</p>
              <h2 className="break-words text-xl font-semibold leading-7">
                {item.brand} {item.model}
              </h2>
              {item.specification ? (
                <p className="mt-1 break-words text-sm text-muted-foreground">
                  {item.specification}
                </p>
              ) : null}
            </div>
          </div>
          <div className="mt-4 grid gap-2 rounded-xl bg-muted/50 p-3 sm:grid-cols-2">
            <DetailLine label="内部 SKU" value={item.sku} mono />
            {item.masked_identifier ? (
              <DetailLine label="设备标识" value={item.masked_identifier} mono />
            ) : null}
            <DetailLine label="库存状态" value={statuses[item.status]} />
            {item.location ? <DetailLine label="库位" value={item.location} /> : null}
          </div>
        </section>

        {item.identifiers.length ? (
          <section className={cn(repairOs.mobileInfoCard, "p-4 md:p-5")}>
            <h2 className="text-sm font-semibold">设备标识</h2>
            <div className="mt-3 grid min-w-0 gap-2 sm:grid-cols-2">
              {item.identifiers.map((identifier) => (
                <DetailLine
                  key={identifier.kind}
                  label={identifierLabel(identifier.kind)}
                  value={identifier.masked_value}
                  mono
                />
              ))}
            </div>
          </section>
        ) : null}

        {item.ram_capacity ||
        item.storage_capacity ||
        item.color ||
        item.gtin ||
        item.condition ||
        Object.keys(item.specifications ?? {}).length ? (
          <section className={cn(repairOs.mobileInfoCard, "p-4 md:p-5")}>
            <h2 className="text-sm font-semibold">设备资料</h2>
            <div className="mt-3 grid min-w-0 gap-3 sm:grid-cols-2">
              {item.ram_capacity ? <DetailLine label="内存" value={item.ram_capacity} /> : null}
              {item.storage_capacity ? (
                <DetailLine label="存储" value={item.storage_capacity} />
              ) : null}
              {item.color ? <DetailLine label="颜色" value={item.color} /> : null}
              {item.condition ? <DetailLine label="成色" value={item.condition} /> : null}
              {item.gtin ? <DetailLine label="EAN / GTIN" value={item.gtin} mono /> : null}
              {Object.entries(item.specifications ?? {}).map(([key, value]) => (
                <DetailLine key={key} label={specificationLabel(key)} value={value} />
              ))}
            </div>
          </section>
        ) : null}

        {businessFields.length ? (
          <section className={cn(repairOs.mobileInfoCard, "p-4 md:p-5")}>
            <h2 className="text-sm font-semibold">经营信息</h2>
            <div className="mt-3 grid grid-cols-2 gap-2">
              {businessFields.map((field) => (
                <div
                  key={field.label}
                  className="min-w-0 rounded-xl border border-border bg-card p-3"
                >
                  <p className="text-xs text-muted-foreground">{field.label}</p>
                  <p className="mt-1 break-words font-semibold">{field.value}</p>
                </div>
              ))}
            </div>
          </section>
        ) : null}

        {item.notes ? (
          <section className={cn(repairOs.mobileInfoCard, "p-4 md:p-5")}>
            <h2 className="text-sm font-semibold">备注</h2>
            <p className="mt-2 whitespace-pre-wrap break-words text-sm text-muted-foreground">
              {item.notes}
            </p>
          </section>
        ) : null}
      </div>
    </main>
  );
}
function identifierLabel(kind: string) {
  return { imei1: "IMEI 1", imei2: "IMEI 2", serial: "序列号", eid: "EID" }[kind] ?? kind;
}
function specificationLabel(key: string) {
  return (
    {
      network_variant: "网络版本",
      connectivity: "联网版本",
      screen_size_inches: "屏幕尺寸",
      processor: "处理器",
      disk_type: "硬盘类型",
      graphics: "显卡",
      edition: "版本",
      region: "区域",
      included_controller_count: "手柄数",
      short_specification: "简短规格",
    }[key] ?? key
  );
}

function DetailLine({ label, value, mono }: { label: string; value: string; mono?: boolean }) {
  return (
    <div className="min-w-0">
      <p className="text-[11px] text-muted-foreground">{label}</p>
      <p className={cn("break-words text-sm font-medium", mono && "font-mono")}>{value}</p>
    </div>
  );
}
function formatPrice(value: number) {
  return new Intl.NumberFormat("it-IT", { style: "currency", currency: "EUR" }).format(value);
}
function DetailSkeleton() {
  return (
    <main className={cn(repairOs.mobileFloatingPage, "mx-auto w-full max-w-3xl")} aria-busy="true">
      <Skeleton className="mb-3 h-24 rounded-3xl" />
      <Skeleton className="h-64 rounded-2xl" />
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
      <section className={cn(repairOs.mobileInfoCard, "max-w-sm p-6 text-center")}>
        <PackageOpen className="mx-auto mb-3 size-9 text-muted-foreground" />
        <h1 className="font-semibold">{title}</h1>
        <p className="mt-2 text-sm text-muted-foreground">{body}</p>
        <div className="mt-4 flex flex-wrap justify-center gap-2">
          <Button type="button" variant="outline" onClick={onBack}>
            返回商品库存
          </Button>
          {action}
        </div>
      </section>
    </main>
  );
}
