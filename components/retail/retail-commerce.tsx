"use client";
import { useLanguage } from "@/components/language-provider";
import { controlError } from "@/components/control-feedback";
import { InputControl, TextareaControl } from "@/components/input-control";
import { useDeviceDraft, DeviceDraftNotice } from "@/components/use-device-draft";
import { isBackendClient } from "@/lib/backend/client";

import { useEffect, useId, useRef, useState, type RefObject } from "react";
import Link from "next/link";
import { Banknote, Check, CreditCard, Landmark, PackageCheck, Printer, RotateCcw, ShieldCheck, ShoppingBag, Smartphone, Wallet, X } from "lucide-react";
import { SelectControl } from "@/components/select-control";
import { SingleChoice } from "@/components/single-choice";
import { SearchCombobox } from "@/components/search-combobox";
import { useStaff } from "@/components/staff/use-staff";
import { useCustomerDirectory } from "@/components/customers/customer-store";
import { customerCandidates, customerId, normalizeCustomerPhone } from "@/lib/customers";
import { intakeRecordTime } from "@/lib/repair-intake-record";
import { createRetailAfterSaleRepair } from "@/components/repairs/local-intake-store";
import { applyRetailCommand, currentRetailSale, parseRetailMoney, retailDueCents, retailMoney, retailPaidCents, retailRefundedCents, retailSaleGrossProfit, retailSaleState, type RetailAfterSale, type RetailCommand, type RetailEvent, type RetailMoneyEntry, type RetailPaymentMethod, type RetailSale, type RetailUnit } from "@/lib/retail";
import { useRetail } from "./retail-provider";
import { RetailSaleWarranty } from "./retail-warranty";
import { RetailReceipt } from "./retail-receipt";
import { RetailDateControl, RetailMoneyControl } from "./retail-input-controls";
import styles from "./retail-commerce.module.css";

const states = { payment_unknown: "收款待核对", awaiting_payment: "待收款", awaiting_delivery: "待交付", complete: "销售完成", partial_refund: "部分退款", return_pending_refund: "退回待结算", returned: "已退回结算" };
const methods = { cash: "现金", card: "银行卡", transfer: "转账", other: "其他" };
const methodOptions = [{ value: "cash", label: "现金", icon: Banknote }, { value: "card", label: "银行卡", icon: CreditCard }, { value: "transfer", label: "转账", icon: Landmark }, { value: "other", label: "其他", icon: Wallet }];
const coverageLabels = { pending: "待判定", commercial: "商家保修", statutory: "法定保障", paid: "收费维修 · 需另行报价确认" };
type Operation = "reserve" | "release_reservation" | "payment" | "payment_reconcile" | "payment_void" | "deliver" | "return" | "refund" | "refund_void" | "after_sale" | "after_sale_assess" | "after_sale_close" | "after_sale_cancel";
const titles: Record<Operation, string> = { reserve: "预留商品", release_reservation: "解除预留", payment: "登记收款", payment_reconcile: "核对历史收款", payment_void: "冲销收款", deliver: "确认实际交付", return: "登记实物退回", refund: "登记退款", refund_void: "冲销退款", after_sale: "新建售后申请", after_sale_assess: "登记售后判定", after_sale_close: "确认售后交还", after_sale_cancel: "撤销售后申请" };
const noteLabels: Partial<Record<Operation, string>> = { reserve: "预留备注", payment: "收款备注与核对依据", refund: "退款原因与核对依据", payment_reconcile: "历史收款核对依据", payment_void: "收款冲销原因", refund_void: "退款冲销原因", return: "实物退回原因", after_sale: "客户报告的问题", after_sale_assess: "保障判定依据", after_sale_close: "处理结果与交还说明", after_sale_cancel: "撤销售后申请原因", deliver: "欠款放行原因" };
type Pending = { operation: Operation; caseId?: string; entryId?: string };
const requestKey = (request: Pending) => [request.operation, request.caseId, request.entryId].join(":");

function TransactionForm({ unit, sale, request, onClose, restoreFocusRef }: { unit: RetailUnit; sale?: RetailSale; request: Pending; onClose: () => void; restoreFocusRef: RefObject<HTMLElement | null> }) {
  const { t , systemText } = useLanguage();
  const { dispatch, units, feedback, ready, error: storageError } = useRetail();
  const staff = useStaff();
  const { customers } = useCustomerDirectory();
  const currentCase = sale?.afterSales?.find(item => item.id === request.caseId);
  const [version,setVersion] = useState(unit.version);
  const [date, setDate] = useState(intakeRecordTime().slice(0, 10));
  const [amount, setAmount] = useState("");
  const [note, setNote] = useState("");
  const [phone, setPhone] = useState("");
  const [name, setName] = useState("");
  const [method, setMethod] = useState<RetailPaymentMethod | "">("");
  const [custody, setCustody] = useState<RetailAfterSale["custody"] | "">("");
  const [coverage, setCoverage] = useState<RetailAfterSale["coverage"]>(currentCase?.coverage ?? "pending");
  const [debt, setDebt] = useState(false);
  const [owner, setOwner] = useState("");
  const [followUp, setFollowUp] = useState("");
  const [checked, setChecked] = useState(false);
  const [pending, setPending] = useState<{ command: RetailCommand; event: RetailEvent; unit: RetailUnit } | null>(null);
  const [error, setError] = useState("");
  const [attempted, setAttempted] = useState(false);
  const section = useRef<HTMLElement>(null);
  const heading = useRef<HTMLHeadingElement>(null);
  const trigger = useRef<HTMLElement | null>(null);
  const selectedName = useRef("");
  const busy = useRef(false);
  const [submitting, setSubmitting] = useState(false);
  const [identity,setIdentity] = useState(()=>crypto.randomUUID());
  const titleId = useId();
  const operation = request.operation;
  const money = ["payment", "refund", "payment_reconcile"].includes(operation);
  const dated = ["reserve", "payment", "refund", "deliver", "return", "after_sale", "after_sale_close"].includes(operation);
  const needsNote = !["deliver", "release_reservation"].includes(operation) || debt;
  const conflict = units.find(item => item.id === unit.id)?.version !== version;
  const paid = sale ? retailPaidCents(sale) : null;
  const refunded = sale ? retailRefundedCents(sale) : 0;
  const due = sale ? retailDueCents(sale) : null;
  const refundable = paid === null ? null : paid - refunded;
  const originalEntry = (operation === "payment_void" ? sale?.payments : operation === "refund_void" ? sale?.refunds : undefined)?.find(item => item.id === request.entryId);
  const reviewedSale = pending?.unit.sales.find(item => item.id === sale?.id);
  const deviceDraft=useDeviceDraft(`retail-transaction:${unit.id}:${sale?.id??""}:${requestKey(request)}`,{version,date,amount,note,phone,name,method,custody,coverage,debt,owner,followUp,identity},value=>{setIdentity(value.identity);setVersion(value.version);setDate(value.date);setAmount(value.amount);setNote(value.note);setPhone(value.phone);setName(value.name);setMethod(value.method);setCustody(value.custody);setCoverage(value.coverage);setDebt(value.debt);setOwner(value.owner);setFollowUp(value.followUp);setChecked(false);setPending(null);});
  const today = intakeRecordTime().slice(0, 10);
  const minDate = operation === "reserve" ? today : operation === "return" ? sale?.deliveryDate || sale?.time.slice(0, 10) : operation === "after_sale_close" ? currentCase?.date || sale?.time.slice(0, 10) : sale?.time.slice(0, 10);
  const dateLabel = operation === "reserve" ? "预留截止日期" : operation === "deliver" ? "实际交付日期" : operation === "return" ? "实际退回日期" : operation === "after_sale" ? "售后接收日期" : operation === "after_sale_close" ? "售后交还日期" : operation === "refund" ? "实际退款日期" : "实际收款日期";

  useEffect(() => {
    trigger.current = restoreFocusRef.current ?? (document.activeElement instanceof HTMLElement ? document.activeElement : null);
    return () => { if (trigger.current?.isConnected) trigger.current.focus({ preventScroll: true }); };
  }, [restoreFocusRef]);
  useEffect(() => {
    heading.current?.focus({ preventScroll: true });
    section.current?.scrollIntoView({ block: "nearest", behavior: "instant" });
  }, [pending]);

  function build(): RetailCommand {
    const saleId = sale?.id || "";
    const id = identity;
    if (operation === "reserve") return { type: "reserve", name, phone, until: date, note };
    if (operation === "release_reservation") return { type: "release_reservation" };
    if (operation === "payment" || operation === "refund") {
      const amountCents = parseRetailMoney(amount);
      if (amountCents === null) throw new Error("请填写实际金额。");
      if (!method) throw new Error("请明确选择本次收退款方式。");
      return { type: operation, saleId, entryId: id, amountCents, date, method, note };
    }
    if (operation === "payment_reconcile") {
      const paidCents = parseRetailMoney(amount);
      if (paidCents === null) throw new Error("请填写已核对的历史实收金额。");
      return { type: operation, saleId, paidCents, reason: note };
    }
    if (operation === "payment_void" || operation === "refund_void") return { type: operation, saleId, entryId: request.entryId || "", reason: note };
    if (operation === "deliver") return { type: "deliver", saleId, deliveryDate: date, ...(debt ? { debt: { reason: note, owner, followUp } } : {}) };
    if (operation === "return") {
      if (!checked) throw new Error("请确认本台实物已实际收到。");
      return { type: "return", saleId, date, reason: note, received: true };
    }
    if (operation === "after_sale") {
      if (!custody) throw new Error("请明确选择设备是否已留下。");
      return { type: "after_sale", saleId, caseId: id, date, issue: note, custody };
    }
    if (operation === "after_sale_cancel") return { type: operation, saleId, caseId: request.caseId || "", reason: note };
    if (operation === "after_sale_assess") return { type: operation, saleId, caseId: request.caseId || "", coverage, reason: note };
    if (!checked) throw new Error("请确认售后设备已实际交还客户。");
    return { type: "after_sale_close", saleId, caseId: request.caseId || "", date, resolution: note, returned: true };
  }

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    if (busy.current) return;
    setError("");
    try {
      if (conflict) throw new Error("单机已变化，请取消后重新核对。");
      if (!pending) {
        const command = build();
        const nextEvent = { id: identity, title: titles[operation], detail: note.trim() || titles[operation], time: intakeRecordTime() };
        const reviewedUnit = applyRetailCommand(unit, command, nextEvent, version);
        setPending({ command, event: nextEvent, unit: reviewedUnit });
        return;
      }
      busy.current = true; setSubmitting(true);
      setAttempted(true);
      if (await dispatch({ type: "command", id: unit.id, version, command: pending.command, event: { ...pending.event, time: intakeRecordTime() } })) {await deviceDraft.clear();onClose();}
    } catch (reason) { setError(reason instanceof Error ? reason.message : "请核对资料。"); }
    finally { busy.current = false; setSubmitting(false); }
  }

  function commandValue(key: string, value: unknown) {
    if (typeof value === "number") return retailMoney(value);
    if (key === "method") return t(methods[value as RetailPaymentMethod]);
    if (key === "coverage") return t(coverageLabels[value as RetailAfterSale["coverage"]]);
    if (key === "custody") return value === "left" ? t("设备已留下") : t("设备未留下");
    return String(value);
  }

  return <section className={styles.transaction} ref={section} role="region" aria-labelledby={titleId} onKeyDown={event => { if (event.key === "Escape" && !event.defaultPrevented) { event.preventDefault(); if (!busy.current) onClose(); } }}>
    <header className={styles.transactionHead}><h4 id={titleId} ref={heading} tabIndex={-1}>{pending ? t("核对后确认 · ") : ""}{t(titles[operation])}</h4><button className="icon-button" type="button" aria-label={t("关闭业务操作")} disabled={submitting} onClick={onClose}><X size={18} /></button></header>
    <form aria-busy={submitting} onSubmit={submit}><fieldset className="form-fields" disabled={submitting}><DeviceDraftNotice draft={deviceDraft}/>{conflict?<button type="button" className="button button--secondary" onClick={()=>{setVersion(unit.version);setPending(null);setChecked(false);setError("");}}>{t("保留输入并核对最新版本")}</button>:null}
      <div className={styles.formBody}>
        <dl className={styles.context}><div><dt>{t("本台单机")}</dt><dd>{unit.code}</dd></div>{sale ? <div><dt>{t("原销售买家")}</dt><dd>{sale.customerName || t("未填写称呼")} · {sale.customerPhone || t("号码待核对")}</dd></div> : null}{currentCase ? <div><dt>{t("原售后问题")}</dt><dd>{currentCase.date} · {currentCase.issue}</dd></div> : null}{operation === "release_reservation" && unit.reservation ? <div><dt>{t("原预留")}</dt><dd>{unit.reservation.name || t("未填写称呼")} · {unit.reservation.phone || t("号码待核对")}<br />{t("截止 ")}{unit.reservation.until}</dd></div> : null}</dl>
        {sale && ["payment", "refund", "payment_reconcile", "payment_void", "refund_void", "deliver", "return"].includes(operation) ? <dl className={styles.amountContext}><div><dt>{t("成交价")}</dt><dd>{t(retailMoney(sale.priceCents))}</dd></div><div><dt>{t("有效实收")}</dt><dd>{t(retailMoney(paid))}</dd></div><div><dt>{operation === "refund" || operation === "return" || operation === "refund_void" ? t("可退款余额") : t("待收款")}</dt><dd>{t(retailMoney(operation === "refund" || operation === "return" || operation === "refund_void" ? refundable : due))}</dd></div></dl> : null}
        {originalEntry ? <dl className={styles.originalEntry}><div><dt>{t("本次冲销的原款项")}</dt><dd>{t(retailMoney(originalEntry.amountCents))} · {t(methods[originalEntry.method])}<br />{originalEntry.date} · {originalEntry.note || t("无备注")}</dd></div></dl> : null}
        {pending ? <>
          <dl className={styles.compare}>{Object.entries(pending.command).filter(([key]) => !["type", "saleId", "entryId", "caseId", "received", "returned", "debt"].includes(key)).map(([key, value]) => <div key={key}><dt>{t(({ amountCents: "本次金额", paidCents: "核对历史实收", date: "日期", deliveryDate: "实际交付日期", name: "客户称呼", phone: "预留号码", until: "预留截止", note: "备注与核对依据", reason: "核对原因", issue: "售后问题", resolution: "处理结果", method: "方式", custody: "设备保管", coverage: "保障判定" } as Record<string, string>)[key] || key)}</dt><dd>{commandValue(key, value) || t("未填写")}</dd></div>)}</dl>
          {pending.command.type === "deliver" && pending.command.debt ? <dl className={styles.compare}><div><dt>{t("欠款放行原因")}</dt><dd>{pending.command.debt.reason}</dd></div><div><dt>{t("责任人")}</dt><dd>{pending.command.debt.owner}</dd></div><div><dt>{t("跟进日期")}</dt><dd>{pending.command.debt.followUp}</dd></div></dl> : null}
          {reviewedSale && ["payment", "refund", "payment_reconcile", "payment_void", "refund_void"].includes(operation) ? <dl className={styles.compare}><div><dt>{t("有效实收")}</dt><dd>{t(retailMoney(paid))} → {t(retailMoney(retailPaidCents(reviewedSale)))}</dd></div><div><dt>{t("有效退款")}</dt><dd>{t(retailMoney(refunded))} → {t(retailMoney(retailRefundedCents(reviewedSale)))}</dd></div></dl> : null}
          {operation === "return" ? <><p className={styles.confirmedFact}><PackageCheck size={17} aria-hidden="true" />{t("已确认收到本台实物")}</p><p className={styles.note}>{t("实物退回后暂停销售，待退款 ")}{t(retailMoney(refundable))}{t("；款项结清及重新检测后再核对可售。")}</p></> : operation === "after_sale_close" ? <p className={styles.confirmedFact}><PackageCheck size={17} aria-hidden="true" />{t("已确认设备实际交还客户")}</p> : operation === "release_reservation" ? <p className={styles.note}>{t("解除后本台恢复可售，原预留记录保留在历史。")}</p> : null}
        </> : <>
          {operation === "reserve" ? <><SearchCombobox validate={value => controlError(() => normalizeCustomerPhone(value))} placeholder={t("例如：+39 320 000 1234")} label={t("预留客户手机号")} required value={phone} inputMode="tel" maxLength={40} filterOptions={false} options={customerCandidates(phone, customers).map(customer => ({ value: customer.phone, label: customer.phone, detail: customer.name || "未填写称呼" }))} onChange={value => { setPhone(value); if (selectedName.current && name === selectedName.current) setName(""); selectedName.current = ""; }} onSelect={option => { const candidateName = customers.find(customer => customer.phone === option.value)?.name || ""; setName(candidateName); selectedName.current = candidateName; }} /><label className="field"><span>{t("预留客户称呼（选填）")}</span><InputControl aria-label={t("预留客户称呼（选填）")} onClear={() => { setName(""); selectedName.current = ""; }} clearLabel={t("清空预留客户称呼（选填）")} autoComplete="name" value={name} maxLength={80} onChange={event => { setName(event.target.value); selectedName.current = ""; }} /></label></> : null}
          {money ? <RetailMoneyControl label={operation === "payment_reconcile" ? t("已核对历史实收") : operation === "refund" ? t("本次实际退款") : t("本次实际收款")} required value={amount} onChange={setAmount} maxCents={operation === "payment" ? due : operation === "refund" ? refundable : sale?.priceCents} placeholder={t("明确填写实际金额")} /> : null}
          {operation === "payment" || operation === "refund" ? <SingleChoice label={t("收退款方式 · 请选择")} value={method} options={methodOptions} onChange={value => setMethod(value as RetailPaymentMethod)} className={styles.methodChoice} /> : null}
          {dated ? <RetailDateControl label={t(dateLabel)} required value={date} onChange={setDate} min={minDate} max={operation === "reserve" ? undefined : today} /> : null}
          {operation === "deliver" && sale && due !== 0 ? <><p className="form-error">{due === null ? t("历史款项尚未核对，请先核对实收。") : t("款项尚未结清。只有具备欠款放行权限才可交付。")}</p>{due !== null && staff.can("sale.debt") ? <><label className={styles.accept}><input type="checkbox" checked={debt} onChange={event => setDebt(event.target.checked)} />{t("明确登记欠款放行")}</label>{debt ? <><label className="field"><span>{t("欠款责任人 *")}</span><InputControl aria-label={t("欠款责任人")} onClear={() => setOwner("")} clearLabel={t("清空欠款责任人")} required value={owner} onChange={event => setOwner(event.target.value)} maxLength={80} /></label><RetailDateControl label={t("跟进日期")} required value={followUp} onChange={setFollowUp} min={date} /></> : null}</> : null}</> : null}
          {operation === "after_sale" ? <SingleChoice label={t("设备保管 · 请选择")} value={custody} options={[{ value: "left", label: "设备已留下", icon: Smartphone }, { value: "not_left", label: "设备未留下", icon: ShoppingBag }]} onChange={value => setCustody(value as RetailAfterSale["custody"])} /> : null}
          {operation === "after_sale_assess" ? <label className="field"><span>{t("保障判定 *")}</span><SelectControl value={coverage} onChange={event => setCoverage(event.target.value as RetailAfterSale["coverage"])}>{Object.entries(coverageLabels).map(([value, label]) => <option key={value} value={value}>{t(label)}</option>)}</SelectControl></label> : null}
          {needsNote ? <label className="field"><span>{t(noteLabels[operation] || "原因与核对依据")} *</span><TextareaControl validate={value => value.trim() ? "" : "请填写具体原因与核对依据。"} placeholder={t("填写本次实际情况与核对依据")} required maxLength={500} aria-label={t(noteLabels[operation] || "业务原因")} value={note} onChange={event => setNote(event.target.value)} rows={3} /></label> : null}
          {operation === "return" || operation === "after_sale_close" ? <label className={styles.accept}><input type="checkbox" checked={checked} required onChange={event => setChecked(event.target.checked)} />{operation === "return" ? t("已实际收到本台实物；登记后隔离，退款结清及重新检测前不能再次售卖") : t("关联维修已结束，设备已实际交还客户")}</label> : null}
          {operation === "payment_reconcile" ? <p className={styles.note}>{t("未知款项不能当作零。按原凭证核对历史实收，另记后续款项。")}</p> : null}
        </>}
        {error || conflict || storageError || attempted && feedback?.error && feedback.id === unit.id ? <p className="form-error" role="alert">{conflict ? t("单机已变化，请取消后重新核对。") : systemText(error || storageError) || systemText(feedback?.message ?? "")}</p> : null}
      </div>
      <footer className={styles.transactionActions}><button type="button" className="button button--secondary" onClick={onClose}>{t("取消")}</button>{pending ? <button type="button" className="button button--secondary" onClick={() => { setPending(null); setError(""); setAttempted(false); }}>{t("返回修改")}</button> : null}<button type="submit" className="button button--primary" disabled={conflict || !ready || Boolean(storageError)}><Check size={17} />{submitting ? t("正在保存…") : pending ? t("确认保存业务记录") : t("继续核对")}</button></footer>
    </fieldset></form>
  </section>;
}

export function RetailReservation({ unit }: { unit: RetailUnit }) {
  const { t } = useLanguage();
  const staff = useStaff();
  const [request, setRequest] = useState<Pending | null>(null);
  const trigger = useRef<HTMLElement | null>(null);
  if (!staff.can("retail.sell") || !["available", "reserved"].includes(unit.status)) return null;
  return <div className={styles.reservation}>{unit.reservation ? <p><strong>{unit.reservation.name || t("未填写称呼")} · {unit.reservation.phone || t("预留号码待核对")}</strong><small>{t("截止 ")}{unit.reservation.until} {t(" · 到期需人工解除")}</small></p> : null}<button className="button button--secondary" type="button" disabled={Boolean(request)} aria-expanded={Boolean(request)} onClick={event => { trigger.current = event.currentTarget; setRequest({ operation: unit.reservation ? "release_reservation" : "reserve" }); }}><ShoppingBag size={16} />{unit.reservation ? t("解除预留") : t("预留商品")}</button>{request ? <TransactionForm key={requestKey(request)} unit={unit} request={request} restoreFocusRef={trigger} onClose={() => setRequest(null)} /> : null}</div>;
}

export function RetailSaleCard({ unit, sale }: { unit: RetailUnit; sale: RetailSale }) {
  const { t , systemText } = useLanguage();
  const staff = useStaff();
  const { dispatch, feedback } = useRetail();
  const [request, setRequest] = useState<Pending | null>(null);
  const trigger = useRef<HTMLElement | null>(null);
  const [error, setError] = useState("");
  const [printing, setPrinting] = useState(false);
  const current = currentRetailSale(unit)?.id === sale.id;
  const paid = retailPaidCents(sale);
  const refunded = retailRefundedCents(sale);
  const due = retailDueCents(sale);
  const state = retailSaleState(sale);
  const profit = retailSaleGrossProfit(sale);
  const nextStep = !current ? "" : sale.returned ? paid === null ? "退回款项待核对。" : paid > refunded ? "下一步：登记实际退款并结清退回款项。" : "实物已退回并结算，原销售记录保留。" : paid === null ? "下一步：核对历史收款。" : due && due > 0 ? "下一步：登记实际收款。" : !sale.delivered ? "下一步：确认实际交付。" : "销售已结清并交付。";
  const open = (operation: Operation, caseId?: string, entryId?: string) => { setError(""); setRequest({ operation, caseId, entryId }); };
  async function linkRepair(item: RetailAfterSale) {
    try {
      const repairId = await createRetailAfterSaleRepair(unit.id, sale.id, item.id);
      if (!isBackendClient() && !(await dispatch({ type: "command", id: unit.id, version: unit.version, command: { type: "after_sale_link", saleId: sale.id, caseId: item.id, repairId }, event: { id: crypto.randomUUID(), time: intakeRecordTime(), title: "售后关联维修", detail: repairId } }))) setError("工单已保留，可再次点击继续关联。");
    } catch (reason) { setError(reason instanceof Error ? reason.message : "创建维修失败。"); }
  }
  function transaction(active: Pending) { return <TransactionForm key={requestKey(active)} unit={unit} sale={sale} request={active} restoreFocusRef={trigger} onClose={() => setRequest(null)} />; }
  function ledger(entries: RetailMoneyEntry[] | undefined, refund: boolean) {
    return entries?.length ? <details className={styles.ledger}><summary>{refund ? t("退款") : t("收款")}{t("记录 · ")}{entries.length}</summary>{entries.toReversed().map(entry => <div className={styles.ledgerItem} key={entry.id}><div className={styles.ledgerRow}><span><strong>{t(retailMoney(entry.amountCents))} · {t(methods[entry.method])}</strong><small>{entry.date} · {entry.actorName || t("原记录")} · {entry.note}</small>{entry.void ? <small>{t("已冲销 · ")}{entry.void.reason}</small> : null}</span>{!entry.void && staff.can(refund ? "sale.refund" : "sale.reconcile") ? <button className="button button--secondary button--compact" type="button" disabled={Boolean(request)} onClick={() => open(refund ? "refund_void" : "payment_void", undefined, entry.id)}>{t("冲销")}</button> : null}</div>{request?.entryId === entry.id && request.operation === (refund ? "refund_void" : "payment_void") ? transaction(request) : null}</div>)}</details> : null;
  }
  return <article id={`sale-${sale.id}`} tabIndex={-1} className={styles.sale} aria-label={t("销售结算与售后")} onClickCapture={event => { if (!request && event.target instanceof Element) { const button = event.target.closest("button"); if (button) trigger.current = button; } }}><header><div><strong>{sale.time}</strong><small>{current ? sale.returned ? t("最近销售") : t("当前销售") : t("历史销售")} · {sale.id}</small></div><span className="status-pill status-pill--info">{t(states[state])}</span></header>{sale.customerPhone ? <Link className={styles.buyer} href={"/app/customers/" + customerId(sale.customerPhone) + "?records=sales"}>{sale.customerName || t("未填写称呼")} · {sale.customerPhone}</Link> : null}{sale.customerEmail || sale.customerAddress ? <p className={styles.note}>{sale.customerEmail} {sale.customerAddress}</p> : null}{sale.customerNote ? <p className={styles.note}>{t("买家备注：")}{sale.customerNote}</p> : null}
    {!sale.returned ? <ol className={styles.steps} aria-label={t("销售完成步骤")}><li><span>{t("买家")}</span><strong>{sale.customerPhone ? t("已关联") : t("待核对")}</strong></li><li><span>{t("收款")}</span><strong>{paid === null ? t("待核对") : due === 0 ? t("已结清") : t("待收款")}</strong></li><li><span>{t("交付")}</span><strong>{sale.delivered ? sale.deliveryDate || t("已记录 · 日期待核对") : t("待确认")}</strong></li></ol> : null}{nextStep ? <p className={styles.nextStep}>{t(nextStep)}</p> : null}
    <dl className={styles.metrics}><div><dt>{t("成交")}</dt><dd>{t(retailMoney(sale.priceCents))}</dd></div><div><dt>{t("有效收款")}</dt><dd>{t(retailMoney(paid))}</dd></div><div><dt>{sale.returned ? t("待退款") : t("未收款")}</dt><dd>{t(retailMoney(sale.returned ? paid === null ? null : paid - refunded : due))}</dd></div><div><dt>{t("已退款")}</dt><dd>{t(retailMoney(refunded))}</dd></div></dl>{staff.can("financial.read") ? <p className={styles.note}>{sale.returned ? t("退回损益待核对 · 实物价值和退回费用未计入") : (refunded ? t("退款后销售差额：") : t("销售毛利：")) + t(retailMoney(profit)) + (refunded ? t(" · 净销售收入减原成本；非净利润") : t(" · 按原销售成本快照"))}</p> : null}
    {sale.debtDelivery ? <p className={styles.note}>{t("欠款放行 · ")}{sale.debtDelivery.reason} {t(" · 责任人 ")}{sale.debtDelivery.owner} {t(" · 跟进 ")}{sale.debtDelivery.followUp}</p> : null}{sale.returned ? <p className={styles.note}>{t("实物退回 ")}{sale.returned.date} · {sale.returned.reason} {t(" · 重新检测前保持隔离")}</p> : null}
    <div className={styles.buttons}>{!sale.returned && current && unit.status === "sold" ? <>{paid === null && staff.can("sale.reconcile") ? <button type="button" className="button button--secondary" disabled={Boolean(request)} onClick={() => open("payment_reconcile")}>{t("核对历史收款")}</button> : null}{paid !== null && (due ?? 0) > 0 && staff.can("sale.payment") ? <button type="button" className="button button--primary" disabled={Boolean(request)} onClick={() => open("payment")}><CreditCard size={16} />{t("登记收款")}</button> : null}{!sale.delivered && staff.can("sale.deliver") ? <button type="button" className={"button " + (due === 0 ? "button--primary" : "button--secondary")} disabled={Boolean(request) || due === null || due > 0 && !staff.can("sale.debt")} onClick={() => open("deliver")}><PackageCheck size={16} />{t("确认交付")}</button> : null}{staff.can("sale.refund") ? <button type="button" className="button button--secondary" disabled={Boolean(request)} onClick={() => open("return")}><RotateCcw size={16} />{t("登记退回")}</button> : null}{sale.delivered && staff.can("sale.aftersales") ? <button type="button" className="button button--secondary" disabled={Boolean(request)} onClick={() => open("after_sale")}><ShieldCheck size={16} />{t("售后服务")}</button> : null}</> : null}{paid !== null && paid > refunded && staff.can("sale.refund") ? <button type="button" className="button button--secondary" disabled={Boolean(request)} onClick={() => open("refund")}>{t("登记退款")}</button> : null}<button type="button" className="button button--secondary" disabled={Boolean(request)} onClick={() => setPrinting(true)}><Printer size={16} />{t("打印销售与保修单")}</button></div>{printing ? <RetailReceipt unit={unit} sale={sale} restoreFocusRef={trigger} onClose={() => setPrinting(false)} /> : null}
    {request && !request.caseId && !request.entryId ? transaction(request) : null}
    {ledger(sale.payments, false)}{ledger(sale.refunds, true)}<RetailSaleWarranty unit={unit} sale={sale} />
    {sale.afterSales?.map(item => <section className={styles.case} key={item.id}><header><strong>{t("售后 · ")}{item.date}</strong><span className="status-pill status-pill--info">{item.cancelled ? t("已撤销") : item.closed ? t("已交还") : t(coverageLabels[item.coverage])}</span></header><p>{item.issue}</p><small>{item.custody === "left" ? t("设备已留下") : t("设备未留下")}{item.assessmentReason ? t(" · 判定依据：") + item.assessmentReason : ""}</small>{item.closed ? <p>{t("交还 ")}{item.closed.date} · {item.closed.resolution}</p> : null}{item.cancelled ? <p>{t("撤销 ")}{item.cancelled.time} · {item.cancelled.reason}</p> : null}{item.assessments?.length ? <details className={styles.ledger}><summary>{t("保障判断历史 · ")}{item.assessments.length}</summary>{item.assessments.toReversed().map(assessment => <div className={styles.ledgerRow} key={assessment.eventId}><span><strong>{t(coverageLabels[assessment.coverage])}</strong><small>{assessment.time} · {assessment.actorName || t("原记录")}</small><small>{assessment.reason}</small></span></div>)}</details> : null}<div className={styles.buttons}>{item.repairId ? <Link className="button button--secondary" href={"/app/repairs/" + item.repairId}>{t("查看售后工单")}</Link> : null}{!item.closed && !item.cancelled && staff.can("sale.aftersales") ? <><button className="button button--secondary" type="button" disabled={Boolean(request)} onClick={() => open("after_sale_assess", item.id)}>{t("判定保障")}</button>{!item.repairId && current && !sale.returned ? <button className="button button--primary" type="button" disabled={Boolean(request)} onClick={() => linkRepair(item)}>{t("建立售后工单")}</button> : item.repairId ? <button className="button button--secondary" type="button" disabled={Boolean(request)} onClick={() => open("after_sale_close", item.id)}>{t("确认售后交还")}</button> : null}{item.custody === "not_left" && !item.repairId ? <button className="button button--secondary" type="button" disabled={Boolean(request)} onClick={() => open("after_sale_cancel", item.id)}>{t("撤销申请")}</button> : null}</> : null}</div>{request?.caseId === item.id ? transaction(request) : null}</section>)}
    {error ? <p className="form-error" role="alert">{systemText(error)}</p> : null}{feedback?.id === unit.id && feedback.error ? <p className="form-error" role="alert">{systemText(feedback.message)}</p> : null}
  </article>;
}
