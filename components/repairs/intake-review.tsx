"use client";

import { useLanguage } from "@/components/language-provider";
import { repairKnownText } from "@/lib/i18n/repair-display";
import { printIssue } from "@/lib/print-language";
import { itemQuoteTotal, type ItemQuote, type ItemQuoteChange } from "@/lib/repair-item-pricing";
import type { ReactNode } from "react";
import Image from "next/image";
import { UserRound, Phone, Mail, Smartphone, Laptop, Tablet, Gamepad2, Wrench, Package, ImagePlus, Flag, Pencil, ClipboardList, Monitor, Battery, Cable } from "lucide-react";
import { ColorSwatch } from "@/components/color-picker";
import { intakeServiceLabels, type IntakeServices } from "@/lib/intake-services";
import type { IntakePhoto } from "./intake-photos";

type ReviewData = { itemQuotes?:ItemQuote[]; itemQuoteHistory?:ItemQuoteChange[]; customerName: string; phone: string; email: string; brand: string; model: string; category: string; color: string; serial: string; issue: string; faults?: string[]; issueNote?: string; accessories: string[]; priority: string; services: IntakeServices };
const deviceIcons = { 手机: Smartphone, 电脑: Laptop, 平板: Tablet, 游戏机: Gamepad2 };
const qualityLabels = { original: "原装", assembled: "组装" };
const appleLabels = { capacity: "扩容", diagnostics: "跑诊断", both: "扩容跑诊断" };

export function IntakeReview({ data, photos = [], onEdit, layout = "review", metadata, relatedContent, asideContent, statusContent }: { data: ReviewData; photos?: IntakePhoto[]; onEdit?: (step: number) => void; layout?: "review" | "detail"; metadata?: ReactNode; relatedContent?: ReactNode; asideContent?: ReactNode; statusContent?: ReactNode }) {
  const { t, locale } = useLanguage();
  const DeviceIcon = deviceIcons[data.category as keyof typeof deviceIcons] ?? Wrench;
  const issue = printIssue(data, locale === "zh-CN" ? "zh" : locale);
  const issueText = locale === "zh-CN" ? data.issue : [...issue.faults, issue.note].filter(Boolean).join("; ");
  const serviceLabels = intakeServiceLabels(data.services);
  const services = [
    { label: "屏幕", icon: Monitor, quality: data.services.screen.quality, detail: data.services.screen.technology === "incell" ? "Incell" : data.services.screen.technology.toUpperCase() },
    { label: "电池", icon: Battery, quality: data.services.battery.quality, detail: data.services.battery.appleService ? appleLabels[data.services.battery.appleService] : "" },
    { label: "尾插", icon: Cable, quality: data.services.port.quality, detail: "" },
  ].filter(service => service.quality || service.detail);
  const edit = (step: number, label: string) => onEdit ? <button className="icon-button" type="button" aria-label={t("修改{v0}", { v0: t(label) })} onClick={() => onEdit(step)}><Pencil size={16} /></button> : null;
  const issueSection = <section className="intake-review__section intake-review__issue-section"><header><span><Wrench size={18} />{t("故障与维修需求")}</span>{edit(2,"故障与维修需求")}</header>
          {layout === "detail" ? <small className="intake-review__label">{t("故障报告")}</small> : null}<p className="intake-review__issue">{issueText}</p>
          {layout === "detail" && services.length ? <div className="intake-review__services"><small className="intake-review__label">{t("配件要求")}</small>{services.map(service => <div key={service.label}><span className="intake-review__service-icon"><service.icon size={18} /></span><strong>{t(service.label)}</strong>{service.quality ? <span className="intake-review__quality">{t(qualityLabels[service.quality])}</span> : null}{service.detail ? <small>{t(service.detail)}</small> : null}</div>)}</div> : serviceLabels.length ? <div className="intake-review__tags">{serviceLabels.map(label => <span key={label}><Wrench size={13} />{t(label)}</span>)}</div> : null}
          {data.itemQuotes?.length?<div className="intake-review__services" aria-label={t("维修报价")}>{data.itemQuotes.map(row=><div key={row.item}><strong>{t(row.item)} {t("报价")}</strong><span>{row.amountCents===null?t("未报价"):`€${(row.amountCents/100).toFixed(2)}`}</span></div>)}<div><strong>{t("报价合计")}</strong><span>{itemQuoteTotal(data.itemQuotes)===null?t("待补全报价"):`€${(itemQuoteTotal(data.itemQuotes)!/100).toFixed(2)}`}</span></div></div>:null}
          {layout==="detail"&&data.itemQuoteHistory?.length?<details className="repair-workflow-history"><summary>{t("报价历史 · ")}{data.itemQuoteHistory.length}</summary><ol>{data.itemQuoteHistory.toReversed().map(row=><li key={row.id}>{t(row.item)}: {row.previousCents===null?t("未报价"):`€${(row.previousCents/100).toFixed(2)}`} → {row.amountCents===null?t("未报价"):`€${(row.amountCents/100).toFixed(2)}`}<small> · {row.time}</small></li>)}</ol></details>:null}
        </section>;
  const contactSection = <section className="intake-review__section intake-review__customer"><header><span><UserRound size={18} />{t("客户联系")}</span>{edit(0,"客户")}</header><div className="intake-review__contact"><strong>{data.customerName || t("未填写姓名")}</strong><a href={`tel:${data.phone.replace(/[^+\d]/g, "")}`}><Phone size={15} />{data.phone}</a>{data.email ? <p><Mail size={15} />{data.email}</p> : null}</div></section>;
  const accessoriesSection = <section className="intake-review__section intake-review__accessories"><header><span><Package size={18} />{t("随件")}{data.accessories.length ? <small>{data.accessories.length} {t(" 项")}</small> : null}</span>{edit(2,"随件")}</header><div className="intake-review__tags intake-review__tags--neutral">{data.accessories.length ? data.accessories.map(value => <span key={value}><Package size={13} />{t(value)}</span>) : <span>{t("无随件")}</span>}</div></section>;
  const photoSection = photos.length ? <section className="intake-review__section intake-review__photo-section"><header><span><ImagePlus size={18} />{t("接机照片 ")}<small>{photos.length} {t(" 张")}</small></span>{edit(2,"照片")}</header><div className="intake-review__photos">{photos.map(photo => <figure key={photo.id}><Image src={photo.url} alt={t("{v0}接机照片", { v0: t(photo.slot === "front" ? "正面" : photo.slot === "back" ? "背面" : "其他") })} width={100} height={90} unoptimized /><figcaption>{photo.slot === "front" ? t("正面") : photo.slot === "back" ? t("背面") : t("其他")}</figcaption></figure>)}</div></section> : null;
  return <div className={`intake-review intake-review--${layout}`}>
    <section className="intake-review__device">
      <span className="intake-review__device-icon"><DeviceIcon size={32} /></span>
      <div><small>{t(data.category)}</small><h4>{data.brand} {data.model}</h4><div className="intake-review__device-meta"><span><ColorSwatch value={data.color} />{data.color ? repairKnownText(data.color, locale) : t("颜色未记录")}</span><span>SN / IMEI：{data.serial || t("未记录")}</span></div>{metadata}</div>
      <span className="intake-review__device-status">{statusContent ?? <span className="status-pill status-pill--warning"><ClipboardList size={14} />{t("待检测")}</span>}<small><Flag size={13} />{t(data.priority)}{t("优先级")}</small></span>{edit(1,"设备")}
    </section>
    <div className={`intake-review__body${photos.length ? "" : " intake-review__body--no-photos"}`}>
      {layout === "detail" ? <><div className="intake-review__main">{issueSection}{relatedContent ? <div className="intake-review__related">{relatedContent}</div> : null}</div><aside className="intake-review__aside">{asideContent}{contactSection}{accessoriesSection}{photoSection}</aside></> : <>{contactSection}{issueSection}{accessoriesSection}{photoSection}</>}
    </div>
  </div>;
}
