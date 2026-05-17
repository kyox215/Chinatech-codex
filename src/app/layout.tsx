import type { Metadata, Viewport } from "next";
import { Providers } from "@/app/providers";
import "@/styles.css";

export const metadata: Metadata = {
  title: {
    default: "RepairDesk — 维修工单后台",
    template: "%s — RepairDesk",
  },
  description: "现代化手机维修接单管理后台",
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  themeColor: "#1a1330",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="zh-CN" className="dark" suppressHydrationWarning>
      <body>
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
