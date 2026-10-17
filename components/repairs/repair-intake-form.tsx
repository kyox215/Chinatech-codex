"use client";
import{useActivityFeedback}from"@/components/operation-feedback";
import { OperationRecoveryControls, useOperationReceipt } from "@/components/use-operation-receipt";
import { CatalogIndexPreload,DeviceIdentityPicker,DeviceIdentityExtras,IdentityChangeNotice } from "@/components/catalog/device-identity-picker";
import { canonicalCatalogBrand } from "@/lib/device-catalog";
import { useLanguage } from "@/components/language-provider";
import {useBackendState}from'@/components/backend-snapshot';
import{backendScopeKey}from'@/lib/backend/read-plan';
import{useCustomerListPage,requestCustomerList}from'@/components/customers/use-customer-list-page';
import{requestIntakeDraftMetadata}from'./use-intake-lookup';
import{IntakeDeviceHistory}from'./intake-device-history';
import { controlError } from "@/components/control-feedback";

import { InputControl, TextareaControl } from "@/components/input-control";
import { NavigationLink as Link } from "@/components/navigation-link";
import { useDeviceDraft, DeviceDraftNotice } from "@/components/use-device-draft";
import { useEffect,useLayoutEffect,useRef, useState } from "react";
import { backendSnapshot, isBackendClient } from "@/lib/backend/client";
import { ArrowLeft, ArrowRight, Check, CheckCircle2, CircleAlert, ClipboardCheck, Paperclip, UserRound, Wrench, Printer, ShieldCheck, Cable, CreditCard, Package, Smartphone, Plug } from "lucide-react";
import { PageTitle } from "@/components/page-title";
import { useStaff } from "@/components/staff/use-staff";
import { AccessPanel } from "@/components/staff/access-panel";
import { SelectControl } from "@/components/select-control";
import { SearchCombobox } from "@/components/search-combobox";
import { MultiChoice } from "@/components/multi-choice";
import { IdentifierField } from "@/components/identifier-field";
import { ColorPicker } from "@/components/color-picker";
import { intakeRequirements } from "@/lib/repair-requirements";
import { parseItemMoney } from "@/lib/repair-item-pricing";
import { emptyIntakeServices, normalizeIntakeServices, type IntakeServices } from "@/lib/intake-services";
import { intakeRecordTime, intakeSignatureSnapshot, type IntakeSignatureDraft, type IntakePolicy, type IntakeReceiptData } from "@/lib/repair-intake-record";
import { saveLocalIntake, useLocalIntakes, useRepairDirectory } from "./local-intake-store";
import { IntakeReview } from "./intake-review";
import { deviceCatalog, intakeIssueText } from "@/lib/repair-intake";
import { customerCandidates, normalizeCustomerPhone, type Customer } from "@/lib/customers";
import { useCustomerDirectory } from "@/components/customers/customer-store";
import { IntakeFaultPicker } from "./intake-fault-picker";
import { IntakePhotos, useIntakePhotos } from "./intake-photos";
import { useStoreSettings } from "@/components/settings/settings-store";
import { IntakeSignatureEditor, SignatureImage } from "./intake-signature";
import { RepairIntakePrint } from "./repair-intake-print";

type FormState = { customerName: string; phone: string; email: string; category: string; brand: string; model: string; color: string; serial: string; faults: string[]; issue: string; accessories: string[]; otherAccessory: string; priority: "普通" | "优先" | "紧急"; services: IntakeServices; consent: boolean; quoteInputs?: Record<string,string> };
const initialForm: FormState = { customerName: "", phone: "", email: "", category: "手机", brand: "", model: "", color: "", serial: "", faults: [], issue: "", accessories: [], otherAccessory: "", priority: "普通", services: emptyIntakeServices, consent: false };
const steps = [{ label: "客户", icon: UserRound }, { label: "设备", icon: Wrench }, { label: "故障", icon: Paperclip }, { label: "确认", icon: ClipboardCheck }];
const accessoryOptions = [{ value: "SIM 卡", label: "SIM 卡", icon: CreditCard }, { value: "SIM 卡托", label: "SIM 卡托", icon: CreditCard }, { value: "手机壳", label: "手机壳", icon: Smartphone }, { value: "保护膜", label: "保护膜", icon: ShieldCheck }, { value: "充电器", label: "充电器", icon: Plug }, { value: "数据线", label: "数据线", icon: Cable }, { value: "包装盒", label: "包装盒", icon: Package }, { value: "其他", label: "其他", icon: Paperclip }];

export function RepairIntakeForm() {
  const { t, systemText } = useLanguage();
  const backend=useBackendState(),bounded=backend.formal&&Boolean(backend.snapshot?.repairListEnabled&&backend.snapshot?.customerListEnabled),readScope=backend.snapshot?.read?.scope,scopeKey=readScope?backendScopeKey(readScope):'';
  const {settings,ready:legacySettingsReady,error:legacySettingsError}=useStoreSettings();
  const defaults=backend.snapshot?.intakeDefaults,settingsReady=bounded?Boolean(defaults):legacySettingsReady,settingsError=bounded?"":legacySettingsError;
  const [signature,setSignature]=useState<IntakeSignatureDraft|null>(null);
  const [signing,setSigning]=useState(false);
  const [signatureCount,setSignatureCount]=useState(0);
  const localIntakes=useLocalIntakes();
  const [savedRevision,setSavedRevision]=useState(0);
  const [savedPolicy,setSavedPolicy]=useState<IntakePolicy|null>(null);
  const staff=useStaff(),canEdit = staff.can("repairs.edit");
  const [step, setStep] = useState(0);
  const [form, setForm] = useState<FormState>(initialForm);
  const [identityUndo, setIdentityUndo] = useState<{ before: { brand: string; model: string }; expected: string } | null>(null);
  const [error, setError] = useState("");
  const formElement = useRef<HTMLFormElement>(null);
  const receipt = useOperationReceipt();
  const [submittingBase, setSubmitting] = useState(false);
  const submitting = submittingBase || receipt.waiting;
  const unknown=receipt.waiting&&Boolean(receipt.requestId);
  const processing=submittingBase||(receipt.waiting&&!receipt.requestId);
  const busy = useRef(false);
  const [submitted, setSubmitted] = useState<IntakeReceiptData | null>(null);
  const [printOpen, setPrintOpen] = useState(false);
  const printTrigger = useRef<HTMLButtonElement>(null);
  const [customer, setCustomer] = useState<Pick<Customer,'id'|'phone'|'name'|'email'> | null>(null);
  const[choiceFlight,setChoiceFlight]=useState<{key:string;epoch:number}|null>(null),[signatureFlight,setSignatureFlight]=useState<{key:string;epoch:number}|null>(null),lookupEpoch=useRef(0),signatureEpoch=useRef(0),lookupLive=useRef(true),liveScope=useRef(scopeKey);
  useLayoutEffect(()=>{liveScope.current=scopeKey;lookupEpoch.current++;signatureEpoch.current++;},[scopeKey]);
  useEffect(()=>{const choice=lookupEpoch,signature=signatureEpoch;lookupLive.current=true;return()=>{lookupLive.current=false;choice.current++;signature.current++;};},[]);
  const [draftIdentity,setDraftIdentity]=useState(()=>({id:`LOCAL-${crypto.randomUUID().replaceAll("-", "").slice(0,16).toUpperCase()}`,createdAt:intakeRecordTime()}));
  const recordIdentity = useRef<{ id: string; createdAt: string } | null>(draftIdentity);
  const choiceKey=JSON.stringify([scopeKey,form.phone,step]),signatureKey=JSON.stringify([scopeKey,draftIdentity.id,savedRevision,step,form]);
  const latestLookup=useRef({choiceKey,signatureKey});
  useLayoutEffect(()=>{latestLookup.current={choiceKey,signatureKey};},[choiceKey,signatureKey]);
  const choosing=choiceFlight?.key===choiceKey,signatureReading=signatureFlight?.key===signatureKey;
  useActivityFeedback(choosing||signatureReading,{kind:"read"});
  const[flightScope,setFlightScope]=useState(scopeKey);
  if(flightScope!==scopeKey){setFlightScope(scopeKey);setChoiceFlight(null);setSignatureFlight(null);}
  function cancelLookups(){lookupEpoch.current++;signatureEpoch.current++;setChoiceFlight(null);setSignatureFlight(null);}
  const repairOrders = useRepairDirectory();
  const photos = useIntakePhotos();
  const { customers } = useCustomerDirectory();
  const deviceDraft=useDeviceDraft("repair-intake",{form,step,signature,signatureCount,savedPolicy,identity:draftIdentity,revision:savedRevision,photos:photos.draftPhotos},value=>{
    if(!value.form || typeof value.form.phone!=="string" || !value.identity?.id)throw new Error("草稿格式无效。");
    cancelLookups();photos.restore(value.photos);setForm({...value.form,consent:false});setStep(Math.min(3,Math.max(0,value.step)));setSignature(value.signature);setSignatureCount(value.signatureCount);setSavedPolicy(value.savedPolicy);setDraftIdentity(value.identity);recordIdentity.current=value.identity;setSavedRevision(value.revision);setSigning(false);setCustomer(null);setSubmitted(null);
  },!submitted && Boolean(form.phone || form.brand || form.issue || photos.photos.length));

  const remoteCandidates=useCustomerListPage(bounded&&step===0?form.phone:'','phone');
  const candidates = bounded?remoteCandidates.page?.items??[]:customerCandidates(form.phone,customers);
  const accessories = [...form.accessories.filter(value => value !== "其他"), ...(form.accessories.includes("其他") && form.otherAccessory.trim() ? [form.otherAccessory.trim()] : [])];
  const policy=savedPolicy ?? (bounded?defaults?.policy??null:{months:settings.repairWarrantyMonths,shopName:settings.shopName,address:settings.address,phone:settings.phone});
  const quoteItems=intakeRequirements(form).map(row=>row.title);
  const itemQuotes=quoteItems.map(item=>{let amountCents=null;try{amountCents=parseItemMoney(form.quoteInputs?.[item]??"");}catch{}return {item,amountCents};});
  const reviewData:IntakeReceiptData={...form,itemQuotes,customerName:form.customerName.trim(),phone:form.phone.trim(),email:form.email.trim(),brand:form.brand.trim(),model:form.model.trim(),color:form.color.trim(),serial:form.serial.trim(),issue:intakeIssueText(form.faults,form.issue),issueNote:form.issue.trim(),accessories,id:"LOCAL-0000000000000000",createdAt:"",updatedAt:"",previewAt:"",photoCount:photos.photos.length};
  const signatureCurrent=signature && policy && JSON.stringify(signature.snapshot)===JSON.stringify(intakeSignatureSnapshot(reviewData,policy));
  const setField = <Key extends keyof FormState>(key: Key, value: FormState[Key]) => { signatureEpoch.current++;setSignatureFlight(null);if (key === "customerName" || key === "email") {lookupEpoch.current++;setChoiceFlight(null);setCustomer(null);} setForm(current => { const next = { ...current, consent: false, [key]: value }; const normalized={ ...next, services: normalizeIntakeServices(next.services,next.faults,next.brand) }; const titles=new Set(intakeRequirements(normalized).map(row=>row.title));return {...normalized,quoteInputs:Object.fromEntries(Object.entries(normalized.quoteInputs??{}).filter(([title])=>titles.has(title)))}; }); setError(""); };
  function normalizeIdentity(current: FormState, next: { brand: string; model: string }): FormState {
    const updated = { ...current, ...next, services: normalizeIntakeServices(current.services, current.faults, next.brand), consent: false };
    const titles = new Set(intakeRequirements(updated).map(row => row.title));
    return { ...updated, quoteInputs: Object.fromEntries(Object.entries(updated.quoteInputs ?? {}).filter(([title]) => titles.has(title))) };
  }
  function updateIdentity(next: { brand: string; model: string }) {
    const changedBrand = canonicalCatalogBrand(next.brand) !== canonicalCatalogBrand(form.brand);
    const updated = normalizeIdentity(form, { ...next, model: changedBrand ? "" : next.model });
    if (updated.brand !== form.brand || updated.model !== form.model) { setSignature(null); setSigning(false); }
    setIdentityUndo(changedBrand && Boolean(form.brand || form.model)
      ? { before: { brand: form.brand, model: form.model }, expected: JSON.stringify(updated) } : null);
    setForm(updated); setError("");
  }
  const showIdentityNotice = identityUndo && identityUndo.expected === JSON.stringify(form) && step === 1;
  function undoIdentity() {
    if (!showIdentityNotice || submitting || !identityUndo) return;
    setForm(current => normalizeIdentity(current, identityUndo.before));
    setIdentityUndo(null); setError("");
  }
  const updatePhone = (phone: string) => {
    lookupEpoch.current++;setChoiceFlight(null);
    setForm(current => ({ ...current, phone, consent: false, customerName: customer && current.customerName === customer.name ? "" : current.customerName, email: customer && current.email === customer.email ? "" : current.email }));
    setCustomer(null); setError("");
  };
  async function chooseCustomer(id:string){
    const selected=candidates.find(item=>item.id===id);if(!selected)return;
    const epoch=++lookupEpoch.current,expected=scopeKey,key=JSON.stringify([scopeKey,selected.phone,step]),current=()=>latestLookup.current.choiceKey===key&&lookupLive.current&&lookupEpoch.current===epoch&&liveScope.current===expected&&(!bounded||backendSnapshot()?.read?.scope&&backendScopeKey(backendSnapshot()!.read!.scope)===expected);
    if(bounded&&!readScope)return;
    try{setChoiceFlight(bounded?{key,epoch}:null);const value=bounded?await requestCustomerList(readScope!,{q:selected.phone,mode:'exact'},{signal:AbortSignal.timeout(15000)}):null;if(!current())return;const full=value&&'items'in value?value.items.find(item=>item.id===id):bounded?null:selected;if(!full)throw new Error('客户资料已更新，请重新核对后提交。');setCustomer(full);setForm(current=>({...current,phone:full.phone,customerName:full.name,email:full.email,consent:false}));setError('');}
    catch(reason){if(current())setError(reason instanceof Error?reason.message:'后台资料暂不可用。');}finally{if(current())setChoiceFlight(null);}
  }
  async function openSignature(){
    if(submitting||signing||signatureReading)return;
    if(!bounded){setSignatureCount(localIntakes.signatures.filter(item=>item.orderId===recordIdentity.current?.id).length);setSignature(null);setSigning(true);return;}
    if(!readScope||!staff.can('repairs.view')){setError('当前账号没有此操作权限。');return;}
    const epoch=++signatureEpoch.current,expected=scopeKey,id=recordIdentity.current!.id,revision=savedRevision,key=signatureKey,current=()=>latestLookup.current.signatureKey===key&&lookupLive.current&&signatureEpoch.current===epoch&&liveScope.current===expected&&recordIdentity.current?.id===id&&backendSnapshot()?.read?.scope&&backendScopeKey(backendSnapshot()!.read!.scope)===expected;
    setSignatureFlight({key,epoch});setError('');
    try{const value=await requestIntakeDraftMetadata(readScope,id,AbortSignal.timeout(15000));if(!current())return;if(value.revision!==revision)throw new Error('接机资料已变化，请重新核对。');setSignatureCount(value.signatureCount);setSavedPolicy(value.policy);setSignature(null);setSigning(true);}
    catch(reason){if(current())setError(reason instanceof Error?reason.message:'后台资料暂不可用。');}finally{if(current())setSignatureFlight(null);}
  }
  const validateCurrentStep = () => {
    if (step === 0) { try { normalizeCustomerPhone(form.phone); } catch { return "请填写有效联系电话，外国号码须包含区号。"; } }
    if(step===0&&form.customerName.length>80)return "请填写有效称呼（最多 80 字）。";
    if (step === 0 && form.email.trim() && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email.trim())) return "请核对电子邮件，或留空。";
    if (step === 1 && (!form.brand.trim() || !form.model.trim())) return "请填写或选择品牌和型号。";
    if(step===2){try{for(const item of quoteItems)parseItemMoney(form.quoteInputs?.[item]??"");}catch(reason){return reason instanceof Error?reason.message:"请核对报价。";}}
    if (step === 2 && photos.pending.length) return "照片正在读取，请稍候。";
    if (step === 2 && !intakeIssueText(form.faults,form.issue)) return "请选择故障，或填写故障描述。";
    if (step === 2 && form.accessories.includes("其他") && !form.otherAccessory.trim()) return "请填写其他随件。";
    if (step === 3 && !form.consent) return "请先核对接机信息。";
    return "";
  };
  const goNext = () => { if (!formElement.current?.reportValidity()) return;cancelLookups(); setError(""); const message = validateCurrentStep(); if (message) { setError(message); return; } setStep(current => Math.min(current + 1,steps.length - 1)); };
  const finishPreview = async () => {
    const requestId = crypto.randomUUID();
    if (!canEdit || busy.current || receipt.isWaiting()) return;
    const message = validateCurrentStep(); if (message) { setError(message); return; }
    if(!policy||!settingsReady || settingsError) {setError(settingsError || "正在读取门店保修设置。");return;}
    if(signing) {setError("请确认当前签名，或取消跳过签名。");return;}
    if(signature && !signatureCurrent) {setError("接机资料已变化，请重新签署或清除草稿签名。");return;}
    const updatedAt = intakeRecordTime();
    if (!recordIdentity.current) recordIdentity.current = { id: `LOCAL-${crypto.randomUUID().replaceAll("-", "").slice(0,16).toUpperCase()}`, createdAt: updatedAt };
    const { customerName, phone, email, category, brand, model, color, serial, priority, services } = form;
    const data: IntakeReceiptData = { itemQuotes, customerName: customerName.trim(), phone: phone.trim(), email: email.trim(), category, brand: brand.trim(), model: model.trim(), color: color.trim(), serial: serial.trim(), priority, services, policy, faults:form.faults, issueNote:form.issue.trim(), ...recordIdentity.current, updatedAt, issue: intakeIssueText(form.faults,form.issue), accessories, photoCount: photos.photos.length, previewAt: updatedAt.slice(0,16) };
    cancelLookups();busy.current = true; setSubmitting(true); setError("");
    try {
      const attachments = isBackendClient() ? await photos.encode() : undefined;
      const saved = await saveLocalIntake(attachments ? {...data, photos:attachments.map(({id,slot})=>({id,slot}))} : data,savedRevision,signature??undefined,signatureCount,attachments,{requestId});
      await deviceDraft.clear();setSavedRevision(saved.revision!); setSavedPolicy(saved.policy!); setSignature(null); setSubmitted(saved);
    }
    catch (error) { receipt.watch(requestId, async isCurrent => { const saved = backendSnapshot()?.intakes.find(row => row.id === data.id); if (!saved) { setError("保存结果暂不可用，请重新读取工单后核对。"); return; } await deviceDraft.clear(); if (!isCurrent()) return; setSavedRevision(saved.revision!); setSavedPolicy(saved.policy!); setSignature(null); setError(""); setSubmitted(saved); }, () => setError("")); setError(error instanceof Error ? error.message : "保存失败，请重试。"); }
    finally { busy.current = false; setSubmitting(false); }
  };
  const reset = () => { cancelLookups();setSubmitted(null); setStep(0); setForm(initialForm); setCustomer(null); recordIdentity.current = {id:`LOCAL-${crypto.randomUUID().replaceAll("-", "").slice(0,16).toUpperCase()}`,createdAt:intakeRecordTime()};setDraftIdentity(recordIdentity.current);void deviceDraft.clear(); setError(""); photos.clear(); setSignature(null);setSigning(false);setSavedRevision(0);setSavedPolicy(null); };

  if (!canEdit) return <AccessPanel />;
  if (submitted) return <main className="module-page"><header className="module-heading"><PageTitle title={t("接机完成")} backHref="/app/repairs" backLabel={t("返回工单列表")} /></header><div className="intake-success"><section className="panel intake-success__card"><span className="intake-success__icon"><CheckCircle2 size={34} /></span><h2>{t("接机信息已保存")}</h2><p>{submitted.id}<br />{isBackendClient() ? t("已保存至门店后台 · 照片随工单保存") : t("仅保存在当前浏览器 · 照片仅本次预览")}</p><div className="intake-success__summary"><span><small>{t("客户")}</small><strong>{submitted.customerName || t("未填写姓名")}</strong><small>{submitted.phone}</small></span><span><small>{t("设备")}</small><strong>{submitted.brand} {submitted.model}</strong></span><span><small>{t("优先级 / 照片")}</small><strong>{t(submitted.priority)} · {submitted.photoCount} {t(" 张")}</strong></span></div><div className="intake-success__actions"><button type="button" className="button button--primary" ref={printTrigger} onClick={() => setPrintOpen(true)}><Printer size={17} />{t("打印接机单")}</button><Link className="button button--secondary" href={`/app/repairs/${submitted.id}`} icon={<ClipboardCheck size={17} />}>{t("查看工单")}</Link><button className="button button--secondary" type="button" onClick={() => { setSubmitted(null); setField("consent",false); setStep(3); }}>{t("修改信息")}</button><button className="button button--secondary" type="button" onClick={reset}>{t("再建一张")}</button></div></section></div>{printOpen ? <RepairIntakePrint restoreFocusRef={printTrigger} data={submitted} onClose={() => setPrintOpen(false)} /> : null}</main>;

  return <main className="module-page intake-page"><header className="module-heading module-heading--compact"><PageTitle title={t("新建维修工单")} backHref="/app/repairs" backLabel={t("返回工单列表")} /></header><div className="intake-layout"><aside className="panel intake-stepper" aria-label={t("新建工单步骤")}>{steps.map((item,index) => <div className={index === step ? "intake-step intake-step--active" : index < step ? "intake-step intake-step--done" : "intake-step"} key={item.label} aria-current={index === step ? "step" : undefined}><span data-step-number={index + 1}>{index < step ? <Check size={16} /> : <item.icon size={17} />}</span><div><small>{t("步骤 ")} {index + 1}</small><strong>{t(item.label)}</strong></div></div>)}</aside>
    <form ref={formElement} className="panel intake-form" aria-busy={processing} onSubmit={event => { event.preventDefault(); if (busy.current || receipt.isWaiting()) return; if (step < steps.length - 1) goNext(); else finishPreview(); }}><CatalogIndexPreload category={form.category}/><DeviceDraftNotice draft={deviceDraft} disabled={submitting}/><div className="intake-form__head"><span>{t("步骤 ")} {step + 1} / {steps.length}</span><h3>{t(["客户联系资料","送修设备","故障与随件","提交前核对"][step])}</h3></div><div className={`intake-form__body${step === 3 ? " intake-form__body--review" : ""}`}>
      {step === 0 ? <div className="field-grid"><SearchCombobox validate={value => controlError(() => normalizeCustomerPhone(value))} label={t("联系电话")} maxLength={40} required inputMode="tel" value={form.phone} onChange={updatePhone} autoFocus placeholder={t("例如：+39 320 000 1234")} filterOptions={false} loading={bounded&&(remoteCandidates.pending||choosing)} loadingLabel="正在读取客户记录…" error={bounded?remoteCandidates.error:undefined} emptyText={form.phone.replace(/\D/g,"").length < 3 ? t("输入至少 3 位号码查找候选") : t("没有匹配客户，可继续填写")} options={candidates.map(item => ({ value: item.phone, label: item.phone, detail: (item.name || t("未填写称呼"))+("namePreview" in item&&item.namePreview?"…":"") }))} onSelect={option => { const match = candidates.find(item => item.phone === option.value); if (match) chooseCustomer(match.id); }} /><label className="field"><span>{t("客户称呼（选填）")}</span><InputControl error={form.customerName.length>80?"请填写有效称呼（最多 80 字）。":undefined} validate={value=>value.length<=80?"":"请填写有效称呼（最多 80 字）。"} aria-label={t("客户称呼（选填）")} onClear={() => setField("customerName","")} clearLabel={t("清空客户称呼（选填）")} value={form.customerName} onChange={event => setField("customerName",event.target.value)} placeholder={t("例如：陈女士")} maxLength={80} /></label>{customer ? <div className="intake-customer-match field--wide" role="status"><UserRound size={17} /><strong>{t("已选择 ")}{customer.name?(Array.from(customer.name).length>80?Array.from(customer.name).slice(0,80).join("")+"…":customer.name):t("未填写称呼")}</strong><small>{t("按手机号关联客户档案")}</small><button className="icon-button" type="button" aria-label={t("取消客户关联")} onClick={() => { lookupEpoch.current++;setChoiceFlight(null);setCustomer(null); setForm(current => ({ ...current, customerName: "", email: "", consent: false })); }}><ArrowLeft size={16} /></button></div> : null}<label className="field field--wide"><span>{t("电子邮件（选填）")}</span><InputControl aria-label={t("电子邮件（选填）")} onClear={() => setField("email","")} clearLabel={t("清空电子邮件（选填）")} type="email" value={form.email} onChange={event => setField("email",event.target.value)} placeholder="customer@example.com" inputMode="email" maxLength={160} /></label></div> : null}
      {step === 1 ? <div className="field-grid"><label className="field"><span>{t("设备类别 *")}</span><SelectControl value={form.category} onChange={event => setForm(current => ({ ...current, category: event.target.value, brand: "", model: "", services: normalizeIntakeServices(current.services,current.faults,""), consent: false }))}>{Object.keys(deviceCatalog).map(category => <option value={category} key={category}>{t(category)}</option>)}</SelectControl></label><DeviceIdentityPicker category={form.category} brand={form.brand} model={form.model} brandRequired modelRequired validationError={Boolean(error&&step===1)} brandMaxLength={100} modelMaxLength={160} disabled={submitting} onCommit={updateIdentity} /><DeviceIdentityExtras hasValue={Boolean(form.color || form.serial)}><ColorPicker value={form.color} onChange={value => setField("color",value)} /><div className="field--wide"><IdentifierField label="SN / IMEI" value={form.serial} onChange={value => setField("serial",value)} kind="serial-or-imei" placeholder={t("输入或扫码，未知可留空")} /></div></DeviceIdentityExtras>{showIdentityNotice ? <IdentityChangeNotice disabled={submitting} onUndo={undoIdentity}/> : null}
        <IntakeDeviceHistory serial={form.serial} brand={form.brand} model={form.model} orders={repairOrders} remote={bounded}/>
      </div> : null}
      {step === 2 ? <div className="intake-issue-layout"><IntakeFaultPicker values={form.faults} onChange={value => setField("faults",value)} brand={form.brand} services={form.services} onServicesChange={value => setField("services",value)} />{quoteItems.length?<div className="field-grid" aria-label={t("维修报价")}>{quoteItems.map(item=><label className="field" key={item}><span>{t(item)} {t("报价（€，选填）")}</span><InputControl validate={value => controlError(() => parseItemMoney(value))} aria-label={t("{v0}报价", { v0: t(item) })} inputMode="decimal" maxLength={20} value={form.quoteInputs?.[item]??""} onChange={event=>setField("quoteInputs",{...form.quoteInputs,[item]:event.target.value})} placeholder={t("未知留空")}/></label>)}</div>:null}<label className="field"><span>{t("故障补充 / 自定义故障")}</span><TextareaControl aria-label={t("故障补充 / 自定义故障")} validate={value => intakeIssueText(form.faults, value) ? "" : "请选择故障，或在这里填写故障现象。"} value={form.issue} onChange={event => setField("issue",event.target.value)} placeholder={t("补充现象、发生时间等")} rows={3} maxLength={2000} /></label><MultiChoice label={t("随件（多选）")} values={form.accessories} onChange={value => setField("accessories",value)} options={accessoryOptions} />{!form.accessories.length ? <small className="intake-muted">{t("无随件")}</small> : null}{form.accessories.includes("其他") ? <label className="field"><span>{t("其他随件 *")}</span><InputControl aria-label={t("其他随件")} onClear={() => setField("otherAccessory","")} clearLabel={t("清空其他随件")} required validate={value => value.trim() ? "" : "已选择其他随件，请填写具体物品。"} value={form.otherAccessory} onChange={event => setField("otherAccessory",event.target.value)} placeholder={t("例如：65W USB-C 充电器")} maxLength={160} /></label> : null}<label className="field"><span>{t("优先级")}</span><SelectControl value={form.priority} onChange={event => setField("priority",event.target.value as FormState["priority"])}><option value="普通">{t("普通")}</option><option value="优先">{t("优先")}</option><option value="紧急">{t("紧急")}</option></SelectControl></label><IntakePhotos {...photos} /></div> : null}
      {step === 3 ? <><IntakeReview data={{ ...form, itemQuotes, issue: intakeIssueText(form.faults,form.issue), accessories }} photos={photos.photos} onEdit={step => { if (busy.current || receipt.isWaiting()) return; setField("consent",false); setStep(step); }} /><section className="intake-signature-draft"><div className="intake-signature-draft__head"><strong>{t("客户签名 ")}<small>{t("选填 · 商家保修 ")}{policy?.months??""} {t(" 个月")}</small></strong><button className="button button--secondary button--compact" type="button" aria-busy={signatureReading} disabled={submitting || signing || signatureReading || !settingsReady || !!settingsError || !bounded&&(!localIntakes.ready || !!localIntakes.error)} onClick={()=>void openSignature()}>{signature ? t("重新签署") : t("客户签字")}</button></div>{signing&&policy?<IntakeSignatureEditor data={reviewData} policy={policy} onConfirm={draft=>{setSignature(draft);setSigning(false);setError("");}} onCancel={()=>{setSigning(false);setSignature(null);}}/>:signature?<><SignatureImage strokes={signature.strokes} aspectRatio={signature.aspectRatio} label={t("待保存客户签名")}/><p className="intake-muted">{signatureCurrent?t("签名待随接机资料保存"):t("资料已变化，请重新签署")} · {signature.language}</p><button className="button button--secondary button--compact" type="button" disabled={submitting} onClick={()=>setSignature(null)}>{t("清除草稿签名")}</button></>:<p className="intake-muted">{t("可交给客户直接签字，或跳过后在详情补签。")}</p>}</section><label className="review-confirm"><input type="checkbox" disabled={submitting} checked={form.consent} onChange={event => setField("consent",event.target.checked)} /><ShieldCheck size={21} /><span><strong>{t("已与客户核对接机信息")}</strong><small>{t("设备、随件与维修需求")}</small></span></label></> : null}
      {error ? <p className="form-error" role="alert"><CircleAlert size={16} />{systemText(error)}</p> : null}</div><div className="intake-form__actions"><button className="button button--secondary" type="button" disabled={submitting || step === 0} onClick={() => { setError(""); setField("consent",false); setStep(current => Math.max(0,current - 1)); }}><ArrowLeft size={16} />{t("上一步")}</button>{step < steps.length - 1 ? <button className="button button--primary" type="button" key="next-step" disabled={step === 2 && photos.pending.length > 0} onClick={goNext}>{t("下一步")}<ArrowRight size={16} /></button> : <button className="button button--primary" type="button" key="finish-preview" aria-busy={processing} disabled={submitting} onClick={() => void finishPreview()}><ClipboardCheck size={17} />{unknown?t("待核对"):submitting ? t("正在保存…") : t("保存并预览")}</button>}</div><OperationRecoveryControls requestId={receipt.requestId}/></form></div></main>;
}
