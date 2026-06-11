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
import { cn } from "@/lib/utils";

const labels: Record<string, string> = {
  "": "概览",
  orders: "工单",
  customers: "客户",
  inventory: "回收库存",
  messages: "消息模板",
  platform: "平台审批",
  settings: "设置",
  new: "新建",
};

function useCrumbs() {
  const pathname = usePathname() ?? "/";
  const segs = pathname.split("/").filter(Boolean);
  if (segs.length === 0) return [{ label: "概览", href: "/" }];
  return segs.map((seg, i) => ({
    label: labels[seg] ?? decodeURIComponent(seg),
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
      className={cn(
        "sticky top-0 z-30 flex h-14 w-full min-w-0 max-w-full items-center overflow-hidden border-b backdrop-blur-xl backdrop-saturate-150 transition-colors",
        scrolled ? "border-border/50 bg-background/70" : "border-transparent bg-background/30",
      )}
    >
      <div className="flex h-full w-full min-w-0 items-center gap-2 px-3 md:px-5">
        <SidebarTrigger className="size-9" />

        <nav className="ml-1 hidden min-w-0 shrink items-center gap-1.5 text-sm sm:flex">
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
          className="ml-auto flex h-9 w-9 min-w-0 shrink-0 items-center justify-center rounded-md border border-border/50 bg-surface/60 text-muted-foreground transition-colors hover:text-foreground md:w-56 md:shrink md:justify-start md:gap-2 md:px-3 lg:w-64 xl:w-80"
        >
          <Search className="size-4" />
          <span className="hidden min-w-0 truncate text-sm md:inline">搜索工单、客户…</span>
          <kbd className="ml-auto hidden items-center gap-1 rounded border border-border/60 bg-muted px-1.5 py-0.5 font-mono text-[10px] md:inline-flex">
            ⌘K
          </kbd>
        </button>

        <ThemeToggle />

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
            className="hidden h-9 items-center gap-1.5 rounded-md border border-border/50 bg-surface/60 px-2 text-xs transition-colors hover:bg-accent hover:text-accent-foreground lg:inline-flex"
          >
            <ShieldCheck className="size-3.5 text-primary" />
            <span className="font-medium">平台</span>
          </Link>
        ) : null}

        <Link
          href="/settings"
          className="hidden h-9 max-w-44 min-w-0 items-center gap-1.5 rounded-md border border-border/50 bg-surface/60 px-2 text-xs transition-colors hover:bg-accent hover:text-accent-foreground lg:inline-flex"
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
          className="hidden h-9 gap-1.5 border-0 text-white shadow-[0_4px_20px_-6px_oklch(0.7_0.2_285_/_0.6)] sm:inline-flex"
          style={{ background: "var(--gradient-brand)" }}
          onClick={handleNewOrder}
        >
          <Plus className="size-4" />
          <span className="hidden md:inline">新建</span>
        </Button>
      </div>
    </motion.header>
  );
}
