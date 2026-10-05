"use client";
import { useLanguage } from "@/components/language-provider";
import { controlError } from "@/components/control-feedback";
import { InputControl, TextareaControl } from "@/components/input-control";
import { useDeviceDraft, DeviceDraftNotice } from "@/components/use-device-draft";

import { useStaff } from "@/components/staff/use-staff";
import { RetailReservation } from "./retail-commerce";
import Link from "next/link";
import { PageTitle } from "@/components/page-title";
import { useEffect, useId, useRef, useState, type RefObject } from "react";
import { Boxes, CheckCircle2, ClipboardCheck, Database, ShieldCheck, ShoppingBag, Pause, X } from "lucide-react";
import { useStoreSettings } from "@/components/settings/settings-store";
import { RetailWarrantyTerms } from "./retail-warranty-terms";
import { SearchCombobox } from "@/components/search-combobox";
import { useCustomerDirectory } from "@/components/customers/customer-store";
import { customerCandidates, normalizeCustomerPhone } from "@/lib/customers";
import { intakeRecordTime } from "@/lib/repair-intake-record";
import { applyRetailCommand, parseRetailMoney, retailMoney, retailWarrantyLabel, retailWarrantyTermsVersion, type Inspection, type RetailCommand, type RetailUnit } from "@/lib/retail";
import { useRetail } from "./retail-provider";
import { RetailDetailView } from "./retail-detail-view";
import { RetailOperationConfirmation, type PendingRetailOperation } from "./retail-operation-confirmation";
import { RetailMoneyControl } from "./retail-input-controls";
import saleStyles from "./retail-sale.module.css";
import styles from "./retail-detail.module.css";
import surface from "./retail-surface.module.css";

const inspectionLabels: Record<keyof Inspection, string> = { functional: "功能检测已完成", ownership: "所有权及账号锁核验已完成", data: "数据处理核验已完成" };
const inspectionItems = [
  { key: "functional", label: "功能检测", icon: ClipboardCheck },
  { key: "ownership", label: "所有权及账号锁核验", icon: ShieldCheck },
  { key: "data", label: "数据处理核验", icon: Database },
] as const;

function RetailSaleForm({ unit, onClose, restoreFocusRef }: { unit: RetailUnit; onClose: () => void; restoreFocusRef: RefObject<HTMLElement | null> }) {
  const { t } = useLanguage();
  const { dispatch, ready, error: storageError } = useRetail();
  const { customers } = useCustomerDirectory();
  const { settings, ready: settingsReady, error: settingsError } = useStoreSettings();
  const [phone, setPhone] = useState(unit.reservation?.phone||"");
  const [email,setEmail]=useState("");const [address,setAddress]=useState("");const [buyerNote,setBuyerNote]=useState("");const [unreceived,setUnreceived]=useState(false);
  const [name, setName] = useState(unit.reservation?.name||"");
  const [price, setPrice] = useState("");
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [pending, setPending] = useState<{ command: Extract<RetailCommand, { type: "sell" }>; revision: number } | null>(null);
  const [accepted, setAccepted] = useState(false);
  const saleId = useRef<string | null>(null);
  const busy = useRef(false);
  const selectedName = useRef("");
  const selectedContact = useRef({ email: "", address: "" });
  const form = useRef<HTMLFormElement>(null);
  const heading = useRef<HTMLHeadingElement>(null);
  const trigger = useRef<HTMLElement | null>(null);
  const titleId = useId();
  const [version,setVersion] = useState(unit.version);
  const deviceDraft=useDeviceDraft(`retail-sale:${unit.id}`,{phone,email,address,buyerNote,name,price,version},value=>{setPhone(value.phone);setEmail(value.email);setAddress(value.address);setBuyerNote(value.buyerNote);setName(value.name);setPrice(value.price);setVersion(value.version);setPending(null);setAccepted(false);setUnreceived(false);});
  const candidates = customerCandidates(phone, customers);
  const conflict = unit.version !== version || Boolean(pending && pending.revision !== settings.revision);
  useEffect(() => {
    trigger.current = restoreFocusRef.current ?? (document.activeElement instanceof HTMLElement ? document.activeElement : null);
    return () => { if (trigger.current?.isConnected) trigger.current.focus({ preventScroll: true }); };
  }, [restoreFocusRef]);
  useEffect(() => {
    heading.current?.focus({ preventScroll: true });
    form.current?.scrollIntoView({ block: "nearest" });
  }, [pending]);
  async function submit(event: React.FormEvent) {
    event.preventDefault(); if (busy.current) return;
    setError("");
    try {
      if (conflict) throw new Error("单机或门店资料已变化，请关闭并重新核对。");
      if (!pending) {
        if(!unreceived) throw new Error("请明确确认本次尚未收款；登记后逐笔记录实际收款。");
        const customerPhone = normalizeCustomerPhone(phone);
        const priceCents = parseRetailMoney(price);
        if (priceCents === null || priceCents <= 0) throw new Error("请明确填写本台成交价。");
        if (!saleId.current) saleId.current = `LOCAL-SALE-${crypto.randomUUID()}`;
        const command = { type: "sell" as const, saleId: saleId.current, customerPhone, customerName: name.trim(), customerEmail:email.trim(),customerAddress:address.trim(),customerNote:buyerNote.trim(),paymentUnreceived:true,priceCents, warranty: { months: unit.warrantyMonths, termsVersion: retailWarrantyTermsVersion, shopName: settings.shopName, address: settings.address, phone: settings.phone } };
        applyRetailCommand(unit, command, { id: saleId.current, title: "登记售出", detail: "核对销售资料", time: intakeRecordTime() }, version);
        setPending({ command, revision: settings.revision }); setAccepted(false);
        return;
      }
      if (!accepted) throw new Error("请先与客户核对商品、成交价及保修条款。");
      busy.current = true; setSubmitting(true);
      const saved = await dispatch({ type: "command", id: unit.id, version, command: pending.command, event: { id: pending.command.saleId, title: "登记售出", detail: `本台成交 ${retailMoney(pending.command.priceCents)}；商家保修 ${retailWarrantyLabel(pending.command.warranty.months)}；尚未收款；交付待确认。`, time: intakeRecordTime() } });
      if (saved) {await deviceDraft.clear();onClose();} else setError("未保存售出登记，请核对页面上的提交恢复状态。");
    } catch (error) { setError(error instanceof Error ? error.message : "请核对售出资料。"); }
    finally { busy.current = false; setSubmitting(false); }
  }
  return <form className={saleStyles.form} ref={form} role="region" aria-busy={submitting} aria-labelledby={titleId} onSubmit={submit} onKeyDown={event => { if (event.key === "Escape" && !event.defaultPrevented) { event.preventDefault(); if (!busy.current) onClose(); } }}><fieldset className="form-fields" disabled={submitting}><DeviceDraftNotice draft={deviceDraft}/>{conflict?<button type="button" className="button button--secondary" onClick={()=>{setVersion(unit.version);setPending(null);setAccepted(false);setUnreceived(false);setError("");}}>{t("保留输入并核对最新版本")}</button>:null}<div className={saleStyles.heading}><h4 id={titleId} ref={heading} tabIndex={-1}>{pending ? t("核对后确认 · ") : ""}{t("登记售出")}</h4><button className="icon-button" type="button" aria-label={t("关闭售出登记")} disabled={submitting} onClick={onClose}><X size={17} /></button></div>{pending ? <><dl className={saleStyles.review}><div><dt>{t("本台商品")}</dt><dd>{unit.brand} {unit.model} · {unit.code}</dd></div><div><dt>{t("本台识别码")}</dt><dd>SN：{unit.serial||t("未记录")}<br />IMEI 1：{unit.imei1||t("未记录")}{unit.imei2?<><br />IMEI 2：{unit.imei2}</>:null}</dd></div><div><dt>{t("客户 / 成交价")}</dt><dd>{pending.command.customerName || t("未填写称呼")} · {pending.command.customerPhone}<br />{retailMoney(pending.command.priceCents)}</dd></div>{pending.command.customerEmail?<div><dt>{t("买家邮箱")}</dt><dd>{pending.command.customerEmail}</dd></div>:null}{pending.command.customerAddress?<div><dt>{t("买家地址")}</dt><dd>{pending.command.customerAddress}</dd></div>:null}{pending.command.customerNote?<div><dt>{t("买家备注")}</dt><dd>{pending.command.customerNote}</dd></div>:null}<div><dt>{t("初始收款")}</dt><dd>{t("已确认尚未收款 · €0.00")}</dd></div><div><dt>{t("商家保修")}</dt><dd>{retailWarrantyLabel(pending.command.warranty.months)} {t(" · 从实际交付日起算")}</dd></div><div><dt>{t("保修提供方")}</dt><dd>{pending.command.warranty.shopName}<br />{pending.command.warranty.address}<br />{pending.command.warranty.phone}</dd></div></dl><RetailWarrantyTerms enabled={pending.command.warranty.months !== null} /><label className={saleStyles.accept}><input type="checkbox" required disabled={submitting} checked={accepted} onChange={event => setAccepted(event.target.checked)} />{t("已与客户核对商品、成交价及保修条款")}</label></> : <div className="field-grid">
    <SearchCombobox validate={value => controlError(() => normalizeCustomerPhone(value))} label={t("客户手机号")} value={phone} maxLength={40} required inputMode="tel" filterOptions={false} placeholder={t("本地手机号或带区号的号码")} options={candidates.map(customer => ({ value: customer.phone, label: customer.phone, detail: customer.name || "未填写称呼" }))} emptyText={phone.replace(/\D/g, "").length < 3 ? t("输入至少 3 位号码查找候选") : t("没有匹配客户，将按手机号关联新档案")} onChange={value => { setPhone(value); if (selectedName.current && name === selectedName.current) setName(""); if (selectedContact.current.email && email === selectedContact.current.email) setEmail(""); if (selectedContact.current.address && address === selectedContact.current.address) setAddress(""); selectedName.current = ""; selectedContact.current = { email: "", address: "" }; }} onSelect={option => { const customer = candidates.find(customer => customer.phone === option.value); if (customer) { setName(customer.name); setEmail(customer.email); setAddress(customer.address); selectedName.current = customer.name; selectedContact.current = { email: customer.email, address: customer.address }; } }} />
    <label className="field"><span>{t("客户称呼（选填）")}</span><InputControl aria-label={t("客户称呼（选填）")} onClear={() => { setName(""); selectedName.current = ""; }} clearLabel={t("清空客户称呼（选填）")} autoComplete="name" maxLength={80} value={name} onChange={event => { setName(event.target.value); selectedName.current = ""; }} /></label>
    <label className="field"><span>{t("买家邮箱（选填）")}</span><InputControl onClear={() => { setEmail(""); selectedContact.current.email = ""; }} clearLabel={t("清空买家邮箱")} aria-label={t("买家邮箱")} type="email" autoComplete="email" autoCapitalize="off" maxLength={160} value={email} onChange={event=>{setEmail(event.target.value);selectedContact.current.email="";}}/></label>
    <label className="field field--wide"><span>{t("买家地址（选填）")}</span><TextareaControl aria-label={t("买家地址")} autoComplete="street-address" maxLength={300} rows={2} value={address} onChange={event=>{setAddress(event.target.value);selectedContact.current.address="";}}/></label>
    <label className="field field--wide"><span>{t("买家备注（选填）")}</span><TextareaControl aria-label={t("买家备注")} maxLength={500} rows={3} value={buyerNote} onChange={event=>setBuyerNote(event.target.value)}/></label>
    <div className="field--wide"><p className={saleStyles.reference}>{t("本台标价：")}<strong>{retailMoney(unit.priceCents)}</strong></p><RetailMoneyControl label={t("本台成交价")} required value={price} onChange={setPrice} placeholder={t("明确填写本台成交价")} /></div>
  <label className={saleStyles.accept}><input type="checkbox" required checked={unreceived} onChange={event=>setUnreceived(event.target.checked)}/>{t("确认本次尚未收款，登记后继续记录实际收款")}</label></div>}<p className={saleStyles.note}>{pending ? "" : t("本次商家保修：") + retailWarrantyLabel(unit.warrantyMonths) + "。"}{t("登记后本台变为已售出。收款及交付需另行确认。")}</p>{error || settingsError || conflict ? <p className="form-error" role="alert">{conflict ? t("单机或门店资料已变化，请关闭并重新核对。") : t(error) || settingsError}</p> : null}<div className={saleStyles.actions}><button type="button" className="button button--secondary" disabled={submitting} onClick={onClose}>{t("取消")}</button>{pending ? <button type="button" className="button button--secondary" disabled={submitting} onClick={() => { setPending(null); setAccepted(false); setError(""); }}>{t("返回修改")}</button> : null}<button type="submit" className="button button--primary" disabled={submitting || conflict || !ready || !settingsReady || !!settingsError || !!storageError}><ShoppingBag size={17} />{submitting ? t("正在保存") : pending ? t("确认登记售出") : t("继续核对售出")}</button></div></fieldset></form>;
}

function RetailActions({ unit }: { unit: RetailUnit }) {
  const { t } = useLanguage();
  const { feedback, ready, error } = useRetail();
  const staff=useStaff();
  const [saleOpen, setSaleOpen] = useState(false);
  const saleTrigger = useRef<HTMLElement | null>(null);
  const operationTrigger = useRef<HTMLElement | null>(null);
  const [checks, setChecks] = useState(unit.inspection);
  const [reason, setReason] = useState("");
  const [pending, setPending] = useState<PendingRetailOperation | null>(null);
  const [parseError, setParseError] = useState("");
  const currentFeedback = feedback?.id === unit.id ? feedback : null;
  if (unit.status === "sold") return null;
  function act(command: RetailCommand, title: string, trigger: HTMLElement) {
    operationTrigger.current = trigger;
    setParseError("");
    try {
      if (!reason.trim()) throw new Error("请填写检测说明或变更原因。");
      const event = { id: crypto.randomUUID(), title, detail: reason.trim(), time: intakeRecordTime() };
      const updated = applyRetailCommand(unit, command, event, unit.version);
      setPending({ command, event, version: unit.version, nextStatus: updated.status });
    } catch (reason) { setParseError(reason instanceof Error ? reason.message : "请核对资料。"); }
  }
  return <section className={`panel retail-actions ${styles.actions}`}><div className={`detail-section__head ${surface.sectionHead}`}><div><span><ShieldCheck size={18} /></span><div><h3>{t("检测与销售")}</h3></div></div></div>{parseError || currentFeedback ? <div className={`procurement-feedback${parseError || currentFeedback?.error ? " procurement-feedback--error" : ""}`} role={parseError || currentFeedback?.error ? "alert" : "status"}>{t(parseError || currentFeedback?.message || "")}</div> : null}<div className={`retail-actions__body ${styles.actionBody}`}>
    {unit.status !== "inspecting" ? <dl className={styles.inspectionSummary} aria-label={t("已保存核验记录")}>{inspectionItems.map(({ key, label, icon: Icon }) => <div key={key}><dt><Icon size={15} aria-hidden="true" />{t(label)}</dt><dd>{unit.inspection[key] ? t("已记录") : t("未完成")}</dd></div>)}</dl> : null}
    <>
      {["available","reserved"].includes(unit.status) && staff.can("retail.sell") ? <><button type="button" hidden={saleOpen} className={`button button--primary ${styles.saleButton} ${saleStyles.trigger}`} disabled={!ready || !!error} onClick={event => { saleTrigger.current = event.currentTarget; setSaleOpen(true); }}><ShoppingBag size={17} />{t("登记售出")}</button>{saleOpen ? <RetailSaleForm unit={unit} restoreFocusRef={saleTrigger} onClose={() => setSaleOpen(false)} /> : null}</> : null}<RetailReservation unit={unit}/>
      <div className={saleStyles.inspectionDraft} hidden={Boolean(pending)}>
      {unit.status === "inspecting" && staff.can("retail.inspect") ? <fieldset className={`retail-inspection-checks ${styles.inspectionChecks}`}><legend>{t("本轮检测确认")}</legend>{inspectionItems.map(({ key, label, icon: Icon }) => <label className={`retail-check ${styles.inspectionCheck}`} key={key}><input type="checkbox" aria-label={t(inspectionLabels[key])} checked={checks[key]} onChange={(event) => setChecks((previous) => ({ ...previous, [key]: event.target.checked }))} /><Icon size={17} aria-hidden="true" /><span>{t(label)}</span><span className={`${styles.savedCheck}${unit.inspection[key] ? ` ${styles.savedCheckDone}` : ""}`}>{unit.inspection[key] ? t("已保存") : t("待检测")}</span></label>)}</fieldset> : null}
      {staff.can("retail.inspect") && ["available","inspecting","hold"].includes(unit.status) ? <><label className="field"><span>{t("检测说明 / 变更原因 *")}</span><TextareaControl aria-label={t("检测说明 / 变更原因")} value={reason} maxLength={500} onChange={(event) => setReason(event.target.value)} validate={value => value.trim() ? "" : "请填写本台实物的检测结果或变更原因。"} placeholder={t("例如：屏幕与充电已测试，账号已退出")} /></label>
      <div className={`retail-action-buttons ${styles.actionButtons}`}>{unit.status === "inspecting" ? <><button className="button button--secondary" type="button" disabled={!ready || !!error} onClick={event => act({ type: "inspect", checks }, "本轮检测已记录", event.currentTarget)}><ClipboardCheck size={17} />{t("记录检测")}</button><button className="button button--primary" type="button" disabled={!ready || !!error} onClick={event => act({ type: "approve" }, "明确设为可售", event.currentTarget)}><CheckCircle2 size={17} />{t("设为可售")}</button></> : unit.status === "hold" ? <button className="button button--primary" type="button" disabled={!ready || !!error} onClick={event => act({ type: "reinspect" }, "重新进入检测", event.currentTarget)}><ClipboardCheck size={17} />{t("重新检测")}</button> : null}{unit.status === "inspecting" || unit.status === "available" ? <button className={`button button--secondary ${styles.pauseButton}`} type="button" disabled={!ready || !!error} onClick={event => act({ type: "pause" }, "暂停销售", event.currentTarget)} ><Pause size={17} />{t("暂停销售")}</button> : null}</div>
      <p className="retail-action-note">{t("记录检测不会自动可售；三项检查与有效售价全部确认后，仍需明确点击“设为可售”。")}</p></> : null}
      </div>
    </>
  </div>{pending ? <RetailOperationConfirmation unit={unit} pending={pending} restoreFocusRef={operationTrigger} onClose={() => setPending(null)} /> : null}</section>;
}

export function RetailDetail({ id, selectedSale }: { id: string; selectedSale?: string }) {
  const { t } = useLanguage();
  const { units, returnTo, ready, error } = useRetail();
  const unit = units.find((unit) => unit.id === id);
  if (!unit) return <main className="module-page"><header className="module-heading"><PageTitle title={t("单机档案")} backHref="/app/retail" backLabel={t("返回商品列表")} /></header><div className="panel module-empty"><Boxes size={28} /><strong>{ready ? t("没有找到单机档案") : t("正在读取本地档案…")}</strong>{error ? <p role="alert">{t(error)}</p> : null}<Link className="button button--primary" href="/app/retail">{t("返回商品列表")}</Link></div></main>;
  return <RetailDetailView key={unit.id} unit={unit} returnTo={returnTo} selectedSale={selectedSale} storageError={error}><RetailActions key={unit.id + ":" + unit.status} unit={unit} /></RetailDetailView>;
}
