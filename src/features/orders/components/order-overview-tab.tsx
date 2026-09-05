"use client";

import { createContext, useContext, useEffect, useMemo, useState } from "react";
import type React from "react";
import { motion } from "framer-motion";
import {
  Calendar,
  Camera,
  CheckCircle2,
  Clock3,
  CreditCard,
  History,
  Image as ImageIcon,
  MessageCircle,
  Plus,
  Send,
  Signature,
  Store,
  TabletSmartphone,
  Trash2,
  UserRound,
  type LucideIcon,
} from "lucide-react";

import { ImeiScannerField } from "@/components/imei-scanner-field";
import { DeviceCustodyBadge, MoneyText, StatusBadge } from "@/components/orders/badges";
import { MoneyKeypadInput } from "@/components/orders/money-keypad-input";
import {
  AccessoryNotesPicker,
  AccessoryNotesPills,
} from "@/features/orders/components/accessory-notes-picker";
import {
  DeviceUnlockEditor,
  DeviceUnlockViewer,
} from "@/features/orders/components/device-unlock-fields";
import {
  OrderWorkspaceEmptyBlock,
  OrderWorkspaceMoneyStrip,
  OrderWorkspaceQuoteDisplayRow,
} from "@/features/orders/components/order-workspace-primitives";
import { OrderPhotoPreviewDialog } from "@/features/orders/components/order-photo-preview-dialog";
import {
  OrderDetailPhotoSlots,
  type OrderDetailPhotoCaptureKind,
} from "@/features/orders/components/order-detail-photo-slots";
import { CustomerBackupPhonesField } from "@/features/customers/forms/customer-backup-phones-field";
import { PhoneContactMenu } from "@/features/orders/components/order-contact-menu";
import { WarrantyPicker, WarrantyTag } from "@/features/orders/components/warranty-picker";
import { CustomerPhoneLookup } from "@/features/orders/forms/customer-phone-lookup";
import {
  DEVICE_CUSTODY_WITH_SHOP,
  deviceCustodyStatusFromOrder,
} from "@/features/orders/model/device-custody";
import { formatOrderDateTime } from "@/features/orders/model/order-date";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Separator } from "@/components/ui/separator";
import { useSidebar } from "@/components/ui/sidebar";
import { Textarea } from "@/components/ui/textarea";
import { inferOrderPaidAmount } from "@/features/orders/model/edit-order-form";
import {
  emptyFinanceFaultDraft,
  normalizeFinanceDraft,
  type FinanceDraftState,
} from "@/features/orders/model/order-finance-draft";
import {
  deriveOrderFinancialState,
  isOrderCancelledForPayment,
} from "@/features/orders/model/order-payment-state";
import type { OrderDetailPrimaryAction } from "@/features/orders/model/order-detail-primary-action";
import { fadeUp } from "@/lib/motion";
import { detailWorkspace } from "@/lib/ui-patterns";
import type {
  Customer,
  OrderAttachment,
  OrderDetail,
  OrderWorkflow,
  StoreSettings,
  Supplier,
  UpdateOrderInput,
} from "@/lib/repairdesk/types";
import { cn } from "@/lib/utils";
import { splitPhoneCandidates, uniqueContactPhones } from "@/shared/lib/phone";
import { useLocale } from "@/shared/i18n/locale-provider";
import {
  localizeOrderDetailApproval,
  localizeOrderDetailEvent,
  localizeOrderDetailFinancialState,
} from "@/features/orders/model/order-detail-i18n";
import { localizeDeviceCustody } from "@/features/orders/model/order-i18n";

type DetailSurface = "page" | "dialog";

type OrderEditContext = {
  draft: UpdateOrderInput;
  onDraftChange: (draft: UpdateOrderInput) => void;
};

type InfoTone = "plain" | "hero" | "soft" | "note" | "metric" | "metricStrong";

const overviewPanelClass =
  "min-w-0 overflow-hidden border-border/70 bg-card/95 p-2.5 shadow-sm sm:p-4";
const inlineEditInputClass =
  "!h-6 !rounded-none !border-0 !border-b !border-transparent !bg-transparent !px-0 !py-0 !shadow-none focus-visible:!border-primary/45 focus-visible:!ring-0";
const inlineEditTextareaClass =
  "!rounded-none !border-0 !border-b !border-transparent !bg-transparent !px-0 !py-0 !shadow-none focus-visible:!border-primary/45 focus-visible:!ring-0";
const inlineFinanceInputClass =
  "!h-6 !rounded-none !border-0 !border-b !border-transparent !bg-transparent !px-0 !py-0 !shadow-none focus-visible:!border-primary/45 focus-visible:!ring-0";
const DetailDensityContext = createContext(false);

function useDenseDetail() {
  return useContext(DetailDensityContext);
}

export function OrderOverviewTab({
  order,
  customer,
  deviceBrand,
  deviceModel,
  deviceImei,
  deviceNotes,
  accessoryNotes,
  isEditing = false,
  editDraft,
  onEditDraftChange,
  financeDraft,
  onFinanceDraftChange,
  financeError,
  canEditIntake = false,
  canEditRepair = false,
  canAdjustFinance = false,
  defaultWarrantyMonths = 6,
  onQuickImeiSave,
  quickImeiPending = false,
  surface = "page",
  storeSettings,
  supplier,
  events = [],
  messages = [],
  workflow,
  onShowRecords,
  photoAttachments = [],
  signatureAttachments = [],
  photoUploadPending = false,
  onPhotoCapture,
  onRequestKioskSignature,
  kioskSignaturePending = false,
  kioskSignatureAvailable = false,
  custodyControl,
}: {
  order: OrderDetail["order"];
  customer?: Customer;
  deviceBrand: string;
  deviceModel: string;
  deviceImei: string;
  deviceNotes?: string;
  accessoryNotes?: string;
  isEditing?: boolean;
  editDraft?: UpdateOrderInput | null;
  onEditDraftChange?: (draft: UpdateOrderInput) => void;
  financeDraft?: FinanceDraftState;
  onFinanceDraftChange?: (draft: FinanceDraftState) => void;
  financeError?: string;
  canEditIntake?: boolean;
  canEditRepair?: boolean;
  canAdjustFinance?: boolean;
  defaultWarrantyMonths?: number;
  onQuickImeiSave?: (imei: string) => void | Promise<void>;
  quickImeiPending?: boolean;
  surface?: DetailSurface;
  storeSettings?: StoreSettings;
  supplier?: Supplier;
  events?: OrderDetail["events"];
  messages?: OrderDetail["messages"];
  workflow?: OrderWorkflow;
  onShowRecords?: () => void;
  photoAttachments?: OrderAttachment[];
  signatureAttachments?: OrderAttachment[];
  photoUploadPending?: boolean;
  onPhotoCapture?: (kind: OrderDetailPhotoCaptureKind, trigger: HTMLButtonElement) => void;
  onRequestKioskSignature?: () => void;
  kioskSignaturePending?: boolean;
  kioskSignatureAvailable?: boolean;
  custodyControl?: React.ReactNode;
}) {
  const edit =
    isEditing && editDraft && onEditDraftChange
      ? {
          draft: editDraft,
          onDraftChange: onEditDraftChange,
        }
      : null;
  const intakeEdit = canEditIntake ? edit : null;
  const repairEdit = canEditRepair ? edit : null;
  const customerPanel = (
    <CustomerPanel
      order={order}
      customer={customer}
      edit={intakeEdit}
      surface={surface}
      onRequestKioskSignature={onRequestKioskSignature}
      kioskSignaturePending={kioskSignaturePending}
      kioskSignatureAvailable={kioskSignatureAvailable}
      signatureAttachments={signatureAttachments}
    />
  );
  const devicePanel = (
    <DeviceIssuePanel
      order={order}
      deviceBrand={deviceBrand}
      deviceModel={deviceModel}
      deviceImei={deviceImei}
      deviceNotes={deviceNotes}
      accessoryNotes={accessoryNotes}
      defaultWarrantyMonths={defaultWarrantyMonths}
      onQuickImeiSave={onQuickImeiSave}
      quickImeiPending={quickImeiPending}
      intakeEdit={intakeEdit}
      repairEdit={repairEdit}
      surface={surface}
    />
  );
  const financePanel = (
    <OrderOverviewFinancePanel
      order={order}
      isEditing={Boolean(edit)}
      financeDraft={financeDraft}
      financeError={financeError}
      onFinanceDraftChange={onFinanceDraftChange}
      canAdjustFinance={canAdjustFinance}
      surface={surface}
    />
  );

  return (
    <motion.div
      variants={fadeUp}
      className={cn("min-w-0", surface !== "page" && detailWorkspace.orderDetailContent)}
    >
      <div className="min-w-0 space-y-2">
        {surface !== "dialog" ? (
          <OrderOverviewDesktopContextStrip
            events={events}
            workflow={workflow}
            onShowRecords={onShowRecords}
          />
        ) : null}

        {surface === "dialog" ? (
          <div
            data-order-detail-main-grid="true"
            data-order-detail-layout="new-order-aligned"
            className={cn("grid min-w-0 gap-2", detailWorkspace.orderDetailGrid)}
          >
            <div
              data-order-detail-column="quote"
              className={detailWorkspace.orderDetailFinanceColumn}
            >
              {financePanel}
            </div>
            <div
              data-order-detail-column="customer-device"
              className={detailWorkspace.orderDetailCoreColumn}
            >
              {customerPanel}
              {devicePanel}
            </div>
            <div
              data-order-detail-column="detail"
              className={detailWorkspace.orderDetailSideColumn}
            >
              <OrderKeyInfoCard
                order={order}
                supplier={supplier}
                surface={surface}
                custodyControl={custodyControl}
              />
              <DesktopRecordsSummaryPanel
                events={events}
                messages={messages}
                workflow={workflow}
                surface={surface}
                onShowRecords={onShowRecords}
              />
            </div>
          </div>
        ) : (
          <div
            data-order-detail-main-grid="true"
            className="grid min-w-0 items-stretch gap-2 md:grid-cols-2 lg:grid-cols-[minmax(0,1fr)_minmax(300px,0.8fr)] xl:grid-cols-[minmax(250px,0.9fr)_minmax(400px,1.28fr)_minmax(280px,0.92fr)]"
          >
            {customerPanel}
            {devicePanel}
            {financePanel}
          </div>
        )}
        {surface !== "dialog" ? (
          <div
            data-order-detail-secondary-grid="true"
            className="grid min-w-0 gap-2 md:grid-cols-2 lg:grid-cols-[minmax(0,1fr)_minmax(300px,0.8fr)] xl:grid-cols-[minmax(250px,0.9fr)_minmax(400px,1.28fr)_minmax(280px,0.92fr)]"
          >
            <OrderKeyInfoCard
              order={order}
              supplier={supplier}
              surface={surface}
              className="h-full"
              custodyControl={custodyControl}
            />
            <DesktopOrderPhotosPanel
              attachments={photoAttachments}
              uploadPending={photoUploadPending}
              onCapture={onPhotoCapture}
              surface={surface}
              className="h-full"
            />
            <DesktopRecordsSummaryPanel
              events={events}
              messages={messages}
              workflow={workflow}
              surface={surface}
              onShowRecords={onShowRecords}
            />
          </div>
        ) : null}
      </div>
    </motion.div>
  );
}

function OrderOverviewDesktopContextStrip({
  events,
  workflow,
  onShowRecords,
}: {
  events: OrderDetail["events"];
  workflow?: OrderWorkflow;
  onShowRecords?: () => void;
}) {
  const { locale, t } = useLocale();
  const latestEvent = events[0];
  const latestLabel = latestEvent
    ? localizeOrderDetailEvent(latestEvent, workflow, t, locale)
    : t("orders2b2.overview.noHistory");
  const latestMeta = latestEvent
    ? `${formatDateTime(latestEvent.created_at, locale)} · ${latestEvent.operator_name}`
    : t("orders2b2.overview.historyHelp");
  return (
    <section data-order-detail-context-strip="true" className="min-w-0">
      <button
        type="button"
        data-order-latest-event="true"
        className="grid min-w-0 grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-2 rounded-md border border-[var(--border-panel)] bg-[var(--surface-panel-muted)] px-2.5 py-1.5 text-left transition-colors hover:bg-accent/45"
        onClick={onShowRecords}
        disabled={!onShowRecords}
      >
        <span className="grid size-7 shrink-0 place-items-center rounded-md bg-primary/10 text-primary">
          <History className="size-3.5" />
        </span>
        <span className="min-w-0">
          <span className="block truncate text-xs font-semibold" title={latestLabel}>
            {latestLabel}
          </span>
          <span className="block truncate text-[11px] leading-4 text-muted-foreground lg:text-xs lg:leading-4">
            {latestMeta}
          </span>
        </span>
        {onShowRecords ? (
          <span className="shrink-0 rounded-md bg-card px-1.5 py-0.5 text-[10px] font-medium text-primary lg:text-[11px] lg:leading-4">
            {t("orders2b2.overview.records")}
          </span>
        ) : null}
      </button>
    </section>
  );
}

export function OrderDetailActionDock({
  order,
  isEditing,
  financeDraft,
  onApprovalDecision,
  approvalDecisionAvailable = false,
  onFlow,
  flowDisabled = false,
  onPay,
  paymentDisabled = false,
  onNotify,
  notifyDisabled = false,
  primaryAction = null,
  surface = "page",
}: {
  order: OrderDetail["order"];
  isEditing: boolean;
  financeDraft: FinanceDraftState;
  onApprovalDecision?: () => void;
  approvalDecisionAvailable?: boolean;
  onFlow: () => void;
  flowDisabled?: boolean;
  onPay: () => void;
  paymentDisabled?: boolean;
  onNotify: () => void;
  notifyDisabled?: boolean;
  primaryAction?: OrderDetailPrimaryAction;
  surface?: DetailSurface;
}) {
  const { t } = useLocale();
  const { isMobile, state: sidebarState } = useSidebar();
  const cancelled = isOrderCancelledForPayment(order);
  const financeRedacted = Boolean(order.finance_redacted);
  const paidAmount = inferOrderPaidAmount(order);
  const normalizedDraft = useMemo(
    () => normalizeFinanceDraft(financeDraft, paidAmount),
    [financeDraft, paidAmount],
  );
  const financialState = deriveOrderFinancialState(
    isEditing
      ? {
          ...order,
          quotation_amount: normalizedDraft.quotation,
          deposit_amount: normalizedDraft.deposit,
          balance_amount: normalizedDraft.balance,
        }
      : order,
  );
  const display = isEditing
    ? {
        quotation: normalizedDraft.quotation,
        deposit: normalizedDraft.deposit,
        balance: normalizedDraft.balance,
      }
    : {
        quotation: order.quotation_amount,
        deposit: order.deposit_amount,
        balance: order.balance_amount,
      };
  const flowActionLabel = approvalDecisionAvailable
    ? t("orders2b2.overview.approvalAction")
    : t("orders2b2.overview.flowAction");
  const notifyPrimary = primaryAction === "notify";
  const flowPrimary = primaryAction === "flow" || primaryAction === "approval";
  const paymentPrimary = primaryAction === "payment";
  const pageDockStyle: React.CSSProperties | undefined =
    surface === "page"
      ? {
          left: isMobile
            ? 0
            : sidebarState === "collapsed"
              ? "var(--sidebar-width-icon)"
              : "var(--sidebar-width)",
        }
      : undefined;

  return (
    <div
      data-order-action-dock="true"
      style={pageDockStyle}
      className={cn(
        surface === "dialog"
          ? "sticky bottom-0 z-20 mt-2 min-w-0"
          : "fixed bottom-0 right-0 z-30 px-2 pb-[calc(env(safe-area-inset-bottom)+8px)] sm:px-4",
      )}
    >
      <div
        className={cn(
          "min-w-0 rounded-[var(--radius-lg)] border border-[var(--border-panel)] bg-[var(--surface-workspace-strong)]/95 p-1.5 shadow-[var(--shadow-overlay)] backdrop-blur-xl",
          surface === "dialog"
            ? "ml-auto w-fit max-w-full"
            : "ml-auto w-fit max-w-[calc(100vw-16px)]",
        )}
      >
        <div className="flex min-w-0 flex-wrap items-center justify-end gap-1.5">
          <div
            data-order-action-settlement="true"
            className="flex min-h-9 min-w-[180px] max-w-[260px] items-center justify-between gap-2 rounded-md border border-[var(--border-panel)] bg-[var(--surface-panel-muted)]/45 px-2 text-[10px] text-muted-foreground lg:text-xs lg:leading-4"
          >
            {financeRedacted ? (
              <span className="truncate font-medium">
                {t("orders2b2.overview.financeRestricted")}
              </span>
            ) : (
              <>
                <span className="inline-flex min-w-0 items-center gap-1 font-medium">
                  {cancelled ? (
                    t("orders2b2.overview.cancelled")
                  ) : financialState.settlement === "settled" ||
                    financialState.settlement === "zero_charge" ? (
                    <>
                      <CheckCircle2 className="size-3 text-status-success-foreground" />
                      {t("orders2b2.overview.settled")}
                    </>
                  ) : (
                    localizeOrderDetailFinancialState(financialState, t)
                  )}
                </span>
                <span className="truncate">
                  {isEditing
                    ? t("orders2b2.overview.quoteDraft")
                    : t("orders2b2.overview.itemsApproval", {
                        count: order.fault_prices.length,
                        approval: localizeOrderDetailApproval(order.approval_status, t),
                      })}
                </span>
              </>
            )}
          </div>
          <div className="grid min-w-[270px] grid-cols-3 gap-1.5">
            <Button
              type="button"
              size="sm"
              variant={notifyPrimary ? "default" : "outline"}
              data-primary-action={notifyPrimary ? "true" : undefined}
              className={cn(
                "h-11 min-w-11 gap-1.5 px-2 text-xs lg:h-9 lg:min-w-0",
                notifyPrimary && "border-0 text-primary-foreground",
              )}
              style={notifyPrimary ? { background: "var(--gradient-brand)" } : undefined}
              disabled={isEditing || notifyDisabled}
              onClick={onNotify}
            >
              <Send className="size-3.5" />
              WhatsApp
            </Button>
            <Button
              type="button"
              size="sm"
              variant={flowPrimary ? "default" : "outline"}
              data-primary-action={flowPrimary ? "true" : undefined}
              className={cn(
                "h-11 min-w-11 gap-1.5 px-2 text-xs lg:h-9 lg:min-w-0",
                flowPrimary && "border-0 text-primary-foreground",
              )}
              style={flowPrimary ? { background: "var(--gradient-brand)" } : undefined}
              disabled={isEditing || (!approvalDecisionAvailable && flowDisabled)}
              onClick={approvalDecisionAvailable ? onApprovalDecision : onFlow}
            >
              <Clock3 className="size-3.5" />
              {flowActionLabel}
            </Button>
            <Button
              type="button"
              size="sm"
              variant={paymentPrimary ? "default" : "outline"}
              data-primary-action={paymentPrimary ? "true" : undefined}
              className={cn(
                "h-11 min-w-11 gap-1.5 px-2 text-xs lg:h-9 lg:min-w-0",
                paymentPrimary && "border-0 text-primary-foreground",
              )}
              style={paymentPrimary ? { background: "var(--gradient-brand)" } : undefined}
              disabled={
                financeRedacted ||
                isEditing ||
                paymentDisabled ||
                cancelled ||
                !financialState.collectible
              }
              onClick={onPay}
            >
              <CreditCard className="size-3.5" />
              {cancelled ? t("orders2b2.overview.cannotCollect") : t("orders2b2.overview.collect")}
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}

export function OrderDetailHeaderFinanceSummary({
  order,
  isEditing,
  financeDraft,
}: {
  order: OrderDetail["order"];
  isEditing: boolean;
  financeDraft: FinanceDraftState;
}) {
  const { t } = useLocale();
  const cancelled = isOrderCancelledForPayment(order);
  const paidAmount = inferOrderPaidAmount(order);
  const normalizedDraft = useMemo(
    () => normalizeFinanceDraft(financeDraft, paidAmount),
    [financeDraft, paidAmount],
  );
  const display = isEditing
    ? {
        quotation: normalizedDraft.quotation,
        deposit: normalizedDraft.deposit,
        balance: normalizedDraft.balance,
      }
    : {
        quotation: order.quotation_amount,
        deposit: order.deposit_amount,
        balance: order.balance_amount,
      };

  return (
    <section
      data-order-header-finance="true"
      aria-label={t("orders2b2.overview.amountSummary")}
      className="min-w-0 rounded-md border border-[var(--border-panel)] bg-[var(--surface-panel-muted)]/45 p-1"
    >
      {order.finance_redacted ? (
        <div className="grid h-9 place-items-center rounded-md bg-card px-2 text-[10px] font-medium text-muted-foreground lg:text-xs lg:leading-4">
          {t("orders2b2.overview.financeRestricted")}
        </div>
      ) : (
        <OrderWorkspaceMoneyStrip
          total={display.quotation}
          deposit={display.deposit}
          balance={display.balance}
          compact
          cancelled={cancelled}
          itemClassName="!px-1.5"
        />
      )}
    </section>
  );
}

export function OrderKeyInfoCard({
  order,
  supplier,
  className,
  surface = "page",
  custodyControl,
}: {
  order: OrderDetail["order"];
  supplier?: Supplier;
  className?: string;
  surface?: DetailSurface;
  custodyControl?: React.ReactNode;
}) {
  const { locale, t } = useLocale();
  return (
    <DetailPanel surface={surface} className={className} dataPanel="key-info">
      <h3 className="mb-2 text-sm font-semibold sm:mb-3">{t("orders2b2.overview.keyInfo")}</h3>
      <dl
        data-order-key-info-grid="true"
        className={cn(
          "grid min-w-0 gap-1 text-xs sm:gap-1.5",
          surface === "dialog" && "sm:grid-cols-2 sm:gap-x-2",
        )}
      >
        <Row
          label={t("orders2b2.overview.createdAt")}
          value={formatDateTime(order.created_at, locale)}
        />
        <Row
          label={t("orders2b2.overview.completedAt")}
          value={order.completed_at ? formatDateTime(order.completed_at, locale) : "—"}
        />
        <Row
          label={t("orders2b2.overview.deliveredAt")}
          value={order.delivered_at ? formatDateTime(order.delivered_at, locale) : "—"}
        />
        {custodyControl ? (
          <div className={cn("min-w-0", surface === "dialog" && "sm:col-span-2")}>
            {custodyControl}
          </div>
        ) : (
          <Row
            label={t("orders2b2.overview.custody")}
            value={
              <DeviceCustodyBadge
                status={order.device_custody_status}
                deliveredAt={order.delivered_at}
                label={localizeDeviceCustody(order.device_custody_status, order.delivered_at, t)}
                className="text-[10px] lg:text-xs lg:leading-4"
              />
            }
          />
        )}
        {supplier && (
          <Row
            label={t("orders2b2.overview.externalSupplier")}
            value={
              <span className="inline-flex min-w-0 items-center gap-1.5">
                <span
                  className="size-2 shrink-0 rounded-full"
                  style={{ background: supplier.color }}
                />
                <span className="truncate">{supplier.name}</span>
              </span>
            }
          />
        )}
        {order.cancel_reason && (
          <Row label={t("orders2b2.overview.cancelReason")} value={order.cancel_reason} />
        )}
      </dl>
    </DetailPanel>
  );
}

function DesktopRecordsSummaryPanel({
  events,
  messages,
  workflow,
  surface,
  onShowRecords,
}: {
  events: OrderDetail["events"];
  messages: OrderDetail["messages"];
  workflow?: OrderWorkflow;
  surface: DetailSurface;
  onShowRecords?: () => void;
}) {
  const { locale, t } = useLocale();
  const latestEvent = events[0];
  const latestMessage = messages[0];
  const latestEventLabel = latestEvent
    ? localizeOrderDetailEvent(latestEvent, workflow, t, locale)
    : t("orders2b2.overview.noTimeline");
  const latestEventMeta = latestEvent
    ? `${formatDateTime(latestEvent.created_at, locale)} · ${latestEvent.operator_name}`
    : t("orders2b2.overview.timelineHelp");
  const latestMessageText =
    latestMessage?.message_body?.trim() || t("orders2b2.overview.noNotifications");
  const latestMessageMeta = latestMessage
    ? `${latestMessage.channel === "whatsapp" ? "WhatsApp" : t("orders2b2.channel.sms")} · ${formatDateTime(
        latestMessage.sent_at,
        locale,
      )}`
    : t("orders2b2.overview.notificationHelp");

  return (
    <DetailPanel surface={surface} dataPanel="records-summary" className="h-full">
      <PanelHeader
        title={t("orders2b2.overview.recordsSummary")}
        action={
          onShowRecords ? (
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="h-11 min-w-11 px-3 text-xs lg:h-7 lg:min-w-0 lg:px-2 lg:text-[11px]"
              onClick={onShowRecords}
            >
              {t("orders2b2.overview.records")}
            </Button>
          ) : null
        }
      />
      <div className="grid min-w-0 gap-1.5">
        <CompactSummaryRow
          icon={History}
          label={t("orders2b2.overview.latestTimeline")}
          value={latestEventLabel}
          meta={latestEventMeta}
          count={events.length}
        />
        <CompactSummaryRow
          icon={MessageCircle}
          label={t("orders2b2.overview.notifications")}
          value={latestMessageText}
          meta={latestMessageMeta}
          count={messages.length}
        />
      </div>
    </DetailPanel>
  );
}

function CompactSummaryRow({
  icon: Icon,
  label,
  value,
  meta,
  count,
}: {
  icon: LucideIcon;
  label: string;
  value: string;
  meta: string;
  count: number;
}) {
  return (
    <div className="grid min-w-0 grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-2 rounded-md border border-[var(--border-panel)] bg-[var(--surface-panel-muted)]/65 px-2 py-1.5">
      <span className="grid size-7 shrink-0 place-items-center rounded-md bg-primary/10 text-primary">
        <Icon className="size-3.5" />
      </span>
      <span className="min-w-0">
        <span className="block truncate text-[10px] font-medium text-muted-foreground lg:text-xs lg:leading-4">
          {label}
        </span>
        <span className="block truncate text-xs font-semibold" title={value}>
          {value}
        </span>
        <span className="block truncate text-[10px] leading-3 text-muted-foreground/80 lg:text-[11px] lg:leading-4 lg:text-muted-foreground">
          {meta}
        </span>
      </span>
      <span className="shrink-0 rounded-md bg-card px-1.5 py-0.5 font-mono text-[10px] tabular-nums text-muted-foreground lg:text-[11px] lg:leading-4">
        {count}
      </span>
    </div>
  );
}

function OrderOverviewFinancePanel({
  order,
  isEditing,
  financeDraft,
  financeError,
  onFinanceDraftChange,
  canAdjustFinance,
  surface,
}: {
  order: OrderDetail["order"];
  isEditing: boolean;
  financeDraft?: FinanceDraftState;
  financeError?: string;
  onFinanceDraftChange?: (draft: FinanceDraftState) => void;
  canAdjustFinance: boolean;
  surface: DetailSurface;
}) {
  const { t } = useLocale();
  const dense = surface === "dialog";
  const cancelled = isOrderCancelledForPayment(order);
  const financeRedacted = Boolean(order.finance_redacted);
  const paidAmount = inferOrderPaidAmount(order);
  const normalizedDraft = useMemo(
    () => (financeDraft ? normalizeFinanceDraft(financeDraft, paidAmount) : null),
    [financeDraft, paidAmount],
  );
  const canEditFinance = Boolean(
    !financeRedacted && isEditing && canAdjustFinance && financeDraft && onFinanceDraftChange,
  );
  const approvalTouched = isQuoteApprovalTouched(order);
  const display =
    canEditFinance && normalizedDraft
      ? {
          quotation: normalizedDraft.quotation,
          deposit: normalizedDraft.deposit,
          balance: normalizedDraft.balance,
        }
      : {
          quotation: order.quotation_amount,
          deposit: order.deposit_amount,
          balance: order.balance_amount,
        };
  const financialState = deriveOrderFinancialState({
    ...order,
    quotation_amount: display.quotation,
    deposit_amount: display.deposit,
    balance_amount: display.balance,
  });

  if (order.finance_redacted) {
    return (
      <DetailPanel surface={surface} dataPanel="finance">
        <PanelHeader title={t("orders2b2.overview.quotePanel")} />
        <div className="rounded-lg border border-dashed border-[var(--border-panel)] bg-[var(--surface-panel-muted)] px-3 py-5 text-center text-xs font-medium text-muted-foreground">
          {t("orders2b2.overview.financeRestricted")}
        </div>
      </DetailPanel>
    );
  }

  return (
    <DetailPanel surface={surface} dataPanel="finance">
      <PanelHeader title={t("orders2b2.overview.quotePanel")} editing={canEditFinance} />
      <div className={cn("min-w-0", dense ? "space-y-1.5" : "space-y-2 sm:space-y-3")}>
        {financeRedacted ? (
          <div className="grid min-h-16 place-items-center rounded-lg border border-[var(--border-panel)] bg-[var(--surface-panel-muted)] px-3 text-xs font-medium text-muted-foreground">
            {t("orders2b2.overview.amountRestricted")}
          </div>
        ) : dense ? null : (
          <OrderWorkspaceMoneyStrip
            total={display.quotation}
            deposit={display.deposit}
            balance={display.balance}
            cancelled={cancelled}
          />
        )}

        <div className="flex min-w-0 flex-wrap items-center gap-1.5">
          <span className="inline-flex min-w-0 items-center gap-1 text-[10px] font-medium text-muted-foreground">
            <span className="shrink-0">{t("orders2b2.overview.customer")}</span>
            <StatusBadge
              status={order.status}
              label={localizeOrderDetailApproval(order.approval_status, t)}
              tone={
                order.approval_status === "approved"
                  ? "success"
                  : order.approval_status === "rejected"
                    ? "danger"
                    : "warn"
              }
            />
          </span>
          <span
            className={cn(
              "rounded-md border px-1.5 py-0.5 text-[10px] font-medium lg:text-[11px] lg:leading-4",
              financialState.settlement === "cancelled"
                ? "border-[var(--border-panel)] bg-muted text-muted-foreground"
                : financialState.settlement === "refunded" || financialState.settlement === "review"
                  ? "border-[var(--border-panel)] bg-muted text-muted-foreground"
                  : financialState.settlement === "settled" ||
                      financialState.settlement === "zero_charge"
                    ? "border-status-success-foreground/25 bg-status-success text-status-success-foreground"
                    : "border-status-warn-foreground/25 bg-status-warn text-status-warn-foreground",
            )}
          >
            {t("orders2b2.overview.settlement", {
              status: financeRedacted
                ? t("orders2b2.overview.financialRestricted")
                : financialState.settlement === "cancelled"
                  ? t("orders2b2.overview.cancelledBalance")
                  : localizeOrderDetailFinancialState(financialState, t),
            })}
          </span>
        </div>

        {financeRedacted ? null : canEditFinance &&
          financeDraft &&
          onFinanceDraftChange &&
          normalizedDraft ? (
          <>
            <FinanceInlineEditor
              draft={financeDraft}
              normalized={normalizedDraft}
              error={financeError}
              onChange={onFinanceDraftChange}
              dense={dense}
            />
            {approvalTouched ? (
              <p className="rounded-md bg-status-warn px-2 py-1 text-[10px] leading-3 text-status-warn-foreground lg:text-xs lg:leading-[18px]">
                {t("orders2b2.overview.quoteEditWarning")}
              </p>
            ) : null}
          </>
        ) : (
          <FinanceDisplay order={order} />
        )}
      </div>
    </DetailPanel>
  );
}

export function DesktopOrderPhotosPanel({
  attachments,
  uploadPending,
  onCapture,
  surface,
  className,
}: {
  attachments: OrderAttachment[];
  uploadPending: boolean;
  onCapture?: (kind: OrderDetailPhotoCaptureKind, trigger: HTMLButtonElement) => void;
  surface: DetailSurface;
  className?: string;
}) {
  const { t } = useLocale();
  const [photoPreviewId, setPhotoPreviewId] = useState<string | null>(null);

  useEffect(() => {
    if (!photoPreviewId) return;
    if (!attachments.some((attachment) => attachment.id === photoPreviewId)) {
      setPhotoPreviewId(null);
    }
  }, [attachments, photoPreviewId]);

  return (
    <DetailPanel surface={surface} dataPanel="photos" className={className}>
      <PanelHeader title={t("orders2b2.overview.photos")} />
      <OrderDetailPhotoSlots
        attachments={attachments}
        canUpload={Boolean(onCapture)}
        uploadPending={uploadPending}
        onCapture={onCapture}
        onOpenAttachment={(attachment) => setPhotoPreviewId(attachment.id)}
      />
      <OrderPhotoPreviewDialog
        attachments={attachments}
        activeId={photoPreviewId}
        onActiveIdChange={setPhotoPreviewId}
      />
    </DetailPanel>
  );
}

function DetailPanel({
  surface,
  dataPanel,
  className,
  children,
}: {
  surface: DetailSurface;
  dataPanel?: string;
  className?: string;
  children: React.ReactNode;
}) {
  if (surface === "dialog") {
    return (
      <DetailDensityContext.Provider value>
        <section className={cn(detailWorkspace.densePanel, className)} data-order-panel={dataPanel}>
          {children}
        </section>
      </DetailDensityContext.Provider>
    );
  }

  return (
    <DetailDensityContext.Provider value={false}>
      <Card className={cn(overviewPanelClass, className)} data-order-panel={dataPanel}>
        {children}
      </Card>
    </DetailDensityContext.Provider>
  );
}

function CustomerPanel({
  order,
  customer,
  edit,
  surface,
  onRequestKioskSignature,
  kioskSignaturePending,
  kioskSignatureAvailable,
  signatureAttachments,
}: {
  order: OrderDetail["order"];
  customer?: Customer;
  edit: OrderEditContext | null;
  surface: DetailSurface;
  onRequestKioskSignature?: () => void;
  kioskSignaturePending: boolean;
  kioskSignatureAvailable: boolean;
  signatureAttachments: OrderAttachment[];
}) {
  const { t } = useLocale();
  const dense = surface === "dialog";
  return (
    <DetailPanel surface={surface} dataPanel="customer">
      <PanelHeader title={t("orders2b2.overview.customerInfo")} editing={Boolean(edit)} />
      <div className={cn("min-w-0", dense ? "space-y-1.5" : "space-y-2 sm:space-y-3")}>
        <section className="grid min-w-0 gap-1.5">
          <CustomerNameField order={order} customer={customer} edit={edit} />
          {surface !== "dialog" ? (
            <InfoField label={t("orders2b2.overview.technician")} tone="soft">
              <ReadonlyValue value={order.technician_name} />
            </InfoField>
          ) : null}
        </section>

        <CustomerPhoneField order={order} customer={customer} edit={edit} />
        <BackupPhones order={order} edit={edit} />

        <Separator className={dense ? "my-1" : "my-2 sm:my-3"} />
        <CustomerSignatureSection
          order={order}
          onRequestKioskSignature={onRequestKioskSignature}
          kioskSignaturePending={kioskSignaturePending}
          kioskSignatureAvailable={kioskSignatureAvailable}
          signatureAttachments={signatureAttachments}
        />
      </div>
    </DetailPanel>
  );
}

function CustomerNameField({
  order,
  customer,
  edit,
}: {
  order: OrderDetail["order"];
  customer?: Customer;
  edit: OrderEditContext | null;
}) {
  const { t } = useLocale();
  return (
    <DraftTextField
      label={t("orders2b2.overview.customer")}
      value={edit?.draft.customer_name ?? order.customer_name ?? customer?.name ?? ""}
      required
      tone="hero"
      edit={edit}
      onChange={(value) => patchDraft(edit, { customer_name: value })}
    />
  );
}

function CustomerPhoneField({
  order,
  customer,
  edit,
}: {
  order: OrderDetail["order"];
  customer?: Customer;
  edit: OrderEditContext | null;
}) {
  const { t } = useLocale();
  const value = getDraftPrimaryPhone(
    edit?.draft.customer_phone ?? order.customer_phone ?? customer?.phone_e164 ?? "",
  );
  if (edit) {
    return (
      <InfoField label={`${t("orders2b2.overview.primaryPhone")} *`} tone="soft">
        <CustomerPhoneLookup
          value={value}
          selectedCustomerId={customer?.id}
          autoPickExact={false}
          placeholder={t("orders2b2.overview.searchPhone")}
          className={cn(inlineEditInputClass, "!h-[38px] font-mono !text-base lg:!h-9 lg:!text-sm")}
          showSearchIcon={false}
          onChange={(customer_phone) =>
            patchDraft(edit, {
              customer_phone: joinDraftPhones(
                customer_phone,
                getDraftBackupPhones(edit.draft.customer_phone),
              ),
            })
          }
          onPick={(pickedCustomer) =>
            patchDraft(edit, {
              customer_name: pickedCustomer.name,
              customer_phone: joinDraftPhones(
                pickedCustomer.phone_e164,
                pickedCustomer.contact_phones,
              ),
            })
          }
        />
        <p className="mt-1 text-[10px] leading-3 text-muted-foreground lg:text-[11px] lg:leading-4">
          {t("orders2b2.overview.customerPickHelp")}
        </p>
      </InfoField>
    );
  }
  return (
    <InfoField label={t("orders2b2.overview.primaryPhone")} tone="soft">
      <PhoneContactMenu phone={order.customer_phone ?? customer?.phone_e164 ?? ""} />
    </InfoField>
  );
}

function BackupPhones({
  order,
  edit,
}: {
  order: OrderDetail["order"];
  edit: OrderEditContext | null;
}) {
  const { t } = useLocale();
  const draftCustomerPhone = edit?.draft.customer_phone ?? "";
  const primaryPhone = getDraftPrimaryPhone(draftCustomerPhone);
  const parsedBackupPhones = getDraftBackupPhones(draftCustomerPhone);
  const [backupPhoneDrafts, setBackupPhoneDrafts] = useState(parsedBackupPhones);

  useEffect(() => {
    const nextBackupPhones = getDraftBackupPhones(draftCustomerPhone);
    setBackupPhoneDrafts((current) => {
      const currentFilled = current
        .map((phone) => phone.trim())
        .filter(Boolean)
        .join("\n");
      const parsedFilled = nextBackupPhones.join("\n");
      const preservingBlankRow = current.some((phone) => !phone.trim());
      if (preservingBlankRow && currentFilled === parsedFilled) return current;
      return nextBackupPhones;
    });
  }, [draftCustomerPhone]);

  if (edit) {
    const patchBackupPhones = (phones: string[]) => {
      setBackupPhoneDrafts(phones);
      patchDraft(edit, {
        customer_phone: joinDraftPhones(primaryPhone, phones),
      });
    };

    return (
      <InfoField label={t("orders2b2.overview.backupPhones")} tone="soft">
        <CustomerBackupPhonesField
          primaryPhone={primaryPhone}
          phones={backupPhoneDrafts}
          compact
          onPrimaryPhoneChange={(customer_phone) =>
            patchDraft(edit, {
              customer_phone: joinDraftPhones(customer_phone, backupPhoneDrafts),
            })
          }
          onPhonesChange={patchBackupPhones}
          onPromotePhone={(customer_phone, phones) => {
            setBackupPhoneDrafts(phones);
            patchDraft(edit, {
              customer_phone: joinDraftPhones(customer_phone, phones),
            });
          }}
        />
      </InfoField>
    );
  }
  if (!order.contact_phones.length) return null;
  const backupPhones = uniqueContactPhones(order.customer_phone, order.contact_phones);
  if (!backupPhones.length) return null;
  return (
    <InfoField label={t("orders2b2.overview.backupPhones")}>
      <div className="flex min-w-0 flex-wrap gap-1">
        {backupPhones.map((phone) => (
          <PhoneContactMenu
            key={phone}
            phone={phone}
            className="max-w-full truncate rounded-md border border-border/70 bg-surface-muted/70 px-1.5 py-0.5 text-[11px] lg:text-xs lg:leading-4"
            compact
          />
        ))}
      </div>
    </InfoField>
  );
}

function CustomerSignatureSection({
  order,
  onRequestKioskSignature,
  kioskSignaturePending = false,
  kioskSignatureAvailable = false,
  signatureAttachments = [],
}: {
  order: OrderDetail["order"];
  onRequestKioskSignature?: () => void;
  kioskSignaturePending?: boolean;
  kioskSignatureAvailable?: boolean;
  signatureAttachments?: OrderAttachment[];
}) {
  const { t } = useLocale();
  const dense = useDenseDetail();
  const hasKioskAction = Boolean(onRequestKioskSignature);
  const latestSignature = signatureAttachments[0];
  const hasSignatureEvidence = Boolean(order.customer_signature || latestSignature);
  const ActionIcon = hasKioskAction ? TabletSmartphone : Signature;
  const actionLabel = hasKioskAction
    ? kioskSignaturePending
      ? t("orders2b2.overview.sending")
      : kioskSignatureAvailable
        ? hasSignatureEvidence
          ? t("orders2b2.overview.resend")
          : t("orders2b2.overview.sendKiosk")
        : t("orders2b2.overview.noKiosk")
    : hasSignatureEvidence
      ? t("orders2b2.overview.signAgain")
      : t("orders2b2.overview.requestSignature");
  const statusLabel = latestSignature
    ? t("orders2b2.overview.signatureSaved")
    : order.customer_signature
      ? t("orders2b2.overview.signatureCaptured")
      : t("orders2b2.overview.signatureMissing");
  return (
    <section className="min-w-0">
      <div
        className={cn(
          "flex min-w-0 items-center justify-between gap-2",
          dense ? "mb-1" : "mb-1.5 sm:mb-2",
        )}
      >
        <h4
          className={cn(
            "font-semibold text-muted-foreground",
            dense ? "text-[11px]" : "text-[11px] sm:text-xs",
            "lg:text-xs lg:leading-4",
          )}
        >
          {t("orders2b2.overview.signature")}
        </h4>
        {hasKioskAction ? (
          <Button
            type="button"
            variant="outline"
            size="sm"
            disabled={!kioskSignatureAvailable || kioskSignaturePending}
            onClick={onRequestKioskSignature}
            className={cn(
              "gap-1 px-1.5 text-[11px] lg:text-xs",
              dense
                ? "h-11 min-w-11 px-3 text-xs lg:h-6 lg:min-w-0 lg:px-1.5 lg:text-[11px]"
                : "h-6 sm:h-7 sm:px-2 sm:text-xs",
            )}
          >
            <ActionIcon className="size-3" />
            {actionLabel}
          </Button>
        ) : null}
      </div>
      <div
        className={cn(
          "flex items-center justify-center rounded-md border border-dashed border-border/80 bg-surface-muted/20 text-xs text-muted-foreground",
          dense ? "h-10" : "h-16 sm:h-24 sm:rounded-lg",
          hasSignatureEvidence && "border-primary/20 bg-accent/30 text-accent-foreground",
        )}
      >
        <div className="grid min-w-0 place-items-center gap-1 px-2 text-center">
          <span>{statusLabel}</span>
          {latestSignature?.signed_url ? (
            <a
              href={latestSignature.signed_url}
              target="_blank"
              rel="noreferrer"
              className="inline-flex max-w-full items-center gap-1 truncate text-[11px] font-medium text-primary underline-offset-2 hover:underline lg:text-xs lg:leading-4"
            >
              <ImageIcon className="size-3 shrink-0" />
              {t("orders2b2.overview.viewSignature")}
            </a>
          ) : null}
        </div>
      </div>
    </section>
  );
}

function DeviceIssuePanel({
  order,
  deviceBrand,
  deviceModel,
  deviceImei,
  deviceNotes,
  accessoryNotes,
  defaultWarrantyMonths,
  onQuickImeiSave,
  quickImeiPending,
  intakeEdit,
  repairEdit,
  surface,
}: {
  order: OrderDetail["order"];
  deviceBrand: string;
  deviceModel: string;
  deviceImei: string;
  deviceNotes?: string;
  accessoryNotes?: string;
  defaultWarrantyMonths: number;
  onQuickImeiSave?: (imei: string) => void | Promise<void>;
  quickImeiPending: boolean;
  intakeEdit: OrderEditContext | null;
  repairEdit: OrderEditContext | null;
  surface: DetailSurface;
}) {
  const { t } = useLocale();
  const dense = surface === "dialog";
  return (
    <DetailPanel surface={surface} dataPanel="device">
      <PanelHeader
        title={t("orders2b2.overview.deviceIssue")}
        editing={Boolean(intakeEdit || repairEdit)}
      />
      <div className={cn("min-w-0", dense ? "space-y-1.5" : "space-y-2 sm:space-y-3")}>
        <section
          className={cn(
            "grid min-w-0 grid-cols-2 md:grid-cols-1 lg:grid-cols-2",
            dense ? "gap-1.5" : "gap-2 sm:gap-3",
          )}
        >
          <DraftTextField
            label={t("orders2b2.overview.brand")}
            value={intakeEdit?.draft.device_brand ?? deviceBrand}
            required
            tone="hero"
            edit={intakeEdit}
            onChange={(value) => patchDraft(intakeEdit, { device_brand: value })}
          />
          <DraftTextField
            label={t("orders2b2.overview.model")}
            value={intakeEdit?.draft.device_model ?? deviceModel}
            required
            tone="hero"
            edit={intakeEdit}
            onChange={(value) => patchDraft(intakeEdit, { device_model: value })}
          />
        </section>

        <ImeiField
          value={intakeEdit?.draft.device_imei ?? deviceImei}
          edit={intakeEdit}
          onQuickSave={onQuickImeiSave}
          quickPending={quickImeiPending}
        />

        <section
          className={cn(
            "grid min-w-0 grid-cols-2 md:grid-cols-1 lg:grid-cols-2",
            dense ? "gap-1.5" : "gap-2 sm:gap-3",
          )}
        >
          <DraftTextField
            label={t("orders2b2.overview.deviceNotes")}
            value={repairEdit?.draft.device_notes ?? deviceNotes ?? ""}
            tone="note"
            className={dense ? "line-clamp-2" : undefined}
            emptyText="—"
            edit={repairEdit}
            onChange={(value) => patchDraft(repairEdit, { device_notes: value })}
          />
          <AccessoryNotesField
            value={intakeEdit?.draft.accessory_notes ?? accessoryNotes ?? ""}
            edit={intakeEdit}
            onChange={(value) => patchDraft(intakeEdit, { accessory_notes: value })}
          />
        </section>
        <DeviceUnlockDetailField order={order} edit={repairEdit} dense={dense} />

        <Separator className={dense ? "my-1" : "my-2 sm:my-3"} />

        <section
          className={cn(
            "grid min-w-0",
            dense ? "gap-1.5 lg:grid-cols-2" : "gap-2 sm:gap-3 xl:grid-cols-2",
          )}
        >
          <DraftTextField
            label={t("orders2b2.overview.issue")}
            value={intakeEdit?.draft.issue_description ?? order.issue_description}
            required
            multiline
            tone="note"
            className={dense ? "line-clamp-2" : undefined}
            edit={intakeEdit}
            onChange={(value) => patchDraft(intakeEdit, { issue_description: value })}
          />
          <DraftTextField
            label={t("orders2b2.overview.diagnosis")}
            value={repairEdit?.draft.diagnosis_result ?? order.diagnosis_result ?? ""}
            multiline
            tone="soft"
            className={dense ? "line-clamp-2" : undefined}
            emptyText="—"
            edit={repairEdit}
            onChange={(value) => patchDraft(repairEdit, { diagnosis_result: value })}
          />
          <div className={cn(dense ? "lg:col-span-2" : "xl:col-span-2")}>
            <WarrantyField
              order={order}
              edit={repairEdit}
              defaultWarrantyMonths={defaultWarrantyMonths}
            />
          </div>
        </section>
      </div>
    </DetailPanel>
  );
}

function AccessoryNotesField({
  value,
  edit,
  onChange,
}: {
  value: string;
  edit: OrderEditContext | null;
  onChange: (value: string) => void;
}) {
  const { t } = useLocale();
  return (
    <InfoField label={t("orders2b2.overview.accessories")} tone="note">
      {edit ? (
        <AccessoryNotesPicker value={value} onChange={onChange} compact />
      ) : (
        <AccessoryNotesPills value={value} />
      )}
    </InfoField>
  );
}

function DeviceUnlockDetailField({
  order,
  edit,
  dense,
}: {
  order: OrderDetail["order"];
  edit: OrderEditContext | null;
  dense: boolean;
}) {
  const { t } = useLocale();
  const custodyStatus = deviceCustodyStatusFromOrder(order);
  return (
    <InfoField label={t("orders2b2.overview.unlock")} tone="note">
      {edit ? (
        <div className="min-w-0 space-y-1">
          <DeviceUnlockEditor
            value={edit.draft.device_unlock}
            onChange={(device_unlock) => patchDraft(edit, { device_unlock })}
            compact
          />
          <p className="break-words text-[10px] leading-4 text-muted-foreground lg:text-xs lg:leading-[18px]">
            {t("orders2b2.overview.unlockDraftHelp")}
          </p>
        </div>
      ) : (
        <div className="min-w-0 space-y-1">
          {custodyStatus !== DEVICE_CUSTODY_WITH_SHOP ? (
            <DeviceCustodyBadge
              status={custodyStatus}
              deliveredAt={order.delivered_at}
              label={localizeDeviceCustody(custodyStatus, order.delivered_at, t)}
              className="text-[10px] lg:text-[11px] lg:leading-4"
            />
          ) : null}
          <DeviceUnlockViewer order={order} compact={dense} />
        </div>
      )}
    </InfoField>
  );
}

function WarrantyField({
  order,
  edit,
  defaultWarrantyMonths,
}: {
  order: OrderDetail["order"];
  edit: OrderEditContext | null;
  defaultWarrantyMonths: number;
}) {
  const { t } = useLocale();
  const valueMonths = edit?.draft.warranty_months ?? order.warranty_months;
  const valueText = edit?.draft.warranty_text ?? order.warranty_text;
  const reason = edit?.draft.warranty_change_reason ?? order.warranty_change_reason;

  return (
    <InfoField label={t("orders2b2.overview.warranty")} tone="soft">
      {edit ? (
        <WarrantyPicker
          valueMonths={valueMonths}
          valueText={valueText}
          reason={reason}
          defaultMonths={defaultWarrantyMonths}
          compact
          appearance="quiet"
          onChange={(warranty) =>
            patchDraft(edit, {
              warranty_months: warranty.warranty_months,
              warranty_text: warranty.warranty_text,
              warranty_change_reason: warranty.warranty_change_reason,
            })
          }
        />
      ) : (
        <div className="min-w-0 space-y-1">
          <WarrantyTag months={valueMonths} text={valueText} />
          {order.warranty_change_reason && (
            <div className="break-words text-[11px] text-muted-foreground lg:text-xs lg:leading-4">
              {t("orders2b2.overview.reason", { reason: order.warranty_change_reason })}
            </div>
          )}
        </div>
      )}
    </InfoField>
  );
}

function FinanceInlineEditor({
  draft,
  normalized,
  error,
  onChange,
  dense,
}: {
  draft: FinanceDraftState;
  normalized: ReturnType<typeof normalizeFinanceDraft>;
  error?: string;
  onChange: (draft: FinanceDraftState) => void;
  dense: boolean;
}) {
  const { t } = useLocale();
  const patchFault = (index: number, patch: Partial<FinanceDraftState["faults"][number]>) => {
    const faults = [...draft.faults];
    faults[index] = { ...faults[index], ...patch };
    onChange({ ...draft, faults });
  };
  const message = normalized.error ?? error;

  return (
    <section className={cn("min-w-0", dense ? "space-y-1" : "space-y-1.5")}>
      <h4 className="text-[11px] font-semibold text-muted-foreground sm:text-xs lg:text-xs lg:leading-4">
        {t("orders2b2.overview.quoteItems")}
      </h4>
      {draft.faults.length ? (
        <div className={cn("min-w-0", dense ? "space-y-1" : "space-y-1.5")}>
          {draft.faults.map((item, index) => (
            <div
              key={index}
              className="grid min-w-0 grid-cols-[minmax(0,1fr)_86px_24px] items-start gap-x-1.5 gap-y-0.5 rounded-md border border-border/60 bg-surface-muted/35 px-2 py-1.5 sm:rounded-lg"
            >
              <Input
                aria-label={t("orders2b2.overview.itemName", { index: index + 1 })}
                value={item.name}
                placeholder={t("orders2b2.overview.itemPlaceholder")}
                className={cn(inlineFinanceInputClass, "min-w-0 text-xs font-medium")}
                onChange={(event) =>
                  patchFault(index, {
                    name: event.target.value,
                    catalog_key: undefined,
                  })
                }
              />
              <MoneyDraftField
                ariaLabel={t("orders2b2.overview.itemAmount", { index: index + 1 })}
                value={item.priceText}
                placeholder="0"
                onChange={(value) => patchFault(index, { priceText: value })}
              />
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="-mr-1 -mt-0.5 size-6 rounded-md text-muted-foreground hover:text-destructive"
                onClick={() =>
                  onChange({ ...draft, faults: draft.faults.filter((_, i) => i !== index) })
                }
                aria-label={t("orders2b2.overview.deleteItem")}
              >
                <Trash2 className="size-3 text-muted-foreground" />
              </Button>
              <Input
                aria-label={t("orders2b2.overview.itemNote", { index: index + 1 })}
                value={item.note}
                placeholder={t("orders2b2.overview.notePlaceholder")}
                className={cn(
                  inlineFinanceInputClass,
                  "col-span-2 min-w-0 text-[11px] text-muted-foreground lg:text-xs lg:leading-4",
                )}
                onChange={(event) => patchFault(index, { note: event.target.value })}
              />
            </div>
          ))}
        </div>
      ) : (
        <div className="rounded-md border border-dashed border-[var(--border-panel)] px-2 py-2 text-center text-[10px] text-muted-foreground lg:text-xs lg:leading-4">
          {t("orders2b2.overview.noQuoteItems")}
        </div>
      )}

      <div className="grid min-w-0 grid-cols-[minmax(0,1fr)_106px] items-end gap-1.5">
        <Button
          type="button"
          variant="outline"
          size="sm"
          className="h-7 rounded-md border-dashed px-2 text-[10px] lg:text-xs"
          onClick={() =>
            onChange({ ...draft, faults: [...draft.faults, emptyFinanceFaultDraft()] })
          }
        >
          <Plus className="mr-1 size-3" />
          {t("orders2b2.overview.addItem")}
        </Button>
        <label className="grid min-w-0 gap-0.5 text-[10px] leading-3 text-muted-foreground lg:text-xs lg:leading-4">
          <span>{t("orders2b2.overview.deposit")}</span>
          <MoneyDraftField
            ariaLabel={t("orders2b2.overview.deposit")}
            value={draft.depositText}
            placeholder="0"
            onChange={(value) => onChange({ ...draft, depositText: value })}
          />
        </label>
      </div>

      {message ? (
        <p className="rounded-md bg-status-danger px-2 py-1 text-[10px] leading-3 text-status-danger-foreground lg:text-xs lg:leading-[18px]">
          {message}
        </p>
      ) : (
        <div className="grid grid-cols-2 gap-1 text-[10px] lg:text-xs lg:leading-4">
          <div className="rounded-md bg-[var(--surface-panel-muted)] px-2 py-1">
            <span className="block text-muted-foreground">
              {t("orders2b2.overview.editedTotal")}
            </span>
            <MoneyText amount={normalized.quotation} className="font-semibold text-primary" />
          </div>
          <div className="rounded-md bg-[var(--surface-panel-muted)] px-2 py-1">
            <span className="block text-muted-foreground">
              {t("orders2b2.overview.editedBalance")}
            </span>
            <MoneyText amount={normalized.balance} className="font-semibold" />
          </div>
        </div>
      )}
    </section>
  );
}

function MoneyDraftField({
  ariaLabel,
  value,
  placeholder,
  onChange,
}: {
  ariaLabel: string;
  value: string;
  placeholder?: string;
  onChange: (value: string) => void;
}) {
  return (
    <MoneyKeypadInput
      ariaLabel={ariaLabel}
      value={value}
      onChange={onChange}
      placeholder={placeholder}
      triggerClassName={cn(
        "h-7 rounded-md border-0 bg-card/60 px-1.5 py-0.5 text-xs shadow-none",
        inlineFinanceInputClass,
      )}
      valueClassName="text-xs font-medium"
    />
  );
}

function FinanceDisplay({ order }: { order: OrderDetail["order"] }) {
  const { t } = useLocale();
  return (
    <section className="min-w-0">
      <h4 className="mb-1.5 text-[11px] font-semibold text-muted-foreground sm:mb-2 sm:text-xs lg:text-xs lg:leading-4">
        {t("orders2b2.overview.quoteItems")}
      </h4>
      {order.fault_prices.length === 0 ? (
        <OrderWorkspaceEmptyBlock className="text-xs">
          {t("orders2b2.overview.noQuoteItems")}
        </OrderWorkspaceEmptyBlock>
      ) : (
        <ul className="min-w-0 space-y-1">
          {order.fault_prices.map((item, index) => (
            <OrderWorkspaceQuoteDisplayRow
              key={`${item.name}-${index}`}
              name={item.name}
              note={item.note}
              amount={item.price}
              className="bg-surface-muted/35"
            />
          ))}
        </ul>
      )}
    </section>
  );
}

function DraftTextField({
  label,
  value,
  edit,
  onChange,
  required,
  multiline,
  inputMode,
  emptyText = "—",
  tone = "plain",
  className,
  renderDisplay,
}: {
  label: string;
  value: string;
  edit: OrderEditContext | null;
  onChange: (value: string) => void;
  required?: boolean;
  multiline?: boolean;
  inputMode?: React.HTMLAttributes<HTMLInputElement>["inputMode"];
  emptyText?: string;
  tone?: InfoTone;
  className?: string;
  renderDisplay?: (value: string) => React.ReactNode;
}) {
  const dense = useDenseDetail();
  const displayNode = value.trim() ? renderDisplay?.(value) : null;

  if (!edit) {
    return (
      <InfoField label={label} tone={tone}>
        {displayNode ?? <ReadonlyValue value={value} emptyText={emptyText} className={className} />}
      </InfoField>
    );
  }

  return (
    <InfoField label={`${label}${required ? " *" : ""}`} tone={tone}>
      {multiline ? (
        <Textarea
          aria-label={label}
          value={value}
          rows={dense ? 2 : 3}
          className={cn(
            inlineEditTextareaClass,
            "resize-none overflow-y-auto text-[13px] leading-snug sm:text-sm",
            dense ? "!min-h-12" : "!min-h-16",
            className,
          )}
          onChange={(event) => onChange(event.target.value)}
        />
      ) : (
        <Input
          aria-label={label}
          value={value}
          inputMode={inputMode}
          className={cn(
            inlineEditInputClass,
            "text-[13px] sm:text-sm",
            tone === "hero" && "font-semibold",
            className,
          )}
          onChange={(event) => onChange(event.target.value)}
        />
      )}
    </InfoField>
  );
}

export function ImeiField({
  value,
  edit,
  onQuickSave,
  quickPending,
}: {
  value: string;
  edit: OrderEditContext | null;
  onQuickSave?: (imei: string) => void | Promise<void>;
  quickPending: boolean;
}) {
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState(value);

  if (edit) {
    return (
      <InfoField label="IMEI / 序列号" tone="soft">
        <ImeiScannerField
          value={value}
          onChange={(device_imei) => patchDraft(edit, { device_imei })}
          placeholder="扫描或输入 IMEI / 序列号"
          density="compact"
          appearance="quiet"
        />
      </InfoField>
    );
  }

  return (
    <InfoField label="IMEI / 序列号" tone="soft">
      <div className="flex min-w-0 items-center gap-1.5">
        <ReadonlyValue value={value} className="min-w-0 flex-1 font-mono" />
        <Popover
          open={open}
          onOpenChange={(nextOpen) => {
            setOpen(nextOpen);
            if (nextOpen) setDraft(value);
          }}
        >
          <PopoverTrigger asChild>
            <Button
              type="button"
              variant="outline"
              size="icon"
              className="size-11 shrink-0 lg:size-7"
              aria-label="扫码录入 IMEI / 序列号"
            >
              <Camera className="size-3.5" />
            </Button>
          </PopoverTrigger>
          <PopoverContent align="end" className="w-[min(22rem,calc(100vw-24px))]">
            <div className="mb-2 text-xs font-semibold">扫码录入 IMEI / 序列号</div>
            <ImeiScannerField
              value={draft}
              onChange={setDraft}
              placeholder="扫描或输入 IMEI / 序列号"
              density="compact"
            />
            <div className="mt-2 flex justify-end gap-2">
              <Button type="button" variant="ghost" size="sm" onClick={() => setOpen(false)}>
                取消
              </Button>
              <Button
                type="button"
                size="sm"
                disabled={quickPending || !onQuickSave || !draft.trim()}
                onClick={async () => {
                  try {
                    await onQuickSave?.(draft);
                    setOpen(false);
                  } catch {
                    // The mutation's existing onError renders the safe error. Consume its rejection.
                  }
                }}
              >
                {quickPending ? "保存中…" : "保存 IMEI"}
              </Button>
            </div>
          </PopoverContent>
        </Popover>
      </div>
    </InfoField>
  );
}

function patchDraft(edit: OrderEditContext | null, patch: Partial<UpdateOrderInput>) {
  if (!edit) return;
  edit.onDraftChange({ ...edit.draft, ...patch });
}

function getDraftPrimaryPhone(value: string) {
  return splitPhoneCandidates(value)[0] ?? value.trim();
}

function getDraftBackupPhones(value: string) {
  return splitPhoneCandidates(value).slice(1);
}

function joinDraftPhones(primary: string, backups: string | readonly string[]) {
  const primaryPhone = primary.trim();
  const backupPhones = typeof backups === "string" ? splitPhoneCandidates(backups) : [...backups];
  return [primaryPhone, ...uniqueContactPhones(primaryPhone, backupPhones)]
    .filter(Boolean)
    .join(" / ");
}

function isQuoteApprovalTouched(order: OrderDetail["order"]) {
  return Boolean(
    order.approval_status !== "pending" ||
    (order.approval_flow_status && order.approval_flow_status !== "not_required") ||
    order.approval_sent_at ||
    order.approval_confirmed_at,
  );
}

function OverviewMeta({
  icon: Icon,
  label,
  value,
  compact,
  color,
}: {
  icon: LucideIcon;
  label: string;
  value: string;
  compact?: boolean;
  color?: string;
}) {
  return (
    <div
      className={cn(
        "min-w-0 rounded-lg border border-[var(--border-panel)] bg-[var(--surface-panel-muted)] px-2.5",
        compact ? "py-1.5" : "py-2",
      )}
    >
      <div className="flex min-w-0 items-center gap-1.5 text-[11px] font-medium text-muted-foreground lg:text-xs lg:leading-4">
        {color ? (
          <span className="size-2 shrink-0 rounded-full" style={{ background: color }} />
        ) : (
          <Icon className="size-3.5 shrink-0 text-primary" />
        )}
        <span className="truncate">{label}</span>
      </div>
      <p
        className={cn("truncate font-semibold", compact ? "mt-0.5 text-xs" : "mt-1 text-sm")}
        title={value}
      >
        {value}
      </p>
    </div>
  );
}

function formatDateTime(value: string | undefined, locale: ReturnType<typeof useLocale>["locale"]) {
  if (!value) return "-";
  return formatOrderDateTime(value, locale);
}

function PanelHeader({
  title,
  editing,
  action,
  className,
}: {
  title: string;
  editing?: boolean;
  action?: React.ReactNode;
  className?: string;
}) {
  const { t } = useLocale();
  const dense = useDenseDetail();
  const trailing =
    action ??
    (editing ? (
      <span
        className={cn(
          "hidden rounded-full border border-[var(--border-panel)] bg-[var(--surface-panel-muted)] px-1.5 py-0.5 text-muted-foreground sm:inline",
          dense ? "text-[10px]" : "text-[11px]",
          "lg:text-xs lg:leading-4",
        )}
      >
        {t("orders2b2.overview.editing")}
      </span>
    ) : null);

  return (
    <div
      className={cn(
        "flex min-w-0 items-center justify-between gap-2",
        dense ? "mb-1.5" : "mb-2 sm:mb-3",
        className,
      )}
    >
      <h3
        className={cn(
          "inline-flex min-w-0 items-center gap-1.5 font-semibold",
          dense ? "text-xs" : "text-[13px] sm:gap-2 sm:text-sm",
        )}
      >
        <span className="size-1.5 shrink-0 rounded-full bg-primary/70" />
        <span className="truncate">{title}</span>
      </h3>
      {trailing}
    </div>
  );
}

function ReadonlyValue({
  value,
  emptyText = "—",
  className,
}: {
  value?: string | null;
  emptyText?: string;
  className?: string;
}) {
  const displayValue = value?.trim() ?? "";
  return (
    <span
      className={cn(
        "block min-h-5 min-w-0 break-words",
        !displayValue && "text-muted-foreground",
        className,
      )}
      title={displayValue || undefined}
    >
      {displayValue || emptyText}
    </span>
  );
}

function InfoField({
  label,
  children,
  tone = "plain",
}: {
  label: string;
  children: React.ReactNode;
  tone?: InfoTone;
}) {
  const dense = useDenseDetail();
  const fieldPadding = dense
    ? "px-0 py-0.5"
    : "rounded-md px-2 py-1.5 sm:rounded-lg sm:px-2.5 sm:py-2";
  return (
    <div
      className={cn(
        "min-w-0",
        dense && tone !== "plain" && "border-b border-[var(--border-panel)]/55 last:border-b-0",
        dense && tone === "metricStrong" && "rounded-md border-b-0 bg-primary/5 px-1.5 py-1",
        !dense && tone === "hero" && "border border-border/70 bg-surface-muted/30",
        !dense && tone === "soft" && "border border-border/60 bg-surface-muted/20",
        !dense && tone === "note" && "border border-border/70 bg-surface-muted/35",
        !dense && tone === "metric" && "border border-border/60 bg-surface-muted/25",
        !dense && tone === "metricStrong" && "border border-primary/20 bg-accent/25",
        tone !== "plain" && fieldPadding,
      )}
    >
      <div
        className={cn(
          "font-medium text-muted-foreground",
          dense ? "text-[9px] leading-3" : "text-[10px] sm:text-[11px]",
          "lg:text-xs lg:leading-4",
        )}
      >
        {label}
      </div>
      <div
        className={cn(
          "min-w-0 break-words leading-snug",
          dense ? "mt-0 text-[11px]" : "mt-0.5 text-[13px] sm:text-sm",
          "lg:text-[13px] lg:leading-5",
          tone === "hero" && "font-semibold text-foreground",
          tone === "note" && "text-foreground",
          !dense && tone === "note" && "sm:leading-relaxed",
          tone === "metricStrong" && "text-foreground",
        )}
      >
        {children}
      </div>
    </div>
  );
}

function Row({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="grid min-w-0 grid-cols-[64px_minmax(0,1fr)] gap-1.5 rounded-md border border-border/50 bg-surface-muted/25 px-2 py-1 text-[11px] sm:grid-cols-[74px_minmax(0,1fr)] sm:gap-2 sm:rounded-lg sm:py-1.5 sm:text-xs lg:text-xs lg:leading-4">
      <dt className="text-muted-foreground">{label}</dt>
      <dd
        className="min-w-0 truncate text-right text-foreground"
        title={typeof value === "string" ? value : undefined}
      >
        {value}
      </dd>
    </div>
  );
}
