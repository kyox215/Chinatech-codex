"use client";

import { useState } from "react";
import { LoaderCircle } from "lucide-react";
import styles from "./auth-experience.module.css";

export function GoogleSignIn({ disabled, onBusyChange }: { disabled?: boolean; onBusyChange: (busy: boolean) => void }) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  async function signIn() {
    if (disabled || busy) return;
    setError(""); setBusy(true); onBusyChange(true);
    try {
      const response = await fetch("/api/auth/google", { method: "POST", headers: { "Content-Type": "application/json" }, body: "{}", cache: "no-store" });
      const payload = await response.json() as { redirectTo?: string; message?: string };
      if (!response.ok || !payload.redirectTo) throw new Error(payload.message || "暂时无法使用 Google 登录，请用邮箱登录或稍后重试。");
      window.location.assign(payload.redirectTo);
    } catch (reason) { setError(reason instanceof Error ? reason.message : "网络连接失败，请稍后重试。"); setBusy(false); onBusyChange(false); }
  }
  return <><button type="button" className={styles.google} disabled={disabled || busy} onClick={signIn}>{busy ? <LoaderCircle className="spin" size={18} /> : <GoogleMark />} {busy ? "正在前往 Google…" : "使用 Google 继续"}</button>{error ? <p className="form-error" role="alert">{error}</p> : null}<div className={styles.separator}>或使用邮箱</div></>;
}
function GoogleMark() { return <svg width="19" height="19" viewBox="0 0 48 48" aria-hidden="true"><path fill="#EA4335" d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5Z"/><path fill="#4285F4" d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6C44.4 38.04 46.98 31.88 46.98 24.55Z"/><path fill="#FBBC05" d="M10.53 28.59A14.4 14.4 0 0 1 9.75 24c0-1.59.27-3.13.79-4.59l-7.98-6.19A23.88 23.88 0 0 0 0 24c0 3.87.94 7.53 2.56 10.78l7.97-6.19Z"/><path fill="#34A853" d="M24 48c6.48 0 11.93-2.13 15.9-5.8l-7.73-6c-2.15 1.45-4.92 2.3-8.17 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.97 6.19C6.51 42.62 14.62 48 24 48Z"/></svg>; }
