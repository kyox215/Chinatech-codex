"use client";

import { useState } from "react";
import Link from "next/link";
import { Plus } from "lucide-react";

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
  buildCustomerWorkbenchSummary,
} from "@/features/customers/model/customer-workbench";
import { isCustomerOrderCancelled } from "@/features/customers/model/customer-order-state";
import type { CustomerDetail, Device } from "@/lib/repairdesk/api";
import { RepairOsSectionHeader } from "@/shared/ui";
import { repairOs } from "@/lib/ui-patterns";
import { cn } from "@/lib/utils";

const customerDetailSectionClass = cn(repairOs.mobileInfoCard, "sm:p-2.5 md:rounded-2xl md:p-3");
const customerDetailSectionTitleClass = "text-[11px] leading-4 sm:text-sm";

export function CustomerOverviewPanel({ data }: { data: CustomerDetail }) {
  const { customer } = data;
  const workbench = buildCustomerWorkbenchSummary(data);
  const { contactSummary, latestOrder, payment } = workbench;
  const financeRedacted = Boolean(data.stats.finance_redacted);
  const noteRows = [
    { label: "客户备注", value: customer.notes?.trim() },
    { label: "联系备注", value: customer.marketing_notes?.trim() },
  ].filter((row) => row.value);

  return (
    <div className="grid min-w-0 gap-1.5 sm:gap-2 lg:grid-cols-[minmax(0,1.2fr)_minmax(0,0.8fr)]">
      <section className={customerDetailSectionClass}>
        <RepairOsSectionHeader
          title="客户资料"
          className="mb-2"
          titleClassName={customerDetailSectionTitleClass}
        />
        <div className="grid min-w-0 grid-cols-2 gap-1.5 sm:gap-2">
          <CustomerInfoBlock
            label="主电话"
            value={<PhoneText value={contactSummary.primaryPhone} />}
          />
          <CustomerInfoBlock label="备用号码" value={`${contactSummary.backupPhoneCount} 个`} />
          <CustomerInfoBlock label="首选联系" value={contactSummary.channel} />
          <CustomerInfoBlock label="语言" value={contactSummary.language} />
          <CustomerMetric
            label="有效工单额"
            value={financeRedacted ? "金额受限" : <MoneyText amount={payment.totalQuoted} />}
          />
          <CustomerMetric
            label="待收尾款"
            value={financeRedacted ? "金额受限" : <MoneyText amount={payment.unpaidAmount} />}
          />
          <CustomerMetric
            label="已收定金"
            value={financeRedacted ? "金额受限" : <MoneyText amount={payment.depositTotal} />}
          />
          <CustomerMetric
            label="历史 / 有效工单"
            value={`${data.orders.length} / ${data.stats.valid_order_count ?? 0}`}
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
          title="最近工单"
          className="mb-2"
          titleClassName={customerDetailSectionTitleClass}
        />
        {latestOrder ? (
          <CustomerWorkbenchOrderRow item={latestOrder} />
        ) : (
          <CustomerEmptyLine text="暂无历史工单" />
        )}
        <Separator className="my-2" />
        <RepairOsSectionHeader
          title="最近动态"
          className="mb-2"
          titleClassName={customerDetailSectionTitleClass}
        />
        <CustomerTimelineList data={data} limit={4} />
      </section>
    </div>
  );
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
  onAdd: () => void;
  onEdit: (device: Device) => void;
  onDelete: (deviceId: string) => void;
}) {
  const deviceItems = buildCustomerDeviceWorkbenchItems(data);
  const [selectedDeviceItem, setSelectedDeviceItem] = useState<
    (typeof deviceItems)[number] | undefined
  >();

  return (
    <section className={customerDetailSectionClass}>
      <RepairOsSectionHeader
        title="设备档案"
        className="mb-2"
        titleClassName={customerDetailSectionTitleClass}
        action={
          <Button size="sm" variant="outline" className="h-8 gap-1.5 text-xs" onClick={onAdd}>
            <Plus className="size-3.5" /> 添加设备
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
              onEdit={() => onEdit(item.device)}
              onDelete={() => onDelete(item.device.id)}
            />
          ))
        ) : (
          <div className="rounded-xl border border-dashed border-[var(--border-panel)] bg-[var(--surface-panel-muted)] px-3 py-4 text-center text-xs text-muted-foreground sm:col-span-2 2xl:col-span-3">
            暂无设备档案，可先添加设备后复用到新工单。
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
        onEdit={(device) => {
          setSelectedDeviceItem(undefined);
          onEdit(device);
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
  const workbench = buildCustomerWorkbenchSummary(data);
  const orderItems = workbench.orderItems;

  return (
    <section className={customerDetailSectionClass}>
      <RepairOsSectionHeader
        title="历史工单"
        className="mb-2"
        titleClassName={customerDetailSectionTitleClass}
      />
      {orderItems.length ? (
        <div className="hidden max-w-full overflow-x-auto rounded-xl border border-[var(--border-panel)] bg-card lg:block">
          <table className="w-full min-w-[760px] table-fixed text-xs xl:min-w-[840px]">
            <thead className="border-b border-border/40 text-[11px] text-muted-foreground">
              <tr>
                <th className="w-[118px] px-3 py-2 text-left font-medium xl:w-[130px]">工单</th>
                <th className="px-2 py-2 text-left font-medium">设备与故障</th>
                <th className="hidden w-[120px] px-2 py-2 text-left font-medium xl:table-cell">
                  状态
                </th>
                <th className="w-[150px] px-2 py-2 text-right font-medium xl:w-[170px]">金额</th>
                <th className="w-[86px] px-2 py-2 text-right font-medium xl:w-[110px]">操作</th>
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
                      href={`/orders/${item.order.id}`}
                      className="block truncate font-mono text-xs font-semibold text-primary hover:underline"
                    >
                      {item.order.public_no}
                    </Link>
                    <div className="mt-1 xl:hidden">
                      <StatusBadge
                        status={
                          isCustomerOrderCancelled(item.order) ? "cancelled" : item.order.status
                        }
                        className="max-w-full text-[10px]"
                      />
                    </div>
                  </td>
                  <td className="min-w-0 px-2 py-2">
                    <div className="truncate text-xs font-medium" title={item.deviceLabel}>
                      {item.deviceLabel}
                    </div>
                    {item.deviceImei ? (
                      <div className="mt-0.5 truncate font-mono text-[10px] text-muted-foreground">
                        IMEI {item.deviceImei}
                      </div>
                    ) : null}
                    <div
                      className="mt-0.5 truncate text-[11px] text-muted-foreground"
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
                    />
                  </td>
                  <td className="whitespace-nowrap px-2 py-2 text-right font-mono tabular-nums">
                    {item.order.finance_redacted ? (
                      <div className="text-[10px] text-muted-foreground">金额受限</div>
                    ) : (
                      <>
                        <div className="font-semibold">
                          <MoneyText amount={item.order.quotation_amount} />
                        </div>
                        <div className="mt-0.5 text-[10px] text-muted-foreground">
                          定金 <MoneyText amount={item.order.deposit_amount} />
                        </div>
                        {isCustomerOrderCancelled(item.order) ? (
                          <div className="text-[10px] leading-4 text-muted-foreground">
                            取消时余额 <MoneyText amount={Math.max(0, item.order.balance_amount)} />
                            <span className="block">不计入待收</span>
                          </div>
                        ) : (
                          <div
                            className={cn(
                              "text-[10px]",
                              item.order.balance_amount > 0
                                ? "text-status-danger-foreground"
                                : "text-muted-foreground",
                            )}
                          >
                            待收 <MoneyText amount={Math.max(0, item.order.balance_amount)} />
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
                        className="h-7 gap-1.5 px-2 text-[11px]"
                        onClick={() => onFollowup(item.order.id)}
                      >
                        <Plus className="size-3" /> 待办
                      </Button>
                    ) : (
                      <Button asChild size="sm" variant="ghost" className="h-7 px-2 text-[11px]">
                        <Link href={`/orders/${item.order.id}`}>查看</Link>
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
        {!orderItems.length ? <CustomerEmptyLine text="暂无历史工单" /> : null}
      </div>
    </section>
  );
}
