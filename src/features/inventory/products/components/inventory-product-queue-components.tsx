"use client";

import Link from "next/link";
import { useState, type ComponentType, type ReactNode } from "react";
import {
  Gamepad2,
  Laptop,
  LayoutGrid,
  List as ListIcon,
  PackageOpen,
  Smartphone,
  Tablet,
} from "lucide-react";

import { Skeleton } from "@/components/ui/skeleton";
import type {
  InventoryLifecycleProjectionStatus,
  InventoryProductCategory,
  InventoryProductDisplayStatus,
  InventoryProductListFilters,
  InventoryProductListItem,
} from "@/lib/repairdesk/types";
import { repairOs } from "@/lib/ui-patterns";
import { cn } from "@/lib/utils";
import {
  InventoryLifecycleProjectionBadge,
  InventoryLifecycleProjectionStatusIcon,
} from "@/features/inventory/lifecycle/components/inventory-lifecycle-status";
import {
  getInventoryLifecycleProjectionMeta,
  inventoryLifecycleProjectionStatusMeta,
  projectCompatibleInventoryLifecycle,
} from "@/features/inventory/lifecycle/model/projection";
import { MoneyText } from "@/shared/ui";

import {
  inventoryProductColorStyle,
  matchInventoryProductColor,
  matchInventoryProductReference,
  type InventoryProductReferenceImage,
} from "../../model/inventory-product-reference-image";

export type InventoryProductView = "shelf" | "list";

/**
 * Inventory-only parity contract for the shared list scaffold.
 *
 * RepairOS keeps its compact scaffold intentionally dense (36px by default),
 * while inventory search is a primary mobile control and must retain a 44px
 * hit target. Keep this selector owned by the inventory queue module so the
 * runtime screen and Storybook use the exact same contract without changing
 * the shared RepairOS scaffold for other feature families.
 */
export const inventoryProductListScaffoldClassName =
  '[&_[data-ui="repair-os-list-search-row"]>div:first-child]:!h-11 [&_[data-ui="repair-os-list-search-row"]>div:first-child>input]:!h-11';

export type InventoryLifecycleShortcut =
  | "all"
  | "in_stock"
  | "reserved"
  | "sold_pending_pickup"
  | "processing";

export function isInventoryProductView(value: string | null): value is InventoryProductView {
  return value === "shelf" || value === "list";
}

export const categoryMeta: Record<
  InventoryProductCategory,
  { label: string; icon: ComponentType<{ className?: string }> }
> = {
  phone: { label: "手机", icon: Smartphone },
  tablet: { label: "平板", icon: Tablet },
  computer: { label: "电脑", icon: Laptop },
  game_console: { label: "游戏机", icon: Gamepad2 },
  other: { label: "其他", icon: PackageOpen },
};

export const categoryTabs: Array<{
  key: "all" | InventoryProductCategory;
  label: string;
  icon: ComponentType<{ className?: string }>;
}> = [
  { key: "all", label: "全部", icon: PackageOpen },
  ...Object.entries(categoryMeta).map(([key, value]) => ({
    key: key as InventoryProductCategory,
    label: value.label,
    icon: value.icon,
  })),
];

export const statusLabels: Record<InventoryProductDisplayStatus, string> = {
  in_stock: "在库",
  reserved: "已预留",
  sold: "已售",
  removed: "已移除",
  returned: "已退回",
};

export function InventoryLifecycleShortcutBar({
  value,
  counts,
  onChange,
}: {
  value: InventoryLifecycleShortcut;
  counts?: Partial<Record<InventoryLifecycleProjectionStatus, number>>;
  onChange: (value: InventoryLifecycleShortcut) => void;
}) {
  const shortcuts = [
    { key: "in_stock" as const, label: "在售", statuses: ["in_stock"] as const },
    { key: "reserved" as const, label: "预订", statuses: ["reserved"] as const },
    {
      key: "sold_pending_pickup" as const,
      label: "待取",
      statuses: ["sold_pending_pickup"] as const,
    },
    {
      key: "processing" as const,
      label: "处理",
      statuses: ["processing", "after_sales"] as const,
    },
  ];
  return (
    <div
      data-ui="inventory-lifecycle-shortcuts"
      className="mb-2 grid min-w-0 grid-cols-2 gap-1.5 min-[360px]:grid-cols-4"
      role="group"
      aria-label="生命周期工作入口"
    >
      {shortcuts.map(({ key, label, statuses }) => {
        const count = statuses.reduce((total, status) => total + (counts?.[status] ?? 0), 0);
        const hasCount = statuses.some((status) => counts?.[status] !== undefined);
        const meta = inventoryLifecycleProjectionStatusMeta[statuses[0]];
        return (
          <button
            key={key}
            type="button"
            className={cn(
              "flex min-h-11 min-w-0 items-center justify-center gap-1 rounded-xl border px-2 text-xs font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
              value === key
                ? "border-primary bg-primary text-primary-foreground"
                : "border-border bg-card text-muted-foreground hover:bg-muted",
            )}
            aria-pressed={value === key}
            onClick={() => onChange(value === key ? "all" : key)}
          >
            <InventoryLifecycleProjectionStatusIcon
              status={statuses[0]}
              className={value === key ? "text-primary-foreground" : undefined}
            />
            <span className="truncate">{label}</span>
            {hasCount ? <span className="font-mono text-[10px]">{count}</span> : null}
            <span className="sr-only">{meta.description}</span>
          </button>
        );
      })}
    </div>
  );
}

export function InventoryProductResults({
  items,
  view,
}: {
  items: InventoryProductListItem[];
  view: InventoryProductView;
}) {
  const shelf = view === "shelf";
  return (
    <div
      data-inventory-product-shelf="true"
      data-inventory-product-view={view}
      className={cn(
        repairOs.listCardStack,
        shelf ? "grid-cols-2 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4" : "grid-cols-1",
      )}
    >
      {items.map((item) => (
        <InventoryProductCard key={item.id} item={item} view={view} />
      ))}
    </div>
  );
}

export function InventoryProductCard({
  item,
  view,
}: {
  item: InventoryProductListItem;
  view: InventoryProductView;
}) {
  const Icon = categoryMeta[item.category].icon;
  const [failedImageUrls, setFailedImageUrls] = useState<string[]>([]);
  const reference = matchInventoryProductReference(item);
  const colorMatch = matchInventoryProductColor(item);
  const specification = inventoryProductSpecification(item.specification, colorMatch);
  const uploadedThumbnailUrl = safeInventoryProductThumbnailUrl(item.thumbnail_url);
  const activeImage = resolveInventoryProductImage(
    uploadedThumbnailUrl,
    reference,
    failedImageUrls,
  );
  const imageAlt = [item.brand, item.model, item.specification, categoryMeta[item.category].label]
    .filter(Boolean)
    .join("，");
  const shelf = view === "shelf";
  const lifecycle =
    item.lifecycle ?? projectCompatibleInventoryLifecycle(item.legacy_status ?? item.status);
  const lifecycleMeta = getInventoryLifecycleProjectionMeta(
    lifecycle,
    item.legacy_status ?? item.status,
  );
  const auxiliaryLabels = lifecycleAuxiliaryLabels(lifecycle);
  return (
    <Link
      href={`/inventory/${item.id}`}
      data-ui="inventory-product-card"
      className={cn(
        repairOs.businessCardDense,
        shelf
          ? "flex min-h-0 flex-col gap-0 overflow-hidden p-0 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          : "min-h-[104px] grid-cols-[86px_minmax(0,1fr)_auto] items-stretch gap-2 overflow-hidden p-2 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring md:flex md:flex-row md:items-stretch md:gap-2 md:p-2",
      )}
    >
      <span
        className={cn(
          "relative grid size-[86px] shrink-0 place-items-center overflow-hidden rounded-xl bg-primary/10 text-primary",
          shelf
            ? "aspect-[4/3] h-auto w-full rounded-b-none rounded-t-2xl"
            : "md:size-[86px] md:aspect-square",
        )}
      >
        {activeImage ? (
          <img
            src={activeImage.url}
            alt={activeImage.isReference ? activeImage.reference.alt : imageAlt}
            loading="lazy"
            decoding="async"
            className="size-full object-contain"
            onError={() =>
              setFailedImageUrls((current) =>
                current.includes(activeImage.url) ? current : [...current, activeImage.url],
              )
            }
          />
        ) : null}
        {activeImage?.isReference ? (
          <span
            className="absolute left-1.5 top-1.5 rounded-full border border-border bg-card px-1.5 py-0.5 text-xs font-semibold leading-4 text-foreground shadow-sm"
            aria-label="参考图"
          >
            参考图
          </span>
        ) : null}
        {!activeImage ? (
          <span className="absolute inset-0 grid place-items-center gap-1 text-primary">
            <Icon className="size-7 md:size-10" aria-hidden="true" />
            <span className="text-[10px] leading-3 text-muted-foreground">暂无图片</span>
          </span>
        ) : null}
      </span>
      <span
        className={cn(
          "min-w-0 self-center py-0.5",
          shelf ? "w-full self-stretch px-2.5 pt-2.5" : "md:flex-1 md:self-center md:px-0 md:pt-0",
        )}
      >
        <span className="mb-1 flex min-w-0 items-center gap-1.5">
          <span className="block min-w-0 truncate text-xs font-semibold leading-4">
            {item.brand} {item.model}
          </span>
          <InventoryLifecycleProjectionBadge
            projection={lifecycle}
            legacyStatus={item.status}
            className="shrink-0"
          />
        </span>
        <span className="flex min-w-0 items-center gap-1.5 truncate text-[10px] leading-4 text-muted-foreground lg:text-[11px] lg:leading-4">
          <span className="min-w-0 truncate">
            {specification || categoryMeta[item.category].label}
          </span>
          {colorMatch ? <InventoryProductColor color={colorMatch} /> : null}
        </span>
        <span className="mt-0.5 block truncate font-mono text-[10px] leading-4 text-primary lg:text-[11px]">
          SKU {item.sku}
        </span>
        <span className="block truncate text-[10px] leading-4 text-muted-foreground lg:text-[11px] lg:leading-4">
          {[item.location, item.masked_identifier].filter(Boolean).join(" · ") || "暂无库位"}
        </span>
        {auxiliaryLabels.length ? (
          <span className="mt-1 flex min-w-0 flex-wrap gap-1">
            {auxiliaryLabels.map((label) => (
              <span
                key={label}
                className="max-w-full truncate rounded-full bg-[var(--surface-panel-muted)] px-1.5 py-0.5 text-[9px] leading-3 text-muted-foreground"
              >
                {label}
              </span>
            ))}
          </span>
        ) : null}
        <span className="mt-1 flex min-w-0 items-center gap-1 text-[9px] leading-3 text-muted-foreground">
          <span className="size-1 shrink-0 rounded-full bg-primary" aria-hidden="true" />
          <span className="truncate">{lifecycleMeta.nextStep ?? "暂无下一步"}</span>
        </span>
      </span>
      <span
        className={cn(
          "flex min-w-[64px] flex-col items-end justify-end self-stretch py-0.5 text-right",
          shelf ? "mt-auto px-2.5 pb-2.5 pt-1.5" : "md:mt-0 md:self-center md:px-2 md:py-0",
        )}
      >
        {lifecycle.mode === "exact" && lifecycle.balance !== undefined ? (
          <span className="whitespace-nowrap text-[10px] font-semibold text-muted-foreground md:text-xs">
            尾款 <MoneyText amount={lifecycle.balance} />
          </span>
        ) : null}
        <span className="whitespace-nowrap text-xs font-semibold md:text-sm">
          {item.list_price === undefined ? "未填写" : <MoneyText amount={item.list_price} />}
        </span>
      </span>
    </Link>
  );
}

export function lifecycleAuxiliaryLabels(
  lifecycle: NonNullable<InventoryProductListItem["lifecycle"]>,
) {
  const labels: string[] = [];
  if (lifecycle.needs_review) labels.push("需核对");
  if (lifecycle.mode === "exact" && lifecycle.after_sales_status) {
    labels.push(
      {
        open: "待检测",
        in_progress: "处理中",
        waiting_customer: "等客户",
        returned: "已返还",
        closed: "已关闭",
      }[lifecycle.after_sales_status],
    );
  }
  if (lifecycle.mode === "exact" && lifecycle.expected_pickup_at) labels.push("已安排取走");
  return labels.slice(0, 2);
}

export function resolveInventoryProductImage(
  uploadedThumbnailUrl: string | undefined,
  reference: InventoryProductReferenceImage | undefined,
  failedImageUrls: readonly string[],
) {
  if (uploadedThumbnailUrl && !failedImageUrls.includes(uploadedThumbnailUrl)) {
    return { url: uploadedThumbnailUrl, isReference: false as const };
  }
  if (reference && !failedImageUrls.includes(reference.src)) {
    return { url: reference.src, isReference: true as const, reference };
  }
  return undefined;
}

export function safeInventoryProductThumbnailUrl(value: string | undefined) {
  const candidate = value?.trim();
  if (!candidate) return undefined;
  return /^\/api\/repairdesk\/inventory\/product-thumbnails\/[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/iu.test(
    candidate,
  )
    ? candidate
    : undefined;
}

export function InventoryProductColor({
  color,
}: {
  color: ReturnType<typeof matchInventoryProductColor>;
}) {
  if (!color) return null;
  if (!color.option) {
    return (
      <span className="shrink-0 truncate" title={`颜色：${color.value}`}>
        {color.value}
      </span>
    );
  }
  return (
    <span
      className="inline-flex max-w-[45%] shrink-0 items-center gap-1 truncate text-foreground"
      title={`目录颜色：${color.option.name}`}
      aria-label={`颜色 ${color.option.name}`}
      role="img"
    >
      <span
        className="size-2.5 shrink-0 rounded-full border border-border/70"
        style={inventoryProductColorStyle(color.option)}
        aria-hidden="true"
      />
      <span className="truncate">{color.option.name}</span>
    </span>
  );
}

export function inventoryProductSpecification(
  specification: string | undefined,
  color: ReturnType<typeof matchInventoryProductColor>,
) {
  if (!specification || !color) return specification;
  const colorLabels = [color.value, color.option?.id, color.option?.name]
    .filter((value): value is string => Boolean(value))
    .map(normalizedProductLabel);
  return specification
    .split(/[·|,，]/u)
    .map((value) => value.trim())
    .filter((value) => value && !colorLabels.includes(normalizedProductLabel(value)))
    .join(" · ");
}

export function normalizedProductLabel(value: string) {
  return value
    .trim()
    .toLocaleLowerCase("en-US")
    .normalize("NFKC")
    .replace(/[^\p{L}\p{N}]+/gu, "")
    .replace(/色$/u, "");
}

export function InventoryProductViewToggle({
  value,
  onChange,
}: {
  value: InventoryProductView;
  onChange: (value: InventoryProductView) => void;
}) {
  return (
    <div
      data-ui="inventory-product-view-toggle"
      role="group"
      aria-label="商品列表视图"
      className="grid h-11 w-[88px] shrink-0 grid-cols-2 overflow-hidden rounded-lg bg-card shadow-sm ring-1 ring-inset ring-border"
    >
      <button
        type="button"
        className={cn(
          "grid min-h-11 min-w-0 place-items-center rounded-md text-muted-foreground transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring",
          value === "shelf" && "bg-primary text-primary-foreground",
        )}
        aria-label="智能货架视图"
        aria-pressed={value === "shelf"}
        onClick={() => onChange("shelf")}
      >
        <LayoutGrid className="size-4" aria-hidden="true" />
        <span className="sr-only">智能货架</span>
      </button>
      <button
        type="button"
        className={cn(
          "grid min-h-11 min-w-0 place-items-center rounded-md text-muted-foreground transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring",
          value === "list" && "bg-primary text-primary-foreground",
        )}
        aria-label="紧凑列表视图"
        aria-pressed={value === "list"}
        onClick={() => onChange("list")}
      >
        <ListIcon className="size-4" aria-hidden="true" />
        <span className="sr-only">紧凑列表</span>
      </button>
    </div>
  );
}

export function InventoryProductCategoryTabs({
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
      className="grid min-w-0 grid-cols-[repeat(auto-fit,minmax(min(100%,7rem),1fr))] gap-1.5 rounded-xl border border-border bg-card p-1.5 shadow-sm"
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
              "flex min-h-11 min-w-11 items-center justify-center gap-1 rounded-lg px-2 text-xs font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring sm:text-sm",
              active
                ? "bg-primary text-primary-foreground"
                : "text-muted-foreground hover:bg-muted",
            )}
            aria-pressed={active}
            onClick={() => onChange(key === "all" ? [] : [key])}
          >
            <Icon className="size-4 shrink-0" aria-hidden="true" />
            <span className="truncate">{label}</span>
          </button>
        );
      })}
    </div>
  );
}

export function InventoryProductListSkeleton() {
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

export function InventoryProductMessage({
  title,
  body,
  action,
}: {
  title: string;
  body: string;
  action?: ReactNode;
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
