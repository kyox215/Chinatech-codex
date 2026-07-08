"use client";

import Link from "next/link";
import {
  useEffect,
  useRef,
  useState,
  type CSSProperties,
  type ReactNode,
  type RefObject,
} from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { AlertTriangle, ArrowLeft, Bell, Edit3, RefreshCw, Send, Wrench } from "lucide-react";
import { toast } from "sonner";

import { MoneyText, PhoneText } from "@/components/orders/badges";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { customersKeys } from "@/features/customers/api/query-keys";
import {
  CustomerFollowupsPanel,
  CustomerMessagesPanel,
  CustomerProfilePanel,
  CustomerTimelinePanel,
} from "@/features/customers/components/customer-activity-panels";
import {
  CustomerDevicesPanel,
  CustomerOrdersPanel,
  CustomerOverviewPanel,
} from "@/features/customers/components/customer-detail-panels";
import { CustomerDetailTabs } from "@/features/customers/components/customer-detail-tabs";
import { CustomerHero } from "@/features/customers/components/customer-hero";
import { CustomerTimelineList } from "@/features/customers/components/customer-profile-blocks";
import { CustomerDeviceDialog } from "@/features/customers/forms/customer-device-dialog";
import { CustomerEditDialog } from "@/features/customers/forms/customer-edit-dialog";
import { CustomerFollowupDialog } from "@/features/customers/forms/customer-followup-dialog";
import { CustomerMessageDialog } from "@/features/customers/forms/customer-message-dialog";
import { CustomerTagsDialog } from "@/features/customers/forms/customer-tags-dialog";
import {
  buildCustomerDetailTabs,
  getCustomerDetailWorkSummary,
  type CustomerDetailTabKey,
} from "@/features/customers/model/customer-list";
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
  type CustomerDetail,
} from "@/lib/repairdesk/api";
import {
  brandGradientStyle,
  controls,
  detailWorkspace,
  pageShell,
  repairOs,
} from "@/lib/ui-patterns";
import { cn } from "@/lib/utils";

type CustomerDetailSurface = "page" | "dialog";

export function CustomerDetailScreen({
  id,
  surface = "page",
}: {
  id: string;
  surface?: CustomerDetailSurface;
}) {
  const queryClient = useQueryClient();
  const mobileHeaderRef = useRef<HTMLDivElement | null>(null);
  const [mobileHeaderHeight, setMobileHeaderHeight] = useState(0);
  const [tab, setTab] = useState<CustomerDetailTabKey>("overview");
  const [editOpen, setEditOpen] = useState(false);
  const [deviceOpen, setDeviceOpen] = useState(false);
  const [editingDevice, setEditingDevice] = useState<Device | undefined>();
  const [followupOpen, setFollowupOpen] = useState(false);
  const [followupOrderId, setFollowupOrderId] = useState<string | undefined>();
  const [messageOpen, setMessageOpen] = useState(false);
  const [tagsOpen, setTagsOpen] = useState(false);
  const [orderUrl, setOrderUrl] = useState("");

  const { data, error, isError, isFetching, isLoading, refetch } = useQuery({
    queryKey: customersKeys.detail(id),
    queryFn: () => getCustomerDetail(id),
    staleTime: 60_000,
    retry: 1,
  });

  useEffect(() => {
    setOrderUrl(window.location.origin);
  }, []);

  useEffect(() => {
    const header = mobileHeaderRef.current;
    if (!header) return;

    const updateHeaderHeight = () => {
      setMobileHeaderHeight(Math.ceil(header.getBoundingClientRect().height));
    };

    updateHeaderHeight();
    const observer = new ResizeObserver(updateHeaderHeight);
    observer.observe(header);
    window.addEventListener("resize", updateHeaderHeight);

    return () => {
      observer.disconnect();
      window.removeEventListener("resize", updateHeaderHeight);
    };
  }, [data?.customer.id]);

  const invalidate = () => {
    queryClient.invalidateQueries({ queryKey: customersKeys.detail(id) });
    queryClient.invalidateQueries({ queryKey: customersKeys.lists() });
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
      toast.success("客户待办已创建");
      setFollowupOpen(false);
      invalidate();
    },
    onError: (error: Error) => toast.error(error.message),
  });

  const completeFollowup = useMutation({
    mutationFn: (followupId: string) => completeCustomerFollowup(id, followupId),
    onSuccess: () => {
      toast.success("客户待办已完成");
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

  const queryErrorMessage = error instanceof Error ? error.message : "客户详情加载失败";

  if (isLoading) {
    return (
      <div
        className={cn(
          surface === "page"
            ? cn(pageShell.list, "space-y-3 pb-8 pt-3 sm:pt-5")
            : cn(detailWorkspace.root, "flex h-full min-h-0 flex-col space-y-3 p-3 sm:p-4"),
        )}
      >
        <Skeleton className="h-28 w-full rounded-2xl" />
        <Skeleton className="h-9 w-full rounded-full sm:w-96" />
        <Skeleton className="h-56 w-full rounded-2xl" />
      </div>
    );
  }

  if (isError && !data) {
    return (
      <CustomerDetailLoadError
        message={queryErrorMessage}
        onRetry={() => void refetch()}
        surface={surface}
      />
    );
  }

  if (!data) {
    return (
      <CustomerDetailLoadError
        message="未找到这个客户档案。"
        onRetry={() => void refetch()}
        surface={surface}
      />
    );
  }

  const { customer, devices, orders, followups, interactions } = data;
  const tabs = buildCustomerDetailTabs(data);
  const detailStyle =
    surface === "page" && mobileHeaderHeight
      ? ({
          "--repair-os-mobile-floating-offset": `${mobileHeaderHeight + 8}px`,
        } as CSSProperties)
      : undefined;
  const openCustomerFollowup = () => {
    setFollowupOrderId(undefined);
    setFollowupOpen(true);
  };
  const detailPanel =
    tab === "overview" ? (
      <CustomerOverviewPanel data={data} />
    ) : tab === "devices" ? (
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
    ) : tab === "orders" ? (
      <CustomerOrdersPanel
        orders={orders}
        onFollowup={(orderId) => {
          setFollowupOrderId(orderId);
          setFollowupOpen(true);
        }}
      />
    ) : tab === "messages" ? (
      <CustomerMessagesPanel interactions={interactions} onMessage={() => setMessageOpen(true)} />
    ) : tab === "profile" ? (
      <CustomerProfilePanel
        customer={customer}
        tags={data.tags}
        onManageTags={() => setTagsOpen(true)}
      />
    ) : tab === "followups" ? (
      <CustomerFollowupsPanel
        followups={followups}
        onAdd={openCustomerFollowup}
        onComplete={(followupId) => completeFollowup.mutate(followupId)}
      />
    ) : (
      <CustomerTimelinePanel data={data} />
    );

  return (
    <div
      className={cn(
        "w-full min-w-0 max-w-full overflow-x-hidden",
        surface === "page"
          ? cn(
              "mx-auto max-w-[430px] px-2 md:max-w-7xl md:px-5",
              repairOs.mobileFloatingPage,
              "md:space-y-3 md:pb-8 md:pt-5",
            )
          : cn(detailWorkspace.root, "flex h-full min-h-0 flex-col"),
      )}
      style={detailStyle}
    >
      {surface === "page" ? (
        <CustomerMobileFloatingHeader
          headerRef={mobileHeaderRef}
          data={data}
          onMessage={() => setMessageOpen(true)}
          onFollowup={() => {
            setFollowupOrderId(undefined);
            setFollowupOpen(true);
          }}
          onEdit={() => setEditOpen(true)}
        />
      ) : null}

      {isError ? (
        <div
          className={cn(
            "mb-2 flex min-w-0 items-center justify-between gap-2 rounded-lg border border-status-warn-foreground/25 bg-status-warn/10 px-3 py-2 text-xs text-status-warn-foreground",
            surface === "dialog" && "mx-2 mt-2 shrink-0 sm:mx-3 md:mx-4",
          )}
        >
          <span className="min-w-0 truncate">客户详情刷新失败：{queryErrorMessage}</span>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="h-7 shrink-0 gap-1 px-2 text-xs"
            disabled={isFetching}
            onClick={() => void refetch()}
          >
            <RefreshCw className={cn("size-3", isFetching && "animate-spin")} /> 重试
          </Button>
        </div>
      ) : null}

      <div
        className={cn(
          surface === "page"
            ? "hidden md:block"
            : "shrink-0 p-2 pb-0 sm:p-3 sm:pb-0 md:p-4 md:pb-0",
        )}
      >
        <CustomerHero
          data={data}
          onMessage={() => setMessageOpen(true)}
          onFollowup={openCustomerFollowup}
          onEdit={() => setEditOpen(true)}
          showBackLink={surface === "page"}
        />
      </div>

      <div className={cn(surface === "dialog" && "shrink-0 px-2 sm:px-3 md:px-4")}>
        <CustomerDetailTabs tabs={tabs} activeTab={tab} onChange={setTab} />
      </div>

      <div
        className={cn(
          "grid min-w-0 gap-3 xl:grid-cols-[minmax(0,1fr)_340px]",
          surface === "dialog"
            ? "min-h-0 flex-1 overflow-y-auto px-2 pb-2 sm:px-3 sm:pb-3 md:px-4 md:pb-4"
            : "",
        )}
      >
        <div className="min-w-0">{detailPanel}</div>
        <CustomerDesktopSummaryRail
          data={data}
          onMessage={() => setMessageOpen(true)}
          onFollowup={openCustomerFollowup}
          onEdit={() => setEditOpen(true)}
        />
      </div>

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

function CustomerMobileFloatingHeader({
  data,
  onMessage,
  onFollowup,
  onEdit,
  headerRef,
}: {
  data: CustomerDetail;
  onMessage: () => void;
  onFollowup: () => void;
  onEdit: () => void;
  headerRef: RefObject<HTMLDivElement | null>;
}) {
  const { customer } = data;
  const summary = getCustomerDetailWorkSummary(data);
  const openFollowups = data.followups.filter((followup) => followup.status === "open").length;

  return (
    <div ref={headerRef} className={cn(repairOs.mobileFloatingHeaderShell, "md:hidden")}>
      <section className={repairOs.mobileFloatingHeaderCard}>
        <header className={repairOs.mobileFloatingHeaderNav}>
          <Button asChild variant="ghost" size="icon" className="size-8 rounded-lg">
            <Link href="/customers" aria-label="返回客户">
              <ArrowLeft className="size-4" />
            </Link>
          </Button>
          <div className="min-w-0 text-center">
            <p className="truncate text-xs font-semibold leading-4">客户详情</p>
            <p className="truncate text-[9px] leading-3 text-muted-foreground">
              {summary.label} · {customer.preferred_channel === "sms" ? "SMS" : "WhatsApp"}
            </p>
          </div>
          <Button
            type="button"
            variant="outline"
            size="icon"
            className="size-8 rounded-lg bg-card"
            aria-label="编辑客户"
            onClick={onEdit}
          >
            <Edit3 className="size-4" />
          </Button>
        </header>

        <div className={repairOs.mobileFloatingHeaderBody}>
          <div className="grid min-w-0 grid-cols-[minmax(0,1fr)_auto] gap-2">
            <div className="min-w-0">
              <div className="flex min-w-0 items-center gap-1.5">
                <p className="min-w-0 truncate text-sm font-semibold leading-5">{customer.name}</p>
                {customer.blacklisted_at ? (
                  <span className="shrink-0 rounded-full bg-status-danger px-1.5 py-0.5 text-[9px] font-semibold leading-none text-status-danger-foreground">
                    黑名单
                  </span>
                ) : null}
              </div>
              <PhoneText
                value={customer.phone_e164}
                className="mt-0.5 block truncate text-[11px]"
              />
            </div>
            <span
              className={cn(
                "self-start rounded-full px-2 py-1 text-[10px] font-semibold leading-none",
                customerSummaryToneClass(summary.tone),
              )}
            >
              {summary.actionLabel}
            </span>
          </div>

          <div className="mt-1.5 grid grid-cols-3 gap-1 text-center">
            <CustomerMobileMetric label="设备" value={data.devices.length} />
            <CustomerMobileMetric label="工单" value={data.orders.length} />
            <CustomerMobileMetric label="待办" value={openFollowups} />
          </div>

          <div className="mt-1.5 grid grid-cols-3 gap-1.5">
            <Button
              asChild
              size="sm"
              className={cn("h-8 gap-1 rounded-lg text-[11px]", controls.brandButton)}
              style={brandGradientStyle}
            >
              <Link href={`/orders/new?customerId=${customer.id}`}>
                <Wrench className="size-3.5" /> 工单
              </Link>
            </Button>
            <Button
              type="button"
              size="sm"
              variant="outline"
              className="h-8 gap-1 rounded-lg bg-card text-[11px]"
              onClick={onMessage}
            >
              <Send className="size-3.5" /> 消息
            </Button>
            <Button
              type="button"
              size="sm"
              variant="outline"
              className="h-8 gap-1 rounded-lg bg-card text-[11px]"
              onClick={onFollowup}
            >
              <Bell className="size-3.5" /> 待办
            </Button>
          </div>
        </div>
      </section>
    </div>
  );
}

function CustomerMobileMetric({ label, value }: { label: string; value: number }) {
  return (
    <div className="min-w-0 rounded-lg bg-[var(--surface-panel-muted)] px-1.5 py-1">
      <div className="truncate text-[9px] leading-3 text-muted-foreground">{label}</div>
      <div className="truncate font-mono text-[11px] font-semibold leading-4 tabular-nums">
        {value}
      </div>
    </div>
  );
}

function CustomerDesktopSummaryRail({
  data,
  onMessage,
  onFollowup,
  onEdit,
}: {
  data: CustomerDetail;
  onMessage: () => void;
  onFollowup: () => void;
  onEdit: () => void;
}) {
  const { customer, stats } = data;
  const summary = getCustomerDetailWorkSummary(data);
  const openFollowups = data.followups.filter((followup) => followup.status === "open").length;

  return (
    <aside className="hidden min-w-0 xl:block">
      <section className={cn(repairOs.adminSection, "sticky top-4 space-y-3 p-3")}>
        <div className="min-w-0">
          <p className="truncate text-[10px] font-semibold uppercase tracking-widest text-muted-foreground/70">
            客户工作栏
          </p>
          <div className="mt-2 flex min-w-0 items-center justify-between gap-2">
            <div className="min-w-0">
              <h2 className="truncate text-sm font-semibold">{customer.name}</h2>
              <PhoneText
                value={customer.phone_e164}
                className="mt-0.5 block truncate text-[11px]"
              />
            </div>
            <span
              className={cn(
                "shrink-0 rounded-full px-2 py-1 text-[10px] font-semibold",
                customerSummaryToneClass(summary.tone),
              )}
              title={summary.detail}
            >
              {summary.label}
            </span>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-2">
          <CustomerRailMetric label="设备" value={stats.device_count} />
          <CustomerRailMetric label="工单" value={stats.order_count} />
          <CustomerRailMetric label="待办" value={openFollowups} />
          <CustomerRailMetric label="未结清" value={<MoneyText amount={stats.unpaid_amount} />} />
        </div>

        <div className="rounded-lg bg-[var(--surface-panel-muted)] px-2.5 py-2">
          <p className="truncate text-[10px] leading-3 text-muted-foreground">下一步</p>
          <p className="mt-0.5 line-clamp-2 text-xs font-medium leading-5">{summary.actionLabel}</p>
        </div>

        <div className="grid grid-cols-2 gap-2">
          <Button
            asChild
            size="sm"
            className={cn("h-8 gap-1.5 text-xs", controls.brandButton)}
            style={brandGradientStyle}
          >
            <Link href={`/orders/new?customerId=${customer.id}`}>
              <Wrench className="size-3.5" /> 工单
            </Link>
          </Button>
          <Button
            type="button"
            size="sm"
            variant="outline"
            className="h-8 gap-1.5 text-xs"
            onClick={onMessage}
          >
            <Send className="size-3.5" /> 消息
          </Button>
          <Button
            type="button"
            size="sm"
            variant="outline"
            className="h-8 gap-1.5 text-xs"
            onClick={onFollowup}
          >
            <Bell className="size-3.5" /> 待办
          </Button>
          <Button
            type="button"
            size="sm"
            variant="outline"
            className="h-8 gap-1.5 text-xs"
            onClick={onEdit}
          >
            <Edit3 className="size-3.5" /> 编辑
          </Button>
        </div>

        <div className="min-w-0 border-t border-[var(--border-panel)] pt-3">
          <h3 className="mb-2 text-xs font-semibold">最近动态</h3>
          <CustomerTimelineList data={data} limit={4} />
        </div>
      </section>
    </aside>
  );
}

function CustomerRailMetric({ label, value }: { label: string; value: ReactNode }) {
  return (
    <div className="min-w-0 rounded-lg bg-[var(--surface-panel-muted)] px-2 py-1.5">
      <div className="truncate text-[9px] leading-3 text-muted-foreground">{label}</div>
      <div className="mt-0.5 truncate font-mono text-xs font-semibold leading-4 tabular-nums">
        {value}
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

function CustomerDetailLoadError({
  message,
  onRetry,
  surface,
}: {
  message: string;
  onRetry: () => void;
  surface: CustomerDetailSurface;
}) {
  return (
    <div
      className={cn(
        surface === "page"
          ? cn(pageShell.list, "pb-8 pt-3 sm:pt-5")
          : cn(detailWorkspace.root, "flex h-full min-h-0 items-center justify-center p-3 sm:p-4"),
      )}
    >
      <section className="mx-auto mt-8 max-w-sm rounded-xl border border-status-danger-foreground/25 bg-card p-5 text-center shadow-[var(--shadow-card)]">
        <span className="mx-auto grid size-10 place-items-center rounded-full bg-status-danger/10 text-status-danger-foreground">
          <AlertTriangle className="size-5" />
        </span>
        <h1 className="mt-3 text-base font-semibold">客户详情加载失败</h1>
        <p className="mt-1 break-words text-xs leading-5 text-muted-foreground">{message}</p>
        <div className="mt-4 grid grid-cols-2 gap-2">
          <Button asChild variant="outline" className="h-9 gap-1.5 text-xs">
            <Link href="/customers">
              <ArrowLeft className="size-3.5" />
              返回客户
            </Link>
          </Button>
          <Button type="button" className="h-9 gap-1.5 text-xs" onClick={onRetry}>
            <RefreshCw className="size-3.5" />
            重新加载
          </Button>
        </div>
      </section>
    </div>
  );
}
