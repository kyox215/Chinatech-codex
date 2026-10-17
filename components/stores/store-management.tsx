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

type Usage={usedBytes:number;reservedBytes:number;limitBytes:number;memberCount:number;memberLimit:number;planVersion:string;warning:boolean;sampledAt:string;recordCounts:{repairs:number|null;procurement:number|null;customers:number|null;retail:number|null}};
type Admission={invitations:{id:string;expires_at:string;revoked_at:string|null;consumed_at:string|null}[];applications:{id:string;status:string;display_name:string;email:string}[]};
type Pending={key:string;id:string;path:string;body:Record<string,unknown>};
type View={scope:string;usage:Usage|null;admission:Admission|null;accountId:string;link:string;qr:string;error:string;reading:boolean;busy:boolean;waiting:boolean};
const emptyView=(scope:string):View=>({scope,usage:null,admission:null,accountId:'',link:'',qr:'',error:'',reading:true,busy:false,waiting:false});

export function StoreManagement(){
 const {snapshot}=useBackendState(),{t,systemText}=useLanguage();
 const storeId=snapshot?.storeId,member=snapshot?.staff.members.find(row=>row.id===snapshot.staff.currentId),manage=can(member,'staff.manage');
 const scope=storeViewScope(snapshot);
 const [view,setView]=useState(()=>emptyView(scope)),[retry,setRetry]=useState(0);
 // A new permission/identity scope synchronously hides all prior private facts,
 // even before passive effect cleanup. Old callbacks can only publish to theirs.
 const shown=view.scope===scope?view:emptyView(scope);
 const lock=useRef(false),pending=useRef<Pending|null>(null);
 const storageKey='ct-store-management:'+storeId+':'+member?.id;
 const isCurrent=()=>Boolean(scope)&&storeViewScope(backendSnapshot())===scope;
 const publish=(patch:Partial<View>)=>{if(isCurrent())setView(previous=>({...previous.scope===scope?previous:emptyView(scope),...patch,scope}));};
 useActivityFeedback(shown.reading||shown.busy);
 async function request(path:string,body?:unknown){
  if(!isCurrent())throw new Error('登录身份已变化，请重新登录后核对原提交。');
  const response=await fetch(path,{method:body?'POST':'GET',headers:{'x-ct-store-id':storeId??'','x-ct-account-id':shown.accountId,...(body?{'Content-Type':'application/json'}:{})},body:body?JSON.stringify(body):undefined,cache:'no-store',signal:AbortSignal.timeout(15000)});
  const data=await response.json();
  if(!isCurrent())throw new Error('登录身份已变化，请重新登录后核对原提交。');
  if(!response.ok)throw Object.assign(new Error(data.message),{status:response.status});
  return data;
 }
 async function reload(){const [usage,admission]=await Promise.all([request('/api/backend/store-usage'),manage?request('/api/backend/store-invitations'):Promise.resolve(null)]);publish({usage,admission});}
 useEffect(()=>{
  const controller=new AbortController();
  const read=async(path:string)=>{const response=await fetch(path,{headers:{'x-ct-store-id':storeId??''},cache:'no-store',signal:AbortSignal.any([controller.signal,AbortSignal.timeout(15000)])});const data=await response.json();if(!response.ok)throw new Error(data.message);return data;};
  Promise.all([read('/api/account/stores'),read('/api/backend/store-usage'),manage?read('/api/backend/store-invitations'):Promise.resolve(null)]).then(([account,usage,admission])=>{
   if(controller.signal.aborted||storeViewScope(backendSnapshot())!==scope)return;
   let restored:Pending|null=null;try{const raw=sessionStorage.getItem(storageKey);if(raw)restored=JSON.parse(raw);}catch{/* A submit refuses when recovery storage is unavailable. */}
   pending.current=restored;
   setView({...emptyView(scope),accountId:account.accountId,usage,admission,reading:false,waiting:Boolean(restored)});
  }).catch(error=>{if(!controller.signal.aborted&&storeViewScope(backendSnapshot())===scope)setView({...emptyView(scope),reading:false,error:error.message});});
  return()=>{controller.abort();};
 },[storeId,manage,scope,storageKey,retry]);
 async function act(key:string,path:string,body:Record<string,unknown>){
  if(lock.current||!isCurrent())return;
  lock.current=true;publish({busy:true,error:''});
  try{
   if(pending.current?.key!==key){if(shown.waiting)throw new Error('请先核对原请求，再开始新的操作。');pending.current={key,id:crypto.randomUUID(),path,body};sessionStorage.setItem(storageKey,JSON.stringify(pending.current));}
   publish({waiting:true});
   const data=await request(path,{...body,requestId:pending.current.id});
   if(!isCurrent())return;
   if(data.token){
    const link=window.location.origin+'/join#invite='+data.token;
    const {MultiFormatWriter,BarcodeFormat}=await import('@zxing/library');
    if(!isCurrent())return;
    const matrix=new MultiFormatWriter().encode(link,BarcodeFormat.QR_CODE,0,0,new Map());let cells='';
    for(let y=0;y<matrix.getHeight();y++)for(let x=0;x<matrix.getWidth();x++)if(matrix.get(x,y))cells+=`M${x} ${y}h1v1h-1z`;
    const qr=`<svg xmlns="http://www.w3.org/2000/svg" viewBox="-4 -4 ${matrix.getWidth()+8} ${matrix.getHeight()+8}"><rect x="-4" y="-4" width="100%" height="100%" fill="white"/><path d="${cells}"/></svg>`;
    publish({link,qr});
   }
   pending.current=null;sessionStorage.removeItem(storageKey);publish({waiting:false});await reload();await refreshBackend();
  }catch(error){
   if(isCurrent()){
    if(error&&typeof error==='object'&&'status'in error&&Number(error.status)<500){pending.current=null;sessionStorage.removeItem(storageKey);publish({waiting:false});}
    publish({error:error instanceof Error?error.message:''});
   }
  }finally{lock.current=false;publish({busy:false});}
 }
 if(!snapshot)return <p role="alert">{t('账号状态暂不可用')}</p>;
 const disabled=shown.reading||shown.busy||shown.waiting||!shown.accountId;
 return <><PageTitle title={t('门店容量与邀请')}/><div className={styles.page} aria-busy={shown.reading||shown.busy}>
  {shown.error?<div><p role="alert">{systemText(shown.error)}</p><button className="button button--secondary" disabled={shown.busy||shown.reading} onClick={()=>{publish({reading:true});setRetry(value=>value+1);}}>{t('重新检查')}</button></div>:null}
  {shown.waiting?<div><p role="status">{t('提交结果待核对，请处理原提交，勿重复新建。')}</p><button className="button button--secondary" disabled={shown.busy||shown.reading||!shown.accountId||!manage} onClick={()=>{const original=pending.current;if(original)void act(original.key,original.path,original.body);}}>{t('重试原请求')}</button></div>:null}
  <section className="panel"><h2>{snapshot.storeName??snapshot.settings?.shopName??t('门店账号')}</h2>{shown.usage?<><p>{t('免费内测')}</p><p>{t('附件容量')}：{(shown.usage.usedBytes/1e6).toFixed(2)} / {(shown.usage.limitBytes/1e6).toFixed(0)} MB</p><p>{t('预留容量')}：{(shown.usage.reservedBytes/1e6).toFixed(2)} MB</p><progress aria-label={t('附件容量')} max={shown.usage.limitBytes||1} value={Math.min(shown.usage.usedBytes+shown.usage.reservedBytes,shown.usage.limitBytes)}/><p>{t('有效成员')}：{shown.usage.memberCount} / {shown.usage.memberLimit}</p><p>{t('业务记录')}：{Object.entries(shown.usage.recordCounts).filter(([,count])=>count!==null).map(([key,count])=>t(({repairs:'维修工单',procurement:'采购与到货',customers:'客户管理',retail:'整机商品'} as Record<string,string>)[key])+' '+count).join(' · ')}</p>{shown.usage.warning?<p role="status">{t('容量即将用满，请联系平台调整额度。')}</p>:null}</>:<p>{t('正在读取门店用量…')}</p>}</section>
  {manage?<><section className="panel"><h2>{t('邀请员工')}</h2><button className="button button--primary" disabled={disabled} onClick={()=>void act('invite','/api/backend/store-invitations',{})}>{t('生成邀请链接')}</button>{shown.link?<><label htmlFor="store-invite-link">{t('邀请链接')}</label><InputControl id="store-invite-link" value={shown.link} readOnly/>{shown.qr?<Image unoptimized src={'data:image/svg+xml,'+encodeURIComponent(shown.qr)} alt={t('邀请二维码')} width={180} height={180}/>:null}</>:null}{shown.admission?.invitations.map(invitation=><p key={invitation.id}>{new Date(invitation.expires_at).toLocaleDateString()} · {t(invitation.revoked_at?'已撤销':invitation.consumed_at?'已使用':'待使用')} <button className="button button--secondary" disabled={disabled||Boolean(invitation.revoked_at)} onClick={()=>void act('revoke:'+invitation.id,'/api/backend/store-invitations',{action:'revoke',id:invitation.id})}>{t('撤销邀请')}</button></p>)}</section><section className="panel"><h2>{t('加入申请')}</h2>{shown.admission?.applications.length?shown.admission.applications.map(application=><div key={application.id}><p>{application.display_name||application.email} · {application.email} · {t(application.status==='pending'?'等待门店审核':application.status==='approved'?'已批准':'已拒绝')}</p>{application.status==='pending'?<ApplicationReview disabled={disabled} allowed={member?.permissions??[]} owner={member?.role==='owner'} onReview={(action,role,permissions)=>void act(action+':'+application.id,'/api/backend/store-applications',{action,id:application.id,role,permissions})}/>:null}</div>):<p>{t('暂无加入申请')}</p>}</section></>:null}
 </div></>;
}

function ApplicationReview({disabled,allowed,owner,onReview}:{disabled:boolean;allowed:Permission[];owner:boolean;onReview:(action:string,role:StaffRole,permissions:Permission[])=>void}){
 const {t}=useLanguage();const [role,setRole]=useState<StaffRole>('viewer'),[permissions,setPermissions]=useState<Permission[]>(rolePermissions('viewer'));
 const options=allowed.filter(p=>owner||p!=='staff.manage').map(p=>({value:p,label:permissionLabels[p]}));
 return <div className={styles.application}><fieldset disabled={disabled}><label>{t('员工角色')}<SelectControl value={role} onChange={e=>{const next=e.target.value as StaffRole;setRole(next);setPermissions(rolePermissions(next).filter(p=>allowed.includes(p)&&(owner||p!=='staff.manage')));}}>{Object.entries(staffRoles).filter(([value])=>value!=='owner').map(([value,label])=><option key={value} value={value}>{t(label)}</option>)}</SelectControl></label><MultiChoice label="允许的操作" options={options} values={permissions} onChange={values=>setPermissions(values as Permission[])}/><div className={styles.actions}><button className="button button--primary" onClick={()=>onReview('approve',role,permissions)}>{t('确认批准')}</button><button className="button button--secondary" onClick={()=>onReview('reject',role,permissions)}>{t('拒绝申请')}</button></div></fieldset></div>;
}
