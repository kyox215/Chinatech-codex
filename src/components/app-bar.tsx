"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { motion, useScroll, useMotionValueEvent } from "framer-motion";
import { useState } from "react";
import { ScanLine, Search, Sparkles, Store } from "lucide-react";

import { Button } from "@/components/ui/button";
import { ThemeToggle } from "@/components/theme-toggle";
import { SidebarTrigger } from "@/components/ui/sidebar";
import { useStoreShellContext } from "@/features/stores/api/use-store-shell-context";
import { RealtimeSyncIndicator } from "@/features/realtime";
import { useAiAssistantWorkspace } from "@/features/ai-assistant";
import { appShell } from "@/lib/ui-patterns";
import { getActiveWorkspaceItem, routeLabels } from "@/shared/config/navigation";
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

function usesRepairOsMobileHeader(pathname: string) {
  return (
    pathname === "/" ||
    /^\/(?:orders|customers|memos|buyback|inventory|finance|messages|platform|settings)(?:\/|$)/.test(
      pathname,
    )
  );
}

export function AppBar({
  onOpenCommand,
  onOpenScanner,
}: {
  onOpenCommand: () => void;
  onOpenScanner: () => void;
}) {
  const { scrollY } = useScroll();
  const [scrolled, setScrolled] = useState(false);
  useMotionValueEvent(scrollY, "change", (y) => setScrolled(y > 8));
  const crumbs = useCrumbs();
  const pathname = usePathname() ?? "/";
  const shell = useStoreShellContext();
  const aiAssistant = useAiAssistantWorkspace();
  const activeModule = getActiveWorkspaceItem(pathname, shell.isPlatformAdmin);
  const hideOnMobile = usesRepairOsMobileHeader(pathname);
  const mobileContextTitle =
    routeLabels[pathname.split("/").filter(Boolean)[0] ?? ""] ?? activeModule.title;
  const activeStoreName = shell.activeStore?.name ?? (shell.isLoading ? "读取店铺…" : "未选择店铺");

  return (
    <motion.header
      data-app-bar="true"
      className={cn(
        appShell.topBar,
        hideOnMobile && "max-md:hidden",
        scrolled ? "shadow-[var(--shadow-card)]" : "shadow-none",
      )}
    >
      <div className="flex h-full w-full min-w-0 items-center gap-2 px-3 md:px-5">
        <SidebarTrigger className="size-11 shrink-0 rounded-xl border border-[var(--border-panel)] bg-card shadow-[var(--shadow-card)] lg:size-9 lg:rounded-md lg:border-0 lg:bg-transparent lg:shadow-none" />

        <div className="min-w-0 flex-1 md:hidden">
          <p
            data-app-bar-context="true"
            className="truncate text-[10px] font-medium uppercase tracking-widest text-muted-foreground/70"
          >
            {mobileContextTitle}
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
          aria-label="打开全局搜索"
          onClick={onOpenCommand}
          className="ml-0 flex size-11 min-w-0 shrink-0 items-center justify-center rounded-xl border border-[var(--border-panel)] bg-card text-muted-foreground shadow-[var(--shadow-card)] transition-colors hover:text-foreground md:ml-auto md:h-9 md:w-56 md:shrink md:justify-start md:gap-2 md:rounded-md md:bg-surface/60 md:px-3 md:shadow-none lg:w-56 xl:w-80"
        >
          <Search className="size-4" />
          <span className="hidden min-w-0 truncate text-sm md:inline">搜索工单、客户、库存…</span>
          <kbd className="ml-auto hidden items-center gap-1 rounded border border-border/60 bg-muted px-1.5 py-0.5 font-mono text-[10px] md:inline-flex">
            ⌘K
          </kbd>
        </button>

        {aiAssistant.canOpenOrderAssistant ? (
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="hidden h-9 shrink-0 gap-1.5 border-primary/30 bg-primary/10 px-2.5 text-primary hover:bg-primary/15 md:inline-flex"
            aria-label="打开 RepairDesk AI 小助手"
            data-ai-assistant-trigger="desktop"
            onClick={aiAssistant.openAssistant}
          >
            <Sparkles className="size-3.5" aria-hidden="true" />
            <span className="hidden lg:inline">AI 助手</span>
          </Button>
        ) : null}

        <Button
          type="button"
          variant="outline"
          size="icon"
          className="size-10 shrink-0 rounded-xl border border-[var(--border-panel)] bg-card shadow-[var(--shadow-card)] md:size-9 md:rounded-md md:bg-surface/60 md:shadow-none"
          aria-label="全局扫码查询"
          onClick={onOpenScanner}
        >
          <ScanLine className="size-4" />
        </Button>

        <ThemeToggle className="size-10 rounded-xl border border-[var(--border-panel)] bg-card shadow-[var(--shadow-card)] md:size-9 md:rounded-md md:border-0 md:bg-transparent md:shadow-none" />

        <RealtimeSyncIndicator className="hidden md:inline-flex" />

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
      </div>
    </motion.header>
  );
}
