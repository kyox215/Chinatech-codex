import { LoginActivity } from "@/components/login-activity";
import { isSupabaseMode } from "@/lib/supabase/config";
import type { Metadata } from "next";
import { LegacyServiceWorkerCleanup } from "@/components/legacy-service-worker-cleanup";
import { LanguageProvider } from "@/components/language-provider";
import { OperationFeedbackProvider } from "@/components/operation-feedback";
import { ToastProvider } from "@/components/toast";
import { LocalWebVitals } from "@/components/local-web-vitals";
import { localWebVitalsEnabled } from "@/lib/local-web-vitals";
import "./globals.css";

export const metadata: Metadata = {
  title: {
    default: "ChinaTech｜维修与整机管理",
    template: "%s｜ChinaTech",
  },
  description: "面向维修门店的工单、采购跟进与一机一档管理网站。",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  const measure = localWebVitalsEnabled({enabled:process.env.LOCAL_WEB_VITALS,vercel:process.env.VERCEL,origin:process.env.APP_ORIGIN});
  return (
    <html lang="zh-CN">
      <body>{measure ? <LocalWebVitals /> : null}<LegacyServiceWorkerCleanup /><LanguageProvider><ToastProvider><OperationFeedbackProvider><LoginActivity enabled={isSupabaseMode()} />{children}</OperationFeedbackProvider></ToastProvider></LanguageProvider></body>
    </html>
  );
}
