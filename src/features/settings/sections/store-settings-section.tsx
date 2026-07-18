"use client";

import { useState } from "react";
import {
  Check,
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
        stores={stores}
        isLoading={isContextLoading}
        isSwitching={isSwitching}
        error={switchError}
        onSwitchStore={onSwitchStore}
      />

      <StoreLifecycleCard
        store={stores.find((store) => store.id === activeStoreId)}
        preflight={lifecyclePreflight}
        isLoading={isLifecyclePreflighting}
        error={lifecyclePreflightError}
        canRun={canRunLifecyclePreflight}
        onRun={onRunLifecyclePreflight}
      />

      {draft ? (
        <div className="grid min-w-0 gap-3 xl:grid-cols-[minmax(0,1.15fr)_minmax(0,0.85fr)] xl:items-start">
          <StoreProfileCard
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

const lifecycleBlockerLabels: Record<StoreLifecyclePreflight["blockers"][number]["code"], string> =
  {
    open_orders: "仍有开放工单",
    unsettled_balance: "仍有未结余额",
    device_in_custody: "仍有设备由门店保管",
    open_kiosk_sessions: "仍有开放的客户 iPad 会话",
    pending_invitations: "仍有待处理邀请",
    retention_hold: "数据仍在保留期",
    legal_hold: "存在法律保留",
    storage_manifest_unavailable: "Storage 清单尚未完整验证",
  };

function StoreLifecycleCard({
  store,
  preflight,
  isLoading,
  error,
  canRun,
  onRun,
}: {
  store?: ActorStoreMembership;
  preflight?: StoreLifecyclePreflight;
  isLoading: boolean;
  error?: string;
  canRun: boolean;
  onRun: () => void;
}) {
  return (
    <section className={cn(repairOs.adminSection, "space-y-3 p-2.5 sm:p-3")}>
      <RepairOsSectionHeader
        icon={ShieldCheck}
        iconFrame={false}
        title="店铺生命周期"
        description="先做只读预检，再决定完整重命名、可恢复关闭或继续保留。"
      />
      <div className="grid gap-2 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-center">
        <div className="rounded-xl border border-[var(--border-panel)] bg-[var(--surface-panel-muted)] px-3 py-2.5">
          <p className="text-xs font-semibold">安全实施门禁</p>
          <p className="mt-1 text-[11px] leading-4 text-muted-foreground">
            预检只返回脱敏计数和阻断原因，不会重命名、关闭或删除任何数据。永久清除默认关闭。
          </p>
        </div>
        <Button
          type="button"
          variant="outline"
          className="min-h-11 w-full sm:w-auto"
          disabled={!canRun || isLoading}
          aria-busy={isLoading}
          onClick={onRun}
        >
          {isLoading ? "预检中…" : "运行安全预检"}
        </Button>
      </div>
      {!canRun ? (
        <p className="text-[11px] leading-4 text-muted-foreground">
          只有当前店铺的店主可以请求预检；服务端还会再次核对主创建者和精确 UUID。
        </p>
      ) : null}
      {preflight ? (
        <div
          role="status"
          className={cn(
            "rounded-xl border px-3 py-2.5 text-xs",
            preflight.state === "eligible"
              ? "border-status-success-foreground/25 bg-status-success/10"
              : "border-status-warn-foreground/25 bg-status-warn/10",
          )}
        >
          <p className="font-semibold">
            {preflight.state === "eligible" ? "当前预检未发现业务阻断" : "当前不能关闭或清除店铺"}
          </p>
          <p className="mt-1 text-[11px] leading-4 text-muted-foreground">
            店铺 UUID 尾号 {preflight.store_id.slice(-8)} · 生命周期版本{" "}
            {preflight.lifecycle.revision} · 快照有效至{" "}
            {new Date(preflight.expires_at).toLocaleTimeString("zh-CN")}
          </p>
          {preflight.blockers.length > 0 ? (
            <ul className="mt-2 space-y-1 text-[11px] leading-4">
              {preflight.blockers.map((blocker) => (
                <li key={blocker.code}>
                  {lifecycleBlockerLabels[blocker.code]}
                  {blocker.count !== undefined ? `：${blocker.count}` : ""}
                  {blocker.amount !== undefined ? `（€${blocker.amount.toFixed(2)}）` : ""}
                </li>
              ))}
            </ul>
          ) : null}
        </div>
      ) : null}
      {error ? (
        <div
          role="alert"
          className="rounded-lg border border-status-danger-foreground/25 bg-status-danger/10 px-3 py-2 text-[11px] leading-4 text-status-danger-foreground"
        >
          预检失败：{error}。未执行任何店铺变更。
        </div>
      ) : null}
      {canRun && store ? <StoreLifecycleActions store={store} preflight={preflight} /> : null}
    </section>
  );
}

function StoreWorkspaceCard({
  activeStoreId,
  stores,
  isLoading,
  isSwitching,
  error,
  onSwitchStore,
}: {
  activeStoreId?: string;
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
              <p className="text-[10px] text-muted-foreground">可访问店铺</p>
              <p className="mt-1 font-semibold">{stores.length} 个工作区</p>
            </div>
          </div>
          <p className="text-[11px] leading-4 text-muted-foreground">
            切换店铺会加载该独立工作区的订单、客户、库存和设置；存在未保存草稿时会先确认处理方式。
          </p>
          <p role="status" aria-live="polite" className="sr-only">
            {isSwitching ? "正在切换店铺" : "当前店铺已加载"}
          </p>
          {error ? (
            <div
              role="alert"
              className="rounded-lg border border-status-danger-foreground/25 bg-status-danger/10 px-3 py-2 text-[11px] leading-4 text-status-danger-foreground"
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
                <span className="text-[10px] opacity-75">{storeRoleLabels[store.role]}</span>
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
          className="min-h-11 w-full shrink-0 gap-1.5 sm:min-h-10 sm:w-auto"
          disabled={!canCreate}
          aria-busy={isCreating}
          onClick={requestCreate}
        >
          <Plus className="size-3.5" />
          {isCreating ? "创建中…" : "创建并切换"}
        </Button>
      </div>
      <p className="mt-2 text-[11px] leading-4 text-muted-foreground">
        将创建新的独立私有租户并切换过去。维修工单、批量工单和二手销售票据会使用填写的默认地址；创建后仍可修改。
      </p>
      {error ? (
        <div
          role="alert"
          className="mt-2 rounded-lg border border-status-danger-foreground/25 bg-status-danger/10 px-3 py-2 text-[11px] leading-4 text-status-danger-foreground"
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
  return (
    <section className={cn(repairOs.adminSection, "p-2.5 sm:p-3")}>
      <RepairOsSectionHeader
        icon={Store}
        iconFrame={false}
        title="店铺资料"
        action={
          <Badge variant="outline" className="text-[10px]">
            {canUpdateSettings ? "可编辑" : "只读"}
          </Badge>
        }
      />
      {!canUpdateSettings ? (
        <StoreProfileReadOnly draft={draft} />
      ) : (
        <>
          <div className={formLayout.grid}>
            <SettingsField
              label="店铺名"
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
          <p id="store-address-help" className="mt-2 text-[11px] leading-4 text-muted-foreground">
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
          <p className="mt-2 text-[11px] leading-4 text-muted-foreground">
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
      <p className="mb-3 rounded-lg border border-[var(--border-panel)] bg-[var(--surface-panel-muted)] px-3 py-2 text-[11px] leading-4 text-muted-foreground">
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
            <dt className="text-[10px] font-medium text-muted-foreground">{label}</dt>
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
              "text-[10px]",
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
        <p className="mt-1 text-[11px] leading-4">
          {outputReady
            ? "消息、报价、收据和打印会使用当前已保存的店铺身份。"
            : savedOutputIdentity.blockReason}
        </p>
        <div className="mt-2 flex flex-wrap gap-1.5">
          {outputSurfaces.map(({ label, icon: Icon }) => (
            <Badge key={label} variant="outline" className="gap-1 bg-background/70 text-[10px]">
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
          <p className="mt-1 text-[11px] leading-4">{projection}</p>
          <p className="mt-1 text-[10px] leading-3 opacity-80">
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
