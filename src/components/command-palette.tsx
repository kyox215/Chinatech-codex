import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Sun, Wrench } from "lucide-react";

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
import { listOrders } from "@/lib/repairdesk/api";
import { toggleThemePreference } from "@/lib/theme";
import { useStoreShellContext } from "@/features/stores/api/use-store-shell-context";
import { getShellCommandActions, getWorkspaceNavItems } from "@/shared/config/navigation";

export function CommandPalette({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
}) {
  const router = useRouter();
  const shell = useStoreShellContext();
  const { data = [] } = useQuery({
    queryKey: ["orders", {}],
    queryFn: () => listOrders(),
    enabled: open,
  });

  const go = (to: string) => {
    onOpenChange(false);
    router.push(to);
  };

  const goOrder = (id: string) => {
    onOpenChange(false);
    router.push(`/orders/${id}`);
  };

  const toggleTheme = () => {
    toggleThemePreference();
    onOpenChange(false);
  };
  const navigationItems = getWorkspaceNavItems(shell.isPlatformAdmin);
  const shellActions = getShellCommandActions();

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
              onSelect={() => go(item.url)}
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
              onSelect={() => action.href && go(action.href)}
            >
              <action.icon className="mr-2 size-4" /> {action.label}
            </CommandItem>
          ))}
        </CommandGroup>
        {data.length > 0 && (
          <>
            <CommandSeparator />
            <CommandGroup heading="最近工单">
              {data.slice(0, 8).map((o) => (
                <CommandItem
                  key={o.id}
                  value={`${o.public_no} ${o.customer_name} ${o.device_label}`}
                  onSelect={() => goOrder(o.id)}
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
          <CommandItem onSelect={toggleTheme}>
            <Sun className="mr-2 size-4" /> 切换主题
          </CommandItem>
        </CommandGroup>
      </CommandList>
    </CommandDialog>
  );
}

export function useCommandPalette() {
  const [open, setOpen] = useState(false);
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setOpen((o) => !o);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);
  return { open, setOpen };
}
