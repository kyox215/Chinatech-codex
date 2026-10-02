"use client";

import Link from "next/link";
import { FormEvent, useState } from "react";
import { ArrowLeft, CheckCircle2, Eye, EyeOff, LoaderCircle, LockKeyhole, Mail, UserRound } from "lucide-react";

export function RegisterForm() {
  const [showPassword, setShowPassword] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isComplete, setIsComplete] = useState(false);

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setIsSubmitting(true);
    window.setTimeout(() => {
      setIsSubmitting(false);
      setIsComplete(true);
    }, 500);
  }

  if (isComplete) {
    return (
      <div className="auth-form auth-success" role="status">
        <span className="auth-form__icon auth-form__icon--success"><CheckCircle2 size={32} /></span>
        <h1>申请流程样板已完成</h1>
        <p>当前没有创建真实账号，也没有发送验证邮件。正式版本中，邮箱验证完成后仍需门店邀请或人工授权。</p>
        <div className="pending-steps">
          <span className="pending-step pending-step--done"><i>1</i>提交基础资料</span>
          <span className="pending-step"><i>2</i>验证邮箱</span>
          <span className="pending-step"><i>3</i>等待门店授权</span>
        </div>
        <Link className="button button--primary auth-submit" href="/login">返回登录</Link>
        <Link className="auth-back-link" href="/">返回公开首页</Link>
      </div>
    );
  }

  return (
    <form className="auth-form" onSubmit={handleSubmit}>
      <div className="auth-form__heading">
        <span className="auth-form__icon" aria-hidden="true"><UserRound size={30} /></span>
        <h1>创建待授权账户</h1>
        <p>已有账号？ <Link href="/login">返回登录</Link></p>
      </div>
      <div className="auth-notice"><strong>注册不会授予后台权限</strong><span>提交后应先验证邮箱，再由门店老板邀请或审核。</span></div>
      <div className="form-field"><label htmlFor="display-name">称呼</label><div className="input-shell"><UserRound size={20} /><input id="display-name" name="displayName" required autoComplete="name" placeholder="请输入您的称呼" /></div></div>
      <div className="form-field"><label htmlFor="register-email">电子邮件</label><div className="input-shell"><Mail size={20} /><input id="register-email" name="email" type="email" required autoComplete="email" placeholder="请输入工作邮箱" /></div></div>
      <div className="form-field"><label htmlFor="register-password">密码</label><div className="input-shell"><LockKeyhole size={20} /><input id="register-password" name="password" type={showPassword ? "text" : "password"} required minLength={10} autoComplete="new-password" placeholder="至少 10 位，包含字母与数字" /><button className="input-icon-button" type="button" onClick={() => setShowPassword((value) => !value)} aria-label={showPassword ? "隐藏密码" : "显示密码"}>{showPassword ? <EyeOff size={19} /> : <Eye size={19} />}</button></div></div>
      <label className="checkbox-label checkbox-label--terms"><input type="checkbox" required /><span>我了解当前提交仅为界面样板，不会创建真实账号。</span></label>
      <button className="button button--primary auth-submit" type="submit" disabled={isSubmitting}>{isSubmitting ? <><LoaderCircle className="spin" size={18} />正在提交样板</> : "继续"}</button>
      <Link className="auth-back-link" href="/"><ArrowLeft size={15} />返回公开首页</Link>
    </form>
  );
}
