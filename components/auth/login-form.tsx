"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { FormEvent, useState } from "react";
import { AlertCircle, Check, Eye, EyeOff, LoaderCircle, LockKeyhole, Mail } from "lucide-react";

const demoCredentials = {
  email: "demo@chinatech.local",
  password: "Preview2026!",
};

export function LoginForm() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [remember, setRemember] = useState(false);
  const [error, setError] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  function fillDemoCredentials() {
    setEmail(demoCredentials.email);
    setPassword(demoCredentials.password);
    setError("");
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");

    if (!email.trim() || !email.includes("@")) {
      setError("请输入有效的邮箱地址。");
      return;
    }

    if (!password) {
      setError("请输入密码。");
      return;
    }

    setIsSubmitting(true);
    try {
      const response = await fetch("/api/preview-session", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password, remember }),
      });
      const payload = (await response.json()) as { message?: string };
      if (!response.ok) {
        setError(payload.message ?? "登录失败，请稍后重试。");
        return;
      }
      router.replace("/app/dashboard");
      router.refresh();
    } catch {
      setError("无法连接本地预览服务，请确认开发服务器仍在运行。");
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <form className="auth-form" onSubmit={handleSubmit} noValidate>
      <div className="auth-form__heading">
        <span className="auth-form__icon" aria-hidden="true"><Mail size={30} /></span>
        <h1>登录您的账户</h1>
        <p>还没有账号？ <Link href="/register">立即注册</Link></p>
      </div>

      <div className="preview-credentials" role="note">
        <div><span><Check size={14} />本地视觉样板</span><small>不会连接真实账号或数据库</small></div>
        <button type="button" onClick={fillDemoCredentials}>填入演示账号</button>
      </div>

      <div className="form-field">
        <label htmlFor="email">电子邮件</label>
        <div className="input-shell"><Mail size={20} aria-hidden="true" /><input id="email" name="email" type="email" autoComplete="email" value={email} onChange={(event) => setEmail(event.target.value)} placeholder="请输入您的邮箱" aria-describedby={error ? "login-error" : undefined} /></div>
      </div>

      <div className="form-field">
        <label htmlFor="password">密码</label>
        <div className="input-shell"><LockKeyhole size={20} aria-hidden="true" /><input id="password" name="password" type={showPassword ? "text" : "password"} autoComplete="current-password" value={password} onChange={(event) => setPassword(event.target.value)} placeholder="请输入您的密码" aria-describedby={error ? "login-error" : undefined} /><button className="input-icon-button" type="button" onClick={() => setShowPassword((value) => !value)} aria-label={showPassword ? "隐藏密码" : "显示密码"}>{showPassword ? <EyeOff size={19} /> : <Eye size={19} />}</button></div>
      </div>

      <div className="form-options">
        <label className="checkbox-label"><input type="checkbox" checked={remember} onChange={(event) => setRemember(event.target.checked)} /><span>保持本次预览登录</span></label>
        <Link href="/forgot-password">忘记密码？</Link>
      </div>

      {error ? <p className="form-error" id="login-error" role="alert"><AlertCircle size={17} />{error}</p> : null}

      <button className="button button--primary auth-submit" type="submit" disabled={isSubmitting}>{isSubmitting ? <><LoaderCircle className="spin" size={18} />正在验证</> : "登录"}</button>
      <Link className="auth-back-link" href="/">← 返回公开首页</Link>
    </form>
  );
}
