"use client";

import { useEffect, useState, type ReactNode, type Ref } from "react";
import { ArrowDownWideNarrow, LoaderCircle, Plus, Search, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { SidebarTrigger } from "@/components/ui/sidebar";
import { brandGradientStyle, repairOs } from "@/lib/ui-patterns";
import { orderMobileFluidDensity } from "@/features/orders/components/order-list-layout";
import {
  OrderListQueueMenu,
  type OrderQueueChoice,
} from "@/features/orders/components/order-list-queue-menu";
import { RealtimeSyncIndicator } from "@/features/realtime";
import { cn } from "@/lib/utils";
import { useLocale } from "@/shared/i18n/locale-provider";

export function MobileOrdersFloatingHeader({
  groups,
  groupValue,
  pendingGroupValue,
  pendingLabel,
  totalOrders,
  onGroupChange,
  onCreateOrder,
  aiAction,
  scanAction,
  filterAction,
  rangeAction,
  searchValue,
  searchBusy,
  interactionDisabled = false,
  onSearchChange,
  onSearchSubmit,
  onSearchClear,
  rangeLabel,
  headerRef,
}: {
  groups: OrderQueueChoice[];
  groupValue: string;
  pendingGroupValue?: string;
  pendingLabel?: string;
  totalOrders: number;
  onGroupChange: (value: string) => void;
  onCreateOrder: () => void;
  aiAction?: ReactNode;
  scanAction?: ReactNode;
  filterAction?: ReactNode;
  rangeAction?: ReactNode;
  searchValue: string;
  searchBusy: boolean;
  interactionDisabled?: boolean;
  onSearchChange: (value: string) => void;
  onSearchSubmit: () => void;
  onSearchClear: () => void;
  rangeLabel?: string;
  headerRef?: Ref<HTMLDivElement>;
}) {
  const { t } = useLocale();
  const activeGroup = groups.find((group) => group.key === groupValue);
  const [collapsed, setCollapsed] = useState(false);
  const [searchFocused, setSearchFocused] = useState(false);
  useEffect(() => {
    let frame = 0;
    const update = () => {
      frame = 0;
      if (searchFocused) {
        setCollapsed(false);
        return;
      }
      const scrollY = window.scrollY;
      setCollapsed((current) => (current ? scrollY > 24 : scrollY > 72));
    };
    const onScroll = () => {
      if (!frame) frame = window.requestAnimationFrame(update);
    };
    update();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => {
      window.removeEventListener("scroll", onScroll);
      if (frame) window.cancelAnimationFrame(frame);
    };
  }, [searchFocused]);
  return (
    <div ref={headerRef} className={repairOs.mobileListHeaderShell}>
      <section
        data-order-mobile-header-card="true"
        data-order-mobile-header-collapsed={collapsed ? "true" : "false"}
        className={cn(
          repairOs.mobileFloatingHeaderCard,
          orderMobileFluidDensity,
          "rounded-[var(--order-mobile-radius)] px-1.5 py-1",
        )}
      >
        <header
          className={cn(
            repairOs.mobileFloatingHeaderNav,
            "grid-cols-[44px_minmax(0,1fr)_auto] gap-1 py-0",
          )}
        >
          <SidebarTrigger className="size-11 rounded-lg bg-transparent shadow-none" />
          <div data-order-mobile-title-block="true" className="min-w-0 text-center">
            <p className="truncate text-sm font-semibold leading-5">{t("orders.title")}</p>
            <p
              data-order-mobile-header-context="true"
              className="mt-0.5 flex min-w-0 items-center justify-center gap-1 text-[9px] leading-3 text-muted-foreground"
            >
              <span className="truncate">
                {pendingLabel ? t("orders.loadingGroup", { group: pendingLabel }) : rangeLabel}
              </span>
              <RealtimeSyncIndicator compact />
            </p>
          </div>
          <div className="flex items-center gap-1">
            {aiAction}
            <Button
              type="button"
              size="iconDense"
              className="size-11 rounded-lg border-0 text-primary-foreground shadow-[var(--shadow-action)]"
              style={brandGradientStyle}
              onClick={onCreateOrder}
              aria-label={t("orders.new")}
            >
              <Plus className="size-5" />
            </Button>
          </div>
        </header>
        {!collapsed ? (
          <div
            data-order-mobile-search-row="true"
            className={cn(
              "mt-1.5 grid min-w-0 gap-1 pb-1",
              scanAction && filterAction
                ? "grid-cols-[minmax(0,1fr)_44px_44px]"
                : scanAction || filterAction
                  ? "grid-cols-[minmax(0,1fr)_44px]"
                  : "grid-cols-1",
              "[&>button]:min-h-11 [&>button]:min-w-11",
            )}
          >
            <div
              className={cn(repairOs.searchBarEmbedded, "h-11 gap-1.5 rounded-lg px-2 shadow-none")}
              aria-busy={searchBusy}
            >
              <Search className="size-4 shrink-0 text-muted-foreground" aria-hidden="true" />
              <Input
                value={searchValue}
                disabled={interactionDisabled}
                onChange={(event) => onSearchChange(event.target.value)}
                onKeyDown={(event) => {
                  if (event.key !== "Enter") return;
                  event.preventDefault();
                  onSearchSubmit();
                }}
                placeholder={t("orders.searchPlaceholder")}
                aria-label={t("orders.searchLabel")}
                className={cn(
                  repairOs.searchInput,
                  "h-full text-base placeholder:text-[13px] md:text-base",
                )}
                onFocus={() => setSearchFocused(true)}
                onBlur={() => setSearchFocused(false)}
              />
              {searchBusy ? (
                <LoaderCircle
                  className="size-3.5 shrink-0 animate-spin text-primary"
                  aria-hidden="true"
                />
              ) : null}
              {searchValue ? (
                <button
                  type="button"
                  disabled={interactionDisabled}
                  className="grid size-11 shrink-0 place-items-center rounded-lg text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/50"
                  onClick={onSearchClear}
                  aria-label={t("orders.clearSearch")}
                >
                  <X className="size-3.5" />
                </button>
              ) : null}
            </div>
            {scanAction}
            {filterAction}
          </div>
        ) : null}
      </section>
      <div
        className="mx-auto grid w-full min-w-0 max-w-[430px] grid-cols-[minmax(0,1.2fr)_minmax(0,1fr)_minmax(0,0.8fr)] items-center gap-1 pt-1 md:max-w-none"
        data-order-mobile-list-controls="true"
      >
        <OrderListQueueMenu
          groups={groups}
          value={groupValue}
          pendingValue={pendingGroupValue}
          total={totalOrders}
          rangeLabel={rangeLabel}
          disabled={interactionDisabled}
          onChange={onGroupChange}
        />
        {rangeAction ?? (
          <span className="min-w-0 break-words text-[11px] leading-4 text-muted-foreground">
            {rangeLabel}
          </span>
        )}
        <span
          className="flex min-w-0 items-center gap-1 px-1 text-[10px] leading-3 text-muted-foreground"
          title={t("orders.queueSortHelp")}
          data-order-sort-description="true"
        >
          <ArrowDownWideNarrow className="size-3 shrink-0" aria-hidden="true" />
          <span className="min-w-0 break-words">{t("orders.queueSortShort")}</span>
          <span className="sr-only">{t("orders.queueSortHelp")}</span>
        </span>
      </div>
      <span
        className="sr-only"
        role={searchValue || pendingLabel ? undefined : "status"}
        aria-live={searchValue || pendingLabel ? "off" : "polite"}
      >
        {t("orders.currentCount", {
          group: activeGroup?.label ?? rangeLabel ?? t("orders.allStatuses"),
          count: activeGroup?.count ?? totalOrders,
        })}
      </span>
    </div>
  );
}
