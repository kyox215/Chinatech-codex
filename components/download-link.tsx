"use client";
import { createContext, useContext, useState, type ComponentProps, type ReactNode } from "react";
import { Toast } from "./toast";
import { useLanguage } from "./language-provider";

const RequestedDownload = createContext<() => void>(() => {});
export function DownloadFeedbackProvider({ children }: { children: ReactNode }) {
  const { t } = useLanguage();
  const [notice, setNotice] = useState("");
  function requested() { setNotice(crypto.randomUUID()); }
  return <RequestedDownload.Provider value={requested}>{children}{Boolean(notice) && <Toast noticeId={`download:${notice}`} message={t("已发起下载，请查看浏览器的下载列表。")} />}</RequestedDownload.Provider>;
}
/** Native downloads stay native; the website cannot claim the file completed. */
export function DownloadLink({ onClick, ...props }: ComponentProps<"a">) {
  const requested = useContext(RequestedDownload);
  return <a {...props} onClick={event => { onClick?.(event); if (!event.defaultPrevented && !event.metaKey && !event.ctrlKey && !event.shiftKey && !event.altKey && event.button === 0) requested(); }} />;
}
