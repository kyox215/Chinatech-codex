"use client";

import { useEffect, useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  AlertTriangle,
  ArrowDown,
  ArrowUp,
  Check,
  GitBranch,
  Mail,
  MessageSquare,
  Phone,
  Plus,
  Printer,
  Settings2,
  Store,
  UserPlus,
  Users,
} from "lucide-react";
import { toast } from "sonner";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { Textarea } from "@/components/ui/textarea";
import { messageSettingsKeys } from "@/features/messages/api/query-keys";
import { ordersKeys } from "@/features/orders/api/query-keys";
import { formatWarrantyText, ORDER_WARRANTY_OPTIONS } from "@/features/orders/model/order-warranty";
import {
  getOrderWorkflowBucketLabel,
  getWorkflowStatuses,
} from "@/features/orders/model/order-workflow";
import { storesKeys } from "@/features/stores/api/query-keys";
import {
  createStore,
  createOrderWorkflowStatus,
  getStoreMembers,
  getStoreContext,
  getStoreSettings,
  inviteStoreMember,
  listOrderWorkflow,
  reorderOrderWorkflowStatuses,
  switchStore,
  updateOrderWorkflowStatus,
  updateOrderWorkflowTransitions,
  updateStoreSettings,
  type OrderWorkflow,
  type OrderWorkflowBucket,
  type OrderWorkflowStatusCreateInput,
  type OrderWorkflowTone,
  type OrderWorkflowTransitionsUpdateInput,
  type StoreInviteInput,
  type StoreSettings,
} from "@/lib/repairdesk/api";
import { cn } from "@/lib/utils";
import { brandGradientStyle, formLayout, pageHeader, pageShell, surfaces } from "@/lib/ui-patterns";

type SettingsDraft = Pick<
  StoreSettings,
  | "store_name"
  | "store_address"
  | "store_phone"
  | "store_whatsapp"
  | "store_email"
  | "default_order_warranty_text"
  | "default_order_warranty_months"
  | "default_inventory_warranty_months"
  | "print_footer"
  | "message_signature"
>;

export function SettingsScreen() {
  const queryClient = useQueryClient();
  const settingsQuery = useQuery({
    queryKey: messageSettingsKeys.store,
    queryFn: getStoreSettings,
  });
  const storeContextQuery = useQuery({
    queryKey: storesKeys.context,
    queryFn: getStoreContext,
  });
  const storeMembersQuery = useQuery({
    queryKey: storesKeys.members,
    queryFn: getStoreMembers,
  });
  const workflowQuery = useQuery({
    queryKey: ordersKeys.workflow(),
    queryFn: listOrderWorkflow,
    staleTime: 60_000,
  });
  const settingsData = settingsQuery.data;
  const [draft, setDraft] = useState<SettingsDraft | null>(null);
  const [newStoreName, setNewStoreName] = useState("");
  const [inviteDraft, setInviteDraft] = useState<StoreInviteInput>({
    email: "",
    role: "technician",
  });

  useEffect(() => {
    if (!settingsData) return;
    setDraft(toDraft(settingsData));
  }, [settingsData]);

  const hasChanges = useMemo(() => {
    if (!draft || !settingsData) return false;
    const current = toDraft(settingsData);
    return JSON.stringify(current) !== JSON.stringify(draft);
  }, [draft, settingsData]);

  const saveMutation = useMutation({
    mutationFn: async () => {
      if (!draft) throw new Error("设置未加载");
      return updateStoreSettings(draft);
    },
    onSuccess: (settings) => {
      toast.success("设置已保存");
      setDraft(toDraft(settings));
      queryClient.invalidateQueries({ queryKey: messageSettingsKeys.store });
      queryClient.invalidateQueries({ queryKey: messageSettingsKeys.templates });
    },
    onError: (error) => toast.error(error instanceof Error ? error.message : "保存失败"),
  });
  const switchStoreMutation = useMutation({
    mutationFn: switchStore,
    onSuccess: async (context) => {
      toast.success(`已切换到 ${context.activeStore?.name ?? "店铺"}`);
      await queryClient.invalidateQueries();
    },
    onError: (error) => toast.error(error instanceof Error ? error.message : "切换店铺失败"),
  });
  const createStoreMutation = useMutation({
    mutationFn: createStore,
    onSuccess: async (context) => {
      toast.success(`已创建 ${context.activeStore?.name ?? "新店铺"}`);
      setNewStoreName("");
      await queryClient.invalidateQueries();
    },
    onError: (error) => toast.error(error instanceof Error ? error.message : "创建店铺失败"),
  });
  const inviteMemberMutation = useMutation({
    mutationFn: inviteStoreMember,
    onSuccess: async () => {
      toast.success("邀请已保存");
      setInviteDraft({ email: "", role: "technician" });
      await queryClient.invalidateQueries({ queryKey: storesKeys.members });
    },
    onError: (error) => toast.error(error instanceof Error ? error.message : "邀请失败"),
  });
  const createWorkflowStatusMutation = useMutation({
    mutationFn: createOrderWorkflowStatus,
    onSuccess: async () => {
      toast.success("状态已新增");
      await queryClient.invalidateQueries({ queryKey: ordersKeys.workflow() });
      await queryClient.invalidateQueries({ queryKey: ["orders"] });
    },
    onError: (error) => toast.error(error instanceof Error ? error.message : "新增状态失败"),
  });
  const updateWorkflowStatusMutation = useMutation({
    mutationFn: ({
      id,
      input,
    }: {
      id: string;
      input: Parameters<typeof updateOrderWorkflowStatus>[1];
    }) => updateOrderWorkflowStatus(id, input),
    onSuccess: async () => {
      toast.success("状态已保存");
      await queryClient.invalidateQueries({ queryKey: ordersKeys.workflow() });
      await queryClient.invalidateQueries({ queryKey: ["orders"] });
    },
    onError: (error) => toast.error(error instanceof Error ? error.message : "保存状态失败"),
  });
  const reorderWorkflowStatusesMutation = useMutation({
    mutationFn: reorderOrderWorkflowStatuses,
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ordersKeys.workflow() });
      await queryClient.invalidateQueries({ queryKey: ["orders"] });
    },
    onError: (error) => toast.error(error instanceof Error ? error.message : "排序失败"),
  });
  const updateWorkflowTransitionsMutation = useMutation({
    mutationFn: updateOrderWorkflowTransitions,
    onSuccess: async () => {
      toast.success("流转关系已保存");
      await queryClient.invalidateQueries({ queryKey: ordersKeys.workflow() });
    },
    onError: (error) => toast.error(error instanceof Error ? error.message : "保存流转关系失败"),
  });

  if (settingsQuery.isLoading || !draft) {
    return <SettingsLoading />;
  }

  if (settingsQuery.isError) {
    return (
      <main className={pageShell.form}>
        <section className={surfaces.empty}>
          <Settings2 className="mb-3 size-8 text-status-danger-foreground" />
          <p className="text-sm text-status-danger-foreground">读取系统设置失败</p>
          <Button variant="outline" className="mt-3" onClick={() => settingsQuery.refetch()}>
            重新加载
          </Button>
        </section>
      </main>
    );
  }

  return (
    <main className={pageShell.form}>
      <header className={pageHeader.root}>
        <div>
          <p className={pageHeader.eyebrow}>RepairDesk / Settings</p>
          <h1 className={pageHeader.compactTitle}>
            <span className="gradient-text">系统设置</span>
          </h1>
          <p className={pageHeader.subtitle}>店铺资料、默认规则和输出签名。</p>
        </div>
        <div className={pageHeader.actions}>
          <Button
            style={brandGradientStyle}
            disabled={!hasChanges || saveMutation.isPending}
            onClick={() => saveMutation.mutate()}
          >
            <Check className="mr-1.5 size-3.5" /> 保存设置
          </Button>
        </div>
      </header>

      <form
        className={cn(formLayout.stack, "mt-5")}
        onSubmit={(event) => {
          event.preventDefault();
          if (hasChanges && !saveMutation.isPending) saveMutation.mutate();
        }}
      >
        <StoreManagementSection
          activeStoreId={storeContextQuery.data?.activeStore?.id}
          stores={storeContextQuery.data?.stores ?? []}
          isLoading={storeContextQuery.isLoading}
          isSwitching={switchStoreMutation.isPending}
          isCreating={createStoreMutation.isPending}
          newStoreName={newStoreName}
          onNewStoreNameChange={setNewStoreName}
          onSwitchStore={(storeId) => {
            if (!storeId || storeId === storeContextQuery.data?.activeStore?.id) return;
            switchStoreMutation.mutate(storeId);
          }}
          onCreateStore={() => {
            const name = newStoreName.trim();
            if (!name) return;
            createStoreMutation.mutate({ name });
          }}
        />
        <StoreMembersSection
          members={storeMembersQuery.data?.members ?? []}
          invitations={storeMembersQuery.data?.invitations ?? []}
          isLoading={storeMembersQuery.isLoading}
          inviteDraft={inviteDraft}
          isInviting={inviteMemberMutation.isPending}
          onInviteDraftChange={setInviteDraft}
          onInvite={() => {
            const email = inviteDraft.email.trim();
            if (!email) return;
            inviteMemberMutation.mutate({ ...inviteDraft, email });
          }}
        />
        <OrderWorkflowSection
          workflow={workflowQuery.data}
          isLoading={workflowQuery.isLoading}
          isError={workflowQuery.isError}
          errorMessage={
            workflowQuery.error instanceof Error
              ? workflowQuery.error.message
              : "状态流配置暂时不可用"
          }
          onRetry={() => void workflowQuery.refetch()}
          isSaving={
            createWorkflowStatusMutation.isPending ||
            updateWorkflowStatusMutation.isPending ||
            reorderWorkflowStatusesMutation.isPending ||
            updateWorkflowTransitionsMutation.isPending
          }
          onCreateStatus={(input) => createWorkflowStatusMutation.mutate(input)}
          onUpdateStatus={(id, input) => updateWorkflowStatusMutation.mutate({ id, input })}
          onReorder={(items) => reorderWorkflowStatusesMutation.mutate({ items })}
          onUpdateTransitions={(input) => updateWorkflowTransitionsMutation.mutate(input)}
        />

        <section className={formLayout.section}>
          <SectionTitle icon={Store} title="店铺资料" />
          <div className={formLayout.grid}>
            <Field label="店铺名" htmlFor="store-name">
              <Input
                id="store-name"
                value={draft.store_name}
                onChange={(event) => setDraftField(setDraft, "store_name", event.target.value)}
              />
            </Field>
            <Field label="邮箱" htmlFor="store-email" icon={Mail}>
              <Input
                id="store-email"
                type="email"
                value={draft.store_email}
                onChange={(event) => setDraftField(setDraft, "store_email", event.target.value)}
              />
            </Field>
            <Field label="电话" htmlFor="store-phone" icon={Phone}>
              <Input
                id="store-phone"
                value={draft.store_phone}
                onChange={(event) => setDraftField(setDraft, "store_phone", event.target.value)}
              />
            </Field>
            <Field label="WhatsApp" htmlFor="store-whatsapp" icon={MessageSquare}>
              <Input
                id="store-whatsapp"
                value={draft.store_whatsapp}
                onChange={(event) => setDraftField(setDraft, "store_whatsapp", event.target.value)}
              />
            </Field>
          </div>
          <Field label="地址" htmlFor="store-address" className="mt-3">
            <Textarea
              id="store-address"
              rows={3}
              value={draft.store_address}
              onChange={(event) => setDraftField(setDraft, "store_address", event.target.value)}
            />
          </Field>
        </section>

        <section className={formLayout.section}>
          <SectionTitle icon={Settings2} title="默认规则" />
          <div className={formLayout.grid}>
            <Field label="维修默认质保" htmlFor="order-warranty">
              <Select
                value={String(draft.default_order_warranty_months)}
                onValueChange={(value) => {
                  const months = Number(value);
                  setDraft((current) =>
                    current
                      ? {
                          ...current,
                          default_order_warranty_months: months,
                          default_order_warranty_text: formatWarrantyText(months),
                        }
                      : current,
                  );
                }}
              >
                <SelectTrigger id="order-warranty">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {ORDER_WARRANTY_OPTIONS.map((option) => (
                    <SelectItem key={option.months} value={String(option.months)}>
                      {option.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </Field>
            <Field label="二手库存默认保修月数" htmlFor="inventory-warranty">
              <Input
                id="inventory-warranty"
                type="number"
                min={0}
                value={draft.default_inventory_warranty_months}
                onChange={(event) =>
                  setDraftField(
                    setDraft,
                    "default_inventory_warranty_months",
                    Math.max(0, Number(event.target.value || 0)),
                  )
                }
              />
            </Field>
          </div>
        </section>

        <section className={formLayout.section}>
          <SectionTitle icon={Printer} title="输出配置" />
          <div className="space-y-3">
            <Field label="打印页脚" htmlFor="print-footer">
              <Textarea
                id="print-footer"
                rows={3}
                value={draft.print_footer}
                onChange={(event) => setDraftField(setDraft, "print_footer", event.target.value)}
              />
            </Field>
            <Field label="客户消息签名" htmlFor="message-signature">
              <Textarea
                id="message-signature"
                rows={3}
                value={draft.message_signature}
                onChange={(event) =>
                  setDraftField(setDraft, "message_signature", event.target.value)
                }
              />
            </Field>
          </div>
        </section>

        <div className={formLayout.section}>
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
            <p className="text-xs text-muted-foreground">模板预览和客户通知会使用当前店铺资料。</p>
            <Button
              type="submit"
              style={brandGradientStyle}
              disabled={!hasChanges || saveMutation.isPending}
            >
              <Check className="mr-1.5 size-3.5" /> 保存设置
            </Button>
          </div>
        </div>
      </form>
    </main>
  );
}

const roleLabels: Record<string, string> = {
  owner: "店主",
  manager: "经理",
  technician: "技师",
  sales: "销售",
  viewer: "只读",
};

const workflowToneOptions: { value: OrderWorkflowTone; label: string }[] = [
  { value: "neutral", label: "中性" },
  { value: "info", label: "信息" },
  { value: "progress", label: "进行" },
  { value: "warn", label: "提醒" },
  { value: "success", label: "完成" },
  { value: "danger", label: "异常" },
];

const workflowBucketOptions: { value: OrderWorkflowBucket; label: string }[] = [
  "intake",
  "diagnosing",
  "quote",
  "parts",
  "repair",
  "pickup",
  "done",
  "cancelled",
  "custom",
].map((value) => {
  const bucket = value as OrderWorkflowBucket;
  return { value: bucket, label: getOrderWorkflowBucketLabel(bucket) };
});

function defaultNewStatusDraft(): OrderWorkflowStatusCreateInput {
  return {
    code: "",
    label: "",
    short_label: "",
    tone: "progress",
    bucket: "custom",
    enabled: true,
    show_in_order_filters: true,
    allowed_for_create: false,
    is_default_create_status: false,
  };
}

function OrderWorkflowSection({
  workflow,
  isLoading,
  isError,
  errorMessage,
  onRetry,
  isSaving,
  onCreateStatus,
  onUpdateStatus,
  onReorder,
  onUpdateTransitions,
}: {
  workflow?: OrderWorkflow;
  isLoading: boolean;
  isError: boolean;
  errorMessage: string;
  onRetry: () => void;
  isSaving: boolean;
  onCreateStatus: (input: OrderWorkflowStatusCreateInput) => void;
  onUpdateStatus: (id: string, input: Parameters<typeof updateOrderWorkflowStatus>[1]) => void;
  onReorder: (items: { id: string; sort_order: number }[]) => void;
  onUpdateTransitions: (input: OrderWorkflowTransitionsUpdateInput) => void;
}) {
  const statuses = useMemo(() => getWorkflowStatuses(workflow), [workflow]);
  const [newStatus, setNewStatus] = useState<OrderWorkflowStatusCreateInput>(defaultNewStatusDraft);
  const [fromStatusCode, setFromStatusCode] = useState("");
  const transitions = workflow?.transitions ?? [];

  useEffect(() => {
    if (fromStatusCode && statuses.some((status) => status.code === fromStatusCode)) return;
    setFromStatusCode(statuses[0]?.code ?? "");
  }, [fromStatusCode, statuses]);

  const moveStatus = (index: number, direction: -1 | 1) => {
    const next = [...statuses];
    const target = index + direction;
    if (target < 0 || target >= next.length) return;
    [next[index], next[target]] = [next[target], next[index]];
    onReorder(
      next.map((status, itemIndex) => ({ id: status.id, sort_order: (itemIndex + 1) * 10 })),
    );
  };

  const updateTransitionTarget = (
    toStatusCode: string,
    patch: { enabled?: boolean; is_primary?: boolean },
  ) => {
    if (!fromStatusCode) return;
    const nextTransitions = statuses
      .filter((status) => status.code !== fromStatusCode)
      .map((status, index) => {
        const current = transitions.find(
          (transition) =>
            transition.from_status_code === fromStatusCode &&
            transition.to_status_code === status.code,
        );
        const isTarget = status.code === toStatusCode;
        const enabled = isTarget
          ? (patch.enabled ?? current?.enabled ?? false)
          : Boolean(current?.enabled);
        return {
          to_status_code: status.code,
          enabled,
          is_primary: isTarget
            ? Boolean(enabled && (patch.is_primary ?? current?.is_primary))
            : Boolean(enabled && current?.is_primary && !patch.is_primary),
          sort_order: current?.sort_order ?? (index + 1) * 10,
        };
      });
    onUpdateTransitions({ from_status_code: fromStatusCode, transitions: nextTransitions });
  };

  return (
    <section className={formLayout.section}>
      <SectionTitle icon={GitBranch} title="工单状态流" />
      {isLoading ? (
        <div className="space-y-3">
          <Skeleton className="h-24 w-full" />
          <Skeleton className="h-40 w-full" />
        </div>
      ) : isError ? (
        <div className="rounded-md border border-status-danger-foreground/25 bg-status-danger/10 p-3">
          <div className="flex min-w-0 items-start gap-2">
            <AlertTriangle className="mt-0.5 size-4 shrink-0 text-status-danger-foreground" />
            <div className="min-w-0 flex-1">
              <div className="text-sm font-semibold">状态流未加载</div>
              <p className="mt-1 break-words text-xs text-muted-foreground">
                当前不能编辑工单状态流。请先确认数据库迁移已应用，或稍后重试。
                {errorMessage ? ` ${errorMessage}` : ""}
              </p>
            </div>
            <Button type="button" variant="outline" size="sm" className="h-8" onClick={onRetry}>
              重试
            </Button>
          </div>
        </div>
      ) : (
        <div className="space-y-4">
          <div className="grid gap-2 rounded-md border border-border/60 bg-surface-muted/30 p-2 md:grid-cols-[9rem_minmax(0,1fr)_7rem_8rem_6rem_auto]">
            <Input
              value={newStatus.code}
              onChange={(event) =>
                setNewStatus((current) => ({
                  ...current,
                  code: event.target.value.toLowerCase().replace(/[^a-z0-9_]/g, ""),
                }))
              }
              placeholder="status_code"
              className="h-8 text-xs"
            />
            <Input
              value={newStatus.label}
              onChange={(event) =>
                setNewStatus((current) => ({ ...current, label: event.target.value }))
              }
              placeholder="状态名称"
              className="h-8 text-xs"
            />
            <Input
              value={newStatus.short_label}
              onChange={(event) =>
                setNewStatus((current) => ({ ...current, short_label: event.target.value }))
              }
              placeholder="短标签"
              className="h-8 text-xs"
            />
            <Select
              value={newStatus.bucket}
              onValueChange={(bucket) =>
                setNewStatus((current) => ({
                  ...current,
                  bucket: bucket as OrderWorkflowBucket,
                }))
              }
            >
              <SelectTrigger className="h-8 text-xs">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {workflowBucketOptions.map((option) => (
                  <SelectItem key={option.value} value={option.value}>
                    {option.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select
              value={newStatus.tone}
              onValueChange={(tone) =>
                setNewStatus((current) => ({ ...current, tone: tone as OrderWorkflowTone }))
              }
            >
              <SelectTrigger className="h-8 text-xs">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {workflowToneOptions.map((option) => (
                  <SelectItem key={option.value} value={option.value}>
                    {option.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Button
              type="button"
              size="sm"
              disabled={isSaving || !newStatus.code.trim() || !newStatus.label.trim()}
              onClick={() => {
                onCreateStatus(newStatus);
                setNewStatus(defaultNewStatusDraft());
              }}
            >
              <Plus className="mr-1.5 size-3.5" /> 新增状态
            </Button>
          </div>

          <div className="space-y-2">
            {statuses.map((status, index) => (
              <div
                key={status.id}
                className="grid gap-2 rounded-md border border-border/60 bg-surface/60 p-2 md:grid-cols-[auto_8.5rem_5.5rem_7.5rem_6rem_repeat(4,auto)_auto]"
              >
                <div className="flex items-center gap-1">
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    className="size-7"
                    disabled={isSaving || index === 0}
                    onClick={() => moveStatus(index, -1)}
                    aria-label="上移状态"
                  >
                    <ArrowUp className="size-3.5" />
                  </Button>
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    className="size-7"
                    disabled={isSaving || index === statuses.length - 1}
                    onClick={() => moveStatus(index, 1)}
                    aria-label="下移状态"
                  >
                    <ArrowDown className="size-3.5" />
                  </Button>
                </div>
                <Input
                  defaultValue={status.label}
                  className="h-8 text-xs"
                  onBlur={(event) => {
                    const label = event.target.value.trim();
                    if (label && label !== status.label) onUpdateStatus(status.id, { label });
                  }}
                />
                <Input
                  defaultValue={status.short_label}
                  className="h-8 text-xs"
                  onBlur={(event) => {
                    const shortLabel = event.target.value.trim();
                    if (shortLabel !== status.short_label)
                      onUpdateStatus(status.id, { short_label: shortLabel });
                  }}
                />
                <Select
                  value={status.bucket}
                  onValueChange={(bucket) =>
                    onUpdateStatus(status.id, { bucket: bucket as OrderWorkflowBucket })
                  }
                >
                  <SelectTrigger className="h-8 text-xs">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {workflowBucketOptions.map((option) => (
                      <SelectItem key={option.value} value={option.value}>
                        {option.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Select
                  value={status.tone}
                  onValueChange={(tone) =>
                    onUpdateStatus(status.id, { tone: tone as OrderWorkflowTone })
                  }
                >
                  <SelectTrigger className="h-8 text-xs">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {workflowToneOptions.map((option) => (
                      <SelectItem key={option.value} value={option.value}>
                        {option.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <WorkflowCheck
                  label="启用"
                  checked={status.enabled}
                  disabled={isSaving || status.is_default_create_status}
                  onChange={(checked) => onUpdateStatus(status.id, { enabled: checked })}
                />
                <WorkflowCheck
                  label="列表"
                  checked={status.show_in_order_filters}
                  disabled={isSaving}
                  onChange={(checked) =>
                    onUpdateStatus(status.id, { show_in_order_filters: checked })
                  }
                />
                <WorkflowCheck
                  label="新建"
                  checked={status.allowed_for_create}
                  disabled={isSaving || status.is_default_create_status}
                  onChange={(checked) => onUpdateStatus(status.id, { allowed_for_create: checked })}
                />
                <WorkflowCheck
                  label="默认"
                  checked={status.is_default_create_status}
                  disabled={isSaving || status.is_default_create_status || !status.enabled}
                  onChange={(checked) =>
                    checked && onUpdateStatus(status.id, { is_default_create_status: true })
                  }
                />
                <div className="flex min-w-0 items-center justify-end gap-2">
                  <code className="truncate rounded bg-surface-muted px-1.5 py-1 text-[10px] text-muted-foreground">
                    {status.code}
                  </code>
                  {status.is_system ? (
                    <Badge variant="outline" className="shrink-0 text-[10px]">
                      系统
                    </Badge>
                  ) : null}
                </div>
              </div>
            ))}
          </div>

          <div className="rounded-md border border-border/60 bg-surface-muted/30 p-3">
            <div className="mb-3 grid gap-2 sm:grid-cols-[12rem_minmax(0,1fr)] sm:items-center">
              <Field label="来源状态" htmlFor="workflow-from-status">
                <Select value={fromStatusCode} onValueChange={setFromStatusCode}>
                  <SelectTrigger id="workflow-from-status" className="h-8 text-xs">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {statuses.map((status) => (
                      <SelectItem key={status.code} value={status.code}>
                        {status.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </Field>
              <p className="text-xs text-muted-foreground">
                勾选允许从该状态流转到的目标状态；“主”会成为列表和详情的推荐下一步。
              </p>
            </div>
            <div className="grid gap-1.5 sm:grid-cols-2 lg:grid-cols-3">
              {statuses
                .filter((status) => status.code !== fromStatusCode)
                .map((status) => {
                  const transition = transitions.find(
                    (item) =>
                      item.from_status_code === fromStatusCode &&
                      item.to_status_code === status.code,
                  );
                  const enabled = Boolean(transition?.enabled);
                  return (
                    <div
                      key={status.code}
                      className="flex min-w-0 items-center justify-between gap-2 rounded-md border bg-surface px-2 py-1.5"
                    >
                      <Checkbox
                        checked={enabled}
                        disabled={isSaving}
                        onCheckedChange={(checked) =>
                          updateTransitionTarget(status.code, { enabled: Boolean(checked) })
                        }
                      />
                      <span className="min-w-0 flex-1 truncate text-xs">{status.label}</span>
                      <Button
                        type="button"
                        variant={transition?.is_primary ? "default" : "outline"}
                        size="sm"
                        className="h-7 px-2 text-[11px]"
                        disabled={isSaving || !enabled}
                        onClick={() =>
                          updateTransitionTarget(status.code, {
                            enabled: true,
                            is_primary: true,
                          })
                        }
                      >
                        主
                      </Button>
                    </div>
                  );
                })}
            </div>
          </div>
        </div>
      )}
    </section>
  );
}

function WorkflowCheck({
  label,
  checked,
  disabled,
  onChange,
}: {
  label: string;
  checked: boolean;
  disabled?: boolean;
  onChange: (checked: boolean) => void;
}) {
  return (
    <label className="flex items-center gap-1.5 text-xs text-muted-foreground">
      <Checkbox
        checked={checked}
        disabled={disabled}
        onCheckedChange={(value) => onChange(Boolean(value))}
      />
      {label}
    </label>
  );
}

function StoreMembersSection({
  members,
  invitations,
  isLoading,
  inviteDraft,
  isInviting,
  onInviteDraftChange,
  onInvite,
}: {
  members: {
    id: string;
    email: string;
    display_name?: string;
    role: string;
    status: string;
  }[];
  invitations: { id: string; email: string; role: string; expires_at: string }[];
  isLoading: boolean;
  inviteDraft: StoreInviteInput;
  isInviting: boolean;
  onInviteDraftChange: React.Dispatch<React.SetStateAction<StoreInviteInput>>;
  onInvite: () => void;
}) {
  return (
    <section className={formLayout.section}>
      <SectionTitle icon={Users} title="成员权限" />
      {isLoading ? (
        <div className="space-y-3">
          <Skeleton className="h-10 w-full" />
          <Skeleton className="h-20 w-full" />
        </div>
      ) : (
        <div className="space-y-4">
          <div className="grid gap-3 md:grid-cols-[minmax(0,1fr)_12rem_auto]">
            <Field label="员工邮箱" htmlFor="invite-email">
              <Input
                id="invite-email"
                type="email"
                value={inviteDraft.email}
                onChange={(event) =>
                  onInviteDraftChange((current) => ({ ...current, email: event.target.value }))
                }
                onKeyDown={(event) => {
                  if (event.key === "Enter") {
                    event.preventDefault();
                    onInvite();
                  }
                }}
              />
            </Field>
            <Field label="角色" htmlFor="invite-role">
              <Select
                value={inviteDraft.role}
                onValueChange={(role) =>
                  onInviteDraftChange((current) => ({
                    ...current,
                    role: role as StoreInviteInput["role"],
                  }))
                }
              >
                <SelectTrigger id="invite-role">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {(["manager", "technician", "sales", "viewer"] as const).map((role) => (
                    <SelectItem key={role} value={role}>
                      {roleLabels[role]}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </Field>
            <div className="flex items-end">
              <Button
                type="button"
                variant="outline"
                disabled={isInviting || inviteDraft.email.trim().length < 3}
                onClick={onInvite}
              >
                <UserPlus className="mr-1.5 size-3.5" /> 邀请
              </Button>
            </div>
          </div>

          <div className="grid gap-2">
            {members.map((member) => (
              <div
                key={member.id}
                className="flex min-h-12 flex-col justify-center gap-1 rounded-md border border-border px-3 py-2 sm:flex-row sm:items-center sm:justify-between"
              >
                <div className="min-w-0">
                  <p className="truncate text-sm font-medium">
                    {member.display_name || member.email}
                  </p>
                  <p className="truncate text-xs text-muted-foreground">{member.email}</p>
                </div>
                <Badge variant={member.role === "owner" ? "default" : "outline"}>
                  {roleLabels[member.role] ?? member.role}
                </Badge>
              </div>
            ))}
          </div>

          {invitations.length ? (
            <div className="grid gap-2">
              {invitations.map((invitation) => (
                <div
                  key={invitation.id}
                  className="flex min-h-11 flex-col justify-center gap-1 rounded-md border border-dashed border-border px-3 py-2 sm:flex-row sm:items-center sm:justify-between"
                >
                  <p className="truncate text-sm">{invitation.email}</p>
                  <div className="flex flex-wrap items-center gap-2">
                    <Badge variant="outline">
                      {roleLabels[invitation.role] ?? invitation.role}
                    </Badge>
                    <span className="text-xs text-muted-foreground">
                      {formatDate(invitation.expires_at)}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          ) : null}
        </div>
      )}
    </section>
  );
}

function StoreManagementSection({
  activeStoreId,
  stores,
  isLoading,
  isSwitching,
  isCreating,
  newStoreName,
  onNewStoreNameChange,
  onSwitchStore,
  onCreateStore,
}: {
  activeStoreId?: string;
  stores: { id: string; name: string; slug: string; role: string }[];
  isLoading: boolean;
  isSwitching: boolean;
  isCreating: boolean;
  newStoreName: string;
  onNewStoreNameChange: (value: string) => void;
  onSwitchStore: (storeId: string) => void;
  onCreateStore: () => void;
}) {
  return (
    <section className={formLayout.section}>
      <SectionTitle icon={Store} title="店铺管理" />
      {isLoading ? (
        <div className="grid gap-3 md:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
          <Skeleton className="h-10 w-full" />
          <Skeleton className="h-10 w-full" />
        </div>
      ) : (
        <div className="grid gap-3 md:grid-cols-[minmax(0,1.1fr)_minmax(0,0.9fr)]">
          <Field label="当前店铺" htmlFor="active-store">
            <Select
              value={activeStoreId}
              onValueChange={onSwitchStore}
              disabled={isSwitching || stores.length === 0}
            >
              <SelectTrigger id="active-store">
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
          </Field>
          <Field label="新增店铺" htmlFor="new-store">
            <div className="flex flex-col gap-2 sm:flex-row">
              <Input
                id="new-store"
                value={newStoreName}
                onChange={(event) => onNewStoreNameChange(event.target.value)}
                onKeyDown={(event) => {
                  if (event.key === "Enter") {
                    event.preventDefault();
                    onCreateStore();
                  }
                }}
              />
              <Button
                type="button"
                variant="outline"
                disabled={isCreating || newStoreName.trim().length < 2}
                onClick={onCreateStore}
              >
                <Plus className="mr-1.5 size-3.5" /> 新建
              </Button>
            </div>
          </Field>
          <div className="flex flex-wrap gap-2 md:col-span-2">
            {stores.map((store) => (
              <Badge
                key={store.id}
                variant={store.id === activeStoreId ? "default" : "outline"}
                className="max-w-full gap-1"
              >
                <span className="truncate">{store.name}</span>
                <span className="text-[10px] uppercase opacity-70">{store.role}</span>
              </Badge>
            ))}
          </div>
        </div>
      )}
    </section>
  );
}

function SectionTitle({ icon: Icon, title }: { icon: typeof Store; title: string }) {
  return (
    <div className={formLayout.sectionHeader}>
      <div className="flex items-center gap-2">
        <Icon className="size-4 text-primary" />
        <h2 className={formLayout.sectionTitle}>{title}</h2>
      </div>
    </div>
  );
}

function Field({
  label,
  htmlFor,
  icon: Icon,
  className,
  children,
}: {
  label: string;
  htmlFor: string;
  icon?: typeof Store;
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <div className={cn(formLayout.field, className)}>
      <Label htmlFor={htmlFor} className={formLayout.label}>
        <span className="inline-flex items-center gap-1.5">
          {Icon ? <Icon className="size-3.5 text-muted-foreground" /> : null}
          {label}
        </span>
      </Label>
      {children}
    </div>
  );
}

function SettingsLoading() {
  return (
    <main className={pageShell.form}>
      <div className={pageHeader.root}>
        <div>
          <Skeleton className="h-3 w-40" />
          <Skeleton className="mt-3 h-8 w-44" />
          <Skeleton className="mt-2 h-4 w-72" />
        </div>
      </div>
      <div className="mt-5 space-y-4">
        <Skeleton className="h-48 w-full" />
        <Skeleton className="h-32 w-full" />
        <Skeleton className="h-52 w-full" />
      </div>
    </main>
  );
}

function toDraft(settings: StoreSettings): SettingsDraft {
  return {
    store_name: settings.store_name,
    store_address: settings.store_address,
    store_phone: settings.store_phone,
    store_whatsapp: settings.store_whatsapp,
    store_email: settings.store_email,
    default_order_warranty_text: settings.default_order_warranty_text,
    default_order_warranty_months: settings.default_order_warranty_months,
    default_inventory_warranty_months: settings.default_inventory_warranty_months,
    print_footer: settings.print_footer,
    message_signature: settings.message_signature,
  };
}

function setDraftField<K extends keyof SettingsDraft>(
  setDraft: React.Dispatch<React.SetStateAction<SettingsDraft | null>>,
  key: K,
  value: SettingsDraft[K],
) {
  setDraft((current) => (current ? { ...current, [key]: value } : current));
}

function formatDate(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  return new Intl.DateTimeFormat("zh-CN", { month: "2-digit", day: "2-digit" }).format(date);
}
