"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  useEffect,
  useMemo,
  useRef,
  useState,
  type CSSProperties,
  type ReactNode,
  type RefObject,
} from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { AlertTriangle, ArrowLeft, Bell, Edit3, RefreshCw, Send, Wrench, X } from "lucide-react";
import { toast } from "sonner";

import { MoneyText, PhoneText } from "@/components/orders/badges";
import { Button } from "@/components/ui/button";
import { useSidebar } from "@/components/ui/sidebar";
import { Skeleton } from "@/components/ui/skeleton";
import { customersKeys } from "@/features/customers/api/query-keys";
import { ordersKeys } from "@/features/orders/api/query-keys";
import { buildNewOrderWorkspaceHref } from "@/features/orders/model/order-workspace-intent";
import { useStoreShellContext } from "@/features/stores/api/use-store-shell-context";
import { storeSettingsQueryOptions } from "@/features/messages/api/query-options";
import {
  buildStoreCustomerOutputUrl,
  resolveStoreOutputIdentity,
} from "@/entities/store/model/store-output-identity";
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
import { CustomerStatusBadges } from "@/features/customers/components/customer-status-badges";
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
import { CACHE_TIMES } from "@/lib/query-performance";
import {
  brandGradientStyle,
  controls,
  detailWorkspace,
  pageShell,
  repairOs,
} from "@/lib/ui-patterns";
import { cn } from "@/lib/utils";
import { RepairOsBusinessCard, RepairOsInfoTile } from "@/shared/ui";

type CustomerDetailSurface = "page" | "dialog";

export function CustomerDetailScreen({
  id,
  surface = "page",
  onClose,
}: {
  id: string;
  surface?: CustomerDetailSurface;
  onClose?: () => void;
}) {
  const queryClient = useQueryClient();
  const router = useRouter();
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
  const shell = useStoreShellContext();
  const activeStoreId = shell.activeStore?.id;
  const storeSettingsQuery = useQuery({
    ...storeSettingsQueryOptions(activeStoreId),
    enabled: Boolean(activeStoreId),
  });
  const storeOutputIdentity = useMemo(
    () =>
      resolveStoreOutputIdentity({
        activeStore: shell.activeStore,
        settings: storeSettingsQuery.data,
        settingsState: storeSettingsQuery.isLoading
          ? "loading"
          : storeSettingsQuery.isError
            ? "error"
            : "ready",
      }),
    [
      shell.activeStore,
      storeSettingsQuery.data,
      storeSettingsQuery.isError,
      storeSettingsQuery.isLoading,
    ],
  );

  const { data, isError, isFetching, isLoading, refetch } = useQuery({
    queryKey: customersKeys.detail(id, activeStoreId),
    queryFn: ({ signal }) => getCustomerDetail(id, { signal }),
    staleTime: CACHE_TIMES.detail,
    retry: 1,
    enabled: Boolean(activeStoreId),
  });

  const customerBaseUrl = useMemo(
    () => buildStoreCustomerOutputUrl(storeOutputIdentity, "/"),
    [storeOutputIdentity],
  );

  useEffect(() => {
    setMessageOpen(false);
  }, [activeStoreId]);

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
    queryClient.invalidateQueries({ queryKey: customersKeys.all });
    queryClient.invalidateQueries({ queryKey: ordersKeys.lists() });
  };

  const update = useMutation({
    mutationFn: (input: CustomerUpdateInput) => updateCustomer(id, input),
    onSuccess: () => {
      toast.success("客户已更新");
      setEditOpen(false);
      invalidate();
    },
    onError: () => toast.error("客户保存失败，请重试"),
  });

  const upsertDevice = useMutation({
    mutationFn: (input: CustomerDeviceInput) => upsertCustomerDevice(id, input),
    onSuccess: () => {
      toast.success("设备已保存");
      setDeviceOpen(false);
      setEditingDevice(undefined);
      invalidate();
    },
    onError: () => toast.error("设备保存失败，请重试"),
  });

  const deleteDevice = useMutation({
    mutationFn: (deviceId: string) => deleteCustomerDevice(id, deviceId),
    onSuccess: () => {
      toast.success("设备已删除");
      invalidate();
    },
    onError: () => toast.error("设备删除失败，请重试"),
  });

  const followup = useMutation({
    mutationFn: (input: CustomerFollowupInput) => createCustomerFollowup(id, input),
    onSuccess: () => {
      toast.success("客户待办已创建");
      setFollowupOpen(false);
      invalidate();
    },
    onError: () => toast.error("待办保存失败，请重试"),
  });

  const completeFollowup = useMutation({
    mutationFn: (followupId: string) => completeCustomerFollowup(id, followupId),
    onSuccess: () => {
      toast.success("客户待办已完成");
      invalidate();
    },
    onError: () => toast.error("待办更新失败，请重试"),
  });

  const message = useMutation({
    mutationFn: (input: CustomerMessageInput) => sendCustomerMessage(id, input),
    onSuccess: () => {
      toast.success("客户消息已记录");
      setMessageOpen(false);
      invalidate();
    },
    onError: () => toast.error("联系记录保存失败，请重试"),
  });

  const tags = useMutation({
    mutationFn: (tagIds: string[]) => setCustomerTags(id, tagIds),
    onSuccess: () => {
      toast.success("客户标签已更新");
      setTagsOpen(false);
      invalidate();
    },
    onError: () => toast.error("标签保存失败，请重试"),
  });

  const goBackToCustomers = () => {
    if (window.history.length > 1) router.back();
    else router.push("/customers");
  };

  if (isLoading) {
    return (
      <div
        className={cn(
          surface === "page"
            ? cn(pageShell.list, "space-y-3 pb-8 pt-3 sm:pt-5")
            : cn(detailWorkspace.root, "flex h-full min-h-0 flex-col space-y-3 p-3 sm:p-4"),
        )}
      >
        {surface === "dialog" && onClose ? (
          <div className="flex shrink-0 justify-end">
            <Button
              type="button"
              variant="outline"
              size="icon"
              className="size-8 rounded-lg"
              onClick={onClose}
              aria-label="关闭客户详情"
            >
              <X className="size-4" />
            </Button>
          </div>
        ) : null}
        <Skeleton className="h-28 w-full rounded-2xl" />
        <Skeleton className="h-9 w-full rounded-full sm:w-96" />
        <Skeleton className="h-56 w-full rounded-2xl" />
      </div>
    );
  }

  if (isError && !data) {
    return (
      <CustomerDetailLoadError onRetry={() => void refetch()} surface={surface} onClose={onClose} />
    );
  }

  if (!data) {
    return (
      <CustomerDetailLoadError onRetry={() => void refetch()} surface={surface} onClose={onClose} />
    );
  }

  const { customer, orders, followups, interactions } = data;
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
      <CustomerOverviewPanel data={data} onOpenFollowups={() => setTab("followups")} />
    ) : tab === "devices" ? (
      <CustomerDevicesPanel
        data={data}
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
        data={data}
        onFollowup={(orderId) => {
          setFollowupOrderId(orderId);
          setFollowupOpen(true);
        }}
      />
    ) : tab === "profile" ? (
      <CustomerProfilePanel
        customer={customer}
        tags={data.tags}
        onManageTags={() => setTagsOpen(true)}
      />
    ) : tab === "followups" ? (
      <div className="grid min-w-0 gap-2">
        <CustomerFollowupsPanel
          followups={followups}
          onAdd={openCustomerFollowup}
          onComplete={(followupId) => completeFollowup.mutate(followupId)}
        />
        <CustomerMessagesPanel interactions={interactions} onMessage={() => setMessageOpen(true)} />
        <CustomerTimelinePanel data={data} />
      </div>
    ) : (
      <CustomerProfilePanel
        customer={customer}
        tags={data.tags}
        onManageTags={() => setTagsOpen(true)}
      />
    );

  return (
    <div
      className={cn(
        "w-full min-w-0 max-w-full overflow-x-hidden",
        surface === "page"
          ? cn(
              "mx-auto max-w-[430px] px-2",
              repairOs.mobileFloatingPage,
              "md:!max-w-2xl md:!pb-20 md:!pt-[var(--repair-os-mobile-floating-offset,calc(env(safe-area-inset-top)+10.75rem))] md:px-5 lg:!max-w-7xl lg:!space-y-3 lg:!pb-8 lg:!pt-5 lg:px-6",
            )
          : cn(detailWorkspace.root, "flex h-full min-h-0 flex-col"),
      )}
      style={detailStyle}
    >
      {surface === "page" ? (
        <CustomerMobileFloatingHeader
          headerRef={mobileHeaderRef}
          data={data}
          tabs={tabs}
          activeTab={tab}
          onTabChange={setTab}
          onBack={goBackToCustomers}
          onEdit={() => setEditOpen(true)}
        />
      ) : null}

      {isError ? (
        <RepairOsBusinessCard
          as="div"
          data-ui="customer-detail-refresh-warning"
          className={cn(
            "mb-2 items-center gap-2 rounded-lg border-status-warn-foreground/25 bg-status-warn/10 px-3 py-2 text-xs text-status-warn-foreground shadow-none hover:bg-status-warn/10",
            surface === "dialog" && "mx-2 mt-2 shrink-0 sm:mx-3 md:mx-4",
          )}
          leading={
            <span className="grid size-7 place-items-center rounded-lg bg-status-warn/15">
              <AlertTriangle className="size-3.5" />
            </span>
          }
          trailing={
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="h-7 shrink-0 gap-1 px-2 text-xs text-status-warn-foreground hover:text-status-warn-foreground"
              disabled={isFetching}
              onClick={() => void refetch()}
            >
              <RefreshCw className={cn("size-3", isFetching && "animate-spin")} /> 重试
            </Button>
          }
          trailingClassName="justify-self-end"
        >
          <span className="block min-w-0 truncate">更新没有成功，当前仍显示上次内容。</span>
        </RepairOsBusinessCard>
      ) : null}

      <div
        className={cn(
          surface === "page"
            ? "hidden lg:block"
            : "shrink-0 p-2 pb-0 sm:p-3 sm:pb-0 md:p-4 md:pb-0",
        )}
      >
        <CustomerHero
          data={data}
          onMessage={() => setMessageOpen(true)}
          onFollowup={openCustomerFollowup}
          onEdit={() => setEditOpen(true)}
          showBackLink={surface === "page"}
          onClose={surface === "dialog" ? onClose : undefined}
        />
      </div>

      <div
        className={cn(
          surface === "dialog"
            ? "shrink-0 px-2 sm:px-3 md:px-4"
            : "hidden lg:sticky lg:top-14 lg:z-20 lg:block lg:bg-background/95 lg:pt-2 lg:backdrop-blur",
        )}
      >
        <CustomerDetailTabs
          tabs={tabs}
          activeTab={tab}
          onChange={setTab}
          idPrefix="customer-detail-main"
          panelIdPrefix="customer-detail"
        />
      </div>

      <div
        className={cn(
          "grid min-w-0 gap-3 xl:grid-cols-[minmax(0,1fr)_340px]",
          surface === "dialog"
            ? "min-h-0 flex-1 overflow-y-auto px-2 pb-2 sm:px-3 sm:pb-3 md:px-4 md:pb-4"
            : "",
        )}
      >
        <div
          id={`customer-detail-panel-${tab}`}
          role="tabpanel"
          aria-label={tabs.find((item) => item.key === tab)?.label}
          className="min-w-0"
        >
          {detailPanel}
        </div>
        <CustomerDesktopSummaryRail
          data={data}
          onMessage={() => setMessageOpen(true)}
          onFollowup={openCustomerFollowup}
        />
      </div>

      {surface === "page" ? (
        <CustomerMobileActionBar
          customerId={customer.id}
          onMessage={() => setMessageOpen(true)}
          onFollowup={openCustomerFollowup}
        />
      ) : null}

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
        appOrigin={customerBaseUrl}
        storeIdentity={storeOutputIdentity}
        canReadStoreSettings={shell.permissions?.canReadStoreSettings === true}
        canUpdateStoreSettings={shell.permissions?.canUpdateStoreSettings === true}
        onRetryStoreSettings={storeSettingsQuery.refetch}
        onReloadStoreContext={shell.retry}
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
  tabs,
  activeTab,
  onTabChange,
  onBack,
  onEdit,
  headerRef,
}: {
  data: CustomerDetail;
  tabs: ReturnType<typeof buildCustomerDetailTabs>;
  activeTab: CustomerDetailTabKey;
  onTabChange: (tab: CustomerDetailTabKey) => void;
  onBack: () => void;
  onEdit: () => void;
  headerRef: RefObject<HTMLDivElement | null>;
}) {
  const { customer, stats } = data;
  const summary = getCustomerDetailWorkSummary(data);
  const { isMobile, state: sidebarState } = useSidebar();
  const workspaceInset = isMobile
    ? undefined
    : sidebarState === "collapsed"
      ? "var(--sidebar-width-icon)"
      : "var(--sidebar-width)";

  return (
    <div
      ref={headerRef}
      className={cn(repairOs.mobileFloatingHeaderShell, "md:!block lg:!hidden")}
      style={workspaceInset ? { left: workspaceInset } : undefined}
    >
      <section className={cn(repairOs.mobileFloatingHeaderCard, "md:max-w-2xl")}>
        <header className={repairOs.mobileFloatingHeaderNav}>
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="size-11 rounded-xl"
            aria-label="返回客户列表"
            onClick={onBack}
          >
            <ArrowLeft className="size-4" />
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
            className="size-11 rounded-xl bg-card"
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
            <CustomerStatusBadges
              compact
              customer={{
                active_order_count: stats.active_order_count ?? 0,
                outstanding_amount: stats.outstanding_amount ?? stats.unpaid_amount,
                unpaid_amount: stats.unpaid_amount,
                finance_redacted: stats.finance_redacted,
              }}
              className="max-w-[9rem] justify-end"
            />
          </div>

          <CustomerDetailTabs
            tabs={tabs}
            activeTab={activeTab}
            onChange={onTabChange}
            idPrefix="customer-detail-mobile"
            panelIdPrefix="customer-detail"
            className="mb-0 mt-1.5"
          />
        </div>
      </section>
    </div>
  );
}

function CustomerMobileActionBar({
  customerId,
  onMessage,
  onFollowup,
}: {
  customerId: string;
  onMessage: () => void;
  onFollowup: () => void;
}) {
  const { isMobile, state: sidebarState } = useSidebar();
  const workspaceInset = isMobile
    ? undefined
    : sidebarState === "collapsed"
      ? "var(--sidebar-width-icon)"
      : "var(--sidebar-width)";

  return (
    <div
      className="fixed inset-x-0 bottom-0 z-40 border-t border-border/70 bg-background/95 px-2 pb-[calc(env(safe-area-inset-bottom)+0.5rem)] pt-2 backdrop-blur transition-[left] lg:hidden"
      style={workspaceInset ? { left: workspaceInset } : undefined}
    >
      <div className="mx-auto grid max-w-2xl grid-cols-3 gap-2">
        <Button
          asChild
          size="sm"
          className={cn("h-11 gap-1.5", controls.brandButton)}
          style={brandGradientStyle}
        >
          <Link
            href={buildNewOrderWorkspaceHref({
              source: "customer",
              customerId,
            })}
          >
            <Wrench className="size-4" /> 新建工单
          </Link>
        </Button>
        <Button
          type="button"
          size="sm"
          variant="outline"
          className="h-11 gap-1.5 bg-card"
          onClick={onMessage}
        >
          <Send className="size-4" /> 发消息
        </Button>
        <Button
          type="button"
          size="sm"
          variant="outline"
          className="h-11 gap-1.5 bg-card"
          onClick={onFollowup}
        >
          <Bell className="size-4" /> 加待办
        </Button>
      </div>
    </div>
  );
}

function CustomerDesktopSummaryRail({
  data,
  onMessage,
  onFollowup,
}: {
  data: CustomerDetail;
  onMessage: () => void;
  onFollowup: () => void;
}) {
  const { customer, stats } = data;
  const summary = getCustomerDetailWorkSummary(data);
  const openFollowups = data.followups.filter((followup) => followup.status === "open").length;

  return (
    <aside className="hidden min-w-0 xl:block">
      <section className={cn(repairOs.adminSection, "sticky top-4 space-y-3 p-3")}>
        <p className="truncate text-[10px] font-semibold uppercase tracking-widest text-muted-foreground/70">
          客户工作栏
        </p>

        <div className="grid grid-cols-3 gap-2">
          <CustomerRailMetric label="设备" value={stats.device_count} />
          <CustomerRailMetric
            label="历史 / 有效"
            value={`${stats.order_count} / ${stats.valid_order_count ?? 0}`}
          />
          <CustomerRailMetric label="待办" value={openFollowups} />
          <CustomerRailMetric
            label={stats.finance_redacted ? "金额" : "待收"}
            value={
              stats.finance_redacted ? "受限" : <MoneyText amount={stats.unpaid_amount ?? 0} />
            }
          />
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
            <Link
              href={buildNewOrderWorkspaceHref({
                source: "customer",
                customerId: customer.id,
              })}
            >
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
    <RepairOsInfoTile
      label={label}
      value={value}
      frame="plain"
      className="min-w-0 rounded-lg bg-[var(--surface-panel-muted)] px-2 py-1.5"
      labelClassName="text-[9px]"
      valueClassName="truncate font-mono text-xs font-semibold leading-4 tabular-nums"
    />
  );
}

function CustomerDetailLoadError({
  onRetry,
  surface,
  onClose,
}: {
  onRetry: () => void;
  surface: CustomerDetailSurface;
  onClose?: () => void;
}) {
  return (
    <div
      className={cn(
        surface === "page"
          ? cn(pageShell.list, "pb-8 pt-3 sm:pt-5")
          : cn(detailWorkspace.root, "flex h-full min-h-0 items-center justify-center p-3 sm:p-4"),
      )}
    >
      <RepairOsBusinessCard
        as="div"
        data-ui="customer-detail-load-error"
        className="mx-auto mt-8 max-w-sm items-start rounded-xl border-status-danger-foreground/25 px-4 py-3 text-status-danger-foreground shadow-[var(--shadow-card)]"
        leading={
          <span className="grid size-9 place-items-center rounded-lg bg-status-danger/10 text-status-danger-foreground">
            <AlertTriangle className="size-4" />
          </span>
        }
        leadingClassName="pt-0.5"
      >
        <span className="block text-sm font-semibold text-foreground">客户详情加载失败</span>
        <span className="mt-1 block break-words text-xs leading-5 text-muted-foreground">
          请检查网络后重新加载，已有客户资料不会受影响。
        </span>
        <div className="mt-3 grid grid-cols-2 gap-2">
          {surface === "dialog" && onClose ? (
            <Button
              type="button"
              variant="outline"
              className="h-11 gap-1.5 text-xs lg:h-9"
              onClick={onClose}
            >
              <X className="size-3.5" />
              关闭
            </Button>
          ) : (
            <Button asChild variant="outline" className="h-11 gap-1.5 text-xs lg:h-9">
              <Link href="/customers">
                <ArrowLeft className="size-3.5" />
                返回客户
              </Link>
            </Button>
          )}
          <Button type="button" className="h-11 gap-1.5 text-xs lg:h-9" onClick={onRetry}>
            <RefreshCw className="size-3.5" />
            重新加载
          </Button>
        </div>
      </RepairOsBusinessCard>
    </div>
  );
}
