"use client";
import { ListPagination } from "@/components/list-pagination";
import { Toast } from "@/components/toast";
import { useBackendMode } from "@/components/backend-snapshot";
import { useActivityFeedback } from "@/components/operation-feedback";
import { notifyAuthChanged, subscribeAuthChanged } from "@/lib/auth-events";
import { useRouter } from "next/navigation";
import { clearBackend } from "@/lib/backend/client";
import{readResponseObject}from'@/lib/backend/read-response';
import { useId, useCallback, useEffect, useRef, useState } from "react";
import { useLanguage } from "@/components/language-provider";
import { SelectControl } from "@/components/select-control";
import { useStaff } from "@/components/staff/use-staff";
import type { LoginDevice, LoginDevices } from "@/lib/login-devices";
import styles from "./login-devices.module.css";

type PendingOperation = { operation: Operation; accountId: string; sessionId: string };
type Operation = { requestId: string; scope: "one" | "others" | "all"; sessionId?: string; revision?: number; memberId?: string };
export function LoginDevicesPanel({ storeMode = false }: { storeMode?: boolean }) {
  const { t, systemText, locale } = useLanguage();
  const staff = useStaff();
  const formal=useBackendMode();
  const router = useRouter();
  const dialogTitle = useId();
  const [memberId, setMemberId] = useState("");
  const [data, setData] = useState<LoginDevices | null>(null);
  const [dataKey,setDataKey]=useState("");
  const loadedWindow = useRef<{ key: string; data: LoginDevices } | null>(null);
  const reading = useRef(false);
  const [foreground,setForeground]=useState(false);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [confirmation, setConfirmation] = useState<Operation | null>(null);
  const [message, setMessage] = useState("");
  const dialog = useRef<HTMLDialogElement>(null);
  const panel = useRef<HTMLElement>(null);
  const abort = useRef<AbortController | null>(null);
  const inFlight = useRef(false);
  const epoch = useRef(0);
  const invalidateEpoch = useCallback(() => { epoch.current++; }, []);
  const identityScope = useRef("");
  const retry = useRef<PendingOperation | null>(null);
  const endpoint = storeMode ? "/api/backend/staff/sessions" : "/api/auth/account/sessions";
  const allowed = !storeMode || (formal && staff.member?.role === "owner");
  const selected = memberId || staff.data.members.find(row => row.membershipStatus === "active")?.id || "";
  const viewKey=JSON.stringify([endpoint, storeMode ? selected : "", staff.member?.id, staff.member?.revision]);
  const visibleData=dataKey===viewKey?data:null;
  useActivityFeedback(loading&&(!visibleData||foreground),{kind:"read"});
  const load = useCallback(async (visible=false, append=false) => {
    const previous = loadedWindow.current?.key === viewKey ? loadedWindow.current.data : null;
    if (append && (reading.current || !previous || previous.nextOffset === null)) return;
    const offset = append ? previous!.nextOffset! : 0;
    setForeground(visible || append);
    abort.current?.abort();
    if (!allowed || (storeMode && !selected)) { loadedWindow.current = null; setData(null); setLoading(false); return; }
    const controller = new AbortController(); abort.current = controller;
    reading.current = true; setLoading(true);
    try {
      const params = new URLSearchParams({ offset: String(offset), ...(storeMode ? { memberId: selected } : {}) });
      const response = await fetch(endpoint + "?" + params, { cache: "no-store", signal: AbortSignal.any([controller.signal, AbortSignal.timeout(15000)]) });
      if (controller.signal.aborted || abort.current!==controller) return;
      if (response.status === 401) { retry.current = null; setConfirmation(null); dialog.current?.close(); loadedWindow.current=null; setData(null); clearBackend(); router.replace("/login"); router.refresh(); return; }
      if([403,409].includes(response.status)){loadedWindow.current=null;setData(null);setConfirmation(null);dialog.current?.close();retry.current=null;}
      const payload = await readResponseObject(response);
      if (controller.signal.aborted || abort.current!==controller) return;
      if (!response.ok) throw new Error(typeof payload.message==='string'?payload.message:'登录设备暂不可用，请稍后重试。');
      if(typeof payload.accountId!=='string'||!payload.accountId||typeof payload.sessionId!=='string'||!payload.sessionId||!Array.isArray(payload.devices)||payload.devices.length>20||payload.devices.some((device:LoginDevice)=>!device||typeof device.id!=='string')||!Number.isSafeInteger(payload.actionableCount)||payload.actionableCount<0||payload.nextOffset!==null&&(!Number.isSafeInteger(payload.nextOffset)||payload.nextOffset<0))throw new Error('登录设备暂不可用，请稍后重试。');
      const nextScope = `${payload.accountId}:${payload.sessionId}`;
      if (identityScope.current && identityScope.current !== nextScope) {
        epoch.current++;
        retry.current = null;
        setConfirmation(null); dialog.current?.close(); setMessage("");
      }
      identityScope.current = nextScope;
      if (append && previous && (previous.accountId !== payload.accountId || previous.sessionId !== payload.sessionId)) {
        loadedWindow.current = null; setData(null); setDataKey(""); setError("登录会话已变化，请刷新后重试。"); return;
      }
      const nextData: LoginDevices = append && previous ? { ...payload, devices: [...new Map([...previous.devices, ...payload.devices].map(device => [device.id, device])).values()] } : payload;
      loadedWindow.current = { key: viewKey, data: nextData };
      setData(nextData);setDataKey(viewKey); setError("");
    } catch (reason) { if (!controller.signal.aborted) setError(reason instanceof Error && reason.name !== "TimeoutError" ? reason.message : "登录设备暂不可用，请稍后重试。"); }
    finally { if (abort.current === controller) reading.current = false; if (!controller.signal.aborted) {setLoading(false);setForeground(false);} }
  }, [allowed, endpoint, selected, storeMode, router,viewKey]);
  useEffect(() => {
    const generation = ++epoch.current;
    queueMicrotask(() => { if (epoch.current === generation) { retry.current = null; setConfirmation(null); dialog.current?.close(); void load(); } });
    return () => { invalidateEpoch(); abort.current?.abort(); };
  }, [load, invalidateEpoch]);
  useEffect(() => {
    const refresh = () => {
      if (document.visibilityState !== "visible") return;
      setConfirmation(null); dialog.current?.close(); setMessage("");
      void load();
    };
    window.addEventListener("focus", refresh); window.addEventListener("online", refresh);
    return () => { window.removeEventListener("focus", refresh); window.removeEventListener("online", refresh); };
  }, [load]);
  useEffect(() => {
    if (!allowed || storeMode || window.location.hash !== "#login-devices") return;
    let active = true;
    // Account forms mount after their authoritative read. Resolve the explicit
    // device shortcut once its target exists, rather than scrolling before load.
    queueMicrotask(() => { if (active) panel.current?.scrollIntoView({ block: "start", behavior: "instant" }); });
    return () => { active = false; };
  }, [allowed, storeMode]);
  useEffect(()=>subscribeAuthChanged(()=>{invalidateEpoch();abort.current?.abort();loadedWindow.current=null;setData(null);setDataKey("");retry.current=null;setConfirmation(null);dialog.current?.close();void load();}),[load,invalidateEpoch]);
  function ask(scope: Operation["scope"], device?: LoginDevice) {
    if (inFlight.current || loading || !visibleData || !data) return;
    setError(""); setMessage("");
    const previous = retry.current;
    const same = previous?.accountId === data.accountId && previous.sessionId === data.sessionId && previous.operation.scope === scope && previous.operation.sessionId === device?.id && previous.operation.memberId === (storeMode ? selected : undefined);
    const operation: Operation = same ? previous.operation : { requestId: crypto.randomUUID(), scope, ...(device ? { sessionId: device.id, revision: device.revision } : {}), ...(storeMode ? { memberId: selected } : {}) };
    retry.current = { operation, accountId: data.accountId, sessionId: data.sessionId };
    setConfirmation(operation);
    dialog.current?.showModal();
  }
  async function revoke() {
    if (!confirmation || !data || inFlight.current) return;
    inFlight.current = true; setBusy(true); setError("");
    const generation = epoch.current;
    try {
      const response = await fetch(endpoint + "/revoke", { method: "POST", cache: "no-store", headers: { "Content-Type": "application/json", "X-CT-Account-ID": data.accountId, "X-CT-Session-ID": data.sessionId }, body: JSON.stringify(confirmation), signal: AbortSignal.timeout(15000) });
      if (generation !== epoch.current) return;
      if (response.status === 401) { retry.current = null; setConfirmation(null); dialog.current?.close(); loadedWindow.current=null; setData(null); clearBackend(); router.replace("/login"); router.refresh(); return; }
      if([403,409].includes(response.status)){retry.current=null;setConfirmation(null);dialog.current?.close();loadedWindow.current=null;setData(null);setDataKey('');}
      const payload = await readResponseObject(response).catch(()=>{throw new Error(response.ok?'连接中断，结果尚未确认；请重试原操作。':'登录设备暂不可用，请稍后重试。');});
      if(generation!==epoch.current)return;
      if (!response.ok) {
        if ([403, 409].includes(response.status)) {
          retry.current = null; setConfirmation(null); dialog.current?.close();
          await load();
        }
        throw new Error(payload.message || "操作未完成，请重试。");
      }
      if(payload.ok!==true)throw new Error('连接中断，结果尚未确认；请重试原操作。');
      retry.current = null; dialog.current?.close(); setConfirmation(null);
      notifyAuthChanged();
      if (payload.currentRevoked) { clearBackend(); router.replace("/login"); router.refresh(); return; }
      if (payload.currentStoreRevoked) { clearBackend(); router.replace("/account/pending"); router.refresh(); return; }
      setMessage(storeMode ? "已撤销本门店访问" : "已退出所选登录设备");
      await load();
    } catch (reason) { if (generation === epoch.current) setError(reason instanceof Error && !["TimeoutError", "TypeError", "AbortError"].includes(reason.name) ? reason.message : "连接中断，结果尚未确认；请重试原操作。"); }
    finally { inFlight.current = false; setBusy(false); }
  }
  const time = (value: string) => new Intl.DateTimeFormat(locale === "zh-CN" ? "zh-CN" : locale === "it" ? "it-IT" : "en-GB", { dateStyle: "medium", timeStyle: "short" }).format(new Date(value));
  if (!allowed) return null;
  return <section ref={panel} id={storeMode ? undefined : "login-devices"} className={`panel ${styles.panel}`} aria-label={t(storeMode ? "员工登录设备" : "登录设备")} aria-busy={loading || busy}>
    <header className={styles.header}><h2>{t(storeMode ? "员工登录设备" : "登录设备")}</h2><button type="button" className="button button--secondary" disabled={loading || busy} aria-busy={loading&&foreground} onClick={() => void load(true)}>{t("刷新")}</button></header>
    {storeMode ? <><p>{t("仅撤销此设备的本店访问，其他门店不受影响；重新登录后可恢复。")}</p><label className="field"><span>{t("员工")}</span><SelectControl value={selected} disabled={busy} onChange={event => { setMemberId(event.target.value); setMessage(""); }}>{staff.data.members.filter(row => row.membershipStatus === "active").map(member => <option key={member.id} value={member.id}>{member.name}</option>)}</SelectControl></label></> : <p>{t("每项代表一个浏览器登录，多个标签页共享同一登录。")}</p>}
    {message ? <Toast message={t(message)} onDismiss={() => setMessage("")} /> : null}
    {error ? <p className="form-error" role="alert">{systemText(error)}</p> : null}
    {loading ? <p role="status">{t("正在读取登录设备…")}</p> : null}
    {!loading && visibleData?.devices.length === 0 ? <p>{t("没有可管理的登录设备")}</p> : null}
    <div className={styles.list}>{visibleData?.devices.map(device => <article key={device.id} data-session-id={device.id} className={styles.device}>
      <div><strong>{device.browser || t("未知浏览器")} · {device.os || t("未知系统")}</strong>{device.current ? <span className="status-pill">{t("当前设备")}</span> : null}
        <dl><div><dt>{t("登录时间")}</dt><dd>{time(device.createdAt)}</dd></div><div><dt>{t(storeMode ? "本店最近使用" : "最近使用")}</dt><dd>{time(device.lastActiveAt)}</dd></div><div><dt>{t("保持登录")}</dt><dd>{t(device.remember ? "已开启" : "未开启")}</dd></div></dl>
      </div><button type="button" className="button button--secondary" disabled={busy || loading || device.revoked} onClick={() => ask("one", device)}>{t(device.revoked ? "已撤销本门店访问" : storeMode ? "撤销本店访问" : "退出此设备")}</button>
    </article>)}</div>
    {visibleData ? <footer className={styles.actions}><button type="button" className="button button--secondary" disabled={busy || loading || !visibleData.actionableCount} onClick={() => ask(storeMode ? "all" : "others")}>{t(storeMode ? "撤销该员工所有设备的本店访问" : "退出其他所有设备")}</button></footer> : null}
    {visibleData ? <ListPagination shown={visibleData.devices.length} hasMore={visibleData.nextOffset !== null} onLoadMore={() => void load(true, true)} loading={loading} disabled={busy} error={Boolean(error)} resetKey={viewKey} label={t("登录设备加载")} /> : null}
    <dialog aria-labelledby={dialogTitle} ref={dialog} className={styles.dialog} onCancel={event => { if (busy) event.preventDefault(); }} onClose={() => { if (!inFlight.current) setConfirmation(null); }}><h3 id={dialogTitle}>{t(storeMode ? "确认撤销本店访问" : "确认退出登录设备")}</h3><p>{t(storeMode ? "仅撤销此设备的本店访问，其他门店不受影响；重新登录后可恢复。" : "所选登录将失效，需要重新登录。未保存资料仍按原账号保留在原设备。")}</p>{error ? <p role="alert" className="form-error">{systemText(error)}</p> : null}<div className={styles.actions}><button type="button" className="button button--secondary" disabled={busy} onClick={() => dialog.current?.close()}>{t("取消")}</button><button type="button" className="button button--primary" disabled={busy} aria-busy={busy} onClick={() => void revoke()}>{t(busy ? "正在处理…" : "确认")}</button></div></dialog>
  </section>;
}
