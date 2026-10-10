"use client";
import { useCallback, useEffect, useRef, useState } from 'react';
import { SelectControl } from '@/components/select-control';
import { useLanguage } from '@/components/language-provider';
import styles from "./account-settings.module.css";
type DesktopControlState = {enabled:boolean;revision:string;updatedAt:string|null;accountId:string;sessionId:string;minimumVersion:string;currentVersion:string;eligibleMinimumVersions:string[]};
const errors:Record<string,string>={SERVICE_UNAVAILABLE:'桌面授权服务尚未配置或暂不可用。',NO_ACCESS:'你没有网站工具箱管理权限。',SESSION_EXPIRED:'会话已失效，请重新登录。',SESSION_INVALID:'登录会话已变化，请刷新后重试。',REQUEST_CONFLICT:'开关状态已变化，请刷新后重新核对。',INVALID_REQUEST:'请求无效。',VERSION_NOT_AVAILABLE:'所选版本尚未发布或完成校验，请刷新后重试。'};

class DesktopControlRequestError extends Error {}

export function OfficeDesktopControl(){
  const {t,systemText,locale}=useLanguage();
  const [data,setData]=useState<DesktopControlState|null>(null),[error,setError]=useState(''),[loading,setLoading]=useState(true),[saving,setSaving]=useState(false),[allowed,setAllowed]=useState(true);
  const [intent,setIntent]=useState<{enabled:boolean;revision:string;requestId:string;scope:string;minimumVersion:string}|null>(null);
  const [minimum,setMinimum]=useState('0.0.0');
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
      setData(body);setMinimum(body.minimumVersion);setAllowed(true);setError('');
    }catch(e){if(!controller.signal.aborted&&attempt===generation.current)setError(e instanceof DesktopControlRequestError?e.message:errors.SERVICE_UNAVAILABLE);}
    finally{if(!controller.signal.aborted&&attempt===generation.current)setLoading(false);}
  },[]);
  useEffect(()=>{mounted.current=true;void Promise.resolve().then(()=>{if(mounted.current)void load();});const refresh=()=>{setIntent(null);if(document.visibilityState!=="visible")return;if(busy.current){generation.current+=1;setData(null);setLoading(true);refreshAfterSave.current=true;}else void load();};window.addEventListener("focus",refresh);window.addEventListener("online",refresh);return()=>{mounted.current=false;generation.current+=1;active.current?.abort();window.removeEventListener("focus",refresh);window.removeEventListener("online",refresh);};},[load]);
  async function save(){
    if(!data||!intent||busy.current||intent.scope!==data.accountId+':'+data.sessionId)return;
    busy.current=true;setSaving(true);setError('');const attempt=++generation.current;
    try{
      const response=await fetch('/api/account/toolbox/office-desktop/control',{method:'PATCH',cache:'no-store',headers:{'Content-Type':'application/json','X-CT-Account-ID':data.accountId,'X-CT-Session-ID':data.sessionId},body:JSON.stringify({enabled:intent.enabled,minimumVersion:intent.minimumVersion,expectedRevision:intent.revision,requestId:intent.requestId}),signal:AbortSignal.timeout(15000)});
      const body=await response.json();if(attempt!==generation.current)return;
      if(!response.ok){if([401,403].includes(response.status)){setAllowed(false);setData(null);setIntent(null);}if(response.status===409)setIntent(null);throw new DesktopControlRequestError(errors[body.code] || '无法确认保存结果，请刷新核对。');}
      if(intent.scope!==body.accountId+':'+body.sessionId)throw new DesktopControlRequestError(errors.SESSION_INVALID);setData(body);setMinimum(body.minimumVersion);setIntent(null);
    }catch(e){if(attempt===generation.current)setError(e instanceof DesktopControlRequestError?e.message:'无法确认保存结果，请刷新核对。');}
    finally{busy.current=false;if(mounted.current){setSaving(false);if(refreshAfterSave.current){refreshAfterSave.current=false;void load();}}}
  }
  if(!allowed)return null;
  return <section id="office-desktop-control" className={`panel ${styles.card}`} aria-labelledby="office-desktop-control-title" aria-busy={loading||saving}>
    <div className={styles.cardHead}><h2 id="office-desktop-control-title">{t('桌面助手管理')}</h2></div>
    <div className={styles.form}>
      <p className={styles.muted}>{t('打开程序后自动联网检查，无需密钥或验证码。暂停或提高最低版本只影响新的启动及会话续期。')}</p>
      {loading&&!data?<p role="status">{t('正在读取桌面助手开关…')}</p>:null}
      {data?<><p>{t('允许新的助手启动')}：<strong>{t(data.enabled?'已开启':'已关闭')}</strong></p><p className={styles.muted}>{t('已打开的有效会话可继续使用到期，最长 1 小时；已开始的任务允许完成。Office 总开关仍可禁止已有会话的新操作。')}</p>{data.updatedAt?<p className={styles.muted}>{t('最近开关变更')}：{new Date(data.updatedAt).toLocaleString(locale)}</p>:null}
      <button type="button" className="button button--primary" disabled={loading||saving||!!error} onClick={()=>setIntent({enabled:!data.enabled,revision:data.revision,requestId:crypto.randomUUID(),scope:data.accountId+':'+data.sessionId,minimumVersion:data.minimumVersion})}>{t(data.enabled?'暂停新的助手启动':'允许新的助手启动')}</button></>:null}
      {data?<><p>{t('已发布最新版')}：<strong>{data.currentVersion}</strong></p><label className="field">{t('最低可用版本')}<SelectControl aria-label={t('最低可用版本')} value={minimum} disabled={loading||saving} onChange={e=>{setMinimum(e.target.value);setIntent(null);}}>{data.eligibleMinimumVersions.map(version=><option key={version} value={version}>{version==='0.0.0'?t('兼容旧版（过渡期）'):version}</option>)}</SelectControl></label>
      <p className={styles.muted}>{t('只能选择已发布并完成下载校验的版本。低于最低版本的程序必须更新，才能重新启动使用。')}</p>
      <button type="button" className="button button--primary" disabled={loading||saving||!!error||minimum===data.minimumVersion} onClick={()=>setIntent({enabled:data.enabled,minimumVersion:minimum,revision:data.revision,requestId:crypto.randomUUID(),scope:data.accountId+':'+data.sessionId})}>{t('保存最低版本')}</button></>:null}
      {error?<p role="alert" className="form-error">{systemText(error)}</p>:null}
      <button type="button" className="button button--secondary" disabled={saving||loading} onClick={()=>void load()}>{t('刷新状态')}</button>
      {intent?<div role="group" aria-label={t('确认桌面助手设置')}><p>{t('将保存启动开关和最低版本设置。已有有效会话继续使用，正在执行的任务允许完成。')} {t('最低可用版本')}：{intent.minimumVersion==='0.0.0'?t('兼容旧版（过渡期）'):intent.minimumVersion}</p><button type="button" className="button button--primary" disabled={saving} onClick={()=>void save()}>{t(saving?'正在保存…':'确认变更')}</button><button type="button" className="button button--secondary" disabled={saving} onClick={()=>setIntent(null)}>{t('取消')}</button></div>:null}
    </div>
  </section>;
}
