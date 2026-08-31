"use client";

import { WifiOff } from "lucide-react";

import { pageShell, stateBlocks } from "@/lib/ui-patterns";
import { useLocale } from "@/shared/i18n/locale-provider";

export function OfflineScreen() {
  const { t } = useLocale();

  return (
    <div className={pageShell.detail}>
      <section className="glass-card mx-auto mt-6 max-w-md p-3 text-center sm:mt-16 sm:p-6">
        <div
          className={stateBlocks.emptyIcon}
          style={{ background: "var(--gradient-brand)" }}
          aria-hidden="true"
        >
          <WifiOff className="size-5" />
        </div>
        <h1 className="mt-1.5 font-display text-xl font-semibold tracking-tight sm:mt-2 sm:text-2xl">
          {t("offline.title")}
        </h1>
        <p className="mt-2 text-sm text-muted-foreground">{t("offline.description")}</p>
      </section>
    </div>
  );
}
