"use client";
import { OperationRecoveryControls, RecoveryPresentationProvider, useLocalRecoveryControls } from "@/components/use-operation-receipt";
import { PageLoading } from "@/components/page-recovery";
import { useLanguage } from "@/components/language-provider";
import { createContext, useContext, useEffect, useRef, useState, useSyncExternalStore } from "react";
import { NavigationLink as Link } from "@/components/navigation-link";
import { configureBackend, clearBackend, refreshBackend, loadRecovery, backendRecovery, subscribeRecovery } from "@/lib/backend/client";
import type { BackendSnapshot } from "@/lib/backend/contracts";
import { startRealtimeUpdates } from "@/lib/backend/realtime-client";

const ConnectionError=createContext({error:"",refreshing:false,retry:()=>{}});

export function BackendProvider({initial,children}:{initial:BackendSnapshot;children:React.ReactNode}) {
  const { t } = useLanguage();
  const [ready,setReady]=useState(false);
  const [error,setError]=useState("");
  const [syncing,setSyncing]=useState(false);
  const retry=useRef<()=>void>(()=>{});
  useEffect(()=>{
    configureBackend(initial);queueMicrotask(()=>setReady(true));
    let refreshing=false;let failures=0;let retryAt=0;let active=true;let dirty=false;let lastRead=Date.now();
    const refresh=(force=false)=>{
      if(!active || document.visibilityState==="hidden" || !navigator.onLine || (!force && Date.now()<retryAt))return;
      if(refreshing){if(force)dirty=true;return;}
      refreshing=true;
      setSyncing(true);
      lastRead=Date.now();
      void refreshBackend().then(()=>{if(active){failures=0;retryAt=0;setError("");}}).catch(()=>{
        if(active){failures++;retryAt=Date.now()+Math.min(30000,5000*2**Math.min(failures,3));setError("连接暂时中断，当前输入保留；联网后将重新核对。");}
      }).finally(()=>{refreshing=false;if(active)setSyncing(false);if(dirty && active){dirty=false;refresh(true);}});
      void loadRecovery();
    };
    const updates=startRealtimeUpdates(()=>refresh(true));
    const resume=()=>{updates.reconcile();refresh(true);};
    const offline=()=>{updates.reconcile();setError("当前离线。草稿仅在此设备，门店数据将在联网后核对。");};
    retry.current=()=>{if(navigator.onLine)refresh(true);else offline();};
    if(!navigator.onLine)queueMicrotask(()=>{if(active)offline();});
    const timer=window.setInterval(()=>{if(!updates.isConnected() || Date.now()-lastRead>=30000)refresh();},5000);
    window.addEventListener("focus",resume);window.addEventListener("online",resume);window.addEventListener("offline",offline);document.addEventListener("visibilitychange",resume);
    const leaving=(event:BeforeUnloadEvent)=>{if(backendRecovery().busy){event.preventDefault();event.returnValue="";}};
    window.addEventListener("beforeunload",leaving);
    return()=>{active=false;retry.current=()=>{};updates.stop();clearBackend();window.clearInterval(timer);window.removeEventListener("focus",resume);window.removeEventListener("online",resume);window.removeEventListener("offline",offline);document.removeEventListener("visibilitychange",resume);window.removeEventListener("beforeunload",leaving);};
  },[initial]);
  if(!ready)return <PageLoading internal label={t("正在载入门店资料…")} backHref="/"/>;
  return <ConnectionError.Provider value={{error,refreshing:syncing,retry:()=>retry.current()}}><RecoveryPresentationProvider>{children}</RecoveryPresentationProvider></ConnectionError.Provider>;
}

export function BackendSyncNotice(){
  const { t , systemText } = useLanguage();
  const {error,refreshing,retry}=useContext(ConnectionError);
  const recovery=useSyncExternalStore(subscribeRecovery,backendRecovery,backendRecovery);
  const receipt=recovery.receipt;
  const localControls=useLocalRecoveryControls(recovery.pending?.command.requestId);
  const resultHref=receipt?.kind.startsWith("intake.")||receipt?.kind==="retail.aftersale_repair"?`/app/repairs/${encodeURIComponent(receipt.entityId)}`:receipt?.kind.startsWith("retail")?`/app/retail/units/${encodeURIComponent(receipt.entityId)}`:receipt?.kind.startsWith("repair.")?`/app/repairs/${encodeURIComponent(receipt.entityId)}`:receipt?.kind.startsWith("procurement")?"/app/procurement":null;
  return <>{error?<div className="sync-connection-notice"><p className="form-error" role="status">{systemText(error)}</p><button type="button" className="button button--secondary" disabled={refreshing} aria-busy={refreshing} onClick={retry}>{refreshing?t("正在加载…"):t("重试连接")}</button></div>:null}
    {!localControls && (recovery.pending || recovery.message)?<section className="panel sync-recovery" aria-label={t("提交恢复")} aria-busy={recovery.busy}>{!recovery.pending ? <p role="status">{systemText(recovery.message)}</p> : null}
      {recovery.pending?<OperationRecoveryControls global requestId={recovery.pending.command.requestId}/>:resultHref?<Link className="button button--secondary" href={resultHref}>{t("查看已保存记录")}</Link>:null}
    </section>:null}</>;
}
