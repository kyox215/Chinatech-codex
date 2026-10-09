"use client";
import { useCallback, useEffect, useRef, useState } from 'react';
import { useLanguage } from '@/components/language-provider';
import styles from "./account-settings.module.css";
type DesktopControlState = {enabled:boolean;revision:string;updatedAt:string|null;accountId:string;sessionId:string};
const errors:Record<string,string>={SERVICE_UNAVAILABLE:'桌面授权服务尚未配置或暂不可用。',NO_ACCESS:'你没有网站工具箱管理权限。',SESSION_EXPIRED:'会话已失效，请重新登录。',SESSION_INVALID:'登录会话已变化，请刷新后重试。',REQUEST_CONFLICT:'开关状态已变化，请刷新后重新核对。',INVALID_REQUEST:'请求无效。'};

class DesktopControlRequestError extends Error {}

export function OfficeDesktopControl(){
  const {t,systemText,locale}=useLanguage();
  const [data,setData]=useState<DesktopControlState|null>(null),[error,setError]=useState(''),[loading,setLoading]=useState(true),[saving,setSaving]=useState(false),[allowed,setAllowed]=useState(true);
  const [intent,setIntent]=useState<{enabled:boolean;revision:string;requestId:string;scope:string}|null>(null);
  const active=useRef<AbortController|null>(null),generation=useRef(0),busy=useRef(false);
  const refreshAfterSave=useRef(false),mounted=useRef(true);
  const load=useCallback(async()=>{
    if(busy.current)return;
    active.current?.abort();const controller=new AbortController();active.current=controller;const attempt=++generation.current;
    setLoading(true);setIntent(null);
    try{
      const response=await fetch('/api/account/toolbox/office-desktop/control',{cache:'no-store',signal:AbortSignal.any([controller.signal,AbortSignal.timeout(15000)])}),body=await response.json();
      if(controller.signal.aborted||attempt!==generation.current)return;
      if(response.status===401||response.status===403){setAllowed(false);setData(null);return;}
      if(!response.ok)throw new DesktopControlRequestError(errors[body.code] || errors.SERVICE_UNAVAILABLE);
      setData(body);setAllowed(true);setError('');
    }catch(e){if(!controller.signal.aborted&&attempt===generation.current)setError(e instanceof DesktopControlRequestError?e.message:errors.SERVICE_UNAVAILABLE);}
    finally{if(!controller.signal.aborted&&attempt===generation.current)setLoading(false);}
  },[]);
  useEffect(()=>{mounted.current=true;void Promise.resolve().then(()=>{if(mounted.current)void load();});const refresh=()=>{setIntent(null);if(document.visibilityState!=="visible")return;if(busy.current){generation.current+=1;setData(null);setLoading(true);refreshAfterSave.current=true;}else void load();};window.addEventListener("focus",refresh);window.addEventListener("online",refresh);return()=>{mounted.current=false;generation.current+=1;active.current?.abort();window.removeEventListener("focus",refresh);window.removeEventListener("online",refresh);};},[load]);
  async function save(){
    if(!data||!intent||busy.current||intent.scope!==data.accountId+':'+data.sessionId)return;
    busy.current=true;setSaving(true);setError('');const attempt=++generation.current;
    try{
      const response=await fetch('/api/account/toolbox/office-desktop/control',{method:'PATCH',cache:'no-store',headers:{'Content-Type':'application/json','X-CT-Account-ID':data.accountId,'X-CT-Session-ID':data.sessionId},body:JSON.stringify({enabled:intent.enabled,expectedRevision:intent.revision,requestId:intent.requestId}),signal:AbortSignal.timeout(15000)});
      const body=await response.json();if(attempt!==generation.current)return;
      if(!response.ok){if([401,403].includes(response.status)){setAllowed(false);setData(null);setIntent(null);}if(response.status===409)setIntent(null);throw new DesktopControlRequestError(errors[body.code] || '无法确认保存结果，请刷新核对。');}
      if(intent.scope!==body.accountId+':'+body.sessionId)throw new DesktopControlRequestError(errors.SESSION_INVALID);setData(body);setIntent(null);
    }catch(e){if(attempt===generation.current)setError(e instanceof DesktopControlRequestError?e.message:'无法确认保存结果，请刷新核对。');}
    finally{busy.current=false;if(mounted.current){setSaving(false);if(refreshAfterSave.current){refreshAfterSave.current=false;void load();}}}
  }
  if(!allowed)return null;
  return <section id="office-desktop-control" className={`panel ${styles.card}`} aria-labelledby="office-desktop-control-title" aria-busy={loading||saving}>
    <div className={styles.cardHead}><h2 id="office-desktop-control-title">{t('桌面助手新解锁开关')}</h2></div>
    <div className={styles.form}>
      <p className={styles.muted}>{t('关闭只禁止新的解锁，已经解锁的助手可继续使用到会话到期，最长 1 小时。')}</p>
      {loading&&!data?<p role="status">{t('正在读取桌面助手开关…')}</p>:null}
      {data?<><p>{t('允许新的助手解锁')}：<strong>{t(data.enabled?'已开启':'已关闭')}</strong></p><p className={styles.muted}>{t('停用密钥或关闭 Office 总开关会撤销已有会话的新操作权限；正在执行的任务仍可完成。')}</p>{data.updatedAt?<p className={styles.muted}>{t('最近开关变更')}：{new Date(data.updatedAt).toLocaleString(locale)}</p>:null}
      <button type="button" className="button button--primary" disabled={loading||saving||!!error} onClick={()=>setIntent({enabled:!data.enabled,revision:data.revision,requestId:crypto.randomUUID(),scope:data.accountId+':'+data.sessionId})}>{t(data.enabled?'暂停新的助手解锁':'允许新的助手解锁')}</button></>:null}
      {error?<p role="alert" className="form-error">{systemText(error)}</p>:null}
      <button type="button" className="button button--secondary" disabled={saving||loading} onClick={()=>void load()}>{t('刷新状态')}</button>
      {intent?<div role="group" aria-label={t('确认桌面助手开关变更')}><p>{t(intent.enabled?'将允许新的助手解锁；仍需有效密钥和可用的 Office 总服务。':'将暂停新的助手解锁，已有有效会话继续使用，正在执行的任务允许完成。')}</p><button type="button" className="button button--primary" disabled={saving} onClick={()=>void save()}>{t(saving?'正在保存…':'确认变更')}</button><button type="button" className="button button--secondary" disabled={saving} onClick={()=>setIntent(null)}>{t('取消')}</button></div>:null}
    </div>
  </section>;
}
