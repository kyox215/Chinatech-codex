import { Link, useRouterState } from "@tanstack/react-router";
import { Bell, Plus, Search, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { SidebarTrigger } from "@/components/ui/sidebar";
import { Separator } from "@/components/ui/separator";
import { ThemeToggle } from "@/components/theme-toggle";

const labels: Record<string, string> = {
  orders: "工单",
  customers: "客户",
  inventory: "库存",
  messages: "消息模板",
  settings: "设置",
  new: "新建",
};

export function AppHeader() {
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const segments = pathname.split("/").filter(Boolean);

  return (
    <header className="sticky top-0 z-30 flex h-14 items-center gap-2 border-b border-border/50 bg-background/40 px-3 backdrop-blur-xl sm:px-4">
      <SidebarTrigger />
      <Separator orientation="vertical" className="mx-1 h-5 bg-border/60" />
      <nav className="flex min-w-0 items-center gap-1.5 text-sm">
        <Link
          to="/"
          className="flex items-center gap-1 text-muted-foreground transition-colors hover:text-foreground"
        >
          <Sparkles className="size-3.5 opacity-70" />
          首页
        </Link>
        {segments.map((seg, i) => {
          const href = "/" + segments.slice(0, i + 1).join("/");
          const isLast = i === segments.length - 1;
          const label = labels[seg] ?? seg;
          return (
            <span key={href} className="flex min-w-0 items-center gap-1.5">
              <span className="text-muted-foreground/40">/</span>
              {isLast ? (
                <span className="truncate font-medium">{label}</span>
              ) : (
                <Link
                  to={href}
                  className="truncate text-muted-foreground transition-colors hover:text-foreground"
                >
                  {label}
                </Link>
              )}
            </span>
          );
        })}
      </nav>

      <div className="ml-auto flex items-center gap-2">
        <div className="group relative hidden md:block">
          <Search className="pointer-events-none absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="搜索工单、客户…"
            className="h-9 w-64 border-border/60 bg-surface/60 pl-8 text-sm backdrop-blur transition-all focus-visible:w-72 focus-visible:border-primary/50 focus-visible:shadow-[0_0_0_4px_oklch(0.7_0.2_285_/_0.18)]"
          />
          <kbd className="pointer-events-none absolute right-2 top-1/2 hidden -translate-y-1/2 items-center gap-1 rounded border border-border/60 bg-muted px-1.5 py-0.5 font-mono text-[10px] text-muted-foreground sm:inline-flex">
            ⌘K
          </kbd>
        </div>
        <ThemeToggle />
        <Button variant="ghost" size="icon" className="size-9">
          <Bell className="size-4" />
        </Button>
        <Button
          asChild
          size="sm"
          className="h-9 gap-1.5 border-0 text-white shadow-[0_4px_20px_-6px_oklch(0.7_0.2_285_/_0.6)] transition-shadow hover:shadow-[0_4px_24px_-4px_oklch(0.7_0.2_285_/_0.7)]"
          style={{
            backgroundImage: "linear-gradient(120deg, oklch(0.7 0.2 285), oklch(0.78 0.16 200))",
            backgroundSize: "180% 100%",
          }}
        >
          <Link to="/orders/new">
            <Plus className="size-4" />
            <span className="hidden sm:inline">新建工单</span>
          </Link>
        </Button>
      </div>
    </header>
  );
}
