"use client";

import Link from "next/link";
import { FormEvent, useState } from "react";
import { Check, CheckCircle2, Circle, Eye, EyeOff, LoaderCircle, LockKeyhole, Mail, UserRound } from "lucide-react";
import { GoogleSignIn } from "./google-sign-in";
import { VerificationSent } from "./verification-sent";
import styles from "./auth-experience.module.css";

export function RegisterForm({ supabaseMode = false, previewAvailable = true }: { supabaseMode?: boolean; previewAvailable?: boolean }) {
  const [showPassword, setShowPassword] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [oauthBusy, setOAuthBusy] = useState(false);
  const [isComplete, setIsComplete] = useState(false);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const passwordRules = [{ text: "至少 10 位", met: password.length >= 10 }, { text: "包含字母与数字", met: /\p{L}/u.test(password) && /\d/.test(password) }];

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (isSubmitting || oauthBusy || !supabaseMode && !previewAvailable) return;
    const form = new FormData(event.currentTarget);
    setError("");
    if (!passwordRules.every(rule => rule.met)) { setError("密码至少 10 位，并包含字母与数字。"); return; }
    if (password !== form.get("confirmPassword")) { setError("两次输入的密码不一致，请重新核对。"); return; }
    setIsSubmitting(true);
    try {
      if (supabaseMode) {
        const response = await fetch("/api/auth/register", { method: "POST", headers: { "Content-Type": "application/json" }, cache: "no-store", body: JSON.stringify({ displayName: form.get("displayName"), email, password }) });
        const payload = await response.json() as { message?: string };
        if (!response.ok) { setError(payload.message ?? "无法完成注册，请稍后重试。"); return; }
      }
      setPassword(""); setIsComplete(true);
    } catch { setError("无法连接注册服务，请稍后重试。"); }
    finally { setIsSubmitting(false); }
  }
  if (isComplete) return supabaseMode ? <VerificationSent email={email} onEdit={() => setIsComplete(false)} /> : <div className="auth-form auth-success" role="status"><span className="auth-form__icon"><CheckCircle2 size={28} /></span><h1>申请流程样板已完成</h1><p>当前没有创建真实账号，也没有发送验证邮件。正式注册后仍需门店授权。</p><Link className="button button--primary" href="/login">返回登录</Link></div>;

  return <form className="auth-form" onSubmit={handleSubmit}>
    <div className="auth-form__heading"><span className="auth-form__icon" aria-hidden="true"><UserRound size={26} /></span><h1>开始你的门店工作</h1><p>已有账号？ <Link href="/login">立即登录</Link></p></div>
    {supabaseMode ? <GoogleSignIn disabled={isSubmitting} onBusyChange={setOAuthBusy} /> : null}
    <ol className={styles.stepper} aria-label="注册流程"><li><span>1</span>创建账号</li><li><span>2</span>验证邮箱</li><li><span>3</span>门店授权</li></ol>
    <div className="form-field"><label htmlFor="display-name">称呼</label><div className="input-shell"><UserRound size={19} aria-hidden="true" /><input id="display-name" name="displayName" required maxLength={80} autoComplete="name" placeholder="我们该如何称呼你" /></div></div>
    <div className="form-field"><label htmlFor="register-email">电子邮件</label><div className="input-shell"><Mail size={19} aria-hidden="true" /><input id="register-email" name="email" type="email" required maxLength={160} autoComplete="email" value={email} onChange={event => setEmail(event.target.value)} placeholder="name@example.com" /></div></div>
    <div className="form-field"><label htmlFor="register-password">设置密码</label><div className="input-shell"><LockKeyhole size={19} aria-hidden="true" /><input id="register-password" name="password" type={showPassword ? "text" : "password"} required minLength={10} maxLength={128} autoComplete="new-password" placeholder="至少 10 位，包含字母和数字" value={password} onChange={event => setPassword(event.target.value)} aria-describedby="password-rules" /><button className="input-icon-button" type="button" onClick={() => setShowPassword(value => !value)} aria-pressed={showPassword} aria-label={showPassword ? "隐藏密码" : "显示密码"}>{showPassword ? <EyeOff size={19} /> : <Eye size={19} />}</button></div><div className={styles.rules} id="password-rules">{passwordRules.map(rule => <span key={rule.text} data-met={rule.met}>{rule.met ? <Check /> : <Circle />}{rule.text}</span>)}</div></div>
    <div className="form-field"><label htmlFor="confirm-password">确认密码</label><div className="input-shell"><LockKeyhole size={19} aria-hidden="true" /><input id="confirm-password" name="confirmPassword" type={showPassword ? "text" : "password"} required minLength={10} maxLength={128} autoComplete="new-password" placeholder="再输入一次密码" /></div></div>
    {!supabaseMode ? <label className="checkbox-label checkbox-label--terms"><input type="checkbox" required /><span>我了解当前提交仅为界面样板，不会创建真实账号。</span></label> : null}
    {!supabaseMode && !previewAvailable ? <p className="form-error" role="alert">注册服务尚未开放，请联系门店。</p> : null}
    {error ? <p className="form-error" role="alert">{error}</p> : null}
    <button className="button button--primary auth-submit" type="submit" disabled={isSubmitting || oauthBusy || !supabaseMode && !previewAvailable}>{isSubmitting ? <><LoaderCircle className="spin" size={18} />正在创建账号</> : "创建账号"}</button>
    <p className={styles.hint}>完成验证后，由门店老板授予访问权限。注册不会自动加入门店或获得管理员身份。</p>
  </form>;
}
