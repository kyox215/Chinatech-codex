import type { LucideIcon } from "lucide-react";
import {
  ClipboardList,
  Package,
  Recycle,
  Settings,
  ShieldCheck,
  Sparkles,
  Users,
} from "lucide-react";

export interface RepairDeskNavItem {
  title: string;
  url: string;
  icon: LucideIcon;
  exact?: boolean;
}

export const workspaceNavItems: RepairDeskNavItem[] = [
  { title: "概览", url: "/", icon: Sparkles, exact: true },
  { title: "订单管理", url: "/orders", icon: ClipboardList },
  { title: "客户管理", url: "/customers", icon: Users },
  { title: "回收管理", url: "/buyback", icon: Recycle },
  { title: "库存商品", url: "/inventory", icon: Package },
  { title: "设置", url: "/settings", icon: Settings },
];

export const platformNavItem: RepairDeskNavItem = {
  title: "平台审批",
  url: "/platform",
  icon: ShieldCheck,
};

export const routeLabels: Record<string, string> = {
  "": "概览",
  orders: "订单管理",
  customers: "客户管理",
  buyback: "回收管理",
  inventory: "库存商品",
  messages: "消息模板",
  platform: "平台审批",
  settings: "设置",
  offline: "离线",
  new: "新建",
  task: "任务",
};
