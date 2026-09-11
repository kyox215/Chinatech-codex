"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import {
  Check,
  ChevronLeft,
  ChevronRight,
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
import { appShell } from "@/lib/ui-patterns";
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
  const { isMobile, state, setOpen, setOpenMobile, closeMobileSidebar } = useSidebar();
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

  const renderNavItems = () => (
    <SidebarMenu className="workbench-nav-list" data-shell-navigation-links="true">
      {nav.map((item) => {
        const active = isActiveNavItem(pathname, item);
        return (
          <SidebarMenuItem key={item.url}>
            <SidebarMenuButton
              asChild
              isActive={active}
              tooltip={item.title}
              className={appShell.navItem}
            >
              <Link
                href={item.url}
                onClick={handleNav}
                aria-label={item.title}
                aria-current={active ? "page" : undefined}
                title={item.title}
              >
                <span className="scheme-three-nav-full group-data-[collapsible=icon]:hidden">
                  {item.title}
                </span>
                <span
                  className="scheme-three-nav-short hidden group-data-[collapsible=icon]:block"
                  aria-hidden="true"
                >
                  {item.shortTitle ?? item.title}
                </span>
              </Link>
            </SidebarMenuButton>
          </SidebarMenuItem>
        );
      })}
    </SidebarMenu>
  );

  return (
    <Sidebar collapsible="icon" className={appShell.sidebar}>
      <SidebarHeader className={appShell.sidebarHeader}>
        <WorkspaceBrandSearch
          activeStoreName={activeStoreName}
          onOpenCommand={() => {
            if (isMobile) closeMobileSidebar(onOpenCommand);
            else onOpenCommand();
          }}
        />
      </SidebarHeader>

      <SidebarContent className="workbench-nav-content">
        <SidebarGroup className="p-0">
          <SidebarGroupLabel className="scheme-three-nav-caption">
            {t("shell.workspace")}
          </SidebarGroupLabel>
          <SidebarGroupContent>{renderNavItems()}</SidebarGroupContent>
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
                  className="workbench-store-trigger min-h-14 rounded-none border-0 bg-transparent px-1.5 shadow-none group-data-[collapsible=icon]:mx-auto group-data-[collapsible=icon]:!h-14 group-data-[collapsible=icon]:!w-full group-data-[collapsible=icon]:justify-center group-data-[collapsible=icon]:!p-0"
                >
                  <div className="scheme-three-store-avatar relative flex size-8 shrink-0 items-center justify-center rounded-md border border-[var(--shell-line)] bg-card text-muted-foreground">
                    <span aria-hidden="true">
                      {activeStoreName.slice(0, 1).toLocaleUpperCase()}
                    </span>
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
                  "workbench-account-menu max-w-[calc(100vw-24px)]",
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
        {!isMobile ? (
          <button
            type="button"
            data-shell-collapse-trigger="true"
            className="scheme-three-collapse"
            aria-label={t(state === "expanded" ? "shell.collapseSidebar" : "shell.expandSidebar")}
            aria-expanded={state === "expanded"}
            onClick={() => setOpen(state !== "expanded")}
          >
            <span>
              {t(state === "expanded" ? "shell.collapseMenuLabel" : "shell.expandMenuLabel")}
            </span>
            {state === "expanded" ? (
              <ChevronLeft className="size-3" aria-hidden="true" />
            ) : (
              <ChevronRight className="size-3" aria-hidden="true" />
            )}
          </button>
        ) : null}
      </SidebarFooter>
    </Sidebar>
  );
}
