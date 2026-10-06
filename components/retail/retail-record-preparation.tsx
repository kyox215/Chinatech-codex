"use client";
import { useRef, useState } from "react";
import Link from "next/link";
import { CheckCircle2, FileCheck } from "lucide-react";
import { InputControl } from "@/components/input-control";
import { IdentifierField } from "@/components/identifier-field";
import { SelectControl } from "@/components/select-control";
import { useLanguage } from "@/components/language-provider";
import { useStaff } from "@/components/staff/use-staff";
import { useStoreSettings } from "@/components/settings/settings-store";
import { useDeviceDraft, DeviceDraftNotice } from "@/components/use-device-draft";
import { retailCategories, type RetailCategory } from "@/lib/retail";
import { customerId } from "@/lib/customers";
import { intakeRecordTime } from "@/lib/repair-intake-record";
import { initialRecordPreparation, prepareRetailRecord, type RetailRecordPreparation } from "@/lib/retail-record";
import type { RetailHistoryRecord } from "@/lib/retail-history";
import { useRetail } from "./retail-provider";
import { historyDate, historyMoney, historyText } from "./retail-history-shared";
import styles from "./retail-history.module.css";
import surface from "./retail-surface.module.css";
import recordStyles from "./retail-record.module.css";

const checks = [{ key: "functional", label: "功能检测已完成" }, { key: "ownership", label: "所有权及账号锁已核验" }, { key: "data", label: "数据处理已核验" }] as const;
export function RetailRecordPreparation({ record }: { record: RetailHistoryRecord }) {
  const { t } = useLanguage(); const staff = useStaff(); const store = useStoreSettings();
  const { units, dispatch, ready, error: storageError, feedback } = useRetail();
  const [draft, setDraft] = useState(() => initialRecordPreparation(record));
  const [pending, setPending] = useState<RetailRecordPreparation | null>(null);
  const [revision, setRevision] = useState(store.settings.revision);
  const [error, setError] = useState(""); const [submitting, setSubmitting] = useState(false);
  const busy = useRef(false);
  const deviceDraft = useDeviceDraft(`retail-record:${record.id}`, { draft, sourceSnapshot: record.sourceSnapshot, revision }, value => {
    if (value.sourceSnapshot !== record.sourceSnapshot) throw new Error("商品来源已变化，请重新核对。");
    setDraft(value.draft); setRevision(value.revision); setPending(null);
  });
  const conflict = store.settings.revision !== revision || units.some(unit => unit.id === record.id);
  const change = <K extends keyof RetailRecordPreparation>(key: K, value: RetailRecordPreparation[K]) => { setDraft(previous => ({ ...previous, [key]: value })); setPending(null); setError(""); };
  async function submit(event: React.FormEvent) {
    event.preventDefault(); if (busy.current) return; setError("");
    try {
      if (conflict) throw new Error("商品来源或门店约定已变化，请重新核对。");
      const audit = { id: crypto.randomUUID(), time: intakeRecordTime(), title: "商品资料已核对", detail: "原商品记录保留，实物资料已确认。" };
      prepareRetailRecord(record, draft, store.settings.retailWarrantyMonths, audit, units);
      if (!pending) { setPending(structuredClone(draft)); return; }
      busy.current = true; setSubmitting(true);
      const saved = await dispatch({ type: "prepare", id: record.id, sourceSnapshot: record.sourceSnapshot, settingsRevision: revision, draft: pending, event: audit });
      if (saved) deviceDraft.clear();
    } catch (reason) { setError(reason instanceof Error ? reason.message : "请核对商品资料。"); }
    finally { busy.current = false; setSubmitting(false); }
  }
  if (!staff.can("retail.edit")) return <p className="procurement-feedback">{t("当前账号无此编辑权限")}</p>;
  return <form className="panel detail-section" aria-label={t("核对商品资料")} onSubmit={submit}><div className={`detail-section__head ${surface.sectionHead}`}><div><span><FileCheck size={18} /></span><h3>{t("核对商品资料")}</h3></div></div><div className={recordStyles.body}>{conflict ? <div className="procurement-feedback procurement-feedback--error" role="alert"><p>{t("商品来源或门店约定已变化，请重新核对。")}</p><button type="button" className="button button--secondary" disabled={submitting || !store.ready || !!store.error} onClick={() => { setRevision(store.settings.revision); setPending(null); setError(""); }}>{t("重新核对")}</button></div> : null}<fieldset className="form-fields" disabled={submitting || conflict || !ready || !store.ready || !!storageError || !!store.error}>
    <DeviceDraftNotice draft={deviceDraft} />
    <p>{t("核对当前实物，原商品编号和资料继续保留。")}</p>
    {error || feedback?.id === record.id && feedback.error ? <p className="form-error" role="alert">{t(error || feedback?.message || "")}</p> : null}
    {pending ? <><div className="device-facts"><span><small>{t("商品类型")}</small><strong>{t(retailCategories[pending.category as RetailCategory])}</strong></span><span><small>{t("型号 / 商品名称")}</small><strong>{pending.brand} {pending.model}</strong></span><span className="device-facts__wide"><small>{t("识别码")}</small><strong>{pending.identifier || t("未记录")}</strong></span><span className="device-facts__wide"><small>{t("本次核验")}</small><strong>{Object.values(pending.checks).filter(Boolean).length}/3</strong></span></div><p>{t("已勾选的检测将保存；保存后在本页明确设为可售。")}</p><div className="module-heading__actions"><button type="button" className="button button--secondary" onClick={() => setPending(null)}>{t("返回修改")}</button><button type="submit" className="button button--primary"><CheckCircle2 size={17} />{submitting ? t("正在保存") : t("确认保存商品资料")}</button></div></> : <>
      <div className="field-grid">
        <label className="field"><span>{t("商品类型")}</span><SelectControl required aria-label={t("商品类型")} value={draft.category} onChange={event => change("category", event.target.value as RetailCategory)}><option value="">{t("请选择商品类型")}</option>{Object.entries(retailCategories).map(([value, label]) => <option key={value} value={value}>{t(label)}</option>)}</SelectControl></label>
        <label className="field"><span>{t("品牌")}</span><InputControl value={draft.brand} onChange={event => change("brand", event.target.value)} maxLength={100} /></label>
        <label className="field field--wide"><span>{t("型号 / 商品名称")}</span><InputControl required value={draft.model} onChange={event => change("model", event.target.value)} maxLength={200} /></label>
        <label className="field"><span>{t("识别码类型")}</span><SelectControl aria-label={t("识别码类型")} value={draft.identifierKind} onChange={event => change("identifierKind", event.target.value as RetailRecordPreparation["identifierKind"])}><option value="unconfirmed">{t("待核对，保留原文")}</option><option value="imei">IMEI</option><option value="serial">SN</option></SelectControl></label>
        {draft.identifierKind === "unconfirmed" ? <div className="field"><span>{t("原识别码")}</span><strong>{historyText(record.identifier)}</strong></div> : <IdentifierField required label={draft.identifierKind === "imei" ? "IMEI" : "SN"} value={draft.identifier} onChange={value => change("identifier", value)} kind={draft.identifierKind === "imei" ? "imei" : "serial"} />}
      </div>
      <label className="retail-check"><input type="checkbox" checked={draft.storeOwned} onChange={event => change("storeOwned", event.target.checked)} /><span>{t("确认这是门店自有且当前在店的实物")}</span></label>
      <div className="retail-inspection-checks">{checks.map(({ key, label }) => <label className="retail-check" key={key}><input type="checkbox" aria-label={t(label)} disabled={!staff.can("retail.inspect")} checked={draft.checks[key]} onChange={event => change("checks", { ...draft.checks, [key]: event.target.checked })} /><span>{t(label)}</span></label>)}</div>
      <button type="submit" className="button button--primary"><FileCheck size={17} />{t("继续核对")}</button>
    </>}
  </fieldset></div></form>;
}

export function RetailRecordSourceFacts({ record }: { record: RetailHistoryRecord }) {
  const { t } = useLanguage(); const staff = useStaff();
  const fact = (label: string, value: string | null) => <div key={label}><dt>{t(label)}</dt><dd>{value?.trim() || t("未记录")}</dd></div>;
  return <><dl className={styles.facts}>
    {fact("原状态", record.sourceStatus)}{fact("商品类别", record.category)}
    {fact("品牌", record.brand)}{fact("型号 / 商品名称", record.model)}{fact("颜色", record.color)}
    {fact("原标价", t(historyMoney(record.askingPriceCents)))}{staff.can("financial.read") ? fact("原成本", t(historyMoney(record.costCents))) : null}
    {fact("入库日期", t(historyDate(record.intakeAt, true)))}
    {fact("内存 / 容量原文", record.memory)}{fact("IMEI / 序列号原文", record.identifier)}
    {fact("来源", "SeaTable")}{fact("源表行号", String(record.sourceRow))}
    {fact("导入时间", historyDate(record.importedAt, true))}
  </dl>{(record.customerPhone || record.customerName || record.depositCents !== null || record.salePriceCents !== null || record.pickupDate || record.paymentMethod) ? <RetailRecordOriginalSale record={record} embedded /> : null}{staff.can("financial.read") && record.notes ? <p className={styles.notes}>{record.notes}</p> : null}{record.reviewReasons.length ? <ul>{record.reviewReasons.map((reason, index) => <li key={index}>{reason}</li>)}</ul> : null}</>;
}
export function RetailRecordOriginalSale({ record, embedded = false }: { record: RetailHistoryRecord; embedded?: boolean }) {
  const { t } = useLanguage(); let href: string | null = null;
  if (record.customerPhone) { try { href = `/app/customers/${customerId(record.customerPhone)}?records=history`; } catch { /* Keep original invalid phone text. */ } }
  return <section className={embedded ? undefined : "panel detail-section"}>{!embedded ? <div className={`detail-section__head ${surface.sectionHead}`}><div><span><FileCheck size={18} /></span><h3>{t("原销售记录")}</h3></div></div> : null}<div className={recordStyles.body}><div className="device-facts">
    <span><small>{t("客户称呼")}</small><strong>{record.customerName || t("未记录")}</strong></span>
    <span><small>{t("客户号码")}</small><strong>{href ? <Link href={href}>{record.customerPhone}</Link> : record.customerPhone || t("未记录")}</strong></span>
    <span><small>{t("最终成交价")}</small><strong>{t(historyMoney(record.salePriceCents))}</strong></span>
    <span><small>{t("已付定金")}</small><strong>{t(historyMoney(record.depositCents))}</strong></span>
    <span><small>{t("支付方式原文")}</small><strong>{record.paymentMethod || t("未记录")}</strong></span>
    <span><small>{t("实际拿走日期")}</small><strong>{t(historyDate(record.pickupDate))}</strong></span>
  </div><p>{t("定金不代表全部实收。")}</p></div></section>;
}
