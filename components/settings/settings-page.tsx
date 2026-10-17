"use client";
import { Toast } from "@/components/toast";
import { useLanguage } from "@/components/language-provider";
import { InputControl } from "@/components/input-control";
import { controlError } from "@/components/control-feedback";
import { useDeviceDraft, DeviceDraftNotice } from "@/components/use-device-draft";
import { useRef, useState } from "react";
import{Preferences,SupplierEditor,useSettingsSubmission,type SettingsPatchSave}from"./settings-forms";
import{settingsPatchDraft}from"./settings-store";
import{useBackendState}from'@/components/backend-snapshot';
import{BoundedSettingsPage}from'./bounded-settings-page';
import{backendScopeKey}from'@/lib/backend/read-plan';
import{settingsTabs as tabs}from'./settings-tabs';
import { backendRecovery } from "@/lib/backend/client";
import { OperationRecoveryControls } from "@/components/use-operation-receipt";
import { ContactRound, CircleDollarSign, Plus, Pencil, X, Search, ArrowDownLeft, ArrowUpRight } from "lucide-react";
import { PageTitle } from "@/components/page-title";
import { SelectControl } from "@/components/select-control";
import { useRepairDirectory } from "@/components/repairs/local-intake-store";
import { useRetail } from "@/components/retail/retail-provider";
import { useStoreSettings, saveStoreSettings } from "./settings-store";
import { financeTotals, validateFinanceEntry, type StoreSettings, type SupplierProfile } from "@/lib/store-settings";
import { intakeRecordTime } from "@/lib/repair-intake-record";
import { formatCost } from "@/lib/procurement";
import { useStaff } from "@/components/staff/use-staff";
import { LoginDevicesPanel } from "@/components/account/login-devices";
import { StaffSettings } from "@/components/staff/staff-settings";
import { OrderManagement } from "./order-management";
export function SettingsPage({initialTab,bounded=false}:{initialTab?:string;bounded?:boolean}){const backend=useBackendState(),scope=backend.snapshot?.read?.scope;return backend.formal&&bounded?<BoundedSettingsPage key={scope?backendScopeKey(scope):'unscoped'} initialTab={initialTab}/>:<LegacySettingsPage initialTab={initialTab}/>;}
function LegacySettingsPage({ initialTab }: { initialTab?: string }) {
  const { t , systemText } = useLanguage();
  const staff=useStaff();
  const allowedTabs=tabs.filter(item=>item.id === "staff" ? staff.can("staff.manage") : item.id === "finance" ? staff.can("financial.read") : staff.can("settings.edit"));
  const { settings, error: storageError, ready } = useStoreSettings();
  const [tab, setTab] = useState(tabs.some(tab => tab.id === initialTab) ? initialTab! : "general");
  const [message, setMessage] = useState(""); const [error, setError] = useState("");
  const feedbackRequest = useRef<string | null>(null);
  const busy = useRef(false);
  const [submitting, setSubmitting] = useState(false);
  const onPendingChange = (pending: boolean) => { busy.current = pending; setSubmitting(pending); };
  const onReceiptChange: Props["onReceiptChange"] = (requestId, status) => {
    if (feedbackRequest.current !== requestId) return;
    if (status === "confirmed") { setMessage("已保存"); setError(""); }
    else if (backendRecovery().resolution?.requestId === requestId) {
      setMessage(""); setError(backendRecovery().resolution?.status === "cancelled" ? "" : backendRecovery().message);
    }
  };
  const save: Props["save"] = async (update, expectedRevision = settings.revision, options) => {
    const requestId = options.requestId; feedbackRequest.current = requestId; setError(""); setMessage("");
    try { await saveStoreSettings(expectedRevision, update, options); onReceiptChange(requestId, "confirmed"); return true; }
    catch (reason) { if (feedbackRequest.current === requestId) { setError(reason instanceof Error ? reason.message : "保存失败。"); setMessage(""); } return false; }
  };
  const savePatch:SettingsPatchSave=(patch,revision,options)=>save(current=>settingsPatchDraft(current,patch),revision,options);
  return <main className="module-page settings-page" onClickCapture={event => { if (busy.current && event.target instanceof Element && event.target.closest("a")) { event.preventDefault(); event.stopPropagation(); } }}><header className="module-heading" aria-disabled={submitting || undefined} onClickCapture={event => { if (busy.current) { event.preventDefault(); event.stopPropagation(); } }}><PageTitle title={t("门店管理")} backHref="/app/dashboard" /></header><div className="settings-layout"><nav className="panel settings-nav" aria-label={t("门店管理分类")}>{allowedTabs.map(item => <button key={item.id} type="button" disabled={submitting} aria-pressed={tab === item.id} className={tab === item.id ? "settings-nav--active" : ""} onClick={() => { if (busy.current) return; setTab(item.id); setError(""); setMessage(""); }}><item.icon size={19} /><span>{t(item.label)}</span></button>)}</nav><section className="panel settings-content">{!ready ? <p role="status">{t("正在读取设置…")}</p> : <>{storageError || error ? <p role="alert" className="form-error">{systemText(storageError || error)}</p> : null}{message ? <Toast message={systemText(message)} onDismiss={() => setMessage("")} /> : null}{!allowedTabs.some(item=>item.id === tab) ? <div className="module-empty"><strong>{t("当前账号不能访问这类设置")}</strong>{allowedTabs[0] ? <button className="button button--secondary" disabled={submitting} onClick={()=>{if (!busy.current) setTab(allowedTabs[0].id);}}>{t("查看")}{t(allowedTabs[0].label)}</button>:null}</div> : tab === "staff" ? <><StaffSettings onPendingChange={onPendingChange} /><LoginDevicesPanel storeMode /></> : tab === "orders" ? <OrderManagement settings={settings} disabled={Boolean(storageError)} onPendingChange={onPendingChange} /> : tab === "suppliers" ? <Suppliers settings={settings} save={save} onPendingChange={onPendingChange} onReceiptChange={onReceiptChange} /> : tab === "finance" ? <Finance settings={settings} save={save} onPendingChange={onPendingChange} onReceiptChange={onReceiptChange} /> : <Preferences key={tab} settings={settings} printing={tab === "printing"} save={savePatch} onPendingChange={onPendingChange} onReceiptChange={onReceiptChange} />}</>}</section></div></main>;
}
type Props = { settings: StoreSettings; save: (update: (current: StoreSettings) => StoreSettings, expectedRevision: number | undefined, options: { requestId: string }) => Promise<boolean>; onPendingChange: (pending: boolean) => void; onReceiptChange: (requestId: string, status: "confirmed" | "settled") => void };
function settledError() { return backendRecovery().resolution?.status === "rejected" ? backendRecovery().message : ""; }
function Suppliers({ settings, save, onPendingChange, onReceiptChange }: Props) {
  const { t } = useLanguage();
  const [query, setQuery] = useState(""); const [editing, setEditing] = useState<SupplierProfile | null>(null);
  const [adding, setAdding] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const busy = useRef(false);
  const setPending = (pending: boolean) => { busy.current = pending; setSubmitting(pending); onPendingChange(pending); };
  const rows = settings.suppliers.filter(row => `${row.name} ${row.phone}`.toLowerCase().includes(query.trim().toLowerCase()));
  return <><div className="settings-section-title"><ContactRound size={22} /><h3>{t("供应商")}</h3><button className="button button--primary button--compact" type="button" disabled={submitting} onClick={() => { if (busy.current) return; setEditing(null); setAdding(true); }}><Plus size={17} />{t("新增")}</button></div><label className="module-search"><Search size={17} /><InputControl onClear={() => setQuery("")} clearLabel={t("清空搜索供应商")} aria-label={t("搜索供应商")} disabled={submitting} value={query} onChange={event => setQuery(event.target.value)} placeholder={t("例如：MobileParts")} /></label>{adding || editing ? <SupplierEditor key={editing?.id ?? "new"} supplier={editing} suppliers={settings.suppliers} initialRevision={settings.revision} save={(patch,revision,options)=>save(current=>settingsPatchDraft(current,patch),revision,options)} onReceiptChange={onReceiptChange} onPendingChange={setPending} onCancel={() => { if (busy.current) return; setEditing(null); setAdding(false); }} onSaved={() => { setEditing(null); setAdding(false); }} /> : null}<div className="settings-supplier-list">{rows.map(row => <article key={row.id}><span className="device-glyph"><ContactRound size={19} /></span><div><strong>{row.name}</strong><small>{row.phone || t("联系方式未记录")}{!row.active ? t(" · 已停用") : ""}</small>{row.website ? <a href={row.website} target="_blank" rel="noreferrer" aria-disabled={submitting || undefined} tabIndex={submitting ? -1 : undefined}>{t("供应商网站")}</a> : null}</div><button className="icon-button" type="button" aria-label={t("编辑供应商 {v0}", { v0: row.name })} disabled={submitting} onClick={() => { if (busy.current) return; setEditing(row); setAdding(false); }}><Pencil size={17} /></button></article>)}{!rows.length ? <div className="module-empty"><ContactRound size={28} /><strong>{t("暂无匹配供应商")}</strong></div> : null}</div></>;
}
function parseFinanceAmount(value: string) {
  if (!/^\d+(\.\d{1,2})?$/.test(value.trim())) throw new Error("金额须大于零，最多两位小数，例如 25.50。");
  const amountCents = Math.round(Number(value) * 100);
  const error = controlError(() => validateFinanceEntry({ id: "amount-validation", kind: "income", amountCents, purpose: "金额核对", relatedId: "", note: "", time: "amount-validation" }));
  if (error) throw new Error("金额须大于 0 且不超过 1,000,000 欧元，最多两位小数。");
  return amountCents;
}
function Finance({ settings, save, onPendingChange, onReceiptChange }: Props) {
  const { t , systemText } = useLanguage();
  const staff = useStaff();
  const repairs = useRepairDirectory(); const { units } = useRetail();
  const [adding, setAdding] = useState(false); const [kind, setKind] = useState<"income" | "expense">("income"); const [filter, setFilter] = useState("all");
  const [amount, setAmount] = useState(""); const [purpose, setPurpose] = useState(""); const [relatedId, setRelatedId] = useState(""); const [note, setNote] = useState(""); const [error, setError] = useState("");
  const [voidId, setVoidId] = useState(""); const [voidReason, setVoidReason] = useState(""); const [voidError, setVoidError] = useState("");
  const [identity, setIdentity] = useState(() => crypto.randomUUID());
  const { busy, receipt, submitting, pending, run } = useSettingsSubmission({ save, onPendingChange, onReceiptChange });
  const [operation, setOperation] = useState<"entry" | "void" | null>(null);
  const deviceDraft = useDeviceDraft("finance-entry", { kind, amount, purpose, relatedId, note, voidId, voidReason, identity }, value => {
    if (busy.current) return;
    setIdentity(value.identity); setKind(value.kind); setAmount(value.amount); setPurpose(value.purpose); setRelatedId(value.relatedId); setNote(value.note); setVoidId(value.voidId); setVoidReason(value.voidReason); setAdding(!value.voidId); setError(""); setVoidError("");
  }, adding || Boolean(voidId));
  const total = financeTotals(settings.finance);
  const rows = settings.finance.filter(row => filter === "all" || row.kind === filter).toReversed();
  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (busy.current) return;
    setOperation("entry"); setError("");
    try {
      if (settings.finance.some(row => row.id === identity)) throw new Error("这笔登记已保存，请在收支记录中核对；不能把恢复草稿再记一笔。");
      const entry = validateFinanceEntry({ id: identity, kind, amountCents: parseFinanceAmount(amount), purpose: purpose.trim(), relatedId, note: note.trim(), time: intakeRecordTime() });
      const result = await run(current => ({ ...current, finance: [...current.finance, entry] }), settings.revision, async () => {
        await deviceDraft.clear(); setIdentity(crypto.randomUUID()); setAdding(false); setAmount(""); setPurpose(""); setNote(""); setRelatedId(""); setError(""); setOperation(null);
      }, () => { setError(settledError()); setOperation(null); });
      if (result === "failed") setError("收支尚未保存，请处理上方错误后重试；输入已保留。");
    } catch (reason) { setError(reason instanceof Error ? reason.message : "登记失败，输入已保留，请重试。"); }
  }
  async function voidEntry(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (busy.current) return;
    if (!voidReason.trim()) { setVoidError("请说明为何作废，例如金额误记；不能只填空格。"); return; }
    setOperation("void"); setVoidError("");
    try {
      const result = await run(current => ({ ...current, finance: current.finance.map(row => row.id === voidId ? { ...row, voidReason: voidReason.trim() } : row) }), settings.revision, async () => {
        await deviceDraft.clear(); setVoidId(""); setVoidReason(""); setVoidError(""); setOperation(null);
      }, () => { setVoidError(settledError()); setOperation(null); });
      if (result === "failed") setVoidError("作废尚未保存，请处理上方错误后重试；原因已保留。");
    } catch (reason) { setVoidError(reason instanceof Error ? reason.message : "作废失败，原因已保留，请重试。"); }
  }
  return <>
    <div className="settings-section-title"><CircleDollarSign size={22} /><h3>{t("经营收支")}</h3>{staff.can("financial.edit") ? <button className="button button--primary button--compact" type="button" disabled={pending} onClick={() => { if (!busy.current) { setAdding(value => !value); setError(""); } }}><Plus size={17} />{t("登记")}</button> : null}</div>
    <fieldset className="form-fields" disabled={pending}><DeviceDraftNotice draft={deviceDraft} disabled={pending}/></fieldset>
    <p className="settings-finance-note">{t("仅汇总已手动登记的收付款。")}</p>
    <div className="settings-finance-totals"><article><ArrowDownLeft size={19} /><small>{t("收入")}</small><strong>{formatCost(total.income)}</strong></article><article><ArrowUpRight size={19} /><small>{t("支出")}</small><strong>{formatCost(total.expense)}</strong></article><article><CircleDollarSign size={19} /><small>{t("收支差额")}</small><strong>{formatCost(total.balance)}</strong></article></div>
    {adding ? <form className="settings-editor" onSubmit={submit} aria-busy={(submitting || receipt.executing) && operation === "entry"}><fieldset className="form-fields" disabled={pending}><div className="field-grid">
      <label className="field"><span>{t("类型")}</span><SelectControl aria-label={t("收支类型")} value={kind} onChange={event => setKind(event.target.value as "income" | "expense")}><option value="income">{t("收入")}</option><option value="expense">{t("支出")}</option></SelectControl></label>
      <label className="field"><span>{t("金额（€）*")}</span><InputControl aria-label={t("收支金额")} inputMode="decimal" required validate={value => controlError(() => parseFinanceAmount(value))} value={amount} onChange={event => { setAmount(event.target.value); setError(""); }} placeholder={t("例如：25.50")} /></label>
      <label className="field"><span>{t("用途 *")}</span><InputControl onClear={() => { setPurpose(""); setError(""); }} clearLabel={t("清空收支用途")} aria-label={t("收支用途")} required validate={value => value.trim() ? "" : "请填写这笔收支的用途，例如维修收款；不能只填空格。"} value={purpose} maxLength={100} onChange={event => { setPurpose(event.target.value); setError(""); }} placeholder={t("例如：维修收款")} /></label>
      <label className="field"><span>{t("关联记录（选填）")}</span><SelectControl aria-label={t("关联收支记录")} value={relatedId} onChange={event => setRelatedId(event.target.value)}><option value="">{t("不关联")}</option>{repairs.map(row => <option key={row.id} value={row.id}>{row.id} · {row.device.model}</option>)}{units.map(row => <option key={row.id} value={row.id}>{row.code} · {row.model}</option>)}</SelectControl></label>
      <label className="field field--wide"><span>{t("备注")}</span><InputControl onClear={() => { setNote(""); setError(""); }} clearLabel={t("清空收支备注")} aria-label={t("收支备注")} value={note} maxLength={500} onChange={event => { setNote(event.target.value); setError(""); }} placeholder={t("例如：客户支付首笔维修款")} /></label>
    </div>{error ? <p role="alert" className="form-error">{systemText(error)}</p> : null}<footer className="settings-form-footer"><button type="button" className="button button--secondary" onClick={() => { if (!busy.current) setAdding(false); }}>{t("取消")}</button><button className="button button--primary" type="submit">{submitting ? t("正在保存…") : receipt.waiting ? t("待核对") : t("保存登记")}</button></footer></fieldset></form> : null}
    <label className="field settings-finance-filter"><span>{t("记录类型")}</span><SelectControl aria-label={t("收支记录筛选")} disabled={pending} value={filter} onChange={event => setFilter(event.target.value)}><option value="all">{t("全部收支")}</option><option value="income">{t("收入")}</option><option value="expense">{t("支出")}</option></SelectControl></label>
    <div className="settings-finance-list">{rows.map(row => <article key={row.id}><span className={`settings-finance-icon settings-finance-icon--${row.kind}`}>{row.kind === "income" ? <ArrowDownLeft size={19} /> : <ArrowUpRight size={19} />}</span><div><strong>{row.purpose}{row.voidReason ? t(" · 已作废") : ""}</strong><small>{row.time}{row.relatedId ? ` · ${row.relatedId}` : ""}</small>{row.note ? <p>{row.note}</p> : null}{row.voidReason ? <p>{t("作废原因：")}{row.voidReason}</p> : null}</div><strong>{formatCost(row.amountCents)}</strong>{!row.voidReason && staff.can("financial.edit") ? <button type="button" className="icon-button" aria-label={t("作废收支 {v0}", { v0: row.purpose })} disabled={pending} onClick={() => { if (busy.current) return; setVoidId(row.id); setVoidReason(""); setVoidError(""); }}><X size={16} /></button> : null}</article>)}{!rows.length ? <div className="module-empty"><CircleDollarSign size={28} /><strong>{t("暂无收支登记")}</strong></div> : null}</div>
    {voidId ? <form className="settings-editor" onSubmit={voidEntry} aria-busy={(submitting || receipt.executing) && operation === "void"}><fieldset className="form-fields" disabled={pending}>
      <label className="field"><span>{t("作废原因 *")}</span><InputControl aria-label={t("收支作废原因")} value={voidReason} maxLength={300} required validate={value => value.trim() ? "" : "请说明为何作废，例如金额误记；不能只填空格。"} onChange={event => { setVoidReason(event.target.value); setVoidError(""); }} placeholder={t("例如：金额误记，追加正确记录")} /></label>
      {voidError ? <p className="form-error" role="alert">{systemText(voidError)}</p> : null}
      <footer className="settings-form-footer"><button type="button" className="button button--secondary" onClick={() => { if (!busy.current) { setVoidId(""); setVoidError(""); } }}>{t("取消")}</button><button type="submit" className="button button--secondary">{submitting ? t("正在保存…") : receipt.waiting ? t("待核对") : t("确认作废")}</button></footer>
    </fieldset></form> : null}
    <OperationRecoveryControls requestId={receipt.requestId}/>
  </>;
}
