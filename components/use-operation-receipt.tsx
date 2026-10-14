"use client";
import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, useSyncExternalStore, type ReactNode } from "react";
import { backendRecovery, loadRecovery, recoverOperation, subscribeRecovery } from "@/lib/backend/client";
import { useLanguage } from "@/components/language-provider";

const RecoveryPresentation = createContext<{ register: (id: string) => () => void; local: Record<string, number> } | null>(null);
export function RecoveryPresentationProvider({ children }: { children: ReactNode }) {
  const [local, setLocal] = useState<Record<string, number>>({});
  const register = useCallback((id: string) => {
    setLocal(current => ({ ...current, [id]: (current[id] ?? 0) + 1 }));
    return () => setLocal(current => { const next = { ...current }; if ((next[id] ?? 0) <= 1) delete next[id]; else next[id]--; return next; });
  }, []);
  const value = useMemo(() => ({ local, register }), [local, register]);
  return <RecoveryPresentation.Provider value={value}>{children}</RecoveryPresentation.Provider>;
}
export function useLocalRecoveryControls(requestId?: string) {
  const presentation = useContext(RecoveryPresentation);
  return requestId ? Boolean(presentation?.local[requestId]) : Boolean(presentation && Object.keys(presentation.local).length);
}

/** Only an exact original request receipt can finish a retained operation draft. */
export function useOperationReceipt() {
  const active = useRef(true);
  const tracked = useRef<{ requestId: string; confirmed: () => void; settled?: () => void } | null>(null);
  const [waiting, setWaiting] = useState(false);
  const [requestId, setRequestId] = useState<string | null>(null);
  useEffect(() => {
    active.current = true;
    const stop = subscribeRecovery(() => {
      const own = tracked.current;
      if (!own) return;
      const recovery = backendRecovery();
      if (recovery.receipt?.requestId === own.requestId) {
        tracked.current = null; setWaiting(false); setRequestId(null); own.confirmed();
      } else if (recovery.resolution?.requestId === own.requestId) {
        tracked.current = null; setWaiting(false); setRequestId(null); own.settled?.();
      }
    });
    return () => { active.current = false; tracked.current = null; stop(); };
  }, []);
  function watch(requestId: string, confirmed: () => void, settled?: () => void) {
    if (!active.current) return false;
    const recovery = backendRecovery();
    if (recovery.receipt?.requestId === requestId) { confirmed(); return true; }
    if (recovery.pending?.command.requestId !== requestId) return false;
    tracked.current = { requestId, confirmed, settled }; setWaiting(true); setRequestId(requestId); return true;
  }
  return { waiting, requestId, watch, isWaiting: () => tracked.current !== null };
}

/** Place outside any disabled fieldset, including a containing modal's fieldset. */
export function OperationRecoveryControls({requestId, global=false}:{requestId?:string|null;global?:boolean}) {
  const {t,systemText}=useLanguage();
  const presentation = useContext(RecoveryPresentation);
  const register = presentation?.register;
  useEffect(() => { if (requestId && !global && register) return register(requestId); }, [requestId, global, register]);
  const recovery=useSyncExternalStore(subscribeRecovery,backendRecovery,backendRecovery);
  const [action,setAction]=useState<"check"|"retry"|"cancel"|"read"|null>(null);
  if(!requestId)return null;
  async function read() {
    if(action)return;
    setAction("read");
    try {await loadRecovery();} finally {setAction(null);}
  }
  if(recovery.pending?.command.requestId!==requestId)return <section className="sync-recovery" data-operation-recovery aria-label={t("提交恢复")}>
    <p role="status">{systemText(recovery.message)||t("此设备有尚待核对的提交，请先处理原提交。")}</p>
    <button className="button button--secondary" type="button" disabled={Boolean(action)} aria-busy={action==="read"} onClick={()=>void read()}>{t(action==="read"?"正在核对原提交…":"重新读取恢复记录")}</button>
  </section>;
  async function recover(next:"check"|"retry"|"cancel") {
    if(recovery.busy||action||backendRecovery().pending?.command.requestId!==requestId)return;
    setAction(next);
    try {await recoverOperation(next,requestId!);} finally {setAction(null);}
  }
  return <section className="sync-recovery" data-operation-recovery aria-label={t("提交恢复")}>
    <p role="status">{systemText(recovery.message)||t("提交结果待核对，请处理原提交，勿重复新建。")}</p>
    <div className="sync-recovery__actions">
      <button className="button button--secondary" type="button" disabled={recovery.busy||Boolean(action)} aria-busy={action==="check"} onClick={()=>void recover("check")}>{t(action==="check"?"正在核对原提交…":"核对提交结果")}</button>
      <button className="button button--primary" type="button" disabled={recovery.busy||Boolean(action)} aria-busy={action==="retry"} onClick={()=>void recover("retry")}>{t(action==="retry"?"正在提交…":"重试原提交")}</button>
      <button className="button button--secondary" type="button" disabled={recovery.busy||Boolean(action)} aria-busy={action==="cancel"} onClick={()=>void recover("cancel")}>{t(action==="cancel"?"正在核对并撤销未完成提交…":"撤销未完成提交")}</button>
    </div>
  </section>;
}
