"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  useEffect,
  useMemo,
  useRef,
  useState,
  type CSSProperties,
  type MouseEvent as ReactMouseEvent,
  type RefObject,
} from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { AlertTriangle, ArrowLeft, RefreshCw, Send, Wrench, X } from "lucide-react";
import { toast } from "sonner";

import { PhoneText } from "@/components/orders/badges";
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
import { readCustomerListReturnState } from "@/features/customers/model/customer-list-return-state";
import { CustomerDeviceDialog } from "@/features/customers/forms/customer-device-dialog";
import { CustomerEditDialog } from "@/features/customers/forms/customer-edit-dialog";
import { CustomerFollowupDialog } from "@/features/customers/forms/customer-followup-dialog";
import { CustomerMessageDialog } from "@/features/customers/forms/customer-message-dialog";
import { CustomerTagsDialog } from "@/features/customers/forms/customer-tags-dialog";
import {
  buildCustomerDetailTabs,
  type CustomerBusinessTabKey,
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
  type CustomerTagsUpdateInput,
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
import { RepairOsBusinessCard } from "@/shared/ui";
import { useLocale } from "@/shared/i18n/locale-provider";
import { localizeCustomerTab } from "@/features/customers/model/customer-i18n";

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
  const { t, locale } = useLocale();
  const queryClient = useQueryClient();
  const router = useRouter();
  const mobileHeaderRef = useRef<HTMLDivElement | null>(null);
  const mobileActionsRef = useRef<HTMLDivElement | null>(null);
  const lastInvokingControlRef = useRef<HTMLElement | null>(null);
  const followupReturnFocusRef = useRef<HTMLElement | null>(null);
  const deviceReturnFocusRef = useRef<HTMLElement | null>(null);
  const [mobileHeaderHeight, setMobileHeaderHeight] = useState(0);
  const [mobileActionsHeight, setMobileActionsHeight] = useState(0);
  const [tab, setTab] = useState<CustomerDetailTabKey>("overview");
  const [businessTab, setBusinessTab] = useState<CustomerBusinessTabKey>("orders");
  useEffect(() => {
    setTab("overview");
    setBusinessTab("orders");
    setEditOpen(false);
    setDeviceOpen(false);
    setEditingDevice(undefined);
    setFollowupOpen(false);
    setFollowupOrderId(undefined);
    setMessageOpen(false);
    setTagsOpen(false);
  }, [id]);
  const editReturnFocusRef = useRef<HTMLElement | null>(null);
  const [editOpen, setEditOpen] = useState(false);
  const [deviceOpen, setDeviceOpen] = useState(false);
  const [editingDevice, setEditingDevice] = useState<Device | undefined>();
  const [followupOpen, setFollowupOpen] = useState(false);
  const [followupOrderId, setFollowupOrderId] = useState<string | undefined>();
  const [messageOpen, setMessageOpen] = useState(false);
  const [messageChannel, setMessageChannel] = useState<"whatsapp" | "sms" | undefined>();
  const openMessage = (channel?: "whatsapp" | "sms") => {
    setMessageChannel(channel);
    setMessageOpen(true);
  };
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

  const { data, isError, isFetching, isPending, refetch } = useQuery({
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

  useEffect(() => {
    const actions = mobileActionsRef.current;
    if (!actions) return;

    const updateActionsHeight = () => {
      setMobileActionsHeight(Math.ceil(actions.getBoundingClientRect().height));
    };

    updateActionsHeight();
    const observer = new ResizeObserver(updateActionsHeight);
    observer.observe(actions);
    window.addEventListener("resize", updateActionsHeight);

    return () => {
      observer.disconnect();
      window.removeEventListener("resize", updateActionsHeight);
    };
  }, [data?.customer.id]);

  const invalidate = () => {
    queryClient.invalidateQueries({ queryKey: customersKeys.all });
    queryClient.invalidateQueries({ queryKey: ordersKeys.lists() });
  };

  const update = useMutation({
    mutationFn: (input: CustomerUpdateInput) => updateCustomer(id, input),
    onSuccess: () => {
      toast.success(t("customers.detail.updated"));
      setEditOpen(false);
      invalidate();
    },
    onError: () => toast.error(t("customers.detail.updateFailed")),
  });

  const upsertDevice = useMutation({
    mutationFn: (input: CustomerDeviceInput) => upsertCustomerDevice(id, input),
    onSuccess: () => {
      toast.success(t("customers.detail.deviceSaved"));
      setDeviceOpen(false);
      setEditingDevice(undefined);
      invalidate();
    },
    onError: () => toast.error(t("customers.detail.deviceSaveFailed")),
  });

  const deleteDevice = useMutation({
    mutationFn: (device: Device) => deleteCustomerDevice(id, device.id, device.updated_at ?? ""),
    onSuccess: () => {
      toast.success(t("customers.detail.deviceDeleted"));
      invalidate();
    },
    onError: (error) => {
      toast.error(
        error && "code" in error && error.code === "CUSTOMER_DEVICE_HAS_ORDERS"
          ? t("customers.device.deleteBlockedHistory")
          : error && "status" in error && error.status === 409
            ? locale === "zh-CN"
              ? "设备资料已更新，请刷新后重新确认删除"
              : locale === "it-IT"
                ? "Dispositivo aggiornato. Ricarica e conferma di nuovo."
                : "Device changed. Reload and confirm deletion again."
            : t("customers.detail.deviceDeleteFailed"),
      );
      invalidate();
    },
  });

  const followup = useMutation({
    mutationFn: (input: CustomerFollowupInput) => createCustomerFollowup(id, input),
    onSuccess: () => {
      toast.success(t("customers.detail.followupCreated"));
      setFollowupOpen(false);
      invalidate();
    },
    onError: () => toast.error(t("customers.detail.followupSaveFailed")),
  });

  const completeFollowup = useMutation({
    mutationFn: (followupId: string) => completeCustomerFollowup(id, followupId),
    onSuccess: () => {
      toast.success(t("customers.detail.followupCompleted"));
      invalidate();
    },
    onError: () => toast.error(t("customers.detail.followupUpdateFailed")),
  });

  const message = useMutation({
    mutationFn: (input: CustomerMessageInput) => sendCustomerMessage(id, input),
    onSuccess: () => {
      toast.success(t("customers.detail.messageRecorded"));
      setMessageOpen(false);
      invalidate();
    },
    onError: () => toast.error(t("customers.detail.messageSaveFailed")),
  });

  const tags = useMutation({
    mutationFn: (input: CustomerTagsUpdateInput) => setCustomerTags(id, input),
    onSuccess: () => {
      toast.success(t("customers.detail.tagsUpdated"));
      setTagsOpen(false);
      invalidate();
    },
    onError: () => toast.error(t("customers.detail.tagsSaveFailed")),
  });

  const goBackToCustomers = () => {
    const checkpoint = readCustomerListReturnState(
      {
        storeId: activeStoreId ?? "",
        userId: shell.userId ?? "",
        authorityFingerprint: shell.authorityFingerprint,
      },
      id,
    );
    router.push(checkpoint?.href ?? "/customers", { scroll: false });
  };

  if (!data && !isError && (shell.status === "loading" || (Boolean(activeStoreId) && isPending))) {
    return (
      <div
        className={cn(
          surface === "page"
            ? cn(pageShell.list, "space-y-3 pb-8 pt-3 sm:pt-5")
            : cn(detailWorkspace.root, "flex h-full min-h-0 flex-col space-y-3 p-3 sm:p-4"),
        )}
      >
        <span role="status" aria-label={t("customers.detail.loading")} className="sr-only">
          {t("customers.detail.loading")}
        </span>
        {surface === "dialog" && onClose ? (
          <div className="flex shrink-0 justify-end">
            <Button
              type="button"
              variant="outline"
              size="icon"
              className="size-8 rounded-lg"
              onClick={onClose}
              aria-label={t("customers.detail.close")}
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
      <CustomerDetailLoadError
        onRetry={() => void refetch()}
        surface={surface}
        onClose={onClose}
        onBack={goBackToCustomers}
      />
    );
  }

  if (!data) {
    return (
      <CustomerDetailLoadError
        onRetry={() => void refetch()}
        surface={surface}
        onClose={onClose}
        onBack={goBackToCustomers}
      />
    );
  }

  const { customer, orders, followups, interactions } = data;
  const tabs = buildCustomerDetailTabs(data).map((item) => ({
    ...item,
    label: localizeCustomerTab(item.key, item.label, t),
  }));
  const detailStyle =
    surface === "page"
      ? ({
          ...(mobileHeaderHeight
            ? { "--repair-os-mobile-floating-offset": `${mobileHeaderHeight + 8}px` }
            : {}),
          ...(mobileActionsHeight
            ? { "--customer-detail-mobile-actions-height": `${mobileActionsHeight}px` }
            : {}),
        } as CSSProperties)
      : undefined;
  const openCustomerFollowup = () => {
    followupReturnFocusRef.current = lastInvokingControlRef.current;
    setFollowupOrderId(undefined);
    setFollowupOpen(true);
  };
  const rememberInvokingControl = (event: ReactMouseEvent<HTMLDivElement>) => {
    const target = event.target;
    const control = target instanceof Element ? target.closest("button, a[href]") : null;
    if (!(control instanceof HTMLElement)) return;
    lastInvokingControlRef.current = control;
    queueMicrotask(() => {
      if (lastInvokingControlRef.current === control) lastInvokingControlRef.current = null;
    });
  };
  const detailPanel =
    tab === "overview" ? (
      <CustomerOverviewPanel
        data={data}
        onOpenBusiness={() => setTab("business")}
        onOpenProfile={() => setTab("profile")}
      />
    ) : tab === "business" ? (
      <div className="min-w-0" data-ui="customer-business-panel">
        <CustomerDetailTabs
          tabs={
            [
              { key: "orders", label: t("customers.tab.orders") },
              { key: "devices", label: t("customers.tab.devices") },
              { key: "followups", label: t("customers.tab.followups") },
            ] as const
          }
          activeTab={businessTab}
          onChange={setBusinessTab}
          idPrefix="customer-business"
          panelIdPrefix="customer-business"
        />
        <div
          id={`customer-business-panel-${businessTab}`}
          role="tabpanel"
          aria-labelledby={`customer-business-tab-${businessTab}`}
        >
          {businessTab === "orders" ? (
            <CustomerOrdersPanel
              data={data}
              onFollowup={(orderId) => {
                followupReturnFocusRef.current = lastInvokingControlRef.current;
                setFollowupOrderId(orderId);
                setFollowupOpen(true);
              }}
            />
          ) : businessTab === "devices" ? (
            <CustomerDevicesPanel
              data={data}
              deleting={deleteDevice.isPending}
              onRefresh={invalidate}
              onAdd={(control) => {
                deviceReturnFocusRef.current = control;
                setEditingDevice(undefined);
                setDeviceOpen(true);
              }}
              onEdit={(device, control) => {
                deviceReturnFocusRef.current = control;
                setEditingDevice(device);
                setDeviceOpen(true);
              }}
              onDelete={(device) => deleteDevice.mutateAsync(device)}
            />
          ) : (
            <div className="grid min-w-0 gap-2">
              <CustomerFollowupsPanel
                followups={followups}
                onAdd={openCustomerFollowup}
                onComplete={(followupId) => completeFollowup.mutate(followupId)}
              />
              <details
                className="rounded-xl border border-[var(--border-panel)] bg-card px-3 py-2"
                data-ui="customer-message-records"
              >
                <summary className="cursor-pointer text-sm font-semibold">
                  {t("customers.detail.contactRecords")}
                </summary>
                <div className="mt-2">
                  <CustomerMessagesPanel
                    interactions={interactions}
                    onMessage={() => openMessage()}
                  />
                </div>
              </details>
              <details
                className="rounded-xl border border-[var(--border-panel)] bg-card px-3 py-2"
                data-ui="customer-full-timeline"
              >
                <summary className="cursor-pointer text-sm font-semibold">
                  {t("customers.detail.operationLog")}
                </summary>
                <div className="mt-2">
                  <CustomerTimelinePanel data={data} />
                </div>
              </details>
            </div>
          )}
        </div>
      </div>
    ) : (
      <CustomerProfilePanel
        customer={customer}
        tags={data.tags}
        onManageTags={() => setTagsOpen(true)}
        onEdit={(control) => {
          editReturnFocusRef.current = control;
          setEditOpen(true);
        }}
      />
    );

  return (
    <div
      data-ui={surface === "page" ? "customer-detail-page" : "customer-detail-workspace"}
      className={cn(
        "w-full min-w-0 max-w-full overflow-x-hidden",
        surface === "page"
          ? cn(
              "mx-auto max-w-[430px] px-2",
              repairOs.mobileFloatingPage,
              "!pb-[calc(var(--customer-detail-mobile-actions-height,68px)+0.75rem)] md:!max-w-4xl md:!pb-8 md:!pt-5 md:px-5 lg:!max-w-7xl lg:!space-y-3 lg:px-6",
            )
          : cn(detailWorkspace.root, "flex h-full min-h-0 flex-col"),
      )}
      style={detailStyle}
      onClickCapture={rememberInvokingControl}
    >
      {surface === "page" ? (
        <CustomerMobileFloatingHeader
          headerRef={mobileHeaderRef}
          data={data}
          tabs={tabs}
          activeTab={tab}
          onTabChange={setTab}
          onBack={goBackToCustomers}
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
              <RefreshCw className={cn("size-3", isFetching && "animate-spin")} />{" "}
              {t("customers.detail.retry")}
            </Button>
          }
          trailingClassName="justify-self-end"
        >
          <span className="block min-w-0 whitespace-normal break-words">
            {t("customers.detail.refreshWarning")}
          </span>
        </RepairOsBusinessCard>
      ) : null}

      <div
        data-ui="customer-detail-desktop-hero"
        className={cn(
          surface === "page"
            ? "hidden md:block"
            : "shrink-0 p-2 pb-0 sm:p-3 sm:pb-0 md:p-4 md:pb-0",
        )}
      >
        <CustomerHero
          data={data}
          onMessage={() => openMessage("whatsapp")}
          showBackLink={false}
          onBack={surface === "page" ? goBackToCustomers : undefined}
          onClose={surface === "dialog" ? onClose : undefined}
        />
      </div>

      <div
        data-ui="customer-detail-main-tabs"
        className={cn(
          surface === "dialog"
            ? "shrink-0 px-2 sm:px-3 md:px-4"
            : "hidden md:sticky md:top-14 md:z-20 md:block md:bg-background/95 md:pt-2 md:backdrop-blur",
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
          "grid min-w-0 gap-3",
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
      </div>

      {surface === "page" ? (
        <CustomerMobileActionBar
          actionBarRef={mobileActionsRef}
          customerId={customer.id}
          onMessage={() => openMessage("whatsapp")}
        />
      ) : null}

      <CustomerEditDialog
        onRefresh={invalidate}
        returnFocusRef={editReturnFocusRef}
        open={editOpen}
        onOpenChange={setEditOpen}
        data={data}
        busy={update.isPending}
        onSave={(input) => update.mutateAsync(input)}
      />
      <CustomerDeviceDialog
        onRefresh={invalidate}
        open={deviceOpen}
        onOpenChange={(open) => {
          setDeviceOpen(open);
          if (!open) setEditingDevice(undefined);
        }}
        device={data.devices.find((item) => item.id === editingDevice?.id) ?? editingDevice}
        busy={upsertDevice.isPending}
        returnFocusRef={deviceReturnFocusRef}
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
        returnFocusRef={followupReturnFocusRef}
        onSave={(input) => followup.mutateAsync(input)}
      />
      <CustomerMessageDialog
        initialChannel={messageChannel}
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
        onRefresh={invalidate}
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
  headerRef,
}: {
  data: CustomerDetail;
  tabs: ReturnType<typeof buildCustomerDetailTabs>;
  activeTab: CustomerDetailTabKey;
  onTabChange: (tab: CustomerDetailTabKey) => void;
  onBack: () => void;
  headerRef: RefObject<HTMLDivElement | null>;
}) {
  const { t } = useLocale();
  const { customer } = data;
  const { isMobile, state: sidebarState } = useSidebar();
  const workspaceInset = isMobile
    ? undefined
    : sidebarState === "collapsed"
      ? "var(--sidebar-width-icon)"
      : "var(--sidebar-width)";

  return (
    <div
      ref={headerRef}
      data-ui="customer-detail-mobile-header"
      className={cn(repairOs.mobileFloatingHeaderShell, "md:!hidden")}
      style={workspaceInset ? { left: workspaceInset } : undefined}
    >
      <section className={cn(repairOs.mobileFloatingHeaderCard, "md:max-w-2xl")}>
        <header className={repairOs.mobileFloatingHeaderNav}>
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="size-11 rounded-xl"
            aria-label={t("customers.detail.back")}
            onClick={onBack}
          >
            <ArrowLeft className="size-4" />
          </Button>
          <div className="min-w-0 text-center">
            <h1 className="whitespace-normal break-words text-xs font-semibold leading-4">
              {t("customers.detail.title")}
            </h1>
          </div>
        </header>

        <div className={repairOs.mobileFloatingHeaderBody}>
          <div className="min-w-0">
            <div className="min-w-0">
              <div className="flex min-w-0 items-center gap-1.5">
                <span className="min-w-0 truncate text-left text-sm font-semibold leading-5">
                  {customer.name?.trim() || t("customers.detail.missingName")}
                </span>
                {customer.blacklisted_at ? (
                  <span className="shrink-0 rounded-full bg-status-danger px-1.5 py-0.5 text-xs font-semibold leading-4 text-status-danger-foreground">
                    {t("customers.detail.blacklisted")}
                  </span>
                ) : null}
              </div>
              <PhoneText
                value={customer.phone_e164}
                className="mt-0.5 block truncate text-[11px] lg:text-xs lg:leading-4"
              />
            </div>
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
  actionBarRef,
  customerId,
  onMessage,
}: {
  actionBarRef: RefObject<HTMLDivElement | null>;
  customerId: string;
  onMessage: () => void;
}) {
  const { t } = useLocale();
  const { isMobile, state: sidebarState } = useSidebar();
  const workspaceInset = isMobile
    ? undefined
    : sidebarState === "collapsed"
      ? "var(--sidebar-width-icon)"
      : "var(--sidebar-width)";

  return (
    <div
      ref={actionBarRef}
      data-ui="customer-detail-mobile-actions"
      className="fixed inset-x-0 bottom-0 z-40 border-t border-border/70 bg-background/95 px-2 pb-[calc(env(safe-area-inset-bottom)+0.5rem)] pt-2 backdrop-blur transition-[left] md:hidden"
      style={workspaceInset ? { left: workspaceInset } : undefined}
    >
      <div className="mx-auto grid w-full max-w-[430px] grid-cols-2 gap-2">
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
            <Wrench className="size-4" /> {t("customers.detail.newOrder")}
          </Link>
        </Button>
        <Button
          type="button"
          size="sm"
          variant="outline"
          className="h-11 gap-1.5 bg-card"
          onClick={onMessage}
        >
          <Send className="size-4" /> {t("customers.channel.whatsapp")}
        </Button>
      </div>
    </div>
  );
}

function CustomerDetailLoadError({
  onRetry,
  surface,
  onClose,
  onBack,
}: {
  onRetry: () => void;
  surface: CustomerDetailSurface;
  onClose?: () => void;
  onBack: () => void;
}) {
  const { t } = useLocale();
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
        <span className="block text-sm font-semibold text-foreground">
          {t("customers.detail.loadErrorTitle")}
        </span>
        <span className="mt-1 block break-words text-xs leading-5 text-muted-foreground">
          {t("customers.detail.loadErrorDescription")}
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
              {t("customers.detail.close")}
            </Button>
          ) : (
            <Button variant="outline" className="h-11 gap-1.5 text-xs lg:h-9" onClick={onBack}>
              <ArrowLeft className="size-3.5" />
              {t("customers.detail.backShort")}
            </Button>
          )}
          <Button type="button" className="h-11 gap-1.5 text-xs lg:h-9" onClick={onRetry}>
            <RefreshCw className="size-3.5" />
            {t("customers.detail.reload")}
          </Button>
        </div>
      </RepairOsBusinessCard>
    </div>
  );
}
