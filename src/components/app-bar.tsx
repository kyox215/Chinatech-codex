"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { motion, useScroll, useMotionValueEvent } from "framer-motion";
import { useState } from "react";
import { Bell, Plus, Search, ShieldCheck, Store } from "lucide-react";

import { Button } from "@/components/ui/button";
import { ThemeToggle } from "@/components/theme-toggle";
import { SidebarTrigger } from "@/components/ui/sidebar";
import { REPAIRDESK_NEW_ORDER_EVENT } from "@/lib/app-events";
import { useStoreShellContext } from "@/features/stores/api/use-store-shell-context";
import { appShell, brandGradientStyle, controls } from "@/lib/ui-patterns";
import { routeLabels } from "@/shared/config/navigation";
import { cn } from "@/lib/utils";

function useCrumbs() {
  const pathname = usePathname() ?? "/";
  const segs = pathname.split("/").filter(Boolean);
  if (segs.length === 0) return [{ label: "概览", href: "/" }];
  return segs.map((seg, i) => ({
    label: routeLabels[seg] ?? decodeURIComponent(seg),
    href: "/" + segs.slice(0, i + 1).join("/"),
  }));
}

export function AppBar({ onOpenCommand }: { onOpenCommand: () => void }) {
  const { scrollY } = useScroll();
  const [scrolled, setScrolled] = useState(false);
  useMotionValueEvent(scrollY, "change", (y) => setScrolled(y > 8));
  const crumbs = useCrumbs();
  const pathname = usePathname() ?? "/";
  const router = useRouter();
  const shell = useStoreShellContext();
  const isOrdersList = pathname === "/orders";
  const isMobileWorkspaceRoute =
    isOrdersList || pathname === "/orders/new" || /^\/orders\/[^/]+(?:\/task)?$/.test(pathname);
  const activeStoreName = shell.activeStore?.name ?? (shell.isLoading ? "读取店铺…" : "未选择店铺");

  const handleNewOrder = () => {
    if (isOrdersList) {
      window.dispatchEvent(new CustomEvent(REPAIRDESK_NEW_ORDER_EVENT));
      return;
    }
    router.push("/orders/new");
  };

  return (
    <motion.header
      data-app-bar="true"
      className={cn(
        appShell.topBar,
        isMobileWorkspaceRoute && "max-md:hidden",
        scrolled ? "shadow-[var(--shadow-card)]" : "shadow-none",
      )}
    >
      <div className="flex h-full w-full min-w-0 items-center gap-2 px-3 md:px-5">
        <SidebarTrigger className="size-10 shrink-0 rounded-xl border border-[var(--border-panel)] bg-card shadow-[var(--shadow-card)] md:size-9 md:rounded-md md:border-0 md:bg-transparent md:shadow-none" />

        <div className="min-w-0 flex-1 md:hidden">
          <p className="truncate text-[10px] font-medium uppercase tracking-widest text-muted-foreground/70">
            RepairDesk
          </p>
          <p className="truncate text-sm font-semibold leading-5 text-foreground">
            {activeStoreName}
          </p>
        </div>

        <nav className="ml-1 hidden min-w-0 shrink items-center gap-1.5 text-sm md:flex">
          {crumbs.map((c, i) => (
            <span key={c.href} className="flex items-center gap-1.5 truncate">
              {i > 0 && <span className="text-muted-foreground/40">/</span>}
              {i === crumbs.length - 1 ? (
                <span className="truncate font-medium">{c.label}</span>
              ) : (
                <Link
                  href={c.href}
                  className="truncate text-muted-foreground hover:text-foreground"
                >
                  {c.label}
                </Link>
              )}
            </span>
          ))}
        </nav>

        <button
          type="button"
          onClick={onOpenCommand}
          className="ml-0 flex size-10 min-w-0 shrink-0 items-center justify-center rounded-xl border border-[var(--border-panel)] bg-card text-muted-foreground shadow-[var(--shadow-card)] transition-colors hover:text-foreground md:ml-auto md:h-9 md:w-56 md:shrink md:justify-start md:gap-2 md:rounded-md md:bg-surface/60 md:px-3 md:shadow-none lg:w-56 xl:w-80"
        >
          <Search className="size-4" />
          <span className="hidden min-w-0 truncate text-sm md:inline">搜索工单、客户…</span>
          <kbd className="ml-auto hidden items-center gap-1 rounded border border-border/60 bg-muted px-1.5 py-0.5 font-mono text-[10px] md:inline-flex">
            ⌘K
          </kbd>
        </button>

        <ThemeToggle className="size-10 rounded-xl border border-[var(--border-panel)] bg-card shadow-[var(--shadow-card)] md:size-9 md:rounded-md md:border-0 md:bg-transparent md:shadow-none" />

        <Button
          variant="ghost"
          size="icon"
          className="hidden size-9 md:inline-flex"
          aria-label="通知"
        >
          <Bell className="size-4" />
        </Button>

        {shell.isPlatformAdmin ? (
          <Link
            href="/platform"
            className="hidden h-9 items-center gap-1.5 rounded-md border border-border/50 bg-surface/60 px-2 text-xs transition-colors hover:bg-accent hover:text-accent-foreground xl:inline-flex"
          >
            <ShieldCheck className="size-3.5 text-primary" />
            <span className="font-medium">平台</span>
          </Link>
        ) : null}

        <Link
          href="/settings"
          className="hidden h-9 max-w-44 min-w-0 items-center gap-1.5 rounded-md border border-border/50 bg-surface/60 px-2 text-xs transition-colors hover:bg-accent hover:text-accent-foreground xl:inline-flex"
        >
          <Store className="size-3.5 text-muted-foreground" />
          <span className="min-w-0 truncate font-medium">{activeStoreName}</span>
          {shell.activeStore ? (
            <span className="size-1.5 shrink-0 rounded-full bg-status-success-foreground" />
          ) : null}
        </Link>

        <Button
          type="button"
          size="sm"
          className={cn("hidden h-9 gap-1.5 sm:inline-flex", controls.brandButton)}
          style={brandGradientStyle}
          onClick={handleNewOrder}
        >
          <Plus className="size-4" />
          <span className="hidden xl:inline">新建</span>
        </Button>
      </div>
    </motion.header>
  );
}
