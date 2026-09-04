"use client";

import { useCallback, useRef, useState, type MouseEvent } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ClipboardPlus, Recycle, ScanLine, type LucideIcon } from "lucide-react";

import { Button } from "@/components/ui/button";
import { RepairOsBusinessCard, RepairOsSectionHeader } from "@/shared/ui";
import { brandGradientStyle, controls, repairOs } from "@/lib/ui-patterns";
import { cn } from "@/lib/utils";
import { createNewOrderSessionId } from "@/features/orders/model/new-order-intent";
import { buildNewOrderWorkspaceHref } from "@/features/orders/model/order-workspace-intent";
import { ScanSearchSheet } from "@/features/capture";
import { useLocale } from "@/shared/i18n/locale-provider";

const quickStartActions = [
  {
    id: "new-order",
    label: "dashboard.quickOrder",
    description: "dashboard.quickOrderDescription",
    href: buildNewOrderWorkspaceHref({ source: "dashboard" }),
    icon: ClipboardPlus,
    primary: true,
  },
  {
    id: "buyback-quote",
    label: "dashboard.quickBuyback",
    description: "dashboard.quickBuybackDescription",
    href: "/buyback?new=1",
    icon: Recycle,
    primary: false,
  },
] satisfies Array<{
  id: string;
  label: string;
  description: string;
  href: string;
  icon: LucideIcon;
  primary: boolean;
}>;

export function DashboardDesktopQuickStart({ onCreateOrder }: { onCreateOrder?: () => void }) {
  const { t } = useLocale();
  const router = useRouter();
  const startNewOrder = (event: MouseEvent<HTMLAnchorElement>) => {
    if (event.button !== 0 || event.metaKey || event.ctrlKey || event.altKey || event.shiftKey) {
      return;
    }
    event.preventDefault();
    if (onCreateOrder) {
      onCreateOrder();
      return;
    }
    router.push(
      buildNewOrderWorkspaceHref({
        source: "dashboard",
        sessionId: createNewOrderSessionId(),
      }),
    );
  };
  return (
    <div
      data-ui="dashboard-quick-start-desktop"
      className="flex min-w-0 flex-wrap justify-end gap-2"
    >
      {quickStartActions.map((action) => (
        <Button
          key={action.id}
          asChild
          size="sm"
          variant={action.primary ? "default" : "outline"}
          className={cn(
            "h-11 gap-1.5 rounded-xl px-3 text-xs",
            action.primary
              ? controls.brandButton
              : "border-[var(--border-panel)] bg-card hover:bg-accent/60",
          )}
          style={action.primary ? brandGradientStyle : undefined}
        >
          <Link
            href={action.href}
            onClick={action.id === "new-order" ? startNewOrder : undefined}
            data-dashboard-quick-start={action.id}
            aria-label={`${action.id === "new-order" ? t("dashboard.quickOrder") : t("dashboard.quickBuyback")}，${action.id === "new-order" ? t("dashboard.quickOrderDescription") : t("dashboard.quickBuybackDescription")}`}
          >
            <action.icon className="size-3.5" aria-hidden />
            {action.id === "new-order" ? t("dashboard.quickOrder") : t("dashboard.quickBuyback")}
          </Link>
        </Button>
      ))}
    </div>
  );
}

export function DashboardMobileQuickStart({ onCreateOrder }: { onCreateOrder?: () => void }) {
  const { t } = useLocale();
  const router = useRouter();
  const [scannerOpen, setScannerOpen] = useState(false);
  const scannerTriggerRef = useRef<HTMLButtonElement | null>(null);
  const scannerOutsideDismissedRef = useRef(false);
  const handleScannerCloseAutoFocus = useCallback((event: Event) => {
    if (!scannerOutsideDismissedRef.current) {
      event.preventDefault();
      scannerTriggerRef.current?.focus({ preventScroll: true });
    }
    scannerOutsideDismissedRef.current = false;
  }, []);
  const startNewOrder = (event: MouseEvent<HTMLAnchorElement>) => {
    if (event.button !== 0 || event.metaKey || event.ctrlKey || event.altKey || event.shiftKey) {
      return;
    }
    event.preventDefault();
    if (onCreateOrder) {
      onCreateOrder();
      return;
    }
    router.push(
      buildNewOrderWorkspaceHref({
        source: "dashboard",
        sessionId: createNewOrderSessionId(),
      }),
    );
  };
  return (
    <section
      data-ui="dashboard-quick-start-mobile"
      className={cn(repairOs.adminSection, "p-2 md:hidden")}
    >
      <RepairOsSectionHeader
        title={t("dashboard.quickStart")}
        description={t("dashboard.chooseBusiness")}
      />
      <div className={repairOs.dashboardMobileQuickGrid}>
        {quickStartActions.slice(0, 1).map((action) => (
          <Link
            key={action.id}
            href={action.href}
            onClick={action.id === "new-order" ? startNewOrder : undefined}
            data-dashboard-quick-start={action.id}
            aria-label={`${t("dashboard.quickOrder")}，${t("dashboard.quickOrderDescription")}`}
            className={repairOs.dashboardMobileQuickAction}
          >
            <RepairOsBusinessCard
              as="div"
              bodyClassName="grid w-full min-w-0 place-items-center gap-0.5"
              className={cn(
                "h-full min-h-14 grid-cols-1 place-items-center gap-0.5 rounded-xl px-1 py-1.5 text-center shadow-none transition-transform active:scale-[0.98] min-[400px]:min-h-16",
                action.primary
                  ? "border-0 text-primary-foreground hover:bg-transparent"
                  : "border-[var(--border-panel)] bg-card hover:bg-accent/60",
              )}
              style={action.primary ? brandGradientStyle : undefined}
            >
              <span
                className={cn(
                  "grid size-7 place-items-center rounded-lg",
                  action.primary
                    ? "bg-primary-foreground/15 text-primary-foreground"
                    : "bg-primary/10 text-primary",
                )}
              >
                <action.icon className="size-3.5" aria-hidden />
              </span>
              <span
                data-dashboard-quick-title={action.id}
                className="block w-full min-w-0 truncate whitespace-nowrap text-[11px] font-semibold leading-4 min-[360px]:text-xs lg:text-xs lg:leading-4"
              >
                {t("dashboard.quickOrder")}
              </span>
              <span
                className={cn(
                  "mt-0.5 hidden truncate text-[10px] leading-3.5 min-[400px]:block lg:text-[11px] lg:leading-4",
                  action.primary ? "text-primary-foreground/80" : "text-muted-foreground",
                )}
              >
                {action.id === "new-order"
                  ? t("dashboard.quickOrderDescription")
                  : t("dashboard.quickBuybackDescription")}
              </span>
            </RepairOsBusinessCard>
          </Link>
        ))}

        <button
          ref={scannerTriggerRef}
          type="button"
          data-dashboard-quick-start="scan-order"
          aria-label={`${t("dashboard.scanOrder")}，${t("dashboard.scanOrderDescription")}`}
          onClick={() => {
            scannerOutsideDismissedRef.current = false;
            scannerTriggerRef.current?.focus({ preventScroll: true });
            setScannerOpen(true);
          }}
          className={repairOs.dashboardMobileQuickAction}
        >
          <RepairOsBusinessCard
            as="div"
            bodyClassName="grid w-full min-w-0 place-items-center gap-0.5"
            className="h-full min-h-14 grid-cols-1 place-items-center gap-0.5 rounded-xl border-[var(--border-panel)] bg-card px-1 py-1.5 text-center shadow-none transition-transform active:scale-[0.98] min-[400px]:min-h-16"
          >
            <span className="grid size-7 place-items-center rounded-lg bg-primary/10 text-primary">
              <ScanLine className="size-3.5" aria-hidden />
            </span>
            <span
              data-dashboard-quick-title="scan-order"
              className="block w-full min-w-0 truncate whitespace-nowrap text-[11px] font-semibold leading-4 min-[360px]:text-xs lg:text-xs lg:leading-4"
            >
              {t("dashboard.scanOrder")}
            </span>
            <span className="mt-0.5 hidden truncate text-[10px] leading-3.5 text-muted-foreground min-[400px]:block lg:text-[11px] lg:leading-4">
              {t("dashboard.scanOrderShort")}
            </span>
          </RepairOsBusinessCard>
        </button>

        {quickStartActions.slice(1).map((action) => (
          <Link
            key={action.id}
            href={action.href}
            data-dashboard-quick-start={action.id}
            aria-label={`${t("dashboard.quickBuyback")}，${t("dashboard.quickBuybackDescription")}`}
            className={repairOs.dashboardMobileQuickAction}
          >
            <RepairOsBusinessCard
              as="div"
              bodyClassName="grid w-full min-w-0 place-items-center gap-0.5"
              className="h-full min-h-14 grid-cols-1 place-items-center gap-0.5 rounded-xl border-[var(--border-panel)] bg-card px-1 py-1.5 text-center shadow-none transition-transform active:scale-[0.98] min-[400px]:min-h-16"
            >
              <span className="grid size-7 place-items-center rounded-lg bg-primary/10 text-primary">
                <action.icon className="size-3.5" aria-hidden />
              </span>
              <span
                data-dashboard-quick-title={action.id}
                className="block w-full min-w-0 truncate whitespace-nowrap text-[11px] font-semibold leading-4 min-[360px]:text-xs lg:text-xs lg:leading-4"
              >
                {t("dashboard.buybackShort")}
              </span>
              <span className="mt-0.5 hidden truncate text-[10px] leading-3.5 text-muted-foreground min-[400px]:block lg:text-[11px] lg:leading-4">
                {t("dashboard.buybackDescription")}
              </span>
            </RepairOsBusinessCard>
          </Link>
        ))}
      </div>
      <ScanSearchSheet
        open={scannerOpen}
        onOpenChange={(nextOpen) => {
          setScannerOpen(nextOpen);
          if (nextOpen) scannerOutsideDismissedRef.current = false;
        }}
        onOutsideDismiss={() => {
          scannerOutsideDismissedRef.current = true;
        }}
        onCloseAutoFocus={handleScannerCloseAutoFocus}
        scope="orders"
      />
    </section>
  );
}
