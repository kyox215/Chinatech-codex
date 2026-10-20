"use client";
import{useState}from'react';
import{Search,History}from'lucide-react';
import{useBackendState}from'@/components/backend-snapshot';
import{useLanguage}from'@/components/language-provider';
import{InputControl}from'@/components/input-control';
import{ReadFailure,ReadPending}from'@/components/page-recovery';
import{ListPagination}from'@/components/list-pagination';
import{WindowedListRows}from'@/components/windowed-list-rows';
import{StaffSettings,type StaffDirectoryView}from'@/components/staff/staff-settings';
import{LoginDevicesPanel}from'@/components/account/login-devices';
import{permissionLabels,type StaffMember,type StaffAudit}from'@/lib/staff';
import{settingsSectionQuery,type SettingsMemberSummary}from'@/lib/backend/settings-section-contract';
import{settingsStaffWriteRevision}from'@/lib/backend/settings-section-client';
import{useSettingsSection,requestSettingsSection,useSettingsRefresh}from'./use-settings-section';
import styles from'@/components/staff/staff-settings.module.css';
export function BoundedStaffSettings({onPendingChange}:{onPendingChange:(value:boolean)=>void}){
 const{t}=useLanguage(),backend=useBackendState(),scope=backend.snapshot?.read?.scope,[q,setQ]=useState(''),[pending,setPending]=useState(false),page=useSettingsSection({kind:'staff',q});useSettingsRefresh(page.retry);const data=page.page,rows=(data?.items??[])as SettingsMemberSummary[];
 const directory:StaffDirectoryView|undefined=data?{members:rows,revision:settingsStaffWriteRevision(data.generation),version:data.stateToken,resolve:async(id,signal)=>{if(!scope)throw new Error('账号访问权限已变化。');const original=await requestSettingsSection(scope,settingsSectionQuery({kind:'member',id}),{signal});if('unchanged'in original||original.items.length!==1||original.generation!==data.generation){page.retry();throw new Error('员工资料已变化，请重新核对。');}return original.items[0].value as StaffMember;},renderMembers:render=><WindowedListRows items={rows} startIndex={data.startIndex} total={data.total} extent={page.extent} rowKey={row=>row.id} version={data.stateToken} pending={page.pending} estimate={90} onAnchor={row=>page.rememberAnchor(row.id)} onSeek={page.seek} onLoadPrevious={page.loadPrevious} render={(row,props)=><div {...props} key={row.id} className={styles.windowRow} data-staff-last={props['data-window-index']===data.total-1||undefined}>{render({...row,name:row.name+(row.previews.includes('name')?'…':''),email:row.email+(row.previews.includes('email')?'…':'')})}</div>}/>,history:<BoundedStaffAudit total={data.auditTotal??0}/>} :undefined;
 return <><label className="module-search"><Search size={17}/><InputControl type="search" maxLength={160} value={q} disabled={pending} onChange={event=>setQ(event.target.value)} onClear={()=>setQ('')} clearLabel={t('清空搜索')} aria-label={t('员工称呼')+' / '+t('员工账号标识')} placeholder={t('员工称呼')+' / '+t('员工账号标识')}/></label>{page.error?<ReadFailure message={page.error} pending={page.pending} onRetry={page.retry}/>:null}{!data&&!page.error&&page.pending?<ReadPending label="正在读取设置…"/>:null}{directory?<StaffSettings directory={directory} onPendingChange={value=>{setPending(value);onPendingChange(value);}}/>:null}<ListPagination start={data?.startIndex??0} shown={data?data.startIndex+rows.length:0} total={data?.total} hasMore={!!data?.nextCursor} onLoadMore={page.loadMore} loading={page.pending} disabled={pending||!!page.error} resetKey={page.resetKey}/><LoginDevicesPanel storeMode/></>;
}
type Audit=StaffAudit&{targetName?:string;targetNamePreview?:boolean};
function BoundedStaffAudit({total}:{total:number}){
 const{t}=useLanguage(),[open,setOpen]=useState(false);
 return <details className={styles.audit} open={open} onToggle={event=>setOpen(event.currentTarget.open)}><summary><History size={17}/>{t('权限变更记录 · ')}{total}</summary>{open?<AuditRows/>:null}</details>;
}
function AuditRows(){
 const{t}=useLanguage(),page=useSettingsSection({kind:'audit'});useSettingsRefresh(page.retry);const data=page.page,rows=(data?.items??[])as Audit[];
 return <>{page.error?<ReadFailure message={page.error} pending={page.pending} onRetry={page.retry}/>:null}{!data&&!page.error&&page.pending?<ReadPending label="正在读取设置…"/>:null}<WindowedListRows items={rows} startIndex={data?.startIndex??0} total={data?.total??0} extent={page.extent} rowKey={row=>row.id} version={data?.stateToken??''} pending={page.pending} onAnchor={row=>page.rememberAnchor(row.id)} onSeek={page.seek} onLoadPrevious={page.loadPrevious} render={(entry,props)=><article key={entry.id} {...props}><strong>{entry.targetName??t('员工')}{entry.targetNamePreview?'…':''} · {entry.before?t('权限资料更正'):t('新增成员')}</strong><small>{entry.time} · {entry.actorName}</small><p>{entry.after.permissions.map(permission=>t(permissionLabels[permission])).join('、')||t('无业务能力')}</p></article>}/><ListPagination start={data?.startIndex??0} shown={data?data.startIndex+rows.length:0} total={data?.total} hasMore={!!data?.nextCursor} onLoadMore={page.loadMore} loading={page.pending} disabled={!!page.error} resetKey={page.resetKey}/></>;
}
