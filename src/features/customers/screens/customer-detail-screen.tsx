"use client";

import { useEffect, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";

import { Skeleton } from "@/components/ui/skeleton";
import {
  CustomerFollowupsPanel,
  CustomerMarketingPanel,
  CustomerMessagesPanel,
  CustomerTimelinePanel,
} from "@/features/customers/components/customer-activity-panels";
import {
  CustomerDevicesPanel,
  CustomerOrdersPanel,
  CustomerOverviewPanel,
} from "@/features/customers/components/customer-detail-panels";
import { CustomerDetailTabs } from "@/features/customers/components/customer-detail-tabs";
import { CustomerHero } from "@/features/customers/components/customer-hero";
import { CustomerDeviceDialog } from "@/features/customers/forms/customer-device-dialog";
import { CustomerEditDialog } from "@/features/customers/forms/customer-edit-dialog";
import { CustomerFollowupDialog } from "@/features/customers/forms/customer-followup-dialog";
import { CustomerMessageDialog } from "@/features/customers/forms/customer-message-dialog";
import { CustomerTagsDialog } from "@/features/customers/forms/customer-tags-dialog";
import {
  completeCustomerFollowup,
  createCustomerFollowup,
  deleteCustomerDevice,
  getCustomerDetail,
  sendCustomerMessage,
  setCustomerTags,
  updateCustomer,
  upsertCustomerDevice,
  type CustomerDeviceInput,
  type CustomerFollowupInput,
  type CustomerMessageInput,
  type CustomerUpdateInput,
  type Device,
} from "@/lib/repairdesk/api";

const tabs = [
  { key: "overview", label: "概览" },
  { key: "devices", label: "设备" },
  { key: "orders", label: "工单" },
  { key: "messages", label: "消息" },
  { key: "marketing", label: "营销" },
  { key: "followups", label: "回访" },
  { key: "timeline", label: "时间线" },
] as const;

type TabKey = (typeof tabs)[number]["key"];

export function CustomerDetailScreen({ id }: { id: string }) {
  const queryClient = useQueryClient();
  const [tab, setTab] = useState<TabKey>("overview");
  const [editOpen, setEditOpen] = useState(false);
  const [deviceOpen, setDeviceOpen] = useState(false);
  const [editingDevice, setEditingDevice] = useState<Device | undefined>();
  const [followupOpen, setFollowupOpen] = useState(false);
  const [followupOrderId, setFollowupOrderId] = useState<string | undefined>();
  const [messageOpen, setMessageOpen] = useState(false);
  const [tagsOpen, setTagsOpen] = useState(false);
  const [orderUrl, setOrderUrl] = useState("");

  const { data, isLoading } = useQuery({
    queryKey: ["customer-detail", id],
    queryFn: () => getCustomerDetail(id),
  });

  useEffect(() => {
    setOrderUrl(window.location.origin);
  }, []);

  const invalidate = () => {
    queryClient.invalidateQueries({ queryKey: ["customer-detail", id] });
    queryClient.invalidateQueries({ queryKey: ["customers"] });
    queryClient.invalidateQueries({ queryKey: ["orders"] });
  };

  const update = useMutation({
    mutationFn: (input: CustomerUpdateInput) => updateCustomer(id, input),
    onSuccess: () => {
      toast.success("客户已更新");
      setEditOpen(false);
      invalidate();
    },
    onError: (error: Error) => toast.error(error.message),
  });

  const upsertDevice = useMutation({
    mutationFn: (input: CustomerDeviceInput) => upsertCustomerDevice(id, input),
    onSuccess: () => {
      toast.success("设备已保存");
      setDeviceOpen(false);
      setEditingDevice(undefined);
      invalidate();
    },
    onError: (error: Error) => toast.error(error.message),
  });

  const deleteDevice = useMutation({
    mutationFn: (deviceId: string) => deleteCustomerDevice(id, deviceId),
    onSuccess: () => {
      toast.success("设备已删除");
      invalidate();
    },
    onError: (error: Error) => toast.error(error.message),
  });

  const followup = useMutation({
    mutationFn: (input: CustomerFollowupInput) => createCustomerFollowup(id, input),
    onSuccess: () => {
      toast.success("回访任务已创建");
      setFollowupOpen(false);
      invalidate();
    },
    onError: (error: Error) => toast.error(error.message),
  });

  const completeFollowup = useMutation({
    mutationFn: (followupId: string) => completeCustomerFollowup(id, followupId),
    onSuccess: () => {
      toast.success("回访已完成");
      invalidate();
    },
    onError: (error: Error) => toast.error(error.message),
  });

  const message = useMutation({
    mutationFn: (input: CustomerMessageInput) => sendCustomerMessage(id, input),
    onSuccess: () => {
      toast.success("客户消息已记录");
      setMessageOpen(false);
      invalidate();
    },
    onError: (error: Error) => toast.error(error.message),
  });

  const tags = useMutation({
    mutationFn: (tagIds: string[]) => setCustomerTags(id, tagIds),
    onSuccess: () => {
      toast.success("客户标签已更新");
      setTagsOpen(false);
      invalidate();
    },
    onError: (error: Error) => toast.error(error.message),
  });

  if (isLoading || !data) {
    return (
      <div className="mx-auto max-w-5xl space-y-4 px-4 pb-12 pt-4 md:px-6">
        <Skeleton className="h-36 w-full" />
        <Skeleton className="h-10 w-96" />
        <Skeleton className="h-64 w-full" />
      </div>
    );
  }

  const { customer, devices, orders, followups, interactions } = data;

  return (
    <div className="mx-auto max-w-5xl px-4 pb-12 pt-4 md:px-6">
      <CustomerHero
        data={data}
        onMessage={() => setMessageOpen(true)}
        onFollowup={() => {
          setFollowupOrderId(undefined);
          setFollowupOpen(true);
        }}
        onEdit={() => setEditOpen(true)}
      />

      <CustomerDetailTabs tabs={tabs} activeTab={tab} onChange={setTab} />

      {tab === "overview" && <CustomerOverviewPanel data={data} />}

      {tab === "devices" && (
        <CustomerDevicesPanel
          customerId={customer.id}
          devices={devices}
          deleting={deleteDevice.isPending}
          onAdd={() => {
            setEditingDevice(undefined);
            setDeviceOpen(true);
          }}
          onEdit={(device) => {
            setEditingDevice(device);
            setDeviceOpen(true);
          }}
          onDelete={(deviceId) => deleteDevice.mutate(deviceId)}
        />
      )}

      {tab === "orders" && (
        <CustomerOrdersPanel
          orders={orders}
          onFollowup={(orderId) => {
            setFollowupOrderId(orderId);
            setFollowupOpen(true);
          }}
        />
      )}

      {tab === "messages" && (
        <CustomerMessagesPanel interactions={interactions} onMessage={() => setMessageOpen(true)} />
      )}

      {tab === "marketing" && (
        <CustomerMarketingPanel customer={customer} onManageTags={() => setTagsOpen(true)} />
      )}

      {tab === "followups" && (
        <CustomerFollowupsPanel
          followups={followups}
          onAdd={() => {
            setFollowupOrderId(undefined);
            setFollowupOpen(true);
          }}
          onComplete={(followupId) => completeFollowup.mutate(followupId)}
        />
      )}

      {tab === "timeline" && <CustomerTimelinePanel data={data} />}

      <CustomerEditDialog
        open={editOpen}
        onOpenChange={setEditOpen}
        data={data}
        busy={update.isPending}
        onSave={(input) => update.mutateAsync(input)}
      />
      <CustomerDeviceDialog
        open={deviceOpen}
        onOpenChange={(open) => {
          setDeviceOpen(open);
          if (!open) setEditingDevice(undefined);
        }}
        device={editingDevice}
        busy={upsertDevice.isPending}
        onSave={(input) => upsertDevice.mutateAsync(input)}
      />
      <CustomerFollowupDialog
        open={followupOpen}
        onOpenChange={(open) => {
          setFollowupOpen(open);
          if (!open) setFollowupOrderId(undefined);
        }}
        busy={followup.isPending}
        orders={orders}
        selectedOrderId={followupOrderId}
        onSave={(input) => followup.mutateAsync(input)}
      />
      <CustomerMessageDialog
        open={messageOpen}
        onOpenChange={setMessageOpen}
        data={data}
        appOrigin={orderUrl}
        busy={message.isPending}
        onConfirm={(input) => message.mutateAsync(input)}
      />
      <CustomerTagsDialog
        open={tagsOpen}
        onOpenChange={setTagsOpen}
        data={data}
        busy={tags.isPending}
        onSave={(ids) => tags.mutateAsync(ids)}
      />
    </div>
  );
}
