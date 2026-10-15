'use client';
import { Toast } from "@/components/toast";
import {useCallback,useEffect,useRef,useState} from 'react';
import {RefreshCw,ShieldCheck} from 'lucide-react';
import {useLanguage} from '@/components/language-provider';
import {useActivityFeedback} from '@/components/operation-feedback';
import {ReadPending} from '@/components/page-recovery';
import {OfficeDesktopV3Control} from './office-desktop-v3-control';
import {toolNames,type ToolId,type ToolState} from '@/lib/toolbox/tool-registry';
import styles from './toolbox-control.module.css';
type Data={accountId:string;sessionId:string;tools:ToolState[]};
type Intent={toolId:ToolId;enabled:boolean;expectedRevision:string;requestId:string};
export function ToolboxControl({accountId,sessionId}:{accountId:string;sessionId:string}){
 const {t}=useLanguage(),scope=accountId+':'+sessionId;
 const [data,setData]=useState<Data|null>(null),[loading,setLoading]=useState(false),[saving,setSaving]=useState(false),[error,setError]=useState(''),[notice,setNotice]=useState(''),[intent,setIntent]=useState<Intent|null>(null),[technical,setTechnical]=useState(false);
 const generation=useRef(0),active=useRef<AbortController|null>(null),busy=useRef(false),pending=useRef<Intent|null>(null);
 useActivityFeedback(loading,{kind:'read'});useActivityFeedback(saving,{kind:'submit'});
 const load=useCallback(async()=>{if(busy.current||pending.current)return;const ticket=++generation.current;active.current?.abort();const controller=new AbortController();active.current=controller;setLoading(true);setError('');
 try{const response=await fetch('/api/account/toolbox/tools',{cache:'no-store',headers:{'X-CT-Account-ID':accountId,'X-CT-Session-ID':sessionId},signal:AbortSignal.any([controller.signal,AbortSignal.timeout(15000)])});const body=await response.json();if(controller.signal.aborted||ticket!==generation.current)return;
 if(!response.ok){if([401,403,409].includes(response.status))setData(null);throw Error(response.status===403?'你没有工具箱管理权限。':'工具箱状态暂不可用，请刷新后重试。');}
 if(body.accountId+':'+body.sessionId!==scope||!Array.isArray(body.tools)) {setData(null);throw Error('工具箱管理会话已变化，请刷新账号资料。');}setData(body);
 }catch(reason){if(!controller.signal.aborted&&ticket===generation.current)setError(reason instanceof Error&&(reason.message==='你没有工具箱管理权限。'||reason.message.startsWith('工具箱'))?reason.message:'工具箱状态暂不可用，请刷新后重试。');}
 finally{if(ticket===generation.current&&!controller.signal.aborted)setLoading(false);}},[accountId,scope,sessionId]);
 useEffect(()=>{let mounted=true;void Promise.resolve().then(()=>{if(mounted)void load();});const refresh=()=>{if(document.visibilityState==='visible')void load();};window.addEventListener('focus',refresh);window.addEventListener('online',refresh);const epoch=generation;return()=>{mounted=false;epoch.current++;active.current?.abort();window.removeEventListener('focus',refresh);window.removeEventListener('online',refresh);};},[load]);
 async function save(next:Intent){if(busy.current)return;busy.current=true;pending.current=next;setIntent(next);setSaving(true);setError('');setNotice('');const ticket=++generation.current;active.current?.abort();const controller=new AbortController();active.current=controller;
 try{const response=await fetch('/api/account/toolbox/tools',{method:'PATCH',cache:'no-store',headers:{'Content-Type':'application/json','X-CT-Account-ID':accountId,'X-CT-Session-ID':sessionId},body:JSON.stringify(next),signal:AbortSignal.any([controller.signal,AbortSignal.timeout(15000)])});const body=await response.json();if(controller.signal.aborted||ticket!==generation.current)return;
 if(!response.ok){if([400,401,403,409,410,426].includes(response.status)){pending.current=null;setIntent(null);if([401,403,409].includes(response.status))setData(null);}throw Error(response.status===409?'工具箱设置已变化，请刷新后核对。':'工具箱设置结果尚未确认，请重试原请求。');}
 if(body.accountId+':'+body.sessionId!==scope){setData(null);pending.current=null;setIntent(null);throw Error('工具箱管理会话已变化，请刷新账号资料。');}
 setData(body);pending.current=null;setIntent(null);setNotice('工具箱设置已保存。');
 }catch(reason){if(!controller.signal.aborted&&ticket===generation.current)setError(reason instanceof Error&&reason.message.startsWith('工具箱')?reason.message:'工具箱设置结果尚未确认，请重试原请求。');}
 finally{busy.current=false;if(ticket===generation.current&&!controller.signal.aborted)setSaving(false);}}
 return <section id="toolbox-control" className={`panel ${styles.panel}`} aria-labelledby="toolbox-control-title"><header className={styles.header}><div><h2 id="toolbox-control-title"><ShieldCheck size={20} aria-hidden/>{t('工具箱管理')}</h2><p>{t('只允许最新版。已开始的任务可安全完成。')}</p></div><button type="button" className="button button--secondary" disabled={loading||saving||!!intent} aria-busy={loading} onClick={()=>void load()}><RefreshCw size={16} aria-hidden/>{t('刷新')}</button></header>
 {!data&&!error?<ReadPending label="正在读取工具箱状态…"/>:null}
 {data?.tools.map(tool=><article key={tool.toolId} className={styles.row}><div className={styles.identity}><strong>{t(toolNames[tool.toolId])}</strong><span>{tool.release?.version??t('版本校验接入中')}</span></div><span className={tool.enabled?styles.enabled:styles.state}>{t(!tool.ready?'下载暂未开放':tool.enabled?'已开启':'已暂停')}</span><button type="button" className={`button ${tool.enabled?'button--primary':'button--secondary'}`} disabled={loading||saving||!!intent||!tool.ready||!!error} aria-busy={saving&&intent?.toolId===tool.toolId} aria-label={t(tool.enabled?'暂停 {tool}':'开启 {tool}',{tool:t(toolNames[tool.toolId])})} onClick={()=>void save({toolId:tool.toolId,enabled:!tool.enabled,expectedRevision:tool.revision,requestId:crypto.randomUUID()})}>{t(!tool.ready?'接入中':tool.enabled?'暂停':'开启')}</button></article>)}
 {error?<p role="alert" className="form-error">{t(error)}</p>:null}{notice?<Toast message={t(notice)} onDismiss={()=>setNotice('')}/>:null}
 {intent&&!saving?<button type="button" className="button button--primary" onClick={()=>void save(intent)}>{t('重试原请求')}</button>:null}
 <details className={styles.technical} onToggle={event=>setTechnical(event.currentTarget.open)}><summary>{t('技术信息')}</summary><p>{t('当前版本由发布流程更新，管理页不提供旧版本切换。')}</p><p>{t('旧安装包私有保留；已下载且不联网的旧副本无法远程停用。')}</p>{data?.tools.filter(tool=>tool.release?.prerelease&&!tool.release.authenticodeSigned&&tool.toolId==='office').map(tool=><p key={tool.toolId}>{t('Office 助手')} {tool.release?.version} · {t('未签名测试版')}</p>)}{technical&&data?<OfficeDesktopV3Control technicalOnly accountId={accountId} sessionId={sessionId}/>:null}</details>
 </section>;
}
