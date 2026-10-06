"use client";

import { useEffect, useId, useRef, useState, type RefObject } from "react";
import { ShoppingBag, X } from "lucide-react";
import { useLanguage } from "@/components/language-provider";
import { controlError, useFormReady } from "@/components/control-feedback";
import { InputControl, TextareaControl } from "@/components/input-control";
import { SelectControl } from "@/components/select-control";
import { SearchCombobox } from "@/components/search-combobox";
import { DeviceDraftNotice, useDeviceDraft } from "@/components/use-device-draft";
import { useStaff } from "@/components/staff/use-staff";
import { useCustomerDirectory } from "@/components/customers/customer-store";
import { useStoreSettings } from "@/components/settings/settings-store";
import { customerCandidates, normalizeCustomerPhone } from "@/lib/customers";
import { intakeRecordTime } from "@/lib/repair-intake-record";
import { parseRetailMoney, retailMoney, retailWarrantyLabel, retailWarrantyTermsVersion, type RetailPaymentMethod, type RetailUnit } from "@/lib/retail";
import { applyRetailWorkflow, retailWorkflowPermissions, type RetailCheckoutWorkflow } from "@/lib/retail-workflow";
import { RetailMoneyControl, RetailDateControl } from "./retail-input-controls";
import { RetailWarrantyTerms } from "./retail-warranty-terms";
import { useRetail } from "./retail-provider";
import styles from "./retail-sale.module.css";

type PaymentChoice = "" | "none" | "full" | "partial";
type DeliveryChoice = "" | "none" | "delivered";
type PaymentDraft = { key: string; amount: string; method: "" | RetailPaymentMethod; date: string; note: string };
const emptyContact = () => ({ name: "", email: "", address: "" });
const paymentMethods: Record<RetailPaymentMethod, string> = { cash: "现金", card: "银行卡", transfer: "转账", other: "其他" };
const today = () => intakeRecordTime().slice(0, 10);
const newPayment = (amount = ""): PaymentDraft => ({ key: crypto.randomUUID(), amount, method: "", date: today(), note: "" });
const moneyInput = (cents: number | null) => cents === null ? "" : (cents / 100).toFixed(2);

export function RetailCheckoutForm({ unit, onClose, restoreFocusRef }: { unit: RetailUnit; onClose: () => void; restoreFocusRef: RefObject<HTMLElement | null> }) {
  const { t, systemText } = useLanguage(); const staff = useStaff(); const hydrated = useFormReady();
  const { dispatch, ready, error: storageError, feedback } = useRetail();
  const { customers } = useCustomerDirectory(); const { settings, ready: settingsReady, error: settingsError } = useStoreSettings();
  const [phone,setPhone] = useState(unit.reservation?.phone ?? ""); const [name,setName] = useState(unit.reservation?.name ?? "");
  const [email,setEmail] = useState(""); const [address,setAddress] = useState(""); const [buyerNote,setBuyerNote] = useState(""); const [price,setPrice] = useState(moneyInput(unit.priceCents));
  const [paymentChoice,setPaymentChoice] = useState<PaymentChoice>(""); const [payments,setPayments] = useState<PaymentDraft[]>([]);
  const [deliveryChoice,setDeliveryChoice] = useState<DeliveryChoice>(""); const [deliveryDate,setDeliveryDate] = useState(today);
  const [debtReason,setDebtReason] = useState(""); const [debtOwner,setDebtOwner] = useState(""); const [followUp,setFollowUp] = useState("");
  const [version,setVersion] = useState(unit.version); const [settingsRevision,setSettingsRevision] = useState(settings.revision);
  const [debtAccepted,setDebtAccepted] = useState(false); const [accepted,setAccepted] = useState(false); const [submitting,setSubmitting] = useState(false); const [error,setError] = useState(""); const [failed,setFailed] = useState(false);
  const busy = useRef(false); const operationId = useRef(crypto.randomUUID()); const [autoFilled,setAutoFilled] = useState(emptyContact);
  const form = useRef<HTMLFormElement>(null); const heading = useRef<HTMLHeadingElement>(null); const trigger = useRef<HTMLElement | null>(null); const titleId = useId();
  const draft = useDeviceDraft(`retail-checkout:${unit.id}`,{phone,name,email,address,buyerNote,price,payments,deliveryDate,debtReason,debtOwner,followUp,version,settingsRevision,autoFilled},value => {
    setPhone(value.phone);setName(value.name);setEmail(value.email);setAddress(value.address);setBuyerNote(value.buyerNote);setPrice(value.price);setPayments(value.payments);setDeliveryDate(value.deliveryDate);setDebtReason(value.debtReason);setDebtOwner(value.debtOwner);setFollowUp(value.followUp);setVersion(value.version);setSettingsRevision(value.settingsRevision);setAutoFilled(value.autoFilled ?? emptyContact());
    setDebtAccepted(false);setAccepted(false);setPaymentChoice("");setDeliveryChoice("");setError("");setFailed(false);
  });
  const conflict = unit.version !== version || settings.revision !== settingsRevision;
  const candidates = customerCandidates(phone,customers);
  let priceCents: number | null = null; let totalCents: number | null = paymentChoice === "none" ? 0 : null;
  try { priceCents = parseRetailMoney(price); } catch { /* The amount control reports the field error. */ }
  if (paymentChoice === "full" || paymentChoice === "partial") {
    try { const amounts=payments.map(payment=>parseRetailMoney(payment.amount)); if (amounts.length && amounts.every(amount=>amount!==null && amount>0)) totalCents=amounts.reduce<number>((sum,amount)=>sum+(amount ?? 0),0); } catch { /* Preserve the actual money drafts. */ }
  }
  const dueCents = priceCents !== null && totalCents !== null ? priceCents-totalCents : null;
  const debtDelivery = deliveryChoice === "delivered" && dueCents !== null && dueCents > 0;
  const canDeliver = staff.can("sale.deliver") && (dueCents === 0 || staff.can("sale.debt"));
  const locked = submitting || !hydrated || !ready || !settingsReady || !!storageError || !!settingsError || !staff.can("retail.sell");
  function changed() { setDebtAccepted(false);setAccepted(false); setError("");setFailed(false); }
  function changePayment(key: string, change: Partial<PaymentDraft>) { changed();setPayments(previous=>previous.map(payment=>payment.key===key?{...payment,...change}:payment)); }
  function choosePayment(value: PaymentChoice) {
    changed();setPaymentChoice(value);
    if (value === "full") setPayments([newPayment(moneyInput(priceCents))]);
    else if (value === "partial" && !payments.length) setPayments([newPayment()]);
  }
  function changePhone(value: string) {
    changed();setPhone(value);
    if (autoFilled.name && name === autoFilled.name) setName("");
    if (autoFilled.email && email === autoFilled.email) setEmail("");
    if (autoFilled.address && address === autoFilled.address) setAddress("");
    setAutoFilled(emptyContact());
  }
  useEffect(()=>{
    trigger.current=restoreFocusRef.current ?? (document.activeElement instanceof HTMLElement?document.activeElement:null);
    heading.current?.focus({preventScroll:true});form.current?.scrollIntoView({block:"nearest",behavior:"instant"});
    return()=>{if(trigger.current?.isConnected)trigger.current.focus({preventScroll:true});};
  },[restoreFocusRef]);
  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();if(busy.current || locked)return;setError("");setFailed(false);
    try {
      if(conflict)throw new Error("单机或门店资料已变化，请关闭并重新核对。");
      if(!accepted)throw new Error("请先与客户核对商品、成交价及保修条款。");
      if(!paymentChoice || !deliveryChoice)throw new Error("请明确选择本次收款与实际交付情况。");
      if(priceCents === null || priceCents<=0)throw new Error("请明确填写本台成交价。");
      if(totalCents===null || totalCents<0 || totalCents>priceCents || paymentChoice==="full" && totalCents!==priceCents || paymentChoice==="partial" && (totalCents<=0 || totalCents>priceCents))throw new Error("请核对实际收款合计与成交价。");
      if (debtDelivery && !debtAccepted) throw new Error("请明确确认本次欠款放行。");
      const workflow: RetailCheckoutWorkflow={type:"checkout",id:unit.id,version,settingsRevision,sale:{customerPhone:normalizeCustomerPhone(phone),customerName:name.trim(),customerEmail:email.trim(),customerAddress:address.trim(),customerNote:buyerNote.trim(),priceCents,warranty:{months:unit.warrantyMonths,termsVersion:retailWarrantyTermsVersion,shopName:settings.shopName,address:settings.address,phone:settings.phone}},payments:paymentChoice==="none"?[]:payments.map(payment=>{
        const amountCents=parseRetailMoney(payment.amount);if(amountCents===null || amountCents<=0 || !payment.method)throw new Error("请核对实际收款记录。");return {amountCents,method:payment.method,date:payment.date,note:payment.note};
      }),...(paymentChoice==="none"?{paymentUnreceived:true}:{}),...(deliveryChoice==="delivered"?{delivery:{deliveryDate,...(debtDelivery?{debt:{reason:debtReason,owner:debtOwner,followUp}}:{})}}:{})};
      for(const permission of retailWorkflowPermissions(workflow))if(!staff.can(permission))throw new Error("当前账号没有此操作权限。");
      const retailEvent={id:operationId.current,time:intakeRecordTime(),title:"登记成交",detail:"本次交易事实已核对。"};
      applyRetailWorkflow(workflow,[unit],retailEvent,settings);
      busy.current=true;setSubmitting(true);
      const saved=await dispatch({type:"workflow",workflow,event:retailEvent});
      if(!saved){setFailed(true);setError("未保存售出登记，请核对页面上的提交恢复状态。");return;}
      try {await draft.clear();} catch { /* A draft cleanup failure does not undo the committed sale. */ }
      onClose();
    } catch(reason) {setError(reason instanceof Error?reason.message:"请核对售出资料。");}
    finally {busy.current=false;setSubmitting(false);}
  }
  const failureMessage = failed && feedback?.id===unit.id && feedback.error ? feedback.message : error;
  return <form ref={form} className={styles.form} role="region" aria-labelledby={titleId} aria-busy={submitting} onSubmit={submit} onInvalidCapture={event=>{const control=event.target;if(control instanceof HTMLElement){let details=control.closest("details");while(details){details.open=true;details=details.parentElement?.closest("details") ?? null;}control.focus({preventScroll:true});control.scrollIntoView({block:"nearest",behavior:"instant"});}}} onKeyDown={event=>{if(event.key==="Escape" && !event.defaultPrevented){event.preventDefault();if(!busy.current)onClose();}}}><fieldset className="form-fields" disabled={locked}>
    <DeviceDraftNotice draft={draft}/>
    <div className={styles.heading}><h4 id={titleId} ref={heading} tabIndex={-1}>{t("登记成交")}</h4><button type="button" className="icon-button" aria-label={t("关闭售出登记")} onClick={onClose}><X size={17}/></button></div>
    {conflict?<><p className="form-error" role="alert">{t("单机或门店资料已变化，请关闭并重新核对。")}</p><button type="button" className="button button--secondary" onClick={()=>{setVersion(unit.version);setSettingsRevision(settings.revision);setPaymentChoice("");setDeliveryChoice("");changed();}}>{t("保留输入并核对最新版本")}</button></>:null}
    <div className="field-grid">
      <SearchCombobox label={t("客户手机号")} value={phone} maxLength={40} required inputMode="tel" validate={value=>controlError(()=>normalizeCustomerPhone(value))} filterOptions={false} placeholder={t("本地手机号或带区号的号码")} options={candidates.map(customer=>({value:customer.phone,label:customer.phone,detail:customer.name||t("未填写称呼")}))} emptyText={phone.replace(/\D/g,"").length<3?t("输入至少 3 位号码查找候选"):t("没有匹配客户，将按手机号关联新档案")} onChange={changePhone} onSelect={option=>{const customer=candidates.find(customer=>customer.phone===option.value);if(customer){changed();setName(customer.name);setEmail(customer.email);setAddress(customer.address);setAutoFilled({name:customer.name,email:customer.email,address:customer.address});}}}/>
      <label className="field"><span>{t("客户称呼（选填）")}</span><InputControl aria-label={t("客户称呼（选填）")} autoComplete="name" maxLength={80} value={name} onChange={event=>{changed();setName(event.target.value);setAutoFilled(previous=>({...previous,name:""}));}} onClear={()=>{changed();setName("");setAutoFilled(previous=>({...previous,name:""}));}} clearLabel={t("清空客户称呼（选填）")}/></label>
      <RetailMoneyControl label={t("本台成交价")} required value={price} onChange={value=>{changed();setPrice(value);}}/>
      <details className="field--wide"><summary>{t("更多客户资料（选填）")}</summary><div className="field-grid">      <label className="field"><span>{t("买家邮箱（选填）")}</span><InputControl aria-label={t("买家邮箱")} type="email" autoComplete="email" autoCapitalize="off" maxLength={160} value={email} onChange={event=>{changed();setEmail(event.target.value);setAutoFilled(previous=>({...previous,email:""}));}} onClear={()=>{changed();setEmail("");setAutoFilled(previous=>({...previous,email:""}));}} clearLabel={t("清空买家邮箱")}/></label>

      <label className="field field--wide"><span>{t("买家地址（选填）")}</span><TextareaControl aria-label={t("买家地址")} autoComplete="street-address" maxLength={300} rows={2} value={address} onChange={event=>{changed();setAddress(event.target.value);setAutoFilled(previous=>({...previous,address:""}));}}/></label>
      <label className="field field--wide"><span>{t("买家备注（选填）")}</span><TextareaControl aria-label={t("买家备注")} maxLength={500} rows={2} value={buyerNote} onChange={event=>{changed();setBuyerNote(event.target.value);}}/></label>
</div></details>
      <label className="field"><span>{t("本次收款情况")}</span><SelectControl aria-label={t("本次收款情况")} required value={paymentChoice} onChange={event=>choosePayment(event.target.value as PaymentChoice)}><option value="">{t("请选择")}</option><option value="none">{t("本次尚未收款")}</option><option value="full" disabled={!staff.can("sale.payment")}>{t("本次已全额收款")}</option><option value="partial" disabled={!staff.can("sale.payment")}>{t("部分或多笔实际收款")}</option></SelectControl></label>
      <label className="field"><span>{t("实际交付情况")}</span><SelectControl aria-label={t("实际交付情况")} required value={deliveryChoice} onChange={event=>{changed();setDeliveryChoice(event.target.value as DeliveryChoice);}}><option value="">{t("请选择")}</option><option value="none">{t("本次尚未交付")}</option><option value="delivered" disabled={!canDeliver}>{t("本次已实际交付")}</option></SelectControl></label>
    </div>
    {paymentChoice==="full" || paymentChoice==="partial"?<section aria-label={t("本次实际收款")}><h4>{t("本次实际收款")}</h4>{payments.map((payment,index)=><fieldset className="form-fields" key={payment.key}><legend>{t("第{v0}笔收款",{v0:index+1})}</legend><div className="field-grid"><RetailMoneyControl label={t("收款金额")} required value={payment.amount} maxCents={priceCents} onChange={value=>changePayment(payment.key,{amount:value})}/><label className="field"><span>{t("收款方式")}</span><SelectControl aria-label={t("收款方式")} required value={payment.method} onChange={event=>changePayment(payment.key,{method:event.target.value as PaymentDraft["method"]})}><option value="">{t("请选择")}</option>{Object.entries(paymentMethods).map(([value,label])=><option value={value} key={value}>{t(label)}</option>)}</SelectControl></label><RetailDateControl label={t("收款日期")} required value={payment.date} max={today()} onChange={value=>changePayment(payment.key,{date:value})}/><details className="field"><summary>{t("款项备注（选填）")}</summary><label className="field"><span>{t("款项备注（选填）")}</span><InputControl aria-label={t("款项备注（选填）")} maxLength={600} value={payment.note} onChange={event=>changePayment(payment.key,{note:event.target.value})} onClear={()=>changePayment(payment.key,{note:""})} clearLabel={t("清空款项备注")}/></label></details></div><button type="button" className="button button--secondary" disabled={payments.length<=1} onClick={()=>{changed();setPayments(previous=>previous.filter(item=>item.key!==payment.key));}}>{t("移除此笔收款")}</button></fieldset>)}<button type="button" className="button button--secondary" disabled={payments.length>=100} onClick={()=>{changed();setPayments(previous=>[...previous,newPayment()]);}}>{t("添加一笔实际收款")}</button></section>:null}
    {deliveryChoice==="delivered"?<div className="field-grid"><RetailDateControl label={t("交付日期")} required value={deliveryDate} max={today()} onChange={value=>{changed();setDeliveryDate(value);}}/>{debtDelivery?<><label className={styles.accept}><input type="checkbox" checked={debtAccepted} required disabled={!staff.can("sale.debt")} onChange={event=>{setDebtAccepted(event.target.checked);setAccepted(false);}}/>{t("明确授权本次欠款放行")}</label><label className="field field--wide"><span>{t("欠款原因")}</span><TextareaControl aria-label={t("欠款原因")} required maxLength={600} value={debtReason} onChange={event=>{changed();setDebtReason(event.target.value);}}/></label><label className="field"><span>{t("跟进责任人")}</span><InputControl aria-label={t("跟进责任人")} required maxLength={100} value={debtOwner} onChange={event=>{changed();setDebtOwner(event.target.value);}}/></label><RetailDateControl label={t("欠款跟进日")} required min={deliveryDate} value={followUp} onChange={value=>{changed();setFollowUp(value);}}/></>:null}</div>:null}
    <dl className={styles.review} aria-live="polite"><div><dt>{t("本台商品")}</dt><dd>{unit.brand} {unit.model} · {unit.code}</dd></div><div><dt>{t("本台识别码")}</dt><dd>{t("SN")}: {unit.serial||t("未记录")} · {t("IMEI 1")}: {unit.imei1||t("未记录")}{unit.imei2?<> · {t("IMEI 2")}: {unit.imei2}</>:null}</dd></div><div><dt>{t("客户 / 成交价")}</dt><dd>{name||t("未填写称呼")} · {phone||t("未记录")} · {t(retailMoney(priceCents))}</dd></div><div><dt>{t("本次实收 / 尚欠")}</dt><dd>{t(retailMoney(totalCents))} / {t(retailMoney(dueCents))}</dd></div><div><dt>{t("实际交付情况")}</dt><dd>{deliveryChoice==="delivered"?t("本次已实际交付"):deliveryChoice==="none"?t("本次尚未交付"):t("待确认")}</dd></div><div><dt>{t("商家保修")}</dt><dd>{t(retailWarrantyLabel(unit.warrantyMonths))}{t(" · 从实际交付日起算")}</dd></div><div><dt>{t("保修提供方")}</dt><dd>{settings.shopName}<br/>{settings.address}<br/>{settings.phone}</dd></div></dl>
    <RetailWarrantyTerms enabled={unit.warrantyMonths!==null}/>
    <label className={styles.accept}><input type="checkbox" required checked={accepted} onChange={event=>setAccepted(event.target.checked)}/>{t("已核对商品、成交、实际收款、交付及保修条款")}</label>
    {failureMessage || settingsError || storageError?<p className="form-error" role="alert">{systemText(failureMessage || settingsError || storageError)}</p>:null}
    <div className={styles.actions}><button type="button" className="button button--secondary" onClick={onClose}>{t("取消")}</button><button type="submit" className="button button--primary" disabled={locked || conflict || !accepted || deliveryChoice==="delivered" && (!canDeliver || debtDelivery && !debtAccepted) || paymentChoice!=="" && paymentChoice!=="none" && !staff.can("sale.payment")}><ShoppingBag size={17}/>{submitting?t("正在保存"):t("确认登记成交")}</button></div>
  </fieldset></form>;
}
