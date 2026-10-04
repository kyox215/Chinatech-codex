"use client";

import Link from "next/link";
import { FormEvent, useRef, useState } from "react";
import { Check, CheckCircle2, Circle, Eye, EyeOff, LoaderCircle, LockKeyhole, Mail, UserRound } from "lucide-react";
import { InputControl } from "@/components/input-control";
import { SocialSignIn } from "./social-sign-in";
import { VerificationSent } from "./verification-sent";
import styles from "./auth-experience.module.css";

export function RegisterForm({ supabaseMode = false, previewAvailable = true }: { supabaseMode?: boolean; previewAvailable?: boolean }) {
  const [showPassword, setShowPassword] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [oauthBusy, setOAuthBusy] = useState(false);
  const [isComplete, setIsComplete] = useState(false);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [passwordChecked, setPasswordChecked] = useState(false);
  const [confirmChecked, setConfirmChecked] = useState(false);
  const [nameError, setNameError] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [error, setError] = useState("");
  const passwordInput = useRef<HTMLInputElement>(null);
  const confirmInput = useRef<HTMLInputElement>(null);
  const busy = isSubmitting || oauthBusy;
  const unavailable = !supabaseMode && !previewAvailable;
  const passwordRules = [{ text: "至少 10 位", met: password.length >= 10 }, { text: "包含字母与数字", met: /\p{L}/u.test(password) && /\d/.test(password) }];
  const passwordError = passwordChecked && password && !passwordRules.every(rule => rule.met) ? "密码至少 10 位，并同时包含字母与数字。" : "";
  const confirmError = confirmChecked && confirmPassword && password !== confirmPassword ? "两次密码不一致，请重新输入相同的新密码。" : "";

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (busy || unavailable) return;
    const form = new FormData(event.currentTarget);
    setError(""); setNameError(""); setPasswordChecked(true); setConfirmChecked(true);
    if (!String(form.get("displayName") ?? "").trim()) {
      setNameError("请输入称呼，例如 陈女士；不能只填写空格。");
      const nameInput = event.currentTarget.elements.namedItem("displayName");
      if (nameInput instanceof HTMLInputElement) nameInput.focus();
      return;
    }
    if (!passwordRules.every(rule => rule.met)) { passwordInput.current?.focus(); return; }
    if (password !== confirmPassword) { confirmInput.current?.focus(); return; }
    setIsSubmitting(true);
    try {
      if (supabaseMode) {
        const response = await fetch("/api/auth/register", { method: "POST", headers: { "Content-Type": "application/json" }, cache: "no-store", body: JSON.stringify({ displayName: form.get("displayName"), email, password }) });
        const payload = await response.json() as { message?: string };
        if (!response.ok) { setError(payload.message ?? "无法完成注册，请稍后重试。"); return; }
      }
      setPassword(""); setConfirmPassword(""); setPasswordChecked(false); setConfirmChecked(false); setIsComplete(true);
    } catch { setError("无法连接注册服务，请稍后重试。"); }
    finally { setIsSubmitting(false); }
  }
  if (isComplete) return supabaseMode ? <VerificationSent email={email} onEdit={() => setIsComplete(false)} /> : <div className="auth-form auth-success" role="status"><span className="auth-form__icon"><CheckCircle2 size={28} /></span><h1>申请流程样板已完成</h1><p>当前没有创建真实账号，也没有发送验证邮件。正式注册后仍需门店授权。</p><Link className="button button--primary" href="/login">返回登录</Link></div>;

  return <form className="auth-form" onSubmit={handleSubmit} aria-busy={busy}>
    <div className="auth-form__heading"><span className="auth-form__icon" aria-hidden="true"><UserRound size={26} /></span><h1>开始你的门店工作</h1><p>已有账号？ <Link href="/login">立即登录</Link></p></div>
    {supabaseMode ? <SocialSignIn disabled={isSubmitting} onBusyChange={setOAuthBusy} /> : null}
    <ol className={styles.stepper} aria-label="注册流程"><li><span>1</span>创建账号</li><li><span>2</span>验证邮箱</li><li><span>3</span>门店授权</li></ol>
    <div className="form-field"><label htmlFor="display-name">称呼</label><InputControl shell leading={<UserRound size={19} />} id="display-name" name="displayName" required maxLength={80} autoComplete="name" disabled={busy || unavailable} error={nameError} value={displayName} onClear={() => { setDisplayName(""); setNameError(""); setError(""); }} clearLabel="清空称呼" onChange={event => { setDisplayName(event.target.value); if (event.target.value.trim()) setNameError(""); setError(""); }} placeholder="例如：陈女士" /></div>
    <div className="form-field"><label htmlFor="register-email">电子邮件</label><InputControl shell leading={<Mail size={19} />} id="register-email" name="email" type="email" required maxLength={160} autoComplete="email" autoCapitalize="off" value={email} disabled={busy || unavailable} onChange={event => { setEmail(event.target.value); setError(""); }} onClear={() => { setEmail(""); setError(""); }} clearLabel="清空电子邮件" placeholder="name@example.com" /></div>
    <div className="form-field"><label htmlFor="register-password">设置密码</label><InputControl shell leading={<LockKeyhole size={19} />} ref={passwordInput} id="register-password" name="password" type={showPassword ? "text" : "password"} required minLength={10} maxLength={128} autoComplete="new-password" placeholder="至少 10 位，包含字母和数字" value={password} disabled={busy || unavailable} error={passwordError} onChange={event => { setPassword(event.target.value); setError(""); }} onBlur={() => setPasswordChecked(true)} aria-describedby="password-rules" trailing={<button className="input-icon-button" type="button" disabled={busy || unavailable} onClick={() => setShowPassword(value => !value)} aria-pressed={showPassword} aria-label={showPassword ? "隐藏密码" : "显示密码"}>{showPassword ? <EyeOff size={19} /> : <Eye size={19} />}</button>} /><div className={styles.rules} id="password-rules">{passwordRules.map(rule => <span key={rule.text} data-met={rule.met}>{rule.met ? <Check /> : <Circle />}{rule.text}</span>)}</div></div>
    <div className="form-field"><label htmlFor="confirm-password">确认密码</label><InputControl shell leading={<LockKeyhole size={19} />} ref={confirmInput} id="confirm-password" name="confirmPassword" type={showPassword ? "text" : "password"} required minLength={10} maxLength={128} autoComplete="new-password" value={confirmPassword} disabled={busy || unavailable} error={confirmError} onChange={event => { setConfirmPassword(event.target.value); setError(""); }} onBlur={() => setConfirmChecked(true)} placeholder="再次输入上方设置的密码" /></div>
    {!supabaseMode ? <label className="checkbox-label checkbox-label--terms"><input type="checkbox" required disabled={busy || unavailable} /><span>我了解当前提交仅为界面样板，不会创建真实账号。</span></label> : null}
    {!supabaseMode && !previewAvailable ? <p className="form-error" role="alert">注册服务尚未开放，请联系门店。</p> : null}
    {error ? <p className="form-error" role="alert">{error}</p> : null}
    <button className="button button--primary auth-submit" type="submit" disabled={busy || unavailable}>{isSubmitting ? <><LoaderCircle className="spin" size={18} />正在创建账号</> : "创建账号"}</button>
    <p className={styles.hint}>完成验证后，由门店老板授予访问权限。注册不会自动加入门店或获得管理员身份。</p>
  </form>;
}
