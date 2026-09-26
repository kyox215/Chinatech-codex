"use client";

import Link from "next/link";
import { ArrowLeft, Send, Wrench, X } from "lucide-react";

import { PhoneText } from "@/components/orders/badges";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { brandGradientStyle, controls, pageHeader, repairOs } from "@/lib/ui-patterns";
import type { CustomerDetail } from "@/lib/repairdesk/api";
import { cn } from "@/lib/utils";
import { buildNewOrderWorkspaceHref } from "@/features/orders/model/order-workspace-intent";
import { useLocale } from "@/shared/i18n/locale-provider";

export function CustomerHero({
  data,
  onMessage,
  showBackLink = true,
  onBack,
  onClose,
}: {
  data: CustomerDetail;
  onMessage: () => void;
  showBackLink?: boolean;
  onBack?: () => void;
  onClose?: () => void;
}) {
  const { t } = useLocale();
  const { customer } = data;
  return (
    <div className={cn(repairOs.adminSection, "mb-3 min-w-0 max-w-full p-2.5 sm:p-3")}>
      <header className={cn(pageHeader.compact, "mb-3")}>
        <div className={pageHeader.titleGroup}>
          <div className="flex min-w-0 items-center gap-2 text-xs text-muted-foreground">
            {onBack ? (
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="hidden h-9 gap-1 md:inline-flex lg:hidden"
                onClick={onBack}
              >
                <ArrowLeft className="size-3.5" /> {t("customers.detail.backShort")}
              </Button>
            ) : null}
            {showBackLink ? (
              <>
                <Button asChild variant="ghost" size="sm" className="h-7 gap-1 px-1.5 text-xs">
                  <Link href="/customers">
                    <ArrowLeft className="size-3.5" /> {t("customers.detail.backShort")}
                  </Link>
                </Button>
                <span className="opacity-50">/</span>
              </>
            ) : null}
            <span className={pageHeader.eyebrow}>{t("customers.detail.title")}</span>
          </div>
          <div className="flex min-w-0 flex-wrap items-center gap-2">
            <h1 className={cn(pageHeader.title, "min-w-0 max-w-full truncate")}>
              {customer.name?.trim() || t("customers.detail.missingName")}
            </h1>
            {customer.blacklisted_at && (
              <Badge variant="destructive">{t("customers.detail.blacklisted")}</Badge>
            )}
          </div>
          <div className={cn(pageHeader.subtitle, "flex max-w-full flex-wrap items-center gap-2")}>
            <PhoneText value={customer.phone_e164} className="max-w-full truncate" />
          </div>
        </div>
        <div className={pageHeader.actions}>
          <Button
            asChild
            size="sm"
            className={cn("h-8 gap-1.5 sm:h-9", controls.brandButton)}
            style={brandGradientStyle}
          >
            <Link
              href={buildNewOrderWorkspaceHref({
                source: "customer",
                customerId: customer.id,
              })}
            >
              <Wrench className="size-4" /> {t("customers.detail.newOrder")}
            </Link>
          </Button>
          <Button size="sm" variant="outline" className="h-8 gap-1.5 sm:h-9" onClick={onMessage}>
            <Send className="size-4" /> {t("customers.channel.whatsapp")}
          </Button>
          {onClose ? (
            <Button
              type="button"
              size="icon"
              variant="outline"
              className="size-8 sm:size-9"
              onClick={onClose}
              aria-label={t("customers.detail.close")}
            >
              <X className="size-4" />
            </Button>
          ) : null}
        </div>
      </header>
    </div>
  );
}
