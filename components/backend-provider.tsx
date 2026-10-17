"use client";
import { OperationRecoveryControls, RecoveryPresentationProvider, useLocalRecoveryControls } from "@/components/use-operation-receipt";
import { BackendSnapshotContext } from "@/components/backend-snapshot";
import { createBackendBootstrap } from "@/lib/backend/bootstrap";
import { useActivityFeedback } from "@/components/operation-feedback";
import { useLanguage } from "@/components/language-provider";
import { createContext, useContext, useEffect, useMemo, useRef, useState, useSyncExternalStore } from "react";
import { Toast } from "@/components/toast";
import { useOnline } from "@/components/page-recovery";
import { configureBackend, releaseBackendBootstrap, canAdoptBackendBootstrap, reconcileBackendInitial, backendReadGeneration, backendSnapshot, subscribeBackend, refreshBackend, loadRecovery, backendRecovery, backendWriting, subscribeRecovery } from "@/lib/backend/client";
import type { BackendSnapshot } from "@/lib/backend/contracts";
import { startRealtimeUpdates } from "@/lib/backend/realtime-client";

const ConnectionError=createContext({error:"",refreshing:false,retry:()=>{}});

export function BackendProvider({initial,children}:{initial:BackendSnapshot;children:React.ReactNode}) {
  const [scope] = useState(() => createBackendBootstrap(initial, { generation:backendReadGeneration, read:backendSnapshot, subscribe:subscribeBackend, configure:configureBackend, reconcile:reconcileBackendInitial, release:releaseBackendBootstrap, canAdoptRelease:canAdoptBackendBootstrap }));
  const [bootstrapping,setBootstrapping]=useState(true);
  const [error,setError]=useState("");
  const [syncing,setSyncing]=useState(false);
  const [foreground,setForeground]=useState(false);
  const retry=useRef<()=>void>(()=>{});
  const view=useMemo(()=>({...scope,hydrated:!bootstrapping,read:()=>scope.readFor(initial),server:()=>initial}),[scope,initial,bootstrapping]);
  useActivityFeedback(foreground && syncing,{kind:"retry",scope:initial.storeId});
  useEffect(()=>{scope.activate(initial);queueMicrotask(()=>setBootstrapping(false));},[initial,scope]);
  useEffect(()=>{
    let refreshing=false;let failures=0;let retryAt=0;let active=true;let dirty=false;let lastRead=Date.now();
    const refresh=(force=false,visible=false)=>{
      if(!active || document.visibilityState==="hidden" || !navigator.onLine || (!force && Date.now()<retryAt))return;
      if(refreshing){if(force)dirty=true;if(visible)setForeground(true);return;}
      refreshing=true;
      setForeground(visible);
      setSyncing(true);
      lastRead=Date.now();
      void refreshBackend().then(()=>{if(active){failures=0;retryAt=0;setError("");}}).catch(()=>{
        if(active){failures++;retryAt=Date.now()+Math.min(30000,5000*2**Math.min(failures,3));setError("连接暂时中断，当前输入保留；联网后将重新核对。");}
      }).finally(()=>{refreshing=false;if(active){setSyncing(false);setForeground(false);}if(dirty && active){dirty=false;refresh(true);}});
      void loadRecovery();
    };
    const updates=startRealtimeUpdates(()=>refresh(true),initial.storeId);
    const resume=()=>{updates.reconcile();refresh(true);};
    const offline=()=>{updates.reconcile();setError("当前离线。草稿仅在此设备，门店数据将在联网后核对。");};
    retry.current=()=>{if(navigator.onLine)refresh(true,true);else offline();};
    if(!navigator.onLine)queueMicrotask(()=>{if(active)offline();});
    const timer=window.setInterval(()=>{if(!updates.isConnected() || Date.now()-lastRead>=30000)refresh();},5000);
    window.addEventListener("focus",resume);window.addEventListener("online",resume);window.addEventListener("offline",offline);document.addEventListener("visibilitychange",resume);
    const leaving=(event:BeforeUnloadEvent)=>{if(backendRecovery().busy){event.preventDefault();event.returnValue="";}};
    window.addEventListener("beforeunload",leaving);
    return()=>{active=false;retry.current=()=>{};updates.stop();scope.dispose();window.clearInterval(timer);window.removeEventListener("focus",resume);window.removeEventListener("online",resume);window.removeEventListener("offline",offline);document.removeEventListener("visibilitychange",resume);window.removeEventListener("beforeunload",leaving);};
  },[scope,initial.storeId]);
  return <BackendSnapshotContext.Provider value={view}><ConnectionError.Provider value={{error,refreshing:syncing,retry:()=>retry.current()}}><RecoveryPresentationProvider><div className="backend-snapshot-root" inert={bootstrapping}>{children}</div></RecoveryPresentationProvider></ConnectionError.Provider></BackendSnapshotContext.Provider>;
}

export function BackendSyncNotice(){
  const { t , systemText } = useLanguage();
  const {error,refreshing,retry}=useContext(ConnectionError);
  const recovery=useSyncExternalStore(subscribeRecovery,backendRecovery,backendRecovery);
  const receipt=recovery.receipt;
  const online=useOnline();
  const [presentedRequest,setPresentedRequest]=useState<string|null>(null);
  const localControls=useLocalRecoveryControls(recovery.pending?.command.requestId);
  const confirmed = !recovery.pending && !recovery.busy && (Boolean(receipt) && recovery.message === "提交已确认保存。" || recovery.resolution?.status === "cancelled" && recovery.message === "此提交已撤销，服务器不会再执行它；输入草稿仍可重新核对。");
  const needsRecovery = Boolean(recovery.pending && !recovery.busy && (!backendWriting() || !online || receipt));
  if (needsRecovery && recovery.pending && presentedRequest !== recovery.pending.command.requestId) setPresentedRequest(recovery.pending.command.requestId);
  else if (!recovery.pending && presentedRequest !== null) setPresentedRequest(null);
  const showRecovery = !localControls && (recovery.pending ? needsRecovery || presentedRequest === recovery.pending.command.requestId : Boolean(recovery.message) && !recovery.busy);
  return <>{error?<div className="sync-connection-notice" data-operation-feedback="background"><p className="form-error" role="status">{systemText(error)}</p><button type="button" className="button button--secondary" disabled={refreshing} aria-busy={refreshing} onClick={retry}>{refreshing?t("正在加载…"):t("重试连接")}</button></div>:null}
    {confirmed ? <Toast priority="global" noticeId={receipt?.requestId ?? `${recovery.resolution!.requestId}:cancelled`} message={systemText(recovery.message)} /> : showRecovery?<section className="panel sync-recovery" aria-label={t("提交恢复")} aria-busy={recovery.busy}>{!recovery.pending ? <p role="status">{systemText(recovery.message)}</p> : null}
      {recovery.pending?<OperationRecoveryControls global requestId={recovery.pending.command.requestId}/>:null}
    </section>:null}</>;
}
