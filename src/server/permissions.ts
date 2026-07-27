import type { AuditActor, StorePermissionAction, StoreRole } from "@/lib/repairdesk/types";
import { ForbiddenError } from "@/server/auth-context";
import {
  canRoleReceiveStorePermissionGrant,
  isStorePermissionAction,
} from "@/entities/staff/model/store-permission-policy";

export const permissionRoles = ["owner", "manager", "technician", "sales", "viewer"] as const;

export type PermissionRole = (typeof permissionRoles)[number];

export type PermissionEffect = "allow" | "deny" | "scoped" | "elevated";

export const permissionActions = [
  "workspace:open",
  "order:list",
  "order:detail",
  "order:create",
  "order:update_intake",
  "order:update_repair",
  "order:quote_prepare",
  "order:correct",
  "order:reopen",
  "order:void",
  "order:transition",
  "order:batch_transition",
  "order:workflow_configure",
  "order:photo_upload",
  "order:assign",
  "order:archive_search",
  "order:archive_browse",
  "order:export",
  "order:import_preview",
  "order:import_apply",
  "customer:list",
  "customer:detail",
  "customer:create",
  "customer:update",
  "customer:tag",
  "customer:message",
  "customer:export",
  "finance:order_read",
  "finance:aggregate_read",
  "finance:profit_read",
  "finance:cost_manage",
  "finance:cost_export",
  "finance:cost_backfill_preview",
  "finance:cost_backfill_apply",
  "finance:currency_manage",
  "payment:collect",
  "payment:adjust",
  "payment:refund",
  "payment:override",
  "inventory:read",
  "inventory:create",
  "inventory:update",
  "inventory:quality_check",
  "inventory:sale",
  "inventory:transfer",
  "inventory:write_off",
  "inventory:legacy_import",
  "inventory:cost_allocate",
  "buyback:evidence_capture",
  "buyback:evidence_read",
  "buyback:finalize",
  "settings:update_store",
  "supplier:read",
  "supplier:assign",
  "supplier:manage",
  "settings:update_workflow",
  "settings:update_message_template",
  "member:invite",
  "member:revoke",
  "member:manage_basic",
  "member:grant_manager",
  "member:remove_owner",
  "member:transfer_owner",
  "support:grant",
  "support:view_audit",
  "unlock:read",
  "attachment:read",
  "memo:read",
  "memo:create",
  "memo:update",
  "memo:assign",
  "memo:transition",
  "memo:archive",
  "memo:restore",
] as const;

export type PermissionAction = (typeof permissionActions)[number];

export interface PermissionActionDefinition {
  label: string;
  requiresStore: boolean;
  auditRequired?: boolean;
  sensitive?: boolean;
}

export interface PermissionContext {
  scopeSatisfied?: boolean;
  allowSystemActor?: boolean;
  systemReason?: string;
}

export interface PermissionDecision {
  allowed: boolean;
  action: PermissionAction;
  effect: PermissionEffect;
  role?: PermissionRole;
  reason: string;
  auditRequired: boolean;
  sensitive: boolean;
  scopeRequired?: boolean;
}

type RolePermissionMatrix = Record<PermissionRole, Record<PermissionAction, PermissionEffect>>;

export const permissionActionDefinitions: Record<PermissionAction, PermissionActionDefinition> = {
  "workspace:open": { label: "打开店铺工作台", requiresStore: true },
  "order:list": { label: "查看工单列表", requiresStore: true },
  "order:detail": { label: "查看工单详情", requiresStore: true },
  "order:create": { label: "创建工单", requiresStore: true },
  "order:update_intake": { label: "编辑接待信息", requiresStore: true },
  "order:update_repair": { label: "编辑维修诊断", requiresStore: true },
  "order:quote_prepare": {
    label: "发布维修报价",
    requiresStore: true,
    auditRequired: true,
    sensitive: true,
  },
  "order:correct": {
    label: "纠正已结束工单",
    requiresStore: true,
    auditRequired: true,
    sensitive: true,
  },
  "order:reopen": {
    label: "重新打开已结束工单",
    requiresStore: true,
    auditRequired: true,
    sensitive: true,
  },
  "order:void": {
    label: "作废工单记录",
    requiresStore: true,
    auditRequired: true,
    sensitive: true,
  },
  "order:transition": { label: "流转工单状态", requiresStore: true },
  "order:batch_transition": {
    label: "批量流转工单状态",
    requiresStore: true,
    auditRequired: true,
    sensitive: true,
  },
  "order:workflow_configure": { label: "配置工单流程", requiresStore: true, auditRequired: true },
  "order:photo_upload": { label: "上传工单照片", requiresStore: true },
  "order:assign": { label: "分配工单负责人", requiresStore: true, auditRequired: true },
  "order:archive_search": { label: "搜索历史工单", requiresStore: true, sensitive: true },
  "order:archive_browse": { label: "浏览历史工单", requiresStore: true, sensitive: true },
  "order:export": {
    label: "导出工单",
    requiresStore: true,
    auditRequired: true,
    sensitive: true,
  },
  "order:import_preview": {
    label: "预览工单导入",
    requiresStore: true,
    auditRequired: true,
    sensitive: true,
  },
  "order:import_apply": {
    label: "应用工单导入",
    requiresStore: true,
    auditRequired: true,
    sensitive: true,
  },
  "customer:list": { label: "查看客户列表", requiresStore: true, sensitive: true },
  "customer:detail": { label: "查看客户详情", requiresStore: true, sensitive: true },
  "customer:create": { label: "创建客户", requiresStore: true },
  "customer:update": { label: "编辑客户", requiresStore: true },
  "customer:tag": { label: "编辑客户标签", requiresStore: true },
  "customer:message": { label: "发送客户消息", requiresStore: true, auditRequired: true },
  "customer:export": {
    label: "导出客户",
    requiresStore: true,
    auditRequired: true,
    sensitive: true,
  },
  "finance:order_read": { label: "查看单张工单金额", requiresStore: true, sensitive: true },
  "finance:aggregate_read": {
    label: "查看店铺财务汇总",
    requiresStore: true,
    auditRequired: true,
    sensitive: true,
  },
  "finance:profit_read": {
    label: "查看成本和利润",
    requiresStore: true,
    auditRequired: true,
    sensitive: true,
  },
  "finance:cost_manage": {
    label: "管理维修项目成本",
    requiresStore: true,
    auditRequired: true,
    sensitive: true,
  },
  "finance:cost_export": {
    label: "导出维修成本与毛利",
    requiresStore: true,
    auditRequired: true,
    sensitive: true,
  },
  "finance:cost_backfill_preview": {
    label: "预览历史维修成本回填",
    requiresStore: true,
    auditRequired: true,
    sensitive: true,
  },
  "finance:cost_backfill_apply": {
    label: "应用或撤销历史维修成本回填",
    requiresStore: true,
    auditRequired: true,
    sensitive: true,
  },
  "finance:currency_manage": {
    label: "管理采购成本币种与汇率",
    requiresStore: true,
    auditRequired: true,
    sensitive: true,
  },
  "payment:collect": { label: "收款", requiresStore: true, auditRequired: true },
  "payment:adjust": { label: "修正收款", requiresStore: true, auditRequired: true },
  "payment:refund": { label: "退款", requiresStore: true, auditRequired: true },
  "payment:override": { label: "强制修改付款状态", requiresStore: true, auditRequired: true },
  "inventory:read": { label: "查看库存业务资料", requiresStore: true },
  "inventory:create": { label: "创建库存", requiresStore: true },
  "inventory:update": { label: "编辑库存", requiresStore: true },
  "inventory:quality_check": { label: "库存质检", requiresStore: true },
  "inventory:sale": { label: "库存销售", requiresStore: true, auditRequired: true },
  "inventory:transfer": { label: "库存转移", requiresStore: true, auditRequired: true },
  "inventory:write_off": { label: "库存报损", requiresStore: true, auditRequired: true },
  "inventory:legacy_import": {
    label: "导入历史库存与回收流水",
    requiresStore: true,
    auditRequired: true,
    sensitive: true,
  },
  "inventory:cost_allocate": {
    label: "分配维修配件采购批次",
    requiresStore: true,
    auditRequired: true,
    sensitive: true,
  },
  "buyback:evidence_capture": {
    label: "采集回收证件与签名",
    requiresStore: true,
    auditRequired: true,
    sensitive: true,
  },
  "buyback:evidence_read": {
    label: "查看回收证件与签名",
    requiresStore: true,
    auditRequired: true,
    sensitive: true,
  },
  "buyback:finalize": {
    label: "确认回收成交并付款入库",
    requiresStore: true,
    auditRequired: true,
    sensitive: true,
  },
  "settings:update_store": { label: "更新店铺设置", requiresStore: true, auditRequired: true },
  "supplier:read": {
    label: "查看供应商",
    requiresStore: true,
    auditRequired: true,
    sensitive: true,
  },
  "supplier:assign": {
    label: "选择订单供应商",
    requiresStore: true,
    auditRequired: true,
    sensitive: true,
  },
  "supplier:manage": {
    label: "管理供应商",
    requiresStore: true,
    auditRequired: true,
    sensitive: true,
  },
  "settings:update_workflow": { label: "更新流程设置", requiresStore: true, auditRequired: true },
  "settings:update_message_template": {
    label: "更新消息模板",
    requiresStore: true,
    auditRequired: true,
  },
  "member:invite": { label: "邀请成员", requiresStore: true, auditRequired: true },
  "member:revoke": { label: "移除成员", requiresStore: true, auditRequired: true },
  "member:manage_basic": { label: "管理普通成员", requiresStore: true, auditRequired: true },
  "member:grant_manager": { label: "授予店长", requiresStore: true, auditRequired: true },
  "member:remove_owner": {
    label: "移除店主",
    requiresStore: true,
    auditRequired: true,
    sensitive: true,
  },
  "member:transfer_owner": {
    label: "转移店主",
    requiresStore: true,
    auditRequired: true,
    sensitive: true,
  },
  "support:grant": {
    label: "授权平台支持访问",
    requiresStore: true,
    auditRequired: true,
    sensitive: true,
  },
  "support:view_audit": { label: "查看支持访问审计", requiresStore: true, sensitive: true },
  "unlock:read": {
    label: "查看设备解锁信息",
    requiresStore: true,
    auditRequired: true,
    sensitive: true,
  },
  "attachment:read": {
    label: "查看附件或签名链接",
    requiresStore: true,
    auditRequired: true,
    sensitive: true,
  },
  "memo:read": { label: "查看本店铺备忘录", requiresStore: true, sensitive: true },
  "memo:create": { label: "创建本店铺备忘录", requiresStore: true },
  "memo:update": { label: "编辑本店铺备忘录", requiresStore: true, auditRequired: true },
  "memo:assign": { label: "分配本店铺待办", requiresStore: true, auditRequired: true },
  "memo:transition": { label: "流转本店铺待办", requiresStore: true, auditRequired: true },
  "memo:archive": { label: "归档本店铺备忘录", requiresStore: true, auditRequired: true },
  "memo:restore": { label: "恢复本店铺备忘录", requiresStore: true, auditRequired: true },
};

const allow: PermissionEffect = "allow";
const deny: PermissionEffect = "deny";
const scoped: PermissionEffect = "scoped";
const elevated: PermissionEffect = "elevated";

export const rolePermissions: RolePermissionMatrix = {
  owner: {
    "workspace:open": allow,
    "order:list": allow,
    "order:detail": allow,
    "order:create": allow,
    "order:update_intake": allow,
    "order:update_repair": allow,
    "order:quote_prepare": allow,
    "order:correct": allow,
    "order:reopen": allow,
    "order:void": allow,
    "order:transition": allow,
    "order:batch_transition": allow,
    "order:workflow_configure": allow,
    "order:photo_upload": allow,
    "order:assign": allow,
    "order:archive_search": allow,
    "order:archive_browse": allow,
    "order:export": allow,
    "order:import_preview": allow,
    "order:import_apply": allow,
    "customer:list": allow,
    "customer:detail": allow,
    "customer:create": allow,
    "customer:update": allow,
    "customer:tag": allow,
    "customer:message": allow,
    "customer:export": allow,
    "finance:order_read": allow,
    "finance:aggregate_read": allow,
    "finance:profit_read": allow,
    "finance:cost_manage": allow,
    "finance:cost_export": allow,
    "finance:cost_backfill_preview": allow,
    "finance:cost_backfill_apply": allow,
    "finance:currency_manage": allow,
    "payment:collect": allow,
    "payment:adjust": allow,
    "payment:refund": allow,
    "payment:override": allow,
    "inventory:read": allow,
    "inventory:create": allow,
    "inventory:update": allow,
    "inventory:quality_check": allow,
    "inventory:sale": allow,
    "inventory:transfer": allow,
    "inventory:write_off": allow,
    "inventory:legacy_import": allow,
    "inventory:cost_allocate": allow,
    "buyback:evidence_capture": allow,
    "buyback:evidence_read": allow,
    "buyback:finalize": allow,
    "settings:update_store": allow,
    "supplier:read": allow,
    "supplier:assign": allow,
    "supplier:manage": allow,
    "settings:update_workflow": allow,
    "settings:update_message_template": allow,
    "member:invite": allow,
    "member:revoke": allow,
    "member:manage_basic": allow,
    "member:grant_manager": allow,
    "member:remove_owner": elevated,
    "member:transfer_owner": elevated,
    "support:grant": allow,
    "support:view_audit": allow,
    "unlock:read": allow,
    "attachment:read": allow,
    "memo:read": allow,
    "memo:create": allow,
    "memo:update": allow,
    "memo:assign": allow,
    "memo:transition": allow,
    "memo:archive": allow,
    "memo:restore": allow,
  },
  manager: {
    "workspace:open": allow,
    "order:list": allow,
    "order:detail": allow,
    "order:create": allow,
    "order:update_intake": allow,
    "order:update_repair": allow,
    "order:quote_prepare": allow,
    "order:correct": allow,
    "order:reopen": allow,
    "order:void": deny,
    "order:transition": allow,
    "order:batch_transition": allow,
    "order:workflow_configure": allow,
    "order:photo_upload": allow,
    "order:assign": allow,
    "order:archive_search": allow,
    "order:archive_browse": deny,
    "order:export": deny,
    "order:import_preview": deny,
    "order:import_apply": deny,
    "customer:list": allow,
    "customer:detail": allow,
    "customer:create": allow,
    "customer:update": allow,
    "customer:tag": allow,
    "customer:message": allow,
    "customer:export": deny,
    "finance:order_read": allow,
    "finance:aggregate_read": deny,
    "finance:profit_read": deny,
    "finance:cost_manage": deny,
    "finance:cost_export": deny,
    "finance:cost_backfill_preview": deny,
    "finance:cost_backfill_apply": deny,
    "finance:currency_manage": deny,
    "payment:collect": allow,
    "payment:adjust": allow,
    "payment:refund": allow,
    "payment:override": allow,
    "inventory:read": allow,
    "inventory:create": allow,
    "inventory:update": allow,
    "inventory:quality_check": allow,
    "inventory:sale": allow,
    "inventory:transfer": allow,
    "inventory:write_off": allow,
    "inventory:legacy_import": deny,
    "inventory:cost_allocate": deny,
    "buyback:evidence_capture": allow,
    "buyback:evidence_read": allow,
    "buyback:finalize": allow,
    "settings:update_store": allow,
    "supplier:read": deny,
    "supplier:assign": deny,
    "supplier:manage": deny,
    "settings:update_workflow": allow,
    "settings:update_message_template": allow,
    "member:invite": allow,
    "member:revoke": allow,
    "member:manage_basic": allow,
    "member:grant_manager": deny,
    "member:remove_owner": deny,
    "member:transfer_owner": deny,
    "support:grant": deny,
    "support:view_audit": allow,
    "unlock:read": allow,
    "attachment:read": allow,
    "memo:read": allow,
    "memo:create": allow,
    "memo:update": allow,
    "memo:assign": allow,
    "memo:transition": allow,
    "memo:archive": allow,
    "memo:restore": allow,
  },
  technician: {
    "workspace:open": allow,
    "order:list": scoped,
    "order:detail": scoped,
    "order:create": allow,
    "order:update_intake": scoped,
    "order:update_repair": scoped,
    "order:quote_prepare": deny,
    "order:correct": deny,
    "order:reopen": deny,
    "order:void": deny,
    "order:transition": scoped,
    "order:batch_transition": deny,
    "order:workflow_configure": deny,
    "order:photo_upload": scoped,
    "order:assign": deny,
    "order:archive_search": scoped,
    "order:archive_browse": deny,
    "order:export": deny,
    "order:import_preview": deny,
    "order:import_apply": deny,
    "customer:list": scoped,
    "customer:detail": scoped,
    "customer:create": scoped,
    "customer:update": scoped,
    "customer:tag": scoped,
    "customer:message": scoped,
    "customer:export": deny,
    "finance:order_read": allow,
    "finance:aggregate_read": deny,
    "finance:profit_read": deny,
    "finance:cost_manage": deny,
    "finance:cost_export": deny,
    "finance:cost_backfill_preview": deny,
    "finance:cost_backfill_apply": deny,
    "finance:currency_manage": deny,
    "payment:collect": deny,
    "payment:adjust": deny,
    "payment:refund": deny,
    "payment:override": deny,
    "inventory:read": allow,
    "inventory:create": allow,
    "inventory:update": allow,
    "inventory:quality_check": allow,
    "inventory:sale": elevated,
    "inventory:transfer": elevated,
    "inventory:write_off": elevated,
    "inventory:legacy_import": deny,
    "inventory:cost_allocate": deny,
    "buyback:evidence_capture": deny,
    "buyback:evidence_read": deny,
    "buyback:finalize": deny,
    "settings:update_store": deny,
    "supplier:read": deny,
    "supplier:assign": deny,
    "supplier:manage": deny,
    "settings:update_workflow": deny,
    "settings:update_message_template": deny,
    "member:invite": deny,
    "member:revoke": deny,
    "member:manage_basic": deny,
    "member:grant_manager": deny,
    "member:remove_owner": deny,
    "member:transfer_owner": deny,
    "support:grant": deny,
    "support:view_audit": deny,
    "unlock:read": scoped,
    "attachment:read": scoped,
    "memo:read": allow,
    "memo:create": allow,
    "memo:update": scoped,
    "memo:assign": scoped,
    "memo:transition": scoped,
    "memo:archive": deny,
    "memo:restore": deny,
  },
  sales: {
    "workspace:open": allow,
    "order:list": allow,
    "order:detail": allow,
    "order:create": allow,
    "order:update_intake": allow,
    "order:update_repair": scoped,
    "order:quote_prepare": allow,
    "order:correct": deny,
    "order:reopen": deny,
    "order:void": deny,
    "order:transition": allow,
    "order:batch_transition": deny,
    "order:workflow_configure": deny,
    "order:photo_upload": allow,
    "order:assign": allow,
    "order:archive_search": allow,
    "order:archive_browse": deny,
    "order:export": deny,
    "order:import_preview": deny,
    "order:import_apply": deny,
    "customer:list": allow,
    "customer:detail": allow,
    "customer:create": allow,
    "customer:update": allow,
    "customer:tag": allow,
    "customer:message": allow,
    "customer:export": deny,
    "finance:order_read": allow,
    "finance:aggregate_read": deny,
    "finance:profit_read": deny,
    "finance:cost_manage": deny,
    "finance:cost_export": deny,
    "finance:cost_backfill_preview": deny,
    "finance:cost_backfill_apply": deny,
    "finance:currency_manage": deny,
    "payment:collect": allow,
    "payment:adjust": deny,
    "payment:refund": deny,
    "payment:override": deny,
    "inventory:read": allow,
    "inventory:create": allow,
    "inventory:update": allow,
    "inventory:quality_check": deny,
    "inventory:sale": allow,
    "inventory:transfer": elevated,
    "inventory:write_off": elevated,
    "inventory:legacy_import": deny,
    "inventory:cost_allocate": deny,
    "buyback:evidence_capture": deny,
    "buyback:evidence_read": deny,
    "buyback:finalize": deny,
    "settings:update_store": deny,
    "supplier:read": deny,
    "supplier:assign": deny,
    "supplier:manage": deny,
    "settings:update_workflow": deny,
    "settings:update_message_template": deny,
    "member:invite": deny,
    "member:revoke": deny,
    "member:manage_basic": deny,
    "member:grant_manager": deny,
    "member:remove_owner": deny,
    "member:transfer_owner": deny,
    "support:grant": deny,
    "support:view_audit": deny,
    "unlock:read": elevated,
    "attachment:read": scoped,
    "memo:read": allow,
    "memo:create": allow,
    "memo:update": scoped,
    "memo:assign": scoped,
    "memo:transition": scoped,
    "memo:archive": deny,
    "memo:restore": deny,
  },
  viewer: {
    "workspace:open": allow,
    "order:list": scoped,
    "order:detail": scoped,
    "order:create": deny,
    "order:update_intake": deny,
    "order:update_repair": deny,
    "order:quote_prepare": deny,
    "order:correct": deny,
    "order:reopen": deny,
    "order:void": deny,
    "order:transition": deny,
    "order:batch_transition": deny,
    "order:workflow_configure": deny,
    "order:photo_upload": deny,
    "order:assign": deny,
    "order:archive_search": deny,
    "order:archive_browse": deny,
    "order:export": deny,
    "order:import_preview": deny,
    "order:import_apply": deny,
    "customer:list": scoped,
    "customer:detail": scoped,
    "customer:create": deny,
    "customer:update": deny,
    "customer:tag": deny,
    "customer:message": deny,
    "customer:export": deny,
    "finance:order_read": deny,
    "finance:aggregate_read": deny,
    "finance:profit_read": deny,
    "finance:cost_manage": deny,
    "finance:cost_export": deny,
    "finance:cost_backfill_preview": deny,
    "finance:cost_backfill_apply": deny,
    "finance:currency_manage": deny,
    "payment:collect": deny,
    "payment:adjust": deny,
    "payment:refund": deny,
    "payment:override": deny,
    "inventory:read": deny,
    "inventory:create": deny,
    "inventory:update": deny,
    "inventory:quality_check": deny,
    "inventory:sale": deny,
    "inventory:transfer": deny,
    "inventory:write_off": deny,
    "inventory:legacy_import": deny,
    "inventory:cost_allocate": deny,
    "buyback:evidence_capture": deny,
    "buyback:evidence_read": deny,
    "buyback:finalize": deny,
    "settings:update_store": deny,
    "supplier:read": deny,
    "supplier:assign": deny,
    "supplier:manage": deny,
    "settings:update_workflow": deny,
    "settings:update_message_template": deny,
    "member:invite": deny,
    "member:revoke": deny,
    "member:manage_basic": deny,
    "member:grant_manager": deny,
    "member:remove_owner": deny,
    "member:transfer_owner": deny,
    "support:grant": deny,
    "support:view_audit": deny,
    "unlock:read": deny,
    "attachment:read": scoped,
    "memo:read": allow,
    "memo:create": deny,
    "memo:update": deny,
    "memo:assign": deny,
    "memo:transition": deny,
    "memo:archive": deny,
    "memo:restore": deny,
  },
};

export function getPermissionDecision(
  actor: AuditActor | undefined | null,
  action: PermissionAction,
  context: PermissionContext = {},
): PermissionDecision {
  const definition = permissionActionDefinitions[action];
  const denied = (reason: string, effect: PermissionEffect = "deny"): PermissionDecision => ({
    allowed: false,
    action,
    effect,
    reason,
    auditRequired: Boolean(definition?.auditRequired),
    sensitive: Boolean(definition?.sensitive),
  });

  if (!definition) return denied("unknown_action");
  if (!actor) return denied("missing_actor");
  if (actor.isSystem && !context.allowSystemActor) return denied("system_actor_requires_context");
  if (definition.requiresStore && !actor.storeId) return denied("missing_store");

  const role = resolvePermissionRole(actor);
  if (!role) return denied("unknown_role");

  const effect = rolePermissions[role][action] ?? deny;
  const baseDecision = {
    action,
    effect,
    role,
    auditRequired: Boolean(definition.auditRequired),
    sensitive: Boolean(definition.sensitive),
  };

  if (effect === "allow") {
    return { ...baseDecision, allowed: true, reason: "allowed" };
  }

  if (hasGrantedPermission(actor, action)) {
    return { ...baseDecision, allowed: true, reason: "explicit_grant" };
  }

  if (effect === "scoped") {
    return {
      ...baseDecision,
      allowed: Boolean(context.scopeSatisfied),
      reason: context.scopeSatisfied ? "scoped_allowed" : "scope_required",
      scopeRequired: true,
    };
  }

  if (effect === "elevated") {
    return { ...baseDecision, allowed: false, reason: "elevated_approval_required" };
  }

  return { ...baseDecision, allowed: false, reason: "denied" };
}

export function can(
  actor: AuditActor | undefined | null,
  action: PermissionAction,
  context?: PermissionContext,
) {
  return getPermissionDecision(actor, action, context).allowed;
}

export function assertPermission(
  actor: AuditActor | undefined | null,
  action: PermissionAction,
  context?: PermissionContext,
) {
  const decision = getPermissionDecision(actor, action, context);
  if (!decision.allowed) {
    throw new ForbiddenError();
  }
  return decision;
}

export function resolvePermissionRole(actor: Pick<AuditActor, "storeRole" | "role">) {
  const role = actor.storeRole ?? actor.role;
  return isPermissionRole(role) ? role : undefined;
}

export function isPermissionRole(value: unknown): value is PermissionRole {
  return permissionRoles.includes(value as PermissionRole);
}

export function isPermissionAction(value: unknown): value is PermissionAction {
  return permissionActions.includes(value as PermissionAction);
}

export function isStoreRoleFrontdesk(role: StoreRole) {
  return role === "sales";
}

function hasGrantedPermission(actor: AuditActor, action: PermissionAction) {
  if (!isGrantablePermissionAction(action)) return false;
  const role = resolvePermissionRole(actor);
  if (!role || !canRoleReceiveStorePermissionGrant(role, action)) return false;
  const grants = new Set(actor.permissionGrants ?? []);
  if (grants.has(action)) return true;
  if (action === "supplier:read") {
    return grants.has("supplier:assign") || grants.has("supplier:manage");
  }
  if (action === "supplier:assign") {
    return grants.has("supplier:manage");
  }
  return false;
}

export function isGrantablePermissionAction(
  action: PermissionAction,
): action is StorePermissionAction {
  return isStorePermissionAction(action);
}
