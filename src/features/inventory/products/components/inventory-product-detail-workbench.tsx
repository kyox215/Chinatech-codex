"use client";

import { useEffect, useRef, useState, type CSSProperties } from "react";
import { ArrowLeft, Gamepad2, Laptop, PackageOpen, Pencil, Smartphone, Tablet } from "lucide-react";

import { Button } from "@/components/ui/button";
import type {
  InventoryProductCategory,
  InventoryProductDetail,
  InventoryProductInspectionSummary,
  InventoryProductDisplayStatus,
} from "@/lib/repairdesk/types";
import { repairOs } from "@/lib/ui-patterns";
import { cn } from "@/lib/utils";
import { MoneyText } from "@/shared/ui";
import type { InventoryLifecycleListSummary } from "@/lib/repairdesk/types";

import {
  getInventoryLifecycleProjectionToneClass,
  InventoryDeviceHealthCard,
  InventoryLifecycleHistoryCard,
  InventoryLifecycleSummaryCard,
  InventoryLifecycleUnavailableCard,
} from "@/features/inventory/lifecycle/components/inventory-lifecycle-status";
import { getInventoryLifecycleProjectionMeta } from "@/features/inventory/lifecycle/model/projection";
import { InventoryLifecycleLoadingCard } from "@/features/inventory/lifecycle/components/inventory-lifecycle-page-shell";
import { InventoryInspectionEditor } from "@/features/inventory/lifecycle/forms/inventory-inspection-editor";

import {
  buildWorkbenchFields,
  DeviceIdentitySection,
  DeviceWorkbenchSection,
  ProductBusinessSection,
  ProductHeroCard,
  ProductNotesSection,
  type ProductSummaryField,
  type VisibleIdentifier,
} from "./inventory-product-detail-sections";

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

const statusStyles: Record<InventoryProductDisplayStatus, string> = {
  in_stock: "bg-status-success text-status-success-foreground",
  reserved: "bg-status-warn text-status-warn-foreground",
  sold: "bg-status-neutral text-status-neutral-foreground",
  removed: "bg-destructive/10 text-destructive",
  returned: "bg-status-info text-status-info-foreground",
};

type LifecycleInspection = NonNullable<InventoryLifecycleListSummary["inspection"]>;

function mergeInspectionFacts(
  itemInspection?: InventoryProductInspectionSummary,
  lifecycleInspection?: InventoryLifecycleListSummary["inspection"],
): LifecycleInspection | undefined {
  if (!itemInspection && !lifecycleInspection) return undefined;
  const baseline: LifecycleInspection = lifecycleInspection ?? {
    battery_health: itemInspection?.battery_health ?? null,
    face_id_status: itemInspection?.face_id_status ?? "not_tested",
    touch_id_status: "not_tested",
    true_tone_status: "not_tested",
    activation_lock_status: "not_tested",
    data_wipe_status: "not_tested",
    imei_status: "not_tested",
    inspected_at: itemInspection?.inspected_at ?? new Date(0).toISOString(),
  };
  if (!itemInspection) return baseline;
  return {
    ...baseline,
    battery_health: itemInspection.battery_health,
    face_id_status: itemInspection.face_id_status,
    inspected_at: itemInspection.inspected_at,
  };
}

function createUninspectedHealthSummary(inspectedAt: string): LifecycleInspection {
  return {
    battery_health: null,
    face_id_status: "not_tested",
    touch_id_status: "not_tested",
    true_tone_status: "not_tested",
    activation_lock_status: "not_tested",
    data_wipe_status: "not_tested",
    imei_status: "not_tested",
    inspected_at: inspectedAt,
  };
}

export function InventoryProductDetailWorkbench({
  item,
  lifecycleSummary,
  lifecycleSummaryState,
  canEdit,
  onBack,
  onEdit,
}: {
  item: InventoryProductDetail;
  lifecycleSummary?: InventoryLifecycleListSummary | null;
  lifecycleSummaryState?: "loading" | "ready" | "unavailable" | "dormant";
  canEdit: boolean;
  onBack: () => void;
  onEdit: () => void;
}) {
  const mobileHeaderRef = useRef<HTMLDivElement | null>(null);
  const [mobileHeaderHeight, setMobileHeaderHeight] = useState(0);
  const meta = categories[item.category];
  const identifiers = item.identifiers ?? [];
  const visibleIdentifiers: VisibleIdentifier[] = identifiers.length
    ? identifiers
    : item.masked_identifier
      ? [{ kind: "identifier", masked_value: item.masked_identifier }]
      : [];

  useEffect(() => {
    document.body.dataset.mobileWorkspaceActive = "true";
    return () => {
      delete document.body.dataset.mobileWorkspaceActive;
    };
  }, []);

  useEffect(() => {
    const header = mobileHeaderRef.current;
    if (!header) return;
    const updateHeaderHeight = () => {
      setMobileHeaderHeight(Math.ceil(header.getBoundingClientRect().height));
    };
    updateHeaderHeight();
    const observer = new ResizeObserver(updateHeaderHeight);
    observer.observe(header);
    window.addEventListener("resize", updateHeaderHeight);
    return () => {
      observer.disconnect();
      window.removeEventListener("resize", updateHeaderHeight);
    };
  }, [item.id]);

  const summaryFields: ProductSummaryField[] = [];
  const exactProjection =
    lifecycleSummary?.projection?.mode === "exact" ? lifecycleSummary.projection : undefined;
  const inspection = mergeInspectionFacts(item.inspection, lifecycleSummary?.inspection);
  const healthInspection =
    inspection ??
    (item.brand.trim().toLowerCase() === "apple" ? createUninspectedHealthSummary("") : undefined);
  const lifecycleSummaryWithInspection = lifecycleSummary
    ? { ...lifecycleSummary, ...(inspection ? { inspection } : {}) }
    : undefined;
  const lifecycleMeta = exactProjection
    ? getInventoryLifecycleProjectionMeta(exactProjection, item.legacy_status ?? item.status)
    : undefined;
  summaryFields.push({
    label: "售价",
    value: item.list_price === undefined ? "未定价" : <MoneyText amount={item.list_price} />,
  });
  summaryFields.push({ label: "库位", value: item.location?.trim() || "未设置库位" });

  return (
    <main
      data-ui="inventory-product-detail-workbench"
      className={cn(
        repairOs.mobileFloatingPage,
        "mx-auto w-full max-w-[430px] overflow-x-hidden px-2 pb-20 pt-[var(--repair-os-mobile-floating-offset,5.25rem)] lg:max-w-5xl lg:px-0 lg:pb-8 lg:pt-0",
      )}
      style={
        mobileHeaderHeight
          ? ({
              "--repair-os-mobile-floating-offset": `${mobileHeaderHeight}px`,
            } as CSSProperties)
          : undefined
      }
    >
      <MobileProductHeader
        headerRef={mobileHeaderRef}
        item={item}
        categoryLabel={meta.label}
        statusLabel={lifecycleMeta?.label ?? statuses[item.status]}
        canEdit={canEdit}
        onBack={onBack}
        onEdit={onEdit}
      />

      <div>
        <DesktopProductHeader
          item={item}
          statusLabel={lifecycleMeta?.label ?? statuses[item.status]}
          canEdit={canEdit}
          onEdit={onEdit}
        />
        <div className="grid min-w-0 gap-1.5 lg:grid-cols-[minmax(300px,0.82fr)_minmax(0,1.18fr)] lg:items-start lg:gap-3">
          <div className="grid min-w-0 content-start gap-1.5 lg:gap-3">
            <ProductHeroCard
              item={item}
              icon={meta.icon}
              statusLabel={lifecycleMeta?.label ?? statuses[item.status]}
              statusClassName={
                exactProjection
                  ? getInventoryLifecycleProjectionToneClass(lifecycleMeta?.tone ?? "neutral")
                  : statusStyles[item.status]
              }
              summaryFields={summaryFields}
            />
            <DeviceWorkbenchSection fields={buildWorkbenchFields(item)} />
          </div>
          <div className="grid min-w-0 content-start gap-1.5 lg:gap-3">
            {lifecycleSummaryState === "loading" ? <InventoryLifecycleLoadingCard /> : null}
            {lifecycleSummaryState === "unavailable" ? <InventoryLifecycleUnavailableCard /> : null}
            {lifecycleSummaryState !== "dormant" && lifecycleSummary ? (
              <InventoryLifecycleSummaryCard
                summary={lifecycleSummary}
                itemId={item.id}
                hidePrimaryStatus={Boolean(exactProjection)}
              />
            ) : null}
            <InventoryDeviceHealthCard
              category={item.category}
              brand={item.brand}
              specifications={item.specifications}
              inspection={healthInspection}
              showExtendedChecks={Boolean(lifecycleSummary)}
            />
            <ProductBusinessSection item={item} />
            {lifecycleSummary ? (
              <InventoryInspectionEditor
                summary={lifecycleSummaryWithInspection ?? lifecycleSummary}
                brand={item.brand}
                category={item.category}
              />
            ) : null}
            <DeviceIdentitySection
              identifiers={visibleIdentifiers}
              gtin={item.gtin}
              specifications={item.specifications}
            />
            <ProductNotesSection notes={item.notes} />
            {lifecycleSummary ? (
              <InventoryLifecycleHistoryCard
                summary={lifecycleSummaryWithInspection ?? lifecycleSummary}
              />
            ) : null}
          </div>
        </div>
      </div>
      {canEdit ? <MobileDetailActionBar onEdit={onEdit} /> : null}
    </main>
  );
}

function MobileDetailActionBar({ onEdit }: { onEdit: () => void }) {
  return (
    <div className="fixed inset-x-0 bottom-0 z-30 border-t border-[var(--border-panel)] bg-background/95 px-2 pb-[calc(env(safe-area-inset-bottom)+0.5rem)] pt-1.5 shadow-[0_-10px_30px_color-mix(in_oklch,var(--foreground)_10%,transparent)] backdrop-blur-xl lg:hidden">
      <div className="mx-auto max-w-[430px]">
        <Button type="button" className="min-h-11 w-full rounded-xl text-xs" onClick={onEdit}>
          <Pencil className="mr-2 size-4" aria-hidden="true" />
          编辑商品
        </Button>
      </div>
    </div>
  );
}

function formatCompactDate(value: string) {
  return new Intl.DateTimeFormat("it-IT", {
    day: "2-digit",
    month: "2-digit",
    timeZone: "Europe/Rome",
  }).format(new Date(value));
}

function MobileProductHeader({
  headerRef,
  item,
  categoryLabel,
  statusLabel,
  canEdit,
  onBack,
  onEdit,
}: {
  headerRef: React.RefObject<HTMLDivElement | null>;
  item: InventoryProductDetail;
  categoryLabel: string;
  statusLabel: string;
  canEdit: boolean;
  onBack: () => void;
  onEdit: () => void;
}) {
  return (
    <div
      ref={headerRef}
      data-ui="inventory-product-mobile-header"
      className={cn(repairOs.mobileFloatingHeaderShell, "lg:static lg:mb-4")}
    >
      <section className={repairOs.mobileFloatingHeaderCard}>
        <header className={repairOs.mobileFloatingHeaderNav}>
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="size-11 rounded-lg"
            aria-label="返回商品库存"
            onClick={onBack}
          >
            <ArrowLeft className="size-5" aria-hidden="true" />
          </Button>
          <div className="min-w-0 text-center">
            <h1 className="truncate text-sm font-semibold">商品详情</h1>
            <p className="truncate text-[10px] text-muted-foreground lg:text-[11px] lg:leading-4">
              {item.sku} · {categoryLabel} · {statusLabel}
            </p>
            {item.edit_backing === "legacy_read_only" ? (
              <p className="text-[10px] text-status-warn-foreground">历史商品：仅可查看</p>
            ) : null}
          </div>
          {canEdit ? (
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className="size-11 rounded-lg"
              aria-label="编辑商品"
              onClick={onEdit}
            >
              <Pencil className="size-4" aria-hidden="true" />
            </Button>
          ) : (
            <span className="size-11" aria-hidden="true" />
          )}
        </header>
      </section>
    </div>
  );
}

function DesktopProductHeader({
  item,
  statusLabel,
  canEdit,
  onEdit,
}: {
  item: InventoryProductDetail;
  statusLabel: string;
  canEdit: boolean;
  onEdit: () => void;
}) {
  return (
    <header className="mb-3 hidden items-center justify-between gap-4 pb-1 lg:flex">
      <div className="min-w-0">
        <h1 className="truncate text-xl font-semibold">
          {item.brand} {item.model}
        </h1>
        <p className="text-sm text-muted-foreground">
          {item.sku} · {statusLabel}
        </p>
        {item.edit_backing === "legacy_read_only" ? (
          <p className="text-xs text-status-warn-foreground">
            历史商品：仅可查看（无 V2 库存单元）
          </p>
        ) : null}
      </div>
      {canEdit ? (
        <Button type="button" onClick={onEdit}>
          <Pencil className="mr-2 size-4" aria-hidden="true" />
          编辑商品
        </Button>
      ) : null}
    </header>
  );
}
