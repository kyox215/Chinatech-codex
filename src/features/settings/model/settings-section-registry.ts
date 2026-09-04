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
import { DEFAULT_LOCALE, type AppLocale } from "@/shared/i18n/locales";
import { translateMessage, type MessageKey } from "@/shared/i18n/messages";

export type SettingsSectionGroupKey =
  | "personal-access"
  | "store-operations"
  | "business-rules"
  | "output-data";

export type SettingsSectionTier = "core" | "advanced";

/**
 * Keep the daily settings entry points in the same product order everywhere
 * they are rendered. The registry's historical grouping is intentionally
 * retained for deep links and capability lookup, so consumers should use
 * this helper instead of relying on group declaration order for core items.
 */
export const SETTINGS_CORE_SECTION_ORDER = [
  "store",
  "members",
  "rules",
  "notifications",
] as const satisfies readonly SettingsSectionKey[];

const settingsCoreSectionOrder = new Map<SettingsSectionKey, number>(
  SETTINGS_CORE_SECTION_ORDER.map((key, index) => [key, index]),
);

export type SettingsView = { kind: "overview" } | { kind: "section"; section: SettingsSectionKey };

export interface SettingsSectionDefinition {
  key: SettingsSectionKey;
  group: SettingsSectionGroupKey;
  tier: SettingsSectionTier;
  /**
   * Some compatibility routes remain available by deep link but should not
   * compete with the daily settings entry points (for example /account).
   */
  showInDefaultNavigation: boolean;
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
    tier: "advanced",
    showInDefaultNavigation: false,
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
    tier: "core",
    showInDefaultNavigation: true,
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
    tier: "core",
    showInDefaultNavigation: true,
    label: "店铺",
    shortLabel: "店铺",
    description: "店铺资料、联系方式与客户输出",
    keywords: ["地址", "电话", "WhatsApp", "门店"],
    icon: Store,
    href: "/settings?section=store",
  },
  {
    key: "suppliers",
    group: "store-operations",
    tier: "advanced",
    showInDefaultNavigation: true,
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
    tier: "advanced",
    showInDefaultNavigation: true,
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
    tier: "core",
    showInDefaultNavigation: true,
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
    tier: "advanced",
    showInDefaultNavigation: true,
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
    tier: "core",
    showInDefaultNavigation: true,
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
    tier: "advanced",
    showInDefaultNavigation: true,
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
    tier: "advanced",
    showInDefaultNavigation: true,
    label: "工单数据",
    shortLabel: "数据",
    description: "模板、导出与批量整理",
    keywords: ["Excel", "导入", "导出", "批量"],
    icon: FileSpreadsheet,
    href: "/settings?section=order-data",
  },
];

const sectionByKey = new Map(sectionDefinitions.map((section) => [section.key, section]));

const groupDefinitions: readonly SettingsSectionGroupDefinition[] = [
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

const groupLabelKeys: Record<SettingsSectionGroupKey, MessageKey> = {
  "personal-access": "settings.group.personalAccess",
  "store-operations": "settings.group.storeOperations",
  "business-rules": "settings.group.businessRules",
  "output-data": "settings.group.outputData",
};

const sectionPresentationKeys: Record<
  SettingsSectionKey,
  { label: MessageKey; shortLabel: MessageKey; description: MessageKey; keywords: MessageKey }
> = {
  account: {
    label: "settings.section.account.label",
    shortLabel: "settings.section.account.shortLabel",
    description: "settings.section.account.description",
    keywords: "settings.section.account.keywords",
  },
  members: {
    label: "settings.section.members.label",
    shortLabel: "settings.section.members.shortLabel",
    description: "settings.section.members.description",
    keywords: "settings.section.members.keywords",
  },
  store: {
    label: "settings.section.store.label",
    shortLabel: "settings.section.store.shortLabel",
    description: "settings.section.store.description",
    keywords: "settings.section.store.keywords",
  },
  suppliers: {
    label: "settings.section.suppliers.label",
    shortLabel: "settings.section.suppliers.shortLabel",
    description: "settings.section.suppliers.description",
    keywords: "settings.section.suppliers.keywords",
  },
  kiosk: {
    label: "settings.section.kiosk.label",
    shortLabel: "settings.section.kiosk.shortLabel",
    description: "settings.section.kiosk.description",
    keywords: "settings.section.kiosk.keywords",
  },
  rules: {
    label: "settings.section.rules.label",
    shortLabel: "settings.section.rules.shortLabel",
    description: "settings.section.rules.description",
    keywords: "settings.section.rules.keywords",
  },
  workflow: {
    label: "settings.section.workflow.label",
    shortLabel: "settings.section.workflow.shortLabel",
    description: "settings.section.workflow.description",
    keywords: "settings.section.workflow.keywords",
  },
  notifications: {
    label: "settings.section.notifications.label",
    shortLabel: "settings.section.notifications.shortLabel",
    description: "settings.section.notifications.description",
    keywords: "settings.section.notifications.keywords",
  },
  "ai-usage": {
    label: "settings.section.aiUsage.label",
    shortLabel: "settings.section.aiUsage.shortLabel",
    description: "settings.section.aiUsage.description",
    keywords: "settings.section.aiUsage.keywords",
  },
  "order-data": {
    label: "settings.section.orderData.label",
    shortLabel: "settings.section.orderData.shortLabel",
    description: "settings.section.orderData.description",
    keywords: "settings.section.orderData.keywords",
  },
};

export const SETTINGS_SECTION_GROUPS = getSettingsSectionGroups();

export function getSettingsSectionGroups(
  locale: AppLocale = DEFAULT_LOCALE,
): readonly SettingsSectionGroupDefinition[] {
  return groupDefinitions.map((group) => ({
    ...group,
    label: translateMessage(locale, groupLabelKeys[group.key]),
    sections: group.sections.map((section) => localizeSettingsSection(section, locale)),
  }));
}

export function parseSettingsView(value: string | null): SettingsView {
  if (!value || !sectionByKey.has(value as SettingsSectionKey)) return { kind: "overview" };
  return { kind: "section", section: value as SettingsSectionKey };
}

export function getSettingsSection(
  key: SettingsSectionKey,
  locale: AppLocale = DEFAULT_LOCALE,
): SettingsSectionDefinition {
  const section = sectionByKey.get(key);
  if (!section) throw new Error(`Unknown settings section: ${key}`);
  return localizeSettingsSection(section, locale);
}

export function sortSettingsCoreSections<T extends Pick<SettingsSectionDefinition, "key">>(
  sections: readonly T[],
): T[] {
  return [...sections].sort(
    (left, right) =>
      (settingsCoreSectionOrder.get(left.key) ?? Number.MAX_SAFE_INTEGER) -
      (settingsCoreSectionOrder.get(right.key) ?? Number.MAX_SAFE_INTEGER),
  );
}

export function filterSettingsSectionGroups(
  query: string,
  locale: AppLocale = DEFAULT_LOCALE,
): readonly SettingsSectionGroupDefinition[] {
  const normalizedQuery = query.trim().toLocaleLowerCase();
  const groups = getSettingsSectionGroups(locale);
  if (!normalizedQuery) return groups;

  return groups
    .map((group) => ({
      ...group,
      sections: group.sections.filter((section) =>
        [section.label, section.shortLabel, section.description, ...section.keywords]
          .join(" ")
          .toLocaleLowerCase()
          .includes(normalizedQuery),
      ),
    }))
    .filter((group) => group.sections.length > 0);
}

function localizeSettingsSection(
  section: SettingsSectionDefinition,
  locale: AppLocale,
): SettingsSectionDefinition {
  const keys = sectionPresentationKeys[section.key];
  return {
    ...section,
    label: translateMessage(locale, keys.label),
    shortLabel: translateMessage(locale, keys.shortLabel),
    description: translateMessage(locale, keys.description),
    keywords: translateMessage(locale, keys.keywords).split("|"),
  };
}
