"use client";
import { useEffect, useState } from "react";
import { configureBackend, clearBackend, refreshBackend } from "@/lib/backend/client";
import type { BackendSnapshot } from "@/lib/backend/contracts";

export function BackendProvider({initial,children}:{initial:BackendSnapshot;children:React.ReactNode}) {
  const [ready,setReady]=useState(false);
  const [error,setError]=useState("");
  useEffect(()=>{configureBackend(initial);queueMicrotask(()=>setReady(true));const refresh=()=>{void refreshBackend().then(()=>setError("")).catch(()=>setError("连接暂时中断，保存时将重新核对最新资料。"));};
    const timer=window.setInterval(refresh,15000);window.addEventListener("focus",refresh);
    return()=>{clearBackend();window.clearInterval(timer);window.removeEventListener("focus",refresh);};
  },[initial]);
  if(!ready)return <div className="module-empty" role="status">正在载入门店资料…</div>;
  return <>{error?<p className="form-error" role="status">{error}</p>:null}{children}</>;
}
