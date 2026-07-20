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
import {
  buildNewOrderHref,
  createNewOrderSessionId,
} from "@/features/orders/model/new-order-intent";

export function CommandPalette({
  open,
  onOpenChange,
  onOpenScanner,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  onOpenScanner: () => void;
}) {
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
      to === "/orders/new"
        ? buildNewOrderHref({ source: "command", sessionId: createNewOrderSessionId() })
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
      label: "打开工单",
      run: () => router.push(`/orders/${id}`),
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
  const navigationItems = getWorkspaceNavItems(shell.isPlatformAdmin).filter((item) =>
    canShowWorkspaceNavItem(item, shell.permissions),
  );
  const shellActions = getShellCommandActions(shell.permissions, shell.activeStore?.role);

  return (
    <CommandDialog open={open} onOpenChange={onOpenChange}>
      <CommandInput placeholder="输入命令、搜索工单或客户…" />
      <CommandList>
        <CommandEmpty>没有匹配项。</CommandEmpty>
        <CommandGroup heading="跳转">
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
        <CommandGroup heading="快捷动作">
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
              value="已关闭店铺 恢复店铺 closed restore"
              onSelect={() => void go("/settings/closed-stores")}
            >
              <Wrench className="mr-2 size-4" /> 已关闭店铺
            </CommandItem>
          ) : null}
        </CommandGroup>
        {data.length > 0 && (
          <>
            <CommandSeparator />
            <CommandGroup heading="最近工单">
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
        <CommandGroup heading="动作">
          <CommandItem value="扫码查询 scan qr barcode imei inventory order" onSelect={openScanner}>
            <ScanLine className="mr-2 size-4" /> 扫码查询
          </CommandItem>
          <CommandItem onSelect={toggleTheme}>
            <Sun className="mr-2 size-4" /> 切换主题
          </CommandItem>
        </CommandGroup>
      </CommandList>
    </CommandDialog>
  );
}
