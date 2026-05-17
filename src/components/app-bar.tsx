"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { motion, useScroll, useMotionValueEvent } from "framer-motion";
import { useState } from "react";
import { Bell, Plus, Search, Store } from "lucide-react";

import { Button } from "@/components/ui/button";
import { ThemeToggle } from "@/components/theme-toggle";
import { SidebarTrigger } from "@/components/ui/sidebar";
import { cn } from "@/lib/utils";

const labels: Record<string, string> = {
  "": "概览",
  orders: "工单",
  customers: "客户",
  inventory: "库存",
  messages: "消息模板",
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

  return (
    <motion.header
      className={cn(
        "sticky top-0 z-30 flex h-14 w-full items-center border-b backdrop-blur-xl backdrop-saturate-150 transition-colors",
        scrolled ? "border-border/50 bg-background/70" : "border-transparent bg-background/30",
      )}
    >
      <div className="flex h-full w-full items-center gap-2 px-3 md:px-5">
        <SidebarTrigger className="size-9" />

        <nav className="ml-1 hidden min-w-0 items-center gap-1.5 text-sm sm:flex">
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
          className="ml-auto flex h-9 w-9 items-center justify-center rounded-md border border-border/50 bg-surface/60 text-muted-foreground transition-colors hover:text-foreground md:w-64 md:justify-start md:gap-2 md:px-3 xl:w-80"
        >
          <Search className="size-4" />
          <span className="hidden text-sm md:inline">搜索工单、客户…</span>
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

        <button
          type="button"
          className="hidden h-9 items-center gap-1.5 rounded-md border border-border/50 bg-surface/60 px-2 text-xs lg:inline-flex"
        >
          <Store className="size-3.5 text-muted-foreground" />
          <span className="font-medium">华强北旗舰店</span>
          <span className="size-1.5 rounded-full bg-emerald-400 shadow-[0_0_8px_oklch(0.78_0.18_145)]" />
        </button>

        <Button
          asChild
          size="sm"
          className="hidden h-9 gap-1.5 border-0 text-white shadow-[0_4px_20px_-6px_oklch(0.7_0.2_285_/_0.6)] sm:inline-flex"
          style={{ background: "var(--gradient-brand)" }}
        >
          <Link href="/orders/new">
            <Plus className="size-4" />
            <span className="hidden md:inline">新建</span>
          </Link>
        </Button>
      </div>
    </motion.header>
  );
}
