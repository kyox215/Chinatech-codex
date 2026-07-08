"use client";

import Link from "next/link";
import { Plus } from "lucide-react";

import { MoneyText, StatusBadge } from "@/components/orders/badges";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import {
  CustomerEmptyLine,
  CustomerDeviceCard,
  CustomerInfoBlock,
  CustomerMetric,
  CustomerOrderRow,
  CustomerTimelineList,
} from "@/features/customers/components/customer-profile-blocks";
import type { CustomerDetail, Device } from "@/lib/repairdesk/api";
import { repairOs } from "@/lib/ui-patterns";
import { cn } from "@/lib/utils";

const customerDetailSectionClass = cn(repairOs.mobileInfoCard, "sm:p-2.5 md:rounded-2xl md:p-3");
const customerDetailSectionTitleClass = "mb-2 text-[11px] font-semibold leading-4 sm:text-sm";

export function CustomerOverviewPanel({ data }: { data: CustomerDetail }) {
  const { customer, stats } = data;
  return (
    <div className="grid min-w-0 gap-1.5 sm:gap-2 lg:grid-cols-[minmax(0,1.2fr)_minmax(0,0.8fr)]">
      <section className={customerDetailSectionClass}>
        <h2 className={customerDetailSectionTitleClass}>客户概览</h2>
        <div className="grid min-w-0 grid-cols-2 gap-1.5 sm:gap-2">
          <CustomerMetric label="设备" value={stats.device_count} />
          <CustomerMetric label="历史工单" value={stats.order_count} />
          <CustomerMetric label="已结清营收" value={<MoneyText amount={stats.total_spent} />} />
          <CustomerMetric label="未结清" value={<MoneyText amount={stats.unpaid_amount} />} />
        </div>
        <Separator className="my-2" />
        <div className="grid min-w-0 gap-2 sm:grid-cols-2">
          <CustomerInfoBlock label="客户备注" value={customer.notes || "暂无备注"} />
          <CustomerInfoBlock label="联系备注" value={customer.marketing_notes || "暂无联系备注"} />
        </div>
      </section>
      <section className={customerDetailSectionClass}>
        <h2 className={customerDetailSectionTitleClass}>最近动态</h2>
        <CustomerTimelineList data={data} limit={6} />
      </section>
    </div>
  );
}

export function CustomerDevicesPanel({
  customerId,
  devices,
  deleting,
  onAdd,
  onEdit,
  onDelete,
}: {
  customerId: string;
  devices: CustomerDetail["devices"];
  deleting: boolean;
  onAdd: () => void;
  onEdit: (device: Device) => void;
  onDelete: (deviceId: string) => void;
}) {
  return (
    <section className={customerDetailSectionClass}>
      <div className="mb-2 flex min-w-0 items-center justify-between gap-2">
        <h2 className={customerDetailSectionTitleClass}>设备档案</h2>
        <Button size="sm" variant="outline" className="h-8 gap-1.5 text-xs" onClick={onAdd}>
          <Plus className="size-3.5" /> 添加设备
        </Button>
      </div>
      <div className="grid min-w-0 gap-1.5 sm:grid-cols-2 sm:gap-2 2xl:grid-cols-3">
        {devices.map((device) => (
          <CustomerDeviceCard
            key={device.id}
            device={device}
            customerId={customerId}
            deleting={deleting}
            onEdit={() => onEdit(device)}
            onDelete={() => onDelete(device.id)}
          />
        ))}
      </div>
    </section>
  );
}

export function CustomerOrdersPanel({
  orders,
  onFollowup,
}: {
  orders: CustomerDetail["orders"];
  onFollowup: (orderId: string) => void;
}) {
  return (
    <section className={customerDetailSectionClass}>
      <h2 className={customerDetailSectionTitleClass}>历史工单</h2>
      {orders.length ? (
        <div className="hidden max-w-full overflow-x-auto rounded-xl border border-[var(--border-panel)] bg-card lg:block">
          <table className="w-full min-w-[620px] table-fixed text-xs xl:min-w-[760px]">
            <thead className="border-b border-border/40 text-[11px] text-muted-foreground">
              <tr>
                <th className="w-[118px] px-3 py-2 text-left font-medium xl:w-[130px]">工单</th>
                <th className="px-2 py-2 text-left font-medium">设备与故障</th>
                <th className="hidden w-[120px] px-2 py-2 text-left font-medium xl:table-cell">
                  状态
                </th>
                <th className="w-[96px] px-2 py-2 text-right font-medium xl:w-[110px]">报价</th>
                <th className="w-[86px] px-2 py-2 text-right font-medium xl:w-[110px]">操作</th>
              </tr>
            </thead>
            <tbody>
              {orders.map((order) => (
                <tr
                  key={order.id}
                  className="border-b border-border/30 transition-colors last:border-0 hover:bg-accent/30"
                >
                  <td className="px-3 py-2">
                    <Link
                      href={`/orders/${order.id}`}
                      className="block truncate font-mono text-xs font-semibold text-primary hover:underline"
                    >
                      {order.public_no}
                    </Link>
                    <div className="mt-1 xl:hidden">
                      <StatusBadge status={order.status} className="max-w-full text-[10px]" />
                    </div>
                  </td>
                  <td className="min-w-0 px-2 py-2">
                    <div className="truncate text-xs font-medium" title={order.device_label}>
                      {order.device_label}
                    </div>
                    <div
                      className="mt-0.5 truncate text-[11px] text-muted-foreground"
                      title={order.issue_description}
                    >
                      {order.issue_description}
                    </div>
                  </td>
                  <td className="hidden px-2 py-2 xl:table-cell">
                    <StatusBadge status={order.status} />
                  </td>
                  <td className="whitespace-nowrap px-2 py-2 text-right">
                    <MoneyText amount={order.quotation_amount} />
                  </td>
                  <td className="px-2 py-2 text-right">
                    {order.status === "completed" ? (
                      <Button
                        size="sm"
                        variant="outline"
                        className="h-7 gap-1.5 px-2 text-[11px]"
                        onClick={() => onFollowup(order.id)}
                      >
                        <Plus className="size-3" /> 待办
                      </Button>
                    ) : (
                      <Button asChild size="sm" variant="ghost" className="h-7 px-2 text-[11px]">
                        <Link href={`/orders/${order.id}`}>查看</Link>
                      </Button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : null}
      <div className={cn("min-w-0 space-y-1.5 sm:space-y-2", orders.length && "lg:hidden")}>
        {orders.map((order) => (
          <CustomerOrderRow key={order.id} order={order} onFollowup={() => onFollowup(order.id)} />
        ))}
        {!orders.length ? <CustomerEmptyLine text="暂无历史工单" /> : null}
      </div>
    </section>
  );
}
