"use client";

import { useRouter } from "next/navigation";
import { LogOut } from "lucide-react";
import { useState } from "react";

export function LogoutButton({ compact = false }: { compact?: boolean }) {
  const router = useRouter();
  const [isPending, setIsPending] = useState(false);

  async function logout() {
    setIsPending(true);
    await fetch("/api/preview-session", { method: "DELETE" });
    router.replace("/");
    router.refresh();
  }

  return (
    <button className={compact ? "icon-button" : "profile-menu__logout"} type="button" onClick={logout} disabled={isPending} aria-label="退出本地预览">
      <LogOut size={18} />{compact ? null : <span>{isPending ? "正在退出" : "退出预览"}</span>}
    </button>
  );
}
