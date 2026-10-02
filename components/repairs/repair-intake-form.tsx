"use client";

import Link from "next/link";
import { useRef, useState } from "react";
import { isBackendClient } from "@/lib/backend/client";
import { ArrowLeft, ArrowRight, Check, CheckCircle2, CircleAlert, ClipboardCheck, Paperclip, UserRound, Wrench, Printer, History, ShieldCheck, Cable, CreditCard, Package, Smartphone, Plug } from "lucide-react";
import { PageTitle } from "@/components/page-title";
import { useStaff } from "@/components/staff/use-staff";
import { AccessPanel } from "@/components/staff/access-panel";
import { SelectControl } from "@/components/select-control";
import { SearchCombobox } from "@/components/search-combobox";
import { MultiChoice } from "@/components/multi-choice";
import { IdentifierField } from "@/components/identifier-field";
import { ColorPicker } from "@/components/color-picker";
import { emptyIntakeServices, normalizeIntakeServices, type IntakeServices } from "@/lib/intake-services";
import { intakeRecordTime, intakeSignatureSnapshot, type IntakeSignatureDraft, type IntakePolicy, type IntakeReceiptData } from "@/lib/repair-intake-record";
import { saveLocalIntake, useLocalIntakes, useRepairDirectory } from "./local-intake-store";
import { IntakeReview } from "./intake-review";
import { deviceCatalog, intakeDeviceHistory, intakeIssueText, modelsFor } from "@/lib/repair-intake";
import { customerCandidates, normalizeCustomerPhone, type Customer } from "@/lib/customers";
import { useCustomerDirectory } from "@/components/customers/customer-store";
import { IntakeFaultPicker } from "./intake-fault-picker";
import { IntakePhotos, useIntakePhotos } from "./intake-photos";
import { useStoreSettings } from "@/components/settings/settings-store";
import { IntakeSignatureEditor, SignatureImage } from "./intake-signature";
import { IntakeReceipt } from "./intake-receipt";

type FormState = { customerName: string; phone: string; email: string; category: string; brand: string; model: string; color: string; serial: string; faults: string[]; issue: string; accessories: string[]; otherAccessory: string; priority: "普通" | "优先" | "紧急"; services: IntakeServices; consent: boolean };
const initialForm: FormState = { customerName: "", phone: "", email: "", category: "手机", brand: "", model: "", color: "", serial: "", faults: [], issue: "", accessories: [], otherAccessory: "", priority: "普通", services: emptyIntakeServices, consent: false };
const steps = [{ label: "客户", icon: UserRound }, { label: "设备", icon: Wrench }, { label: "故障", icon: Paperclip }, { label: "确认", icon: ClipboardCheck }];
const accessoryOptions = [{ value: "SIM 卡", label: "SIM 卡", icon: CreditCard }, { value: "SIM 卡托", label: "SIM 卡托", icon: CreditCard }, { value: "手机壳", label: "手机壳", icon: Smartphone }, { value: "保护膜", label: "保护膜", icon: ShieldCheck }, { value: "充电器", label: "充电器", icon: Plug }, { value: "数据线", label: "数据线", icon: Cable }, { value: "包装盒", label: "包装盒", icon: Package }, { value: "其他", label: "其他", icon: Paperclip }];

export function RepairIntakeForm() {
  const {settings,ready:settingsReady,error:settingsError}=useStoreSettings();
  const [signature,setSignature]=useState<IntakeSignatureDraft|null>(null);
  const [signing,setSigning]=useState(false);
  const [signatureCount,setSignatureCount]=useState(0);
  const localIntakes=useLocalIntakes();
  const savedRevision=useRef(0);
  const [savedPolicy,setSavedPolicy]=useState<IntakePolicy|null>(null);
  const canEdit = useStaff().can("repairs.edit");
  const [step, setStep] = useState(0);
  const [form, setForm] = useState<FormState>(initialForm);
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const busy = useRef(false);
  const [submitted, setSubmitted] = useState<IntakeReceiptData | null>(null);
  const [printOpen, setPrintOpen] = useState(false);
  const [customer, setCustomer] = useState<Customer | null>(null);
  const recordIdentity = useRef<{ id: string; createdAt: string } | null>(null);
  const repairOrders = useRepairDirectory();
  const photos = useIntakePhotos();
  const { customers } = useCustomerDirectory();
  const candidates = customerCandidates(form.phone,customers);
  const history = intakeDeviceHistory(form.serial,form.brand,form.model,repairOrders);
  const accessories = [...form.accessories.filter(value => value !== "其他"), ...(form.accessories.includes("其他") && form.otherAccessory.trim() ? [form.otherAccessory.trim()] : [])];
  const policy=savedPolicy ?? {months:settings.repairWarrantyMonths,shopName:settings.shopName,address:settings.address,phone:settings.phone};
  const reviewData:IntakeReceiptData={...form,customerName:form.customerName.trim(),phone:form.phone.trim(),email:form.email.trim(),brand:form.brand.trim(),model:form.model.trim(),color:form.color.trim(),serial:form.serial.trim(),issue:intakeIssueText(form.faults,form.issue),issueNote:form.issue.trim(),accessories,id:"LOCAL-0000000000000000",createdAt:"",updatedAt:"",previewAt:"",photoCount:photos.photos.length};
  const signatureCurrent=signature && JSON.stringify(signature.snapshot)===JSON.stringify(intakeSignatureSnapshot(reviewData,policy));
  const setField = <Key extends keyof FormState>(key: Key, value: FormState[Key]) => { if (key === "customerName" || key === "email") setCustomer(null); setForm(current => { const next = { ...current, consent: false, [key]: value }; return { ...next, services: normalizeIntakeServices(next.services,next.faults,next.brand) }; }); setError(""); };
  const updatePhone = (phone: string) => {
    setForm(current => ({ ...current, phone, consent: false, customerName: customer && current.customerName === customer.name ? "" : current.customerName, email: customer && current.email === customer.email ? "" : current.email }));
    setCustomer(null); setError("");
  };
  const chooseCustomer = (id: string) => { const selected = customers.find(item => item.id === id); if (selected) { setCustomer(selected); setForm(current => ({ ...current, phone: selected.phone, customerName: selected.name, email: selected.email, consent: false })); } };
  const validateCurrentStep = () => {
    if (step === 0) { try { normalizeCustomerPhone(form.phone); } catch { return "请填写有效联系电话，外国号码须包含区号。"; } }
    if (step === 0 && form.email.trim() && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email.trim())) return "请核对电子邮件，或留空。";
    if (step === 1 && (!form.brand.trim() || !form.model.trim())) return "请填写或选择品牌和型号。";
    if (step === 2 && photos.pending.length) return "照片正在读取，请稍候。";
    if (step === 2 && !intakeIssueText(form.faults,form.issue)) return "请选择故障，或填写故障描述。";
    if (step === 2 && form.accessories.includes("其他") && !form.otherAccessory.trim()) return "请填写其他随件。";
    if (step === 3 && !form.consent) return "请先核对接机信息。";
    return "";
  };
  const goNext = () => { const message = validateCurrentStep(); if (message) { setError(message); return; } setStep(current => Math.min(current + 1,steps.length - 1)); };
  const finishPreview = async () => {
    if (!canEdit || busy.current) return;
    const message = validateCurrentStep(); if (message) { setError(message); return; }
    if(!settingsReady || settingsError) {setError(settingsError || "正在读取门店保修设置。");return;}
    if(signing) {setError("请确认当前签名，或取消跳过签名。");return;}
    if(signature && !signatureCurrent) {setError("接机资料已变化，请重新签署或清除草稿签名。");return;}
    const updatedAt = intakeRecordTime();
    if (!recordIdentity.current) recordIdentity.current = { id: `LOCAL-${crypto.randomUUID().replaceAll("-", "").slice(0,16).toUpperCase()}`, createdAt: updatedAt };
    const { customerName, phone, email, category, brand, model, color, serial, priority, services } = form;
    const data: IntakeReceiptData = { customerName: customerName.trim(), phone: phone.trim(), email: email.trim(), category, brand: brand.trim(), model: model.trim(), color: color.trim(), serial: serial.trim(), priority, services, policy, faults:form.faults, issueNote:form.issue.trim(), ...recordIdentity.current, updatedAt, issue: intakeIssueText(form.faults,form.issue), accessories, photoCount: photos.photos.length, previewAt: updatedAt.slice(0,16) };
    busy.current = true; setSubmitting(true); setError("");
    try {
      const attachments = isBackendClient() ? await photos.encode() : undefined;
      const saved = await saveLocalIntake(attachments ? {...data, photos:attachments.map(({id,slot})=>({id,slot}))} : data,savedRevision.current,signature??undefined,signatureCount,attachments);
      savedRevision.current=saved.revision!; setSavedPolicy(saved.policy!); setSignature(null); setSubmitted(saved);
    }
    catch (error) { setError(error instanceof Error ? error.message : "保存失败，请重试。"); }
    finally { busy.current = false; setSubmitting(false); }
  };
  const reset = () => { setSubmitted(null); setStep(0); setForm(initialForm); setCustomer(null); recordIdentity.current = null; setError(""); photos.clear(); setSignature(null);setSigning(false);savedRevision.current=0;setSavedPolicy(null); };

  if (!canEdit) return <AccessPanel />;
  if (submitted) return <main className="module-page"><header className="module-heading"><PageTitle title="接机完成" backHref="/app/repairs" backLabel="返回工单列表" /></header><div className="intake-success"><section className="panel intake-success__card"><span className="intake-success__icon"><CheckCircle2 size={34} /></span><h2>接机信息已保存</h2><p>{submitted.id}<br />{isBackendClient() ? "已保存至门店后台 · 照片随工单保存" : "仅保存在当前浏览器 · 照片仅本次预览"}</p><div className="intake-success__summary"><span><small>客户</small><strong>{submitted.customerName || "未填写姓名"}</strong><small>{submitted.phone}</small></span><span><small>设备</small><strong>{submitted.brand} {submitted.model}</strong></span><span><small>优先级 / 照片</small><strong>{submitted.priority} · {submitted.photoCount} 张</strong></span></div><div className="intake-success__actions"><button type="button" className="button button--primary" onClick={() => setPrintOpen(true)}><Printer size={17} />打印接机单</button><Link className="button button--secondary" href={`/app/repairs/${submitted.id}`}><ClipboardCheck size={17} />查看工单</Link><button className="button button--secondary" type="button" onClick={() => { setSubmitted(null); setField("consent",false); setStep(3); }}>修改信息</button><button className="button button--secondary" type="button" onClick={reset}>再建一张</button></div></section></div>{printOpen ? <IntakeReceipt data={submitted} onClose={() => setPrintOpen(false)} /> : null}</main>;

  return <main className="module-page intake-page"><header className="module-heading module-heading--compact"><PageTitle title="新建维修工单" backHref="/app/repairs" backLabel="返回工单列表" /></header><div className="intake-layout"><aside className="panel intake-stepper" aria-label="新建工单步骤">{steps.map((item,index) => <div className={index === step ? "intake-step intake-step--active" : index < step ? "intake-step intake-step--done" : "intake-step"} key={item.label} aria-current={index === step ? "step" : undefined}><span>{index < step ? <Check size={16} /> : <item.icon size={17} />}</span><div><small>步骤 {index + 1}</small><strong>{item.label}</strong></div></div>)}</aside>
    <form className="panel intake-form" aria-busy={submitting} onSubmit={event => { event.preventDefault(); if (busy.current) return; if (step < steps.length - 1) goNext(); else finishPreview(); }}><div className="intake-form__head"><span>步骤 {step + 1} / {steps.length}</span><h3>{["客户联系资料","送修设备","故障与随件","提交前核对"][step]}</h3></div><div className={`intake-form__body${step === 3 ? " intake-form__body--review" : ""}`}>
      {step === 0 ? <div className="field-grid"><SearchCombobox label="联系电话" maxLength={40} required inputMode="tel" value={form.phone} onChange={updatePhone} autoFocus placeholder="输入电话号码" filterOptions={false} emptyText={form.phone.replace(/\D/g,"").length < 3 ? "输入至少 3 位号码查找候选" : "没有匹配客户，可继续填写"} options={candidates.map(item => ({ value: item.phone, label: item.phone, detail: item.name || "未填写称呼" }))} onSelect={option => { const match = candidates.find(item => item.phone === option.value); if (match) chooseCustomer(match.id); }} /><label className="field"><span>客户称呼（选填）</span><input value={form.customerName} onChange={event => setField("customerName",event.target.value)} placeholder="例如：陈女士" maxLength={80} /></label>{customer ? <div className="intake-customer-match field--wide" role="status"><UserRound size={17} /><strong>已选择 {customer.name || "未填写称呼"}</strong><small>按手机号关联客户档案</small><button className="icon-button" type="button" aria-label="取消客户关联" onClick={() => { setCustomer(null); setForm(current => ({ ...current, customerName: "", email: "", consent: false })); }}><ArrowLeft size={16} /></button></div> : null}<label className="field field--wide"><span>电子邮件（选填）</span><input type="email" value={form.email} onChange={event => setField("email",event.target.value)} placeholder="customer@example.com" inputMode="email" maxLength={160} /></label></div> : null}
      {step === 1 ? <div className="field-grid"><label className="field"><span>设备类别 *</span><SelectControl value={form.category} onChange={event => setForm(current => ({ ...current, category: event.target.value, brand: "", model: "", services: normalizeIntakeServices(current.services,current.faults,""), consent: false }))}>{Object.keys(deviceCatalog).map(category => <option key={category}>{category}</option>)}</SelectControl></label><SearchCombobox label="品牌" maxLength={100} required value={form.brand} onChange={brand => { setForm(current => ({ ...current, brand, model: current.brand === brand ? current.model : "", services: normalizeIntakeServices(current.services,current.faults,brand), consent: false })); setError(""); }} options={Object.keys(deviceCatalog[form.category] ?? {}).map(brand => ({ value:brand,label:brand }))} placeholder="搜索或手动填写" /><SearchCombobox label="型号" maxLength={160} required value={form.model} onChange={value => setField("model",value)} options={modelsFor(form.category,form.brand).map(model => ({ value:model,label:model }))} placeholder="搜索或手动填写" /><ColorPicker value={form.color} onChange={value => setField("color",value)} /><div className="field--wide"><IdentifierField label="SN / IMEI" value={form.serial} onChange={value => setField("serial",value)} kind="serial-or-imei" placeholder="输入或扫码，未知可留空" /></div>
        {history.exact.length ? <section className="intake-device-history field--wide"><h4><History size={17} />同一标识的维修记录 <span>{history.exact.length}</span></h4><p>跨客户匹配，请核对实物；不会带入历史客户。</p>{history.exact.map(order => <Link href={`/app/repairs/${order.id}`} key={order.id} target="_blank" rel="noopener noreferrer"><span><strong>{order.device.brand} {order.device.model}</strong><small>{order.id} · {order.createdAt}</small></span><span>{order.statusLabel}<ArrowRight size={14} /></span></Link>)}</section> : form.serial.trim().length >= 5 ? <p className="intake-history-empty field--wide" role="status"><History size={16} />暂无同一标识的演示记录</p> : null}
        {history.related.length ? <details className="intake-device-history field--wide"><summary><History size={17} />同型号维修参考 · {history.related.length} 条</summary><p>型号相同不能确认是同一台设备。</p>{history.related.slice(0,3).map(order => <Link href={`/app/repairs/${order.id}`} key={order.id} target="_blank" rel="noopener noreferrer"><span><strong>{order.issue}</strong><small>{order.id} · {order.createdAt}</small></span><ArrowRight size={15} /></Link>)}</details> : null}
      </div> : null}
      {step === 2 ? <div className="intake-issue-layout"><IntakeFaultPicker values={form.faults} onChange={value => setField("faults",value)} brand={form.brand} services={form.services} onServicesChange={value => setField("services",value)} /><label className="field"><span>故障补充 / 自定义故障</span><textarea value={form.issue} onChange={event => setField("issue",event.target.value)} placeholder="补充现象、发生时间等" rows={3} maxLength={2000} /></label><MultiChoice label="随件（多选）" values={form.accessories} onChange={value => setField("accessories",value)} options={accessoryOptions} />{!form.accessories.length ? <small className="intake-muted">无随件</small> : null}{form.accessories.includes("其他") ? <label className="field"><span>其他随件 *</span><input value={form.otherAccessory} onChange={event => setField("otherAccessory",event.target.value)} placeholder="例如：65W USB-C 充电器" maxLength={160} /></label> : null}<label className="field"><span>优先级</span><SelectControl value={form.priority} onChange={event => setField("priority",event.target.value as FormState["priority"])}><option>普通</option><option>优先</option><option>紧急</option></SelectControl></label><IntakePhotos {...photos} /></div> : null}
      {step === 3 ? <><IntakeReview data={{ ...form, issue: intakeIssueText(form.faults,form.issue), accessories }} photos={photos.photos} onEdit={step => { if (busy.current) return; setField("consent",false); setStep(step); }} /><section className="intake-signature-draft"><div className="intake-signature-draft__head"><strong>客户签名 <small>选填 · 商家保修 {policy.months} 个月</small></strong><button className="button button--secondary button--compact" type="button" disabled={submitting || signing || !settingsReady || !!settingsError || !localIntakes.ready || !!localIntakes.error} onClick={()=>{setSignatureCount(localIntakes.signatures.filter(item=>item.orderId===recordIdentity.current?.id).length);setSignature(null);setSigning(true);}}>{signature ? "重新签署" : "客户签字"}</button></div>{signing?<IntakeSignatureEditor data={reviewData} policy={policy} onConfirm={draft=>{setSignature(draft);setSigning(false);setError("");}} onCancel={()=>{setSigning(false);setSignature(null);}}/>:signature?<><SignatureImage strokes={signature.strokes} aspectRatio={signature.aspectRatio} label="待保存客户签名"/><p className="intake-muted">{signatureCurrent?"签名待随接机资料保存":"资料已变化，请重新签署"} · {signature.language}</p><button className="button button--secondary button--compact" type="button" disabled={submitting} onClick={()=>setSignature(null)}>清除草稿签名</button></>:<p className="intake-muted">可交给客户直接签字，或跳过后在详情补签。</p>}</section><label className="review-confirm"><input type="checkbox" disabled={submitting} checked={form.consent} onChange={event => setField("consent",event.target.checked)} /><ShieldCheck size={21} /><span><strong>已与客户核对接机信息</strong><small>设备、随件与维修需求</small></span></label></> : null}
      {error ? <p className="form-error" role="alert"><CircleAlert size={16} />{error}</p> : null}</div><div className="intake-form__actions"><button className="button button--secondary" type="button" disabled={submitting || step === 0} onClick={() => { setError(""); setField("consent",false); setStep(current => Math.max(0,current - 1)); }}><ArrowLeft size={16} />上一步</button>{step < steps.length - 1 ? <button className="button button--primary" type="button" key="next-step" disabled={step === 2 && photos.pending.length > 0} onClick={goNext}>下一步<ArrowRight size={16} /></button> : <button className="button button--primary" type="button" key="finish-preview" disabled={submitting} onClick={() => void finishPreview()}><ClipboardCheck size={17} />{submitting ? "正在保存…" : "保存并预览"}</button>}</div></form></div></main>;
}
