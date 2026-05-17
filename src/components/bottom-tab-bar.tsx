import { Link, useRouterState } from "@tanstack/react-router";
import { motion } from "framer-motion";
import { navItems } from "./top-nav";
import { cn } from "@/lib/utils";

export function BottomTabBar() {
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const items = navItems.slice(0, 5);
  const isActive = (url: string, exact?: boolean) =>
    exact ? pathname === url : pathname === url || pathname.startsWith(url + "/");

  return (
    <nav
      className="fixed inset-x-0 bottom-0 z-40 border-t border-border/50 bg-background/80 pb-[env(safe-area-inset-bottom)] backdrop-blur-xl md:hidden"
      aria-label="底部导航"
    >
      <ul className="mx-auto grid max-w-md grid-cols-5">
        {items.map((it) => {
          const active = isActive(it.url, it.exact);
          return (
            <li key={it.url}>
              <Link
                to={it.url}
                className={cn(
                  "relative flex flex-col items-center justify-center gap-1 py-2.5 text-[10px] transition-colors",
                  active ? "text-foreground" : "text-muted-foreground",
                )}
              >
                {active && (
                  <motion.span
                    layoutId="bottombar-indicator"
                    className="absolute inset-x-3 top-0 h-[2px] rounded-full"
                    style={{ background: "var(--gradient-brand)" }}
                    transition={{ type: "spring", stiffness: 420, damping: 32 }}
                  />
                )}
                <it.icon className={cn("size-5 transition-transform", active && "scale-110")} />
                <span className="font-medium">{it.title}</span>
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
