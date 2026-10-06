import type { RetailUnit } from "../retail";
import type { Locale } from "./locale";
import { translate, translateSystemMessage } from "./translate";

/** Format known specification labels for display; keep stored and searchable facts original. */
export function retailDisplaySpec(unit: RetailUnit, locale: Locale) {
  const t = (value: string) => translate(value, locale);
  const disks = unit.disks.map(disk => `${disk.capacity ?? t("容量待确认")} ${disk.unit} ${disk.type}`);
  const body = unit.bodyStorage ? `${unit.bodyStorage.capacity ?? t("容量待确认")} ${unit.bodyStorage.unit} ${t("机身存储")}` : "";
  return [unit.ramGb === null ? "" : `${unit.ramGb} GB RAM`, unit.category === "laptop" || unit.category === "desktop" ? disks.join(" + ") : body, unit.edition].filter(Boolean).join(" · ") || t("规格待确认");
}

const operationLabels: Record<string, string> = {
  edit: "资料更正", inspect: "记录检测", price: "设定售价", approve: "设为可售", pause: "暂停销售", reinspect: "重新检测",
  sell: "登记销售", reserve: "预留商品", release_reservation: "解除预留", payment: "登记收款", refund: "登记退款",
  payment_reconcile: "核对历史收款", payment_void: "冲销收款", refund_void: "冲销退款", deliver: "确认实际交付", return: "登记实物退回",
  after_sale: "新建售后申请", after_sale_assess: "登记售后判定", after_sale_link: "关联维修工单", after_sale_close: "确认售后交还",
  after_sale_cancel: "撤销售后申请", photos: "实物照片",
};
/** Render the server's finite event vocabulary without rewriting its audit record. */
export function retailEventTitle(title: string, locale: Locale): string {
  const prefix = "单机操作：";
  const operation = title.startsWith(prefix) ? title.slice(prefix.length) : "";
  return Object.hasOwn(operationLabels, operation)
    ? translate(prefix, locale) + translate(operationLabels[operation], locale)
    : operation ? title : translate(title, locale);
}
/** Historic free text and frozen sale facts stay original. */
export function retailEventDetail(detail: string, locale: Locale): string {
  const known = ["成本资料更正。", "已核对并保存。", "门店自有实物，待检测。", "本次实物照片已保存。", "本次有效售价已核对。", "本台三项检查完成，已明确设为可售。", "本次买家与成交约定已核对；交付另据实际事实登记。", "本次实际收款逐笔登记；交付另据实际事实确认。", "本次实际收款已登记。", "本次实际交付已登记。"];
  return known.includes(detail) || /^功能检测：(已核对|未完成)；所有权及账号锁核验：(已核对|未完成)；数据处理核验：(已核对|未完成)。$/u.test(detail) ? translateSystemMessage(detail, locale) : detail;
}

/** Add only displayed categorical labels to search; names and original notes stay untouched. */
export function retailSearchLabels(item: { category: string; condition: string; color: string | null; status: string }): string {
  return [item.category, item.condition, item.color, item.status].filter((value): value is string => Boolean(value))
    .flatMap(value => (["zh-CN", "it", "en"] as const).map(locale => translate(value, locale))).join(" ");
}
