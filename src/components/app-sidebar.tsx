"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { motion } from "framer-motion";
import {
  ClipboardList,
  Users,
  Boxes,
  MessageSquare,
  Settings,
  ShieldCheck,
  Wrench,
  ChevronsUpDown,
  Store,
} from "lucide-react";

import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  useSidebar,
} from "@/components/ui/sidebar";
import { cn } from "@/lib/utils";

const nav = [
  { title: "概览", url: "/", icon: Wrench },
  { title: "工单", url: "/orders", icon: ClipboardList },
  { title: "客户", url: "/customers", icon: Users },
  { title: "回收库存", url: "/inventory", icon: Boxes },
  { title: "消息模板", url: "/messages", icon: MessageSquare },
  { title: "平台审批", url: "/platform", icon: ShieldCheck },
  { title: "设置", url: "/settings", icon: Settings },
];

export function AppSidebar() {
  const pathname = usePathname() ?? "/";
  const { isMobile, setOpenMobile } = useSidebar();
  const isActive = (url: string) => (url === "/" ? pathname === "/" : pathname.startsWith(url));
  const handleNav = () => {
    if (isMobile) setOpenMobile(false);
  };

  return (
    <Sidebar collapsible="icon" className="border-sidebar-border">
      <SidebarHeader className="border-b border-sidebar-border/50">
        <div className="flex items-center gap-2 px-2 py-1.5">
          <div
            className="relative flex size-8 items-center justify-center rounded-lg text-white shadow-[0_2px_10px_-2px_oklch(0.55_0.2_285_/_0.5)]"
            style={{ background: "var(--gradient-brand)" }}
          >
            <Wrench className="size-4" />
          </div>
          <div className="flex min-w-0 flex-col group-data-[collapsible=icon]:hidden">
            <span className="truncate font-display text-sm font-semibold tracking-tight">
              RepairDesk
            </span>
            <span className="truncate text-[11px] text-muted-foreground">维修工单后台</span>
          </div>
        </div>
      </SidebarHeader>

      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupLabel className="text-[10px] uppercase tracking-widest text-muted-foreground/70">
            主导航
          </SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {nav.map((item) => {
                const active = isActive(item.url);
                return (
                  <SidebarMenuItem key={item.url}>
                    <SidebarMenuButton
                      asChild
                      isActive={active}
                      tooltip={item.title}
                      className={cn(
                        "relative overflow-hidden transition-colors",
                        active && "text-sidebar-accent-foreground",
                      )}
                    >
                      <Link href={item.url} onClick={handleNav}>
                        {active && (
                          <motion.span
                            layoutId="nav-indicator"
                            className="absolute inset-0 -z-10 rounded-md bg-sidebar-accent"
                            transition={{ type: "spring", stiffness: 400, damping: 35 }}
                          />
                        )}
                        {active && (
                          <motion.span
                            layoutId="nav-bar"
                            className="absolute left-0 top-1/2 h-5 w-[2px] -translate-y-1/2 rounded-full group-data-[collapsible=icon]:left-1/2 group-data-[collapsible=icon]:top-auto group-data-[collapsible=icon]:bottom-1 group-data-[collapsible=icon]:h-1 group-data-[collapsible=icon]:w-4 group-data-[collapsible=icon]:-translate-x-1/2 group-data-[collapsible=icon]:translate-y-0"
                            style={{ background: "var(--gradient-brand)" }}
                            transition={{ type: "spring", stiffness: 400, damping: 35 }}
                          />
                        )}
                        <item.icon />
                        <span>{item.title}</span>
                      </Link>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                );
              })}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>

      <SidebarFooter className="border-t border-sidebar-border/50">
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton size="lg" tooltip="切换门店">
              <div className="relative flex size-8 items-center justify-center rounded-md bg-sidebar-accent text-sidebar-accent-foreground">
                <Store className="size-4" />
                <span className="absolute -right-0.5 -top-0.5 size-2 rounded-full bg-emerald-400 ring-2 ring-background" />
              </div>
              <div className="flex min-w-0 flex-1 flex-col text-left">
                <span className="truncate text-sm font-medium">华强北旗舰店</span>
                <span className="truncate text-[11px] text-muted-foreground">SZ-001 · 在线</span>
              </div>
              <ChevronsUpDown className="size-4 text-muted-foreground" />
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarFooter>
    </Sidebar>
  );
}
