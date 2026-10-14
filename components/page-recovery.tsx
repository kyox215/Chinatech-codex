"use client";

import { NavigationLink as Link } from "@/components/navigation-link";
import { useSyncExternalStore, useTransition } from "react";
import { AlertCircle, WifiOff } from "lucide-react";
import { PageTitle } from "./page-title";
import { useLanguage } from "./language-provider";
import { useRouter } from "next/navigation";

function subscribeNetwork(notify: () => void) {
  window.addEventListener("online", notify);
  window.addEventListener("offline", notify);
  return () => { window.removeEventListener("online", notify); window.removeEventListener("offline", notify); };
}
export function useOnline() {
  return useSyncExternalStore(subscribeNetwork, () => navigator.onLine, () => true);
}

/** A read failure is never presented as an empty or missing business record. */
export function ReadFailure({ message }: { message: string }) {
  const { t, systemText } = useLanguage();
  const router = useRouter();
  const online = useOnline();
  const [pending, startTransition] = useTransition();
  return <section className="panel module-empty" role="alert" aria-busy={pending}><AlertCircle size={28} aria-hidden="true" /><strong>{t("资料暂时无法读取")}</strong><p>{systemText(message)}</p><button type="button" className="button button--secondary" disabled={!online || pending} aria-busy={pending} onClick={() => startTransition(() => router.refresh())}>{pending ? t("正在重新读取…") : t("重试加载")}</button></section>;
}

/** Error recovery only re-reads the route; it never repeats a business submission. */
export function PageRecovery({ retry, internal = false }: { retry: () => void; internal?: boolean }) {
  const { t } = useLanguage();
  const online = useOnline();
  const [pending, startTransition] = useTransition();
  return <main className={internal ? "module-page" : "page-state"}>
    {internal ? <header className="module-heading"><PageTitle title={t("页面暂时无法载入")} /></header> : null}
    <section className="panel module-empty" aria-busy={pending}>
      {online ? <AlertCircle size={32} aria-hidden="true" /> : <WifiOff size={32} aria-hidden="true" />}
      {internal ? <strong>{online ? t("页面暂时无法载入") : t("当前设备未连接网络")}</strong> : <h1>{online ? t("页面暂时无法载入") : t("当前设备未连接网络")}</h1>}
      <p role="alert">{online ? t("请重试加载页面；未确认的提交请先核对结果。") : t("请恢复网络连接后重试；此操作不会重新提交业务。")}</p>
      <div className="page-state__actions"><button type="button" className="button button--primary" disabled={!online || pending} aria-busy={pending} onClick={() => startTransition(retry)}>{pending ? t("正在加载…") : t("重试加载")}</button><Link className="button button--secondary" href="/">{t("返回首页")}</Link></div>
    </section>
  </main>;
}

export function PageLoading({ internal = false, label = "正在加载…", backHref }: { internal?: boolean; label?: string; backHref?: string }) {
  const { t } = useLanguage();
  return <main className="module-page" aria-busy="true">{internal ? <header className="module-heading"><PageTitle title={t(label)} backHref={backHref} backLabel={t("返回首页")} /></header> : <div className="module-skeleton module-skeleton--heading" aria-hidden="true" />}<p role="status">{t(label)}</p><div className="module-skeleton module-skeleton--cards" aria-hidden="true" /><div className="module-skeleton module-skeleton--list" aria-hidden="true" /></main>;
}
