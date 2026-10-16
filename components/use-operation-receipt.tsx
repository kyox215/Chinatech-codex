"use client";
import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, useSyncExternalStore, type ReactNode } from "react";
import { backendRecovery, loadRecovery, recoverOperation, subscribeRecovery } from "@/lib/backend/client";
import { useLanguage } from "@/components/language-provider";
import { createRecoveryVisibilityRegistry } from "@/components/recovery-visibility";

const RecoveryPresentation = createContext<{ register: (id: string, host: HTMLElement) => () => void; local: Record<string, number> } | null>(null);
export function RecoveryPresentationProvider({ children }: { children: ReactNode }) {
  const [local, setLocal] = useState<Record<string, number>>({});
  const [registry] = useState(() => createRecoveryVisibilityRegistry(setLocal));
  const register = registry.register;
  useEffect(() => () => registry.dispose(), [registry]);
  const value = useMemo(() => ({ local, register }), [local, register]);
  return <RecoveryPresentation.Provider value={value}>{children}</RecoveryPresentation.Provider>;
}
export function useLocalRecoveryControls(requestId?: string) {
  const presentation = useContext(RecoveryPresentation);
  return requestId ? Boolean(presentation?.local[requestId]) : Boolean(presentation && Object.keys(presentation.local).length);
}

/** Only an exact original request receipt can finish a retained operation draft. */
export function useOperationReceipt() {
  const recovery = useSyncExternalStore(subscribeRecovery, backendRecovery, backendRecovery);
  const active = useRef(true);
  type Tracked = { requestId: string; confirmed: (isCurrent: () => boolean) => void | Promise<void>; settled?: () => void; finishing: boolean };
  const tracked = useRef<Tracked | null>(null);
  const [waiting, setWaiting] = useState(false);
  const [requestId, setRequestId] = useState<string | null>(null);
  const finish = useCallback((own: Tracked) => {
    if (!active.current || tracked.current !== own || own.finishing) return;
    own.finishing = true;
    setWaiting(true); setRequestId(null);
    const isCurrent = () => active.current && tracked.current === own;
    const release = () => { if (isCurrent()) { tracked.current = null; setWaiting(false); } };
    try {
      const result = own.confirmed(isCurrent);
      if (result && typeof result.then === "function") void Promise.resolve(result).catch(() => undefined).finally(release);
      else release();
    } catch { release(); }
  }, []);
  useEffect(() => {
    active.current = true;
    const stop = subscribeRecovery(() => {
      const own = tracked.current;
      if (!own) return;
      const recovery = backendRecovery();
      if (recovery.receipt?.requestId === own.requestId) {
        finish(own);
      } else if (recovery.resolution?.requestId === own.requestId) {
        tracked.current = null; setWaiting(false); setRequestId(null); own.settled?.();
      }
    });
    return () => { active.current = false; tracked.current = null; stop(); };
  }, [finish]);
  const watch = useCallback((requestId: string, confirmed: Tracked["confirmed"], settled?: () => void) => {
    if (!active.current) return false;
    if (tracked.current) return tracked.current.requestId === requestId;
    const recovery = backendRecovery();
    if (recovery.receipt?.requestId !== requestId && recovery.pending?.command.requestId !== requestId) return false;
    const own = { requestId, confirmed, settled, finishing: false }; tracked.current = own;
    setWaiting(true); setRequestId(requestId);
    if (recovery.receipt?.requestId === requestId) finish(own);
    return true;
  }, [finish]);
  const executing = Boolean(waiting && requestId && recovery.busy && recovery.pending?.command.requestId === requestId);
  return { waiting, executing, requestId, watch, isWaiting: () => tracked.current !== null, isActive: () => active.current };
}

/** Place outside any disabled fieldset, including a containing modal's fieldset. */
export function OperationRecoveryControls({requestId, global=false}:{requestId?:string|null;global?:boolean}) {
  const {t,systemText}=useLanguage();
  const presentation = useContext(RecoveryPresentation);
  const register = presentation?.register;
  const hostRef = useCallback((host: HTMLElement | null) => {
    if (host && requestId && !global && register) return register(requestId, host);
  }, [requestId, global, register]);
  const recovery=useSyncExternalStore(subscribeRecovery,backendRecovery,backendRecovery);
  const [action,setAction]=useState<"check"|"retry"|"cancel"|"read"|null>(null);
  if(!requestId)return null;
  async function read() {
    if(action)return;
    setAction("read");
    try {await loadRecovery();} finally {setAction(null);}
  }
  if(recovery.pending?.command.requestId!==requestId)return <section ref={hostRef} className="sync-recovery" data-operation-recovery aria-label={t("提交恢复")} aria-busy={action==="read"}>
    <p role="status">{systemText(recovery.message)||t("此设备有尚待核对的提交，请先处理原提交。")}</p>
    <button className="button button--secondary" type="button" disabled={Boolean(action)} aria-busy={action==="read"} onClick={()=>void read()}>{t(action==="read"?"正在核对原提交…":"重新读取恢复记录")}</button>
  </section>;
  async function recover(next:"check"|"retry"|"cancel") {
    if(recovery.busy||action||backendRecovery().pending?.command.requestId!==requestId)return;
    setAction(next);
    try {await recoverOperation(next,requestId!);} finally {setAction(null);}
  }
  return <section ref={hostRef} className="sync-recovery" data-operation-recovery aria-label={t("提交恢复")} aria-busy={recovery.busy||Boolean(action)}>
    <p role="status">{systemText(recovery.message)||t("提交结果待核对，请处理原提交，勿重复新建。")}</p>
    <div className="sync-recovery__actions">
      <button className="button button--secondary" type="button" disabled={recovery.busy||Boolean(action)} aria-busy={action==="check"} onClick={()=>void recover("check")}>{t(action==="check"?"正在核对原提交…":"核对提交结果")}</button>
      <button className="button button--primary" type="button" disabled={recovery.busy||Boolean(action)} aria-busy={action==="retry"} onClick={()=>void recover("retry")}>{t(action==="retry"?"正在提交…":"重试原提交")}</button>
      <button className="button button--secondary" type="button" disabled={recovery.busy||Boolean(action)} aria-busy={action==="cancel"} onClick={()=>void recover("cancel")}>{t(action==="cancel"?"正在核对并撤销未完成提交…":"撤销未完成提交")}</button>
    </div>
  </section>;
}
