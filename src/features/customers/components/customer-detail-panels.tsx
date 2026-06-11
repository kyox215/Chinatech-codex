"use client";

import { Plus } from "lucide-react";

import { MoneyText } from "@/components/orders/badges";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import {
  CustomerDeviceCard,
  CustomerInfoBlock,
  CustomerMetric,
  CustomerOrderRow,
  CustomerTimelineList,
} from "@/features/customers/components/customer-profile-blocks";
import type { CustomerDetail, Device } from "@/lib/repairdesk/api";

export function CustomerOverviewPanel({ data }: { data: CustomerDetail }) {
  const { customer, stats } = data;
  return (
    <div className="grid min-w-0 gap-3 lg:grid-cols-[minmax(0,1.2fr)_minmax(0,0.8fr)]">
      <Card className="min-w-0 p-3 sm:p-4">
        <h2 className="mb-4 text-sm font-semibold">客户概览</h2>
        <div className="grid min-w-0 gap-3 sm:grid-cols-2">
          <CustomerMetric label="设备" value={stats.device_count} />
          <CustomerMetric label="历史工单" value={stats.order_count} />
          <CustomerMetric label="已结清营收" value={<MoneyText amount={stats.total_spent} />} />
          <CustomerMetric label="未结清" value={<MoneyText amount={stats.unpaid_amount} />} />
        </div>
        <Separator className="my-4" />
        <CustomerInfoBlock label="客户备注" value={customer.notes || "暂无备注"} />
        <CustomerInfoBlock label="营销备注" value={customer.marketing_notes || "暂无营销备注"} />
      </Card>
      <Card className="min-w-0 p-3 sm:p-4">
        <h2 className="mb-4 text-sm font-semibold">最近动态</h2>
        <CustomerTimelineList data={data} limit={6} />
      </Card>
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
    <Card className="min-w-0 p-3 sm:p-4">
      <div className="mb-4 flex min-w-0 items-center justify-between gap-3">
        <h2 className="text-sm font-semibold">设备档案</h2>
        <Button size="sm" variant="outline" className="gap-1.5" onClick={onAdd}>
          <Plus className="size-3.5" /> 添加设备
        </Button>
      </div>
      <div className="grid min-w-0 gap-3 sm:grid-cols-2">
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
    </Card>
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
    <Card className="min-w-0 p-3 sm:p-4">
      <h2 className="mb-4 text-sm font-semibold">历史工单</h2>
      <div className="min-w-0 space-y-2">
        {orders.map((order) => (
          <CustomerOrderRow key={order.id} order={order} onFollowup={() => onFollowup(order.id)} />
        ))}
      </div>
    </Card>
  );
}
