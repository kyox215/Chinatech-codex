"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { motion } from "framer-motion";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Check, Wrench, ChevronsUpDown, Store, Settings, ShieldCheck } from "lucide-react";

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
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { switchStore } from "@/lib/repairdesk/api";
import { platformKeys } from "@/features/platform/api/query-keys";
import { storesKeys } from "@/features/stores/api/query-keys";
import { useStoreShellContext } from "@/features/stores/api/use-store-shell-context";
import { indicatorSpring } from "@/lib/motion";
import { appShell, brandGradientStyle } from "@/lib/ui-patterns";
import { platformNavItem, workspaceNavItems } from "@/shared/config/navigation";
import { cn } from "@/lib/utils";

export function AppSidebar() {
  const pathname = usePathname() ?? "/";
  const router = useRouter();
  const queryClient = useQueryClient();
  const shell = useStoreShellContext();
  const { isMobile, setOpenMobile } = useSidebar();
  const isActive = (url: string) => (url === "/" ? pathname === "/" : pathname.startsWith(url));
  const nav = shell.isPlatformAdmin
    ? [...workspaceNavItems.slice(0, -1), platformNavItem, workspaceNavItems.at(-1)!]
    : workspaceNavItems;
  const activeStoreName = shell.activeStore?.name ?? (shell.isLoading ? "读取店铺…" : "未选择店铺");
  const activeStoreMeta = shell.activeStore
    ? `${shell.activeStore.role} · 在线`
    : shell.isPlatformAdmin
      ? "平台管理员"
      : "等待开通";

  const switchStoreMutation = useMutation({
    mutationFn: switchStore,
    onSuccess: async (context) => {
      toast.success(`已切换到 ${context.activeStore?.name ?? "店铺"}`);
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: storesKeys.context }),
        queryClient.invalidateQueries({ queryKey: platformKeys.onboardingStatus }),
      ]);
      router.refresh();
    },
    onError: (error) => toast.error(error instanceof Error ? error.message : "切换店铺失败"),
  });

  const handleNav = () => {
    if (isMobile) setOpenMobile(false);
  };

  return (
    <Sidebar collapsible="icon" className={appShell.sidebar}>
      <SidebarHeader className={appShell.sidebarHeader}>
        <div className={appShell.sidebarBrand}>
          <div
            className="relative flex size-8 shrink-0 items-center justify-center rounded-lg text-primary-foreground shadow-[var(--shadow-action)]"
            style={brandGradientStyle}
          >
            <Wrench className="size-4" />
          </div>
          <div className="flex min-w-0 flex-col group-data-[collapsible=icon]:hidden">
            <span className="truncate font-display text-sm font-semibold leading-5 tracking-tight">
              RepairDesk
            </span>
            <span className="truncate text-[11px] leading-4 text-muted-foreground">
              ChinaTech 工作台
            </span>
          </div>
        </div>
      </SidebarHeader>

      <SidebarContent className="gap-0 px-2 py-2 group-data-[collapsible=icon]:px-1.5">
        <SidebarGroup className="p-0">
          <SidebarGroupLabel className="h-7 px-2 text-[10px] uppercase tracking-widest text-muted-foreground/70">
            工作区
          </SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu className="gap-1">
              {nav.map((item) => {
                const active = isActive(item.url);
                return (
                  <SidebarMenuItem key={item.url}>
                    <SidebarMenuButton
                      asChild
                      isActive={active}
                      tooltip={item.title}
                      className={cn(
                        "relative h-9 rounded-xl px-2.5 text-[13px] transition-colors group-data-[collapsible=icon]:mx-auto group-data-[collapsible=icon]:!size-9 group-data-[collapsible=icon]:gap-0 group-data-[collapsible=icon]:justify-center group-data-[collapsible=icon]:rounded-xl",
                        active
                          ? "border border-primary/20 bg-primary/10 text-primary shadow-[var(--shadow-card)] hover:bg-primary/10 hover:text-primary"
                          : "border border-transparent text-sidebar-foreground/75 hover:border-[var(--border-panel)] hover:bg-card hover:text-foreground",
                      )}
                    >
                      <Link href={item.url} onClick={handleNav}>
                        {active && (
                          <motion.span
                            layoutId="nav-indicator"
                            className="absolute inset-0 rounded-lg bg-primary/10"
                            transition={indicatorSpring}
                          />
                        )}
                        {active && (
                          <motion.span
                            layoutId="nav-bar"
                            className="absolute left-1 top-1/2 h-5 w-[2px] -translate-y-1/2 rounded-full group-data-[collapsible=icon]:hidden"
                            style={brandGradientStyle}
                            transition={indicatorSpring}
                          />
                        )}
                        <item.icon
                          className={cn(
                            "relative z-10 size-4 shrink-0",
                            active ? "text-primary" : "text-muted-foreground",
                          )}
                        />
                        <span className="relative z-10 truncate group-data-[collapsible=icon]:hidden">
                          {item.title}
                        </span>
                      </Link>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                );
              })}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>

      <SidebarFooter className={appShell.sidebarFooter}>
        <SidebarMenu>
          <SidebarMenuItem>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <SidebarMenuButton
                  size="lg"
                  tooltip={activeStoreName}
                  className="h-[52px] rounded-xl border border-[var(--border-panel)] bg-card px-2 shadow-[var(--shadow-card)] hover:bg-accent/60 group-data-[collapsible=icon]:mx-auto group-data-[collapsible=icon]:!size-9 group-data-[collapsible=icon]:gap-0 group-data-[collapsible=icon]:rounded-xl group-data-[collapsible=icon]:border-transparent group-data-[collapsible=icon]:p-0 group-data-[collapsible=icon]:shadow-none"
                >
                  <div className="relative flex size-8 shrink-0 items-center justify-center rounded-md bg-primary/10 text-primary">
                    <Store className="size-4" />
                    {shell.activeStore ? (
                      <span className="absolute -right-0.5 -top-0.5 size-2 rounded-full bg-status-success-foreground ring-2 ring-background" />
                    ) : null}
                  </div>
                  <div className="flex min-w-0 flex-1 flex-col text-left group-data-[collapsible=icon]:hidden">
                    <span className="truncate text-sm font-semibold leading-5">
                      {activeStoreName}
                    </span>
                    <span className="truncate text-[11px] leading-4 text-muted-foreground">
                      {activeStoreMeta}
                    </span>
                  </div>
                  <ChevronsUpDown className="size-4 shrink-0 text-muted-foreground group-data-[collapsible=icon]:hidden" />
                </SidebarMenuButton>
              </DropdownMenuTrigger>
              <DropdownMenuContent
                side={isMobile ? "top" : "right"}
                align={isMobile ? "start" : "end"}
                sideOffset={isMobile ? 8 : 4}
                className={cn(
                  "max-w-[calc(100vw-24px)]",
                  isMobile ? "w-[var(--radix-dropdown-menu-trigger-width)] min-w-[14rem]" : "w-64",
                )}
              >
                <DropdownMenuLabel>店铺</DropdownMenuLabel>
                {shell.stores.length > 0 ? (
                  shell.stores.map((store) => (
                    <DropdownMenuItem
                      key={store.id}
                      disabled={switchStoreMutation.isPending || store.id === shell.activeStore?.id}
                      onSelect={() => {
                        if (store.id === shell.activeStore?.id) return;
                        switchStoreMutation.mutate(store.id);
                      }}
                    >
                      <Store className="size-4" />
                      <span className="min-w-0 flex-1 truncate">{store.name}</span>
                      <span className="shrink-0 text-[10px] uppercase text-muted-foreground">
                        {store.role}
                      </span>
                      {store.id === shell.activeStore?.id ? <Check className="size-4" /> : null}
                    </DropdownMenuItem>
                  ))
                ) : (
                  <DropdownMenuItem disabled>暂无可用店铺</DropdownMenuItem>
                )}
                {shell.isPlatformAdmin ? (
                  <>
                    <DropdownMenuSeparator />
                    <DropdownMenuItem asChild>
                      <Link href="/platform" onClick={handleNav}>
                        <ShieldCheck className="size-4" />
                        平台审批
                      </Link>
                    </DropdownMenuItem>
                  </>
                ) : null}
                <DropdownMenuSeparator />
                <DropdownMenuItem asChild>
                  <Link href="/settings" onClick={handleNav}>
                    <Settings className="size-4" />
                    店铺设置
                  </Link>
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarFooter>
    </Sidebar>
  );
}
