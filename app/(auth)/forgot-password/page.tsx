import Link from "next/link";
import { ArrowLeft, Mail } from "lucide-react";

export default function ForgotPasswordPage() {
  return (
    <form className="auth-form" action="/login">
      <div className="auth-form__heading"><span className="auth-form__icon"><Mail size={30} /></span><h1>找回密码</h1><p>输入邮箱后，正式版本会返回统一提示。</p></div>
      <div className="auth-notice"><strong>视觉样板未接入邮件服务</strong><span>不会判断或公开该邮箱是否存在，也不会发送真实邮件。</span></div>
      <div className="form-field"><label htmlFor="reset-email">电子邮件</label><div className="input-shell"><Mail size={20} /><input id="reset-email" type="email" required autoComplete="email" placeholder="请输入您的邮箱" /></div></div>
      <button className="button button--primary auth-submit" type="submit">返回统一结果页</button>
      <Link className="auth-back-link" href="/login"><ArrowLeft size={15} />返回登录</Link>
    </form>
  );
}
