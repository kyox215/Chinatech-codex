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

export interface MemberPermissionOption {
  action: StorePermissionAction;
  label: string;
  description: string;
  group: "历史与财务" | "供应商";
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
    group: "历史与财务",
    sensitive: true,
  },
  {
    action: "finance:aggregate_read",
    label: "查看业绩汇总",
    description: "可查看店铺级金额汇总。",
    group: "历史与财务",
    sensitive: true,
  },
  {
    action: "finance:profit_read",
    label: "查看成本利润",
    description: "可查看库存和回收业务的成本与利润。",
    group: "历史与财务",
    sensitive: true,
  },
  {
    action: "supplier:read",
    label: "查看供应商",
    description: "可读取当前店铺的供应商资料。",
    group: "供应商",
  },
  {
    action: "supplier:assign",
    label: "选择供应商",
    description: "包含查看权限，并可在工单中选择供应商。",
    group: "供应商",
  },
  {
    action: "supplier:manage",
    label: "管理供应商",
    description: "包含查看和选择权限，并可新增、编辑或归档。",
    group: "供应商",
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

export function visibleMemberPermissionOptions(role: StoreRole) {
  return MEMBER_PERMISSION_OPTIONS.filter((option) =>
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
