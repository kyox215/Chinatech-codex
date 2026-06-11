"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { motion, useScroll, useTransform, useMotionValueEvent } from "framer-motion";
import { useState } from "react";
import {
  Bell,
  Boxes,
  ClipboardList,
  MessageSquare,
  Plus,
  Search,
  Settings,
  Sparkles,
  Store,
  Users,
  Wrench,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import { ThemeToggle } from "@/components/theme-toggle";
import { cn } from "@/lib/utils";

export const navItems = [
  { title: "概览", url: "/", icon: Sparkles, exact: true },
  { title: "工单", url: "/orders", icon: ClipboardList },
  { title: "客户", url: "/customers", icon: Users },
  { title: "回收库存", url: "/inventory", icon: Boxes },
  { title: "消息", url: "/messages", icon: MessageSquare },
  { title: "设置", url: "/settings", icon: Settings },
];

export function TopNav({ onOpenCommand }: { onOpenCommand: () => void }) {
  const pathname = usePathname() ?? "/";
  const isActive = (url: string, exact?: boolean) =>
    exact
      ? pathname === url
      : pathname === url || pathname.startsWith(url + "/") || pathname === url;

  const { scrollY } = useScroll();
  const [scrolled, setScrolled] = useState(false);
  useMotionValueEvent(scrollY, "change", (y) => setScrolled(y > 8));

  const height = useTransform(scrollY, [0, 80], [64, 52]);
  const blur = useTransform(scrollY, [0, 80], [16, 28]);
  const backdropFilter = useTransform(blur, (v) => `blur(${v}px) saturate(160%)`);

  return (
    <motion.header
      style={{ height, backdropFilter, WebkitBackdropFilter: backdropFilter }}
      className={cn(
        "sticky top-0 z-40 flex w-full items-center border-b transition-colors",
        scrolled ? "border-border/50 bg-background/60" : "border-transparent bg-background/30",
      )}
    >
      <div className="mx-auto flex h-full w-full max-w-7xl items-center gap-2 px-4 md:px-6 lg:px-8">
        {/* Brand */}
        <Link href="/" className="flex shrink-0 items-center gap-2">
          <span
            className="grid size-8 place-items-center rounded-lg text-white shadow-[0_4px_18px_-6px_oklch(0.7_0.2_285_/_0.7)]"
            style={{ background: "var(--gradient-brand)" }}
          >
            <Wrench className="size-4" />
          </span>
          <span className="hidden font-display text-sm font-semibold tracking-tight sm:inline">
            RepairDesk
          </span>
        </Link>

        {/* Primary nav (desktop) */}
        <nav className="ml-4 hidden items-center gap-0.5 md:flex">
          {navItems.map((it) => {
            const active = isActive(it.url, it.exact);
            return (
              <Link
                key={it.url}
                href={it.url}
                className={cn(
                  "relative rounded-md px-3 py-1.5 text-sm transition-colors",
                  active ? "text-foreground" : "text-muted-foreground hover:text-foreground",
                )}
              >
                {active && (
                  <motion.span
                    layoutId="topnav-indicator"
                    className="absolute inset-0 -z-10 rounded-md"
                    style={{
                      background:
                        "linear-gradient(120deg, oklch(0.7 0.2 285 / 0.22), oklch(0.78 0.16 200 / 0.16))",
                      boxShadow: "inset 0 0 0 1px oklch(1 0 0 / 0.08)",
                    }}
                    transition={{ type: "spring", stiffness: 420, damping: 34 }}
                  />
                )}
                <span className="flex items-center gap-1.5">
                  <it.icon className="size-3.5 opacity-70" />
                  {it.title}
                </span>
              </Link>
            );
          })}
        </nav>

        {/* Search trigger */}
        <button
          type="button"
          onClick={onOpenCommand}
          className="ml-auto flex h-9 w-9 items-center justify-center rounded-md border border-border/50 bg-surface/60 text-muted-foreground backdrop-blur transition-colors hover:text-foreground md:w-72 md:justify-start md:gap-2 md:px-3"
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

        {/* Store switcher */}
        <button
          type="button"
          className="hidden h-9 items-center gap-1.5 rounded-md border border-border/50 bg-surface/60 px-2 text-xs backdrop-blur lg:inline-flex"
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
