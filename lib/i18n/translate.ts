import { interfaceMessages } from "./interface";
import { errorMessages } from "./errors";
import structuredMessages from "./structured.json";
import { publicMessages } from "./public";
import type { Locale } from "./locale";

const messages: Record<string, readonly string[]> = { ...structuredMessages, ...errorMessages, ...interfaceMessages, ...publicMessages };
const templates = Object.entries(messages).filter(([key]) => key.includes("{")).map(([key, translations]) => {
  const names: string[] = [];
  const pieces = key.split(/\{(\w+)\}/g);
  const pattern = pieces.map((piece, index) => {
    if (index % 2) { names.push(piece); return "(.+?)"; }
    return piece.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  }).join("");
  return { key, pattern: new RegExp(`^${pattern}$`), names, translations };
});

// These labels come from retailFieldLabels and the validation labels in retail.ts.
// They are a finite schema vocabulary, never customer values or user-provided names.
const systemFields = new Set([
  "单机编号", "商品类型", "品牌", "型号 / 商品名称", "SN", "IMEI 1", "IMEI 2", "包装条码", "颜色",
  "RAM", "机身存储", "逐块 SSD / HDD", "CPU", "GPU", "键盘布局", "版本 / 网络", "随附手柄数量",
  "商品分类", "商家保修", "外观等级", "电池健康", "随附物品", "已知问题", "入库成本", "整备成本", "售价",
  "来源", "存放位置", "入库日期", "操作标识", "客户称呼", "客户邮箱", "客户地址", "客户备注", "客户资料",
  "款项备注", "操作人", "冲销原因", "核对原因", "退回原因", "故障与诉求", "人工判断原因", "处理结果",
  "撤销申请原因", "预留称呼", "预留备注", "欠款原因", "跟进责任人", "责任人", "操作标题",
  "检测说明或状态变更原因", "操作时间", "销售时间", "销售备注", "故障诉求", "判断原因", "撤销原因",
  "收款", "退款", "成交价", "核对累计实收", "标价", "款项", "核对实收", "交付", "退回", "售后接收", "售后关闭", "销售事实",
]);
type SystemSlot = "original" | "field" | "number" | "money" | "requirement" | "kind" | "provider";
// Only complete, reviewed system sentences are recognized by the explicit system
// outlet. Short/generic presentation templates remain excluded.
const systemTemplateSlots: Record<string, Readonly<Record<string, SystemSlot>>> = {
  "{name}已有采购事实，供应商及进价不能在此改写；报价可独立保存。": { name: "original" },
  "{name}已有采购记录，清空供应商不能取消采购。": { name: "original" },
  "{name}：请选择已登记的门店供应商，或留空只填报价。": { name: "original" },
  "{name}：填写进价前请选择供应商。": { name: "original" },
  "采购条目 {id} 不存在或不属于此门店。": { id: "original" },
  "采购条目 {id} 已变化，请重新核对整批。": { id: "original" },
  "采购条目 {id} 尚未加车或已经下单。": { id: "original" },
  "{field}须为整数，未知请留空。": { field: "field" },
  "{field}须为文字，最多 5000 字。": { field: "field" },
  "请填写{field}。": { field: "field" },
  "{field}不适用于当前商品类型；只能清理已有资料。": { field: "field" },
  "新商品类型不适用{field}，请先独立清理该字段再更正类型。": { field: "field" },
  "{field}须为{requirement}文字，最多 {limit} 字。": { field: "field", requirement: "requirement", limit: "number" },
  "{field}须为有效整数分金额。": { field: "field" },
  "{field}日期须为销售登记日至今天之间的真实日期。": { field: "field" },
  "请输入 {min}–{max} 的{kind}。": { min: "number", max: "number", kind: "kind" },
  "金额不能超过 {maximum}。": { maximum: "money" },
  "身份与已有单机 {code} 重复，请打开原档案，不要重复建档。": { code: "original" },
  "{provider} 登录未开放。": { provider: "provider" },
  "{provider} 登录尚未配置，请使用邮箱登录。": { provider: "provider" },
  "{provider} 登录暂不可用，请稍后重试。": { provider: "provider" },
};

/** Translate presentation messages only. Business values and signed snapshots stay original. */
export function translate(text: string, locale: Locale, values?: Record<string, string | number>): string {
  if (locale === "zh-CN") return substitute(text, values);
  const normalized = text.trim().replace(/\s+/g, " ");
  let entry = Object.hasOwn(messages, text) ? messages[text] : Object.hasOwn(messages, normalized) ? messages[normalized] : undefined;
  let variables = values;
  if (!entry && !values && /[\u3400-\u9fff]/u.test(normalized)) {
    for (const template of templates) {
      const match = normalized.match(template.pattern);
      if (!match) continue;
      // A broad template must not partially translate an unknown message or a user's name.
      if (match.slice(1).some(value => /[\u3400-\u9fff]/u.test(value))) continue;
      entry = template.translations;
      variables = Object.fromEntries(template.names.map((name, index) => [name, match[index + 1]]));
      break;
    }
  }
  if (!entry) return substitute(text, values);
  const translated = entry[locale === "it" ? 0 : 1];
  const leading = /^\s/.test(translated) ? "" : text.match(/^\s+/)?.[0] ?? "";
  const trailing = /\s$/.test(translated) ? "" : text.match(/\s+$/)?.[0] ?? "";
  return `${leading}${substitute(translated, variables)}${trailing}`;
}

/** Only for a known system error/feedback outlet, never names, notes or snapshots. */
export function translateSystemMessage(text: string, locale: Locale, values?: Record<string, string | number>): string {
  if (locale === "zh-CN" || values || Object.hasOwn(messages, text) || Object.hasOwn(messages, text.trim().replace(/\s+/gu, " "))) return translate(text, locale, values);
  // Preserve internal whitespace in original names/identifiers. Normalizing the
  // whole message would silently alter those facts before substitution.
  const source = text.trim();
  for (const template of templates) {
    const slots = Object.hasOwn(systemTemplateSlots, template.key) ? systemTemplateSlots[template.key] : undefined;
    if (!slots) continue;
    const match = source.match(template.pattern);
    if (!match) continue;
    const captures: Record<string, string> = {};
    let valid = true;
    for (const [index, name] of template.names.entries()) {
      const value = match[index + 1];
      const policy = slots[name];
      if (policy === "original") captures[name] = value;
      else if (policy === "field" && systemFields.has(value)) captures[name] = translate(value, locale);
      else if (policy === "number" && /^-?\d+(?:[.,]\d+)?$/u.test(value)) captures[name] = value;
      else if (policy === "money" && /^€?[\d.,\s]+(?:\s?€)?$/u.test(value) && /\d/u.test(value)) captures[name] = value;
      else if (policy === "kind" && ["整数", "数字"].includes(value)) captures[name] = translate(value, locale);
      else if (policy === "requirement" && ["非空", "有效"].includes(value)) captures[name] = translate(value === "有效" ? "有效（校验）" : value, locale);
      else if (policy === "provider" && ["Google", "Apple"].includes(value)) captures[name] = value;
      else { valid = false; break; }
    }
    if (!valid) continue;
    const leading = text.match(/^\s+/u)?.[0] ?? "";
    const trailing = text.match(/\s+$/u)?.[0] ?? "";
    return `${leading}${substitute(template.translations[locale === "it" ? 0 : 1], captures)}${trailing}`;
  }
  return text;
}

function substitute(text: string, values?: Record<string, string | number>) {
  return text.replace(/\{(\w+)\}/g, (token, key: string) => !values || !Object.hasOwn(values, key) || values[key] === undefined ? token : String(values[key]));
}
