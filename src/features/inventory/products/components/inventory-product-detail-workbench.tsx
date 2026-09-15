"use client";

import { useEffect, useRef, useState, type CSSProperties, type ReactNode } from "react";
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
import type { InventoryLifecycleListSummary } from "@/lib/repairdesk/types";
import { useLocale } from "@/shared/i18n/locale-provider";

import {
  getInventoryLifecycleProjectionToneClass,
  InventoryDeviceHealthCard,
  InventoryLifecycleHistoryCard,
  InventoryLifecycleSummaryCard,
  InventoryLifecycleUnavailableCard,
} from "@/features/inventory/lifecycle/components/inventory-lifecycle-status";
import { getInventoryLifecycleProjectionMeta } from "@/features/inventory/lifecycle/model/projection";
import { localizeInventoryProjectionMeta } from "@/features/inventory/lifecycle/model/inventory-lifecycle-i18n";
import { InventoryLifecycleLoadingCard } from "@/features/inventory/lifecycle/components/inventory-lifecycle-page-shell";
import { InventoryDetailActionDock } from "./inventory-detail-action-dock";
import { resolveInventoryDetailNextAction } from "../model/resolve-inventory-detail-next-action";
import type { InventoryDetailNextAction } from "@/features/inventory/model/inventory-detail-next-action";
import {
  localizeInventoryDetailNextAction,
  localizeInventoryProductCategory,
  localizeInventoryProductStatus,
} from "../model/inventory-product-i18n";

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
  onNavigate,
  renderInspectionEditor,
  salesContent,
}: {
  item: InventoryProductDetail;
  lifecycleSummary?: InventoryLifecycleListSummary | null;
  lifecycleSummaryState?: "loading" | "ready" | "unavailable" | "dormant";
  canEdit: boolean;
  onBack: () => void;
  onEdit: () => void;
  onNavigate: (href: string) => void;
  /** Production injects the mutation-owning editor; stories provide no editor. */
  renderInspectionEditor?: (summary: InventoryLifecycleListSummary) => ReactNode;
  salesContent?: ReactNode;
}) {
  const { t } = useLocale();
  const mobileHeaderRef = useRef<HTMLDivElement | null>(null);
  const [mobileHeaderHeight, setMobileHeaderHeight] = useState(0);
  const meta = categories[item.category];
  const categoryLabel = localizeInventoryProductCategory(item.category, meta.label, t);
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
  const resolvedNextAction = resolveInventoryDetailNextAction({
    itemId: item.id,
    summary: lifecycleSummary,
    lifecycleSummaryState,
    canEdit,
  });
  const nextAction = localizeNextAction(resolvedNextAction, t);
  const lifecycleMeta = exactProjection
    ? localizeInventoryProjectionMeta(
        exactProjection,
        getInventoryLifecycleProjectionMeta(exactProjection, item.legacy_status ?? item.status),
        item.legacy_status ?? item.status,
        t,
      )
    : undefined;
  const statusLabel =
    lifecycleMeta?.label ?? localizeInventoryProductStatus(item.status, statuses[item.status], t);
  const displayedNetworkKey = ["network_variant", "connectivity", "network"].find((key) =>
    String(item.specifications?.[key] ?? "").trim(),
  );

  return (
    <div
      data-ui="inventory-product-detail-workbench"
      className={cn(
        repairOs.mobileFloatingPage,
        "mx-auto w-full max-w-[430px] overflow-x-hidden px-2 pb-20 pt-[var(--repair-os-mobile-floating-offset,5.25rem)] md:max-w-none md:px-3 lg:px-4 lg:pb-8 lg:pt-0",
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
        categoryLabel={categoryLabel}
        statusLabel={statusLabel}
        canEdit={canEdit}
        onBack={onBack}
        onEdit={onEdit}
      />

      <div>
        <div className="grid min-w-0 gap-2 lg:grid-cols-[minmax(0,2fr)_minmax(280px,1fr)] lg:items-start lg:gap-4">
          <div className="contents lg:grid lg:min-w-0 lg:content-start lg:gap-4">
            <div className="order-1 min-w-0">
              <ProductHeroCard
                item={item}
                icon={meta.icon}
                statusLabel={statusLabel}
                statusClassName={
                  exactProjection
                    ? getInventoryLifecycleProjectionToneClass(lifecycleMeta?.tone ?? "neutral")
                    : statusStyles[item.status]
                }
                summaryFields={summaryFields}
              />
            </div>
            <div className="order-3 grid min-w-0 gap-2 lg:gap-4">
              <DeviceWorkbenchSection fields={buildWorkbenchFields(item, t)} />
              <DeviceIdentitySection
                identifiers={visibleIdentifiers}
                gtin={item.gtin}
                specifications={Object.fromEntries(
                  Object.entries(item.specifications ?? {}).filter(
                    ([key]) => key !== displayedNetworkKey,
                  ),
                )}
              />
              <InventoryDeviceHealthCard
                category={item.category}
                brand={item.brand}
                specifications={item.specifications}
                inspection={healthInspection}
                showExtendedChecks={Boolean(lifecycleSummary)}
              />
              {lifecycleSummary && renderInspectionEditor
                ? renderInspectionEditor(lifecycleSummaryWithInspection ?? lifecycleSummary)
                : null}
              <ProductNotesSection notes={item.notes} />
            </div>
          </div>
          <div className="order-2 grid min-w-0 content-start gap-2 lg:gap-4">
            <ProductBusinessSection item={item} />
            {salesContent}
            {lifecycleSummaryState === "loading" ? <InventoryLifecycleLoadingCard /> : null}
            {lifecycleSummaryState === "unavailable" ? <InventoryLifecycleUnavailableCard /> : null}
            {lifecycleSummaryState !== "dormant" && lifecycleSummary ? (
              <InventoryLifecycleSummaryCard
                summary={lifecycleSummary}
                itemId={item.id}
                hidePrimaryStatus={Boolean(exactProjection)}
                nextAction={nextAction}
                hideMobilePrimaryAction
                onAction={() => handleNextAction(nextAction, onNavigate)}
              />
            ) : null}
            {lifecycleSummary ? (
              <InventoryLifecycleHistoryCard
                summary={lifecycleSummaryWithInspection ?? lifecycleSummary}
              />
            ) : null}
          </div>
        </div>
      </div>
      {!salesContent ? (
        <InventoryDetailActionDock
          action={nextAction}
          onAction={() => handleNextAction(nextAction, onNavigate)}
        />
      ) : null}
    </div>
  );
}

function handleNextAction(action: InventoryDetailNextAction, onNavigate: (href: string) => void) {
  if (action.kind !== "action") return;
  if (action.target === "inspection-editor") {
    const editor = document.querySelector<HTMLElement>("[data-ui='inventory-inspection-editor']");
    editor?.scrollIntoView({ behavior: "smooth", block: "center" });
    editor?.focus({ preventScroll: true });
    return;
  }
  if (action.href) onNavigate(action.href);
}

function localizeNextAction(
  action: InventoryDetailNextAction,
  t: ReturnType<typeof useLocale>["t"],
): InventoryDetailNextAction {
  if (action.kind === "none") return action;
  const label = localizeInventoryDetailNextAction(action, t) ?? action.label;
  if (action.kind === "loading") {
    // The shared business union retains its historical Chinese literal type; this is display-only.
    return { ...action, label: label as typeof action.label };
  }
  return { ...action, label };
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
  const { t } = useLocale();
  return (
    <div
      ref={headerRef}
      data-ui="inventory-product-mobile-header"
      className={cn(
        repairOs.mobileFloatingHeaderShell,
        "lg:static lg:mb-3 lg:block lg:bg-transparent lg:p-0",
      )}
    >
      <section className={repairOs.mobileFloatingHeaderCard}>
        <header
          className={cn(
            repairOs.mobileFloatingHeaderNav,
            "lg:grid-cols-[minmax(0,1fr)_auto] lg:px-3 lg:py-2",
          )}
        >
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="size-11 rounded-lg lg:hidden"
            aria-label={t("inventory2b4.detail.back")}
            onClick={onBack}
          >
            <ArrowLeft className="size-5" aria-hidden="true" />
          </Button>
          <div className="min-w-0 text-center lg:text-left">
            <h1 className="truncate text-sm font-semibold">{t("inventory2b4.detail.title")}</h1>
            <p className="truncate text-[10px] text-muted-foreground lg:text-[11px] lg:leading-4">
              {item.sku} · {categoryLabel} · {statusLabel}
            </p>
            {item.edit_backing === "legacy_read_only" ? (
              <p className="text-[10px] text-status-warn-foreground">
                {t("inventory2b4.detail.legacyMobile")}
              </p>
            ) : null}
          </div>
          {canEdit ? (
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className="size-11 min-h-11 rounded-lg lg:w-auto lg:px-3"
              aria-label={t("inventory2b4.detail.edit")}
              onClick={onEdit}
            >
              <Pencil className="size-4" aria-hidden="true" />
              <span className="hidden lg:inline">{t("inventory2b4.detail.edit")}</span>
            </Button>
          ) : (
            <span className="size-11" aria-hidden="true" />
          )}
        </header>
      </section>
    </div>
  );
}
