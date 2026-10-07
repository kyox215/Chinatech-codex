"use client";

import { useLanguage } from "@/components/language-provider";
import { useRef, useState } from "react";
import { LoaderCircle } from "lucide-react";
import { ProviderMark } from "./provider-mark";
import styles from "./auth-experience.module.css";

export function SocialSignIn({ disabled, onBusyChange, remember = false }: { disabled?: boolean; remember?: boolean; onBusyChange: (busy: boolean) => void }) {
  const { t , systemText } = useLanguage();
  const [busy, setBusy] = useState<"google" | "apple" | null>(null);
  const [error, setError] = useState("");
  const inFlight = useRef(false);
  async function signIn(provider: "google" | "apple") {
    if (disabled || inFlight.current) return;
    inFlight.current = true;
    setError(""); setBusy(provider); onBusyChange(true);
    try {
      const response = await fetch(`/api/auth/${provider}`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ remember }), cache: "no-store", signal: AbortSignal.timeout(20000) });
      const payload = await response.json() as { redirectTo?: string; message?: string };
      if (!response.ok || !payload.redirectTo) throw new Error(payload.message || "暂时无法继续，请使用邮箱登录或稍后重试。");
      window.location.assign(payload.redirectTo);
    } catch (reason) {
      setError(reason instanceof Error && reason.name !== "TimeoutError" ? reason.message : "连接超时，请稍后重试。");
      inFlight.current = false; setBusy(null); onBusyChange(false);
    }
  }
  return <>
    <div className={styles.socialOptions} aria-label={t("其他登录方式")}>
      {(["google", "apple"] as const).map(provider => <button key={provider} type="button" className={styles.socialButton} disabled={disabled || Boolean(busy)} onClick={() => signIn(provider)}>
        {busy === provider ? <LoaderCircle className="spin" size={19} aria-hidden="true" /> : <ProviderMark provider={provider} />}
        {busy === provider ? t("正在前往…") : t("使用 {provider} 继续", { provider: provider === "google" ? "Google" : "Apple" })}
      </button>)}
    </div>
    {error ? <p className="form-error" role="alert">{systemText(error)}</p> : null}
    <div className={styles.separator}>{t("或使用邮箱")}</div>
  </>;
}
