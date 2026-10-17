"use client";
import{useRef,useState}from'react';
import{ContactRound,Plus,Pencil,Search}from'lucide-react';
import{useBackendState}from'@/components/backend-snapshot';
import{PageTitle}from'@/components/page-title';
import{useLanguage}from'@/components/language-provider';
import{useStaff}from'@/components/staff/use-staff';
import{InputControl}from'@/components/input-control';
import{ReadFailure,ReadPending}from'@/components/page-recovery';
import{ListPagination}from'@/components/list-pagination';
import{WindowedListRows}from'@/components/windowed-list-rows';
import{Toast}from'@/components/toast';
import{backendCommand,backendRecovery}from'@/lib/backend/client';
import{backendScopeKey}from'@/lib/backend/read-plan';
import type{SupplierProfile,StoreSettings}from'@/lib/store-settings';
import type{SettingsSupplierSummary,SettingsSectionKind}from'@/lib/backend/settings-section-contract';
import{settingsTabs}from'./settings-tabs';
import{Preferences,SupplierEditor,type SettingsPatchSave,type SettingsFeedback,type SettingsPreferenceValues}from'./settings-forms';
import{useSettingsSection,useSettingsRefresh}from'./use-settings-section';
import{OrderManagement}from'./order-management';
import{BoundedFinance}from'./settings-finance';
import{BoundedStaffSettings}from'./settings-staff';
export function BoundedSettingsPage({initialTab}:{initialTab?:string}){
 const backend=useBackendState(),staff=useStaff(),{t,systemText}=useLanguage(),scope=backend.snapshot?.read?.scope;
 const allowed=settingsTabs.filter(row=>staff.can(row.id==='staff'?'staff.manage':row.id==='finance'?'financial.read':'settings.edit'));
 const[tab,setTab]=useState(settingsTabs.some(row=>row.id===initialTab)?initialTab!:'general'),[pending,setPending]=useState(false),[message,setMessage]=useState(''),[error,setError]=useState('');const busy=useRef(false),feedback=useRef('');
 const onPendingChange=(value:boolean)=>{busy.current=value;setPending(value);};
 const onReceiptChange:SettingsFeedback['onReceiptChange']=(id,status)=>{if(feedback.current!==id)return;if(status==='confirmed'){setMessage('已保存');setError('');}else{setMessage('');setError(backendRecovery().resolution?.status==='rejected'?backendRecovery().message:'');}};
 const save:SettingsPatchSave=async(patch,revision,options)=>{feedback.current=options.requestId;setMessage('');setError('');try{await backendCommand('settings.save',{revision,patch},options.requestId);onReceiptChange(options.requestId,'confirmed');return true;}catch(reason){if(feedback.current===options.requestId)setError(reason instanceof Error?reason.message:'保存失败。');return false;}};
 const feedbackProps={save,onPendingChange,onReceiptChange};
 return <main className="module-page settings-page" onClickCapture={event=>{if(busy.current&&event.target instanceof Element&&event.target.closest('a')){event.preventDefault();event.stopPropagation();}}}><header className="module-heading"><PageTitle title={t('门店管理')} backHref="/app/dashboard"/></header><div className="settings-layout"><nav className="panel settings-nav" aria-label={t('门店管理分类')}>{allowed.map(row=><button key={row.id} type="button" disabled={pending} aria-pressed={tab===row.id} className={tab===row.id?'settings-nav--active':''} onClick={()=>{if(busy.current)return;setTab(row.id);setMessage('');setError('');}}><row.icon size={19}/><span>{t(row.label)}</span></button>)}</nav><section className="panel settings-content">{error?<p role="alert" className="form-error">{systemText(error)}</p>:null}{message?<Toast message={systemText(message)} onDismiss={()=>setMessage('')}/>:null}{allowed.some(row=>row.id===tab)?<SettingsSection key={(scope?backendScopeKey(scope):'')+tab} kind={tab as SettingsSectionKind} {...feedbackProps}/>:<div className="module-empty"><strong>{t('当前账号不能访问这类设置')}</strong>{allowed[0]?<button className="button button--secondary" type="button" onClick={()=>setTab(allowed[0].id)}>{t('查看')}{t(allowed[0].label)}</button>:null}</div>}</section></div></main>;
}
type SectionProps=SettingsFeedback&{save:SettingsPatchSave};
function SettingsSection({kind,...feedback}:SectionProps&{kind:SettingsSectionKind}){
 if(kind==='suppliers')return <BoundedSuppliers {...feedback}/>;
 if(kind==='finance')return <BoundedFinance {...feedback}/>;
 if(kind==='staff')return <BoundedStaffSettings onPendingChange={feedback.onPendingChange}/>;
 return <PreferencesSection kind={kind as'general'|'printing'|'orders'} {...feedback}/>;
}
function PreferencesSection({kind,...feedback}:SectionProps&{kind:'general'|'printing'|'orders'}){
 const page=useSettingsSection({kind});useSettingsRefresh(page.retry);const value=page.page?.items[0];
 return <>{page.error?<ReadFailure message={page.error} onRetry={page.retry} pending={page.pending}/>:null}{!value&&!page.error&&page.pending?<ReadPending label="正在读取设置…"/>:null}{value?kind==='orders'&&'repairGroups'in value?<OrderManagement settings={value as Pick<StoreSettings,'revision'|'repairGroups'>} onPendingChange={feedback.onPendingChange} saveGroups={async(revision,repairGroups,options)=>{if(!await feedback.save({type:'orders',repairGroups},revision,options))throw new Error(backendRecovery().message||'保存失败。');}}/>:<Preferences settings={value as SettingsPreferenceValues} printing={kind==='printing'} {...feedback}/>:null}</>;
}
function BoundedSuppliers(feedback:SectionProps){
 const{t}=useLanguage(),[q,setQ]=useState(''),[editing,setEditing]=useState<string|null>(null),[adding,setAdding]=useState(false),[pending,setPending]=useState(false),page=useSettingsSection({kind:'suppliers',q});useSettingsRefresh(page.retry);const data=page.page,rows=(data?.items??[])as SettingsSupplierSummary[];
 const props={...feedback,onPendingChange:(value:boolean)=>{setPending(value);feedback.onPendingChange(value);}},close=()=>{setEditing(null);setAdding(false);};
 return <><div className="settings-section-title"><ContactRound size={22}/><h3>{t('供应商')}</h3><button className="button button--primary button--compact" type="button" disabled={pending||!data} onClick={()=>{setEditing(null);setAdding(true);}}><Plus size={17}/>{t('新增')}</button></div><label className="module-search"><Search size={17}/><InputControl type="search" maxLength={160} value={q} disabled={pending} onChange={event=>setQ(event.target.value)} onClear={()=>setQ('')} clearLabel={t('清空搜索供应商')} aria-label={t('搜索供应商')} placeholder={t('例如：MobileParts')}/></label>{page.error?<ReadFailure message={page.error} onRetry={page.retry} pending={page.pending}/>:null}{!data&&!page.error&&page.pending?<ReadPending label="正在读取设置…"/>:null}{adding&&data?<SupplierEditor supplier={null} initialRevision={data.revision} {...props} onCancel={close} onSaved={close}/>:editing&&data?<SupplierOriginal id={editing} revision={data.revision} {...props} onClose={close}/>:null}<div className="settings-supplier-list"><WindowedListRows items={rows} total={data?.total??0} startIndex={data?.startIndex??0} extent={page.extent} rowKey={row=>row.id} version={data?.stateToken??''} pending={page.pending} onAnchor={row=>page.rememberAnchor(row.id)} onSeek={page.seek} onLoadPrevious={page.loadPrevious} render={(row,props)=><article key={row.id} {...props}><span className="device-glyph"><ContactRound size={19}/></span><div><strong>{row.name}{row.previews.includes('name')?'…':''}</strong><small>{row.phone||t('联系方式未记录')}{row.previews.includes('phone')?'…':''}{!row.active?t(' · 已停用'):''}</small>{row.website?<a href={row.website} target="_blank" rel="noreferrer">{t('供应商网站')}</a>:null}</div><button className="icon-button" type="button" disabled={pending} aria-label={t('编辑供应商 {v0}',{v0:row.name})} onClick={()=>{setAdding(false);setEditing(row.id);}}><Pencil size={17}/></button></article>}/>{data&&!rows.length?<div className="module-empty"><ContactRound size={28}/><strong>{t('暂无匹配供应商')}</strong></div>:null}</div><ListPagination start={data?.startIndex??0} shown={data?data.startIndex+rows.length:0} total={data?.total} hasMore={!!data?.nextCursor} onLoadMore={page.loadMore} loading={page.pending} disabled={pending||!!page.error} resetKey={page.resetKey}/></>;
}
function SupplierOriginal({id,revision,onClose,...feedback}:SectionProps&{id:string;revision:number;onClose:()=>void}){
 const page=useSettingsSection({kind:'supplier',id});useSettingsRefresh(page.retry);const value=page.page?.items[0]as SupplierProfile|undefined;
 return <>{page.error?<ReadFailure message={page.error} onRetry={page.retry} pending={page.pending}/>:null}{!value&&!page.error&&page.pending?<ReadPending label="正在读取设置…"/>:null}{value?<SupplierEditor key={id} supplier={value} initialRevision={revision} {...feedback} onCancel={onClose} onSaved={onClose}/>:null}</>;
}
