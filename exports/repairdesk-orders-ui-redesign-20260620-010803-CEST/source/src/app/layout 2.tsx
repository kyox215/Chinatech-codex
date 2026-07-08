import type { Metadata, Viewport } from "next";
import { Providers } from "@/app/providers";
import "@/styles.css";

export const metadata: Metadata = {
  title: {
    default: "RepairDesk — 维修工单后台",
    template: "%s — RepairDesk",
  },
  description: "现代化手机维修接单管理后台",
  applicationName: "RepairDesk",
  manifest: "/manifest.webmanifest",
  appleWebApp: {
    capable: true,
    statusBarStyle: "default",
    title: "RepairDesk",
  },
  icons: {
    icon: "/icons/repairdesk-icon.svg",
    apple: "/icons/repairdesk-icon.svg",
  },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  themeColor: "#ffffff",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="zh-CN" suppressHydrationWarning>
      <head>
        <script
          dangerouslySetInnerHTML={{
            __html: `try{document.documentElement.classList.toggle("dark",localStorage.getItem("repairdesk-theme")==="dark")}catch(e){}`,
          }}
        />
      </head>
      <body>
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
