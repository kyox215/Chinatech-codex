"use client";
import {AccountBrand} from '@/components/account/account-heading';
import styles from './stores.module.css';
import {useCallback,useEffect,useRef,useState} from 'react';
import {InputControl} from '@/components/input-control';
import {ReadPending} from '@/components/page-recovery';
import {NavigationLink as Link} from '@/components/navigation-link';
import {ContentProgress,useActivityFeedback} from '@/components/operation-feedback';
import {useLanguage} from '@/components/language-provider';
import {LogoutButton} from '@/components/dashboard/logout-button';
import {scopedStoreUrl} from '@/lib/store-scope';
import {subscribeAuthChanged} from '@/lib/auth-events';
import {staffRoles,type StaffRole} from '@/lib/staff';
import {forgetInvitationHash,invitationToken,persistInvitation} from '@/lib/store-invitation-client';
import {readStoreJson} from '@/lib/store-request';

type Store={id:string;name:string;role:StaffRole};
type Application={id:string;storeName:string;status:string;created_at:string;invitationStatus:string};
type Page={totalCount:number;nextCursor:string|null;hasMore:boolean};
type Intent={kind:'create'|'apply';value:string;id:string};
type Invitation={storeName:string;status?:string;applied?:boolean};
type Action='create'|'check'|'apply'|'refresh'|'more';
const applicationStatus=(status:string)=>status==='pending'?'等待门店审核':status==='approved'?'已批准':'已拒绝';
export function MyStores(){
 const {t,systemText,locale}=useLanguage();
 const [stores,setStores]=useState<Store[]>([]),[applications,setApplications]=useState<Application[]>([]),[page,setPage]=useState<Page|null>(null),[accountId,setAccountId]=useState(''),[name,setName]=useState(''),[token,setToken]=useState(''),[invite,setInvite]=useState<Invitation|null>(null),[expanded,setExpanded]=useState<'create'|'join'|null>(null),[busy,setBusy]=useState(false),[reading,setReading]=useState(true),[unresolved,setUnresolved]=useState<Intent|null>(null),[error,setError]=useState('');
 const lock=useRef(false),intent=useRef<Intent|null>(null),epoch=useRef(0),account=useRef(''),lifetime=useRef<AbortController|null>(null);
 const [activity,setActivity]=useState<Action|null>(null);
 const cancelEpoch=useCallback(()=>{epoch.current++;lifetime.current?.abort();},[]);
 useActivityFeedback(busy||reading);
 async function request(url:string,body?:unknown,expected=account.current){
  const generation=epoch.current;
  const {response,data}=await readStoreJson(url,{method:body?'POST':'GET',headers:{...(body?{'Content-Type':'application/json'}:{}),...(expected?{'x-ct-account-id':expected}:{})},body:body?JSON.stringify(body):undefined,cache:'no-store',signal:lifetime.current?AbortSignal.any([lifetime.current.signal,AbortSignal.timeout(15000)]):AbortSignal.timeout(15000)},body?'请求结果尚未确认。请核对账号状态后重试，输入已保留。':undefined);
  if(generation!==epoch.current)throw new Error('登录身份已变化，请重新登录后核对原提交。');
  if(!response.ok)throw Object.assign(new Error(data.message),{status:response.status});
  if(data.accountId&&expected&&data.accountId!==expected)throw new Error('登录身份已变化，请重新登录后核对原提交。');
  return data;
 }
 function clearIntent(){intent.current=null;setUnresolved(null);try{sessionStorage.removeItem('ct-store-intent:'+account.current);}catch{/* A confirmed response has completed this request. */}}
 function ownResult(data:{stores:Store[];applications:Application[];applicationPage:Page;accountId:string},append=false){
  setStores(data.stores);setPage(data.applicationPage);setApplications(previous=>append?[...new Map([...previous,...data.applications].map(row=>[row.id,row])).values()]:data.applications);
  if(intent.current?.kind==='apply'&&data.applications.some(row=>row.id===intent.current!.id))clearIntent();
 }
 async function loadAccount(isCurrent:()=>boolean){
   const data=await request('/api/account/stores');
   if(!isCurrent())return;
   account.current=data.accountId;setAccountId(data.accountId);
   try{const raw=sessionStorage.getItem('ct-store-intent:'+data.accountId);if(raw){const saved=JSON.parse(raw);if(['create','apply'].includes(saved.kind)&&typeof saved.value==='string'&&/^[a-f0-9-]{36}$/.test(saved.id)){intent.current=saved;setUnresolved(saved);setExpanded(saved.kind==='create'?'create':'join');if(saved.kind==='create')setName(saved.value);}}}catch{/* New writes require recovery storage. */}
   ownResult(data);
   const hash=window.location.hash;let carried=new URLSearchParams(hash.slice(1)).get('invite')??'';
   if(!carried){try{carried=sessionStorage.getItem('ct-pending-invite')??'';}catch{/* The server cookie remains the durable candidate. */}}
   if(carried){setExpanded('join');await persistInvitation(carried);if(!isCurrent())return;forgetInvitationHash(hash);}
   // An uncertain apply must retain its original cookie for an idempotent retry.
   if(intent.current?.kind==='apply')return;
   const context=await request('/api/account/store-invitations');if(isCurrent()&&context.hasInvitation){setExpanded('join');setInvite(context);}
 }
 useEffect(()=>{
  let live=true;const generation=++epoch.current;lifetime.current=new AbortController();
  const invalidate=()=>{epoch.current++;lifetime.current?.abort();account.current='';intent.current=null;setStores([]);setApplications([]);setPage(null);setUnresolved(null);setAccountId('');setInvite(null);setName('');setToken('');window.location.reload();};
  const unsubscribe=subscribeAuthChanged(invalidate);
  loadAccount(()=>live&&generation===epoch.current).catch(e=>{if(live&&generation===epoch.current)setError(e.message);}).finally(()=>{if(live&&generation===epoch.current)setReading(false);});
  return()=>{live=false;cancelEpoch();unsubscribe();};
 // State updates and request continuations are deliberately tied to this mount's identity epoch.
 // eslint-disable-next-line react-hooks/exhaustive-deps
 },[cancelEpoch]);
 async function act(kind:Action){
  if(lock.current)return;lock.current=true;const generation=epoch.current,originalAccount=account.current;setBusy(true);setActivity(kind);setError('');
  try{
   if(kind==='refresh'&&!originalAccount){await loadAccount(()=>generation===epoch.current);return;}
   if(kind==='refresh'||kind==='more'){const data=await request('/api/account/stores'+(kind==='more'&&page?.nextCursor?'?applicationCursor='+encodeURIComponent(page.nextCursor):''));ownResult(data,kind==='more');return;}
   if(unresolved&&(unresolved.kind!==kind))throw new Error('请先核对原请求，再开始新的操作。');
   if(kind==='check'){
    const candidate=invitationToken(token,window.location.origin);await persistInvitation(candidate,lifetime.current?.signal);if(generation!==epoch.current||originalAccount!==account.current)return;const data=await request('/api/account/store-invitations',{useContext:true},originalAccount);if(generation!==epoch.current||originalAccount!==account.current)return;setInvite(data);setToken('');return;
   }
   const value=kind==='create'?name:'';
   if(intent.current&&(intent.current.kind!==kind||intent.current.value!==value))throw new Error('请先核对原请求，再开始新的操作。');
   if(!intent.current){const next={kind,value,id:crypto.randomUUID()} as Intent;sessionStorage.setItem('ct-store-intent:'+account.current,JSON.stringify(next));intent.current=next;setUnresolved(next);setExpanded(kind==='create'?'create':'join');}
   if(kind==='create'){
    const data=await request('/api/account/stores',{name:intent.current.value,requestId:intent.current.id});clearIntent();window.location.assign(scopedStoreUrl('/app/dashboard',data.storeId));
   }else{
    const data=await request('/api/account/store-invitations',{useContext:true,requestId:intent.current.id});setInvite(data);clearIntent();setToken('');ownResult(await request('/api/account/stores'));
   }
  }catch(e){if(generation===epoch.current){if(e&&typeof e==='object'&&'status'in e&&Number(e.status)<500)clearIntent();setError(e instanceof Error?e.message:'请求结果尚未确认。请核对账号状态后重试，输入已保留。');}}
  finally{lock.current=false;if(generation===epoch.current){setBusy(false);setActivity(null);}}
 }
 const disabled=busy||reading||!accountId,locked=disabled||Boolean(unresolved);
 const date=(value:string)=>new Date(value).toLocaleString(locale);
 return <main className={`${styles.page} ${styles.storeEntry}`}><AccountBrand/><ContentProgress/><div className={styles.heading}><h1>{t('我的门店')}</h1><button className="button button--secondary" disabled={busy||reading} aria-busy={activity==='refresh'} onClick={()=>void act('refresh')}>{t('重新检查')}</button></div>
  {unresolved?<p role="status">{t('提交结果待核对，请处理原提交，勿重复新建。')}</p>:null}{error?<p className="form-error" role="alert">{systemText(error)}</p>:null}
  {!accountId&&reading?<ReadPending label="正在读取门店…"/>:null}
  {accountId?<section className={`panel ${styles.joinedStores}`} aria-label={t('已加入的门店')}><h2>{t('已加入的门店')}</h2>{stores.length?stores.map(store=><div className={styles.storeRow} key={store.id}><div><strong>{store.name}</strong><p>{t(staffRoles[store.role])}</p></div><Link className="button button--primary" href={scopedStoreUrl('/app/dashboard',store.id)}>{t('进入门店')}</Link></div>):<p>{t('尚未加入门店')}</p>}</section>:null}
  {applications.length?<section className="panel"><div className={styles.heading}><h2>{t('我的申请')}</h2><span>{page?.totalCount}</span></div>{applications.map(application=><div className={styles.applicationFact} key={application.id}><strong>{application.storeName}</strong><p>{t(applicationStatus(application.status))} · <time dateTime={application.created_at}>{date(application.created_at)}</time></p>{application.status==='pending'&&['revoked','expired'].includes(application.invitationStatus)?<p>{t('邀请无效或已过期。请向门店负责人索取新邀请。')}</p>:null}</div>)}{page?.hasMore?<button className="button button--secondary" disabled={disabled} aria-busy={activity==='more'} onClick={()=>void act('more')}>{t('加载更多申请')}</button>:null}</section>:null}
  {accountId?<section className={styles.optionalStores} aria-label={t(stores.length?'其他门店操作':'创建或加入门店')}>
   <h2>{t(stores.length?'其他门店操作':'创建或加入门店')}</h2>
   <div className={styles.actions}>
    <button type="button" className="button button--secondary" aria-expanded={expanded==='create'} aria-controls="create-store-form" disabled={locked} onClick={()=>setExpanded(value=>value==='create'?null:'create')}>{t('创建新门店')}</button>
    <button type="button" className="button button--secondary" aria-expanded={expanded==='join'} aria-controls="join-store-form" disabled={locked} onClick={()=>setExpanded(value=>value==='join'?null:'join')}>{t('通过邀请加入')}</button>
   </div>
   <section className={`panel ${styles.optionalForm}`} id="create-store-form" hidden={expanded!=='create'} aria-label={t('创建新门店')}><form onSubmit={event=>{event.preventDefault();void act('create');}}><label htmlFor="new-store-name">{t('店铺名称')}</label><InputControl shell id="new-store-name" value={name} onChange={e=>setName(e.target.value)} maxLength={100} required disabled={locked}/><button className="button button--primary" disabled={disabled||Boolean(unresolved&&unresolved.kind!=='create')} aria-busy={activity==='create'}>{t(unresolved?.kind==='create'?'重试原请求':'创建并进入')}</button></form></section>
   <section className={`panel ${styles.optionalForm}`} id="join-store-form" hidden={expanded!=='join'} aria-label={t('通过邀请加入')}>{!unresolved&&<form onSubmit={event=>{event.preventDefault();void act('check');}}><label htmlFor="store-invitation">{t('邀请链接')}</label><InputControl shell id="store-invitation" value={token} onChange={e=>{setToken(e.target.value);setInvite(null);}} required disabled={locked} autoComplete="off"/><button className="button button--secondary" disabled={disabled} aria-busy={activity==='check'}>{t('核对邀请')}</button></form>}{invite?<div className={styles.applicationFact}><strong>{invite.storeName}</strong>{invite.status?<p role="status">{t(applicationStatus(invite.status))}</p>:<><p>{t('申请加入后，需门店管理员审核。')}</p>{!unresolved?<button className="button button--primary" disabled={disabled} aria-busy={activity==='apply'} onClick={()=>void act('apply')}>{t('申请加入')}</button>:null}</>}</div>:null}{unresolved?.kind==='apply'?<button className="button button--primary" disabled={disabled} aria-busy={activity==='apply'} onClick={()=>void act('apply')}>{t('重试原请求')}</button>:null}</section>
  </section>:null}<div className={styles.footer}><Link className="button button--secondary" href="/account/settings">{t('账号设置')}</Link><LogoutButton supabaseMode className="button button--secondary"/></div></main>;
}
