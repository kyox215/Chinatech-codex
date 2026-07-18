import type { OrderDataAccessCapability, OrderDataAccessCode } from "@/lib/repairdesk/types";

const summaryByCode: Record<OrderDataAccessCode, string> = {
  available: "可导出并应用批量导入",
  available_export_only: "可导出；批量应用暂未开放",
  feature_disabled: "功能尚未开放，工单数据不受影响",
  store_context_required: "请先明确选择当前店铺",
  owner_role_required: "仅当前店铺的店主可管理",
  primary_owner_required: "仅店铺主创建者可管理",
  store_unavailable: "当前店铺不可用或已停止服务",
};

export function getOrderDataAccessSummary(capability: OrderDataAccessCapability | undefined) {
  if (!capability) return "权限状态暂时无法确认";
  return summaryByCode[capability.code];
}

export function getOrderDataAccessDescription(capability: OrderDataAccessCapability | undefined) {
  if (!capability) {
    return "当前店铺的工单数据权限状态读取失败，请重新加载。系统不会因此删除或隐藏已有工单。";
  }
  if (capability.code === "feature_disabled") {
    return "工单数据导入导出功能当前未开放。这只是功能开关状态，不代表工单丢失；订单列表和日常工单操作不受影响。";
  }
  if (capability.code === "primary_owner_required") {
    return "当前账号在成员列表中可以显示为店主，但不是 stores.owner_user_id 记录的主创建者，因此不能使用整店导入导出。";
  }
  if (capability.code === "owner_role_required") {
    return "整店工单导入导出仅允许当前店铺的店主使用，其他角色仍可按现有权限处理日常工单。";
  }
  if (capability.code === "store_context_required") {
    return "系统无法确认你明确选择了哪个店铺。请返回店铺设置重新选择，再刷新权限。";
  }
  if (capability.code === "store_unavailable") {
    return "当前店铺不可用，系统已停止加载整店数据工具。请先确认店铺状态。";
  }
  return summaryByCode[capability.code];
}
