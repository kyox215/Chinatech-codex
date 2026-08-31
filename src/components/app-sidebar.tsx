"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { motion } from "framer-motion";
import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import {
  Check,
  ChevronsUpDown,
  Loader2,
  LogOut,
  Store,
  Settings,
  UserCircle,
  UserRound,
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
  SidebarRail,
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
import {
  applySwitchedStoreContext,
  refreshStoreContextQueries,
} from "@/features/stores/api/tenant-cache";
import { useStoreShellContext } from "@/features/stores/api/use-store-shell-context";
import { clearBrowserAuthPersistenceCookie } from "@/features/auth/model/auth-persistence";
import { clearRepairDeskOfflineIndexedDb } from "@/features/offline/model/offline-indexeddb";
import { indicatorSpring } from "@/lib/motion";
import { appShell, brandGradientStyle } from "@/lib/ui-patterns";
import {
  canShowWorkspaceNavItem,
  getSidebarNavItems,
  isActiveNavItem,
} from "@/shared/config/navigation";
import { cn } from "@/lib/utils";
import { createClient } from "@/utils/supabase/client";
import { useNavigationGuard } from "@/components/navigation-guard-provider";
import { WorkspaceBrandSearch } from "@/components/workspace-brand-search";
import { LanguageSwitcher } from "@/components/language-switcher";
import { useLocale } from "@/shared/i18n/locale-provider";
import { localizeNavItem } from "@/shared/i18n/navigation";

export function AppSidebar({ onOpenCommand }: { onOpenCommand: () => void }) {
  const { t } = useLocale();
  const pathname = usePathname() ?? "/";
  const router = useRouter();
  const queryClient = useQueryClient();
  const { runGuardedTransition } = useNavigationGuard();
  const [isSigningOut, setIsSigningOut] = useState(false);
  const shell = useStoreShellContext();
  const { isMobile, setOpenMobile } = useSidebar();
  const nav = getSidebarNavItems(shell.isPlatformAdmin)
    .filter((item) => canShowWorkspaceNavItem(item, shell.permissions))
    .map((item) => localizeNavItem(item, t));
  const activeStoreName =
    shell.activeStore?.name ?? (shell.isLoading ? t("shell.loadingStore") : t("shell.noStore"));
  const accountDisplayName = shell.displayName?.trim() || t("shell.currentAccount");
  const accountEmail =
    shell.email?.trim() ||
    (shell.isLoading ? t("shell.loadingAccount") : t("shell.emailUnavailable"));
  const activeStoreMeta = shell.activeStore
    ? `${shell.activeStore.role} · ${t("shell.online")}`
    : shell.isPlatformAdmin
      ? t("shell.platformAdmin")
      : t("shell.awaitingAccess");

  const switchStoreMutation = useMutation({
    mutationFn: switchStore,
    onSuccess: async (context) => {
      toast.success(
        t("shell.switchedStore", { store: context.activeStore?.name ?? t("shell.storeFallback") }),
      );
      await applySwitchedStoreContext(queryClient, context);
      await refreshStoreContextQueries(queryClient);
      router.refresh();
    },
    onError: (error) =>
      toast.error(error instanceof Error ? error.message : t("shell.switchStoreFailed")),
  });

  const handleNav = () => {
    if (isMobile) setOpenMobile(false);
  };

  const handleSignOut = async () => {
    if (isSigningOut) return;
    setIsSigningOut(true);
    try {
      await queryClient.cancelQueries({}, { silent: true });
      await createClient().auth.signOut();
      clearBrowserAuthPersistenceCookie();
      queryClient.clear();
      await clearRepairDeskOfflineIndexedDb();
      toast.success(t("shell.signedOut"));
      router.replace("/login");
      router.refresh();
    } catch (error) {
      setIsSigningOut(false);
      toast.error(error instanceof Error ? error.message : t("shell.signOutFailed"));
    }
  };

  return (
    <Sidebar collapsible="icon" className={appShell.sidebar}>
      <SidebarHeader className={appShell.sidebarHeader}>
        <WorkspaceBrandSearch activeStoreName={activeStoreName} onOpenCommand={onOpenCommand} />
      </SidebarHeader>

      <SidebarContent className="gap-0 px-2 py-2 group-data-[collapsible=icon]:px-1.5">
        <SidebarGroup className="p-0">
          <SidebarGroupLabel className="h-7 px-2 text-[10px] uppercase tracking-widest text-muted-foreground/70 lg:text-[11px] lg:leading-4 lg:tracking-normal lg:text-muted-foreground">
            {t("shell.workspace")}
          </SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu className="gap-1">
              {nav.map((item) => {
                const active = isActiveNavItem(pathname, item);
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
            {/* The mobile Sheet owns modality; a nested modal menu can leave body pointer-locked after navigation. */}
            <DropdownMenu modal={!isMobile}>
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
                <DropdownMenuLabel className="pb-2">
                  <div className="flex min-w-0 items-start gap-2 rounded-lg bg-muted/50 p-2">
                    <UserCircle className="mt-0.5 size-4 shrink-0 text-primary" />
                    <div className="min-w-0 flex-1">
                      <span className="block text-[10px] font-medium uppercase text-muted-foreground lg:text-xs lg:leading-4">
                        {t("shell.currentAccount")}
                      </span>
                      <span className="block truncate text-sm font-semibold text-foreground">
                        {accountDisplayName}
                      </span>
                      <span className="block truncate text-xs font-normal text-muted-foreground">
                        {accountEmail}
                      </span>
                    </div>
                  </div>
                </DropdownMenuLabel>
                <DropdownMenuSeparator />
                <DropdownMenuLabel>{t("shell.stores")}</DropdownMenuLabel>
                {shell.stores.length > 0 ? (
                  shell.stores.map((store) => (
                    <DropdownMenuItem
                      key={store.id}
                      disabled={switchStoreMutation.isPending || store.id === shell.activeStore?.id}
                      onSelect={() => {
                        if (store.id === shell.activeStore?.id) return;
                        void runGuardedTransition({
                          kind: "store-switch",
                          label: t("shell.switchToStore", { store: store.name }),
                          run: () => switchStoreMutation.mutateAsync(store.id),
                        });
                      }}
                    >
                      <Store className="size-4" />
                      <span className="min-w-0 flex-1 truncate">{store.name}</span>
                      <span className="shrink-0 text-[10px] uppercase text-muted-foreground lg:text-[11px] lg:leading-4">
                        {store.role}
                      </span>
                      {store.id === shell.activeStore?.id ? <Check className="size-4" /> : null}
                    </DropdownMenuItem>
                  ))
                ) : (
                  <DropdownMenuItem disabled>{t("shell.noStores")}</DropdownMenuItem>
                )}
                <DropdownMenuSeparator />
                <DropdownMenuItem asChild>
                  <Link href="/account" onClick={handleNav}>
                    <UserRound className="size-4" />
                    {t("shell.profile")}
                  </Link>
                </DropdownMenuItem>
                <DropdownMenuItem asChild>
                  <Link href="/settings" onClick={handleNav}>
                    <Settings className="size-4" />
                    {t("nav.settings.title")}
                  </Link>
                </DropdownMenuItem>
                {(shell.recoveryStores?.length ?? 0) > 0 ? (
                  <DropdownMenuItem asChild>
                    <Link href="/settings/closed-stores" onClick={handleNav}>
                      <Store className="size-4" />
                      {t("shell.closedStores")}（{shell.recoveryStores?.length ?? 0}）
                    </Link>
                  </DropdownMenuItem>
                ) : null}
                <DropdownMenuSeparator />
                <DropdownMenuItem
                  disabled={isSigningOut}
                  className="text-destructive focus:text-destructive"
                  onSelect={(event) => {
                    event.preventDefault();
                    void runGuardedTransition({
                      kind: "sign-out",
                      label: t("shell.signOut"),
                      run: handleSignOut,
                    });
                  }}
                >
                  {isSigningOut ? (
                    <Loader2 className="size-4 animate-spin" />
                  ) : (
                    <LogOut className="size-4" />
                  )}
                  {isSigningOut ? t("shell.signingOut") : t("shell.signOut")}
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </SidebarMenuItem>
          <SidebarMenuItem className="flex min-h-11 items-center justify-end group-data-[collapsible=icon]:justify-center lg:hidden">
            <span className="mr-auto truncate px-2 text-xs text-muted-foreground group-data-[collapsible=icon]:hidden">
              {t("locale.menuLabel")}
            </span>
            <LanguageSwitcher />
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarFooter>
      <SidebarRail />
    </Sidebar>
  );
}
