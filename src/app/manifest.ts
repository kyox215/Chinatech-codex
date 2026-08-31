import type { MetadataRoute } from "next";
import { getServerLocale } from "@/shared/i18n/server";
import { translateMessage } from "@/shared/i18n/messages";

export default async function manifest(): Promise<MetadataRoute.Manifest> {
  const locale = await getServerLocale();
  return {
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
}
