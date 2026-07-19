import type { Metadata, Viewport } from "next";
import { Inter, JetBrains_Mono, Space_Grotesk } from "next/font/google";
import { Providers } from "@/app/providers";
import { AppStyleRecovery } from "@/components/app-style-recovery";
import {
  repairDeskCriticalStyleGuard,
  repairDeskStyleRecoveryBootstrap,
} from "@/shared/lib/app-style-recovery";
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

const repairDeskFallbackStyle: React.CSSProperties = {
  position: "fixed",
  inset: 0,
  zIndex: 2_147_483_647,
  display: "grid",
  placeItems: "center",
  background: "Canvas",
  color: "CanvasText",
  font: '600 15px/1.4 ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif',
};

const repairDeskFallbackContentStyle: React.CSSProperties = {
  display: "grid",
  justifyItems: "center",
  gap: 12,
  padding: 24,
  textAlign: "center",
};

const repairDeskFallbackSpinnerStyle: React.CSSProperties = {
  width: 28,
  height: 28,
  border: "3px solid GrayText",
  borderTopColor: "currentColor",
  borderRadius: 999,
};

const repairDeskFallbackRetryStyle: React.CSSProperties = {
  display: "none",
  minHeight: 44,
  alignItems: "center",
  justifyContent: "center",
  border: "1px solid CanvasText",
  borderRadius: 12,
  padding: "10px 18px",
  background: "CanvasText",
  color: "Canvas",
  font: "inherit",
  cursor: "pointer",
};

const repairDeskShellStyle: React.CSSProperties = {
  display: "none",
};

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
      data-style-recovery="booting"
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
        <div
          id="repairdesk-style-fallback"
          role="status"
          aria-live="polite"
          style={repairDeskFallbackStyle}
        >
          <div style={repairDeskFallbackContentStyle}>
            <span aria-hidden="true" style={repairDeskFallbackSpinnerStyle} />
            <span id="repairdesk-style-status" suppressHydrationWarning>
              正在恢复 RepairDesk…
            </span>
            <button
              id="repairdesk-style-retry"
              type="button"
              style={repairDeskFallbackRetryStyle}
              suppressHydrationWarning
            >
              立即重试
            </button>
          </div>
        </div>
        <div id="repairdesk-styled-shell" style={repairDeskShellStyle}>
          <Providers>{children}</Providers>
        </div>
        <script
          id="repairdesk-style-recovery-bootstrap"
          dangerouslySetInnerHTML={{ __html: repairDeskStyleRecoveryBootstrap }}
        />
        <AppStyleRecovery />
      </body>
    </html>
  );
}
