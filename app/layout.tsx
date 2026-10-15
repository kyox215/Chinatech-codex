import { LoginActivity } from "@/components/login-activity";
import { isSupabaseMode } from "@/lib/supabase/config";
import type { Metadata } from "next";
import { LegacyServiceWorkerCleanup } from "@/components/legacy-service-worker-cleanup";
import { LanguageProvider } from "@/components/language-provider";
import { OperationFeedbackProvider } from "@/components/operation-feedback";
import "./globals.css";

export const metadata: Metadata = {
  title: {
    default: "ChinaTech｜维修与整机管理",
    template: "%s｜ChinaTech",
  },
  description: "面向维修门店的工单、采购跟进与一机一档管理网站。",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="zh-CN">
      <body><LegacyServiceWorkerCleanup /><LanguageProvider><OperationFeedbackProvider><LoginActivity enabled={isSupabaseMode()} />{children}</OperationFeedbackProvider></LanguageProvider></body>
    </html>
  );
}
