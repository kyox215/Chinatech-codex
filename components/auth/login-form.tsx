"use client";

import { useLanguage } from "@/components/language-provider";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { FormEvent, useState } from "react";
import { AlertCircle, Check, Eye, EyeOff, LoaderCircle, LockKeyhole, Mail } from "lucide-react";
import { InputControl } from "@/components/input-control";
import { useFormReady } from "@/components/control-feedback";

import { SocialSignIn } from "./social-sign-in";
import styles from "./auth-experience.module.css";

const demoCredentials = {
  email: "demo@chinatech.local",
  password: "Preview2026!",
};

export function LoginForm({ supabaseMode = false, previewAvailable = true, notice = "" }: { supabaseMode?: boolean; previewAvailable?: boolean; notice?: string }) {
  const { t } = useLanguage();
  const ready = useFormReady();
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [remember, setRemember] = useState(false);
  const [error, setError] = useState("");
  const [fieldErrors, setFieldErrors] = useState<{ email?: string; password?: string }>({});
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [oauthBusy, setOAuthBusy] = useState(false);
  const busy = !ready || isSubmitting || oauthBusy;
  const unavailable = !supabaseMode && !previewAvailable;

  function fillDemoCredentials() {
    if (busy) return;
    setEmail(demoCredentials.email);
    setPassword(demoCredentials.password);
    setError("");
    setFieldErrors({});
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (busy || unavailable) return;
    setError("");
    setFieldErrors({});

    if (!email.trim() || !email.includes("@")) {
      setFieldErrors({ email: "邮箱格式不完整，请填写如 name@example.com 的地址。" });
      return;
    }

    if (!password) {
      setFieldErrors({ password: "请输入此账号的登录密码。" });
      return;
    }

    setIsSubmitting(true);
    try {
      const response = await fetch(supabaseMode ? "/api/auth/login" : "/api/preview-session", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        cache: "no-store",
        body: JSON.stringify({ email, password, remember }),
      });
      const payload = (await response.json()) as { message?: string };
      if (!response.ok) {
        setError(payload.message ?? "登录失败，请稍后重试。");
        return;
      }
      router.replace(supabaseMode ? "/account/pending" : "/app/dashboard");
      router.refresh();
    } catch {
      setError(supabaseMode ? "无法连接认证服务，请稍后重试。" : "无法连接本地预览服务，请确认开发服务器仍在运行。");
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <form className="auth-form" onSubmit={handleSubmit} aria-busy={busy}>
      <div className="auth-form__heading">
        <span className="auth-form__icon" aria-hidden="true"><Mail size={30} /></span>
        <h1>{t("欢迎回来")}</h1>
        <p>{t("还没有账号？ ")}<Link href="/register">{t("创建账号")}</Link></p>
      </div>

      {!supabaseMode && previewAvailable ? <div className="preview-credentials" role="note">
        <div><span><Check size={14} />{t("本地视觉样板")}</span><small>{t("不会连接真实账号或数据库")}</small></div>
        <button type="button" disabled={busy} onClick={fillDemoCredentials}>{t("填入演示账号")}</button>
      </div> : null}
      {!supabaseMode && !previewAvailable ? <p className="form-error" role="alert">{t("登录服务尚未开放，请联系门店。")}</p> : null}
      {notice ? <p className={styles.successNotice} role="status">{t(notice)}</p> : null}
      {supabaseMode ? <SocialSignIn disabled={!ready || isSubmitting} onBusyChange={setOAuthBusy} /> : null}

      <div className="form-field">
        <label htmlFor="email">{t("电子邮件")}</label>
        <InputControl shell leading={<Mail size={20} />} id="email" name="email" type="email" required maxLength={160} autoComplete="email" autoCapitalize="off" value={email} disabled={busy || unavailable} error={fieldErrors.email ? t(fieldErrors.email) : undefined} onChange={event => { setEmail(event.target.value); setFieldErrors(current => ({ ...current, email: undefined })); setError(""); }} onClear={() => { setEmail(""); setFieldErrors(current => ({ ...current, email: undefined })); setError(""); }} clearLabel={t("清空电子邮件")} placeholder="name@example.com" />
      </div>

      <div className="form-field">
        <label htmlFor="password">{t("密码")}</label>
        <InputControl shell leading={<LockKeyhole size={20} />} id="password" name="password" type={showPassword ? "text" : "password"} required maxLength={128} autoComplete="current-password" value={password} disabled={busy || unavailable} error={fieldErrors.password ? t(fieldErrors.password) : undefined} onChange={event => { setPassword(event.target.value); setFieldErrors(current => ({ ...current, password: undefined })); setError(""); }} placeholder={t("输入此账号的登录密码")} trailing={<button className="input-icon-button" type="button" disabled={busy || unavailable} onClick={() => setShowPassword(value => !value)} aria-pressed={showPassword} aria-label={showPassword ? t("隐藏密码") : t("显示密码")}>{showPassword ? <EyeOff size={19} /> : <Eye size={19} />}</button>} />
      </div>

      <div className="form-options">
        {!supabaseMode ? <><label className="checkbox-label"><input type="checkbox" checked={remember} disabled={busy || unavailable} onChange={(event) => setRemember(event.target.checked)} /><span>{t("保持本次预览登录")}</span></label><Link href="/forgot-password">{t("忘记密码？")}</Link></> : <Link href="/forgot-password">{t("忘记密码？")}</Link>}
      </div>

      {error ? <p className="form-error" id="login-error" role="alert"><AlertCircle size={17} />{t(error)}</p> : null}

      <button className="button button--primary auth-submit" type="submit" disabled={busy || unavailable}>{isSubmitting ? <><LoaderCircle className="spin" size={18} />{t("正在验证")}</> : t("登录工作台")}</button>
      <p className={styles.hint}>{t("使用已获授权的账号登录。新成员仍需门店授权。")}{supabaseMode ? <Link href="/verify-email" className={styles.verifyLink}>{t("未收到验证邮件？")}</Link> : null}</p>
    </form>
  );
}
