import type { MetadataRoute } from "next";
import type { NextRequest } from "next/server";
import { readLocaleCookie, resolvePreferredLocale } from "@/shared/i18n/locales";
import { translateMessage } from "@/shared/i18n/messages";

export function GET(request: NextRequest) {
  // Read the explicit request: metadata discovery can run outside request scope in dev.
  const locale =
    readLocaleCookie(request.headers.get("cookie") ?? "") ??
    resolvePreferredLocale(request.headers.get("accept-language"));
  const manifest: MetadataRoute.Manifest = {
    lang: locale,
    name: "RepairDesk",
    short_name: "RepairDesk",
    description: translateMessage(locale, "manifest.description"),
    start_url: "/orders",
    scope: "/",
    display: "standalone",
    background_color: "#ffffff",
    theme_color: "#ffffff",
    orientation: "portrait-primary",
    icons: [
      {
        src: "/icons/repairdesk-icon.svg",
        sizes: "any",
        type: "image/svg+xml",
        purpose: "any",
      },
      {
        src: "/icons/repairdesk-icon.svg",
        sizes: "any",
        type: "image/svg+xml",
        purpose: "maskable",
      },
    ],
    categories: ["business", "productivity"],
  };
  return Response.json(manifest, {
    headers: {
      "Content-Type": "application/manifest+json",
      "Cache-Control": "private, no-store",
      Vary: "Cookie, Accept-Language",
    },
  });
}
