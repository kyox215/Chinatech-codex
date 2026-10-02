export const permissionLabels = {
  "retail.view": "查看整机", "retail.edit": "录入与更正整机", "retail.inspect": "检测与上架", "retail.price": "调整售价", "retail.sell": "售卖与预留",
  "sale.payment": "登记收款", "sale.reconcile": "核对与冲销收款", "sale.deliver": "确认交付", "sale.debt": "欠款放行", "sale.refund": "退回与退款", "sale.aftersales": "售后服务",
  "financial.read": "查看成本、利润与经营收支", "financial.edit": "更正成本与经营收支", "repairs.view": "查看维修与采购", "repairs.edit": "维修与采购操作", "customers.view": "查看客户", "customers.edit": "维护客户资料",
  "settings.edit": "门店、供应商与打印设置", "staff.manage": "管理员工权限",
} as const;
export type Permission = keyof typeof permissionLabels;
export const allPermissions = Object.keys(permissionLabels) as Permission[];
export const staffRoles = { owner: "老板", manager: "店长", sales: "销售", technician: "技术员", viewer: "只读" } as const;
export type StaffRole = keyof typeof staffRoles;
export type StaffStatus = "pending" | "active" | "disabled";
export type StaffMember = { id: string; name: string; email: string; role: StaffRole; accountStatus: StaffStatus; membershipStatus: StaffStatus; permissions: Permission[]; revision: number };
export type StaffAudit = { id: string; actorId: string; actorName: string; targetId: string; time: string; before: Pick<StaffMember,"role"|"accountStatus"|"membershipStatus"|"permissions"> | null; after: Pick<StaffMember,"role"|"accountStatus"|"membershipStatus"|"permissions"> };
export type StaffData = { revision: number; currentId: string; members: StaffMember[]; audit: StaffAudit[] };
const basic: Permission[] = ["retail.view","repairs.view","customers.view"];
export function rolePermissions(role: StaffRole): Permission[] {
  if (role === "owner") return [...allPermissions];
  if (role === "manager") return [...basic,"retail.edit","retail.inspect","retail.price","retail.sell","sale.payment","sale.deliver","sale.aftersales","repairs.edit","customers.edit","settings.edit"];
  if (role === "sales") return [...basic,"retail.edit","retail.price","retail.sell","sale.payment","sale.deliver","sale.aftersales","customers.edit"];
  if (role === "technician") return [...basic,"retail.edit","retail.inspect","repairs.edit","sale.aftersales"];
  return [...basic];
}
export function isActiveMember(member: StaffMember | null | undefined): member is StaffMember {
  return Boolean(member && typeof member.id === "string" && member.id && Object.hasOwn(staffRoles, member.role)
    && member.accountStatus === "active" && member.membershipStatus === "active"
    && Array.isArray(member.permissions) && member.permissions.every(permission => Object.hasOwn(permissionLabels, permission)));
}
export function can(member: StaffMember | null | undefined, permission: Permission): boolean { return Object.hasOwn(permissionLabels,permission) && isActiveMember(member) && member.permissions.includes(permission); }
function validAuditTime(value: unknown): value is string {
  if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2} \d{2}:\d{2}(:\d{2})?$/.test(value) || value.startsWith("0000")) return false;
  const date = new Date(value.slice(0, 10) + "T00:00:00Z");
  return Number.isFinite(date.getTime()) && date.toISOString().slice(0, 10) === value.slice(0, 10)
    && Number(value.slice(11, 13)) < 24 && Number(value.slice(14, 16)) < 60 && Number(value.slice(17, 19) || 0) < 60;
}
function validAuditState(value: StaffAudit["after"]): StaffAudit["after"] {
  if (!value || typeof value !== "object" || Array.isArray(value) || Object.keys(value).sort().join(",") !== "accountStatus,membershipStatus,permissions,role") throw new Error("员工权限历史格式异常。");
  const member = validMember({ ...value, id: "audit", name: "DEMO", email: "audit@demo.local", revision: 1 });
  return { role: member.role, accountStatus: member.accountStatus, membershipStatus: member.membershipStatus, permissions: member.permissions };
}
function validMember(value: StaffMember) {
  if (!value || typeof value.id !== "string" || !value.id.trim() || value.id.trim() !== value.id || value.id.length > 100 || typeof value.name !== "string" || !value.name.trim() || value.name.length > 80 || typeof value.email !== "string" || value.email.length > 160 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value.email) || !Object.hasOwn(staffRoles,value.role) || ![value.accountStatus,value.membershipStatus].every(status => ["pending","active","disabled"].includes(status)) || !Number.isSafeInteger(value.revision) || value.revision < 1 || !Array.isArray(value.permissions) || new Set(value.permissions).size !== value.permissions.length || value.permissions.some(permission => !Object.hasOwn(permissionLabels,permission))) throw new Error("请核对员工称呼、账号标识、状态和权限。");
  if (value.permissions.includes("financial.edit") && !value.permissions.includes("financial.read")) throw new Error("更正财务资料需要同时允许查看财务资料。");
  if (value.role === "owner" && (value.permissions.length !== allPermissions.length || allPermissions.some(permission=>!value.permissions.includes(permission)))) throw new Error("老板权限资料异常。");
  return { ...value, name:value.name.trim(),email:value.email.trim().toLowerCase(),permissions:[...value.permissions] };
}
export const defaultStaffData: StaffData = { revision: 0, currentId: "DEMO-OWNER", members: (Object.keys(staffRoles) as StaffRole[]).map(role => ({ id:"DEMO-"+role.toUpperCase(),name:role === "owner" ? "塔赫桑" : "DEMO "+staffRoles[role],email:role+"@demo.chinatech.local",role,accountStatus:"active",membershipStatus:"active",permissions:rolePermissions(role),revision:1 })),audit:[] };
export function parseStaffData(raw: string | null): StaffData {
  if (raw === null) return structuredClone(defaultStaffData);
  const parsed = JSON.parse(raw);
  const data: StaffData = parsed?.data;
  if (parsed?.version !== 1 || !data || !Number.isSafeInteger(data.revision) || data.revision < 0 || typeof data.currentId !== "string" || !Array.isArray(data.members) || data.members.length < 1 || data.members.length > 100 || !Array.isArray(data.audit) || data.audit.length > 2000) throw new Error("员工预览资料格式异常，现有资料未被覆盖。");
  const members = data.members.map(validMember);
  if (new Set(members.map(member=>member.id)).size !== members.length || new Set(members.map(member=>member.email)).size !== members.length || !members.some(member=>member.role === "owner" && isActiveMember(member))) throw new Error("员工账号重复或缺少有效老板。");
  const audit = data.audit.map(entry => {
    if (!entry || ![entry.id,entry.actorId,entry.actorName,entry.targetId].every(value=>typeof value === "string" && value.trim().length > 0 && value.length <= 100) || !validAuditTime(entry.time)) throw new Error("员工权限历史格式异常。");
    return { ...entry, before: entry.before === null ? null : validAuditState(entry.before), after: validAuditState(entry.after) };
  });
  if (new Set(audit.map(entry => entry.id)).size !== audit.length) throw new Error("员工权限历史标识重复。");
  return { ...data,members,audit };
}
export function updateStaffMember(data: StaffData, draft: StaffMember, expectedRevision: number, actorId: string, auditId: string, time: string): StaffData {
  if (data.revision !== expectedRevision) throw new Error("员工资料或预览身份已变化，请重新打开核对。");
  const actor = data.members.find(member=>member.id === actorId);
  if (data.currentId !== actorId || !can(actor,"staff.manage")) throw new Error("当前账号没有管理员工的权限。");
  const previous = data.members.find(member=>member.id === draft.id);
  if ((previous?.revision ?? 0) !== draft.revision) throw new Error("该员工资料已更新，请重新核对。");
  const next = validMember({...draft,revision:draft.revision+1});
  if ((previous?.role === "owner" || next.role === "owner") && actor!.role !== "owner") throw new Error("有限员工管理员不能修改或授予老板身份。");
  if (next.role === "owner" && previous?.role !== "owner") throw new Error("老板身份不通过员工表单授予。");
  if (previous?.id === actorId && (previous.role !== next.role || previous.accountStatus !== next.accountStatus || previous.membershipStatus !== next.membershipStatus || JSON.stringify([...previous.permissions].sort()) !== JSON.stringify([...next.permissions].sort()))) throw new Error("不能更改自己的角色、状态或权限。");
  if (next.role === "owner" && JSON.stringify([...next.permissions].sort()) !== JSON.stringify([...allPermissions].sort())) throw new Error("老板能力不能通过普通员工表单更改。");
  if (next.permissions.some(permission=>!actor!.permissions.includes(permission))) throw new Error("不能授予当前账号无权分配的能力。");
  if (data.members.some(member=>member.id !== next.id && member.email === next.email)) throw new Error("该账号标识已被其他员工使用。");
  if (!previous && data.members.length >= 100 || data.audit.length >= 2000) throw new Error("本地员工资料或权限历史已达到上限。");
  const members = previous ? data.members.map(member=>member.id === next.id ? next : member) : [...data.members,next];
  if (!members.some(member=>member.role === "owner" && isActiveMember(member))) throw new Error("不能停用或降权最后一位有效老板。");
  if (typeof auditId !== "string" || !auditId.trim() || auditId.length > 100 || !validAuditTime(time) || data.audit.some(entry=>entry.id === auditId)) throw new Error("员工操作标识无效或重复。");
  const permissions = (member: StaffMember) => ({role:member.role,accountStatus:member.accountStatus,membershipStatus:member.membershipStatus,permissions:[...member.permissions]});
  return {...data,revision:data.revision+1,members,audit:[...data.audit,{id:auditId,actorId,actorName:actor!.name,targetId:next.id,time,before:previous ? permissions(previous) : null,after:permissions(next)}]};
}
