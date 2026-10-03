"use client";
import { createContext, useContext, useEffect, useState, useSyncExternalStore } from "react";
import Link from "next/link";
import { configureBackend, clearBackend, refreshBackend, loadRecovery, backendRecovery, subscribeRecovery, recoverOperation } from "@/lib/backend/client";
import type { BackendSnapshot } from "@/lib/backend/contracts";
import { startRealtimeUpdates } from "@/lib/backend/realtime-client";
import { BackendInitialContext } from "@/lib/backend/react";

const ConnectionError=createContext("");

export function BackendProvider({initial,children}:{initial:BackendSnapshot;children:React.ReactNode}) {
  const [error,setError]=useState("");
  useEffect(()=>{
    configureBackend(initial);
    let refreshing=false;let failures=0;let retryAt=0;let active=true;let dirty=false;let lastRead=Date.now();
    const refresh=(force=false)=>{
      if(!active || document.visibilityState==="hidden" || !navigator.onLine || (!force && Date.now()<retryAt))return;
      if(refreshing){if(force)dirty=true;return;}
      refreshing=true;
      lastRead=Date.now();
      void refreshBackend().then(()=>{if(active){failures=0;retryAt=0;setError("");}}).catch(()=>{
        if(active){failures++;retryAt=Date.now()+Math.min(30000,5000*2**Math.min(failures,3));setError("连接暂时中断，当前输入保留；联网后将重新核对。");}
      }).finally(()=>{refreshing=false;if(dirty && active){dirty=false;refresh(true);}});
      void loadRecovery();
    };
    const updates=startRealtimeUpdates(()=>refresh(true));
    const resume=()=>{updates.reconcile();refresh(true);};
    const offline=()=>{updates.reconcile();setError("当前离线。草稿仅在此设备，门店数据将在联网后核对。");};
    const timer=window.setInterval(()=>{if(!updates.isConnected() || Date.now()-lastRead>=30000)refresh();},5000);
    window.addEventListener("focus",resume);window.addEventListener("online",resume);window.addEventListener("offline",offline);document.addEventListener("visibilitychange",resume);
    const leaving=(event:BeforeUnloadEvent)=>{if(backendRecovery().busy){event.preventDefault();event.returnValue="";}};
    window.addEventListener("beforeunload",leaving);
    return()=>{active=false;updates.stop();clearBackend();window.clearInterval(timer);window.removeEventListener("focus",resume);window.removeEventListener("online",resume);window.removeEventListener("offline",offline);document.removeEventListener("visibilitychange",resume);window.removeEventListener("beforeunload",leaving);};
  },[initial]);
  return <BackendInitialContext.Provider value={initial}><ConnectionError.Provider value={error}>{children}</ConnectionError.Provider></BackendInitialContext.Provider>;
}

export function BackendSyncNotice(){
  const error=useContext(ConnectionError);
  const recovery=useSyncExternalStore(subscribeRecovery,backendRecovery,backendRecovery);
  const receipt=recovery.receipt;
  const resultHref=receipt?.kind.startsWith("intake.")||receipt?.kind==="retail.aftersale_repair"?`/app/repairs/${encodeURIComponent(receipt.entityId)}`:receipt?.kind==="retail"?`/app/retail/units/${encodeURIComponent(receipt.entityId)}`:null;
  return <>{error?<p className="form-error" role="status">{error}</p>:null}
    {recovery.pending || recovery.message?<section className="panel sync-recovery" aria-label="提交恢复"><p role="status">{recovery.message || "此设备有尚待核对的提交，请先处理原提交。"}</p>
      {recovery.pending?<div className="sync-recovery__actions"><button className="button button--secondary" disabled={recovery.busy} onClick={()=>void recoverOperation("check")}>核对提交结果</button><button className="button button--primary" disabled={recovery.busy} onClick={()=>void recoverOperation("retry")}>重试原提交</button><button className="button button--secondary" disabled={recovery.busy} onClick={()=>void recoverOperation("cancel")}>撤销未完成提交</button></div>:resultHref?<Link className="button button--secondary" href={resultHref}>查看已保存记录</Link>:null}
    </section>:null}</>;
}
