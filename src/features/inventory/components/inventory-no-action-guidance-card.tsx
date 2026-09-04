"use client";

import { CircleAlert, ClipboardCheck, Eye, Loader2, ShieldCheck } from "lucide-react";

import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { useLocale } from "@/shared/i18n/locale-provider";
import type { MessageKey } from "@/shared/i18n/messages";

import { localizeInventoryNoActionGuidance } from "../lifecycle/model/inventory-lifecycle-i18n";
import type { InventoryNoActionGuidance } from "../model/inventory-no-action-guidance";

export type InventoryNoActionGuidanceCardProps = {
  guidance: InventoryNoActionGuidance;
  onReadOnly?: () => void | Promise<void>;
  privacyRedacted?: boolean;
  className?: string;
};

const copy: Record<
  InventoryNoActionGuidance["state"],
  { title: MessageKey; role: "alert" | "status"; icon: typeof CircleAlert }
> = {
  "projection-unavailable": {
    title: "inventory2b4.noAction.title.projectionUnavailable",
    role: "alert" as const,
    icon: CircleAlert,
  },
  "facts-need-review": {
    title: "inventory2b4.noAction.title.factsNeedReview",
    role: "alert" as const,
    icon: ClipboardCheck,
  },
  "terminal-complete": {
    title: "inventory2b4.noAction.title.terminalComplete",
    role: "status" as const,
    icon: ShieldCheck,
  },
  "server-readonly": {
    title: "inventory2b4.noAction.title.serverReadonly",
    role: "status" as const,
    icon: Eye,
  },
  "target-unavailable": {
    title: "inventory2b4.noAction.title.targetUnavailable",
    role: "status" as const,
    icon: Eye,
  },
  loading: {
    title: "inventory2b4.noAction.title.loading",
    role: "status" as const,
    icon: Loader2,
  },
} as const;

export function InventoryNoActionGuidanceCard({
  guidance,
  onReadOnly,
  privacyRedacted = false,
  className,
}: InventoryNoActionGuidanceCardProps) {
  const { t } = useLocale();
  const stateCopy = copy[guidance.state];
  const isLoading = guidance.state === "loading";
  const Icon = stateCopy.icon;
  const body = privacyRedacted
    ? t("inventory2b4.noAction.redacted")
    : localizeInventoryNoActionGuidance(guidance, t);

  return (
    <section
      data-ui="inventory-no-action-guidance"
      data-guidance-state={guidance.state}
      role={stateCopy.role}
      aria-live={stateCopy.role === "alert" ? "assertive" : "polite"}
      aria-busy={isLoading}
      className={cn("grid min-w-0 gap-3 rounded-xl border p-3", className)}
    >
      <div className="flex min-w-0 items-start gap-2.5">
        <span
          aria-hidden="true"
          className="grid size-10 shrink-0 place-items-center rounded-lg bg-background/80"
        >
          <Icon
            className={cn(
              "size-5",
              isLoading ? "animate-spin text-primary" : "text-status-warn-foreground",
            )}
          />
        </span>
        <div className="min-w-0">
          <h3 className="text-sm font-semibold">{t(stateCopy.title)}</h3>
          <p className="mt-1 text-xs leading-5 text-muted-foreground">{body}</p>
        </div>
      </div>
      {onReadOnly && !isLoading ? (
        <Button
          type="button"
          variant="outline"
          className="min-h-11 w-full gap-2 sm:w-fit"
          onClick={() => void onReadOnly()}
        >
          <Eye className="size-4" aria-hidden="true" />
          {t("inventory2b4.noAction.readOnly")}
        </Button>
      ) : null}
    </section>
  );
}
