"use client";

import { useEffect, useRef, useState, type CSSProperties } from "react";
import { ArrowLeft, Gamepad2, Laptop, PackageOpen, Pencil, Smartphone, Tablet } from "lucide-react";

import { Button } from "@/components/ui/button";
import type {
  InventoryProductCategory,
  InventoryProductDetail,
  InventoryProductDisplayStatus,
} from "@/lib/repairdesk/types";
import { repairOs } from "@/lib/ui-patterns";
import { cn } from "@/lib/utils";
import { MoneyText } from "@/shared/ui";

import {
  buildWorkbenchFields,
  DeviceIdentitySection,
  DeviceWorkbenchSection,
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

export function InventoryProductDetailWorkbench({
  item,
  canEdit,
  onBack,
  onEdit,
}: {
  item: InventoryProductDetail;
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
  if (item.list_price !== undefined) {
    summaryFields.push({
      label: "售价",
      value: <MoneyText amount={item.list_price} className="font-semibold" />,
    });
  }
  if (item.cost_amount !== undefined) {
    summaryFields.push({ label: "成本", value: <MoneyText amount={item.cost_amount} /> });
  }
  if (item.location) summaryFields.push({ label: "库位", value: item.location });
  summaryFields.push({ label: "更新", value: formatCompactDate(item.updated_at) });

  return (
    <main
      data-ui="inventory-product-detail-workbench"
      className={cn(
        repairOs.mobileFloatingPage,
        "mx-auto w-full max-w-[430px] overflow-x-hidden px-2 pb-8 pt-[var(--repair-os-mobile-floating-offset,5.25rem)] lg:max-w-5xl lg:px-0 lg:pt-0",
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
        canEdit={canEdit}
        onBack={onBack}
        onEdit={onEdit}
      />

      <div>
        <DesktopProductHeader item={item} canEdit={canEdit} onEdit={onEdit} />
        <div className="grid min-w-0 gap-1.5 lg:grid-cols-[minmax(300px,0.82fr)_minmax(0,1.18fr)] lg:gap-3">
          <ProductHeroCard
            item={item}
            icon={meta.icon}
            statusLabel={statuses[item.status]}
            statusClassName={statusStyles[item.status]}
            summaryFields={summaryFields}
          />
          <div className="grid min-w-0 content-start gap-1.5 lg:gap-3">
            <DeviceWorkbenchSection fields={buildWorkbenchFields(item)} />
            <DeviceIdentitySection identifiers={visibleIdentifiers} gtin={item.gtin} />
            <ProductNotesSection notes={item.notes} />
          </div>
        </div>
      </div>
    </main>
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
  canEdit,
  onBack,
  onEdit,
}: {
  headerRef: React.RefObject<HTMLDivElement | null>;
  item: InventoryProductDetail;
  categoryLabel: string;
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
            className="size-9 rounded-lg"
            aria-label="返回商品库存"
            onClick={onBack}
          >
            <ArrowLeft className="size-5" aria-hidden="true" />
          </Button>
          <div className="min-w-0 text-center">
            <h1 className="truncate text-sm font-semibold">商品详情</h1>
            <p className="truncate text-[10px] text-muted-foreground">
              {item.sku} · {categoryLabel} · {statuses[item.status]}
            </p>
          </div>
          {canEdit ? (
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className="size-9 rounded-lg"
              aria-label="编辑商品"
              onClick={onEdit}
            >
              <Pencil className="size-4" aria-hidden="true" />
            </Button>
          ) : (
            <span className="size-9" aria-hidden="true" />
          )}
        </header>
      </section>
    </div>
  );
}

function DesktopProductHeader({
  item,
  canEdit,
  onEdit,
}: {
  item: InventoryProductDetail;
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
          {item.sku} · {statuses[item.status]}
        </p>
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
