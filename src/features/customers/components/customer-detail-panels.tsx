"use client";

import { useState } from "react";
import Link from "next/link";
import { ChevronRight, Plus } from "lucide-react";

import { MoneyText, StatusBadge } from "@/components/orders/badges";
import { Button } from "@/components/ui/button";
import { CustomerDeviceSheet } from "@/features/customers/components/customer-device-sheet";
import {
  CustomerEmptyLine,
  CustomerDeviceCard,
  CustomerMetric,
  CustomerWorkbenchOrderRow,
} from "@/features/customers/components/customer-profile-blocks";
import {
  buildCustomerDeviceWorkbenchItems,
  buildCustomerWorkbenchSummary,
} from "@/features/customers/model/customer-workbench";
import { isCustomerOrderCancelled } from "@/features/customers/model/customer-order-state";
import type { CustomerDetail, Device } from "@/lib/repairdesk/api";
import { RepairOsSectionHeader } from "@/shared/ui";
import { repairOs } from "@/lib/ui-patterns";
import { cn } from "@/lib/utils";
import { buildOrderDetailWorkspaceHref } from "@/features/orders/model/order-workspace-intent";
import {
  localizeOrderFinancialLabel,
  localizeWorkflowStatusLabel,
} from "@/features/orders/model/order-i18n";
import { useLocale } from "@/shared/i18n/locale-provider";

const customerDetailSectionClass = cn(repairOs.mobileInfoCard, "sm:p-2.5 md:rounded-2xl md:p-3");
const customerDetailSectionTitleClass = "text-xs leading-4 sm:text-sm lg:text-[13px] lg:leading-5";

export function CustomerOverviewPanel({
  data,
  onOpenBusiness,
  onOpenProfile,
}: {
  data: CustomerDetail;
  onOpenBusiness: () => void;
  onOpenProfile: () => void;
}) {
  const { t } = useLocale();
  const unfinishedOrders = buildCustomerWorkbenchSummary(data).orderItems.filter(
    (item) => item.state === "active" || item.financialState.collectible,
  );
  return (
    <div className="grid min-w-0 gap-2">
      <section className={customerDetailSectionClass} data-ui="customer-unfinished-orders">
        <RepairOsSectionHeader
          title={t("customers.detail.unfinishedOrders")}
          className="mb-2"
          titleClassName={customerDetailSectionTitleClass}
        />
        {unfinishedOrders.length ? (
          <div className="divide-y divide-border/60">
            {unfinishedOrders.map((item) => (
              <Link
                key={item.order.id}
                href={buildOrderDetailWorkspaceHref(item.order.id, { source: "customer" })}
                className="flex min-h-16 min-w-0 items-center gap-3 rounded-lg px-1 py-2 hover:bg-accent/30 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              >
                <span className="min-w-0 flex-1">
                  <span className="block break-words text-sm font-semibold">
                    {item.deviceLabel}
                  </span>
                  <span className="block font-mono text-xs text-muted-foreground">
                    {item.order.public_no}
                  </span>
                  <span className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-1 text-xs">
                    <StatusBadge
                      status={item.order.status}
                      label={localizeWorkflowStatusLabel(undefined, item.order.status, t)}
                    />
                    {item.financialState.collectible &&
                    !item.financeRedacted &&
                    !item.order.finance_redacted ? (
                      <span className="text-status-warn-foreground">
                        {t("customers.detail.outstanding")}{" "}
                        <MoneyText amount={item.order.balance_amount} />
                      </span>
                    ) : null}
                  </span>
                </span>
                <ChevronRight
                  className="size-4 shrink-0 text-muted-foreground"
                  aria-hidden="true"
                />
              </Link>
            ))}
          </div>
        ) : (
          <CustomerEmptyLine text={t("customers.detail.noUnfinishedOrders")} />
        )}
      </section>
      {(
        [
          ["businessRecords", "businessRecordsHint", onOpenBusiness],
          ["profile", "profileHint", onOpenProfile],
        ] as const
      ).map(([title, hint, onClick]) => (
        <button
          key={title}
          type="button"
          onClick={onClick}
          className={cn(
            customerDetailSectionClass,
            "flex min-h-16 w-full min-w-0 items-center justify-between gap-3 text-left hover:bg-accent/30 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
          )}
        >
          <span className="min-w-0">
            <span className="block text-sm font-semibold">{t(`customers.detail.${title}`)}</span>
            <span className="block text-xs text-muted-foreground">
              {t(`customers.detail.${hint}`)}
            </span>
          </span>
          <ChevronRight className="size-4 shrink-0" aria-hidden="true" />
        </button>
      ))}
    </div>
  );
}

export function CustomerDevicesPanel({
  data,
  onRefresh,
  deleting,
  onAdd,
  onEdit,
  onDelete,
}: {
  data: CustomerDetail;
  onRefresh?: () => void;
  deleting: boolean;
  onAdd: (control: HTMLButtonElement) => void;
  onEdit: (device: Device, control: HTMLButtonElement) => void;
  onDelete: (device: Device) => Promise<unknown>;
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
        description={t("customers.detail.devicesCount", { count: data.stats.device_count })}
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
              onDelete={() => {
                void onDelete({ ...item.device }).catch(() => undefined);
              }}
            />
          ))
        ) : (
          <div className="rounded-xl border border-dashed border-[var(--border-panel)] bg-[var(--surface-panel-muted)] px-3 py-4 text-center text-xs text-muted-foreground sm:col-span-2 2xl:col-span-3">
            {t("customers.detail.noDevices")}
          </div>
        )}
      </div>
      <CustomerDeviceSheet
        onRefresh={onRefresh}
        item={deviceItems.find((item) => item.device.id === selectedDeviceItem?.device.id)}
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
        onDelete={async (device) => {
          await onDelete(device);
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
  const orderItems = [...workbench.orderItems].sort(
    (a, b) => Number(b.state === "active") - Number(a.state === "active"),
  );

  return (
    <section className={customerDetailSectionClass}>
      <details
        className="mb-3 rounded-xl border border-[var(--border-panel)] bg-card px-3 py-2"
        data-ui="customer-order-statistics"
      >
        <summary className="cursor-pointer text-sm font-semibold focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
          {t("customers.detail.orderStatistics")}
        </summary>
        <div className="mt-2 grid min-w-0 grid-cols-2 gap-2 sm:grid-cols-3">
          <CustomerMetric
            label={t("customers.detail.activeRepairs")}
            value={t("customers.detail.repairsCount", { count: data.stats.valid_order_count ?? 0 })}
          />
          <CustomerMetric
            label={t("customers.detail.historyOrders")}
            value={t("customers.detail.ordersCount", { count: data.stats.order_count })}
          />
          <CustomerMetric
            label={t("customers.detail.validOrderValue")}
            value={
              data.stats.finance_redacted ? (
                t("customers.detail.financeRestricted")
              ) : (
                <MoneyText amount={workbench.payment.totalQuoted} />
              )
            }
          />
          <CustomerMetric
            label={t("customers.detail.outstandingBalance")}
            value={
              data.stats.finance_redacted ? (
                t("customers.detail.financeRestricted")
              ) : (
                <MoneyText amount={workbench.payment.unpaidAmount} />
              )
            }
          />
        </div>
      </details>
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
                        ) : item.financialState.collectible ? (
                          <div className="text-[10px] text-status-danger-foreground lg:text-[11px] lg:leading-4">
                            {t("customers.detail.outstanding")}{" "}
                            <MoneyText amount={Math.max(0, item.order.balance_amount)} />
                          </div>
                        ) : (
                          <div className="text-[10px] text-muted-foreground lg:text-[11px] lg:leading-4">
                            {localizeOrderFinancialLabel(item.financialState, t)}
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
