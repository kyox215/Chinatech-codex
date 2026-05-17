import { useEffect, useState } from "react";
import { useNavigate } from "@tanstack/react-router";
import {
  Boxes,
  ClipboardList,
  MessageSquare,
  Plus,
  Settings,
  Sparkles,
  Sun,
  Users,
  Wrench,
} from "lucide-react";

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
import { listOrders } from "@/lib/mock/api";

type StaticCommandPath =
  | "/"
  | "/orders"
  | "/orders/new"
  | "/customers"
  | "/inventory"
  | "/messages"
  | "/settings";

export function CommandPalette({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
}) {
  const navigate = useNavigate();
  const { data = [] } = useQuery({
    queryKey: ["orders", {}],
    queryFn: () => listOrders(),
    enabled: open,
  });

  const go = (to: StaticCommandPath) => {
    onOpenChange(false);
    navigate({ to });
  };

  const goOrder = (id: string) => {
    onOpenChange(false);
    navigate({ to: "/orders/$id", params: { id } });
  };

  const toggleTheme = () => {
    document.documentElement.classList.toggle("dark");
    onOpenChange(false);
  };

  return (
    <CommandDialog open={open} onOpenChange={onOpenChange}>
      <CommandInput placeholder="输入命令、搜索工单或客户…" />
      <CommandList>
        <CommandEmpty>没有匹配项。</CommandEmpty>
        <CommandGroup heading="跳转">
          <CommandItem onSelect={() => go("/")}>
            <Sparkles className="mr-2 size-4" /> 概览
          </CommandItem>
          <CommandItem onSelect={() => go("/orders")}>
            <ClipboardList className="mr-2 size-4" /> 工单列表
          </CommandItem>
          <CommandItem onSelect={() => go("/orders/new")}>
            <Plus className="mr-2 size-4" /> 新建工单
          </CommandItem>
          <CommandItem onSelect={() => go("/customers")}>
            <Users className="mr-2 size-4" /> 客户
          </CommandItem>
          <CommandItem onSelect={() => go("/inventory")}>
            <Boxes className="mr-2 size-4" /> 库存
          </CommandItem>
          <CommandItem onSelect={() => go("/messages")}>
            <MessageSquare className="mr-2 size-4" /> 消息模板
          </CommandItem>
          <CommandItem onSelect={() => go("/settings")}>
            <Settings className="mr-2 size-4" /> 设置
          </CommandItem>
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
                  <span className="font-mono text-xs text-primary">{o.public_no}</span>
                  <span className="ml-2 text-sm">{o.customer_name}</span>
                  <span className="ml-auto text-xs text-muted-foreground">{o.device_label}</span>
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
