import type { Metadata, Viewport } from "next";
import { Inter, JetBrains_Mono, Space_Grotesk } from "next/font/google";
import { Providers } from "@/app/providers";
import { AppStyleRecovery } from "@/components/app-style-recovery";
import { repairDeskCriticalStyleGuard } from "@/shared/lib/app-style-recovery";
import "@/styles.css";

const repairDeskSans = Inter({
  subsets: ["latin"],
  display: "swap",
  variable: "--repairdesk-font-sans",
});

const repairDeskDisplay = Space_Grotesk({
  subsets: ["latin"],
  display: "swap",
  variable: "--repairdesk-font-display",
  preload: false,
});

const repairDeskMono = JetBrains_Mono({
  subsets: ["latin"],
  display: "swap",
  variable: "--repairdesk-font-mono",
  preload: false,
});

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
    <html
      lang="zh-CN"
      className={`${repairDeskSans.variable} ${repairDeskDisplay.variable} ${repairDeskMono.variable}`}
      suppressHydrationWarning
    >
      <head>
        <style id="repairdesk-critical-style-guard">{repairDeskCriticalStyleGuard}</style>
        <script
          dangerouslySetInnerHTML={{
            __html: `try{document.documentElement.classList.toggle("dark",localStorage.getItem("repairdesk-theme")==="dark")}catch(e){}`,
          }}
        />
      </head>
      <body>
        <div id="repairdesk-style-fallback" role="status" aria-live="polite">
          <div>
            <span aria-hidden="true" />
            <span>正在恢复 RepairDesk…</span>
          </div>
        </div>
        <div id="repairdesk-styled-shell">
          <Providers>{children}</Providers>
        </div>
        <AppStyleRecovery />
      </body>
    </html>
  );
}
