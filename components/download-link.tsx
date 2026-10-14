"use client";
import { createContext, useContext, useEffect, useRef, useState, type ComponentProps, type ReactNode } from "react";
import { CheckCircle2, X } from "lucide-react";
import { useLanguage } from "./language-provider";

const RequestedDownload = createContext<() => void>(() => {});
export function DownloadFeedbackProvider({ children }: { children: ReactNode }) {
  const { t } = useLanguage();
  const [visible, setVisible] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const clear = () => { if (timer.current) clearTimeout(timer.current); timer.current = null; };
  useEffect(() => clear, []);
  function requested() { clear(); setVisible(true); timer.current = setTimeout(() => { setVisible(false); timer.current = null; }, 8000); }
  return <RequestedDownload.Provider value={requested}>{children}{visible && <aside className="download-notice"><CheckCircle2 size={18} aria-hidden="true" /><p role="status">{t("已发起下载，请查看浏览器的下载列表。")}</p><button className="icon-button" type="button" aria-label={t("关闭下载提示")} onClick={() => { clear(); setVisible(false); }}><X size={18} aria-hidden="true" /></button></aside>}</RequestedDownload.Provider>;
}
/** Native downloads stay native; the website cannot claim the file completed. */
export function DownloadLink({ onClick, ...props }: ComponentProps<"a">) {
  const requested = useContext(RequestedDownload);
  return <a {...props} onClick={event => { onClick?.(event); if (!event.defaultPrevented && !event.metaKey && !event.ctrlKey && !event.shiftKey && !event.altKey && event.button === 0) requested(); }} />;
}
