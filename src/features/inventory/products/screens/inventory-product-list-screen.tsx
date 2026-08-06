"use client";

import { useDeferredValue, useMemo, useState } from "react";
import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import {
  Filter,
  Gamepad2,
  Laptop,
  PackageOpen,
  Plus,
  RefreshCw,
  Search,
  Smartphone,
  Tablet,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Sheet,
  SheetClose,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { Skeleton } from "@/components/ui/skeleton";
import { useStoreShellContext } from "@/features/stores/api/use-store-shell-context";
import type {
  InventoryProductCategory,
  InventoryProductDisplayStatus,
  InventoryProductListFilters,
  InventoryProductListItem,
} from "@/lib/repairdesk/types";
import { repairOs } from "@/lib/ui-patterns";
import { cn } from "@/lib/utils";
import { MoneyText, RepairOsBadge, RepairOsListScaffold } from "@/shared/ui";
import { useViewportMode } from "@/hooks/use-mobile";

import { inventoryProductsQueryOptions } from "../api/query-options";

const categoryMeta: Record<InventoryProductCategory, { label: string; icon: typeof Smartphone }> = {
  phone: { label: "手机", icon: Smartphone },
  tablet: { label: "平板", icon: Tablet },
  computer: { label: "电脑", icon: Laptop },
  game_console: { label: "游戏机", icon: Gamepad2 },
  other: { label: "其他", icon: PackageOpen },
};

const statusLabels: Record<InventoryProductDisplayStatus, string> = {
  in_stock: "在库",
  reserved: "已预留",
  sold: "已售",
  removed: "已移除",
  returned: "已退回",
};

const statusStyles: Record<InventoryProductDisplayStatus, string> = {
  in_stock: "bg-status-success text-status-success-foreground",
  reserved: "bg-status-warn text-status-warn-foreground",
  sold: "bg-status-neutral text-status-neutral-foreground",
  removed: "bg-destructive/10 text-destructive",
  returned: "bg-status-info text-status-info-foreground",
};

export function InventoryProductListScreen() {
  const shell = useStoreShellContext();
  const viewportMode = useViewportMode();
  const storeId = shell.activeStore?.id;
  const [search, setSearch] = useState("");
  const deferredSearch = useDeferredValue(search);
  const [filterOpen, setFilterOpen] = useState(false);
  const [filters, setFilters] = useState<InventoryProductListFilters>({});
  const [draft, setDraft] = useState<InventoryProductListFilters>({});
  const queryFilters = useMemo(
    () => ({ ...filters, search: deferredSearch.trim() || undefined }),
    [deferredSearch, filters],
  );
  const query = useQuery({
    ...inventoryProductsQueryOptions(queryFilters, storeId),
    enabled: Boolean(
      storeId &&
      shell.permissions?.canReadInventory &&
      shell.permissions.inventoryProductsUiEnabled,
    ),
  });
  const activeFilterCount =
    (filters.statuses?.length ?? 0) +
    (filters.categories?.length ?? 0) +
    (filters.brands?.length ?? 0) +
    (filters.locations?.length ?? 0);

  const createAction =
    shell.permissions?.canCreateInventory &&
    shell.permissions.inventoryProductsUiEnabled &&
    shell.permissions.inventoryProductQuickCreateEnabled ? (
      <Button asChild size="iconDense" className="size-9 rounded-lg" aria-label="快速录入商品">
        <Link href="/inventory/new">
          <Plus className="size-5" />
        </Link>
      </Button>
    ) : null;

  if (
    !shell.isLoading &&
    (!storeId ||
      !shell.permissions?.canReadInventory ||
      !shell.permissions.inventoryProductsUiEnabled)
  ) {
    return (
      <InventoryProductMessage
        title="商品库存暂不可用"
        body={
          shell.permissions?.canReadInventory
            ? "当前门店尚未启用新版商品库存。"
            : "当前账号没有商品库存查看权限。"
        }
      />
    );
  }

  return (
    <RepairOsListScaffold
      title="商品库存"
      subtitle={query.data ? `共 ${query.data.total} 件` : "店内单件商品"}
      action={createAction}
      desktopAction={createAction}
      desktopHeaderAddon={
        <div className="flex min-w-0 items-center gap-2">
          <div className="relative min-w-0 flex-1">
            <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="搜索商品、SKU、型号"
              aria-label="搜索商品、SKU、型号"
              className="h-10 pl-9"
            />
          </div>
          <Button
            type="button"
            variant="outline"
            className="relative h-10 shrink-0 gap-2"
            aria-label={activeFilterCount ? `筛选，已应用 ${activeFilterCount} 项` : "筛选商品"}
            onClick={() => {
              setDraft(filters);
              setFilterOpen(true);
            }}
          >
            <Filter className="size-4" />
            筛选
            {activeFilterCount ? (
              <span className="grid min-w-5 place-items-center rounded-full bg-primary px-1 text-[10px] font-semibold leading-5 text-primary-foreground">
                {activeFilterCount}
              </span>
            ) : null}
          </Button>
        </div>
      }
      searchValue={search}
      searchPlaceholder="搜索商品、SKU、型号"
      onSearchChange={setSearch}
      filterAction={
        <Button
          type="button"
          variant="outline"
          size="icon"
          className="relative size-9 rounded-lg bg-card"
          aria-label={activeFilterCount ? `筛选，已应用 ${activeFilterCount} 项` : "筛选商品"}
          onClick={() => {
            setDraft(filters);
            setFilterOpen(true);
          }}
        >
          <Filter className="size-4" />
          {activeFilterCount ? (
            <span className="absolute -right-1 -top-1 grid size-5 place-items-center rounded-full bg-primary text-[10px] font-semibold text-primary-foreground">
              {activeFilterCount}
            </span>
          ) : null}
        </Button>
      }
    >
      <p className="sr-only" role="status" aria-live="polite">
        {query.isFetching && !query.isLoading
          ? "正在更新商品结果"
          : query.data
            ? `已显示 ${query.data.items.length} 件商品`
            : "正在准备商品结果"}
      </p>
      {activeFilterCount ? (
        <div className="mb-2 flex flex-wrap items-center gap-1.5" aria-live="polite">
          <span className="rounded-full bg-primary/10 px-2.5 py-1 text-[11px] font-medium text-primary">
            已应用 {activeFilterCount} 项筛选
          </span>
          <Button type="button" variant="ghost" size="sm" onClick={() => setFilters({})}>
            清除
          </Button>
        </div>
      ) : null}

      {query.isLoading || shell.isLoading ? <InventoryProductListSkeleton /> : null}
      {query.isError ? (
        <InventoryProductMessage
          title="商品库存加载失败"
          body="请检查网络后重试，现有商品没有被修改。"
          action={
            <Button type="button" variant="outline" onClick={() => void query.refetch()}>
              <RefreshCw className="mr-2 size-4" />
              重试
            </Button>
          }
        />
      ) : null}
      {query.isSuccess && query.data.items.length === 0 ? (
        <InventoryProductMessage
          title={search || activeFilterCount ? "没有符合条件的商品" : "还没有商品"}
          body={
            search || activeFilterCount
              ? "更换搜索词或清除筛选。"
              : "录入手机、平板、电脑或游戏机。"
          }
          action={createAction}
        />
      ) : null}
      {query.data?.items.length ? (
        <InventoryProductResults items={query.data.items} viewportMode={viewportMode} />
      ) : null}

      <InventoryProductFilterSheet
        open={filterOpen}
        onOpenChange={setFilterOpen}
        draft={draft}
        onDraftChange={setDraft}
        brands={query.data?.facets.brands ?? []}
        locations={query.data?.facets.locations ?? []}
        onApply={() => {
          setFilters(draft);
          setFilterOpen(false);
        }}
      />
    </RepairOsListScaffold>
  );
}

function InventoryProductResults({
  items,
  viewportMode,
}: {
  items: InventoryProductListItem[];
  viewportMode: ReturnType<typeof useViewportMode>;
}) {
  return (
    <>
      {viewportMode === "compact" ? (
        <div
          data-inventory-product-mobile-list="true"
          className={cn(repairOs.listCardStack, "md:grid-cols-2")}
        >
          {items.map((item) => (
            <InventoryProductCard key={item.id} item={item} />
          ))}
        </div>
      ) : null}
      {viewportMode === "desktop" ? (
        <div
          data-inventory-product-desktop-list="true"
          className="rounded-2xl border border-border bg-card p-2 shadow-sm"
        >
          <div className="grid grid-cols-[110px_minmax(0,1.5fr)_minmax(0,1fr)_120px_88px_36px] items-center gap-3 px-3 py-2 text-xs font-medium text-muted-foreground">
            <span>SKU / 状态</span>
            <span>商品</span>
            <span>规格 / 位置</span>
            <span>标识</span>
            <span className="text-right">售价</span>
            <span />
          </div>
          <div className="divide-y divide-border">
            {items.map((item) => (
              <Link
                key={item.id}
                href={`/inventory/${item.id}`}
                className="grid min-h-[52px] grid-cols-[110px_minmax(0,1.5fr)_minmax(0,1fr)_120px_88px_36px] items-center gap-3 rounded-xl px-3 py-1.5 text-sm transition-colors hover:bg-muted/60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              >
                <span className="min-w-0">
                  <span className="block truncate font-mono text-xs text-primary">{item.sku}</span>
                  <span className="text-xs text-muted-foreground">{statusLabels[item.status]}</span>
                </span>
                <span className="min-w-0">
                  <span className="block truncate font-semibold">
                    {item.brand} {item.model}
                  </span>
                  <span className="text-xs text-muted-foreground">
                    {categoryMeta[item.category].label}
                  </span>
                </span>
                <span className="min-w-0 truncate text-muted-foreground">
                  {[item.specification, item.location].filter(Boolean).join(" · ") || "—"}
                </span>
                <span className="truncate font-mono text-xs text-muted-foreground">
                  {item.masked_identifier ?? "—"}
                </span>
                <span className="text-right font-semibold">
                  {item.list_price === undefined ? (
                    "未填写"
                  ) : (
                    <MoneyText amount={item.list_price} />
                  )}
                </span>
                <span className="grid size-9 place-items-center text-primary" aria-hidden>
                  ›
                </span>
              </Link>
            ))}
          </div>
        </div>
      ) : null}
    </>
  );
}

function InventoryProductCard({ item }: { item: InventoryProductListItem }) {
  const Icon = categoryMeta[item.category].icon;
  return (
    <Link
      href={`/inventory/${item.id}`}
      data-ui="inventory-product-card"
      className={cn(
        repairOs.businessCardDense,
        "min-h-[84px] grid-cols-[36px_minmax(0,1fr)_auto] items-center gap-2 px-2.5 py-2 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
      )}
    >
      <span className="grid size-9 place-items-center rounded-xl bg-primary/10 text-primary">
        <Icon className="size-4" aria-hidden="true" />
      </span>
      <span className="min-w-0 self-center">
        <span className="block truncate font-mono text-[10px] leading-4 text-primary">
          {item.sku}
        </span>
        <span className="block truncate text-xs font-semibold leading-4">
          {item.brand} {item.model}
        </span>
        <span className="block truncate text-[10px] leading-4 text-muted-foreground">
          {[item.specification, item.location, item.masked_identifier]
            .filter(Boolean)
            .join(" · ") || categoryMeta[item.category].label}
        </span>
      </span>
      <span className="flex min-w-[64px] flex-col items-end gap-2 self-stretch py-0.5 text-right">
        <RepairOsBadge className={statusStyles[item.status]}>
          {statusLabels[item.status]}
        </RepairOsBadge>
        <span className="mt-auto whitespace-nowrap text-xs font-semibold">
          {item.list_price === undefined ? "未填写" : <MoneyText amount={item.list_price} />}
        </span>
      </span>
    </Link>
  );
}

function InventoryProductFilterSheet({
  open,
  onOpenChange,
  draft,
  onDraftChange,
  brands,
  locations,
  onApply,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  draft: InventoryProductListFilters;
  onDraftChange: (filters: InventoryProductListFilters) => void;
  brands: string[];
  locations: string[];
  onApply: () => void;
}) {
  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        side="bottom"
        className="flex max-h-[88dvh] flex-col overflow-hidden rounded-t-3xl sm:left-auto sm:right-0 sm:top-0 sm:h-full sm:max-h-none sm:w-[400px] sm:rounded-none"
      >
        <SheetHeader>
          <SheetTitle>筛选商品</SheetTitle>
          <SheetDescription>按状态、类别、品牌或库位缩小结果。</SheetDescription>
        </SheetHeader>
        <div className="min-h-0 flex-1 space-y-3 overflow-y-auto py-3">
          <FilterGroup
            title="状态"
            values={Object.keys(statusLabels)}
            selected={draft.statuses ?? []}
            labels={statusLabels}
            onChange={(values) =>
              onDraftChange({ ...draft, statuses: values as InventoryProductDisplayStatus[] })
            }
          />
          <FilterGroup
            title="类别"
            values={Object.keys(categoryMeta)}
            selected={draft.categories ?? []}
            labels={Object.fromEntries(
              Object.entries(categoryMeta).map(([key, value]) => [key, value.label]),
            )}
            onChange={(values) =>
              onDraftChange({ ...draft, categories: values as InventoryProductCategory[] })
            }
          />
          {brands.length ? (
            <FilterGroup
              title="品牌"
              values={brands}
              selected={draft.brands ?? []}
              onChange={(values) => onDraftChange({ ...draft, brands: values })}
            />
          ) : null}
          {locations.length ? (
            <FilterGroup
              title="库位"
              values={locations}
              selected={draft.locations ?? []}
              onChange={(values) => onDraftChange({ ...draft, locations: values })}
            />
          ) : null}
        </div>
        <SheetFooter className="grid shrink-0 grid-cols-2 gap-2 border-t border-border bg-background pt-3 sm:grid-cols-2">
          <Button type="button" variant="outline" onClick={() => onDraftChange({})}>
            重置
          </Button>
          <SheetClose asChild>
            <Button type="button" onClick={onApply}>
              应用筛选
            </Button>
          </SheetClose>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  );
}

function FilterGroup({
  title,
  values,
  selected,
  labels,
  onChange,
}: {
  title: string;
  values: string[];
  selected: string[];
  labels?: Record<string, string>;
  onChange: (values: string[]) => void;
}) {
  return (
    <fieldset>
      <legend className="mb-1.5 text-xs font-semibold">{title}</legend>
      <div className="grid grid-cols-2 gap-1.5">
        {values.map((value) => {
          const checked = selected.includes(value);
          return (
            <Label
              key={value}
              className={cn(
                "flex min-h-9 cursor-pointer items-center gap-2 rounded-lg border px-2.5 py-1.5",
                checked && "border-primary bg-primary/5",
              )}
            >
              <Checkbox
                checked={checked}
                onCheckedChange={() =>
                  onChange(
                    checked ? selected.filter((entry) => entry !== value) : [...selected, value],
                  )
                }
              />
              <span className="min-w-0 break-words text-sm">{labels?.[value] ?? value}</span>
            </Label>
          );
        })}
      </div>
    </fieldset>
  );
}

function InventoryProductListSkeleton() {
  const viewportMode = useViewportMode();

  if (viewportMode === "pending") {
    return (
      <div data-ui="inventory-product-list-skeleton" data-ui-viewport="pending" aria-busy="true">
        <div className="space-y-2" aria-hidden="true">
          {Array.from({ length: 4 }, (_, index) => (
            <Skeleton key={index} className="h-[84px] rounded-2xl" />
          ))}
        </div>
      </div>
    );
  }

  return (
    <div data-ui="inventory-product-list-skeleton" aria-busy="true">
      {viewportMode === "compact" ? (
        <div className={cn(repairOs.listCardStack, "md:grid-cols-2")}>
          {Array.from({ length: 6 }, (_, index) => (
            <Skeleton key={index} className="h-[84px] rounded-2xl" />
          ))}
        </div>
      ) : (
        <div
          className="space-y-1.5 rounded-2xl border border-border bg-card p-2"
          aria-hidden="true"
        >
          <div className="grid grid-cols-[110px_minmax(0,1.5fr)_minmax(0,1fr)_120px_88px_36px] gap-3 px-3 py-2">
            {Array.from({ length: 6 }, (_, index) => (
              <Skeleton key={index} className="h-3" />
            ))}
          </div>
          {Array.from({ length: 6 }, (_, row) => (
            <div
              key={row}
              className="grid min-h-[52px] grid-cols-[110px_minmax(0,1.5fr)_minmax(0,1fr)_120px_88px_36px] items-center gap-3 px-3 py-1.5"
            >
              {Array.from({ length: 6 }, (_, cell) => (
                <Skeleton key={cell} className={cn("h-3", cell < 2 ? "w-3/4" : "w-2/3")} />
              ))}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function InventoryProductMessage({
  title,
  body,
  action,
}: {
  title: string;
  body: string;
  action?: React.ReactNode;
}) {
  return (
    <section className="grid min-h-[300px] place-items-center rounded-2xl border border-dashed border-border bg-card p-6 text-center">
      <div className="max-w-sm">
        <PackageOpen className="mx-auto mb-3 size-9 text-muted-foreground" />
        <h2 className="font-semibold">{title}</h2>
        <p className="mt-1 text-sm text-muted-foreground">{body}</p>
        {action ? <div className="mt-4 flex justify-center">{action}</div> : null}
      </div>
    </section>
  );
}
