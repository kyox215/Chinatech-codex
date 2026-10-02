import type { Metadata } from "next";
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
    <html lang="zh-CN" data-scroll-behavior="smooth">
      <body>{children}</body>
    </html>
  );
}
