"use client";

import Link from "next/link";
import { useState } from "react";
import { Check, LoaderCircle, Mail } from "lucide-react";
import styles from "./auth-experience.module.css";

export function VerificationSent({ email, onEdit }: { email: string; onEdit: () => void }) {
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  async function resend() {
    if (busy) return;
    setBusy(true); setMessage(""); setError("");
    try {
      const response = await fetch("/api/auth/resend", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ email }), cache: "no-store" });
      const payload = await response.json() as { message?: string };
      if (!response.ok) throw new Error(payload.message || "暂时无法重新发送，请稍后重试。");
      setMessage(payload.message || "如果此账号仍需验证，请查收最新的验证邮件。");
    } catch (reason) { setError(reason instanceof Error ? reason.message : "网络连接失败，请稍后重试。"); }
    finally { setBusy(false); }
  }
  return <div className="auth-form auth-success"><span className="auth-form__icon"><Mail size={27} /></span><h1>下一步，验证邮箱</h1><p>如果 <strong>{email}</strong> 可以注册，请查收验证邮件。在当前浏览器打开邮件里的链接，完成验证后继续登录。</p><div className="pending-steps"><span className="pending-step pending-step--done"><i><Check size={14} /></i>账号申请已提交</span><span className="pending-step"><i>2</i>打开邮件，验证邮箱</span><span className="pending-step"><i>3</i>等待门店老板授权</span></div><p className={styles.hint}>没有收到？请检查垃圾邮件，或稍后重新发送。已有账号可以直接登录。</p>{message ? <p className={styles.successNotice} role="status">{message}</p> : null}{error ? <p className="form-error" role="alert">{error}</p> : null}<div className={styles.resend}><Link className="button button--primary" href="/login">前往登录</Link><button className="button button--secondary" type="button" disabled={busy} onClick={resend}>{busy ? <><LoaderCircle className="spin" size={17} />正在提交</> : "重新发送验证邮件"}</button><button className={styles.textButton} type="button" disabled={busy} onClick={onEdit}>邮箱填写有误？返回修改</button></div></div>;
}
