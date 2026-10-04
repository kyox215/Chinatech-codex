"use client";

import Link from "next/link";
import { FormEvent, useEffect, useRef, useState } from "react";
import { ArrowLeft, CheckCircle2, Eye, EyeOff, LoaderCircle, LockKeyhole, Mail } from "lucide-react";
import { InputControl } from "@/components/input-control";
import styles from "./auth-experience.module.css";

export function PasswordRecoveryForm({ reset = false, supabaseMode }: { reset?: boolean; supabaseMode: boolean }) {
  const [loading, setLoading] = useState(reset);
  const [checkFailure, setCheckFailure] = useState(false);
  const [checkAttempt, setCheckAttempt] = useState(0);
  const [valid, setValid] = useState(!reset);
  const [submitting, setSubmitting] = useState(false);
  const [complete, setComplete] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [passwordChecked, setPasswordChecked] = useState(false);
  const [confirmChecked, setConfirmChecked] = useState(false);
  const [error, setError] = useState("");
  const [email, setEmail] = useState("");
  const passwordInput = useRef<HTMLInputElement>(null);
  const confirmInput = useRef<HTMLInputElement>(null);
  const passwordValid = password.length >= 10 && /\p{L}/u.test(password) && /\d/.test(password);
  const passwordError = passwordChecked && password && !passwordValid ? "密码至少 10 位，并同时包含字母与数字。" : "";
  const confirmError = confirmChecked && confirmPassword && password !== confirmPassword ? "两次密码不一致，请重新输入相同的新密码。" : "";
  const disabled = submitting || !supabaseMode;
  useEffect(() => {
    if (!reset) return;
    const controller = new AbortController();
    fetch("/api/auth/reset-password", { cache: "no-store", signal: controller.signal }).then(response => { setValid(response.ok); setCheckFailure(!response.ok && response.status !== 401); setLoading(false); }).catch(() => { if (!controller.signal.aborted) { setCheckFailure(true); setLoading(false); } });
    return () => controller.abort();
  }, [reset, checkAttempt]);
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (submitting || !supabaseMode || !valid) return;
    const form = new FormData(event.currentTarget);
    setError("");
    if (reset) {
      setPasswordChecked(true); setConfirmChecked(true);
      if (!passwordValid) { passwordInput.current?.focus(); return; }
      if (password !== confirmPassword) { confirmInput.current?.focus(); return; }
    }
    setSubmitting(true);
    try {
      const response = await fetch(reset ? "/api/auth/reset-password" : "/api/auth/forgot-password", { method: "POST", headers: { "Content-Type": "application/json" }, cache: "no-store", body: JSON.stringify(reset ? { password } : { email: form.get("email") }) });
      const payload = await response.json() as { message?: string };
      if (!response.ok) throw new Error(payload.message || "请求未完成，请稍后重试。");
      setPassword(""); setConfirmPassword(""); setPasswordChecked(false); setConfirmChecked(false); setComplete(true);
    } catch (reason) { setError(reason instanceof Error ? reason.message : "网络连接失败，请稍后重试。"); }
    finally { setSubmitting(false); }
  }
  if (loading) return <div className="auth-form" role="status"><LoaderCircle className="spin" size={26} /><h1>正在验证重置链接</h1><p className={styles.hint}>请稍候…</p></div>;
  if (reset && checkFailure) return <div className="auth-form"><div className="auth-form__heading"><h1>暂时无法验证链接</h1><p>请检查网络后重试，你的重置链接不会因此被消耗。</p></div><button className="button button--primary" type="button" onClick={() => { setLoading(true); setCheckFailure(false); setCheckAttempt(value => value + 1); }}>重新验证</button><Link className="auth-back-link" href="/login">返回登录</Link></div>;
  if (reset && !valid) return <div className="auth-form"><div className="auth-form__heading"><span className="auth-form__icon"><LockKeyhole size={26} /></span><h1>请重新获取重置链接</h1><p>当前链接可能已过期、已使用，或在另一浏览器打开。</p></div><Link className="button button--primary" href="/forgot-password">获取新的链接</Link><Link className="auth-back-link" href="/login">返回登录</Link></div>;
  if (complete) return <div className="auth-form auth-success" role="status"><span className="auth-form__icon"><CheckCircle2 size={27} /></span><h1>{reset ? "密码已更新" : "请查收重置邮件"}</h1><p>{reset ? "请使用新密码重新登录。此账号原有的登录会话将失效。" : "如果此邮箱关联可恢复的账号，你会收到重置邮件。请在当前浏览器打开邮件链接，再设置新密码。"}</p>{!reset ? <p className={styles.hint}>没有收到？检查邮箱拼写和垃圾邮件，稍后可再试一次。</p> : null}<Link className="button button--primary auth-submit" href="/login">返回登录</Link>{!reset ? <button type="button" className={styles.textButton} onClick={() => setComplete(false)}>修改邮箱或重新发送</button> : null}</div>;
  return <form className="auth-form" onSubmit={submit} aria-busy={submitting}>
    <div className="auth-form__heading"><span className="auth-form__icon">{reset ? <LockKeyhole size={27} /> : <Mail size={27} />}</span><h1>{reset ? "设置新密码" : "忘记密码了？"}</h1><p>{reset ? "换一个安全的新密码，重新回到工作台。" : "输入账号邮箱，我们会帮助你找回访问权限。"}</p></div>
    {!supabaseMode ? <div className="auth-notice"><strong>当前为本地预览</strong><span>此环境不会发送重置邮件，请在正式站找回密码。</span></div> : null}
    {reset ? <>
      <div className="form-field"><label htmlFor="new-password">新密码</label><InputControl shell leading={<LockKeyhole size={19} />} ref={passwordInput} id="new-password" name="password" type={showPassword ? "text" : "password"} required minLength={10} maxLength={128} autoComplete="new-password" value={password} disabled={disabled} error={passwordError} onChange={event => { setPassword(event.target.value); setError(""); }} onBlur={() => setPasswordChecked(true)} placeholder="至少 10 位，包含字母和数字" trailing={<button className="input-icon-button" type="button" disabled={disabled} aria-pressed={showPassword} aria-label={showPassword ? "隐藏密码" : "显示密码"} onClick={() => setShowPassword(value => !value)}>{showPassword ? <EyeOff size={19} /> : <Eye size={19} />}</button>} /></div>
      <div className="form-field"><label htmlFor="confirm-new-password">确认新密码</label><InputControl shell leading={<LockKeyhole size={19} />} ref={confirmInput} id="confirm-new-password" name="confirmPassword" type={showPassword ? "text" : "password"} required minLength={10} maxLength={128} autoComplete="new-password" value={confirmPassword} disabled={disabled} error={confirmError} onChange={event => { setConfirmPassword(event.target.value); setError(""); }} onBlur={() => setConfirmChecked(true)} placeholder="再次输入上方设置的新密码" /></div>
      <p className={styles.hint}>更新后，此账号原有登录会话将失效，使用同一账号的设备需要重新登录。</p>
    </> : <div className="form-field"><label htmlFor="reset-email">电子邮件</label><InputControl shell leading={<Mail size={19} />} id="reset-email" name="email" type="email" required maxLength={160} autoComplete="email" autoCapitalize="off" disabled={disabled} value={email} onChange={event => { setEmail(event.target.value); setError(""); }} onClear={() => { setEmail(""); setError(""); }} clearLabel="清空电子邮件" placeholder="name@example.com" /></div>}
    {error ? <p className="form-error" role="alert">{error}</p> : null}
    <button className="button button--primary auth-submit" type="submit" disabled={disabled}>{submitting ? <><LoaderCircle className="spin" size={18} />正在提交</> : reset ? "保存新密码" : "发送重置链接"}</button>
    <Link className="auth-back-link" href="/login"><ArrowLeft size={15} />返回登录</Link>
  </form>;
}
