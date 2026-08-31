import { useRouter } from "next/navigation";
import { ScanLine, Sun, Wrench } from "lucide-react";

import {
  CommandDialog,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
  CommandSeparator,
} from "@/components/ui/command";
import { useQuery } from "@tanstack/react-query";
import { orderListPageQueryOptions } from "@/features/orders/api/query-options";
import { toggleThemePreference } from "@/lib/theme";
import { useStoreShellContext } from "@/features/stores/api/use-store-shell-context";
import {
  canShowWorkspaceNavItem,
  getShellCommandActions,
  getWorkspaceNavItems,
} from "@/shared/config/navigation";
import { useNavigationGuard } from "@/components/navigation-guard-provider";
import { createNewOrderSessionId } from "@/features/orders/model/new-order-intent";
import {
  buildNewOrderWorkspaceHref,
  buildOrderDetailWorkspaceHref,
} from "@/features/orders/model/order-workspace-intent";
import { useLocale } from "@/shared/i18n/locale-provider";
import { localizeNavItem, localizeShellAction } from "@/shared/i18n/navigation";

export function CommandPalette({
  open,
  onOpenChange,
  onOpenScanner,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  onOpenScanner: () => void;
}) {
  const { t } = useLocale();
  const router = useRouter();
  const { runGuardedTransition } = useNavigationGuard();
  const shell = useStoreShellContext();
  const activeStoreId = shell.activeStore?.id;
  const { data: orderPage } = useQuery({
    ...orderListPageQueryOptions(undefined, activeStoreId),
    enabled: open && Boolean(activeStoreId),
  });
  const data = orderPage?.items ?? [];

  const go = async (to: string) => {
    onOpenChange(false);
    const href =
      to === "/orders/new" || to.startsWith("/orders?workspace=new-order")
        ? buildNewOrderWorkspaceHref({ source: "command", sessionId: createNewOrderSessionId() })
        : to;
    const outcome = await runGuardedTransition({
      kind: "route",
      label: href,
      run: () => router.push(href),
    });
    if (outcome.status === "ignored" || outcome.status === "failed") onOpenChange(true);
  };

  const goOrder = async (id: string) => {
    onOpenChange(false);
    const outcome = await runGuardedTransition({
      kind: "route",
      label: t("shell.openOrder"),
      run: () => router.push(buildOrderDetailWorkspaceHref(id, { source: "command" })),
    });
    if (outcome.status === "ignored" || outcome.status === "failed") onOpenChange(true);
  };

  const toggleTheme = () => {
    toggleThemePreference();
    onOpenChange(false);
  };
  const openScanner = () => {
    onOpenChange(false);
    onOpenScanner();
  };
  const navigationItems = getWorkspaceNavItems(shell.isPlatformAdmin)
    .filter((item) => canShowWorkspaceNavItem(item, shell.permissions))
    .map((item) => localizeNavItem(item, t));
  const shellActions = getShellCommandActions(shell.permissions, shell.activeStore?.role).map(
    (action) => localizeShellAction(action, t),
  );

  return (
    <CommandDialog open={open} onOpenChange={onOpenChange}>
      <CommandInput placeholder={t("shell.commandPlaceholder")} />
      <CommandList>
        <CommandEmpty>{t("shell.noCommandMatches")}</CommandEmpty>
        <CommandGroup heading={t("shell.commandNavigate")}>
          {navigationItems.map((item) => (
            <CommandItem
              key={item.id}
              value={[item.commandLabel ?? item.title, item.title, ...(item.aliases ?? [])].join(
                " ",
              )}
              onSelect={() => void go(item.url)}
            >
              <item.icon className="mr-2 size-4" /> {item.commandLabel ?? item.title}
            </CommandItem>
          ))}
        </CommandGroup>
        <CommandSeparator />
        <CommandGroup heading={t("shell.commandQuickActions")}>
          {shellActions.map((action) => (
            <CommandItem
              key={action.id}
              value={`${action.label} ${action.shortLabel ?? ""} ${action.description}`}
              onSelect={() => action.href && void go(action.href)}
            >
              <action.icon className="mr-2 size-4" /> {action.label}
            </CommandItem>
          ))}
          {(shell.recoveryStores?.length ?? 0) > 0 ? (
            <CommandItem
              value="已关闭与删除 恢复店铺 永久删除 closed restore delete purge"
              onSelect={() => void go("/settings/closed-stores")}
            >
              <Wrench className="mr-2 size-4" /> {t("shell.closedStores")}
            </CommandItem>
          ) : null}
        </CommandGroup>
        {data.length > 0 && (
          <>
            <CommandSeparator />
            <CommandGroup heading={t("shell.commandRecentOrders")}>
              {data.slice(0, 8).map((o) => (
                <CommandItem
                  key={o.id}
                  value={`${o.public_no} ${o.customer_name} ${o.device_label}`}
                  onSelect={() => void goOrder(o.id)}
                >
                  <Wrench className="mr-2 size-4 opacity-60" />
                  <span className="shrink-0 font-mono text-xs text-primary">{o.public_no}</span>
                  <span className="ml-2 min-w-0 truncate text-sm">{o.customer_name}</span>
                  <span className="ml-auto min-w-0 max-w-[45%] truncate text-right text-xs text-muted-foreground">
                    {o.device_label}
                  </span>
                </CommandItem>
              ))}
            </CommandGroup>
          </>
        )}
        <CommandSeparator />
        <CommandGroup heading={t("shell.commandActions")}>
          <CommandItem value="扫码查询 scan qr barcode imei inventory order" onSelect={openScanner}>
            <ScanLine className="mr-2 size-4" /> {t("shell.scanSearch")}
          </CommandItem>
          <CommandItem onSelect={toggleTheme}>
            <Sun className="mr-2 size-4" /> {t("shell.toggleTheme")}
          </CommandItem>
        </CommandGroup>
      </CommandList>
    </CommandDialog>
  );
}
