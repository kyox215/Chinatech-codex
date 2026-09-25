"use client";

import { CheckCircle2, Edit3, Plus, Send, Tags } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  CustomerEmptyLine,
  CustomerInfoBlock,
  CustomerTimelineList,
  formatCustomerDateTime,
} from "@/features/customers/components/customer-profile-blocks";
import type { CustomerDetail } from "@/lib/repairdesk/api";
import { RepairOsBusinessCard, RepairOsSectionHeader } from "@/shared/ui";
import { repairOs } from "@/lib/ui-patterns";
import { cn } from "@/lib/utils";
import { useLocale } from "@/shared/i18n/locale-provider";
import { PhoneText } from "@/components/orders/badges";
import { uniqueContactPhones } from "@/shared/lib/phone";
import {
  localizeCustomerChannel,
  localizeCustomerFollowupStatus,
  localizeCustomerLanguage,
} from "@/features/customers/model/customer-i18n";

const customerDetailSectionClass = cn(repairOs.mobileInfoCard, "sm:p-2.5 md:rounded-2xl md:p-3");
const customerDetailSectionTitleClass = "text-[11px] leading-4 sm:text-sm lg:text-sm lg:leading-5";

export function CustomerMessagesPanel({
  interactions,
  onMessage,
}: {
  interactions: CustomerDetail["interactions"];
  onMessage: () => void;
}) {
  const { locale, t } = useLocale();
  return (
    <section className={customerDetailSectionClass}>
      <RepairOsSectionHeader
        title={t("customers.detail.contactRecords")}
        className="mb-2"
        titleClassName={customerDetailSectionTitleClass}
        action={
          <Button size="sm" variant="outline" className="h-11 gap-1.5 lg:h-8" onClick={onMessage}>
            <Send className="size-3.5" /> {t("customers.detail.sendMessage")}
          </Button>
        }
      />
      <div className="grid min-w-0 gap-1.5 sm:gap-2 lg:grid-cols-2">
        {interactions.length ? (
          interactions.map((interaction) => (
            <RepairOsBusinessCard
              key={interaction.id}
              className="grid-cols-[minmax(0,1fr)] bg-surface-muted/30 px-2.5 py-2 text-sm"
            >
              <div className="flex min-w-0 items-center justify-between gap-3 text-[11px] text-muted-foreground lg:text-xs lg:leading-4">
                <span className="min-w-0 truncate">
                  {interaction.channel === "whatsapp" ? "WhatsApp" : "SMS"} ·{" "}
                  {interaction.operator_name}
                </span>
                <span className="shrink-0">
                  {formatCustomerDateTime(interaction.created_at, locale)}
                </span>
              </div>
              <p className="mt-1.5 whitespace-pre-wrap break-words text-xs leading-5 text-muted-foreground">
                {interaction.message_body}
              </p>
            </RepairOsBusinessCard>
          ))
        ) : (
          <CustomerEmptyLine text={t("customers.detail.noContactRecords")} />
        )}
      </div>
    </section>
  );
}

export function CustomerProfilePanel({
  customer,
  tags,
  onManageTags,
  onEdit,
}: {
  customer: CustomerDetail["customer"];
  tags: CustomerDetail["tags"];
  onManageTags: () => void;
  onEdit: (control: HTMLButtonElement) => void;
}) {
  const { locale, t } = useLocale();
  return (
    <section className={customerDetailSectionClass}>
      <RepairOsSectionHeader
        title={t("customers.detail.basicInfo")}
        className="mb-2"
        titleClassName={customerDetailSectionTitleClass}
        action={
          <Button
            size="sm"
            variant="outline"
            className="h-11 gap-1.5 lg:h-8"
            onClick={(event) => onEdit(event.currentTarget)}
          >
            <Edit3 className="size-3.5" /> {t("customers.detail.edit")}
          </Button>
        }
      />
      <div className="grid min-w-0 grid-cols-2 gap-2">
        <CustomerInfoBlock
          label={t("customers.form.name")}
          value={customer.name?.trim() || t("customers.detail.missingName")}
        />
        <CustomerInfoBlock
          label={t("customers.detail.primaryPhone")}
          value={<PhoneText value={customer.phone_e164} />}
        />
        <CustomerInfoBlock label={t("customers.form.email")} value={customer.email || "—"} />
      </div>
      <details
        className="mt-2 rounded-lg border border-[var(--border-panel)] px-2 py-1.5"
        data-ui="customer-profile-backup-contacts"
      >
        <summary className="cursor-pointer text-xs font-semibold">
          {t("customers.detail.backupPhones")}
        </summary>
        <div className="mt-2 grid min-w-0 gap-1.5">
          {uniqueContactPhones(customer.phone_e164, customer.contact_phones).map((phone) => (
            <PhoneText key={phone} value={phone} />
          ))}
        </div>
      </details>
      <details
        className="mt-2 rounded-lg border border-[var(--border-panel)] px-2 py-1.5"
        data-ui="customer-profile-preferences"
      >
        <summary className="cursor-pointer text-xs font-semibold">
          {t("customers.detail.contactPreferences")}
        </summary>
        <div className="mt-2 grid min-w-0 grid-cols-2 gap-2">
          <CustomerInfoBlock
            label={t("customers.detail.contactPermission")}
            value={
              customer.consent_marketing && !customer.blacklisted_at
                ? t("customers.detail.contactAllowed")
                : t("customers.detail.contactBlocked")
            }
          />
          <CustomerInfoBlock
            label={t("customers.detail.preferredChannel")}
            value={localizeCustomerChannel(
              customer.preferred_channel ?? "whatsapp",
              customer.preferred_channel ?? "whatsapp",
              t,
            )}
          />
          <CustomerInfoBlock
            label={t("customers.detail.language")}
            value={localizeCustomerLanguage(
              customer.language ?? "it",
              customer.language ?? "it",
              t,
            )}
          />
          <CustomerInfoBlock
            label={t("customers.detail.lastContact")}
            value={
              customer.last_contacted_at
                ? formatCustomerDateTime(customer.last_contacted_at, locale)
                : "—"
            }
          />
        </div>
      </details>
      <details
        className="mt-2 rounded-lg border border-[var(--border-panel)] px-2 py-1.5"
        data-ui="customer-profile-notes"
      >
        <summary className="cursor-pointer text-xs font-semibold">
          {t("customers.detail.customerNotes")}
        </summary>
        <div className="mt-2 grid min-w-0 gap-2">
          <CustomerInfoBlock
            label={t("customers.form.customerNotes")}
            value={customer.notes || "—"}
          />
          <CustomerInfoBlock
            label={t("customers.detail.serviceNotes")}
            value={customer.marketing_notes || t("customers.detail.noServiceNotes")}
          />
        </div>
      </details>
      <details
        className="mt-2 rounded-lg border border-[var(--border-panel)] px-2 py-1.5"
        data-ui="customer-profile-tags"
      >
        <summary className="cursor-pointer text-xs font-semibold">
          {t("customers.detail.serviceTags")}
        </summary>
        <Button
          size="sm"
          variant="outline"
          className="my-2 h-11 gap-1.5 lg:h-8"
          onClick={onManageTags}
        >
          <Tags className="size-3.5" /> {t("customers.detail.manageTags")}
        </Button>
        <div className="min-w-0 rounded-lg bg-[var(--surface-panel-muted)] px-2 py-1.5">
          {tags.length ? (
            <div className="flex min-w-0 flex-wrap gap-1">
              {tags.map((tag) => (
                <span
                  key={tag.id}
                  className="max-w-full truncate rounded-full border bg-card px-2 py-0.5 text-[10px] font-semibold leading-4 lg:text-[11px] lg:leading-4"
                  style={{ borderColor: tag.color, color: tag.color }}
                  title={tag.name}
                >
                  {tag.name}
                </span>
              ))}
            </div>
          ) : (
            <p className="text-[11px] leading-4 text-muted-foreground lg:text-xs lg:leading-4">
              {t("customers.detail.noTags")}
            </p>
          )}
        </div>
      </details>
    </section>
  );
}

export function CustomerFollowupsPanel({
  followups,
  onAdd,
  onComplete,
}: {
  followups: CustomerDetail["followups"];
  onAdd: () => void;
  onComplete: (followupId: string) => void;
}) {
  const { locale, t } = useLocale();
  return (
    <section className={customerDetailSectionClass}>
      <RepairOsSectionHeader
        title={t("customers.detail.customerFollowups")}
        className="mb-2"
        titleClassName={customerDetailSectionTitleClass}
        action={
          <Button size="sm" variant="outline" className="h-11 gap-1.5 lg:h-8" onClick={onAdd}>
            <Plus className="size-3.5" /> {t("customers.detail.addFollowup")}
          </Button>
        }
      />
      <div className="grid min-w-0 gap-1.5 sm:gap-2 lg:grid-cols-2">
        {followups.length ? (
          followups.map((item) => (
            <RepairOsBusinessCard
              key={item.id}
              className="grid-cols-1 gap-1.5 rounded-xl px-2 py-1.5 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-center sm:justify-between sm:px-3 sm:py-2"
              trailing={
                item.status === "open" ? (
                  <Button
                    size="sm"
                    variant="outline"
                    className="h-11 gap-1.5 lg:h-8"
                    onClick={() => onComplete(item.id)}
                  >
                    <CheckCircle2 className="size-3.5" /> {t("customers.detail.markComplete")}
                  </Button>
                ) : null
              }
              trailingClassName="shrink-0"
            >
              <div className="min-w-0 flex-1">
                <div className="flex min-w-0 flex-wrap items-center gap-2">
                  <span
                    className="min-w-0 truncate text-xs font-medium sm:text-sm"
                    title={item.title}
                  >
                    {item.title}
                  </span>
                  <Badge variant={item.status === "done" ? "secondary" : "outline"}>
                    {item.status === "cancelled"
                      ? t("customers.detail.followupCancelled")
                      : localizeCustomerFollowupStatus(item.status, item.status, t)}
                  </Badge>
                </div>
                <p className="mt-1 text-[11px] text-muted-foreground lg:text-[11px] lg:leading-4">
                  {formatCustomerDateTime(item.due_at, locale)} ·{" "}
                  {item.owner_name || t("customers.detail.unassigned")}
                </p>
                {item.note && (
                  <p className="mt-1 break-words text-xs text-muted-foreground">{item.note}</p>
                )}
              </div>
            </RepairOsBusinessCard>
          ))
        ) : (
          <CustomerEmptyLine text={t("customers.detail.noFollowups")} />
        )}
      </div>
    </section>
  );
}

export function CustomerTimelinePanel({ data }: { data: CustomerDetail }) {
  const { t } = useLocale();
  return (
    <section className={customerDetailSectionClass}>
      <RepairOsSectionHeader
        title={t("customers.detail.operationLog")}
        className="mb-2"
        titleClassName={customerDetailSectionTitleClass}
      />
      <CustomerTimelineList data={data} />
    </section>
  );
}
