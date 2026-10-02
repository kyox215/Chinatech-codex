"use client";

import { useRef, useState } from "react";
import { LoaderCircle } from "lucide-react";
import { ProviderMark } from "./provider-mark";
import styles from "./auth-experience.module.css";

export function SocialSignIn({ disabled, onBusyChange }: { disabled?: boolean; onBusyChange: (busy: boolean) => void }) {
  const [busy, setBusy] = useState<"google" | "apple" | null>(null);
  const [error, setError] = useState("");
  const inFlight = useRef(false);
  async function signIn(provider: "google" | "apple") {
    if (disabled || inFlight.current) return;
    inFlight.current = true;
    setError(""); setBusy(provider); onBusyChange(true);
    try {
      const response = await fetch(`/api/auth/${provider}`, { method: "POST", headers: { "Content-Type": "application/json" }, body: "{}", cache: "no-store", signal: AbortSignal.timeout(20000) });
      const payload = await response.json() as { redirectTo?: string; message?: string };
      if (!response.ok || !payload.redirectTo) throw new Error(payload.message || "暂时无法继续，请使用邮箱登录或稍后重试。");
      window.location.assign(payload.redirectTo);
    } catch (reason) {
      setError(reason instanceof Error && reason.name !== "TimeoutError" ? reason.message : "连接超时，请稍后重试。");
      inFlight.current = false; setBusy(null); onBusyChange(false);
    }
  }
  return <>
    <div className={styles.socialOptions} aria-label="其他登录方式">
      {(["google", "apple"] as const).map(provider => <button key={provider} type="button" className={styles.socialButton} disabled={disabled || Boolean(busy)} onClick={() => signIn(provider)}>
        {busy === provider ? <LoaderCircle className="spin" size={19} aria-hidden="true" /> : <ProviderMark provider={provider} />}
        {busy === provider ? "正在前往…" : `使用 ${provider === "google" ? "Google" : "Apple"} 继续`}
      </button>)}
    </div>
    {error ? <p className="form-error" role="alert">{error}</p> : null}
    <div className={styles.separator}>或使用邮箱</div>
  </>;
}
