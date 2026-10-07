"use client";

import { useLanguage } from "@/components/language-provider";
import { useRouter } from "next/navigation";
import { LogOut } from "lucide-react";
import { useState } from "react";
import { clearBackend } from "@/lib/backend/client";
import { notifyAuthChanged } from "@/lib/auth-events";

export function LogoutButton({ compact = false, supabaseMode = false, className }: { compact?: boolean; supabaseMode?: boolean; className?: string }) {
  const { t , systemText } = useLanguage();
  const router = useRouter();
  const [isPending, setIsPending] = useState(false);
  const [error, setError] = useState("");

  async function logout() {
    setIsPending(true);
    setError("");
    try {
      const response = await fetch(supabaseMode ? "/api/auth/logout" : "/api/preview-session", { method: supabaseMode ? "POST" : "DELETE", cache: "no-store" });
      if (!response.ok) { setError("退出失败，请稍后重试。"); return; }
      if(supabaseMode) clearBackend();
      notifyAuthChanged();
      router.replace("/"); router.refresh();
    } catch { setError("无法连接退出服务，请稍后重试。"); }
    finally { setIsPending(false); }
  }

  return (
    <><button className={`${compact ? "icon-button" : "profile-menu__logout"} ${className ?? ""}`} type="button" onClick={logout} disabled={isPending} title={supabaseMode ? t("退出登录") : t("退出本地预览")} aria-label={supabaseMode ? t("退出登录") : t("退出本地预览")}>
      <LogOut size={18} />{compact ? null : <span>{isPending ? t("正在退出") : supabaseMode ? t("退出登录") : t("退出预览")}</span>}
    </button>{error ? <small className="form-error" role="alert">{systemText(error)}</small> : null}</>
  );
}
