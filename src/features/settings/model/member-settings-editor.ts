import {
  canRoleReceiveStorePermissionGrant,
  normalizeStorePermissionGrants,
} from "@/entities/staff/model/store-permission-policy";
import type {
  ApprovedStoreRole,
  StoreMember,
  StorePermissionAction,
  StoreRole,
} from "@/lib/repairdesk/types";
import { DEFAULT_LOCALE, type AppLocale } from "@/shared/i18n/locales";
import { translateMessage, type MessageKey } from "@/shared/i18n/messages";

export type MemberPermissionGroup = "history-finance" | "suppliers";

export interface MemberPermissionOption {
  action: StorePermissionAction;
  label: string;
  description: string;
  group: MemberPermissionGroup;
  sensitive?: boolean;
}

export interface MemberEditorDraft {
  role: ApprovedStoreRole;
  permissions: StorePermissionAction[];
}

export const MEMBER_PERMISSION_OPTIONS: readonly MemberPermissionOption[] = [
  {
    action: "order:archive_browse",
    label: "浏览历史归档",
    description: "可浏览当前店铺的完整历史工单。",
    group: "history-finance",
    sensitive: true,
  },
  {
    action: "finance:aggregate_read",
    label: "查看业绩汇总",
    description: "可查看店铺级金额汇总。",
    group: "history-finance",
    sensitive: true,
  },
  {
    action: "finance:profit_read",
    label: "查看成本利润",
    description: "可查看库存和回收业务的成本与利润。",
    group: "history-finance",
    sensitive: true,
  },
  {
    action: "finance:cost_manage",
    label: "管理库存与采购成本",
    description: "可管理库存成本、采购批次成本及相关财务数据。",
    group: "history-finance",
    sensitive: true,
  },
  {
    action: "finance:cost_export",
    label: "导出维修成本与毛利",
    description: "包含成本利润查看权限，并可导出脱敏财务明细。",
    group: "history-finance",
    sensitive: true,
  },
  {
    action: "finance:cost_backfill_preview",
    label: "预览历史成本回填",
    description: "包含成本管理权限，可生成历史成本候选；不能批量应用。",
    group: "history-finance",
    sensitive: true,
  },
  {
    action: "inventory:cost_allocate",
    label: "分配库存采购成本",
    description: "可将采购批次成本分配到库存与配件采购记录。",
    group: "history-finance",
    sensitive: true,
  },
  {
    action: "supplier:read",
    label: "查看供应商",
    description: "可读取当前店铺的供应商资料。",
    group: "suppliers",
  },
  {
    action: "supplier:assign",
    label: "选择供应商",
    description: "包含查看权限，并可在工单中选择供应商。",
    group: "suppliers",
  },
  {
    action: "supplier:manage",
    label: "管理供应商",
    description: "包含查看和选择权限，并可新增、编辑或归档。",
    group: "suppliers",
    sensitive: true,
  },
] as const;

export const MEMBER_ROLE_LABELS: Record<StoreRole, string> = {
  owner: "店主",
  manager: "店长",
  technician: "技师",
  sales: "前台",
  viewer: "受限只读",
};

export const MEMBER_STATUS_LABELS: Record<StoreMember["status"], string> = {
  active: "正常",
  inactive: "已停用",
  invited: "待接受",
};

const memberRoleLabelKeys: Record<StoreRole, MessageKey> = {
  owner: "settings.members.role.owner",
  manager: "settings.members.role.manager",
  technician: "settings.members.role.technician",
  sales: "settings.members.role.sales",
  viewer: "settings.members.role.viewer",
};

const memberStatusLabelKeys: Record<StoreMember["status"], MessageKey> = {
  active: "settings.members.status.active",
  inactive: "settings.members.status.inactive",
  invited: "settings.members.status.invited",
};

const memberPermissionPresentationKeys: Record<
  StorePermissionAction,
  { label: MessageKey; description: MessageKey }
> = {
  "order:archive_browse": {
    label: "settings.members.permission.archiveBrowse.label",
    description: "settings.members.permission.archiveBrowse.description",
  },
  "finance:aggregate_read": {
    label: "settings.members.permission.aggregateRead.label",
    description: "settings.members.permission.aggregateRead.description",
  },
  "finance:profit_read": {
    label: "settings.members.permission.profitRead.label",
    description: "settings.members.permission.profitRead.description",
  },
  "finance:cost_manage": {
    label: "settings.members.permission.costManage.label",
    description: "settings.members.permission.costManage.description",
  },
  "finance:cost_export": {
    label: "settings.members.permission.costExport.label",
    description: "settings.members.permission.costExport.description",
  },
  "finance:cost_backfill_preview": {
    label: "settings.members.permission.costBackfillPreview.label",
    description: "settings.members.permission.costBackfillPreview.description",
  },
  "inventory:cost_allocate": {
    label: "settings.members.permission.costAllocate.label",
    description: "settings.members.permission.costAllocate.description",
  },
  "supplier:read": {
    label: "settings.members.permission.supplierRead.label",
    description: "settings.members.permission.supplierRead.description",
  },
  "supplier:assign": {
    label: "settings.members.permission.supplierAssign.label",
    description: "settings.members.permission.supplierAssign.description",
  },
  "supplier:manage": {
    label: "settings.members.permission.supplierManage.label",
    description: "settings.members.permission.supplierManage.description",
  },
};

export function getMemberRoleLabels(locale: AppLocale = DEFAULT_LOCALE) {
  return Object.fromEntries(
    Object.entries(memberRoleLabelKeys).map(([role, key]) => [role, translateMessage(locale, key)]),
  ) as Record<StoreRole, string>;
}

export function getMemberStatusLabels(locale: AppLocale = DEFAULT_LOCALE) {
  return Object.fromEntries(
    Object.entries(memberStatusLabelKeys).map(([status, key]) => [
      status,
      translateMessage(locale, key),
    ]),
  ) as Record<StoreMember["status"], string>;
}

export function getMemberPermissionOptions(locale: AppLocale = DEFAULT_LOCALE) {
  return MEMBER_PERMISSION_OPTIONS.map((option) => {
    const keys = memberPermissionPresentationKeys[option.action];
    return {
      ...option,
      label: translateMessage(locale, keys.label),
      description: translateMessage(locale, keys.description),
    };
  });
}

export function toApprovedRole(role?: StoreRole): ApprovedStoreRole {
  return role && role !== "owner" ? role : "viewer";
}

export function createMemberEditorDraft(member: StoreMember): MemberEditorDraft {
  const role = toApprovedRole(member.role);
  return {
    role,
    permissions: normalizeStorePermissionGrants(member.permission_grants ?? [], role),
  };
}

export function visibleMemberPermissionOptions(role: StoreRole, orderCostsEnabled = true) {
  return MEMBER_PERMISSION_OPTIONS.filter(
    (option) =>
      (orderCostsEnabled ||
        ![
          "finance:cost_manage",
          "finance:cost_export",
          "finance:cost_backfill_preview",
          "inventory:cost_allocate",
        ].includes(option.action)) &&
      canRoleReceiveStorePermissionGrant(role, option.action),
  );
}

export function updateMemberEditorRole(
  draft: MemberEditorDraft,
  role: ApprovedStoreRole,
): MemberEditorDraft {
  return {
    role,
    permissions: normalizeStorePermissionGrants(draft.permissions, role),
  };
}

export function updateMemberEditorPermission(
  draft: MemberEditorDraft,
  action: StorePermissionAction,
  checked: boolean,
): MemberEditorDraft {
  const next = new Set(normalizeStorePermissionGrants(draft.permissions, draft.role));
  if (checked) {
    next.add(action);
  } else {
    next.delete(action);
    if (action === "supplier:read") {
      next.delete("supplier:assign");
      next.delete("supplier:manage");
    }
    if (action === "supplier:assign") next.delete("supplier:manage");
    if (action === "finance:aggregate_read") next.delete("finance:profit_read");
    if (action === "finance:profit_read") next.delete("finance:cost_export");
    if (action === "finance:cost_manage") {
      next.delete("finance:cost_backfill_preview");
      next.delete("inventory:cost_allocate");
    }
  }
  return {
    ...draft,
    permissions: normalizeStorePermissionGrants(Array.from(next), draft.role),
  };
}

export function isMemberEditorDraftDirty(member: StoreMember, draft: MemberEditorDraft) {
  return isMemberEditorDraftChanged(createMemberEditorDraft(member), draft);
}

export function isMemberEditorDraftChanged(base: MemberEditorDraft, draft: MemberEditorDraft) {
  return (
    base.role !== draft.role ||
    normalizeStorePermissionGrants(base.permissions, base.role).join("|") !==
      normalizeStorePermissionGrants(draft.permissions, draft.role).join("|")
  );
}

export function isSensitiveMemberEditorChange(member: StoreMember, draft: MemberEditorDraft) {
  if (member.role !== "manager" && draft.role === "manager") return true;
  const original = new Set(createMemberEditorDraft(member).permissions);
  return visibleMemberPermissionOptions(draft.role).some(
    (option) =>
      option.sensitive && draft.permissions.includes(option.action) && !original.has(option.action),
  );
}
