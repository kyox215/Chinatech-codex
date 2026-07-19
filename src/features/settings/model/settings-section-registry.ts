import {
  Activity,
  FileSpreadsheet,
  GitBranch,
  MessageSquare,
  PackageSearch,
  Settings2,
  Store,
  TabletSmartphone,
  UserRound,
  Users,
  type LucideIcon,
} from "lucide-react";

import type { SettingsSectionKey } from "@/features/settings/model/settings-section-access";

export type SettingsSectionGroupKey =
  | "personal-access"
  | "store-operations"
  | "business-rules"
  | "output-data";

export type SettingsView = { kind: "overview" } | { kind: "section"; section: SettingsSectionKey };

export interface SettingsSectionDefinition {
  key: SettingsSectionKey;
  group: SettingsSectionGroupKey;
  label: string;
  shortLabel: string;
  description: string;
  keywords: readonly string[];
  icon: LucideIcon;
  href: `/settings?section=${SettingsSectionKey}`;
}

export interface SettingsSectionGroupDefinition {
  key: SettingsSectionGroupKey;
  label: string;
  sections: readonly SettingsSectionDefinition[];
}

const sectionDefinitions: readonly SettingsSectionDefinition[] = [
  {
    key: "account",
    group: "personal-access",
    label: "账号",
    shortLabel: "账号",
    description: "名称、身份与登录资料",
    keywords: ["个人", "邮箱", "身份", "登录"],
    icon: UserRound,
    href: "/settings?section=account",
  },
  {
    key: "members",
    group: "personal-access",
    label: "员工",
    shortLabel: "员工",
    description: "成员、邀请与加入申请",
    keywords: ["权限", "角色", "成员", "邀请"],
    icon: Users,
    href: "/settings?section=members",
  },
  {
    key: "store",
    group: "store-operations",
    label: "店铺",
    shortLabel: "店铺",
    description: "店铺资料、联系方式与切换",
    keywords: ["地址", "电话", "WhatsApp", "门店"],
    icon: Store,
    href: "/settings?section=store",
  },
  {
    key: "suppliers",
    group: "store-operations",
    label: "供应商",
    shortLabel: "供应商",
    description: "配件与外修来源",
    keywords: ["配件", "采购", "外修"],
    icon: PackageSearch,
    href: "/settings?section=suppliers",
  },
  {
    key: "kiosk",
    group: "store-operations",
    label: "客户 iPad",
    shortLabel: "iPad",
    description: "客户填写、签名与设备配对",
    keywords: ["Kiosk", "平板", "签名", "配对"],
    icon: TabletSmartphone,
    href: "/settings?section=kiosk",
  },
  {
    key: "rules",
    group: "business-rules",
    label: "默认规则",
    shortLabel: "规则",
    description: "维修与二手保修默认值",
    keywords: ["质保", "保修", "默认"],
    icon: Settings2,
    href: "/settings?section=rules",
  },
  {
    key: "workflow",
    group: "business-rules",
    label: "状态流",
    shortLabel: "状态",
    description: "工单状态与流转关系",
    keywords: ["流程", "工单", "状态", "流转"],
    icon: GitBranch,
    href: "/settings?section=workflow",
  },
  {
    key: "notifications",
    group: "output-data",
    label: "通知与打印",
    shortLabel: "通知",
    description: "客户消息签名与打印页脚",
    keywords: ["消息", "签名", "打印", "页脚"],
    icon: MessageSquare,
    href: "/settings?section=notifications",
  },
  {
    key: "ai-usage",
    group: "output-data",
    label: "AI 使用量",
    shortLabel: "AI 用量",
    description: "大模型请求、Token 与费用估算",
    keywords: ["OpenAI", "大模型", "Token", "费用", "用量", "额度"],
    icon: Activity,
    href: "/settings?section=ai-usage",
  },
  {
    key: "order-data",
    group: "output-data",
    label: "工单数据",
    shortLabel: "数据",
    description: "模板、导出与批量整理",
    keywords: ["Excel", "导入", "导出", "批量"],
    icon: FileSpreadsheet,
    href: "/settings?section=order-data",
  },
];

const sectionByKey = new Map(sectionDefinitions.map((section) => [section.key, section]));

export const SETTINGS_SECTION_GROUPS: readonly SettingsSectionGroupDefinition[] = [
  {
    key: "personal-access",
    label: "个人与访问",
    sections: sectionDefinitions.filter((section) => section.group === "personal-access"),
  },
  {
    key: "store-operations",
    label: "店铺运营",
    sections: sectionDefinitions.filter((section) => section.group === "store-operations"),
  },
  {
    key: "business-rules",
    label: "业务规则",
    sections: sectionDefinitions.filter((section) => section.group === "business-rules"),
  },
  {
    key: "output-data",
    label: "输出与数据",
    sections: sectionDefinitions.filter((section) => section.group === "output-data"),
  },
];

export function parseSettingsView(value: string | null): SettingsView {
  if (!value || !sectionByKey.has(value as SettingsSectionKey)) return { kind: "overview" };
  return { kind: "section", section: value as SettingsSectionKey };
}

export function getSettingsSection(key: SettingsSectionKey): SettingsSectionDefinition {
  const section = sectionByKey.get(key);
  if (!section) throw new Error(`Unknown settings section: ${key}`);
  return section;
}

export function filterSettingsSectionGroups(
  query: string,
): readonly SettingsSectionGroupDefinition[] {
  const normalizedQuery = query.trim().toLocaleLowerCase();
  if (!normalizedQuery) return SETTINGS_SECTION_GROUPS;

  return SETTINGS_SECTION_GROUPS.map((group) => ({
    ...group,
    sections: group.sections.filter((section) =>
      [section.label, section.shortLabel, section.description, ...section.keywords]
        .join(" ")
        .toLocaleLowerCase()
        .includes(normalizedQuery),
    ),
  })).filter((group) => group.sections.length > 0);
}
