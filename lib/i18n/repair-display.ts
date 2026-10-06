import { printFault, printIssue, printKnown, printServiceRequests } from "../print-language";
import { translate } from "./translate";
import type { IntakeServices } from "../intake-services";
import type { Locale } from "./locale";

type RepairText = { issue: string; faults?: string[]; issueNote?: string };
type RepairCustomer = { customer: { name: string }; customerNameMissing?: boolean };

/** Render known fault choices, keeping explicitly supplied customer notes verbatim. */
export function repairIssueText(data: RepairText, locale: Locale): string {
  const issue = printIssue(data, locale === "zh-CN" ? "zh" : locale);
  return [issue.faults.join(locale === "zh-CN" ? "、" : ", "), issue.note].filter(Boolean).join(locale === "zh-CN" ? "；" : "; ");
}

/** Missing-name information comes from the source receipt, never a dictionary match. */
export function repairCustomerName(data: RepairCustomer, locale: Locale): string {
  return data.customerNameMissing === true || !data.customer.name.trim()
    ? translate("未填写姓名", locale)
    : data.customer.name;
}

/** Only known device/part choices are localized; custom names remain original. */
export function repairKnownText(text: string, locale: Locale): string {
  return printKnown(text, locale === "zh-CN" ? "zh" : locale) ?? text;
}

export function repairItemText(text: string, locale: Locale): string {
  return printFault(text, locale === "zh-CN" ? "zh" : locale)
    ?? (["清洁", "软件处理"].includes(text) ? translate(text, locale) : text);
}

/** The event's canonical label and note are never rewritten. */
export function repairActivityLabel(event: { type: string; label: string }, locale: Locale): string {
  const colon = locale === "zh-CN" ? "：" : ": ";
  if (event.type === "stage" && event.label.startsWith("维修阶段：")) {
    return translate("维修阶段", locale) + colon + translate(event.label.slice("维修阶段：".length), locale);
  }
  if (event.type === "requirement") {
    const at = event.label.lastIndexOf("：");
    const result = event.label.slice(at + 1);
    if (at > 0 && ["无需采购", "本项目配件已登记", "待核对／选件"].includes(result)) {
      return repairItemText(event.label.slice(0, at), locale) + colon + translate(result, locale);
    }
  }
  return translate(event.label, locale);
}

/** Structured specifications share the independently translated printing vocabulary. */
export function repairServiceTexts(services: IntakeServices, locale: Locale): string[] {
  return printServiceRequests(services, locale === "zh-CN" ? "zh" : locale);
}
