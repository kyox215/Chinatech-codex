"use client";

import { useEffect, useRef, useState, type CSSProperties, type ReactNode } from "react";
import { usePathname } from "next/navigation";
import { ArrowLeft, Boxes } from "lucide-react";

import { Button } from "@/components/ui/button";
import { repairOs } from "@/lib/ui-patterns";
import { cn } from "@/lib/utils";
import { resolveEntityContextBack } from "@/shared/config/entity-context-routes";
import { useLocale } from "@/shared/i18n/locale-provider";

export function InventoryLifecyclePageShell({
  title,
  context,
  onBack,
  status,
  children,
  action,
}: {
  title: string;
  context?: string;
  status?: ReactNode;
  onBack: () => void;
  children: ReactNode;
  action?: ReactNode;
}) {
  const { t } = useLocale();
  const headerRef = useRef<HTMLDivElement | null>(null);
  const [headerHeight, setHeaderHeight] = useState(0);
  const pathname = usePathname() ?? "/";
  const hasDesktopContextBack = Boolean(resolveEntityContextBack(pathname));

  useEffect(() => {
    document.body.dataset.mobileWorkspaceActive = "true";
    return () => {
      delete document.body.dataset.mobileWorkspaceActive;
    };
  }, []);

  useEffect(() => {
    const header = headerRef.current;
    if (!header) return;
    const measure = () => setHeaderHeight(Math.ceil(header.getBoundingClientRect().height));
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(header);
    window.addEventListener("resize", measure);
    return () => {
      observer.disconnect();
      window.removeEventListener("resize", measure);
    };
  }, [title, context, status]);

  return (
    <div
      data-ui="inventory-lifecycle-page"
      className={cn(
        repairOs.mobileFloatingPage,
        "mx-auto w-full max-w-[430px] overflow-x-hidden px-2 pb-24 lg:max-w-6xl lg:px-6 lg:pt-5",
      )}
      style={
        headerHeight
          ? ({ "--repair-os-mobile-floating-offset": `${headerHeight}px` } as CSSProperties)
          : undefined
      }
    >
      <div
        ref={headerRef}
        className={cn(repairOs.mobileFloatingHeaderShell, "lg:!static lg:!mb-4 lg:!block")}
      >
        <section className={repairOs.mobileFloatingHeaderCard}>
          <header
            data-ui="inventory-lifecycle-header-nav"
            className={cn(
              repairOs.mobileFloatingHeaderNav,
              hasDesktopContextBack && "lg:grid-cols-[minmax(0,1fr)_auto]",
            )}
          >
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className={cn("size-11 rounded-lg", hasDesktopContextBack && "lg:hidden")}
              aria-label={t("inventory2b4.detail.back")}
              onClick={onBack}
            >
              <ArrowLeft className="size-5" aria-hidden="true" />
            </Button>
            <div
              data-ui="inventory-lifecycle-header-title"
              className={cn("min-w-0 text-center", hasDesktopContextBack && "lg:text-left")}
            >
              <div
                className={cn(
                  "flex items-center justify-center gap-1.5",
                  hasDesktopContextBack && "lg:justify-start",
                )}
              >
                <Boxes className="size-3.5 shrink-0 text-primary" aria-hidden="true" />
                <h1
                  className={cn(
                    "truncate text-sm font-semibold",
                    hasDesktopContextBack &&
                      "lg:overflow-visible lg:text-clip lg:whitespace-normal lg:break-words",
                  )}
                >
                  {title}
                </h1>
              </div>
              {context ? (
                <p className="truncate text-[10px] text-muted-foreground lg:text-[11px] lg:leading-4">
                  {context}
                </p>
              ) : null}
            </div>
            <div className="flex min-w-11 shrink-0 justify-end">
              {action ?? status ?? <span className="size-11" />}
            </div>
          </header>
          {status && action ? (
            <div className={repairOs.mobileFloatingHeaderBody}>{status}</div>
          ) : null}
        </section>
      </div>
      <div className="min-w-0 space-y-2 lg:space-y-3">{children}</div>
    </div>
  );
}

export function InventoryLifecycleLoadingCard() {
  const { t } = useLocale();
  return (
    <section
      role="status"
      aria-live="polite"
      aria-busy="true"
      className={cn(repairOs.mobileInfoCard, "space-y-2 p-3")}
    >
      <span className="sr-only">{t("inventory2b4.lifecycle.loading")}</span>
      <div aria-hidden="true" className="h-4 w-32 animate-pulse rounded bg-muted" />
      <div aria-hidden="true" className="h-8 w-full animate-pulse rounded bg-muted" />
      <div aria-hidden="true" className="h-8 w-2/3 animate-pulse rounded bg-muted" />
    </section>
  );
}
