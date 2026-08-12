"use client";

import { useCallback, useDeferredValue, useEffect, useMemo, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Filter, Plus, RefreshCw, Search } from "lucide-react";

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
import { useStoreShellContext } from "@/features/stores/api/use-store-shell-context";
import { inventoryLifecycleProjectionStatusMeta } from "@/features/inventory/lifecycle/model/projection";
import type {
  InventoryProductDisplayStatus,
  InventoryProductListFilters,
  InventoryLifecycleProjectionStatus,
} from "@/lib/repairdesk/types";
import { cn } from "@/lib/utils";
import { RepairOsListScaffold } from "@/shared/ui";

import { inventoryProductsQueryOptions } from "../api/query-options";
import { inventoryProductKeys } from "../api/query-keys";
import { InventoryProductCreateDialog } from "../components/inventory-product-create-dialog";
import {
  InventoryLifecycleShortcutBar,
  InventoryProductCategoryTabs,
  InventoryProductListSkeleton,
  InventoryProductMessage,
  InventoryProductResults,
  InventoryProductViewToggle,
  isInventoryProductView,
  statusLabels,
  type InventoryLifecycleShortcut,
  type InventoryProductView,
} from "../components/inventory-product-queue-components";

const INVENTORY_PRODUCT_VIEW_STORAGE_KEY = "repairdesk.inventory.product-view";

export function InventoryProductListScreen() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const queryClient = useQueryClient();
  const shell = useStoreShellContext();
  const storeId = shell.activeStore?.id;
  const [search, setSearch] = useState("");
  const deferredSearch = useDeferredValue(search);
  const [filterOpen, setFilterOpen] = useState(false);
  const [filters, setFilters] = useState<InventoryProductListFilters>({});
  const [draft, setDraft] = useState<InventoryProductListFilters>({});
  const [lifecycleStatusFilter, setLifecycleStatusFilter] = useState<
    InventoryLifecycleProjectionStatus[]
  >([]);
  const [draftLifecycleStatusFilter, setDraftLifecycleStatusFilter] = useState<
    InventoryLifecycleProjectionStatus[]
  >([]);
  const [view, setView] = useState<InventoryProductView>("shelf");
  const [viewReady, setViewReady] = useState(false);
  const [createOpen, setCreateOpen] = useState(false);
  const [createSessionKey, setCreateSessionKey] = useState(0);
  const handledCreateIntentRef = useRef<string | undefined>(undefined);
  useEffect(() => {
    try {
      const stored = window.localStorage.getItem(INVENTORY_PRODUCT_VIEW_STORAGE_KEY);
      if (isInventoryProductView(stored)) setView(stored);
    } catch {
      // Private browsing and disabled storage should keep the SSR-safe shelf default.
    } finally {
      setViewReady(true);
    }
  }, []);
  useEffect(() => {
    if (!viewReady) return;
    try {
      window.localStorage.setItem(INVENTORY_PRODUCT_VIEW_STORAGE_KEY, view);
    } catch {
      // View preference is optional and must never block the inventory page.
    }
  }, [view, viewReady]);
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
  const lifecycleExact = query.data?.lifecycle_projection?.mode === "exact";
  const lifecycleShortcut: InventoryLifecycleShortcut =
    lifecycleStatusFilter.length === 1 && lifecycleStatusFilter[0] === "in_stock"
      ? "in_stock"
      : lifecycleStatusFilter.length === 1 && lifecycleStatusFilter[0] === "reserved"
        ? "reserved"
        : lifecycleStatusFilter.length === 1 && lifecycleStatusFilter[0] === "sold_pending_pickup"
          ? "sold_pending_pickup"
          : lifecycleStatusFilter.length > 0 &&
              lifecycleStatusFilter.every((status) =>
                ["processing", "after_sales"].includes(status),
              )
            ? "processing"
            : "all";
  const displayItems = useMemo(() => {
    const items = query.data?.items ?? [];
    if (!lifecycleExact || !lifecycleStatusFilter.length) return items;
    return items.filter(
      (item) =>
        item.lifecycle?.mode === "exact" && lifecycleStatusFilter.includes(item.lifecycle.status),
    );
  }, [lifecycleExact, lifecycleStatusFilter, query.data?.items]);
  const activeFilterCount =
    (filters.statuses?.length ?? 0) +
    (filters.brands?.length ?? 0) +
    (filters.locations?.length ?? 0) +
    (lifecycleExact ? lifecycleStatusFilter.length : 0);
  const hasSelectedCategory = Boolean(filters.categories?.length);
  const hasActiveSelection = activeFilterCount > 0 || hasSelectedCategory;
  const canCreateProduct = Boolean(
    shell.permissions?.canCreateInventory &&
    shell.permissions.inventoryProductsUiEnabled &&
    shell.permissions.inventoryProductQuickCreateEnabled,
  );

  useEffect(() => {
    if (!lifecycleExact && lifecycleStatusFilter.length) setLifecycleStatusFilter([]);
  }, [lifecycleExact, lifecycleStatusFilter.length]);

  const clearCreateIntent = useCallback(() => {
    if (searchParams.get("workspace") !== "new-product") return;
    const nextParams = new URLSearchParams(searchParams.toString());
    nextParams.delete("workspace");
    const query = nextParams.toString();
    router.replace(query ? `/inventory?${query}` : "/inventory", { scroll: false });
  }, [router, searchParams]);

  const openCreate = useCallback(() => {
    if (!canCreateProduct || shell.isLoading) return;
    setFilterOpen(false);
    setCreateSessionKey((current) => current + 1);
    setCreateOpen(true);
  }, [canCreateProduct, shell.isLoading]);

  const handleCreateOpenChange = useCallback(
    (nextOpen: boolean) => {
      if (nextOpen) {
        openCreate();
        return;
      }
      setCreateOpen(false);
      clearCreateIntent();
    },
    [clearCreateIntent, openCreate],
  );

  useEffect(() => {
    if (searchParams.get("workspace") !== "new-product") {
      handledCreateIntentRef.current = undefined;
      return;
    }
    if (shell.isLoading) return;
    const intentKey = searchParams.toString();
    if (handledCreateIntentRef.current === intentKey) return;
    handledCreateIntentRef.current = intentKey;
    if (!canCreateProduct) {
      clearCreateIntent();
      return;
    }
    openCreate();
  }, [canCreateProduct, clearCreateIntent, openCreate, searchParams, shell.isLoading]);

  const handleProductCreated = useCallback(
    async (id: string) => {
      await queryClient.invalidateQueries({
        queryKey: inventoryProductKeys.listsForStore(storeId),
      });
      router.push(`/inventory/${id}`);
    },
    [queryClient, router, storeId],
  );

  const createAction = canCreateProduct ? (
    <Button
      type="button"
      size="iconDense"
      className="size-11 rounded-lg"
      aria-label="快速录入商品"
      data-inventory-product-create-trigger="true"
      onClick={openCreate}
    >
      <Plus className="size-5" />
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
      className='[&_[data-ui="repair-os-list-search-row"]>div:first-child]:!h-11 [&_[data-ui="repair-os-list-search-row"]>div:first-child>input]:!h-11'
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
            <InventoryProductViewToggle value={view} onChange={setView} />
            <Button
              type="button"
              variant="outline"
              className="relative min-h-11 shrink-0 gap-2"
              aria-label={activeFilterCount ? `筛选，已应用 ${activeFilterCount} 项` : "筛选商品"}
              onClick={() => {
                setDraft(filters);
                setDraftLifecycleStatusFilter(lifecycleStatusFilter);
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
        <div className="flex min-w-0 shrink-0 items-center gap-1">
          <InventoryProductViewToggle value={view} onChange={setView} />
          <Button
            type="button"
            variant="outline"
            size="icon"
            className="relative size-11 rounded-lg bg-card"
            aria-label={activeFilterCount ? `筛选，已应用 ${activeFilterCount} 项` : "筛选商品"}
            onClick={() => {
              setDraft(filters);
              setDraftLifecycleStatusFilter(lifecycleStatusFilter);
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
        </div>
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
      {lifecycleExact ? (
        <InventoryLifecycleShortcutBar
          value={lifecycleShortcut}
          counts={query.data?.lifecycle_projection?.counts}
          onChange={(shortcut) => {
            setLifecycleStatusFilter(
              shortcut === "all"
                ? []
                : shortcut === "processing"
                  ? ["processing", "after_sales"]
                  : [shortcut],
            );
          }}
        />
      ) : null}
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
            onClick={() => {
              setFilters({ categories: filters.categories });
              setLifecycleStatusFilter([]);
            }}
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
      {query.isSuccess && displayItems.length === 0 ? (
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
      {displayItems.length ? <InventoryProductResults items={displayItems} view={view} /> : null}

      <InventoryProductFilterSheet
        open={filterOpen}
        onOpenChange={setFilterOpen}
        draft={draft}
        onDraftChange={setDraft}
        brands={query.data?.facets.brands ?? []}
        locations={query.data?.facets.locations ?? []}
        lifecycleExact={lifecycleExact}
        lifecycleStatuses={draftLifecycleStatusFilter}
        onLifecycleStatusesChange={setDraftLifecycleStatusFilter}
        onApply={() => {
          setFilters(draft);
          setLifecycleStatusFilter(draftLifecycleStatusFilter);
          setFilterOpen(false);
        }}
      />
      <InventoryProductCreateDialog
        open={createOpen}
        sessionKey={createSessionKey}
        onOpenChange={handleCreateOpenChange}
        onCreated={handleProductCreated}
      />
    </RepairOsListScaffold>
  );
}

function InventoryProductFilterSheet({
  open,
  onOpenChange,
  draft,
  onDraftChange,
  brands,
  locations,
  lifecycleExact,
  lifecycleStatuses,
  onLifecycleStatusesChange,
  onApply,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  draft: InventoryProductListFilters;
  onDraftChange: (filters: InventoryProductListFilters) => void;
  brands: string[];
  locations: string[];
  lifecycleExact: boolean;
  lifecycleStatuses: InventoryLifecycleProjectionStatus[];
  onLifecycleStatusesChange: (statuses: InventoryLifecycleProjectionStatus[]) => void;
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
          {lifecycleExact ? (
            <FilterGroup
              title="精确状态"
              values={Object.keys(inventoryLifecycleProjectionStatusMeta)}
              selected={lifecycleStatuses}
              labels={Object.fromEntries(
                Object.entries(inventoryLifecycleProjectionStatusMeta).map(([key, meta]) => [
                  key,
                  meta.label,
                ]),
              )}
              onChange={(values) =>
                onLifecycleStatusesChange(values as InventoryLifecycleProjectionStatus[])
              }
            />
          ) : (
            <FilterGroup
              title="状态"
              values={Object.keys(statusLabels)}
              selected={draft.statuses ?? []}
              labels={statusLabels}
              onChange={(values) =>
                onDraftChange({ ...draft, statuses: values as InventoryProductDisplayStatus[] })
              }
            />
          )}
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
            onClick={() => {
              onDraftChange({ categories: draft.categories });
              onLifecycleStatusesChange([]);
            }}
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
