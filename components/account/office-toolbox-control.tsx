"use client";
import { useCallback, useEffect, useRef, useState } from 'react';
import { useLanguage } from '@/components/language-provider';
import styles from "./account-settings.module.css";
import type { OfficeAdminState } from '@/lib/toolbox/office-server';

class OfficeControlRequestError extends Error {}

export function OfficeToolboxControl(){
  const {t,systemText}=useLanguage();
  const [data,setData]=useState<OfficeAdminState|null>(null),[error,setError]=useState(''),[loading,setLoading]=useState(true),[saving,setSaving]=useState(false),[allowed,setAllowed]=useState(true);
  const [intent,setIntent]=useState<{enabled:boolean;revision:string;requestId:string;scope:string}|null>(null);
  const active=useRef<AbortController|null>(null),generation=useRef(0),busy=useRef(false);
  const refreshAfterSave=useRef(false),mounted=useRef(true);
  const load=useCallback(async()=>{
    if(busy.current)return;
    active.current?.abort();const controller=new AbortController();active.current=controller;const attempt=++generation.current;
    setLoading(true);setIntent(null);
    try{
      const response=await fetch('/api/account/toolbox/office',{cache:'no-store',signal:AbortSignal.any([controller.signal,AbortSignal.timeout(15000)])}),body=await response.json();
      if(controller.signal.aborted||attempt!==generation.current)return;
      if(response.status===401||response.status===403){setAllowed(false);setData(null);return;}
      if(!response.ok)throw new OfficeControlRequestError(body.message || '工具箱状态暂不可用。');
      setData(body);setAllowed(true);setError('');
    }catch(e){if(!controller.signal.aborted&&attempt===generation.current)setError(e instanceof OfficeControlRequestError?e.message:'工具箱状态暂不可用。');}
    finally{if(!controller.signal.aborted&&attempt===generation.current)setLoading(false);}
  },[]);
  useEffect(()=>{mounted.current=true;void Promise.resolve().then(()=>{if(mounted.current)void load();});const refresh=()=>{setIntent(null);if(document.visibilityState!=="visible")return;if(busy.current){generation.current+=1;setData(null);setLoading(true);refreshAfterSave.current=true;}else void load();};window.addEventListener("focus",refresh);window.addEventListener("online",refresh);return()=>{mounted.current=false;generation.current+=1;active.current?.abort();window.removeEventListener("focus",refresh);window.removeEventListener("online",refresh);};},[load]);
  async function save(){
    if(!data||!intent||busy.current||intent.scope!==data.accountId+':'+data.sessionId)return;
    busy.current=true;setSaving(true);setError('');const attempt=++generation.current;
    try{
      const response=await fetch('/api/account/toolbox/office',{method:'PATCH',cache:'no-store',headers:{'Content-Type':'application/json','X-CT-Account-ID':data.accountId,'X-CT-Session-ID':data.sessionId},body:JSON.stringify({enabled:intent.enabled,expectedRevision:intent.revision,requestId:intent.requestId}),signal:AbortSignal.timeout(15000)});
      const body=await response.json();if(attempt!==generation.current)return;
      if(!response.ok){if([401,403].includes(response.status)){setAllowed(false);setData(null);setIntent(null);}if(response.status===409)setIntent(null);throw new OfficeControlRequestError(body.message || '无法确认保存结果，请刷新核对。');}
      setData(body);setIntent(null);
    }catch(e){if(attempt===generation.current)setError(e instanceof OfficeControlRequestError?e.message:'无法确认保存结果，请刷新核对。');}
    finally{busy.current=false;if(mounted.current){setSaving(false);if(refreshAfterSave.current){refreshAfterSave.current=false;void load();}}}
  }
  if(!allowed)return null;
  return <section id="office-toolbox" className={`panel ${styles.card}`} aria-labelledby="office-management-title" aria-busy={loading||saving}>
    <div className={styles.cardHead}><h2 id="office-management-title">{t('网站工具箱管理')}</h2></div>
    <div className={styles.form}>
      <p className={styles.muted}>{t('此总开关控制网站 Office 命令和桌面助手授权；关闭会禁止已有会话的新操作。')}</p>
      {loading&&!data?<p role="status">{t('正在读取工具箱状态…')}</p>:null}
      {data?<><p>{t('Office 命令状态')}：<strong>{t(data.enabled?'已开启':'已关闭')}</strong></p><p className={styles.muted}>{t('关闭后当前全部新版命令失效，重新开启需要生成新命令。已开始的操作不会被强制中断。')}</p>{!data.keyConfigured?<p role="alert">{t('签名服务尚未配置，不能开启命令。')}</p>:null}
      <button type="button" className="button button--primary" disabled={loading||saving||!!error||(!data.enabled&&!data.keyConfigured)} onClick={()=>setIntent({enabled:!data.enabled,revision:data.revision,requestId:crypto.randomUUID(),scope:data.accountId+':'+data.sessionId})}>{t(data.enabled?'关闭并作废当前命令':'开启 Office 命令')}</button></>:null}
      {error?<p role="alert" className="form-error">{systemText(error)}</p>:null}
      <button type="button" className="button button--secondary" disabled={saving||loading} onClick={()=>void load()}>{t('刷新状态')}</button>
      {intent?<div role="group" aria-label={t('确认工具箱开关变更')}><p>{t(intent.enabled?'开启后可生成新命令，旧命令不会恢复。':'将关闭全站 Office 命令，并作废当前全部新版命令。')}</p><button type="button" className="button button--primary" disabled={saving} onClick={()=>void save()}>{t(saving?'正在保存…':'确认变更')}</button><button type="button" className="button button--secondary" disabled={saving} onClick={()=>setIntent(null)}>{t('取消')}</button></div>:null}
    </div>
  </section>;
}
