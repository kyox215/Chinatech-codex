"use client";

import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";
import { Check, CircleAlert, Link2, LoaderCircle, Mail, RefreshCw, ShieldCheck, Smartphone } from "lucide-react";
import { SelectControl } from "@/components/select-control";
import { ProviderMark } from "@/components/auth/provider-mark";
import { COUNTRY_DIAL_CODES, type AccountOverview } from "@/lib/account";
import styles from "./account-settings.module.css";

const notices: Record<string, string> = {
  linked: "授权已返回，以下显示当前账号的实际绑定状态。",
  "email-pending": "请继续完成邮件中的确认，再刷新下方邮箱状态。",
  "email-updated": "邮箱验证已返回，请核对下方当前登录邮箱。",
  "account-failed": "本次验证未完成或已过期，请核对当前绑定状态后重试。",
};

class AccountRequestError extends Error {
  constructor(message: string, readonly status: number) { super(message); }
}

async function readResponse(response: Response) {
  const payload = await response.json();
  if (!response.ok) throw new AccountRequestError(payload.message || "暂时无法读取账号，请稍后重试。", response.status);
  return payload;
}

export function AccountSettings({ notice = "" }: { notice?: string }) {
  const [data, setData] = useState<AccountOverview | null>(null);
  const [error, setError] = useState("");
  const [unauthorized, setUnauthorized] = useState(false);
  const [loading, setLoading] = useState(true);
  const request = useRef<AbortController | null>(null);
  const mutating = useRef(false);
  const load = useCallback(async () => {
    request.current?.abort();
    const controller = new AbortController(); request.current = controller;
    try {
      const response = await fetch("/api/auth/account", { cache: "no-store", signal: AbortSignal.any([controller.signal, AbortSignal.timeout(15000)]) });
      const next = await readResponse(response) as AccountOverview;
      if (!controller.signal.aborted) { setData(next); setUnauthorized(false); setError(""); return next; }
    } catch (reason) {
      if (controller.signal.aborted) return;
      const expired = reason instanceof AccountRequestError && reason.status === 401;
      setUnauthorized(expired);
      // Unmount every sensitive draft if the session is no longer authoritative.
      if (expired) setData(null);
      setError(reason instanceof AccountRequestError ? reason.message : "连接中断，无法确认账号状态。请重试。");
    } finally { if (!controller.signal.aborted) setLoading(false); }
  }, []);
  useEffect(() => {
    let active = true;
    // Wait for subscriptions to settle; Strict Mode cleanup cancels the discarded read.
    void Promise.resolve().then(() => { if (active) void load(); });
    const refresh = () => { if (!mutating.current && document.visibilityState === "visible") { setLoading(true); void load(); } };
    window.addEventListener("focus", refresh); window.addEventListener("online", refresh);
    return () => { active = false; request.current?.abort(); window.removeEventListener("focus", refresh); window.removeEventListener("online", refresh); };
  }, [load]);

  return <>
    {notices[notice] ? <p className={notice === "account-failed" ? "form-error" : styles.notice} role={notice === "account-failed" ? "alert" : "status"}>{notices[notice]}</p> : null}
    {error ? <div className={`panel ${styles.state}`} role="alert"><CircleAlert size={26} /><p>{error}</p>{unauthorized ? <Link className="button button--primary" href="/login">重新登录</Link> : <button className="button button--secondary" onClick={() => void load()}>重新读取</button>}</div> : null}
    {!data && !error ? <div className={`panel ${styles.state}`} role="status"><LoaderCircle className="spin" size={25} />正在读取账号…</div> : null}
    {data ? <AccountForms key={data.account.id} data={data} refreshing={loading || Boolean(error)} refresh={() => { setLoading(true); return load(); }} onBusyChange={value => { mutating.current = value; }} /> : null}
  </>;
}

function useCooldown() {
  const [seconds, setSeconds] = useState(0);
  useEffect(() => {
    if (!seconds) return;
    const timer = window.setTimeout(() => setSeconds(value => Math.max(0, value - 1)), 1000);
    return () => window.clearTimeout(timer);
  }, [seconds]);
  return { seconds, start: () => setSeconds(60) };
}

type Operation = "email" | "phone" | "verify" | "google" | "apple";
type FeedbackState = { operation: Operation; message: string; error: boolean };
function Feedback({ feedback, operations }: { feedback: FeedbackState | null; operations: Operation[] }) {
  if (!feedback || !operations.includes(feedback.operation)) return null;
  return <p className={feedback.error ? "form-error" : styles.notice} role={feedback.error ? "alert" : "status"}>{feedback.message}</p>;
}
function AccountForms({ data, refreshing, refresh, onBusyChange }: { data: AccountOverview; refreshing: boolean; refresh: () => Promise<AccountOverview | undefined>; onBusyChange: (value: boolean) => void }) {
  const { account, availability } = data;
  const [email, setEmail] = useState("");
  const [countryCode, setCountryCode] = useState("+39");
  const [customCode, setCustomCode] = useState("+");
  const [phone, setPhone] = useState("");
  const [token, setToken] = useState("");
  const [busy, setBusy] = useState<Operation | null>(null);
  const [feedback, setFeedback] = useState<FeedbackState | null>(null);
  const inFlight = useRef(false);
  const emailCooldown = useCooldown(); const phoneCooldown = useCooldown();
  const disabled = Boolean(busy) || refreshing;

  async function perform(operation: Operation, path: string, body: Record<string, string>) {
    if (inFlight.current || refreshing) return;
    inFlight.current = true; onBusyChange(true); setBusy(operation); setFeedback(null);
    try {
      const response = await fetch(`/api/auth/account/${path}`, { method: "POST", headers: { "Content-Type": "application/json", "X-CT-Account-ID": account.id }, body: JSON.stringify(body), cache: "no-store", signal: AbortSignal.timeout(20000) });
      const payload = await readResponse(response) as { message?: string; redirectTo?: string };
      if (payload.redirectTo) { window.location.assign(payload.redirectTo); return; }
      if (operation === "email") emailCooldown.start();
      if (operation === "phone") phoneCooldown.start();
      if (operation === "verify") setToken("");
      setFeedback({ operation, error: false, message: payload.message || "请求已处理，请核对最新状态。" });
      await refresh();
    } catch (reason) {
      setFeedback({ operation, error: true, message: reason instanceof AccountRequestError ? reason.message : "请求结果尚未确认。请刷新账号状态后核对，输入已保留。" });
      if (reason instanceof AccountRequestError && [401, 409].includes(reason.status)) await refresh();
    } finally { inFlight.current = false; setBusy(null); onBusyChange(false); }
  }


  return <div className={styles.layout}>
    <aside className={`panel ${styles.summary}`}>
      <span className={styles.avatar}><ShieldCheck size={30} aria-hidden="true" /></span>
      <div><h1>我的账号</h1><p className={styles.email}>{account.email}</p></div>
      <span className="status-pill status-pill--success"><Check size={14} />邮箱已验证</span>
      <nav aria-label="账号设置分类" className={styles.nav}><a href="#account-email"><Mail size={18} />登录邮箱</a><a href="#account-providers"><Link2 size={18} />第三方账号</a><a href="#account-phone"><Smartphone size={18} />手机号码</a></nav>
      <p className={styles.muted}>绑定方式用于登录同一个账号，门店权限保持不变。</p>
      <button className="button button--secondary" type="button" disabled={disabled} onClick={() => void refresh()}><RefreshCw size={16} className={refreshing ? "spin" : undefined} />{refreshing ? "正在刷新…" : "刷新绑定状态"}</button>
    </aside>
    <div className={styles.sections}>
      <section id="account-email" className={`panel ${styles.card}`} aria-labelledby="email-heading">
        <header className={styles.cardHead}><span className={styles.icon}><Mail size={22} /></span><div><h2 id="email-heading">登录邮箱</h2><p>用于邮箱登录、接收验证和找回账号。</p></div></header>
        <div className={styles.current}><span className={styles.value}>{account.email || "尚未关联邮箱"}</span><span className={`status-pill status-pill--${account.emailVerified ? "success" : "warning"}`}>{account.emailVerified ? "已验证" : "待验证"}</span></div>
        {account.pendingEmail ? <p className={styles.pending}><Mail size={17} /><span>等待验证：<strong>{account.pendingEmail}</strong><br />完成确认前，当前登录邮箱保持不变。</span></p> : null}
        <form onSubmit={event => { event.preventDefault(); void perform("email", "email", { email }); }} className={styles.form} aria-busy={busy === "email"}>
          <label className="field"><span>{account.email ? "新邮箱地址" : "关联邮箱地址"}</span><input type="email" name="email" autoComplete="email" required maxLength={160} value={email} onChange={event => setEmail(event.target.value)} disabled={disabled} placeholder="name@example.com" /></label>
          <p className={styles.muted}>请按新、旧邮箱收到的邮件完成确认。已有登录邮箱不会被直接替换。</p>
          <Feedback feedback={feedback} operations={["email"]} />
          <footer className={styles.actions}><Link href="/forgot-password">设置或重置登录密码</Link><button className="button button--primary" type="submit" disabled={disabled || emailCooldown.seconds > 0}>{busy === "email" ? "正在发送…" : emailCooldown.seconds ? `${emailCooldown.seconds} 秒后可重发` : "发送验证邮件"}</button></footer>
        </form>
      </section>
      <section id="account-providers" className={`panel ${styles.card}`} aria-labelledby="providers-heading">
        <header className={styles.cardHead}><span className={styles.icon}><Link2 size={22} /></span><div><h2 id="providers-heading">第三方账号</h2><p>授权后，可直接使用对应账号登录。</p></div></header>
        <div className={styles.providers}>{(["google", "apple"] as const).map(provider => {
          const identity = account.providers[provider]; const label = provider === "google" ? "Google" : "Apple";
          return <div className={styles.provider} key={provider}>
            <span className={styles.providerIcon}><ProviderMark provider={provider} /></span>
            <div className={styles.providerContent}><strong>{label}</strong><span>{identity.linked ? identity.email || "已关联到当前账号" : availability[provider] ? "尚未绑定" : "服务尚未开放"}</span></div>
            {identity.linked ? <span className="status-pill status-pill--success"><Check size={14} />已绑定</span> : <button className="button button--secondary" type="button" disabled={disabled || !availability[provider]} onClick={() => void perform(provider, "link", { provider })}>{busy === provider ? "正在前往…" : availability[provider] ? `绑定 ${label}` : "暂不可用"}</button>}
          </div>;
        })}</div>
        <Feedback feedback={feedback} operations={["google", "apple"]} />
        <p className={styles.muted}>请在授权页面选择要绑定的账号。已属于其他网站账号的身份不能在这里合并。</p>
      </section>
      <section id="account-phone" className={`panel ${styles.card}`} aria-labelledby="phone-heading">
        <header className={styles.cardHead}><span className={styles.icon}><Smartphone size={22} /></span><div><h2 id="phone-heading">手机号码</h2><p>选择国际区号，通过短信验证后完成绑定。</p></div></header>
        <div className={styles.current}><span className={styles.value}>{account.phoneVerified && account.phone ? account.phone : "尚未绑定手机号"}</span><span className={`status-pill status-pill--${account.phoneVerified ? "success" : "warning"}`}>{account.phoneVerified ? "已验证" : "未绑定"}</span></div>
        {!availability.phone ? <p className={styles.pending}><CircleAlert size={17} /><span>短信验证服务尚未开放，暂时无法发送验证码。</span></p> : null}
        <form className={styles.form} onSubmit={event => { event.preventDefault(); void perform("phone", "phone", { countryCode: countryCode === "custom" ? customCode : countryCode, number: phone }); }} aria-busy={busy === "phone"}>
          <div className={styles.phoneFields}><label className="field"><span>国际区号</span><SelectControl name="countryCode" value={countryCode} disabled={disabled} onChange={event => setCountryCode(event.target.value)}>{COUNTRY_DIAL_CODES.map(country => <option key={country.code} value={country.code}>{country.label} {country.code}</option>)}<option value="custom">其他区号</option></SelectControl></label><label className="field"><span>手机号码</span><input type="tel" autoComplete="tel-national" required maxLength={25} placeholder="请输入手机号码" value={phone} disabled={disabled} onChange={event => setPhone(event.target.value)} /></label></div>
          {countryCode === "custom" ? <label className="field"><span>自定义国际区号</span><input type="tel" autoComplete="tel-country-code" required pattern="\+[1-9][0-9]{0,2}" maxLength={4} placeholder="例如 +39" value={customCode} disabled={disabled} onChange={event => setCustomCode(event.target.value)} /></label> : null}
          <p className={styles.muted}>号码中无需重复填写区号；请保留号码本身的前导 0。</p>
          <footer className={styles.actions}><button className="button button--secondary" type="submit" disabled={disabled || !availability.phone || phoneCooldown.seconds > 0}>{busy === "phone" ? "正在发送…" : phoneCooldown.seconds ? `${phoneCooldown.seconds} 秒后可重发` : "发送短信验证码"}</button></footer>
        </form>
        {account.pendingPhone ? <form className={styles.verify} onSubmit={event => { event.preventDefault(); void perform("verify", "phone/verify", { phone: account.pendingPhone, token }); }} aria-busy={busy === "verify"}>
          <p className={styles.pending}><Smartphone size={17} /><span>待验证号码：<strong>{account.pendingPhone}</strong></span></p>
          <label className="field"><span>短信验证码</span><input type="text" inputMode="numeric" autoComplete="one-time-code" pattern="[0-9]{6,10}" minLength={6} maxLength={10} required value={token} onChange={event => setToken(event.target.value.replace(/\D/g, ""))} disabled={disabled || !availability.phone} placeholder="输入短信中的验证码" /></label>
          <button className="button button--primary" type="submit" disabled={disabled || !availability.phone}>{busy === "verify" ? "正在验证…" : "验证并绑定"}</button>
        </form> : null}
        <Feedback feedback={feedback} operations={["phone", "verify"]} />
      </section>
    </div>
  </div>;
}
