"use client";
import {AccountBrand} from "@/components/account/account-heading";
import styles from "./stores.module.css";
import {useCallback,useEffect,useRef,useState} from 'react';
import {InputControl} from '@/components/input-control';
import {NavigationLink as Link} from '@/components/navigation-link';
import {ContentProgress,useActivityFeedback} from '@/components/operation-feedback';
import {useLanguage} from '@/components/language-provider';
import {LogoutButton} from '@/components/dashboard/logout-button';
import {scopedStoreUrl} from '@/lib/store-scope';
import {subscribeAuthChanged} from '@/lib/auth-events';

type Store={id:string;name:string;role:string};
type Application={id:string;status:string};
type Intent={kind:'create'|'apply';value:string;id:string};
function invitationToken(value:string){if(/^[A-Za-z0-9_-]{43}$/.test(value))return value;try{const url=new URL(value);if(url.origin!==window.location.origin||url.pathname!=='/join')return '';return new URLSearchParams(url.hash.slice(1)).get('invite')??'';}catch{return '';}}
export function MyStores(){
 const {t,systemText}=useLanguage();
 const [stores,setStores]=useState<Store[]>([]),[applications,setApplications]=useState<Application[]>([]),[accountId,setAccountId]=useState(''),[name,setName]=useState(''),[token,setToken]=useState(''),[invite,setInvite]=useState<{storeName:string;status?:string}|null>(null),[busy,setBusy]=useState(false),[reading,setReading]=useState(true),[unresolved,setUnresolved]=useState<Intent|null>(null),[error,setError]=useState('');
 const lock=useRef(false),intent=useRef<Intent|null>(null),epoch=useRef(0),account=useRef('');
 const cancelEpoch=useCallback(()=>{epoch.current++;},[]);
 useActivityFeedback(busy||reading);
 async function request(url:string,body?:unknown,expected=account.current){
  const generation=epoch.current;
  const response=await fetch(url,{method:body?'POST':'GET',headers:body?{'Content-Type':'application/json','x-ct-account-id':expected}:expected?{'x-ct-account-id':expected}:{},body:body?JSON.stringify(body):undefined,cache:'no-store',signal:AbortSignal.timeout(15000)});
  const data=await response.json();
  if(generation!==epoch.current)throw new Error('登录身份已变化，请重新登录后核对原提交。');
  if(!response.ok)throw Object.assign(new Error(data.message),{status:response.status});
  return data;
 }
 useEffect(()=>{
  let live=true;const generation=++epoch.current;
  const invalidate=()=>{epoch.current++;account.current='';setStores([]);setApplications([]);setAccountId('');setInvite(null);setName('');setToken('');window.location.reload();};
  const unsubscribe=subscribeAuthChanged(invalidate);
  request('/api/account/stores').then(async data=>{
   if(!live||generation!==epoch.current)return;
   account.current=data.accountId;setAccountId(data.accountId);setStores(data.stores);setApplications(data.applications);
   let savedToken='';try{
    savedToken=new URLSearchParams(window.location.hash.slice(1)).get('invite')||sessionStorage.getItem('ct-pending-invite')||'';
    const saved=sessionStorage.getItem('ct-store-intent:'+data.accountId);if(saved){const pending=JSON.parse(saved);if(['create','apply'].includes(pending.kind)&&typeof pending.value==='string'&&typeof pending.id==='string'){intent.current=pending;setUnresolved(pending);if(pending.kind==='create')setName(pending.value);else savedToken=pending.value;}}
   }catch{/* Browsers without storage retain this mount's intent. */}
   if(savedToken){setToken(window.location.origin+'/join#invite='+savedToken);history.replaceState(null,'',window.location.pathname);const checked=await request('/api/account/store-invitations',{token:savedToken},data.accountId);if(live&&generation===epoch.current)setInvite(checked);}
  }).catch(e=>{if(live&&generation===epoch.current)setError(e.message);}).finally(()=>{if(live&&generation===epoch.current)setReading(false);});
  return()=>{live=false;cancelEpoch();unsubscribe();};
 },[cancelEpoch]);
 async function act(kind:'create'|'check'|'apply'|'refresh'){
  if(lock.current)return;lock.current=true;const generation=epoch.current;setBusy(true);setError('');
  try{
   if(kind==='refresh'){const data=await request('/api/account/stores');if(account.current&&data.accountId!==account.current){epoch.current++;setStores([]);setApplications([]);window.location.reload();return;}account.current=data.accountId;setAccountId(data.accountId);setStores(data.stores);setApplications(data.applications);return;}
   const value=kind==='create'?name:invitationToken(token);
   if(unresolved&&kind!=='check'&&(unresolved.kind!==kind||unresolved.value!==value))throw new Error('请先核对原请求，再开始新的操作。');
   if(kind!=='check'&&(intent.current?.kind!==kind||intent.current?.value!==value)){intent.current={kind,value,id:crypto.randomUUID()};try{sessionStorage.setItem('ct-store-intent:'+account.current,JSON.stringify(intent.current));setUnresolved(intent.current);}catch{throw new Error('设备恢复资料暂不可用，请稍后重试。');}}
   if(kind==='create'){
    const data=await request('/api/account/stores',{name,requestId:intent.current!.id});
    if(generation!==epoch.current)return;
    sessionStorage.removeItem('ct-store-intent:'+account.current);setUnresolved(null);
    window.location.assign(scopedStoreUrl('/app/dashboard',data.storeId));
   }else{
    const data=await request('/api/account/store-invitations',{token:invitationToken(token),...(kind==='apply'?{requestId:intent.current!.id}:{})});
    if(generation!==epoch.current)return;setInvite(data);
    if(kind==='apply'){sessionStorage.removeItem('ct-store-intent:'+account.current);sessionStorage.removeItem('ct-pending-invite');setToken('');setUnresolved(null);intent.current=null;const fresh=await request('/api/account/stores');setApplications(fresh.applications);}
   }
  }catch(e){if(generation===epoch.current&&e&&typeof e==='object'&&'status'in e&&Number(e.status)<500){sessionStorage.removeItem('ct-store-intent:'+account.current);intent.current=null;setUnresolved(null);}if(generation===epoch.current)setError(e instanceof Error?e.message:'');}finally{lock.current=false;if(generation===epoch.current)setBusy(false);}
 }
 return <main className={styles.page}><AccountBrand/><ContentProgress/><h1>{t('我的门店')}</h1>{unresolved?<p role="status">{t('提交结果待核对，请处理原提交，勿重复新建。')}</p>:null}{error?<p role="alert">{systemText(error)}</p>:null}<section className="panel"><h2>{t('已加入的门店')}</h2>{stores.length?stores.map(store=><p key={store.id}><Link className="button button--secondary" href={scopedStoreUrl('/app/dashboard',store.id)}>{store.name}</Link></p>):<p>{t('尚未加入门店')}</p>}<button className="button button--secondary" disabled={busy||reading} onClick={()=>void act('refresh')}>{t('重新检查')}</button>{applications.map(application=><p key={application.id}>{t('加入申请')} · {t(application.status==='pending'?'等待门店审核':application.status==='approved'?'已批准':'已拒绝')}</p>)}</section><section className="panel"><form onSubmit={event=>{event.preventDefault();void act('create');}}><h2>{t('创建门店')}</h2><label htmlFor="new-store-name">{t('店铺名称')}</label><InputControl id="new-store-name" value={name} onChange={e=>setName(e.target.value)} maxLength={100} required disabled={busy||Boolean(unresolved)}/><button className="button button--primary" disabled={busy||reading||!accountId} aria-busy={busy}>{t(unresolved?.kind==='create'?'重试原请求':'创建并进入')}</button></form></section><section className="panel"><form onSubmit={event=>{event.preventDefault();void act('check');}}><h2>{t('加入已有门店')}</h2><label htmlFor="store-invitation">{t('邀请链接')}</label><InputControl id="store-invitation" value={token} onChange={e=>{setToken(e.target.value);setInvite(null);}} required disabled={busy||Boolean(unresolved)} autoComplete="off"/><button className="button button--secondary" disabled={busy||reading||!accountId}>{t('核对邀请')}</button></form>{invite?<div><p>{invite.storeName}</p>{invite.status?<p role="status">{t('等待门店审核')}</p>:<button className="button button--primary" disabled={busy} onClick={()=>void act('apply')}>{t(unresolved?.kind==='apply'?'重试原请求':'申请加入')}</button>}</div>:null}</section><Link className="button button--secondary" href="/account/settings">{t('账号设置')}</Link><LogoutButton supabaseMode/></main>;
}
