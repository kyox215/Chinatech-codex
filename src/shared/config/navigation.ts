import type { LucideIcon } from "lucide-react";
import {
  Camera,
  ClipboardList,
  ClipboardPlus,
  MessageSquare,
  Package,
  PackagePlus,
  Recycle,
  ScanLine,
  Settings,
  ShieldCheck,
  Sparkles,
  UserPlus,
  Users,
} from "lucide-react";

import { REPAIRDESK_NEW_ORDER_EVENT } from "@/lib/app-events";

export type RepairDeskModuleId =
  | "dashboard"
  | "orders"
  | "customers"
  | "buyback"
  | "inventory"
  | "messages"
  | "platform"
  | "settings";

export type RepairDeskShellActionKind = "route" | "command" | "scanner" | "camera";

export interface RepairDeskShellAction {
  id: string;
  kind: RepairDeskShellActionKind;
  label: string;
  shortLabel?: string;
  description: string;
  icon: LucideIcon;
  href?: string;
  eventName?: string;
  eventPathname?: string;
}

export interface RepairDeskNavItem {
  id: RepairDeskModuleId;
  title: string;
  shortTitle?: string;
  url: string;
  icon: LucideIcon;
  exact?: boolean;
  commandLabel?: string;
  aliases?: string[];
  primaryAction?: RepairDeskShellAction;
}

export const newOrderShellAction: RepairDeskShellAction = {
  id: "new-order",
  kind: "route",
  label: "新建工单",
  shortLabel: "新建",
  description: "快速进入接单流程",
  icon: ClipboardPlus,
  href: "/orders/new",
  eventName: REPAIRDESK_NEW_ORDER_EVENT,
  eventPathname: "/orders",
};

export const workspaceNavItems: RepairDeskNavItem[] = [
  {
    id: "dashboard",
    title: "概览",
    shortTitle: "概览",
    url: "/",
    icon: Sparkles,
    exact: true,
    aliases: ["首页", "工作台", "dashboard"],
    primaryAction: {
      id: "open-orders",
      kind: "route",
      label: "进入工单",
      shortLabel: "工单",
      description: "查看维修队列与今日任务",
      icon: ClipboardList,
      href: "/orders",
    },
  },
  {
    id: "orders",
    title: "订单管理",
    shortTitle: "订单",
    url: "/orders",
    icon: ClipboardList,
    commandLabel: "工单列表",
    aliases: ["工单", "维修单", "接单", "orders"],
    primaryAction: newOrderShellAction,
  },
  {
    id: "customers",
    title: "客户管理",
    shortTitle: "客户",
    url: "/customers",
    icon: Users,
    aliases: ["客户", "电话", "设备档案", "customers"],
    primaryAction: {
      id: "new-customer",
      kind: "route",
      label: "新建客户",
      shortLabel: "客户",
      description: "录入客户资料与联系方式",
      icon: UserPlus,
      href: "/customers?new=1",
    },
  },
  {
    id: "buyback",
    title: "回收管理",
    shortTitle: "回收",
    url: "/buyback",
    icon: Recycle,
    aliases: ["回收", "报价", "旧机", "buyback"],
    primaryAction: {
      id: "new-buyback",
      kind: "route",
      label: "新建回收",
      shortLabel: "回收",
      description: "创建旧机估价与检测记录",
      icon: Recycle,
      href: "/buyback?new=1",
    },
  },
  {
    id: "inventory",
    title: "库存商品",
    shortTitle: "库存",
    url: "/inventory",
    icon: Package,
    aliases: ["库存", "商品", "配件", "inventory"],
    primaryAction: {
      id: "new-inventory",
      kind: "route",
      label: "库存入库",
      shortLabel: "入库",
      description: "新增配件、翻新机或商品",
      icon: PackagePlus,
      href: "/inventory?new=1",
    },
  },
  {
    id: "messages",
    title: "消息模板",
    shortTitle: "消息",
    url: "/messages",
    icon: MessageSquare,
    aliases: ["消息", "模板", "WhatsApp", "SMS"],
  },
  {
    id: "settings",
    title: "设置",
    shortTitle: "设置",
    url: "/settings",
    icon: Settings,
    aliases: ["设置", "店铺", "成员", "权限"],
    primaryAction: {
      id: "invite-members",
      kind: "route",
      label: "邀请成员",
      shortLabel: "成员",
      description: "进入成员权限与邀请",
      icon: UserPlus,
      href: "/settings#settings-members",
    },
  },
];

export const platformNavItem: RepairDeskNavItem = {
  id: "platform",
  title: "平台审批",
  shortTitle: "平台",
  url: "/platform",
  icon: ShieldCheck,
  aliases: ["平台", "审批", "开通", "管理员"],
};

export const globalMobileQuickActions: RepairDeskShellAction[] = [
  {
    id: "scan",
    kind: "scanner",
    label: "扫码读取",
    description: "识别工单、IMEI、库存标签",
    icon: ScanLine,
  },
  {
    id: "camera",
    kind: "camera",
    label: "拍照采集",
    description: "采集设备外观或故障照片",
    icon: Camera,
  },
  {
    id: "messages",
    kind: "route",
    label: "消息模板",
    description: "打开 WhatsApp / SMS 模板",
    icon: MessageSquare,
    href: "/messages",
  },
  {
    id: "search",
    kind: "command",
    label: "全局搜索",
    description: "搜索工单、客户和设备",
    icon: Sparkles,
  },
];

export function getWorkspaceNavItems(isPlatformAdmin: boolean) {
  if (!isPlatformAdmin) return workspaceNavItems;
  return [
    ...workspaceNavItems.filter((item) => item.id !== "settings"),
    platformNavItem,
    workspaceNavItems.find((item) => item.id === "settings")!,
  ];
}

export function isActiveNavItem(pathname: string, item: RepairDeskNavItem) {
  return item.exact
    ? pathname === item.url
    : pathname === item.url || pathname.startsWith(`${item.url}/`);
}

export function getActiveWorkspaceItem(pathname: string, isPlatformAdmin = true) {
  const nav = getWorkspaceNavItems(isPlatformAdmin);
  return nav.find((item) => isActiveNavItem(pathname, item)) ?? workspaceNavItems[0];
}

export function getShellPrimaryAction(pathname: string, isPlatformAdmin = true) {
  return getActiveWorkspaceItem(pathname, isPlatformAdmin).primaryAction ?? newOrderShellAction;
}

export function getShellCommandActions() {
  return [
    newOrderShellAction,
    workspaceNavItems.find((item) => item.id === "customers")!.primaryAction!,
    workspaceNavItems.find((item) => item.id === "buyback")!.primaryAction!,
    workspaceNavItems.find((item) => item.id === "inventory")!.primaryAction!,
  ];
}

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
