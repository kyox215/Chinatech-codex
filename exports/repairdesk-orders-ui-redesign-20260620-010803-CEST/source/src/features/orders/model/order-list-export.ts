import type { OrderListItem, OrderWorkflow } from "@/lib/repairdesk/api";
import {
  orderExceptionMeta,
  orderWorkflowMeta,
  workflowStatusFromLegacyStatus,
} from "@/features/orders/model/canonical-order-status";
import { getWorkflowStatusLabel } from "@/features/orders/model/order-workflow";

export function buildOrdersCsv(rows: OrderListItem[], workflow?: OrderWorkflow) {
  const headers = [
    "工单号",
    "客户",
    "电话",
    "设备",
    "IMEI",
    "故障",
    "维修项目",
    "状态",
    "主流程",
    "异常",
    "总价",
    "定金",
    "尾款",
    "付款",
    "技师",
    "创建时间",
    "更新时间",
  ];
  const body = rows.map((order) => {
    const workflowStatus = order.workflow_status ?? workflowStatusFromLegacyStatus(order.status);
    const repairItems = order.fault_prices
      .map((item) => `${item.name}${item.price ? ` ${item.price}` : ""}`)
      .join(" | ");
    return [
      order.public_no,
      order.customer_name,
      order.customer_phone,
      order.device_label,
      order.device_imei,
      order.issue_description,
      repairItems,
      getWorkflowStatusLabel(workflow, order.status),
      orderWorkflowMeta[workflowStatus].label,
      order.exception_status ? orderExceptionMeta[order.exception_status].label : "",
      order.quotation_amount,
      order.deposit_amount,
      order.balance_amount,
      order.is_paid ? "已结清" : "未结清",
      order.technician_name,
      formatCsvDate(order.created_at),
      formatCsvDate(order.updated_at),
    ];
  });
  return [headers, ...body].map((row) => row.map(escapeCsvCell).join(",")).join("\n");
}

function escapeCsvCell(value: unknown) {
  const text = String(value ?? "");
  return /[",\n\r]/.test(text) ? `"${text.replaceAll('"', '""')}"` : text;
}

function formatCsvDate(value: string) {
  return new Date(value).toLocaleString("zh-CN", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
}
