"use client";

import { useEffect, useState } from "react";
import {
  Copy,
  ChevronDown,
  Link as LinkIcon,
  Mail,
  MessageSquare,
  Phone,
  Plus,
  ShieldCheck,
  Store,
} from "lucide-react";

import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import type { StoreOutputIdentity } from "@/entities/store/model/store-output-identity";
import { SettingsField } from "@/features/settings/components/settings-field";
import { StoreDeleteEntry } from "@/features/settings/sections/store-delete-entry";
import { StoreLifecycleActions } from "@/features/settings/sections/store-lifecycle-actions";
import { StoreRenameOverlay } from "@/features/settings/sections/store-rename-overlay";
import type { SettingsFieldErrors } from "@/features/settings/model/settings-field-errors";
import {
  getSettingsFieldError,
  getSettingsFieldErrorId,
} from "@/features/settings/model/settings-field-errors";
import type { StoreSettingsDraftValues } from "@/features/settings/model/store-settings-draft";
import type { StoreSettingsReadiness } from "@/features/settings/model/store-settings-readiness";
import type {
  ActorStoreMembership,
  StoreLifecycleCapability,
  StoreLifecyclePreflight,
} from "@/lib/repairdesk/types";
import { formLayout, repairOs } from "@/lib/ui-patterns";
import { cn } from "@/lib/utils";
import { RepairOsBusinessCard, RepairOsSectionHeader } from "@/shared/ui";
import { useLocale } from "@/shared/i18n/locale-provider";
import { translateSettingsOperations } from "@/shared/i18n/messages";

function useOperationsCopy() {
  const { locale } = useLocale();
  return (
    source: Parameters<typeof translateSettingsOperations>[1],
    values?: Record<string, string | number>,
  ) => translateSettingsOperations(locale, source, values);
}

export interface StoreSettingsSectionContentProps {
  activeStoreId?: string;
  activeStoreExplicit?: boolean;
  stores: ActorStoreMembership[];
  /** @deprecated Store switching is owned by AppSidebar; kept for test/caller compatibility. */
  isContextLoading?: boolean;
  /** @deprecated Store switching is owned by AppSidebar; kept for test/caller compatibility. */
  isSwitching?: boolean;
  /** @deprecated Store switching is owned by AppSidebar; kept for test/caller compatibility. */
  switchError?: string;
  isCreating: boolean;
  createError?: string;
  newStoreName: string;
  newStoreAddress: string;
  onNewStoreNameChange: (value: string) => void;
  onNewStoreAddressChange: (value: string) => void;
  /** @deprecated Store switching is owned by AppSidebar; kept for test/caller compatibility. */
  onSwitchStore?: (storeId: string) => void;
  onCreateStore: () => void;
  lifecyclePreflight?: StoreLifecyclePreflight;
  isLifecyclePreflighting?: boolean;
  lifecyclePreflightError?: string;
  canRunLifecyclePreflight?: boolean;
  lifecycleAccess?: StoreLifecycleCapability;
  onRunLifecyclePreflight?: () => void;
  draft?: StoreSettingsDraftValues["store"];
  savedReadiness?: StoreSettingsReadiness;
  draftReadiness?: StoreSettingsReadiness;
  savedOutputIdentity?: StoreOutputIdentity;
  draftOutputIdentity?: StoreOutputIdentity;
  isDraftDirty: boolean;
  canUpdateSettings: boolean;
  fieldErrors: SettingsFieldErrors;
  onDraftChange: (patch: Partial<StoreSettingsDraftValues["store"]>) => void;
}

export function StoreSettingsSectionContent({
  activeStoreId,
  activeStoreExplicit = true,
  stores,
  isCreating,
  createError,
  newStoreName,
  newStoreAddress,
  onNewStoreNameChange,
  onNewStoreAddressChange,
  onCreateStore,
  lifecyclePreflight,
  isLifecyclePreflighting = false,
  lifecyclePreflightError,
  canRunLifecyclePreflight = false,
  lifecycleAccess,
  onRunLifecyclePreflight = () => undefined,
  draft,
  savedReadiness,
  draftReadiness,
  savedOutputIdentity,
  draftOutputIdentity,
  isDraftDirty,
  canUpdateSettings,
  fieldErrors,
  onDraftChange,
}: StoreSettingsSectionContentProps) {
  const copy = useOperationsCopy();
  const [managementOpen, setManagementOpen] = useState(false);
  const activeStore = stores.find((store) => store.id === activeStoreId);

  return (
    <div data-settings-store-section className="min-w-0 space-y-3">
      {draft ? (
        <StoreProfileCard
          draft={draft}
          canUpdateSettings={canUpdateSettings}
          fieldErrors={fieldErrors}
          onDraftChange={onDraftChange}
        />
      ) : null}

      {savedReadiness && draftReadiness && savedOutputIdentity && draftOutputIdentity ? (
        <StoreOutputReadinessCard
          savedReadiness={savedReadiness}
          draftReadiness={draftReadiness}
          savedOutputIdentity={savedOutputIdentity}
          draftOutputIdentity={draftOutputIdentity}
          isDraftDirty={isDraftDirty}
        />
      ) : null}

      <section
        data-settings-store-management
        className={cn(repairOs.adminSection, "overflow-hidden p-0")}
      >
        <button
          type="button"
          data-settings-store-management-toggle
          aria-expanded={managementOpen}
          aria-controls="settings-store-management-content"
          onClick={() => setManagementOpen((open) => !open)}
          className="flex min-h-11 w-full min-w-0 items-center gap-2 px-3 py-2.5 text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring sm:px-4"
        >
          <ShieldCheck className="size-4 shrink-0 text-primary" aria-hidden="true" />
          <span className="min-w-0 flex-1">
            <span className="block truncate text-sm font-semibold">{copy("管理店铺与安全")}</span>
            <span className="mt-0.5 block truncate text-[11px] text-muted-foreground lg:text-xs lg:leading-4">
              {copy("重命名、创建、关闭或删除店铺")}
            </span>
          </span>
          <ChevronDown
            className={cn("size-4 shrink-0 transition-transform", managementOpen && "rotate-180")}
            aria-hidden="true"
          />
        </button>
        <div
          id="settings-store-management-content"
          hidden={!managementOpen}
          className="space-y-3 border-t border-[var(--border-panel)] p-2.5 sm:p-3"
        >
          {managementOpen ? (
            <>
              <StoreIdentityCard
                store={activeStore}
                lifecycleAccess={lifecycleAccess}
                hasUnsavedDraft={isDraftDirty}
              />
              <StoreLifecycleCard
                store={activeStore}
                activeStoreExplicit={activeStoreExplicit}
                lifecycleAccess={lifecycleAccess}
                preflight={lifecyclePreflight}
                isLoading={isLifecyclePreflighting}
                error={lifecyclePreflightError}
                canRun={canRunLifecyclePreflight}
                capability={
                  lifecycleAccess
                    ? canRunLifecyclePreflight
                      ? lifecycleAccess.close
                      : { allowed: false, code: "primary_owner_required" as const }
                    : undefined
                }
                onRun={onRunLifecyclePreflight}
              />
              <StoreCreationCard
                isCreating={isCreating}
                error={createError}
                newStoreName={newStoreName}
                newStoreAddress={newStoreAddress}
                onNewStoreNameChange={onNewStoreNameChange}
                onNewStoreAddressChange={onNewStoreAddressChange}
                onCreateStore={onCreateStore}
              />
            </>
          ) : null}
        </div>
      </section>
    </div>
  );
}

function StoreLifecycleCard({
  store,
  activeStoreExplicit,
  lifecycleAccess,
  preflight,
  isLoading,
  error,
  canRun,
  capability,
  onRun,
}: {
  store?: ActorStoreMembership;
  activeStoreExplicit: boolean;
  lifecycleAccess?: StoreLifecycleCapability;
  preflight?: StoreLifecyclePreflight;
  isLoading: boolean;
  error?: string;
  canRun: boolean;
  capability?: StoreLifecycleCapability["close"];
  onRun: () => void;
}) {
  const copy = useOperationsCopy();
  const canShowDeleteEntry =
    Boolean(store) &&
    activeStoreExplicit &&
    lifecycleAccess?.check.allowed === true &&
    store?.lifecycle?.phase === "active";
  const showLifecycleActions = !canShowDeleteEntry || Boolean(preflight) || Boolean(error);
  return (
    <section className={cn(repairOs.adminSection, "space-y-3 p-2.5 sm:p-3")}>
      <RepairOsSectionHeader
        icon={ShieldCheck}
        iconFrame={false}
        title={copy("店铺状态与关闭")}
        description={copy("需要停用这家店时，从安全检查开始。关闭不是永久删除，以后仍可恢复。")}
      />
      {store && capability ? (
        <>
          {canShowDeleteEntry ? (
            <StoreDeleteEntry
              store={store}
              canStart={capability.allowed}
              isPreflighting={isLoading}
              onStart={onRun}
            />
          ) : null}
          {showLifecycleActions ? (
            <StoreLifecycleActions
              store={store}
              capability={capability}
              preflight={preflight}
              isPreflighting={isLoading}
              preflightError={error}
              onRunPreflight={onRun}
            />
          ) : null}
        </>
      ) : (
        <p className="text-sm text-muted-foreground">{copy("请先选择要管理的店铺。")}</p>
      )}
    </section>
  );
}

function StoreCreationCard({
  isCreating,
  error,
  newStoreName,
  newStoreAddress,
  onNewStoreNameChange,
  onNewStoreAddressChange,
  onCreateStore,
}: {
  isCreating: boolean;
  error?: string;
  newStoreName: string;
  newStoreAddress: string;
  onNewStoreNameChange: (value: string) => void;
  onNewStoreAddressChange: (value: string) => void;
  onCreateStore: () => void;
}) {
  const copy = useOperationsCopy();
  const [confirmOpen, setConfirmOpen] = useState(false);
  const canCreate = newStoreName.trim().length >= 2 && !isCreating;
  const requestCreate = () => {
    if (canCreate) setConfirmOpen(true);
  };

  return (
    <section className={cn(repairOs.adminSection, "p-2.5 sm:p-3")}>
      <RepairOsSectionHeader icon={Plus} iconFrame={false} title={copy("创建独立店铺")} />
      <div className="grid min-w-0 gap-3 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-end">
        <div className="grid min-w-0 gap-3">
          <SettingsField label={copy("新店铺名称")} htmlFor="new-store">
            <Input
              id="new-store"
              className="h-10 text-sm"
              value={newStoreName}
              maxLength={80}
              placeholder={copy("输入至少 2 个字符")}
              disabled={isCreating}
              onChange={(event) => onNewStoreNameChange(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === "Enter") {
                  event.preventDefault();
                  requestCreate();
                }
              }}
            />
          </SettingsField>
          <SettingsField label={copy("默认打印地址（可选）")} htmlFor="new-store-address">
            <Textarea
              id="new-store-address"
              rows={2}
              maxLength={500}
              value={newStoreAddress}
              placeholder={copy("例如 Via Roma 12, Siracusa")}
              disabled={isCreating}
              onChange={(event) => onNewStoreAddressChange(event.target.value)}
            />
          </SettingsField>
        </div>
        <Button
          type="button"
          variant="outline"
          className="min-h-10 w-full shrink-0 gap-1.5 sm:w-auto"
          disabled={!canCreate}
          aria-busy={isCreating}
          onClick={requestCreate}
        >
          <Plus className="size-3.5" />
          {isCreating ? copy("创建中…") : copy("创建并切换")}
        </Button>
      </div>
      <p className="mt-2 text-[11px] leading-4 text-muted-foreground lg:text-xs lg:leading-4">
        {copy(
          "将创建新的独立私有租户并切换过去。维修工单、批量工单和二手销售票据会使用填写的默认地址；创建后仍可修改。",
        )}
      </p>
      {error ? (
        <div
          role="alert"
          className="mt-2 rounded-lg border border-status-danger-foreground/25 bg-status-danger/10 px-3 py-2 text-[11px] leading-4 text-status-danger-foreground lg:text-xs lg:leading-[18px]"
        >
          {copy("店铺创建失败。名称已保留，可修改后再次尝试。")}
        </div>
      ) : null}
      <AlertDialog open={confirmOpen} onOpenChange={setConfirmOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{copy("确认创建独立店铺？")}</AlertDialogTitle>
            <AlertDialogDescription className="[overflow-wrap:anywhere]">
              {copy("将创建“{name}”作为新的独立私有租户，并在成功后切换过去。", {
                name: newStoreName.trim(),
              })}{" "}
              {newStoreAddress.trim()
                ? copy("默认打印地址为“{address}”。", { address: newStoreAddress.trim() })
                : copy("默认打印地址暂不填写，完成后可在店铺设置补充。")}{" "}
              {copy("当前店铺的数据与权限不会复制。")}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel className="min-h-11" disabled={isCreating}>
              {copy("取消")}
            </AlertDialogCancel>
            <AlertDialogAction
              className="min-h-11"
              disabled={!canCreate}
              aria-busy={isCreating}
              onClick={onCreateStore}
            >
              {isCreating ? copy("创建中…") : copy("确认创建并切换")}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </section>
  );
}

function StoreProfileCard({
  draft,
  canUpdateSettings,
  fieldErrors,
  onDraftChange,
}: {
  draft: StoreSettingsDraftValues["store"];
  canUpdateSettings: boolean;
  fieldErrors: SettingsFieldErrors;
  onDraftChange: (patch: Partial<StoreSettingsDraftValues["store"]>) => void;
}) {
  const copy = useOperationsCopy();
  const publicBaseUrlError = getSettingsFieldError(fieldErrors, "public_base_url");
  const [moreOptionsOpen, setMoreOptionsOpen] = useState(Boolean(publicBaseUrlError));
  useEffect(() => {
    if (publicBaseUrlError) setMoreOptionsOpen(true);
  }, [publicBaseUrlError]);
  useEffect(() => {
    if (!publicBaseUrlError || !moreOptionsOpen) return;
    const frame = window.requestAnimationFrame(() => {
      document.getElementById("public-base-url")?.focus();
    });
    return () => window.cancelAnimationFrame(frame);
  }, [moreOptionsOpen, publicBaseUrlError]);
  return (
    <section className={cn(repairOs.adminSection, "p-2.5 sm:p-3")}>
      <RepairOsSectionHeader
        icon={Store}
        iconFrame={false}
        title={copy("店铺资料")}
        action={
          <Badge variant="outline" className="text-[10px] lg:text-[11px] lg:leading-4">
            {canUpdateSettings ? copy("可编辑") : copy("只读")}
          </Badge>
        }
      />
      {!canUpdateSettings ? (
        <StoreProfileReadOnly draft={draft} />
      ) : (
        <>
          <div className={formLayout.grid}>
            <SettingsField
              label={copy("收据和客户消息显示名称")}
              htmlFor="store-name"
              error={localizeSettingsFieldError(fieldErrors, "store_name", copy)}
            >
              <Input
                id="store-name"
                className="h-10 text-sm"
                value={draft.store_name}
                maxLength={120}
                autoComplete="organization"
                aria-invalid={Boolean(getSettingsFieldError(fieldErrors, "store_name"))}
                aria-describedby={getSettingsFieldErrorId(fieldErrors, "store_name", "store-name")}
                onChange={(event) => onDraftChange({ store_name: event.target.value })}
              />
            </SettingsField>
            <SettingsField
              label={copy("邮箱")}
              htmlFor="store-email"
              icon={Mail}
              error={localizeSettingsFieldError(fieldErrors, "store_email", copy)}
            >
              <Input
                id="store-email"
                type="email"
                className="h-10 text-sm"
                value={draft.store_email}
                autoComplete="email"
                aria-invalid={Boolean(getSettingsFieldError(fieldErrors, "store_email"))}
                aria-describedby={getSettingsFieldErrorId(
                  fieldErrors,
                  "store_email",
                  "store-email",
                )}
                onChange={(event) => onDraftChange({ store_email: event.target.value })}
              />
            </SettingsField>
            <SettingsField
              label={copy("电话")}
              htmlFor="store-phone"
              icon={Phone}
              error={localizeSettingsFieldError(fieldErrors, "store_phone", copy)}
            >
              <Input
                id="store-phone"
                type="tel"
                className="h-10 text-sm"
                value={draft.store_phone}
                autoComplete="tel"
                inputMode="tel"
                aria-invalid={Boolean(getSettingsFieldError(fieldErrors, "store_phone"))}
                aria-describedby={getSettingsFieldErrorId(
                  fieldErrors,
                  "store_phone",
                  "store-phone",
                )}
                onChange={(event) => onDraftChange({ store_phone: event.target.value })}
              />
            </SettingsField>
            <SettingsField
              label="WhatsApp"
              htmlFor="store-whatsapp"
              icon={MessageSquare}
              error={localizeSettingsFieldError(fieldErrors, "store_whatsapp", copy)}
            >
              <Input
                id="store-whatsapp"
                type="tel"
                className="h-10 text-sm"
                value={draft.store_whatsapp}
                autoComplete="tel"
                inputMode="tel"
                aria-invalid={Boolean(getSettingsFieldError(fieldErrors, "store_whatsapp"))}
                aria-describedby={getSettingsFieldErrorId(
                  fieldErrors,
                  "store_whatsapp",
                  "store-whatsapp",
                )}
                onChange={(event) => onDraftChange({ store_whatsapp: event.target.value })}
              />
            </SettingsField>
          </div>
          <SettingsField
            label={copy("门店默认地址（用于打印）")}
            htmlFor="store-address"
            className="mt-3"
            error={localizeSettingsFieldError(fieldErrors, "store_address", copy)}
          >
            <Textarea
              id="store-address"
              rows={3}
              className="min-h-24 text-sm"
              value={draft.store_address}
              autoComplete="street-address"
              aria-invalid={Boolean(getSettingsFieldError(fieldErrors, "store_address"))}
              aria-describedby={[
                getSettingsFieldErrorId(fieldErrors, "store_address", "store-address"),
                "store-address-help",
              ]
                .filter(Boolean)
                .join(" ")}
              onChange={(event) => onDraftChange({ store_address: event.target.value })}
            />
          </SettingsField>
          <p
            id="store-address-help"
            className="mt-2 text-[11px] leading-4 text-muted-foreground lg:text-xs lg:leading-4"
          >
            {copy(
              "维修工单、批量工单和二手销售票据会使用此地址；留空时客户输出保持暂停，不会回退到其他店铺地址。",
            )}
          </p>
          <StoreProfileMoreOptions
            open={moreOptionsOpen}
            onOpenChange={setMoreOptionsOpen}
            draft={draft}
            fieldErrors={fieldErrors}
            onDraftChange={onDraftChange}
          />
        </>
      )}
    </section>
  );
}

function StoreProfileReadOnly({ draft }: { draft: StoreSettingsDraftValues["store"] }) {
  const copy = useOperationsCopy();
  const [moreOptionsOpen, setMoreOptionsOpen] = useState(false);
  const values = [
    [copy("店铺名"), draft.store_name, false],
    [copy("邮箱"), draft.store_email, false],
    [copy("电话"), draft.store_phone, false],
    ["WhatsApp", draft.store_whatsapp, false],
    [copy("默认打印地址"), draft.store_address, true],
  ] as const;

  return (
    <>
      <p className="mb-3 rounded-lg border border-[var(--border-panel)] bg-[var(--surface-panel-muted)] px-3 py-2 text-[11px] leading-4 text-muted-foreground lg:text-xs lg:leading-4">
        {copy("当前账号可查看店铺资料；修改请联系店主或经理。")}
      </p>
      <dl className="grid min-w-0 gap-2 sm:grid-cols-2">
        {values.map(([label, value, wide]) => (
          <div
            key={label}
            className={cn(
              "min-w-0 rounded-xl border border-[var(--border-panel)] bg-card px-3 py-2.5",
              wide && "sm:col-span-2",
            )}
          >
            <dt className="text-[10px] font-medium text-muted-foreground lg:text-[11px] lg:leading-4">
              {label}
            </dt>
            <dd className="mt-1 whitespace-pre-wrap break-words text-xs font-semibold leading-4">
              {value.trim() || copy("未填写")}
            </dd>
          </div>
        ))}
      </dl>
      <div className="mt-3 border-t border-[var(--border-panel)] pt-2">
        <button
          type="button"
          aria-expanded={moreOptionsOpen}
          aria-controls="store-profile-readonly-more"
          onClick={() => setMoreOptionsOpen((open) => !open)}
          className="flex min-h-11 w-full items-center gap-2 text-left text-xs font-medium text-muted-foreground hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring sm:min-h-9"
        >
          <span className="flex-1">{copy("更多选项")}</span>
          <ChevronDown
            className={cn("size-4 transition-transform", moreOptionsOpen && "rotate-180")}
            aria-hidden="true"
          />
        </button>
        <dl id="store-profile-readonly-more" hidden={!moreOptionsOpen} className="mt-2">
          {moreOptionsOpen ? (
            <div className="min-w-0 rounded-xl border border-[var(--border-panel)] bg-card px-3 py-2.5">
              <dt className="text-[10px] font-medium text-muted-foreground lg:text-[11px] lg:leading-4">
                {copy("客户门户域名")}
              </dt>
              <dd className="mt-1 whitespace-pre-wrap break-words text-xs font-semibold leading-4">
                {draft.public_base_url?.trim() || copy("未填写")}
              </dd>
            </div>
          ) : null}
        </dl>
      </div>
    </>
  );
}

function StoreProfileMoreOptions({
  open,
  onOpenChange,
  draft,
  fieldErrors,
  onDraftChange,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  draft: StoreSettingsDraftValues["store"];
  fieldErrors: SettingsFieldErrors;
  onDraftChange: (patch: Partial<StoreSettingsDraftValues["store"]>) => void;
}) {
  const copy = useOperationsCopy();
  return (
    <div className="mt-3 border-t border-[var(--border-panel)] pt-2">
      <button
        type="button"
        aria-expanded={open}
        aria-controls="store-profile-more"
        onClick={() => onOpenChange(!open)}
        className="flex min-h-11 w-full items-center gap-2 text-left text-xs font-medium text-muted-foreground hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring sm:min-h-9"
      >
        <span className="flex-1">{copy("更多选项")}</span>
        <ChevronDown
          className={cn("size-4 transition-transform", open && "rotate-180")}
          aria-hidden="true"
        />
      </button>
      <div id="store-profile-more" hidden={!open} className="mt-2">
        {open ? (
          <>
            <SettingsField
              label={copy("客户门户域名")}
              htmlFor="public-base-url"
              icon={LinkIcon}
              error={localizeSettingsFieldError(fieldErrors, "public_base_url", copy)}
            >
              <Input
                id="public-base-url"
                type="url"
                className="h-10 text-sm"
                value={draft.public_base_url ?? ""}
                inputMode="url"
                placeholder="https://example.test"
                aria-invalid={Boolean(getSettingsFieldError(fieldErrors, "public_base_url"))}
                aria-describedby={getSettingsFieldErrorId(
                  fieldErrors,
                  "public_base_url",
                  "public-base-url",
                )}
                onChange={(event) => onDraftChange({ public_base_url: event.target.value })}
              />
            </SettingsField>
            <p className="mt-2 text-[11px] leading-4 text-muted-foreground lg:text-xs lg:leading-4">
              {copy("为空时，外发客户消息会自动省略链接。")}
            </p>
          </>
        ) : null}
      </div>
    </div>
  );
}

function StoreIdentityCard({
  store,
  lifecycleAccess,
  hasUnsavedDraft,
}: {
  store?: ActorStoreMembership;
  lifecycleAccess?: StoreLifecycleCapability;
  hasUnsavedDraft: boolean;
}) {
  const copy = useOperationsCopy();
  const [copied, setCopied] = useState(false);
  if (!store || lifecycleAccess?.check.allowed !== true) return null;

  const copyStoreId = async () => {
    await navigator.clipboard.writeText(store.id);
    setCopied(true);
    window.setTimeout(() => setCopied(false), 1600);
  };

  return (
    <section className={cn(repairOs.adminSection, "p-2.5 sm:p-3")}>
      <RepairOsSectionHeader icon={Store} iconFrame={false} title={copy("店铺技术信息")} />
      <div className="grid gap-3 rounded-xl border border-[var(--border-panel)] bg-[var(--surface-panel-muted)] p-3 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-center">
        <div className="min-w-0">
          <p className="text-[11px] text-muted-foreground lg:text-xs lg:leading-4">
            {copy("系统中的店铺名称")}
          </p>
          <p className="mt-1 break-words text-sm font-semibold">{store.name}</p>
          <p className="mt-2 text-[11px] text-muted-foreground lg:text-xs lg:leading-4">
            {copy("店铺唯一编号")}
          </p>
          <p className="mt-1 break-all font-mono text-xs tabular-nums">{store.id}</p>
        </div>
        <div className="flex flex-wrap gap-2 sm:justify-end">
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="min-h-10 gap-1.5"
            onClick={() => void copyStoreId()}
          >
            <Copy className="size-3.5" aria-hidden="true" />
            {copied ? copy("已复制") : copy("复制编号")}
          </Button>
          <StoreRenameOverlay
            store={store}
            capability={lifecycleAccess.rename}
            hasUnsavedProfileDraft={hasUnsavedDraft}
          />
        </div>
        <p role="status" aria-live="polite" className="sr-only">
          {copied ? copy("店铺唯一编号已复制") : ""}
        </p>
      </div>
    </section>
  );
}

function StoreOutputReadinessCard({
  savedReadiness: _savedReadiness,
  draftReadiness: _draftReadiness,
  savedOutputIdentity,
  draftOutputIdentity,
  isDraftDirty,
}: {
  savedReadiness: StoreSettingsReadiness;
  draftReadiness: StoreSettingsReadiness;
  savedOutputIdentity: StoreOutputIdentity;
  draftOutputIdentity: StoreOutputIdentity;
  isDraftDirty: boolean;
}) {
  const copy = useOperationsCopy();
  const outputReady = savedOutputIdentity.canOutput;
  const projection = isDraftDirty
    ? savedOutputIdentity.canOutput
      ? draftOutputIdentity.canOutput
        ? "当前客户输出已就绪；草稿尚未保存，实际使用的仍是服务器版本。"
        : "当前客户输出仍可使用；保存这份草稿后将阻断客户消息、打印和票据。"
      : draftOutputIdentity.canOutput
        ? "当前客户输出仍然阻断；保存这份草稿后预计解除阻断。"
        : "当前客户输出仍然阻断；草稿尚未保存，实际缺失状态没有变化。"
    : null;

  if (outputReady && (!isDraftDirty || draftOutputIdentity.canOutput)) return null;

  return (
    <section
      data-settings-output-warning
      role="alert"
      className="rounded-xl border border-status-warn-foreground/25 bg-status-warn/10 px-3 py-2.5 text-status-warn-foreground"
    >
      <p className="text-xs font-semibold">
        {outputReady ? copy("保存这份草稿后将暂停客户输出") : copy("客户输出当前保持关闭")}
      </p>
      <p className="mt-1 text-[11px] leading-4 lg:text-xs lg:leading-4">
        {getStoreOutputPresentationCopy({
          savedOutputIdentity,
          projection,
          copy,
        })}
      </p>
    </section>
  );
}

function getStoreOutputPresentationCopy({
  savedOutputIdentity,
  projection,
  copy,
}: {
  savedOutputIdentity: StoreOutputIdentity;
  projection: Parameters<typeof translateSettingsOperations>[1] | null;
  copy: ReturnType<typeof useOperationsCopy>;
}) {
  if (projection) return copy(projection);
  switch (savedOutputIdentity.blockCode) {
    case "settings_loading":
      return copy("正在读取当前店铺资料");
    case "settings_load_failed":
      return copy("无法读取当前店铺资料");
    case "store_context_mismatch":
      return copy("当前店铺资料与设置所属店铺不一致");
    case "legacy_identity":
      return copy("检测到需要重新确认的旧店铺身份资料，请先更新店铺资料");
    case "missing_store_name":
      return copy("请先在设置中填写当前店铺名称");
    case "missing_required_fields":
    default:
      return copy("请先补齐当前店铺必填资料");
  }
}

function localizeSettingsFieldError(
  errors: SettingsFieldErrors,
  field: string,
  copy: ReturnType<typeof useOperationsCopy>,
) {
  return getSettingsFieldError(errors, field) ? copy("请检查此字段") : undefined;
}
