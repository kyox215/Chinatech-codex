"use client";
import Image from 'next/image';
import styles from './stores.module.css';
import {useEffect,useRef,useState} from 'react';
import {useBackendState} from '@/components/backend-snapshot';
import {useLanguage} from '@/components/language-provider';
import {PageTitle} from '@/components/page-title';
import {InputControl} from '@/components/input-control';
import {useActivityFeedback} from '@/components/operation-feedback';
import {can,staffRoles,rolePermissions,permissionLabels,type Permission,type StaffRole} from '@/lib/staff';
import {SelectControl} from '@/components/select-control';
import {MultiChoice} from '@/components/multi-choice';
import {backendSnapshot,refreshBackend} from '@/lib/backend/client';
import {storeViewScope} from '@/lib/store-scope';
import {subscribeAuthChanged} from '@/lib/auth-events';
import {Toast} from '@/components/toast';
import {reviewPermissions} from '@/lib/store-review';
import {readStoreJson} from '@/lib/store-request';

type Usage={usedBytes:number;reservedBytes:number;limitBytes:number;memberCount:number;memberLimit:number;planVersion:string;warning:boolean;sampledAt:string;recordCounts:{repairs:number|null;procurement:number|null;customers:number|null;retail:number|null}};
type Page={totalCount:number;nextCursor:string|null;hasMore:boolean};
type Invitation={id:string;expires_at:string;status:'active'|'consumed'|'revoked'|'expired'};
type Application={id:string;status:string;display_name:string;email:string;created_at:string};
type Filter='pending'|'history';
type Admission={invitations:Invitation[];applications:Application[];invitationPage:Page;applicationPage:Page&{status:Filter;pendingCount:number;historyCount:number}};
type Pending={key:string;id:string;path:string;body:Record<string,unknown>};
type View={scope:string;usage:Usage|null;admission:Admission|null;accountId:string;sessionId:string;link:string;linkId:string;qr:string;error:string;reading:boolean;busy:boolean;waiting:boolean;filter:Filter;toast:string;pending:Pending|null};
const emptyView=(scope:string):View=>({scope,usage:null,admission:null,accountId:'',sessionId:'',link:'',linkId:'',qr:'',error:'',reading:true,busy:false,waiting:false,filter:'pending',toast:'',pending:null});
const unique=<T extends {id:string}>(previous:T[],next:T[])=>[...new Map([...previous,...next].map(row=>[row.id,row])).values()];
const invitationStatus={active:'待使用',consumed:'已使用',revoked:'已撤销',expired:'已过期'};

export function StoreManagement(){
 const {snapshot}=useBackendState(),{t,systemText,locale}=useLanguage();
 const storeId=snapshot?.storeId,member=snapshot?.staff.members.find(row=>row.id===snapshot.staff.currentId),manage=can(member,'staff.manage');
 const baseScope=storeViewScope(snapshot),[authRevision,setAuthRevision]=useState(0),authEpoch=useRef(0),scope=baseScope+':'+authRevision;
 const [view,setView]=useState(()=>emptyView(scope)),[retry,setRetry]=useState(0);
 const shown=view.scope===scope?view:emptyView(scope);
 const lock=useRef(false),pending=useRef<Pending|null>(null),readSequence=useRef(0);
 const storageKey='ct-store-management:'+storeId+':'+member?.id;
 const isCurrent=()=>Boolean(baseScope)&&authEpoch.current===authRevision&&storeViewScope(backendSnapshot())===baseScope;
 const publish=(patch:Partial<View>)=>{if(isCurrent())setView(previous=>({...previous.scope===scope?previous:emptyView(scope),...patch,scope}));};
 useActivityFeedback(shown.reading||shown.busy);
 useEffect(()=>subscribeAuthChanged(()=>{authEpoch.current++;readSequence.current++;pending.current=null;setAuthRevision(authEpoch.current);}),[]);
 async function request(path:string,body?:unknown){
  if(!isCurrent())throw new Error('登录身份已变化，请重新登录后核对原提交。');
  const {response,data}=await readStoreJson(path,{method:body?'POST':'GET',headers:{'x-ct-store-id':storeId??'','x-ct-account-id':shown.accountId,...(body?{'Content-Type':'application/json'}:{})},body:body?JSON.stringify(body):undefined,cache:'no-store',signal:AbortSignal.timeout(15000)},body?'请求结果尚未确认。请核对账号状态后重试，输入已保留。':undefined);
  if(!isCurrent())throw new Error('登录身份已变化，请重新登录后核对原提交。');
  if(!response.ok)throw Object.assign(new Error(data.message),{status:response.status});
  if(data.accountId&&(data.accountId!==shown.accountId||data.sessionId!==shown.sessionId))throw new Error('登录身份已变化，请重新登录后核对原提交。');
  return data;
 }
 async function reload(filter:Filter=shown.filter){
  const sequence=++readSequence.current;
  const [usage,admission]=await Promise.all([request('/api/backend/store-usage'),manage?request('/api/backend/store-invitations?applicationStatus='+filter):Promise.resolve(null)]);
  if(sequence===readSequence.current)publish({usage,admission,filter});
 }
 useEffect(()=>{
  const controller=new AbortController();readSequence.current++;
  const read=async(path:string)=>{const {response,data}=await readStoreJson(path,{headers:{'x-ct-store-id':storeId??''},cache:'no-store',signal:AbortSignal.any([controller.signal,AbortSignal.timeout(15000)])});if(!response.ok)throw new Error(data.message);return data;};
  Promise.all([read('/api/account/stores'),read('/api/backend/store-usage'),manage?read('/api/backend/store-invitations'):Promise.resolve(null)]).then(([account,usage,admission])=>{
   if(controller.signal.aborted||authEpoch.current!==authRevision||storeViewScope(backendSnapshot())!==baseScope)return;
   let restored:Pending|null=null;try{const raw=sessionStorage.getItem(storageKey);if(raw){const saved=JSON.parse(raw);if(typeof saved.key==='string'&&typeof saved.id==='string'&&['/api/backend/store-invitations','/api/backend/store-applications'].includes(saved.path)&&saved.body&&typeof saved.body==='object')restored=saved;}}catch{/* A submit refuses when recovery storage is unavailable. */}
   pending.current=restored;setView({...emptyView(scope),accountId:account.accountId,sessionId:account.sessionId,usage,admission,reading:false,waiting:Boolean(restored),pending:restored});
  }).catch(error=>{if(!controller.signal.aborted&&authEpoch.current===authRevision&&storeViewScope(backendSnapshot())===baseScope)setView({...emptyView(scope),reading:false,error:error.message});});
  return()=>{controller.abort();};
 },[storeId,manage,scope,baseScope,authRevision,storageKey,retry]);
 async function readMore(kind:'applications'|'invitations'){
  if(lock.current||!shown.admission||!isCurrent())return;
  const cursor=kind==='applications'?shown.admission.applicationPage.nextCursor:shown.admission.invitationPage.nextCursor;if(!cursor)return;
  lock.current=true;publish({busy:true,error:''});const sequence=readSequence.current,filter=shown.filter;
  try{
   const data:Admission=await request('/api/backend/store-invitations?applicationStatus='+filter+'&'+(kind==='applications'?'applicationCursor':'invitationCursor')+'='+encodeURIComponent(cursor));
   if(sequence!==readSequence.current||!isCurrent())return;
   setView(previous=>{if(previous.scope!==scope||previous.filter!==filter||!previous.admission)return previous;const current=previous.admission;return{...previous,admission:{...current,invitations:kind==='invitations'?unique(current.invitations,data.invitations):current.invitations,applications:kind==='applications'?unique(current.applications,data.applications):current.applications,invitationPage:kind==='invitations'?data.invitationPage:current.invitationPage,applicationPage:kind==='applications'?data.applicationPage:{...current.applicationPage,pendingCount:data.applicationPage.pendingCount,historyCount:data.applicationPage.historyCount}}};});
  }catch(error){publish({error:error instanceof Error?error.message:''});}finally{lock.current=false;publish({busy:false});}
 }
 async function filterApplications(filter:Filter){if(lock.current)return;lock.current=true;publish({busy:true,error:''});try{await reload(filter);}catch(error){publish({error:error instanceof Error?error.message:''});}finally{lock.current=false;publish({busy:false});}}
 async function copyLink(){if(lock.current||!shown.link)return;lock.current=true;publish({busy:true,error:'',toast:''});try{await navigator.clipboard.writeText(shown.link);publish({toast:'邀请链接已复制。'});}catch{publish({error:'无法复制链接，请手动复制邀请链接。'});}finally{lock.current=false;publish({busy:false});}}
 async function act(key:string,path:string,body:Record<string,unknown>){
  if(lock.current||!isCurrent())return;lock.current=true;publish({busy:true,error:''});
  try{
   if(!pending.current){if(shown.waiting)throw new Error('请先核对原请求，再开始新的操作。');const next={key,id:crypto.randomUUID(),path,body};sessionStorage.setItem(storageKey,JSON.stringify(next));pending.current=next;}
   if(pending.current.key!==key)throw new Error('请先核对原请求，再开始新的操作。');
   publish({waiting:true,pending:pending.current});const original=pending.current,data=await request(original.path,{...original.body,requestId:original.id});
   if(!isCurrent())return;
   if(data.token){
    const link=window.location.origin+'/join#invite='+data.token,{MultiFormatWriter,BarcodeFormat}=await import('@zxing/library');if(!isCurrent())return;
    const matrix=new MultiFormatWriter().encode(link,BarcodeFormat.QR_CODE,0,0,new Map());let cells='';for(let y=0;y<matrix.getHeight();y++)for(let x=0;x<matrix.getWidth();x++)if(matrix.get(x,y))cells+=`M${x} ${y}h1v1h-1z`;
    const qr=`<svg xmlns="http://www.w3.org/2000/svg" viewBox="-4 -4 ${matrix.getWidth()+8} ${matrix.getHeight()+8}"><rect x="-4" y="-4" width="100%" height="100%" fill="white"/><path d="${cells}"/></svg>`;publish({link,linkId:data.id,qr});
   }
   if(original.body.action==='revoke'&&original.body.id===shown.linkId)publish({link:'',linkId:'',qr:''});
   pending.current=null;sessionStorage.removeItem(storageKey);publish({waiting:false,pending:null,toast:'操作已完成。'});await reload();await refreshBackend();
  }catch(error){if(isCurrent()){if(error&&typeof error==='object'&&'status'in error&&Number(error.status)<500){pending.current=null;sessionStorage.removeItem(storageKey);publish({waiting:false,pending:null});}publish({error:error instanceof Error?error.message:''});}}
  finally{lock.current=false;publish({busy:false});}
 }
 if(!snapshot)return <p role="alert">{t('账号状态暂不可用')}</p>;
 const disabled=shown.reading||shown.busy||shown.waiting||!shown.accountId,admission=shown.admission,original=shown.waiting?shown.pending:null;
 const originalRole=original&&typeof original.body.role==='string'&&Object.hasOwn(staffRoles,original.body.role)?original.body.role as StaffRole:null;
 const originalPermissions=original&&Array.isArray(original.body.permissions)?original.body.permissions.filter((p):p is Permission=>typeof p==='string'&&Object.hasOwn(permissionLabels,p)):[];
 const date=(value:string)=>new Date(value).toLocaleString(locale);
 return <><PageTitle title={t('门店容量与邀请')}/><div className={styles.page} aria-busy={shown.reading||shown.busy}>
  {shown.toast?<Toast message={t(shown.toast)} onDismiss={()=>publish({toast:''})}/>:null}
  {shown.error?<div><p className="form-error" role="alert">{systemText(shown.error)}</p><button className="button button--secondary" disabled={shown.busy||shown.reading} onClick={()=>{publish({reading:true});setRetry(value=>value+1);}}>{t('重新检查')}</button></div>:null}
  {shown.waiting?<section className={`panel ${styles.applicationFact}`}><h2>{t('核对原提交')}</h2><p role="status">{t('提交结果待核对，请处理原提交，勿重复新建。')}</p>{original?<><p>{t('原提交')}：{t(original.body.action==='approve'?'确认批准':original.body.action==='reject'?'拒绝申请':original.body.action==='revoke'?'撤销邀请':'生成邀请链接')} · {String(original.body.id??original.id)}</p><p>{t('原请求标识')}：{original.id}</p>{originalRole?<p>{t('员工角色')}：{t(staffRoles[originalRole])} · {t('允许的操作')}：{originalPermissions.map(p=>t(permissionLabels[p])).join(' · ')}</p>:null}</>:null}<button className="button button--secondary" disabled={shown.busy||shown.reading||!shown.accountId||!manage} onClick={()=>{const original=pending.current;if(original)void act(original.key,original.path,original.body);}}>{t('重试原请求')}</button></section>:null}
  <section className="panel"><div className={styles.heading}><h2>{snapshot.settings.shopName}</h2><span>{t('免费内测')}</span></div>{shown.usage?<><div className={styles.capacityGrid}><div><span>{t('附件容量')}</span><strong>{(shown.usage.usedBytes/1e6).toFixed(2)} / {(shown.usage.limitBytes/1e6).toFixed(0)} MB</strong></div><div><span>{t('预留容量')}</span><strong>{(shown.usage.reservedBytes/1e6).toFixed(2)} MB</strong></div><div><span>{t('有效成员')}</span><strong>{shown.usage.memberCount} / {shown.usage.memberLimit}</strong></div><div><span>{t('业务记录')}</span><p>{Object.entries(shown.usage.recordCounts).filter(([,count])=>count!==null).map(([key,count])=>t(({repairs:'维修工单',procurement:'采购与到货',customers:'客户管理',retail:'整机商品'} as Record<string,string>)[key])+' '+count).join(' · ')}</p></div></div><progress aria-label={t('附件容量')} max={shown.usage.limitBytes||1} value={Math.min(shown.usage.usedBytes+shown.usage.reservedBytes,shown.usage.limitBytes)}/>{shown.usage.warning?<p role="status">{t('容量即将用满，请联系平台调整额度。')}</p>:null}</>:<p>{t('正在读取门店用量…')}</p>}</section>
  {manage?<><section className="panel"><div className={styles.heading}><h2>{t('邀请员工')}</h2><button className="button button--primary" disabled={disabled} onClick={()=>void act('invite','/api/backend/store-invitations',{})}>{t('生成邀请链接')}</button></div>{shown.link?<div className={styles.inviteOutput}><label htmlFor="store-invite-link">{t('邀请链接')}</label><InputControl shell id="store-invite-link" value={shown.link} readOnly/><div className={styles.actions}><button className="button button--secondary" disabled={disabled} onClick={()=>void copyLink()}>{t('复制链接')}</button><button className="button button--secondary" disabled={disabled} onClick={()=>void act('revoke:'+shown.linkId,'/api/backend/store-invitations',{action:'revoke',id:shown.linkId})}>{t('撤销邀请')}</button></div>{shown.qr?<Image unoptimized src={'data:image/svg+xml,'+encodeURIComponent(shown.qr)} alt={t('邀请二维码')} width={180} height={180}/>:null}</div>:null}{admission?.invitations.map(invitation=><div className={styles.invitationRow} key={invitation.id}><div><p>{t(invitationStatus[invitation.status])} · <time dateTime={invitation.expires_at}>{date(invitation.expires_at)}</time></p></div><button className="button button--secondary" disabled={disabled||invitation.status==='revoked'} onClick={()=>void act('revoke:'+invitation.id,'/api/backend/store-invitations',{action:'revoke',id:invitation.id})}>{t('撤销邀请')}</button></div>)}{admission?.invitationPage.hasMore?<button className="button button--secondary" disabled={disabled} onClick={()=>void readMore('invitations')}>{t('加载更多邀请')}</button>:null}</section>
  <section className="panel"><div className={styles.actions} role="group" aria-label={t('加入申请')}><button className="button button--secondary" aria-pressed={shown.filter==='pending'} disabled={disabled} onClick={()=>void filterApplications('pending')}>{t('待审核')} · {admission?.applicationPage.pendingCount??0}</button><button className="button button--secondary" aria-pressed={shown.filter==='history'} disabled={disabled} onClick={()=>void filterApplications('history')}>{t('申请历史')} · {admission?.applicationPage.historyCount??0}</button></div>{admission?.applications.length?admission.applications.map(application=><article className={styles.applicationFact} key={application.id}><strong>{application.display_name||application.email}</strong><p>{application.email}</p><p>{t(application.status==='pending'?'等待门店审核':application.status==='approved'?'已批准':'已拒绝')} · <time dateTime={application.created_at}>{date(application.created_at)}</time></p>{application.status==='pending'?<ApplicationReview original={originalRole&&original?.body.id===application.id?{role:originalRole,permissions:originalPermissions}:undefined} disabled={disabled} allowed={member?.permissions??[]} owner={member?.role==='owner'} onReview={(action,role,permissions)=>void act(action+':'+application.id,'/api/backend/store-applications',{action,id:application.id,role,permissions})}/>:null}</article>):<p>{t('暂无加入申请')}</p>}{admission?.applicationPage.hasMore?<button className="button button--secondary" disabled={disabled} onClick={()=>void readMore('applications')}>{t('加载更多申请')}</button>:null}</section></>:null}
 </div></>;
}

function ApplicationReview({disabled,allowed,owner,original,onReview}:{original?:{role:StaffRole;permissions:Permission[]};disabled:boolean;allowed:Permission[];owner:boolean;onReview:(action:string,role:StaffRole,permissions:Permission[])=>void}){
 const {t}=useLanguage();const [role,setRole]=useState<StaffRole>('viewer'),[permissions,setPermissions]=useState<Permission[]>(()=>reviewPermissions(rolePermissions('viewer'),allowed,owner));
 const selected=original?.permissions??reviewPermissions(permissions,allowed,owner);
 const selectedRole=original?.role??role;
 const options=[...new Set([...allowed.filter(p=>owner||p!=='staff.manage'),...(original?.permissions??[])])].map(p=>({value:p,label:permissionLabels[p]}));
 return <div className={styles.application}><fieldset disabled={disabled}><label>{t('员工角色')}<SelectControl value={selectedRole} onChange={e=>{const next=e.target.value as StaffRole;setRole(next);setPermissions(reviewPermissions(rolePermissions(next),allowed,owner));}}>{Object.entries(staffRoles).filter(([value])=>value!=='owner').map(([value,label])=><option key={value} value={value}>{t(label)}</option>)}</SelectControl></label><MultiChoice label="允许的操作" options={options} values={selected} onChange={values=>setPermissions(values as Permission[])}/><div className={styles.actions}><button className="button button--primary" onClick={()=>onReview('approve',selectedRole,selected)}>{t('确认批准')}</button><button className="button button--secondary" onClick={()=>onReview('reject',selectedRole,selected)}>{t('拒绝申请')}</button></div></fieldset></div>;
}
