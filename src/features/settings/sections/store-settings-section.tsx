"use client";

import { useState } from "react";
import {
  Check,
  Copy,
  Link as LinkIcon,
  Mail,
  MessageSquare,
  Phone,
  Plus,
  Printer,
  ReceiptText,
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { Textarea } from "@/components/ui/textarea";
import type { StoreOutputIdentity } from "@/entities/store/model/store-output-identity";
import { SettingsField } from "@/features/settings/components/settings-field";
import { StoreLifecycleActions } from "@/features/settings/sections/store-lifecycle-actions";
import { StoreRenameOverlay } from "@/features/settings/sections/store-rename-overlay";
import type { SettingsFieldErrors } from "@/features/settings/model/settings-field-errors";
import {
  getSettingsFieldError,
  getSettingsFieldErrorId,
} from "@/features/settings/model/settings-field-errors";
import type { StoreSettingsDraftValues } from "@/features/settings/model/store-settings-draft";
import type { StoreSettingsReadiness } from "@/features/settings/model/store-settings-readiness";
import { getStoreOutputDraftProjectionCopy } from "@/features/settings/model/store-output-draft-projection";
import type {
  ActorStoreMembership,
  StoreLifecycleCapability,
  StoreLifecyclePreflight,
  StoreRole,
} from "@/lib/repairdesk/types";
import { formLayout, repairOs } from "@/lib/ui-patterns";
import { cn } from "@/lib/utils";
import { RepairOsBusinessCard, RepairOsSectionHeader } from "@/shared/ui";

const storeRoleLabels: Record<StoreRole, string> = {
  owner: "店主",
  manager: "经理",
  technician: "技师",
  sales: "前台",
  viewer: "只读",
};

export interface StoreSettingsSectionContentProps {
  activeStoreId?: string;
  activeStoreExplicit?: boolean;
  stores: ActorStoreMembership[];
  isContextLoading: boolean;
  isSwitching: boolean;
  isCreating: boolean;
  switchError?: string;
  createError?: string;
  newStoreName: string;
  newStoreAddress: string;
  onNewStoreNameChange: (value: string) => void;
  onNewStoreAddressChange: (value: string) => void;
  onSwitchStore: (storeId: string) => void;
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
  isContextLoading,
  isSwitching,
  isCreating,
  switchError,
  createError,
  newStoreName,
  newStoreAddress,
  onNewStoreNameChange,
  onNewStoreAddressChange,
  onSwitchStore,
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
  return (
    <div data-settings-store-section className="min-w-0 space-y-3">
      <StoreWorkspaceCard
        activeStoreId={activeStoreId}
        activeStoreExplicit={activeStoreExplicit}
        stores={stores}
        isLoading={isContextLoading}
        isSwitching={isSwitching}
        error={switchError}
        onSwitchStore={onSwitchStore}
      />

      {draft ? (
        <div className="grid min-w-0 gap-3 xl:grid-cols-[minmax(0,1.15fr)_minmax(0,0.85fr)] xl:items-start">
          <StoreProfileCard
            store={stores.find((store) => store.id === activeStoreId)}
            lifecycleAccess={lifecycleAccess}
            hasUnsavedDraft={isDraftDirty}
            draft={draft}
            canUpdateSettings={canUpdateSettings}
            fieldErrors={fieldErrors}
            onDraftChange={onDraftChange}
          />
          {savedReadiness && draftReadiness && savedOutputIdentity && draftOutputIdentity ? (
            <StoreOutputReadinessCard
              savedReadiness={savedReadiness}
              draftReadiness={draftReadiness}
              savedOutputIdentity={savedOutputIdentity}
              draftOutputIdentity={draftOutputIdentity}
              isDraftDirty={isDraftDirty}
            />
          ) : null}
        </div>
      ) : null}

      <StoreLifecycleCard
        store={stores.find((store) => store.id === activeStoreId)}
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
    </div>
  );
}

function StoreLifecycleCard({
  store,
  preflight,
  isLoading,
  error,
  canRun,
  capability,
  onRun,
}: {
  store?: ActorStoreMembership;
  preflight?: StoreLifecyclePreflight;
  isLoading: boolean;
  error?: string;
  canRun: boolean;
  capability?: StoreLifecycleCapability["close"];
  onRun: () => void;
}) {
  return (
    <section className={cn(repairOs.adminSection, "space-y-3 p-2.5 sm:p-3")}>
      <RepairOsSectionHeader
        icon={ShieldCheck}
        iconFrame={false}
        title="店铺状态与关闭"
        description="需要停用这家店时，从安全检查开始。关闭不是永久删除，以后仍可恢复。"
      />
      {store && capability ? (
        <StoreLifecycleActions
          store={store}
          capability={capability}
          preflight={preflight}
          isPreflighting={isLoading}
          preflightError={error}
          onRunPreflight={onRun}
        />
      ) : (
        <p className="text-sm text-muted-foreground">请先选择要管理的店铺。</p>
      )}
    </section>
  );
}

function StoreWorkspaceCard({
  activeStoreId,
  activeStoreExplicit,
  stores,
  isLoading,
  isSwitching,
  error,
  onSwitchStore,
}: {
  activeStoreId?: string;
  activeStoreExplicit: boolean;
  stores: ActorStoreMembership[];
  isLoading: boolean;
  isSwitching: boolean;
  error?: string;
  onSwitchStore: (storeId: string) => void;
}) {
  return (
    <section className={cn(repairOs.adminSection, "space-y-3 p-2.5 sm:p-3")}>
      <RepairOsSectionHeader icon={Store} iconFrame={false} title="店铺工作区" />
      {isLoading ? (
        <div className="grid gap-2 sm:grid-cols-2">
          <Skeleton className="h-10 w-full" />
          <Skeleton className="h-10 w-full" />
        </div>
      ) : (
        <>
          <div className="grid gap-3 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-end">
            <SettingsField label="当前店铺" htmlFor="active-store">
              <Select
                value={activeStoreId}
                onValueChange={onSwitchStore}
                disabled={isSwitching || stores.length === 0}
              >
                <SelectTrigger id="active-store" className="h-10 text-sm" aria-busy={isSwitching}>
                  <SelectValue placeholder="选择店铺" />
                </SelectTrigger>
                <SelectContent>
                  {stores.map((store) => (
                    <SelectItem key={store.id} value={store.id}>
                      {store.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </SettingsField>
            <div className="rounded-xl border border-[var(--border-panel)] bg-[var(--surface-panel-muted)] px-3 py-2.5 text-xs sm:min-w-40">
              <p className="text-[10px] text-muted-foreground lg:text-[11px] lg:leading-4">
                可访问店铺
              </p>
              <p className="mt-1 font-semibold">{stores.length} 个工作区</p>
            </div>
          </div>
          <p className="text-[11px] leading-4 text-muted-foreground lg:text-xs lg:leading-4">
            切换店铺会加载该独立工作区的订单、客户、库存和设置；存在未保存草稿时会先确认处理方式。
          </p>
          {!activeStoreExplicit && activeStoreId ? (
            <div className="flex flex-col gap-2 rounded-xl border border-status-warn-foreground/25 bg-status-warn/10 p-3 sm:flex-row sm:items-center sm:justify-between">
              <p className="text-xs leading-5 text-status-warn-foreground">
                你有多个店铺。请先确认要管理的是当前这家，系统才会显示重命名和关闭功能。
              </p>
              <Button
                type="button"
                variant="outline"
                className="min-h-10 shrink-0"
                disabled={isSwitching}
                onClick={() => onSwitchStore(activeStoreId)}
              >
                确认管理这家店
              </Button>
            </div>
          ) : null}
          <p role="status" aria-live="polite" className="sr-only">
            {isSwitching ? "正在切换店铺" : "当前店铺已加载"}
          </p>
          {error ? (
            <div
              role="alert"
              className="rounded-lg border border-status-danger-foreground/25 bg-status-danger/10 px-3 py-2 text-[11px] leading-4 text-status-danger-foreground lg:text-xs lg:leading-[18px]"
            >
              店铺切换失败：{error}。当前店铺与未保存草稿均未改变，请重试。
            </div>
          ) : null}
          <div className="flex min-w-0 flex-wrap gap-2" aria-label="可用店铺">
            {stores.map((store) => (
              <Badge
                key={store.id}
                variant={store.id === activeStoreId ? "default" : "outline"}
                className="max-w-full gap-1.5"
              >
                <span className="truncate">{store.name}</span>
                <span className="text-[10px] opacity-75 lg:text-[11px] lg:leading-4 lg:opacity-100">
                  {storeRoleLabels[store.role]}
                </span>
              </Badge>
            ))}
          </div>
        </>
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
  const [confirmOpen, setConfirmOpen] = useState(false);
  const canCreate = newStoreName.trim().length >= 2 && !isCreating;
  const requestCreate = () => {
    if (canCreate) setConfirmOpen(true);
  };

  return (
    <section className={cn(repairOs.adminSection, "p-2.5 sm:p-3")}>
      <RepairOsSectionHeader icon={Plus} iconFrame={false} title="创建独立店铺" />
      <div className="grid min-w-0 gap-3 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-end">
        <div className="grid min-w-0 gap-3">
          <SettingsField label="新店铺名称" htmlFor="new-store">
            <Input
              id="new-store"
              className="h-10 text-sm"
              value={newStoreName}
              maxLength={80}
              placeholder="输入至少 2 个字符"
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
          <SettingsField label="默认打印地址（可选）" htmlFor="new-store-address">
            <Textarea
              id="new-store-address"
              rows={2}
              maxLength={500}
              value={newStoreAddress}
              placeholder="例如 Via Roma 12, Siracusa"
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
          {isCreating ? "创建中…" : "创建并切换"}
        </Button>
      </div>
      <p className="mt-2 text-[11px] leading-4 text-muted-foreground lg:text-xs lg:leading-4">
        将创建新的独立私有租户并切换过去。维修工单、批量工单和二手销售票据会使用填写的默认地址；创建后仍可修改。
      </p>
      {error ? (
        <div
          role="alert"
          className="mt-2 rounded-lg border border-status-danger-foreground/25 bg-status-danger/10 px-3 py-2 text-[11px] leading-4 text-status-danger-foreground lg:text-xs lg:leading-[18px]"
        >
          店铺创建失败：{error}。名称已保留，可修改后再次尝试。
        </div>
      ) : null}
      <AlertDialog open={confirmOpen} onOpenChange={setConfirmOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>确认创建独立店铺？</AlertDialogTitle>
            <AlertDialogDescription>
              将创建“{newStoreName.trim()}
              ”作为新的独立私有租户，并在成功后切换过去。
              {newStoreAddress.trim()
                ? ` 默认打印地址为“${newStoreAddress.trim()}”。`
                : " 默认打印地址暂不填写，完成后可在店铺设置补充。"}
              当前店铺的数据与权限不会复制。
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel className="min-h-11" disabled={isCreating}>
              取消
            </AlertDialogCancel>
            <AlertDialogAction
              className="min-h-11"
              disabled={!canCreate}
              aria-busy={isCreating}
              onClick={onCreateStore}
            >
              {isCreating ? "创建中…" : "确认创建并切换"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </section>
  );
}

function StoreProfileCard({
  store,
  lifecycleAccess,
  hasUnsavedDraft,
  draft,
  canUpdateSettings,
  fieldErrors,
  onDraftChange,
}: {
  store?: ActorStoreMembership;
  lifecycleAccess?: StoreLifecycleCapability;
  hasUnsavedDraft: boolean;
  draft: StoreSettingsDraftValues["store"];
  canUpdateSettings: boolean;
  fieldErrors: SettingsFieldErrors;
  onDraftChange: (patch: Partial<StoreSettingsDraftValues["store"]>) => void;
}) {
  const [copied, setCopied] = useState(false);
  const canShowIdentity = lifecycleAccess?.check.allowed === true && Boolean(store);
  const copyStoreId = async () => {
    if (!store) return;
    await navigator.clipboard.writeText(store.id);
    setCopied(true);
    window.setTimeout(() => setCopied(false), 1600);
  };
  return (
    <section className={cn(repairOs.adminSection, "p-2.5 sm:p-3")}>
      <RepairOsSectionHeader
        icon={Store}
        iconFrame={false}
        title="店铺资料"
        action={
          <Badge variant="outline" className="text-[10px] lg:text-[11px] lg:leading-4">
            {canUpdateSettings ? "可编辑" : "只读"}
          </Badge>
        }
      />
      {canShowIdentity && store ? (
        <div className="mb-3 grid gap-3 rounded-xl border border-[var(--border-panel)] bg-[var(--surface-panel-muted)] p-3 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-center">
          <div className="min-w-0">
            <p className="text-[11px] text-muted-foreground lg:text-xs lg:leading-4">
              系统中的店铺名称
            </p>
            <p className="mt-1 break-words text-sm font-semibold">{store.name}</p>
            <p className="mt-2 text-[11px] text-muted-foreground lg:text-xs lg:leading-4">
              店铺唯一编号
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
              {copied ? "已复制" : "复制编号"}
            </Button>
            {lifecycleAccess ? (
              <StoreRenameOverlay
                store={store}
                capability={lifecycleAccess.rename}
                hasUnsavedProfileDraft={hasUnsavedDraft}
              />
            ) : null}
          </div>
          <p role="status" aria-live="polite" className="sr-only">
            {copied ? "店铺唯一编号已复制" : ""}
          </p>
        </div>
      ) : null}
      {!canUpdateSettings ? (
        <StoreProfileReadOnly draft={draft} />
      ) : (
        <>
          <div className={formLayout.grid}>
            <SettingsField
              label="收据和客户消息显示名称"
              htmlFor="store-name"
              error={getSettingsFieldError(fieldErrors, "store_name")}
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
              label="邮箱"
              htmlFor="store-email"
              icon={Mail}
              error={getSettingsFieldError(fieldErrors, "store_email")}
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
              label="电话"
              htmlFor="store-phone"
              icon={Phone}
              error={getSettingsFieldError(fieldErrors, "store_phone")}
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
              error={getSettingsFieldError(fieldErrors, "store_whatsapp")}
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
            label="门店默认地址（用于打印）"
            htmlFor="store-address"
            className="mt-3"
            error={getSettingsFieldError(fieldErrors, "store_address")}
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
            维修工单、批量工单和二手销售票据会使用此地址；留空时客户输出保持暂停，不会回退到其他店铺地址。
          </p>
          <SettingsField
            label="客户门户域名"
            htmlFor="public-base-url"
            icon={LinkIcon}
            className="mt-3"
            error={getSettingsFieldError(fieldErrors, "public_base_url")}
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
            电话、WhatsApp、邮箱至少填写一个；客户门户域名为空时，外发客户消息会自动省略链接。
          </p>
        </>
      )}
    </section>
  );
}

function StoreProfileReadOnly({ draft }: { draft: StoreSettingsDraftValues["store"] }) {
  const values = [
    ["店铺名", draft.store_name],
    ["邮箱", draft.store_email],
    ["电话", draft.store_phone],
    ["WhatsApp", draft.store_whatsapp],
    ["客户门户域名", draft.public_base_url ?? ""],
    ["默认打印地址", draft.store_address],
  ] as const;

  return (
    <>
      <p className="mb-3 rounded-lg border border-[var(--border-panel)] bg-[var(--surface-panel-muted)] px-3 py-2 text-[11px] leading-4 text-muted-foreground lg:text-xs lg:leading-4">
        当前账号可查看店铺资料；修改请联系店主或经理。
      </p>
      <dl className="grid min-w-0 gap-2 sm:grid-cols-2">
        {values.map(([label, value]) => (
          <div
            key={label}
            className={cn(
              "min-w-0 rounded-xl border border-[var(--border-panel)] bg-card px-3 py-2.5",
              label === "默认打印地址" && "sm:col-span-2",
            )}
          >
            <dt className="text-[10px] font-medium text-muted-foreground lg:text-[11px] lg:leading-4">
              {label}
            </dt>
            <dd className="mt-1 whitespace-pre-wrap break-words text-xs font-semibold leading-4">
              {value.trim() || "未填写"}
            </dd>
          </div>
        ))}
      </dl>
    </>
  );
}

function StoreOutputReadinessCard({
  savedReadiness,
  draftReadiness,
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
  const outputReady = savedOutputIdentity.canOutput;
  const savedItems = customerOutputItems(savedReadiness);
  const draftItems = customerOutputItems(draftReadiness);
  const savedCompletedCount = savedItems.filter((item) => item.completed).length;
  const draftCompletedCount = draftItems.filter((item) => item.completed).length;
  const savedScore = Math.round((savedCompletedCount / savedItems.length) * 100);
  const draftScore = Math.round((draftCompletedCount / draftItems.length) * 100);
  const projection = isDraftDirty
    ? getStoreOutputDraftProjectionCopy(
        savedOutputIdentity.canOutput,
        draftOutputIdentity.canOutput,
      )
    : null;
  const outputSurfaces = [
    { label: "客户消息", icon: MessageSquare },
    { label: "工单与报价打印", icon: Printer },
    { label: "销售与保修票据", icon: ReceiptText },
  ];

  return (
    <section className={cn(repairOs.adminSection, "space-y-3 p-2.5 sm:p-3")}>
      <RepairOsSectionHeader
        icon={Check}
        iconFrame={false}
        title="客户输出就绪度"
        action={
          <Badge
            variant="outline"
            className={cn(
              "text-[10px] lg:text-[11px] lg:leading-4",
              outputReady
                ? "border-status-success-foreground/30 text-status-success-foreground"
                : "border-status-warn-foreground/30 text-status-warn-foreground",
            )}
          >
            {outputReady ? "当前已就绪" : "当前已暂停"}
          </Badge>
        }
      />
      <div className="rounded-xl border border-[var(--border-panel)] bg-[var(--surface-panel-muted)] p-3">
        <div className="flex items-center justify-between gap-3 text-xs">
          <span className="font-semibold">
            已保存身份字段 {savedCompletedCount}/{savedItems.length}
          </span>
          <span className="font-mono font-semibold tabular-nums">{savedScore}%</span>
        </div>
        <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-border/60">
          <div
            className={cn(
              "h-full rounded-full",
              savedScore === 100
                ? "bg-status-success-foreground"
                : savedScore >= 60
                  ? "bg-status-warn-foreground"
                  : "bg-status-danger-foreground",
            )}
            style={{ width: `${savedScore}%` }}
          />
        </div>
        <div className="mt-3 grid gap-1.5 sm:grid-cols-2">
          {savedItems.map((item) => (
            <RepairOsBusinessCard
              key={item.key}
              className="grid-cols-[auto_minmax(0,1fr)] gap-2 rounded-lg border-0 bg-card px-2 py-2 shadow-none"
              leading={
                <span
                  className={cn(
                    "grid size-5 place-items-center rounded-full",
                    item.completed
                      ? "bg-status-success text-status-success-foreground"
                      : "bg-status-warn text-status-warn-foreground",
                  )}
                >
                  {item.completed ? <Check className="size-3" /> : "!"}
                </span>
              }
            >
              <span className="block truncate text-xs font-medium">{item.label}</span>
            </RepairOsBusinessCard>
          ))}
        </div>
      </div>

      <div
        role={outputReady ? "status" : "alert"}
        className={cn(
          "rounded-xl border px-3 py-2.5",
          outputReady
            ? "border-status-success-foreground/25 bg-status-success/10 text-status-success-foreground"
            : "border-status-warn-foreground/25 bg-status-warn/10 text-status-warn-foreground",
        )}
      >
        <p className="text-xs font-semibold">
          {outputReady ? "当前已保存资料可用于客户输出" : "以下客户输出当前会保持关闭"}
        </p>
        <p className="mt-1 text-[11px] leading-4 lg:text-xs lg:leading-4">
          {outputReady
            ? "消息、报价、收据和打印会使用当前已保存的店铺身份。"
            : savedOutputIdentity.blockReason}
        </p>
        <div className="mt-2 flex flex-wrap gap-1.5">
          {outputSurfaces.map(({ label, icon: Icon }) => (
            <Badge
              key={label}
              variant="outline"
              className="gap-1 bg-background/70 text-[10px] lg:text-[11px] lg:leading-4"
            >
              <Icon className="size-3" />
              {label}
            </Badge>
          ))}
        </div>
      </div>

      {projection ? (
        <div
          role="status"
          aria-live="polite"
          className="rounded-xl border border-primary/25 bg-primary/10 px-3 py-2.5 text-primary"
        >
          <p className="text-xs font-semibold">未保存草稿预估</p>
          <p className="mt-1 text-[11px] leading-4 lg:text-xs lg:leading-4">{projection}</p>
          <p className="mt-1 text-[10px] leading-3 opacity-80 lg:text-[11px] lg:leading-4 lg:opacity-100">
            草稿身份字段 {draftCompletedCount}/{draftItems.length} · {draftScore}%
          </p>
        </div>
      ) : null}
    </section>
  );
}

function customerOutputItems(readiness: StoreSettingsReadiness) {
  return readiness.items.filter((item) => item.key !== "default_inventory_warranty_months");
}
