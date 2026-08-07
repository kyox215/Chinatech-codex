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

import { inventoryProductsQueryOptions } from "../api/query-options";

const categoryMeta: Record<InventoryProductCategory, { label: string; icon: typeof Smartphone }> = {
  phone: { label: "手机", icon: Smartphone },
  tablet: { label: "平板", icon: Tablet },
  computer: { label: "电脑", icon: Laptop },
  game_console: { label: "游戏机", icon: Gamepad2 },
  other: { label: "其他", icon: PackageOpen },
};

const categoryTabs: Array<{
  key: "all" | InventoryProductCategory;
  label: string;
  icon: typeof Smartphone;
}> = [
  { key: "all", label: "全部", icon: PackageOpen },
  ...Object.entries(categoryMeta).map(([key, value]) => ({
    key: key as InventoryProductCategory,
    label: value.label,
    icon: value.icon,
  })),
];

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
    (filters.brands?.length ?? 0) +
    (filters.locations?.length ?? 0);
  const hasSelectedCategory = Boolean(filters.categories?.length);
  const hasActiveSelection = activeFilterCount > 0 || hasSelectedCategory;

  const createAction =
    shell.permissions?.canCreateInventory &&
    shell.permissions.inventoryProductsUiEnabled &&
    shell.permissions.inventoryProductQuickCreateEnabled ? (
      <Button asChild size="iconDense" className="size-11 rounded-lg" aria-label="快速录入商品">
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
        <div className="space-y-2">
          <div className="flex min-w-0 items-center gap-2">
            <div className="relative min-w-0 flex-1">
              <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                placeholder="搜索商品、SKU、型号"
                aria-label="搜索商品、SKU、型号"
                className="h-11 pl-9"
              />
            </div>
            <Button
              type="button"
              variant="outline"
              className="relative min-h-11 shrink-0 gap-2"
              aria-label={activeFilterCount ? `筛选，已应用 ${activeFilterCount} 项` : "筛选商品"}
              onClick={() => {
                setDraft(filters);
                setFilterOpen(true);
              }}
            >
              <Filter className="size-4" />
              筛选
              {activeFilterCount ? (
                <span className="grid min-w-5 place-items-center rounded-full bg-primary px-1 text-[10px] font-semibold leading-5 text-primary-foreground lg:text-[11px]">
                  {activeFilterCount}
                </span>
              ) : null}
            </Button>
          </div>
          <InventoryProductCategoryTabs
            filters={filters}
            onChange={(categories) => setFilters({ ...filters, categories })}
          />
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
          className="relative size-11 rounded-lg bg-card"
          aria-label={activeFilterCount ? `筛选，已应用 ${activeFilterCount} 项` : "筛选商品"}
          onClick={() => {
            setDraft(filters);
            setFilterOpen(true);
          }}
        >
          <Filter className="size-4" />
          {activeFilterCount ? (
            <span className="absolute -right-1 -top-1 grid size-5 place-items-center rounded-full bg-primary text-[10px] font-semibold text-primary-foreground lg:text-[11px] lg:leading-4">
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
      <div className="mb-2 lg:hidden">
        <InventoryProductCategoryTabs
          filters={filters}
          onChange={(categories) => setFilters({ ...filters, categories })}
        />
      </div>
      {activeFilterCount ? (
        <div className="mb-2 flex flex-wrap items-center gap-1.5" aria-live="polite">
          <span className="rounded-full bg-primary/10 px-2.5 py-1 text-[11px] font-medium text-primary lg:text-xs lg:leading-4">
            已应用 {activeFilterCount} 项筛选
          </span>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="min-h-11"
            onClick={() => setFilters({ categories: filters.categories })}
          >
            清除筛选
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
          title={
            hasSelectedCategory && !search && activeFilterCount === 0
              ? "当前分类暂无商品"
              : search || hasActiveSelection
                ? "没有符合条件的商品"
                : "还没有商品"
          }
          body={
            search || hasActiveSelection
              ? "更换搜索词或清除筛选。"
              : "录入手机、平板、电脑或游戏机。"
          }
          action={
            hasSelectedCategory && !search && activeFilterCount === 0 ? (
              <Button
                type="button"
                variant="outline"
                onClick={() => setFilters({ ...filters, categories: [] })}
              >
                查看全部
              </Button>
            ) : (
              createAction
            )
          }
        />
      ) : null}
      {query.data?.items.length ? <InventoryProductResults items={query.data.items} /> : null}

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

function InventoryProductResults({ items }: { items: InventoryProductListItem[] }) {
  return (
    <div
      data-inventory-product-shelf="true"
      className={cn(
        repairOs.listCardStack,
        "grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4",
      )}
    >
      {items.map((item) => (
        <InventoryProductCard key={item.id} item={item} />
      ))}
    </div>
  );
}

function InventoryProductCard({ item }: { item: InventoryProductListItem }) {
  const Icon = categoryMeta[item.category].icon;
  const [failedThumbnailUrl, setFailedThumbnailUrl] = useState<string>();
  const showThumbnail = Boolean(item.thumbnail_url && failedThumbnailUrl !== item.thumbnail_url);
  const imageAlt = [item.brand, item.model, item.specification, categoryMeta[item.category].label]
    .filter(Boolean)
    .join("，");
  return (
    <Link
      href={`/inventory/${item.id}`}
      data-ui="inventory-product-card"
      className={cn(
        repairOs.businessCardDense,
        "min-h-[104px] grid-cols-[86px_minmax(0,1fr)_auto] items-stretch gap-2 overflow-hidden p-2 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring md:flex md:min-h-0 md:flex-col md:gap-0 md:p-0",
      )}
    >
      <span className="relative grid size-[86px] shrink-0 place-items-center overflow-hidden rounded-xl bg-primary/10 text-primary md:aspect-[4/3] md:h-auto md:w-full md:rounded-b-none md:rounded-t-2xl">
        {showThumbnail ? (
          <img
            src={item.thumbnail_url}
            alt={imageAlt}
            loading="lazy"
            decoding="async"
            className="size-full object-contain"
            onError={() => setFailedThumbnailUrl(item.thumbnail_url)}
          />
        ) : null}
        {!showThumbnail ? (
          <span className="absolute inset-0 grid place-items-center gap-1 text-primary">
            <Icon className="size-7 md:size-10" aria-hidden="true" />
            <span className="text-[10px] leading-3 text-muted-foreground">暂无图片</span>
          </span>
        ) : null}
      </span>
      <span className="min-w-0 self-center py-0.5 md:w-full md:self-stretch md:px-3 md:pt-2.5">
        <span className="mb-1 flex min-w-0 items-center gap-1.5">
          <span className="block min-w-0 truncate text-xs font-semibold leading-4">
            {item.brand} {item.model}
          </span>
          <RepairOsBadge className={cn("shrink-0", statusStyles[item.status])}>
            {statusLabels[item.status]}
          </RepairOsBadge>
        </span>
        <span className="block truncate text-[10px] leading-4 text-muted-foreground lg:text-[11px] lg:leading-4">
          {item.specification || categoryMeta[item.category].label}
        </span>
        <span className="mt-0.5 block truncate font-mono text-[10px] leading-4 text-primary lg:text-[11px]">
          SKU {item.sku}
        </span>
        <span className="block truncate text-[10px] leading-4 text-muted-foreground lg:text-[11px] lg:leading-4">
          {[item.location, item.masked_identifier].filter(Boolean).join(" · ") || "暂无库位"}
        </span>
      </span>
      <span className="flex min-w-[64px] flex-col items-end justify-end self-stretch py-0.5 text-right md:mt-auto md:px-3 md:pb-3 md:pt-2">
        <span className="whitespace-nowrap text-xs font-semibold md:text-sm">
          {item.list_price === undefined ? "未填写" : <MoneyText amount={item.list_price} />}
        </span>
      </span>
    </Link>
  );
}

function InventoryProductCategoryTabs({
  filters,
  onChange,
}: {
  filters: InventoryProductListFilters;
  onChange: (categories: InventoryProductCategory[]) => void;
}) {
  const selectedCategories = filters.categories ?? [];
  const allSelected = selectedCategories.length === 0;
  return (
    <div
      data-ui="inventory-product-category-tabs"
      className="grid min-w-0 grid-cols-6 gap-1 rounded-xl border border-border bg-card p-1 shadow-sm"
      role="group"
      aria-label="商品分类"
    >
      {categoryTabs.map(({ key, label, icon: Icon }) => {
        const active =
          key === "all"
            ? allSelected
            : selectedCategories.length === 1 && selectedCategories[0] === key;
        return (
          <button
            key={key}
            type="button"
            className={cn(
              "flex min-h-11 min-w-0 items-center justify-center gap-0.5 rounded-lg px-0.5 text-[10px] font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring md:h-9 md:min-h-9 md:gap-1 md:px-1.5 md:text-[11px]",
              active
                ? "bg-primary text-primary-foreground"
                : "text-muted-foreground hover:bg-muted",
            )}
            aria-pressed={active}
            onClick={() => onChange(key === "all" ? [] : [key])}
          >
            <Icon className="size-3 shrink-0 md:size-3.5" aria-hidden="true" />
            <span className="truncate">{label}</span>
          </button>
        );
      })}
    </div>
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
          <SheetDescription>按状态、品牌或库位缩小结果。</SheetDescription>
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
          <Button
            type="button"
            variant="outline"
            className="min-h-11"
            onClick={() => onDraftChange({ categories: draft.categories })}
          >
            重置
          </Button>
          <SheetClose asChild>
            <Button type="button" className="min-h-11" onClick={onApply}>
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
                "flex min-h-11 cursor-pointer items-center gap-2 rounded-lg border px-2.5 py-1.5",
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
  return (
    <div data-ui="inventory-product-list-skeleton" aria-busy="true">
      <div
        className={cn(
          repairOs.listCardStack,
          "grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4",
        )}
        aria-hidden="true"
      >
        {Array.from({ length: 8 }, (_, index) => (
          <div
            key={index}
            className="grid min-h-[104px] grid-cols-[86px_minmax(0,1fr)_64px] items-center gap-2 overflow-hidden rounded-2xl border border-border bg-card p-2 md:flex md:min-h-0 md:flex-col md:gap-0 md:p-0"
          >
            <Skeleton className="size-[86px] rounded-xl md:aspect-[4/3] md:h-auto md:w-full md:rounded-b-none md:rounded-t-2xl" />
            <span className="space-y-1.5 md:w-full md:px-3 md:pt-2.5">
              <Skeleton className="h-3.5 w-4/5" />
              <Skeleton className="h-3 w-3/5" />
              <Skeleton className="h-2.5 w-2/3" />
              <Skeleton className="h-2.5 w-1/2" />
            </span>
            <Skeleton className="h-3 w-14 justify-self-end md:mb-3 md:mr-3 md:mt-2 md:self-end" />
          </div>
        ))}
      </div>
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
