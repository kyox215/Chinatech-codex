"use client";

import { useState } from "react";
import Link from "next/link";
import {
  CheckCircle2,
  ChevronRight,
  CircleAlert,
  Clock3,
  PackageCheck,
  Plus,
  WalletCards,
  Wrench,
} from "lucide-react";

import { MoneyText, PhoneText, StatusBadge } from "@/components/orders/badges";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { CustomerDeviceSheet } from "@/features/customers/components/customer-device-sheet";
import {
  CustomerEmptyLine,
  CustomerDeviceCard,
  CustomerInfoBlock,
  CustomerMetric,
  CustomerTimelineList,
  CustomerWorkbenchOrderRow,
} from "@/features/customers/components/customer-profile-blocks";
import {
  buildCustomerDeviceWorkbenchItems,
  buildCustomerCurrentItems,
  buildCustomerWorkbenchSummary,
  type CustomerCurrentItem,
} from "@/features/customers/model/customer-workbench";
import { isCustomerOrderCancelled } from "@/features/customers/model/customer-order-state";
import type { CustomerDetail, Device } from "@/lib/repairdesk/api";
import { RepairOsSectionHeader } from "@/shared/ui";
import { repairOs } from "@/lib/ui-patterns";
import { cn } from "@/lib/utils";
import { buildOrderDetailWorkspaceHref } from "@/features/orders/model/order-workspace-intent";
import { localizeWorkflowStatusLabel } from "@/features/orders/model/order-i18n";
import { useLocale } from "@/shared/i18n/locale-provider";
import {
  localizeCustomerChannel,
  localizeCustomerCurrentItem,
  localizeCustomerLanguage,
} from "@/features/customers/model/customer-i18n";
import { formatCustomerWorkbenchDate } from "@/features/customers/model/customer-workbench";

const customerDetailSectionClass = cn(repairOs.mobileInfoCard, "sm:p-2.5 md:rounded-2xl md:p-3");
const customerDetailSectionTitleClass =
  "text-[11px] leading-4 sm:text-sm lg:text-[13px] lg:leading-5";

export function CustomerOverviewPanel({
  data,
  onOpenFollowups,
}: {
  data: CustomerDetail;
  onOpenFollowups: () => void;
}) {
  const { t } = useLocale();
  const { customer } = data;
  const workbench = buildCustomerWorkbenchSummary(data);
  const { contactSummary, latestOrder, payment } = workbench;
  const currentItems = buildCustomerCurrentItems(data);
  const financeRedacted = Boolean(data.stats.finance_redacted);
  const noteRows = [
    { label: t("customers.form.customerNotes"), value: customer.notes?.trim() },
    { label: t("customers.form.contactNotes"), value: customer.marketing_notes?.trim() },
  ].filter((row) => row.value);

  return (
    <div className="grid min-w-0 gap-1.5 sm:gap-2 lg:grid-cols-[minmax(0,1.2fr)_minmax(0,0.8fr)]">
      <CustomerCurrentItemsPanel
        items={currentItems}
        onOpenFollowups={onOpenFollowups}
        className="lg:col-span-2"
      />
      <section className={customerDetailSectionClass}>
        <RepairOsSectionHeader
          title={t("customers.detail.businessSummary")}
          className="mb-2"
          titleClassName={customerDetailSectionTitleClass}
        />
        <div className="grid min-w-0 grid-cols-2 gap-1.5 sm:gap-2">
          <CustomerMetric
            label={t("customers.detail.deviceRecords")}
            value={t("customers.detail.devicesCount", { count: data.stats.device_count })}
          />
          <CustomerMetric
            label={t("customers.detail.activeRepairs")}
            value={t("customers.detail.repairsCount", { count: data.stats.valid_order_count ?? 0 })}
          />
          <CustomerMetric
            label={t("customers.detail.historyOrders")}
            value={t("customers.detail.ordersCount", { count: data.stats.order_count })}
          />
          <CustomerInfoBlock
            label={t("customers.detail.primaryPhone")}
            value={<PhoneText value={contactSummary.primaryPhone} />}
          />
          <CustomerInfoBlock
            label={t("customers.detail.backupPhones")}
            value={t("customers.detail.phonesCount", { count: contactSummary.backupPhoneCount })}
          />
          <CustomerInfoBlock
            label={t("customers.detail.preferredContact")}
            value={localizeCustomerChannel(contactSummary.channelKind, contactSummary.channel, t)}
          />
          <CustomerInfoBlock
            label={t("customers.detail.language")}
            value={localizeCustomerLanguage(
              contactSummary.languageKind,
              contactSummary.language,
              t,
            )}
          />
          <CustomerMetric
            label={t("customers.detail.validOrderValue")}
            value={
              financeRedacted ? (
                t("customers.detail.financeRestricted")
              ) : (
                <MoneyText amount={payment.totalQuoted} />
              )
            }
          />
          <CustomerMetric
            label={t("customers.detail.outstandingBalance")}
            value={
              financeRedacted ? (
                t("customers.detail.financeRestricted")
              ) : (
                <MoneyText amount={payment.unpaidAmount} />
              )
            }
          />
          <CustomerMetric
            label={t("customers.detail.openItems")}
            value={t("customers.detail.itemsCount", { count: currentItems.length })}
          />
        </div>
        {noteRows.length ? (
          <>
            <Separator className="my-1.5" />
            <div className="grid min-w-0 gap-1.5 sm:grid-cols-2">
              {noteRows.map((row) => (
                <CustomerInfoBlock key={row.label} label={row.label} value={row.value} />
              ))}
            </div>
          </>
        ) : null}
      </section>
      <section className={customerDetailSectionClass}>
        <RepairOsSectionHeader
          title={t("customers.detail.recentOrders")}
          className="mb-2"
          titleClassName={customerDetailSectionTitleClass}
        />
        {latestOrder ? (
          <CustomerWorkbenchOrderRow item={latestOrder} />
        ) : (
          <CustomerEmptyLine text={t("customers.detail.noHistoryOrders")} />
        )}
        <Separator className="my-2" />
        <RepairOsSectionHeader
          title={t("customers.detail.recentActivity")}
          className="mb-2"
          titleClassName={customerDetailSectionTitleClass}
        />
        <CustomerTimelineList data={data} limit={4} />
      </section>
    </div>
  );
}

function CustomerCurrentItemsPanel({
  items,
  onOpenFollowups,
  className,
}: {
  items: CustomerCurrentItem[];
  onOpenFollowups: () => void;
  className?: string;
}) {
  const { t } = useLocale();
  return (
    <section className={cn(customerDetailSectionClass, className)} data-ui="customer-current-items">
      <RepairOsSectionHeader
        title={t("customers.detail.currentItems")}
        description={t("customers.detail.currentItemsDescription", { count: items.length })}
        className="mb-2"
        titleClassName={customerDetailSectionTitleClass}
      />
      {items.length ? (
        <div className="grid min-w-0 gap-1.5 md:grid-cols-2 md:gap-2 xl:grid-cols-3">
          {items.map((item) => (
            <CustomerCurrentItemRow key={item.id} item={item} onOpenFollowups={onOpenFollowups} />
          ))}
        </div>
      ) : (
        <div className="flex min-h-11 items-center gap-2 rounded-xl border border-status-success-foreground/20 bg-status-success/10 px-3 py-2 text-status-success-foreground">
          <CheckCircle2 className="size-4 shrink-0" aria-hidden="true" />
          <div className="min-w-0">
            <p className="text-xs font-semibold">{t("customers.detail.noCurrentItems")}</p>
            <p className="text-[10px] leading-4 opacity-80 lg:text-xs lg:leading-[18px] lg:opacity-100">
              {t("customers.detail.noCurrentItemsDescription")}
            </p>
          </div>
        </div>
      )}
    </section>
  );
}

const currentItemToneClass = {
  info: "border-status-info-foreground/25 bg-status-info/10 text-status-info-foreground",
  warn: "border-status-warn-foreground/25 bg-status-warn/10 text-status-warn-foreground",
  danger: "border-status-danger-foreground/25 bg-status-danger/10 text-status-danger-foreground",
  success:
    "border-status-success-foreground/25 bg-status-success/10 text-status-success-foreground",
} as const;

function CustomerCurrentItemRow({
  item,
  onOpenFollowups,
}: {
  item: CustomerCurrentItem;
  onOpenFollowups: () => void;
}) {
  const { locale, t } = useLocale();
  const localizedItem = localizeCustomerCurrentItem(item, t);
  const Icon =
    item.kind === "overdue_followup"
      ? CircleAlert
      : item.kind === "followup"
        ? Clock3
        : item.kind === "pickup"
          ? PackageCheck
          : item.kind === "unpaid"
            ? WalletCards
            : Wrench;
  const content = (
    <>
      <span className="grid size-8 shrink-0 place-items-center rounded-lg bg-background/60">
        <Icon className="size-4" aria-hidden="true" />
      </span>
      <span className="min-w-0 flex-1 text-left">
        <span className="block text-[11px] font-semibold leading-4 lg:text-xs lg:leading-4">
          {localizedItem.title}
        </span>
        <span className="block truncate text-[10px] leading-4 opacity-80 lg:text-[12px] lg:leading-4 lg:opacity-100">
          {item.description}
        </span>
        {item.dueAt ? (
          <span className="mt-0.5 block text-[9px] leading-3 opacity-75 lg:text-[11px] lg:leading-4 lg:opacity-100">
            {t("customers.detail.due", { date: formatCurrentItemTime(item.dueAt, locale) })}
          </span>
        ) : null}
      </span>
      <span className="flex shrink-0 items-center gap-0.5 text-[10px] font-semibold lg:text-xs lg:leading-4">
        {localizedItem.actionLabel}
        <ChevronRight className="size-3" aria-hidden="true" />
      </span>
    </>
  );
  const className = cn(
    "flex min-h-14 min-w-0 items-center gap-2 rounded-xl border px-2.5 py-2 transition-colors hover:brightness-95 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
    currentItemToneClass[item.tone],
  );

  if (item.orderId) {
    return (
      <Link
        href={buildOrderDetailWorkspaceHref(item.orderId, { source: "customer" })}
        className={className}
      >
        {content}
      </Link>
    );
  }

  return (
    <button type="button" className={className} onClick={onOpenFollowups}>
      {content}
    </button>
  );
}

function formatCurrentItemTime(value: string, locale: "zh-CN" | "it-IT" | "en") {
  return formatCustomerWorkbenchDate(value, locale);
}

export function CustomerDevicesPanel({
  data,
  deleting,
  onAdd,
  onEdit,
  onDelete,
}: {
  data: CustomerDetail;
  deleting: boolean;
  onAdd: (control: HTMLButtonElement) => void;
  onEdit: (device: Device, control: HTMLButtonElement) => void;
  onDelete: (deviceId: string) => void;
}) {
  const { t } = useLocale();
  const deviceItems = buildCustomerDeviceWorkbenchItems(data);
  const [selectedDeviceItem, setSelectedDeviceItem] = useState<
    (typeof deviceItems)[number] | undefined
  >();

  return (
    <section className={customerDetailSectionClass}>
      <RepairOsSectionHeader
        title={t("customers.detail.deviceRecords")}
        className="mb-2"
        titleClassName={customerDetailSectionTitleClass}
        action={
          <Button
            size="sm"
            variant="outline"
            className="h-11 gap-1.5 text-xs lg:h-8"
            onClick={(event) => onAdd(event.currentTarget)}
          >
            <Plus className="size-3.5" /> {t("customers.detail.addDevice")}
          </Button>
        }
      />
      <div className="grid min-w-0 gap-1.5 sm:grid-cols-2 sm:gap-2 2xl:grid-cols-3">
        {deviceItems.length ? (
          deviceItems.map((item) => (
            <CustomerDeviceCard
              key={item.device.id}
              item={item}
              customerId={data.customer.id}
              deleting={deleting}
              onOpen={() => setSelectedDeviceItem(item)}
              onEdit={(control) => onEdit(item.device, control)}
              onDelete={() => onDelete(item.device.id)}
            />
          ))
        ) : (
          <div className="rounded-xl border border-dashed border-[var(--border-panel)] bg-[var(--surface-panel-muted)] px-3 py-4 text-center text-xs text-muted-foreground sm:col-span-2 2xl:col-span-3">
            {t("customers.detail.noDevices")}
          </div>
        )}
      </div>
      <CustomerDeviceSheet
        item={selectedDeviceItem}
        customerId={data.customer.id}
        open={Boolean(selectedDeviceItem)}
        deleting={deleting}
        onOpenChange={(nextOpen) => {
          if (!nextOpen) setSelectedDeviceItem(undefined);
        }}
        onEdit={(device, control) => {
          setSelectedDeviceItem(undefined);
          onEdit(device, control);
        }}
        onDelete={(deviceId) => {
          onDelete(deviceId);
          setSelectedDeviceItem(undefined);
        }}
      />
    </section>
  );
}

export function CustomerOrdersPanel({
  data,
  onFollowup,
}: {
  data: CustomerDetail;
  onFollowup: (orderId: string) => void;
}) {
  const { t } = useLocale();
  const workbench = buildCustomerWorkbenchSummary(data);
  const orderItems = workbench.orderItems;

  return (
    <section className={customerDetailSectionClass}>
      <RepairOsSectionHeader
        title={t("customers.detail.historyOrders")}
        className="mb-2"
        titleClassName={customerDetailSectionTitleClass}
      />
      {orderItems.length ? (
        <div className="hidden max-w-full overflow-x-auto rounded-xl border border-[var(--border-panel)] bg-card lg:block">
          <table className="w-full min-w-[760px] table-fixed text-xs xl:min-w-[840px]">
            <thead className="border-b border-border/40 text-[11px] text-muted-foreground lg:text-xs lg:leading-4">
              <tr>
                <th className="w-[118px] px-3 py-2 text-left font-medium xl:w-[130px]">
                  {t("customers.detail.headerOrder")}
                </th>
                <th className="px-2 py-2 text-left font-medium">
                  {t("customers.detail.headerDeviceIssue")}
                </th>
                <th className="hidden w-[120px] px-2 py-2 text-left font-medium xl:table-cell">
                  {t("customers.detail.headerStatus")}
                </th>
                <th className="w-[150px] px-2 py-2 text-right font-medium xl:w-[170px]">
                  {t("customers.detail.headerAmount")}
                </th>
                <th className="w-[86px] px-2 py-2 text-right font-medium xl:w-[110px]">
                  {t("customers.detail.headerAction")}
                </th>
              </tr>
            </thead>
            <tbody>
              {orderItems.map((item) => (
                <tr
                  key={item.order.id}
                  className="border-b border-border/30 transition-colors last:border-0 hover:bg-accent/30"
                >
                  <td className="px-3 py-2">
                    <Link
                      href={buildOrderDetailWorkspaceHref(item.order.id, { source: "customer" })}
                      className="block truncate font-mono text-xs font-semibold text-primary hover:underline"
                    >
                      {item.order.public_no}
                    </Link>
                    <div className="mt-1 xl:hidden">
                      <StatusBadge
                        status={
                          isCustomerOrderCancelled(item.order) ? "cancelled" : item.order.status
                        }
                        label={localizeWorkflowStatusLabel(
                          undefined,
                          isCustomerOrderCancelled(item.order) ? "cancelled" : item.order.status,
                          t,
                        )}
                        className="max-w-full text-[10px] lg:text-[11px] lg:leading-4"
                      />
                    </div>
                  </td>
                  <td className="min-w-0 px-2 py-2">
                    <div className="truncate text-xs font-medium" title={item.deviceLabel}>
                      {item.deviceLabel}
                    </div>
                    {item.deviceImei ? (
                      <div className="mt-0.5 truncate font-mono text-[10px] text-muted-foreground lg:text-[11px] lg:leading-4">
                        IMEI {item.deviceImei}
                      </div>
                    ) : null}
                    <div
                      className="mt-0.5 truncate text-[11px] text-muted-foreground lg:text-xs lg:leading-4"
                      title={item.order.issue_description}
                    >
                      {item.order.issue_description}
                    </div>
                  </td>
                  <td className="hidden px-2 py-2 xl:table-cell">
                    <StatusBadge
                      status={
                        isCustomerOrderCancelled(item.order) ? "cancelled" : item.order.status
                      }
                      label={localizeWorkflowStatusLabel(
                        undefined,
                        isCustomerOrderCancelled(item.order) ? "cancelled" : item.order.status,
                        t,
                      )}
                    />
                  </td>
                  <td className="whitespace-nowrap px-2 py-2 text-right font-mono tabular-nums">
                    {item.financeRedacted || item.order.finance_redacted ? (
                      <div className="text-[10px] text-muted-foreground lg:text-xs lg:leading-4">
                        {t("customers.detail.financeRestricted")}
                      </div>
                    ) : (
                      <>
                        <div className="font-semibold">
                          <MoneyText amount={item.order.quotation_amount} />
                        </div>
                        <div className="mt-0.5 text-[10px] text-muted-foreground lg:text-[11px] lg:leading-4">
                          {t("customers.detail.deposit")}{" "}
                          <MoneyText amount={item.order.deposit_amount} />
                        </div>
                        {isCustomerOrderCancelled(item.order) ? (
                          <div className="text-[10px] leading-4 text-muted-foreground lg:text-[11px]">
                            {t("customers.detail.cancelBalance")}{" "}
                            <MoneyText amount={Math.max(0, item.order.balance_amount)} />
                            <span className="block">{t("customers.detail.notOutstanding")}</span>
                          </div>
                        ) : (
                          <div
                            className={cn(
                              "text-[10px] lg:text-[11px] lg:leading-4",
                              item.order.balance_amount > 0
                                ? "text-status-danger-foreground"
                                : "text-muted-foreground",
                            )}
                          >
                            {t("customers.detail.outstanding")}{" "}
                            <MoneyText amount={Math.max(0, item.order.balance_amount)} />
                          </div>
                        )}
                      </>
                    )}
                  </td>
                  <td className="px-2 py-2 text-right">
                    {item.order.status === "completed" ? (
                      <Button
                        size="sm"
                        variant="outline"
                        className="h-7 gap-1.5 px-2 text-[11px] lg:text-xs"
                        onClick={() => onFollowup(item.order.id)}
                      >
                        <Plus className="size-3" /> {t("customers.detail.followupShort")}
                      </Button>
                    ) : (
                      <Button
                        asChild
                        size="sm"
                        variant="ghost"
                        className="h-7 px-2 text-[11px] lg:text-xs"
                      >
                        <Link
                          href={buildOrderDetailWorkspaceHref(item.order.id, {
                            source: "customer",
                          })}
                        >
                          {t("customers.detail.view")}
                        </Link>
                      </Button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : null}
      <div className={cn("min-w-0 space-y-1.5 sm:space-y-2", orderItems.length && "lg:hidden")}>
        {orderItems.map((item) => (
          <CustomerWorkbenchOrderRow
            key={item.order.id}
            item={item}
            onFollowup={() => onFollowup(item.order.id)}
          />
        ))}
        {!orderItems.length ? (
          <CustomerEmptyLine text={t("customers.detail.noHistoryOrders")} />
        ) : null}
      </div>
    </section>
  );
}
