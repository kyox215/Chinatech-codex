import type { CapturePayload } from "@/features/capture/model/barcode-parser";
import type { AppLocale } from "@/shared/i18n/locales";
import { translateMessage, type MessageKey } from "@/shared/i18n/messages";

const labelRules: Record<CapturePayload["kind"], { key: MessageKey; labels: readonly string[] }> = {
  order_link: {
    key: "capture.label.order",
    labels: ["工单任务", "工单链接", "工单编号", "订单二维码"],
  },
  customer_link: { key: "capture.label.customer", labels: ["客户链接", "客户编号"] },
  inventory_link: { key: "capture.label.inventory", labels: ["库存链接", "库存编号"] },
  buyback_link: { key: "capture.label.buyback", labels: ["回收记录"] },
  customer_status_link: {
    key: "capture.label.customerStatus",
    labels: ["客户维修状态二维码", "客户工单二维码"],
  },
  imei: { key: "capture.label.imei", labels: ["IMEI / 序列号"] },
  serial: { key: "capture.label.serial", labels: ["序列号"] },
  url: { key: "capture.label.url", labels: ["外部链接"] },
  text: { key: "capture.label.text", labels: ["空内容", "文本内容", "不是有效订单二维码"] },
};

const invalidCustomerStatusLabel = "无效客户工单二维码";

/** Localizes only parser-owned labels; dynamic/custom labels stay untouched. */
export function getCapturePayloadDisplayLabel(payload: CapturePayload, locale: AppLocale) {
  const rule = labelRules[payload.kind];
  if (payload.kind === "customer_status_link" && payload.label === invalidCustomerStatusLabel) {
    return translateMessage(locale, "capture.label.customerStatusInvalid");
  }
  return rule.labels.includes(payload.label) ? translateMessage(locale, rule.key) : payload.label;
}
