"use client";
import{useEffect,useRef,useState}from'react';
import{Building2,Printer,Check}from'lucide-react';
import{NavigationLink as Link}from'@/components/navigation-link';
import{InputControl}from'@/components/input-control';
import{SelectControl}from'@/components/select-control';
import{useLanguage}from'@/components/language-provider';
import{useDeviceDraft,DeviceDraftNotice}from'@/components/use-device-draft';
import{OperationRecoveryControls,useOperationReceipt}from'@/components/use-operation-receipt';
import{backendRecovery,backendSnapshot}from'@/lib/backend/client';
import type{StoreSettings,SupplierProfile,PaperFormat}from'@/lib/store-settings';
import type{SettingsPatch}from'@/lib/backend/settings-patch';
export type SettingsSave<Update>=(update:Update,expectedRevision:number|undefined,options:{requestId:string})=>Promise<boolean>;
export type SettingsPatchSave=SettingsSave<SettingsPatch>;
export type SettingsFeedback={onPendingChange:(pending:boolean)=>void;onReceiptChange:(requestId:string,status:"confirmed"|"settled")=>void};
export type SettingsPreferenceValues=Pick<StoreSettings,'revision'|'shopName'|'address'|'phone'|'repairWarrantyMonths'|'retailWarrantyMonths'>|Pick<StoreSettings,'revision'|'paper'>;
function settledError(){return backendRecovery().resolution?.status==='rejected'?backendRecovery().message:'';}
// A form retains its own nonce until an exact receipt or safe resolution settles it.
export function useSettingsSubmission<Update>({ save, onPendingChange, onReceiptChange }: SettingsFeedback & {save:SettingsSave<Update>}) {
  const receipt = useOperationReceipt();
  const busy = useRef(false);
  const attempt = useRef<string | null>(null);
  const alive = useRef(true);
  const [submitting, setSubmitting] = useState(false);
  useEffect(() => { alive.current = true; return () => { alive.current = false; attempt.current = null; }; }, []);
  async function run(update: Update, revision: number | undefined, onSaved: () => Promise<void>, onSettled?: () => void) {
    if (busy.current || receipt.isWaiting()) return "waiting";
    const requestId = crypto.randomUUID(); attempt.current = requestId;
    busy.current = true; setSubmitting(true); onPendingChange(true);
    const ownsAttempt = () => alive.current && attempt.current === requestId;
    const release = () => { if (!ownsAttempt()) return; attempt.current = null; busy.current = false; setSubmitting(false); onPendingChange(false); };
    const finish = async () => { if (!ownsAttempt()) return; setSubmitting(true); onReceiptChange(requestId, "confirmed"); await onSaved(); release(); };
    const settle = () => { if (!ownsAttempt()) return; onReceiptChange(requestId, "settled"); onSettled?.(); release(); };
    try {
      if (await save(update, revision, { requestId })) { await finish(); return "confirmed"; }
      if (ownsAttempt() && receipt.watch(requestId, () => finish(), settle)) return "waiting";
      release(); return "failed";
    } finally { if (alive.current) setSubmitting(false); }
  }
  return { busy, receipt, submitting, pending: submitting || receipt.waiting, run };
}
export function Preferences({ settings, printing, save, onPendingChange, onReceiptChange }: SettingsFeedback & {settings:SettingsPreferenceValues;save:SettingsPatchSave;printing:boolean}) {
  const { t } = useLanguage();
  const general="shopName" in settings?settings:null;
  const [repairMonths, setRepairMonths] = useState(general?.repairWarrantyMonths??6); const [retailMonths, setRetailMonths] = useState(general?.retailWarrantyMonths??12);
  const [revision, setRevision] = useState(settings.revision);
  const [name, setName] = useState(general?.shopName??""); const [address, setAddress] = useState(general?.address??""); const [phone, setPhone] = useState(general?.phone??""); const [paper, setPaper] = useState<PaperFormat>("paper" in settings?settings.paper:"a4");
  const { busy, receipt, submitting, pending, run } = useSettingsSubmission({ save, onPendingChange, onReceiptChange });
  const deviceDraft=useDeviceDraft(`settings:${printing?"print":"general"}`,{repairMonths,retailMonths,revision,name,address,phone,paper},value=>{if (busy.current) return;setRepairMonths(value.repairMonths);setRetailMonths(value.retailMonths);setRevision(value.revision);setName(value.name);setAddress(value.address);setPhone(value.phone);setPaper(value.paper);});
  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (busy.current) return;
    const update:SettingsPatch = printing ? {type:"printing",paper} : {type:"general",values:{shopName:name.trim(),address:address.trim(),phone:phone.trim(),repairWarrantyMonths:repairMonths,retailWarrantyMonths:retailMonths}};
    await run(update, revision, async () => {
      const nextRevision = backendSnapshot()?.settings?.revision ?? revision + 1;
      await deviceDraft.clear({ repairMonths, retailMonths, revision: nextRevision, name, address, phone, paper }); setRevision(nextRevision);
    });
  }
  return <form onSubmit={submit} aria-busy={submitting || receipt.executing}><fieldset className="form-fields" disabled={pending}>
    <DeviceDraftNotice draft={deviceDraft} disabled={pending}/>{revision!==settings.revision?<button type="button" className="button button--secondary" onClick={()=>{if (!busy.current) setRevision(settings.revision);}}>{t("保留输入并核对最新版本")}</button>:null}
    <div className="settings-section-title">{printing ? <Printer size={22} /> : <Building2 size={22} />}<h3>{printing ? t("打印设置") : t("门店资料")}</h3></div>
    {printing ? <><label className="field"><span>{t("接机单默认纸张")}</span><SelectControl aria-label={t("默认打印纸张")} value={paper} onChange={event => setPaper(event.target.value as PaperFormat)}><option value="a4">{t("A4 横向")}</option><option value="a5">{t("A5 横向")}</option><option value="half">{t("A4 上半页")}</option><option value="double">{t("A4 双联")}</option></SelectControl></label><div className="settings-print-preview"><Printer size={40} /><div><strong>{t("维修接机单")}</strong><p>{t("工单资料 · 维修项目 · 查询二维码 · 签名")}</p><Link className="button button--secondary" href="/app/repairs" aria-disabled={pending || undefined} tabIndex={pending ? -1 : undefined}>{t("选择工单打印")}</Link></div></div></> : <div className="field-grid">
      <label className="field field--wide"><span>{t("门店名称 *")}</span><InputControl onClear={() => setName("")} clearLabel={t("清空门店名称")} aria-label={t("门店名称")} required validate={value => value.trim() ? "" : "请填写门店名称，例如 ChinaTech；不能只填空格。"} value={name} maxLength={100} onChange={event => setName(event.target.value)} placeholder={t("例如：ChinaTech")} /></label>
      <label className="field field--wide"><span>{t("地址")}</span><InputControl onClear={() => setAddress("")} clearLabel={t("清空门店地址")} aria-label={t("门店地址")} value={address} maxLength={200} onChange={event => setAddress(event.target.value)} placeholder={t("例如：Via Roma 10, Floridia")} /></label>
      <label className="field"><span>{t("联系电话")}</span><InputControl onClear={() => setPhone("")} clearLabel={t("清空门店联系电话")} aria-label={t("门店联系电话")} type="tel" value={phone} maxLength={40} onChange={event => setPhone(event.target.value)} placeholder={t("例如：+39 333 1234567")} /></label>
      <div className="settings-timezone"><small>{t("营业时间区")}</small><strong>{t("欧洲 / 罗马")}</strong></div><WarrantyDefault label={t("维修默认商家保修")} value={repairMonths} onChange={setRepairMonths}/><WarrantyDefault label={t("整机默认商家保修")} value={retailMonths} onChange={setRetailMonths}/><p className="intake-muted field--wide">{t("默认值用于新接机及新单机；既有销售保留约定期限。打印语言在预览中选择。")}</p>
    </div>}
    <footer className="settings-form-footer"><button type="submit" className="button button--primary"><Check size={17} />{submitting ? t("正在保存…") : receipt.waiting ? t("待核对") : t("保存设置")}</button></footer>
  </fieldset><OperationRecoveryControls requestId={receipt.requestId}/></form>;
}
function WarrantyDefault({label,value,onChange}:{label:string;value:number;onChange:(value:number)=>void}) {
  const { t } = useLanguage();
  const [custom,setCustom]=useState(![6,12,24].includes(value));
  const customVisible = custom || ![6,12,24].includes(value);
  return <div className="field"><span>{t(label)}</span><SelectControl aria-label={t(label)} value={customVisible?"custom":String(value)} onChange={event=>{const next=event.target.value;setCustom(next === "custom");if(next!=="custom") onChange(Number(next));}}><option value="6">{t("6 个月")}</option><option value="12">{t("1 年")}</option><option value="24">{t("2 年")}</option><option value="custom">{t("自定义月数")}</option></SelectControl>{customVisible?<InputControl aria-label={label+t("自定义月数")} required type="number" inputMode="numeric" min={1} max={120} step={1} hint={t("填写 1–120 个整数月。")} placeholder={t("例如：12")} value={Number.isNaN(value)?"":value} onChange={event=>onChange(event.target.value===""?Number.NaN:event.target.valueAsNumber)}/>:null}</div>;
}
export function SupplierEditor({ supplier, suppliers=[], initialRevision, save, onSaved, onCancel, onPendingChange, onReceiptChange }: SettingsFeedback & {supplier:SupplierProfile|null;suppliers?:SupplierProfile[];initialRevision:number;save:SettingsPatchSave;onSaved:()=>void;onCancel:()=>void}) {
  const { t , systemText } = useLanguage();
  const [revision,setRevision] = useState(initialRevision);
  const [name, setName] = useState(supplier?.name ?? ""); const [phone, setPhone] = useState(supplier?.phone ?? ""); const [website, setWebsite] = useState(supplier?.website ?? ""); const [active, setActive] = useState(supplier?.active ?? true);
  const [error, setError] = useState("");
  const { busy, receipt, submitting, pending, run } = useSettingsSubmission({ save, onPendingChange, onReceiptChange });
  const [identity,setIdentity]=useState(()=>supplier?.id??crypto.randomUUID());
  const deviceDraft=useDeviceDraft(`supplier:${supplier?.id??"new"}`,{revision,name,phone,website,active,identity},value=>{if (busy.current) return;setIdentity(value.identity);setRevision(value.revision);setName(value.name);setPhone(value.phone);setWebsite(value.website);setActive(value.active);});
  const validateName = (value: string) => !value.trim() ? "请填写供应商名称，例如 MobileParts SRL。" : suppliers.some(row => row.id !== identity && row.name.trim().toLowerCase() === value.trim().toLowerCase()) ? "已有同名供应商，请打开现有记录或使用不同名称。" : "";

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    if (busy.current) return;
    setError("");
    const supplier = { id: identity, name: name.trim(), phone: phone.trim(), website: website.trim(), active };
    const result = await run({type:"supplier",supplier}, revision, async () => { await deviceDraft.clear(); setError(""); onSaved(); }, () => setError(settledError()));
    if (result === "failed") setError("供应商尚未保存，请处理提交恢复提示后重试。");
  }
  return <form className="settings-editor" aria-busy={submitting || receipt.executing} onSubmit={submit}><fieldset className="form-fields" disabled={pending}><DeviceDraftNotice draft={deviceDraft} disabled={pending}/>{revision!==initialRevision?<button type="button" className="button button--secondary" onClick={()=>{if (!busy.current) setRevision(initialRevision);}}>{t("保留输入并核对最新版本")}</button>:null}<div className="field-grid"><label className="field"><span>{t("供应商名称 *")}</span><InputControl onClear={() => setName("")} clearLabel={t("清空供应商名称")} disabled={pending} aria-label={t("供应商名称")} required validate={validateName} value={name} maxLength={100} onChange={event => { setName(event.target.value); setError(""); }} placeholder={t("例如：MobileParts SRL")} /></label><label className="field"><span>{t("电话")}</span><InputControl onClear={() => setPhone("")} clearLabel={t("清空供应商电话")} disabled={pending} aria-label={t("供应商电话")} type="tel" value={phone} maxLength={40} onChange={event => { setPhone(event.target.value); setError(""); }} placeholder={t("例如：+39 333 1234567")} /></label><label className="field field--wide"><span>{t("网站")}</span><InputControl onClear={() => setWebsite("")} clearLabel={t("清空供应商网站")} disabled={pending} aria-label={t("供应商网站")} inputMode="url" autoCapitalize="off" value={website} maxLength={200} validate={value => value.trim() && !/^https?:\/\//i.test(value.trim()) ? "网站地址须以 https:// 或 http:// 开头，例如 https://supplier.example.com。" : ""} onChange={event => { setWebsite(event.target.value); setError(""); }} placeholder={t("例如：https://supplier.example.com")} /></label><label className="field"><span>{t("使用状态")}</span><SelectControl disabled={pending} aria-label={t("供应商使用状态")} value={active ? "active" : "inactive"} onChange={event => setActive(event.target.value === "active")}><option value="active">{t("启用")}</option><option value="inactive">{t("停用")}</option></SelectControl></label></div>{error ? <p className="form-error" role="alert">{systemText(error)}</p> : null}<footer className="settings-form-footer"><button className="button button--secondary" type="button" disabled={pending} onClick={() => { if (!busy.current) onCancel(); }}>{t("取消")}</button><button className="button button--primary" type="submit" disabled={pending}><Check size={17} />{submitting ? t("正在保存…") : receipt.waiting ? t("待核对") : t("保存供应商")}</button></footer></fieldset><OperationRecoveryControls requestId={receipt.requestId}/></form>;
}
