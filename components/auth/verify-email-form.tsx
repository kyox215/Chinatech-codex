"use client";

import { useLanguage } from "@/components/language-provider";
import Link from "next/link";
import { FormEvent, useState } from "react";
import { LoaderCircle, Mail } from "lucide-react";
import { InputControl } from "@/components/input-control";
import { useFormReady } from "@/components/control-feedback";
import styles from "./auth-experience.module.css";

export function VerifyEmailForm({ supabaseMode }: { supabaseMode: boolean }) {
  const { t } = useLanguage();
  const ready = useFormReady();
  const [busy, setBusy] = useState(false);
  const [complete, setComplete] = useState(false);
  const [error, setError] = useState("");
  const [email, setEmail] = useState("");
  const locked = !ready || busy;
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (locked || !supabaseMode) return;
    const form = new FormData(event.currentTarget);
    setBusy(true); setError("");
    try {
      const response = await fetch("/api/auth/resend", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ email: form.get("email") }), cache: "no-store" });
      const payload = await response.json() as { message?: string };
      if (!response.ok) throw new Error(payload.message || "暂时无法发送验证邮件，请稍后再试。");
      setComplete(true);
    } catch (reason) { setError(reason instanceof Error ? reason.message : "连接失败，请稍后再试。"); }
    finally { setBusy(false); }
  }
  if (complete) return <div className="auth-form auth-success" role="status"><span className="auth-form__icon"><Mail size={26} /></span><h1>{t("请查收验证邮件")}</h1><p>{t("如果此账号仍需验证，请打开最新验证邮件。完成验证后，由门店老板授予访问权限。")}</p><p className={styles.hint}>{t("请使用注册时的浏览器打开链接；如果账号已验证，可直接登录。")}</p><Link className="button button--primary" href="/login">{t("前往登录")}</Link><button className={styles.textButton} type="button" onClick={() => setComplete(false)}>{t("修改邮箱或重试")}</button></div>;
  return <form className="auth-form" onSubmit={submit} aria-busy={locked}><div className="auth-form__heading"><span className="auth-form__icon"><Mail size={26} /></span><h1>{t("重新验证邮箱")}</h1><p>{t("没收到邮件，或原链接已过期？重新获取验证链接。")}</p></div><div className="form-field"><label htmlFor="verify-email">{t("注册邮箱")}</label><InputControl shell leading={<Mail size={18} />} id="verify-email" name="email" type="email" autoComplete="email" autoCapitalize="off" maxLength={160} required disabled={locked || !supabaseMode} value={email} onChange={event => { setEmail(event.target.value); setError(""); }} onClear={() => { setEmail(""); setError(""); }} clearLabel={t("清空电子邮件")} placeholder="name@example.com" /></div><p className={styles.hint}>{t("请在注册时使用的浏览器操作。验证邮箱不会自动授予门店权限。")}</p>{!supabaseMode ? <p className="auth-notice">{t("当前为本地预览，不会发送验证邮件。")}</p> : null}{error ? <p className="form-error" role="alert">{t(error)}</p> : null}<button className="button button--primary auth-submit" type="submit" disabled={locked || !supabaseMode}>{busy ? <><LoaderCircle size={18} className="spin" />{t("正在提交")}</> : t("重新发送验证邮件")}</button><Link className="auth-back-link" href="/login">{t("返回登录")}</Link></form>;
}
