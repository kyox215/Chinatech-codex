"use client";

import Link from "next/link";
import { ArrowLeft, Bell, Edit3, Send, Wrench, X } from "lucide-react";

import { PhoneText } from "@/components/orders/badges";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { CustomerDetailTagList } from "@/features/customers/components/customer-profile-blocks";
import { getCustomerDetailWorkSummary } from "@/features/customers/model/customer-list";
import { brandGradientStyle, controls, pageHeader, repairOs } from "@/lib/ui-patterns";
import type { CustomerDetail } from "@/lib/repairdesk/api";
import { cn } from "@/lib/utils";
import { uniqueContactPhones } from "@/shared/lib/phone";
import { buildNewOrderWorkspaceHref } from "@/features/orders/model/order-workspace-intent";
import { localizeCustomerWorkSummary } from "@/features/customers/model/customer-i18n";
import { useLocale } from "@/shared/i18n/locale-provider";

export function CustomerHero({
  data,
  onMessage,
  onFollowup,
  onEdit,
  showBackLink = true,
  onClose,
}: {
  data: CustomerDetail;
  onMessage: () => void;
  onFollowup: () => void;
  onEdit: () => void;
  showBackLink?: boolean;
  onClose?: () => void;
}) {
  const { t } = useLocale();
  const { customer } = data;
  const summary = localizeCustomerWorkSummary(getCustomerDetailWorkSummary(data), t);
  const backupPhones = uniqueContactPhones(customer.phone_e164, customer.contact_phones);
  return (
    <div className={cn(repairOs.adminSection, "mb-3 min-w-0 max-w-full p-2.5 sm:p-3")}>
      <header className={cn(pageHeader.compact, "mb-3")}>
        <div className={pageHeader.titleGroup}>
          <div className="flex min-w-0 items-center gap-2 text-xs text-muted-foreground">
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
            <h1 className={cn(pageHeader.title, "min-w-0 max-w-full truncate")}>{customer.name}</h1>
            {customer.blacklisted_at && (
              <Badge variant="destructive">{t("customers.detail.blacklisted")}</Badge>
            )}
            <Badge variant="secondary">
              {customer.preferred_channel === "sms" ? "SMS" : "WhatsApp"}
            </Badge>
          </div>
          <div className={cn(pageHeader.subtitle, "flex max-w-full flex-wrap items-center gap-2")}>
            <PhoneText value={customer.phone_e164} className="max-w-full truncate" />
            {customer.email && (
              <span className="min-w-0 max-w-full truncate" title={customer.email}>
                {customer.email}
              </span>
            )}
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
            <Send className="size-4" /> {t("customers.detail.sendMessage")}
          </Button>
          <Button size="sm" variant="outline" className="h-8 gap-1.5 sm:h-9" onClick={onFollowup}>
            <Bell className="size-4" /> {t("customers.detail.addFollowup")}
          </Button>
          <Button
            type="button"
            size="icon"
            variant="outline"
            className="size-8 sm:size-9"
            onClick={onEdit}
            aria-label={t("customers.detail.edit")}
          >
            <Edit3 className="size-4" />
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

      {backupPhones.length > 0 && (
        <div className="flex min-w-0 flex-wrap items-center gap-1.5 text-xs text-muted-foreground">
          <span>{t("customers.detail.backupPhones")}</span>
          {backupPhones.map((phone) => (
            <span
              key={phone}
              className="max-w-36 truncate rounded-md bg-surface-muted px-1.5 py-0.5 font-mono"
              title={phone}
            >
              {phone}
            </span>
          ))}
        </div>
      )}
      <div className="mt-2">
        <CustomerDetailTagList tags={data.tags} />
      </div>
      <div className="mt-2 grid max-w-xl grid-cols-[minmax(0,1fr)_auto] items-center gap-2 rounded-lg bg-[var(--surface-panel-muted)] px-2.5 py-1.5">
        <div className="min-w-0">
          <p className="truncate text-[10px] leading-3 text-muted-foreground lg:text-[11px] lg:leading-4">
            {t("customers.detail.suggestion")}
          </p>
          <p className="truncate text-xs font-medium leading-5">{summary.actionLabel}</p>
        </div>
        <span
          className={cn(
            "shrink-0 rounded-full px-2 py-1 text-[10px] font-semibold lg:text-[11px] lg:leading-4",
            customerSummaryToneClass(summary.tone),
          )}
        >
          {summary.label}
        </span>
      </div>
    </div>
  );
}

function customerSummaryToneClass(tone: ReturnType<typeof getCustomerDetailWorkSummary>["tone"]) {
  if (tone === "info") return "bg-status-info text-status-info-foreground";
  if (tone === "warning") return "bg-status-warn text-status-warn-foreground";
  if (tone === "success") return "bg-status-success text-status-success-foreground";
  return "bg-status-neutral text-status-neutral-foreground";
}
