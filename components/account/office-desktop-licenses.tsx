"use client";
import { useCallback, useEffect, useRef, useState } from 'react';
import { InputControl } from '@/components/input-control';
import { SelectControl } from '@/components/select-control';
import { useLanguage } from '@/components/language-provider';
import styles from './account-settings.module.css';
import type { OfficeAction } from '@/lib/toolbox/office-commands';

type License={id:string;label:string;enabled:boolean;expiresAt:string;maxDevices:number;actions:OfficeAction[];revision:string;deviceCount:number};
type State={licenses:License[];total:number;signingReady:boolean;accountId:string;sessionId:string};
const endpoint='/api/account/toolbox/office-desktop';
const errors:Record<string,string>={SERVICE_UNAVAILABLE:'桌面授权服务尚未配置或暂不可用。',NO_ACCESS:'你没有网站工具箱管理权限。',SESSION_EXPIRED:'会话已失效，请重新登录。',SESSION_INVALID:'登录会话已变化，请刷新后重试。',REQUEST_CONFLICT:'授权状态已变化，请刷新后重新核对。',INVALID_REQUEST:'请核对密钥名称、到期日期和设备上限。'};
export function OfficeDesktopLicenses(){
  const {t,locale}=useLanguage();
  const [clock,setClock]=useState(()=>Date.now());
  const [data,setData]=useState<State|null>(null),[loading,setLoading]=useState(true),[busy,setBusy]=useState(false),[allowed,setAllowed]=useState(true),[error,setError]=useState(''),[newKey,setNewKey]=useState('');
  const [label,setLabel]=useState(''),[date,setDate]=useState(()=>new Date(Date.now()+30*86400000).toISOString().slice(0,10)),[devices,setDevices]=useState('1'),[policy,setPolicy]=useState('all');
  const generation=useRef(0),working=useRef(false),controller=useRef<AbortController|null>(null),mounted=useRef(true),receipt=useRef<{snapshot:string;id:string}|null>(null);
  const load=useCallback(async()=>{
    if(working.current)return;
    controller.current?.abort();const active=new AbortController();controller.current=active;const attempt=++generation.current;
    setLoading(true);setNewKey('');receipt.current=null;
    try{const response=await fetch(endpoint,{cache:'no-store',signal:AbortSignal.any([active.signal,AbortSignal.timeout(15000)])});const body=await response.json();if(active.signal.aborted||attempt!==generation.current)return;if([401,403].includes(response.status)){setAllowed(false);setData(null);return;}if(!response.ok)throw new Error(errors[body.code]||errors.SERVICE_UNAVAILABLE);setClock(Date.now());setData(body);setAllowed(true);setError('');}
    catch(e){if(!active.signal.aborted&&attempt===generation.current)setError(e instanceof Error&&Object.values(errors).includes(e.message)?e.message:errors.SERVICE_UNAVAILABLE);}
    finally{if(!active.signal.aborted&&attempt===generation.current)setLoading(false);}
  },[]);
  const invalidate=useCallback(()=>{generation.current++;controller.current?.abort();},[]);
  useEffect(()=>{mounted.current=true;void Promise.resolve().then(()=>{if(mounted.current)void load();});const refresh=()=>{setNewKey('');receipt.current=null;generation.current++;if(working.current){setData(null);controller.current?.abort();}else void load();};window.addEventListener('focus',refresh);return()=>{mounted.current=false;invalidate();window.removeEventListener('focus',refresh);};},[load,invalidate]);
  async function mutate(body:Record<string,unknown>,method:'POST'|'PATCH'){
    if(!data||working.current)return;
    working.current=true;setBusy(true);setNewKey('');setError('');const attempt=++generation.current,scope=data.accountId+':'+data.sessionId;
    const active=new AbortController();controller.current?.abort();controller.current=active;
    try{const response=await fetch(endpoint,{method,cache:'no-store',headers:{'Content-Type':'application/json','X-CT-Account-ID':data.accountId,'X-CT-Session-ID':data.sessionId},body:JSON.stringify(body),signal:AbortSignal.any([active.signal,AbortSignal.timeout(15000)])});const result=await response.json();if(active.signal.aborted||attempt!==generation.current)return;if(!response.ok){if([401,403].includes(response.status)){setAllowed(false);setData(null);}if(response.status===409)receipt.current=null;throw new Error(errors[result.code]||errors.SERVICE_UNAVAILABLE);}if(scope!==result.accountId+':'+result.sessionId)throw new Error(errors.SESSION_INVALID);setClock(Date.now());setData(previous=>previous?{...previous,licenses:[result.license,...previous.licenses.filter(l=>l.id!==result.license.id)].slice(0,100),total:method==='POST'&&!previous.licenses.some(l=>l.id===result.license.id)?previous.total+1:previous.total}:null);if(method==='POST'){setNewKey(result.key);setLabel('');}receipt.current=null;}
    catch(e){if(attempt===generation.current)setError(e instanceof Error&&Object.values(errors).includes(e.message)?e.message:errors.SERVICE_UNAVAILABLE);}
    finally{working.current=false;if(mounted.current){setBusy(false);if(attempt!==generation.current)void load();}}
  }
  function create(){
    if(!data)return;
    const max=Number(devices),expires=new Date(date+'T23:59:59.000Z');
    if(!label.trim()||label.trim().length>80||!Number.isInteger(max)||max<1||max>100||!Number.isFinite(expires.getTime())||expires.getTime()<=Date.now()||expires.getTime()>Date.now()+366*86400000){setError(errors.INVALID_REQUEST);return;}
    const actions=policy==='install'?['install','activate']:policy==='remove'?['uninstall','reinstall']:['install','activate','uninstall','reinstall'];
    const draft={label:label.trim(),expiresAt:expires.toISOString(),maxDevices:max,actions};const snapshot=JSON.stringify([data.accountId,data.sessionId,draft]);
    if(receipt.current?.snapshot!==snapshot)receipt.current={snapshot,id:crypto.randomUUID()};
    void mutate({...draft,requestId:receipt.current.id},'POST');
  }
  if(!allowed)return null;
  return <section id="office-desktop" className={`panel ${styles.card} ${styles.desktopCard}`} aria-labelledby="office-desktop-title" aria-busy={busy||loading}>
    <div className={styles.cardHead}><h2 id="office-desktop-title">{t('桌面 Office 助手授权')}</h2></div>
    <div className={styles.form}>
      {loading&&!data?<p role="status">{t('正在读取授权…')}</p>:null}
      {error?<p role="alert" className="form-error">{t(error)}</p>:null}
      {data?<><p className={styles.muted}>{t('密钥只授权桌面助手使用，不提供 Office 许可证。停用后禁止新操作，已开始的操作不会被强制终止。')}</p>
      {!data.signingReady?<p role="alert">{t(errors.SERVICE_UNAVAILABLE)}</p>:null}
      <form onSubmit={e=>{e.preventDefault();create();}}>
        <fieldset disabled={busy||loading||!data.signingReady} className={`form-fields ${styles.form}`}>
          <label className="field">{t('密钥名称')}<InputControl value={label} maxLength={80} required onChange={e=>setLabel(e.target.value)} onClear={()=>setLabel('')} validationMessage={t(errors.INVALID_REQUEST)}/></label>
          <label className="field">{t('到期日期（UTC）')}<InputControl type="date" value={date} required onChange={e=>setDate(e.target.value)} validationMessage={t(errors.INVALID_REQUEST)}/></label>
          <label className="field">{t('设备上限')}<InputControl type="number" min={1} max={100} step={1} value={devices} required onChange={e=>setDevices(e.target.value)} validationMessage={t(errors.INVALID_REQUEST)}/></label>
          <label className="field">{t('允许操作')}<SelectControl value={policy} onChange={e=>setPolicy(e.target.value)}><option value="all">{t('全部操作')}</option><option value="install">{t('安装与授权')}</option><option value="remove">{t('卸载与重装')}</option></SelectControl></label>
          <button className="button button--primary" type="submit">{t(busy?'正在保存…':'生成使用密钥')}</button>
        </fieldset>
      </form>
      {newKey?<div role="status"><p>{t('请现在保存密钥；刷新或离开页面后不再显示。')}</p><code style={{overflowWrap:'anywhere'}}>{newKey}</code></div>:null}
      <p>{t('授权数量')}：{data.total}</p>
      {data.licenses.length===0?<p>{t('暂无桌面助手授权。')}</p>:<div className={`module-table-scroll ${styles.desktopTable}`} tabIndex={0}><table><thead><tr><th>{t('密钥名称')}</th><th>{t('到期日期（UTC）')}</th><th>{t('设备上限')}</th><th>{t('允许操作')}</th><th>{t('状态')}</th><th>{t('操作')}</th></tr></thead><tbody>{data.licenses.map(l=><tr key={l.id}><td>{l.label}</td><td>{new Date(l.expiresAt).toLocaleDateString(locale,{timeZone:'UTC'})}</td><td>{l.deviceCount} / {l.maxDevices}</td><td>{l.actions.length===4?t('全部操作'):l.actions.map(a=>t({install:'仅安装',activate:'仅激活',uninstall:'仅卸载',reinstall:'完整重装'}[a])).join(' · ')}</td><td>{t(Date.parse(l.expiresAt)<=clock?'已到期':l.enabled?'已开启':'已关闭')}</td><td><button type="button" className="button button--secondary" disabled={busy||loading} onClick={()=>void mutate({licenseId:l.id,enabled:!l.enabled,expectedRevision:l.revision,requestId:crypto.randomUUID()},'PATCH')}>{t(l.enabled?'停用密钥':'重新启用密钥')}</button></td></tr>)}</tbody></table></div>}
      {data.total>100?<p>{t('显示最近 100 条授权。')}</p>:null}</>:null}
      <button type="button" className="button button--secondary" disabled={busy||loading} onClick={()=>void load()}>{t('刷新状态')}</button>
    </div>
  </section>;
}
