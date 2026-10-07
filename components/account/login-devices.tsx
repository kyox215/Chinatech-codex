"use client";
import { useRouter } from "next/navigation";
import { clearBackend, isBackendClient } from "@/lib/backend/client";
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
  const router = useRouter();
  const dialogTitle = useId();
  const [memberId, setMemberId] = useState("");
  const [offset, setOffset] = useState(0);
  const [data, setData] = useState<LoginDevices | null>(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [confirmation, setConfirmation] = useState<Operation | null>(null);
  const [message, setMessage] = useState("");
  const dialog = useRef<HTMLDialogElement>(null);
  const abort = useRef<AbortController | null>(null);
  const inFlight = useRef(false);
  const epoch = useRef(0);
  const invalidateEpoch = useCallback(() => { epoch.current++; }, []);
  const identityScope = useRef("");
  const retry = useRef<PendingOperation | null>(null);
  const endpoint = storeMode ? "/api/backend/staff/sessions" : "/api/auth/account/sessions";
  const allowed = !storeMode || (isBackendClient() && staff.member?.role === "owner");
  const selected = memberId || staff.data.members.find(row => row.membershipStatus === "active")?.id || "";
  const load = useCallback(async () => {
    abort.current?.abort();
    if (!allowed || (storeMode && !selected)) { setData(null); setLoading(false); return; }
    const controller = new AbortController(); abort.current = controller;
    setLoading(true);
    try {
      const params = new URLSearchParams({ offset: String(offset), ...(storeMode ? { memberId: selected } : {}) });
      const response = await fetch(endpoint + "?" + params, { cache: "no-store", signal: controller.signal });
      const payload = await response.json();
      if (controller.signal.aborted) return;
      if (response.status === 401) { retry.current = null; setConfirmation(null); dialog.current?.close(); setData(null); clearBackend(); router.replace("/login"); router.refresh(); return; }
      if (!response.ok) { setData(null); setConfirmation(null); dialog.current?.close(); retry.current = null; throw new Error(payload.message); }
      const nextScope = `${payload.accountId}:${payload.sessionId}`;
      if (identityScope.current && identityScope.current !== nextScope) {
        epoch.current++;
        retry.current = null;
        setConfirmation(null); dialog.current?.close(); setMessage("");
      }
      identityScope.current = nextScope;
      setData(payload); setError("");
    } catch (reason) { if (!controller.signal.aborted) setError(reason instanceof Error ? reason.message : "登录设备暂不可用，请稍后重试。"); }
    finally { if (!controller.signal.aborted) setLoading(false); }
  }, [allowed, endpoint, offset, selected, storeMode, router]);
  useEffect(() => {
    const generation = ++epoch.current;
    queueMicrotask(() => { if (epoch.current === generation) { setData(null); retry.current = null; setConfirmation(null); dialog.current?.close(); void load(); } });
    return () => { invalidateEpoch(); abort.current?.abort(); };
  }, [load, invalidateEpoch]);
  useEffect(() => {
    const refresh = () => {
      if (document.visibilityState !== "visible") return;
      setConfirmation(null); dialog.current?.close(); setData(null); setMessage("");
      void load();
    };
    window.addEventListener("focus", refresh); window.addEventListener("online", refresh);
    return () => { window.removeEventListener("focus", refresh); window.removeEventListener("online", refresh); };
  }, [load]);
  function ask(scope: Operation["scope"], device?: LoginDevice) {
    if (inFlight.current || loading || !data) return;
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
      const payload = await response.json();
      if (generation !== epoch.current) return;
      if (response.status === 401) { retry.current = null; setConfirmation(null); dialog.current?.close(); setData(null); clearBackend(); router.replace("/login"); router.refresh(); return; }
      if (!response.ok) {
        if ([403, 409].includes(response.status)) {
          retry.current = null; setConfirmation(null); dialog.current?.close();
          await load();
        }
        throw new Error(payload.message || "操作未完成，请重试。");
      }
      retry.current = null; dialog.current?.close(); setConfirmation(null);
      if (payload.currentRevoked) { clearBackend(); router.replace("/login"); router.refresh(); return; }
      setMessage(storeMode ? "已撤销本门店访问" : "已退出所选登录设备");
      await load();
    } catch (reason) { if (generation === epoch.current) setError(reason instanceof Error && !["TimeoutError", "TypeError", "AbortError"].includes(reason.name) ? reason.message : "连接中断，结果尚未确认；请重试原操作。"); }
    finally { inFlight.current = false; setBusy(false); }
  }
  const time = (value: string) => new Intl.DateTimeFormat(locale === "zh-CN" ? "zh-CN" : locale === "it" ? "it-IT" : "en-GB", { dateStyle: "medium", timeStyle: "short" }).format(new Date(value));
  if (!allowed) return null;
  return <section className={`panel ${styles.panel}`} aria-label={t(storeMode ? "员工登录设备" : "登录设备")} aria-busy={loading || busy}>
    <header className={styles.header}><h2>{t(storeMode ? "员工登录设备" : "登录设备")}</h2><button type="button" className="button button--secondary" disabled={loading || busy} onClick={() => void load()}>{t("刷新")}</button></header>
    {storeMode ? <><p>{t("仅撤销此设备的本店访问，其他门店不受影响；重新登录后可恢复。")}</p><label className="field"><span>{t("员工")}</span><SelectControl value={selected} disabled={busy} onChange={event => { setMemberId(event.target.value); setOffset(0); setMessage(""); }}>{staff.data.members.filter(row => row.membershipStatus === "active").map(member => <option key={member.id} value={member.id}>{member.name}</option>)}</SelectControl></label></> : <p>{t("每项代表一个浏览器登录，多个标签页共享同一登录。")}</p>}
    {message ? <p role="status">{t(message)}</p> : null}
    {error ? <p className="form-error" role="alert">{systemText(error)}</p> : null}
    {loading ? <p role="status">{t("正在读取登录设备…")}</p> : null}
    {!loading && data?.devices.length === 0 ? <p>{t("没有可管理的登录设备")}</p> : null}
    <div className={styles.list}>{data?.devices.map(device => <article key={device.id} data-session-id={device.id} className={styles.device}>
      <div><strong>{device.browser || t("未知浏览器")} · {device.os || t("未知系统")}</strong>{device.current ? <span className="status-pill">{t("当前设备")}</span> : null}
        <dl><div><dt>{t("登录时间")}</dt><dd>{time(device.createdAt)}</dd></div><div><dt>{t(storeMode ? "本店最近使用" : "最近使用")}</dt><dd>{time(device.lastActiveAt)}</dd></div><div><dt>{t("保持登录")}</dt><dd>{t(device.remember ? "已开启" : "未开启")}</dd></div></dl>
      </div><button type="button" className="button button--secondary" disabled={busy || loading || device.revoked} onClick={() => ask("one", device)}>{t(device.revoked ? "已撤销本门店访问" : storeMode ? "撤销本店访问" : "退出此设备")}</button>
    </article>)}</div>
    {data ? <footer className={styles.actions}><button type="button" className="button button--secondary" disabled={busy || loading || !data.actionableCount} onClick={() => ask(storeMode ? "all" : "others")}>{t(storeMode ? "撤销该员工所有设备的本店访问" : "退出其他所有设备")}</button><button type="button" className="button button--secondary" disabled={busy || loading || !offset} onClick={() => setOffset(Math.max(0, offset - 20))}>{t("上一页")}</button><button type="button" className="button button--secondary" disabled={busy || loading || data.nextOffset === null} onClick={() => setOffset(data.nextOffset!)}>{t("下一页")}</button></footer> : null}
    <dialog aria-labelledby={dialogTitle} ref={dialog} className={styles.dialog} onCancel={event => { if (busy) event.preventDefault(); }} onClose={() => { if (!inFlight.current) setConfirmation(null); }}><h3 id={dialogTitle}>{t(storeMode ? "确认撤销本店访问" : "确认退出登录设备")}</h3><p>{t(storeMode ? "仅撤销此设备的本店访问，其他门店不受影响；重新登录后可恢复。" : "所选登录将失效，需要重新登录。未保存资料仍按原账号保留在原设备。")}</p>{error ? <p role="alert" className="form-error">{systemText(error)}</p> : null}<div className={styles.actions}><button type="button" className="button button--secondary" disabled={busy} onClick={() => dialog.current?.close()}>{t("取消")}</button><button type="button" className="button button--primary" disabled={busy} onClick={() => void revoke()}>{t(busy ? "正在处理…" : "确认")}</button></div></dialog>
  </section>;
}
