"use client";
import { useLanguage } from "@/components/language-provider";
import { InputControl } from "@/components/input-control";
import { controlError } from "@/components/control-feedback";
import Link from "next/link";
import { useDeviceDraft, DeviceDraftNotice } from "@/components/use-device-draft";
import { useRef, useState } from "react";
import { Building2, ContactRound, CircleDollarSign, ClipboardList, Printer, Settings, Plus, Pencil, Check, X, Search, ArrowDownLeft, ArrowUpRight } from "lucide-react";
import { PageTitle } from "@/components/page-title";
import { SelectControl } from "@/components/select-control";
import { useRepairDirectory } from "@/components/repairs/local-intake-store";
import { useRetail } from "@/components/retail/retail-provider";
import { useStoreSettings, saveStoreSettings } from "./settings-store";
import { financeTotals, validateFinanceEntry, type StoreSettings, type SupplierProfile, type PaperFormat } from "@/lib/store-settings";
import { intakeRecordTime } from "@/lib/repair-intake-record";
import { formatCost } from "@/lib/procurement";
import { useStaff } from "@/components/staff/use-staff";
import { StaffSettings } from "@/components/staff/staff-settings";
import { OrderManagement } from "./order-management";
import { UsersRound } from "lucide-react";
const tabs = [{ id: "general", label: "门店设置", icon: Settings }, { id: "orders", label: "订单管理", icon: ClipboardList }, { id: "suppliers", label: "供应商", icon: ContactRound }, { id: "finance", label: "经营收支", icon: CircleDollarSign }, { id: "printing", label: "打印", icon: Printer }, { id:"staff",label:"员工设置",icon:UsersRound }];
export function SettingsPage({ initialTab }: { initialTab?: string }) {
  const { t , systemText } = useLanguage();
  const staff=useStaff();
  const allowedTabs=tabs.filter(item=>item.id === "staff" ? staff.can("staff.manage") : item.id === "finance" ? staff.can("financial.read") : staff.can("settings.edit"));
  const { settings, error: storageError, ready } = useStoreSettings();
  const [tab, setTab] = useState(tabs.some(tab => tab.id === initialTab) ? initialTab! : "general");
  const [message, setMessage] = useState(""); const [error, setError] = useState("");
  const busy = useRef(false);
  const [submitting, setSubmitting] = useState(false);
  const onPendingChange = (pending: boolean) => { busy.current = pending; setSubmitting(pending); };
  const save = async (update: (current: StoreSettings) => StoreSettings, expectedRevision = settings.revision) => { try { await saveStoreSettings(expectedRevision, update); setMessage("已保存"); setError(""); return true; } catch (reason) { setError(reason instanceof Error ? reason.message : "保存失败。"); setMessage(""); return false; } };
  return <main className="module-page settings-page" aria-busy={submitting} onClickCapture={event => { if (busy.current && event.target instanceof Element && event.target.closest("a")) { event.preventDefault(); event.stopPropagation(); } }}><header className="module-heading" aria-disabled={submitting || undefined} onClickCapture={event => { if (busy.current) { event.preventDefault(); event.stopPropagation(); } }}><PageTitle title={t("门店管理")} backHref="/app/dashboard" /></header><div className="settings-layout"><nav className="panel settings-nav" aria-label={t("门店管理分类")}>{allowedTabs.map(item => <button key={item.id} type="button" disabled={submitting} aria-pressed={tab === item.id} className={tab === item.id ? "settings-nav--active" : ""} onClick={() => { if (busy.current) return; setTab(item.id); setError(""); setMessage(""); }}><item.icon size={19} /><span>{t(item.label)}</span></button>)}</nav><section className="panel settings-content">{!ready ? <p role="status">{t("正在读取设置…")}</p> : <>{storageError || error ? <p role="alert" className="form-error">{systemText(storageError || error)}</p> : null}{message ? <p role="status" className="settings-saved"><Check size={16} />{systemText(message)}</p> : null}{!allowedTabs.some(item=>item.id === tab) ? <div className="module-empty"><strong>{t("当前账号不能访问这类设置")}</strong>{allowedTabs[0] ? <button className="button button--secondary" disabled={submitting} onClick={()=>{if (!busy.current) setTab(allowedTabs[0].id);}}>{t("查看")}{t(allowedTabs[0].label)}</button>:null}</div> : tab === "staff" ? <StaffSettings onPendingChange={onPendingChange} /> : tab === "orders" ? <OrderManagement settings={settings} disabled={Boolean(storageError)} /> : tab === "suppliers" ? <Suppliers settings={settings} save={save} onPendingChange={onPendingChange} /> : tab === "finance" ? <Finance settings={settings} save={save} onPendingChange={onPendingChange} /> : <Preferences key={tab} settings={settings} printing={tab === "printing"} save={save} onPendingChange={onPendingChange} />}</>}</section></div></main>;
}
type Props = { settings: StoreSettings; save: (update: (current: StoreSettings) => StoreSettings, expectedRevision?: number) => Promise<boolean>; onPendingChange: (pending: boolean) => void };
function Preferences({ settings, printing, save, onPendingChange }: Props & { printing: boolean }) {
  const { t } = useLanguage();
  const [repairMonths, setRepairMonths] = useState(settings.repairWarrantyMonths); const [retailMonths, setRetailMonths] = useState(settings.retailWarrantyMonths);
  const [revision, setRevision] = useState(settings.revision);
  const [name, setName] = useState(settings.shopName); const [address, setAddress] = useState(settings.address); const [phone, setPhone] = useState(settings.phone); const [paper, setPaper] = useState<PaperFormat>(settings.paper);
  const busy = useRef(false);
  const [submitting, setSubmitting] = useState(false);
  const deviceDraft=useDeviceDraft(`settings:${printing?"print":"general"}`,{repairMonths,retailMonths,revision,name,address,phone,paper},value=>{if (busy.current) return;setRepairMonths(value.repairMonths);setRetailMonths(value.retailMonths);setRevision(value.revision);setName(value.name);setAddress(value.address);setPhone(value.phone);setPaper(value.paper);});
  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (busy.current) return;
    busy.current = true; setSubmitting(true); onPendingChange(true);
    try {
      if (await save(current => printing ? { ...current, paper } : { ...current, shopName: name.trim(), address: address.trim(), phone: phone.trim(), repairWarrantyMonths: repairMonths, retailWarrantyMonths: retailMonths }, revision)) {
        await deviceDraft.clear({ repairMonths, retailMonths, revision: revision + 1, name, address, phone, paper }); setRevision(revision + 1);
      }
    } finally { busy.current = false; setSubmitting(false); onPendingChange(false); }
  }
  return <form onSubmit={submit} aria-busy={submitting}><fieldset className="form-fields" disabled={submitting}>
    <DeviceDraftNotice draft={deviceDraft}/>{revision!==settings.revision?<button type="button" className="button button--secondary" onClick={()=>{if (!busy.current) setRevision(settings.revision);}}>{t("保留输入并核对最新版本")}</button>:null}
    <div className="settings-section-title">{printing ? <Printer size={22} /> : <Building2 size={22} />}<h3>{printing ? t("打印设置") : t("门店资料")}</h3></div>
    {printing ? <><label className="field"><span>{t("接机单默认纸张")}</span><SelectControl aria-label={t("默认打印纸张")} value={paper} onChange={event => setPaper(event.target.value as PaperFormat)}><option value="a4">{t("A4 横向")}</option><option value="a5">{t("A5 横向")}</option><option value="half">{t("A4 上半页")}</option><option value="double">{t("A4 双联")}</option></SelectControl></label><div className="settings-print-preview"><Printer size={40} /><div><strong>{t("维修接机单")}</strong><p>{t("工单资料 · 维修项目 · 查询二维码 · 签名")}</p><Link className="button button--secondary" href="/app/repairs" aria-disabled={submitting || undefined} tabIndex={submitting ? -1 : undefined}>{t("选择工单打印")}</Link></div></div></> : <div className="field-grid">
      <label className="field field--wide"><span>{t("门店名称 *")}</span><InputControl onClear={() => setName("")} clearLabel={t("清空门店名称")} aria-label={t("门店名称")} required validate={value => value.trim() ? "" : "请填写门店名称，例如 ChinaTech；不能只填空格。"} value={name} maxLength={100} onChange={event => setName(event.target.value)} placeholder={t("例如：ChinaTech")} /></label>
      <label className="field field--wide"><span>{t("地址")}</span><InputControl onClear={() => setAddress("")} clearLabel={t("清空门店地址")} aria-label={t("门店地址")} value={address} maxLength={200} onChange={event => setAddress(event.target.value)} placeholder={t("例如：Via Roma 10, Floridia")} /></label>
      <label className="field"><span>{t("联系电话")}</span><InputControl onClear={() => setPhone("")} clearLabel={t("清空门店联系电话")} aria-label={t("门店联系电话")} type="tel" value={phone} maxLength={40} onChange={event => setPhone(event.target.value)} placeholder={t("例如：+39 333 1234567")} /></label>
      <div className="settings-timezone"><small>{t("营业时间区")}</small><strong>{t("欧洲 / 罗马")}</strong></div><WarrantyDefault label={t("维修默认商家保修")} value={repairMonths} onChange={setRepairMonths}/><WarrantyDefault label={t("整机默认商家保修")} value={retailMonths} onChange={setRetailMonths}/><p className="intake-muted field--wide">{t("默认值用于新接机及新单机；既有销售保留约定期限。打印语言在预览中选择。")}</p>
    </div>}
    <footer className="settings-form-footer"><button type="submit" className="button button--primary"><Check size={17} />{submitting ? t("正在保存…") : t("保存设置")}</button></footer>
  </fieldset></form>;
}
function WarrantyDefault({label,value,onChange}:{label:string;value:number;onChange:(value:number)=>void}) {
  const { t } = useLanguage();
  const [custom,setCustom]=useState(![6,12,24].includes(value));
  const customVisible = custom || ![6,12,24].includes(value);
  return <div className="field"><span>{t(label)}</span><SelectControl aria-label={t(label)} value={customVisible?"custom":String(value)} onChange={event=>{const next=event.target.value;setCustom(next === "custom");if(next!=="custom") onChange(Number(next));}}><option value="6">{t("6 个月")}</option><option value="12">{t("1 年")}</option><option value="24">{t("2 年")}</option><option value="custom">{t("自定义月数")}</option></SelectControl>{customVisible?<InputControl aria-label={label+t("自定义月数")} required type="number" inputMode="numeric" min={1} max={120} step={1} hint={t("填写 1–120 个整数月。")} placeholder={t("例如：12")} value={Number.isNaN(value)?"":value} onChange={event=>onChange(event.target.value===""?Number.NaN:event.target.valueAsNumber)}/>:null}</div>;
}
function Suppliers({ settings, save, onPendingChange }: Props) {
  const { t } = useLanguage();
  const [query, setQuery] = useState(""); const [editing, setEditing] = useState<SupplierProfile | null>(null);
  const [adding, setAdding] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const busy = useRef(false);
  const setPending = (pending: boolean) => { busy.current = pending; setSubmitting(pending); onPendingChange(pending); };
  const rows = settings.suppliers.filter(row => `${row.name} ${row.phone}`.toLowerCase().includes(query.trim().toLowerCase()));
  return <><div className="settings-section-title"><ContactRound size={22} /><h3>{t("供应商")}</h3><button className="button button--primary button--compact" type="button" disabled={submitting} onClick={() => { if (busy.current) return; setEditing(null); setAdding(true); }}><Plus size={17} />{t("新增")}</button></div><label className="module-search"><Search size={17} /><InputControl onClear={() => setQuery("")} clearLabel={t("清空搜索供应商")} aria-label={t("搜索供应商")} disabled={submitting} value={query} onChange={event => setQuery(event.target.value)} placeholder={t("例如：MobileParts")} /></label>{adding || editing ? <SupplierEditor key={editing?.id ?? "new"} supplier={editing} suppliers={settings.suppliers} initialRevision={settings.revision} onPendingChange={setPending} onCancel={() => { if (busy.current) return; setEditing(null); setAdding(false); }} onSave={async (supplier, revision) => { if (await save(current => ({ ...current, suppliers: current.suppliers.some(row => row.id === supplier.id) ? current.suppliers.map(row => row.id === supplier.id ? supplier : row) : [...current.suppliers, supplier] }), revision)) { setEditing(null); setAdding(false); } else { throw new Error("供应商尚未保存，请处理提交恢复提示后重试。"); } }} /> : null}<div className="settings-supplier-list">{rows.map(row => <article key={row.id}><span className="device-glyph"><ContactRound size={19} /></span><div><strong>{row.name}</strong><small>{row.phone || t("联系方式未记录")}{!row.active ? t(" · 已停用") : ""}</small>{row.website ? <a href={row.website} target="_blank" rel="noreferrer" aria-disabled={submitting || undefined} tabIndex={submitting ? -1 : undefined}>{t("供应商网站")}</a> : null}</div><button className="icon-button" type="button" aria-label={t("编辑供应商 {v0}", { v0: row.name })} disabled={submitting} onClick={() => { if (busy.current) return; setEditing(row); setAdding(false); }}><Pencil size={17} /></button></article>)}{!rows.length ? <div className="module-empty"><ContactRound size={28} /><strong>{t("暂无匹配供应商")}</strong></div> : null}</div></>;
}
function SupplierEditor({ supplier, suppliers, initialRevision, onSave, onCancel, onPendingChange }: { supplier: SupplierProfile | null; suppliers: SupplierProfile[]; initialRevision: number; onSave: (supplier: SupplierProfile, revision: number) => Promise<void>; onCancel: () => void; onPendingChange: (pending: boolean) => void }) {
  const { t , systemText } = useLanguage();
  const [revision,setRevision] = useState(initialRevision);
  const [name, setName] = useState(supplier?.name ?? ""); const [phone, setPhone] = useState(supplier?.phone ?? ""); const [website, setWebsite] = useState(supplier?.website ?? ""); const [active, setActive] = useState(supplier?.active ?? true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const busy = useRef(false);
  const [identity,setIdentity]=useState(()=>supplier?.id??crypto.randomUUID());
  const deviceDraft=useDeviceDraft(`supplier:${supplier?.id??"new"}`,{revision,name,phone,website,active,identity},value=>{if (busy.current) return;setIdentity(value.identity);setRevision(value.revision);setName(value.name);setPhone(value.phone);setWebsite(value.website);setActive(value.active);});
  const validateName = (value: string) => !value.trim() ? "请填写供应商名称，例如 MobileParts SRL。" : suppliers.some(row => row.id !== identity && row.name.trim().toLowerCase() === value.trim().toLowerCase()) ? "已有同名供应商，请打开现有记录或使用不同名称。" : "";

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    if (busy.current) return;
    busy.current = true; setSubmitting(true); onPendingChange(true); setError("");
    try { await onSave({ id: identity, name: name.trim(), phone: phone.trim(), website: website.trim(), active }, revision);await deviceDraft.clear(); }
    catch (reason) { setError(reason instanceof Error ? reason.message : "供应商保存失败。"); }
    finally { busy.current = false; setSubmitting(false); onPendingChange(false); }
  }
  return <form className="settings-editor" aria-busy={submitting} onSubmit={submit}><fieldset className="form-fields" disabled={submitting}><DeviceDraftNotice draft={deviceDraft}/>{revision!==initialRevision?<button type="button" className="button button--secondary" onClick={()=>{if (!busy.current) setRevision(initialRevision);}}>{t("保留输入并核对最新版本")}</button>:null}<div className="field-grid"><label className="field"><span>{t("供应商名称 *")}</span><InputControl onClear={() => setName("")} clearLabel={t("清空供应商名称")} disabled={submitting} aria-label={t("供应商名称")} required validate={validateName} value={name} maxLength={100} onChange={event => { setName(event.target.value); setError(""); }} placeholder={t("例如：MobileParts SRL")} /></label><label className="field"><span>{t("电话")}</span><InputControl onClear={() => setPhone("")} clearLabel={t("清空供应商电话")} disabled={submitting} aria-label={t("供应商电话")} type="tel" value={phone} maxLength={40} onChange={event => { setPhone(event.target.value); setError(""); }} placeholder={t("例如：+39 333 1234567")} /></label><label className="field field--wide"><span>{t("网站")}</span><InputControl onClear={() => setWebsite("")} clearLabel={t("清空供应商网站")} disabled={submitting} aria-label={t("供应商网站")} inputMode="url" autoCapitalize="off" value={website} maxLength={200} validate={value => value.trim() && !/^https?:\/\//i.test(value.trim()) ? "网站地址须以 https:// 或 http:// 开头，例如 https://supplier.example.com。" : ""} onChange={event => { setWebsite(event.target.value); setError(""); }} placeholder={t("例如：https://supplier.example.com")} /></label><label className="field"><span>{t("使用状态")}</span><SelectControl disabled={submitting} aria-label={t("供应商使用状态")} value={active ? "active" : "inactive"} onChange={event => setActive(event.target.value === "active")}><option value="active">{t("启用")}</option><option value="inactive">{t("停用")}</option></SelectControl></label></div>{error ? <p className="form-error" role="alert">{systemText(error)}</p> : null}<footer className="settings-form-footer"><button className="button button--secondary" type="button" disabled={submitting} onClick={() => { if (!busy.current) onCancel(); }}>{t("取消")}</button><button className="button button--primary" type="submit" disabled={submitting}><Check size={17} />{submitting ? t("正在保存…") : t("保存供应商")}</button></footer></fieldset></form>;
}
function parseFinanceAmount(value: string) {
  if (!/^\d+(\.\d{1,2})?$/.test(value.trim())) throw new Error("金额须大于零，最多两位小数，例如 25.50。");
  const amountCents = Math.round(Number(value) * 100);
  const error = controlError(() => validateFinanceEntry({ id: "amount-validation", kind: "income", amountCents, purpose: "金额核对", relatedId: "", note: "", time: "amount-validation" }));
  if (error) throw new Error("金额须大于 0 且不超过 1,000,000 欧元，最多两位小数。");
  return amountCents;
}
function Finance({ settings, save, onPendingChange }: Props) {
  const { t , systemText } = useLanguage();
  const staff = useStaff();
  const repairs = useRepairDirectory(); const { units } = useRetail();
  const [adding, setAdding] = useState(false); const [kind, setKind] = useState<"income" | "expense">("income"); const [filter, setFilter] = useState("all");
  const [amount, setAmount] = useState(""); const [purpose, setPurpose] = useState(""); const [relatedId, setRelatedId] = useState(""); const [note, setNote] = useState(""); const [error, setError] = useState("");
  const [voidId, setVoidId] = useState(""); const [voidReason, setVoidReason] = useState(""); const [voidError, setVoidError] = useState("");
  const [identity, setIdentity] = useState(() => crypto.randomUUID());
  const busy = useRef(false);
  const [submitting, setSubmitting] = useState<"entry" | "void" | null>(null);
  const pending = submitting !== null;
  const deviceDraft = useDeviceDraft("finance-entry", { kind, amount, purpose, relatedId, note, voidId, voidReason, identity }, value => {
    if (busy.current) return;
    setIdentity(value.identity); setKind(value.kind); setAmount(value.amount); setPurpose(value.purpose); setRelatedId(value.relatedId); setNote(value.note); setVoidId(value.voidId); setVoidReason(value.voidReason); setAdding(!value.voidId); setError(""); setVoidError("");
  }, adding || Boolean(voidId));
  const total = financeTotals(settings.finance);
  const rows = settings.finance.filter(row => filter === "all" || row.kind === filter).toReversed();
  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (busy.current) return;
    busy.current = true; setSubmitting("entry"); onPendingChange(true); setError("");
    try {
      if (settings.finance.some(row => row.id === identity)) throw new Error("这笔登记已保存，请在收支记录中核对；不能把恢复草稿再记一笔。");
      const entry = validateFinanceEntry({ id: identity, kind, amountCents: parseFinanceAmount(amount), purpose: purpose.trim(), relatedId, note: note.trim(), time: intakeRecordTime() });
      if (await save(current => ({ ...current, finance: [...current.finance, entry] }))) {
        await deviceDraft.clear(); setIdentity(crypto.randomUUID()); setAdding(false); setAmount(""); setPurpose(""); setNote(""); setRelatedId(""); setError("");
      } else setError("收支尚未保存，请处理上方错误后重试；输入已保留。");
    } catch (reason) { setError(reason instanceof Error ? reason.message : "登记失败，输入已保留，请重试。"); }
    finally { busy.current = false; setSubmitting(null); onPendingChange(false); }
  }
  async function voidEntry(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (busy.current) return;
    if (!voidReason.trim()) { setVoidError("请说明为何作废，例如金额误记；不能只填空格。"); return; }
    busy.current = true; setSubmitting("void"); onPendingChange(true); setVoidError("");
    try {
      if (await save(current => ({ ...current, finance: current.finance.map(row => row.id === voidId ? { ...row, voidReason: voidReason.trim() } : row) }))) {
        await deviceDraft.clear(); setVoidId(""); setVoidError("");
      } else setVoidError("作废尚未保存，请处理上方错误后重试；原因已保留。");
    } catch (reason) { setVoidError(reason instanceof Error ? reason.message : "作废失败，原因已保留，请重试。"); }
    finally { busy.current = false; setSubmitting(null); onPendingChange(false); }
  }
  return <>
    <div className="settings-section-title"><CircleDollarSign size={22} /><h3>{t("经营收支")}</h3>{staff.can("financial.edit") ? <button className="button button--primary button--compact" type="button" disabled={pending} onClick={() => { if (!busy.current) { setAdding(value => !value); setError(""); } }}><Plus size={17} />{t("登记")}</button> : null}</div>
    <fieldset className="form-fields" disabled={pending}><DeviceDraftNotice draft={deviceDraft}/></fieldset>
    <p className="settings-finance-note">{t("仅汇总已手动登记的收付款。")}</p>
    <div className="settings-finance-totals"><article><ArrowDownLeft size={19} /><small>{t("收入")}</small><strong>{formatCost(total.income)}</strong></article><article><ArrowUpRight size={19} /><small>{t("支出")}</small><strong>{formatCost(total.expense)}</strong></article><article><CircleDollarSign size={19} /><small>{t("收支差额")}</small><strong>{formatCost(total.balance)}</strong></article></div>
    {adding ? <form className="settings-editor" onSubmit={submit} aria-busy={submitting === "entry"}><fieldset className="form-fields" disabled={pending}><div className="field-grid">
      <label className="field"><span>{t("类型")}</span><SelectControl aria-label={t("收支类型")} value={kind} onChange={event => setKind(event.target.value as "income" | "expense")}><option value="income">{t("收入")}</option><option value="expense">{t("支出")}</option></SelectControl></label>
      <label className="field"><span>{t("金额（€）*")}</span><InputControl aria-label={t("收支金额")} inputMode="decimal" required validate={value => controlError(() => parseFinanceAmount(value))} value={amount} onChange={event => { setAmount(event.target.value); setError(""); }} placeholder={t("例如：25.50")} /></label>
      <label className="field"><span>{t("用途 *")}</span><InputControl onClear={() => { setPurpose(""); setError(""); }} clearLabel={t("清空收支用途")} aria-label={t("收支用途")} required validate={value => value.trim() ? "" : "请填写这笔收支的用途，例如维修收款；不能只填空格。"} value={purpose} maxLength={100} onChange={event => { setPurpose(event.target.value); setError(""); }} placeholder={t("例如：维修收款")} /></label>
      <label className="field"><span>{t("关联记录（选填）")}</span><SelectControl aria-label={t("关联收支记录")} value={relatedId} onChange={event => setRelatedId(event.target.value)}><option value="">{t("不关联")}</option>{repairs.map(row => <option key={row.id} value={row.id}>{row.id} · {row.device.model}</option>)}{units.map(row => <option key={row.id} value={row.id}>{row.code} · {row.model}</option>)}</SelectControl></label>
      <label className="field field--wide"><span>{t("备注")}</span><InputControl onClear={() => { setNote(""); setError(""); }} clearLabel={t("清空收支备注")} aria-label={t("收支备注")} value={note} maxLength={500} onChange={event => { setNote(event.target.value); setError(""); }} placeholder={t("例如：客户支付首笔维修款")} /></label>
    </div>{error ? <p role="alert" className="form-error">{systemText(error)}</p> : null}<footer className="settings-form-footer"><button type="button" className="button button--secondary" onClick={() => { if (!busy.current) setAdding(false); }}>{t("取消")}</button><button className="button button--primary" type="submit">{submitting === "entry" ? t("正在保存…") : t("保存登记")}</button></footer></fieldset></form> : null}
    <label className="field settings-finance-filter"><span>{t("记录类型")}</span><SelectControl aria-label={t("收支记录筛选")} disabled={pending} value={filter} onChange={event => setFilter(event.target.value)}><option value="all">{t("全部收支")}</option><option value="income">{t("收入")}</option><option value="expense">{t("支出")}</option></SelectControl></label>
    <div className="settings-finance-list">{rows.map(row => <article key={row.id}><span className={`settings-finance-icon settings-finance-icon--${row.kind}`}>{row.kind === "income" ? <ArrowDownLeft size={19} /> : <ArrowUpRight size={19} />}</span><div><strong>{row.purpose}{row.voidReason ? t(" · 已作废") : ""}</strong><small>{row.time}{row.relatedId ? ` · ${row.relatedId}` : ""}</small>{row.note ? <p>{row.note}</p> : null}{row.voidReason ? <p>{t("作废原因：")}{row.voidReason}</p> : null}</div><strong>{formatCost(row.amountCents)}</strong>{!row.voidReason && staff.can("financial.edit") ? <button type="button" className="icon-button" aria-label={t("作废收支 {v0}", { v0: row.purpose })} disabled={pending} onClick={() => { if (busy.current) return; setVoidId(row.id); setVoidReason(""); setVoidError(""); }}><X size={16} /></button> : null}</article>)}{!rows.length ? <div className="module-empty"><CircleDollarSign size={28} /><strong>{t("暂无收支登记")}</strong></div> : null}</div>
    {voidId ? <form className="settings-editor" onSubmit={voidEntry} aria-busy={submitting === "void"}><fieldset className="form-fields" disabled={pending}>
      <label className="field"><span>{t("作废原因 *")}</span><InputControl aria-label={t("收支作废原因")} value={voidReason} maxLength={300} required validate={value => value.trim() ? "" : "请说明为何作废，例如金额误记；不能只填空格。"} onChange={event => { setVoidReason(event.target.value); setVoidError(""); }} placeholder={t("例如：金额误记，追加正确记录")} /></label>
      {voidError ? <p className="form-error" role="alert">{systemText(voidError)}</p> : null}
      <footer className="settings-form-footer"><button type="button" className="button button--secondary" onClick={() => { if (!busy.current) { setVoidId(""); setVoidError(""); } }}>{t("取消")}</button><button type="submit" className="button button--secondary">{submitting === "void" ? t("正在保存…") : t("确认作废")}</button></footer>
    </fieldset></form> : null}
  </>;
}
