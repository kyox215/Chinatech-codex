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
  ShieldCheck,
  Store,
  UserRound,
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
import { customersKeys } from "@/features/customers/api/query-keys";
import { inventoryKeys } from "@/features/inventory/api/query-keys";
import { messageSettingsKeys } from "@/features/messages/api/query-keys";
import { ordersKeys } from "@/features/orders/api/query-keys";
import { platformKeys } from "@/features/platform/api/query-keys";
import { formatWarrantyText, ORDER_WARRANTY_OPTIONS } from "@/features/orders/model/order-warranty";
import {
  getOrderWorkflowBucketLabel,
  getWorkflowStatuses,
} from "@/features/orders/model/order-workflow";
import {
  buildStoreMessagePreview,
  buildStorePrintPreview,
  getStoreSettingsReadiness,
  type StoreSettingsReadiness,
} from "@/features/settings/model/store-settings-readiness";
import { storesKeys } from "@/features/stores/api/query-keys";
import {
  RepairOsBusinessCard,
  RepairOsHeaderActionButton,
  RepairOsListScaffold,
  RepairOsMetricStrip,
  RepairOsSectionHeader,
} from "@/shared/ui";
import {
  createStore,
  approveStoreAccessRequest,
  createOrderWorkflowStatus,
  createStoreInviteLink,
  getOnboardingStatus,
  getStoreMembers,
  getStoreContext,
  getStoreSettings,
  inviteStoreMember,
  listStoreAccessRequests,
  listOrderWorkflow,
  rejectStoreAccessRequest,
  revokeStoreInviteLink,
  revokeStoreInvitation,
  reorderOrderWorkflowStatuses,
  switchStore,
  updateAccountProfile,
  updateOrderWorkflowStatus,
  updateOrderWorkflowTransitions,
  updateStoreSettings,
  type OnboardingStatus,
  type OnboardingRequest,
  type OrderWorkflow,
  type OrderWorkflowBucket,
  type OrderWorkflowStatusCreateInput,
  type OrderWorkflowTone,
  type OrderWorkflowTransitionsUpdateInput,
  type StoreInviteLinkCreateInput,
  type StoreInviteInput,
  type StoreSettings,
} from "@/lib/repairdesk/api";
import { CACHE_TIMES } from "@/lib/query-performance";
import { cn } from "@/lib/utils";
import { brandGradientStyle, formLayout, repairOs } from "@/lib/ui-patterns";

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
  const storeContextQuery = useQuery({
    queryKey: storesKeys.context,
    queryFn: ({ signal }) => getStoreContext({ signal }),
    staleTime: CACHE_TIMES.shell,
  });
  const activeStoreId = storeContextQuery.data?.activeStore?.id;
  const settingsQuery = useQuery({
    queryKey: messageSettingsKeys.storeScoped(activeStoreId),
    queryFn: ({ signal }) => getStoreSettings({ signal }),
    staleTime: CACHE_TIMES.settings,
  });
  const storeMembersQuery = useQuery({
    queryKey: storesKeys.membersScoped(activeStoreId),
    queryFn: ({ signal }) => getStoreMembers({ signal }),
    staleTime: CACHE_TIMES.settings,
  });
  const storeAccessRequestsQuery = useQuery({
    queryKey: storesKeys.accessRequestsScoped(activeStoreId),
    queryFn: ({ signal }) => listStoreAccessRequests({ signal }),
    staleTime: CACHE_TIMES.settings,
    enabled:
      storeContextQuery.data?.activeStore?.role === "owner" ||
      storeContextQuery.data?.activeStore?.role === "manager",
  });
  const workflowQuery = useQuery({
    queryKey: ordersKeys.workflow(activeStoreId),
    queryFn: ({ signal }) => listOrderWorkflow({ signal }),
    staleTime: CACHE_TIMES.workflow,
  });
  const accountQuery = useQuery({
    queryKey: platformKeys.onboardingStatus,
    queryFn: ({ signal }) => getOnboardingStatus({ signal }),
    staleTime: CACHE_TIMES.shell,
    retry: false,
  });
  const settingsData = settingsQuery.data;
  const [draft, setDraft] = useState<SettingsDraft | null>(null);
  const [accountNameDraft, setAccountNameDraft] = useState("");
  const [newStoreName, setNewStoreName] = useState("");
  const [inviteDraft, setInviteDraft] = useState<StoreInviteInput>({
    email: "",
    role: "technician",
  });
  const [inviteLinkDraft, setInviteLinkDraft] = useState<StoreInviteLinkCreateInput>({
    label: "",
    role: "technician",
    expires_in_days: 7,
    max_uses: 1,
  });
  const [latestInviteCode, setLatestInviteCode] = useState("");

  useEffect(() => {
    if (!settingsData) return;
    setDraft(toDraft(settingsData));
  }, [settingsData]);

  useEffect(() => {
    if (!accountQuery.data) return;
    setAccountNameDraft(accountQuery.data.displayName);
  }, [accountQuery.data]);

  const hasChanges = useMemo(() => {
    if (!draft || !settingsData) return false;
    const current = toDraft(settingsData);
    return JSON.stringify(current) !== JSON.stringify(draft);
  }, [draft, settingsData]);
  const accountName = accountNameDraft.trim().replace(/\s+/g, " ");
  const hasAccountNameChange = Boolean(
    accountQuery.data && accountName && accountName !== accountQuery.data.displayName,
  );

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
  const updateAccountMutation = useMutation({
    mutationFn: async () => updateAccountProfile({ display_name: accountName }),
    onSuccess: async (status) => {
      toast.success("账号名称已保存");
      setAccountNameDraft(status.displayName);
      queryClient.setQueryData(platformKeys.onboardingStatus, status);
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: platformKeys.onboardingStatus }),
        queryClient.invalidateQueries({ queryKey: storesKeys.members }),
        queryClient.invalidateQueries({ queryKey: storesKeys.context }),
        queryClient.invalidateQueries({ queryKey: ordersKeys.lists() }),
        queryClient.invalidateQueries({ queryKey: ordersKeys.options() }),
      ]);
    },
    onError: (error) => toast.error(error instanceof Error ? error.message : "账号名称保存失败"),
  });
  const switchStoreMutation = useMutation({
    mutationFn: switchStore,
    onSuccess: async (context) => {
      toast.success(`已切换到 ${context.activeStore?.name ?? "店铺"}`);
      queryClient.removeQueries({ queryKey: ordersKeys.all });
      queryClient.removeQueries({ queryKey: customersKeys.all });
      queryClient.removeQueries({ queryKey: inventoryKeys.all });
      queryClient.removeQueries({ queryKey: messageSettingsKeys.store });
      queryClient.removeQueries({ queryKey: messageSettingsKeys.templates });
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: storesKeys.context }),
        queryClient.invalidateQueries({ queryKey: platformKeys.onboardingStatus }),
      ]);
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
  const createInviteLinkMutation = useMutation({
    mutationFn: createStoreInviteLink,
    onSuccess: async (result) => {
      toast.success("邀请码已生成，请复制保存");
      setLatestInviteCode(result.code);
      setInviteLinkDraft((current) => ({ ...current, label: "" }));
      await queryClient.invalidateQueries({ queryKey: storesKeys.members });
    },
    onError: (error) => toast.error(error instanceof Error ? error.message : "生成邀请码失败"),
  });
  const revokeInviteLinkMutation = useMutation({
    mutationFn: revokeStoreInviteLink,
    onSuccess: async () => {
      toast.success("邀请码已撤销");
      await queryClient.invalidateQueries({ queryKey: storesKeys.members });
    },
    onError: (error) => toast.error(error instanceof Error ? error.message : "撤销邀请码失败"),
  });
  const revokeInvitationMutation = useMutation({
    mutationFn: revokeStoreInvitation,
    onSuccess: async () => {
      toast.success("邀请已撤销");
      await queryClient.invalidateQueries({ queryKey: storesKeys.members });
    },
    onError: (error) => toast.error(error instanceof Error ? error.message : "撤销邀请失败"),
  });
  const approveAccessRequestMutation = useMutation({
    mutationFn: approveStoreAccessRequest,
    onSuccess: async () => {
      toast.success("加入申请已批准");
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: storesKeys.accessRequests }),
        queryClient.invalidateQueries({ queryKey: storesKeys.members }),
        queryClient.invalidateQueries({ queryKey: platformKeys.onboardingStatus }),
      ]);
    },
    onError: (error) => toast.error(error instanceof Error ? error.message : "批准失败"),
  });
  const rejectAccessRequestMutation = useMutation({
    mutationFn: rejectStoreAccessRequest,
    onSuccess: async () => {
      toast.success("加入申请已拒绝");
      await queryClient.invalidateQueries({ queryKey: storesKeys.accessRequests });
    },
    onError: (error) => toast.error(error instanceof Error ? error.message : "拒绝失败"),
  });
  const createWorkflowStatusMutation = useMutation({
    mutationFn: createOrderWorkflowStatus,
    onSuccess: async () => {
      toast.success("状态已新增");
      await queryClient.invalidateQueries({ queryKey: ordersKeys.workflow() });
      await queryClient.invalidateQueries({ queryKey: ordersKeys.lists() });
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
      await queryClient.invalidateQueries({ queryKey: ordersKeys.lists() });
    },
    onError: (error) => toast.error(error instanceof Error ? error.message : "保存状态失败"),
  });
  const reorderWorkflowStatusesMutation = useMutation({
    mutationFn: reorderOrderWorkflowStatuses,
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ordersKeys.workflow() });
      await queryClient.invalidateQueries({ queryKey: ordersKeys.lists() });
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

  if (settingsQuery.isError) {
    return (
      <RepairOsListScaffold
        title="设置"
        subtitle="读取失败"
        eyebrow="系统 / 设置"
        chips={[
          { key: "stores", label: "店铺", shortLabel: "店", count: "-" },
          { key: "members", label: "成员", shortLabel: "员", count: "-" },
          { key: "workflow", label: "状态流", shortLabel: "流", count: "-" },
        ]}
      >
        <RepairOsBusinessCard
          as="div"
          data-ui="settings-load-error"
          className="mx-auto mt-16 grid max-w-sm grid-cols-[auto_minmax(0,1fr)] items-center gap-3 rounded-xl border-status-danger-foreground/25 bg-status-danger/10 px-4 py-3 text-status-danger-foreground shadow-[var(--shadow-card)] hover:bg-status-danger/10 sm:grid-cols-[auto_minmax(0,1fr)_auto]"
          leading={
            <span className="grid size-9 place-items-center rounded-lg bg-status-danger/10">
              <Settings2 className="size-4" />
            </span>
          }
          trailing={
            <Button
              type="button"
              size="sm"
              variant="outline"
              className="h-8 bg-card"
              onClick={() => settingsQuery.refetch()}
            >
              重新加载
            </Button>
          }
          leadingClassName="self-center"
          trailingClassName="col-span-2 justify-self-start sm:col-span-1 sm:justify-self-end"
          aria-live="polite"
        >
          <span className="block text-sm font-semibold">读取系统设置失败</span>
          <span className="mt-0.5 block text-[11px] leading-4 text-status-danger-foreground/80">
            请重新加载设置数据后继续编辑。
          </span>
        </RepairOsBusinessCard>
      </RepairOsListScaffold>
    );
  }

  if (settingsQuery.isLoading || !draft) {
    return <SettingsLoading />;
  }

  const storeCount = storeContextQuery.data?.stores.length ?? 0;
  const memberCount = storeMembersQuery.data?.members.length ?? 0;
  const workflowStatusCount = getWorkflowStatuses(workflowQuery.data).length;
  const storeReadiness = getStoreSettingsReadiness(draft);
  const messagePreview = buildStoreMessagePreview(draft);
  const printPreview = buildStorePrintPreview(draft);

  return (
    <RepairOsListScaffold
      title="设置"
      subtitle={`${storeCount} 店铺 · ${memberCount} 成员`}
      eyebrow="系统 / 设置"
      action={
        <RepairOsHeaderActionButton
          ariaLabel="保存设置"
          disabled={!hasChanges || saveMutation.isPending}
          onClick={() => saveMutation.mutate()}
        >
          <Check className="size-4" />
        </RepairOsHeaderActionButton>
      }
      chips={[
        { key: "stores", label: "店铺", shortLabel: "店", count: storeCount },
        { key: "members", label: "成员", shortLabel: "员", count: memberCount },
        { key: "workflow", label: "状态流", shortLabel: "流", count: workflowStatusCount },
      ]}
      desktopAction={
        <Button
          size="sm"
          className="h-8 shrink-0 gap-1.5 border-0 text-primary-foreground sm:h-9"
          style={brandGradientStyle}
          disabled={!hasChanges || saveMutation.isPending}
          onClick={() => saveMutation.mutate()}
        >
          <Check className="size-3.5" /> 保存
        </Button>
      }
      desktopHeaderAddon={
        <RepairOsMetricStrip
          metrics={[
            { label: "店铺", value: storeCount, hint: "可切换", icon: Store, tone: "blue" },
            { label: "成员", value: memberCount, hint: "权限", icon: Users, tone: "green" },
            {
              label: "状态流",
              value: workflowStatusCount,
              hint: "工单",
              icon: GitBranch,
              tone: "amber",
            },
          ]}
        />
      }
      className="pb-8"
    >
      <form
        className="mt-3 space-y-3 pb-8 sm:mt-4"
        onSubmit={(event) => {
          event.preventDefault();
          if (hasChanges && !saveMutation.isPending) saveMutation.mutate();
        }}
      >
        <div className="grid min-w-0 gap-3 xl:grid-cols-[minmax(0,0.95fr)_minmax(0,1.05fr)] xl:items-start">
          <div className="min-w-0 space-y-3">
            <AccountProfileSection
              status={accountQuery.data}
              isLoading={accountQuery.isLoading}
              nameDraft={accountNameDraft}
              hasNameChange={hasAccountNameChange}
              isSaving={updateAccountMutation.isPending}
              onNameDraftChange={setAccountNameDraft}
              onSave={() => {
                if (!hasAccountNameChange || updateAccountMutation.isPending) return;
                updateAccountMutation.mutate();
              }}
            />
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
              inviteLinks={storeMembersQuery.data?.invite_links ?? []}
              accessRequests={storeAccessRequestsQuery.data ?? []}
              isLoading={storeMembersQuery.isLoading}
              isAccessRequestsLoading={storeAccessRequestsQuery.isLoading}
              inviteDraft={inviteDraft}
              inviteLinkDraft={inviteLinkDraft}
              latestInviteCode={latestInviteCode}
              isInviting={inviteMemberMutation.isPending}
              isCreatingInviteLink={createInviteLinkMutation.isPending}
              isRevokingInvitation={revokeInvitationMutation.isPending}
              isRevokingInviteLink={revokeInviteLinkMutation.isPending}
              isReviewingAccessRequest={
                approveAccessRequestMutation.isPending || rejectAccessRequestMutation.isPending
              }
              onInviteDraftChange={setInviteDraft}
              onInviteLinkDraftChange={setInviteLinkDraft}
              onInvite={() => {
                const email = inviteDraft.email.trim();
                if (!email) return;
                inviteMemberMutation.mutate({ ...inviteDraft, email });
              }}
              onCreateInviteLink={() => {
                createInviteLinkMutation.mutate({
                  ...inviteLinkDraft,
                  label: inviteLinkDraft.label?.trim() || undefined,
                });
              }}
              onRevokeInvitation={(id) => revokeInvitationMutation.mutate({ id })}
              onRevokeInviteLink={(id) => revokeInviteLinkMutation.mutate({ id })}
              onCopyInviteCode={() => {
                if (!latestInviteCode) return;
                void navigator.clipboard?.writeText(latestInviteCode);
                toast.success("邀请码已复制");
              }}
              onApproveAccessRequest={(id) => approveAccessRequestMutation.mutate({ id })}
              onRejectAccessRequest={(id) =>
                rejectAccessRequestMutation.mutate({ id, note: "店铺负责人拒绝加入申请" })
              }
            />
            <StoreReadinessSection
              readiness={storeReadiness}
              messagePreview={messagePreview}
              printPreview={printPreview}
            />
          </div>

          <div className="min-w-0 space-y-3">
            <section className={repairOs.adminSection}>
              <RepairOsSectionHeader icon={Store} iconFrame={false} title="店铺资料" />
              <div className={formLayout.grid}>
                <Field label="店铺名" htmlFor="store-name">
                  <Input
                    id="store-name"
                    className={compactControlClass}
                    value={draft.store_name}
                    onChange={(event) => setDraftField(setDraft, "store_name", event.target.value)}
                  />
                </Field>
                <Field label="邮箱" htmlFor="store-email" icon={Mail}>
                  <Input
                    id="store-email"
                    type="email"
                    className={compactControlClass}
                    value={draft.store_email}
                    onChange={(event) => setDraftField(setDraft, "store_email", event.target.value)}
                  />
                </Field>
                <Field label="电话" htmlFor="store-phone" icon={Phone}>
                  <Input
                    id="store-phone"
                    className={compactControlClass}
                    value={draft.store_phone}
                    onChange={(event) => setDraftField(setDraft, "store_phone", event.target.value)}
                  />
                </Field>
                <Field label="WhatsApp" htmlFor="store-whatsapp" icon={MessageSquare}>
                  <Input
                    id="store-whatsapp"
                    className={compactControlClass}
                    value={draft.store_whatsapp}
                    onChange={(event) =>
                      setDraftField(setDraft, "store_whatsapp", event.target.value)
                    }
                  />
                </Field>
              </div>
              <Field label="地址" htmlFor="store-address" className="mt-3">
                <Textarea
                  id="store-address"
                  rows={3}
                  className={compactTextareaClass}
                  value={draft.store_address}
                  onChange={(event) => setDraftField(setDraft, "store_address", event.target.value)}
                />
              </Field>
            </section>

            <section className={repairOs.adminSection}>
              <RepairOsSectionHeader icon={Settings2} iconFrame={false} title="默认规则" />
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
                    <SelectTrigger id="order-warranty" className={compactControlClass}>
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
                    className={compactControlClass}
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

            <section className={repairOs.adminSection}>
              <RepairOsSectionHeader icon={Printer} iconFrame={false} title="输出配置" />
              <div className="space-y-3">
                <Field label="打印页脚" htmlFor="print-footer">
                  <Textarea
                    id="print-footer"
                    rows={3}
                    className={compactTextareaClass}
                    value={draft.print_footer}
                    onChange={(event) =>
                      setDraftField(setDraft, "print_footer", event.target.value)
                    }
                  />
                </Field>
                <Field label="客户消息签名" htmlFor="message-signature">
                  <Textarea
                    id="message-signature"
                    rows={3}
                    className={compactTextareaClass}
                    value={draft.message_signature}
                    onChange={(event) =>
                      setDraftField(setDraft, "message_signature", event.target.value)
                    }
                  />
                </Field>
              </div>
            </section>
          </div>
        </div>

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

        <div className={repairOs.adminSection}>
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
            <p className="text-xs text-muted-foreground">模板预览和客户通知会使用当前店铺资料。</p>
            <Button
              type="submit"
              size="sm"
              className="h-8 gap-1.5"
              style={brandGradientStyle}
              disabled={!hasChanges || saveMutation.isPending}
            >
              <Check className="mr-1.5 size-3.5" /> 保存设置
            </Button>
          </div>
        </div>
      </form>
    </RepairOsListScaffold>
  );
}

const roleLabels: Record<string, string> = {
  owner: "店主",
  manager: "经理",
  technician: "技师",
  sales: "销售",
  viewer: "只读",
};

const accountRoleLabels: Record<string, string> = {
  owner: "最高管理员",
  manager: "管理员",
  technician: "技师",
  sales: "前台",
  viewer: "只读账号",
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

const compactControlClass = "h-8 text-sm sm:h-9";
const compactTextareaClass = "min-h-20 text-sm";

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

function AccountProfileSection({
  status,
  isLoading,
  nameDraft,
  hasNameChange,
  isSaving,
  onNameDraftChange,
  onSave,
}: {
  status?: OnboardingStatus;
  isLoading: boolean;
  nameDraft: string;
  hasNameChange: boolean;
  isSaving: boolean;
  onNameDraftChange: (value: string) => void;
  onSave: () => void;
}) {
  const accountRole = status?.activeStore?.role;
  const roleLabel = status?.isPlatformAdmin
    ? "最高管理员"
    : accountRole
      ? (accountRoleLabels[accountRole] ?? accountRole)
      : "未加入店铺";

  return (
    <section id="settings-account" className={cn(repairOs.adminSection, "p-2.5 sm:p-3")}>
      <RepairOsSectionHeader icon={UserRound} iconFrame={false} title="我的账号" />
      {isLoading ? (
        <div className="grid gap-2 md:grid-cols-[minmax(0,1fr)_10rem_auto]">
          <Skeleton className="h-10 w-full" />
          <Skeleton className="h-10 w-full" />
          <Skeleton className="h-10 w-full" />
        </div>
      ) : (
        <div className="space-y-2">
          <div className="grid gap-2 md:grid-cols-[minmax(0,1fr)_10rem_auto] md:items-end">
            <Field label="显示名称" htmlFor="account-display-name" icon={UserRound}>
              <Input
                id="account-display-name"
                className={compactControlClass}
                value={nameDraft}
                maxLength={60}
                placeholder="输入自己的名字"
                onChange={(event) => onNameDraftChange(event.target.value)}
                onKeyDown={(event) => {
                  if (event.key === "Enter") {
                    event.preventDefault();
                    onSave();
                  }
                }}
              />
            </Field>
            <div className="rounded-lg border border-[var(--border-panel)] bg-[var(--surface-panel-muted)] px-2 py-1.5">
              <div className="flex min-w-0 items-center justify-between gap-2">
                <span className="truncate text-[10px] font-medium leading-3 text-muted-foreground">
                  账号性质
                </span>
                <Badge variant="outline" className="h-5 shrink-0 gap-1 px-1.5 text-[9px]">
                  <ShieldCheck className="size-3" />
                  {roleLabel}
                </Badge>
              </div>
              <p className="mt-1 truncate text-[10px] leading-3 text-muted-foreground">
                权限决定，不在这里修改
              </p>
            </div>
            <Button
              type="button"
              size="sm"
              className="h-8 gap-1.5"
              style={brandGradientStyle}
              disabled={!hasNameChange || isSaving}
              onClick={onSave}
            >
              <Check className="size-3.5" /> 保存名称
            </Button>
          </div>
          <p className="text-[11px] leading-4 text-muted-foreground">
            名称会用于新建工单、操作记录、成员列表和页面账号信息；账号性质由权限自动显示。
          </p>
        </div>
      )}
    </section>
  );
}

function StoreReadinessSection({
  readiness,
  messagePreview,
  printPreview,
}: {
  readiness: StoreSettingsReadiness;
  messagePreview: string;
  printPreview: string;
}) {
  return (
    <section className={cn(repairOs.adminSection, "p-2.5 sm:p-3")}>
      <RepairOsSectionHeader icon={MessageSquare} iconFrame={false} title="通知资料完整度" />
      <div className="grid gap-2 2xl:grid-cols-[minmax(0,0.9fr)_minmax(0,1.1fr)]">
        <div className="min-w-0 rounded-lg border border-[var(--border-panel)] bg-[var(--surface-panel-muted)] p-2.5">
          <div className="flex min-w-0 items-center justify-between gap-2">
            <div className="min-w-0">
              <div className="truncate text-sm font-semibold">客户通知与打印资料</div>
              <div className="text-[11px] text-muted-foreground">
                {readiness.completedCount}/{readiness.totalCount} 项已完成
              </div>
            </div>
            <Badge
              variant="outline"
              className={cn("shrink-0", readinessBadgeClass(readiness.tone))}
            >
              {readiness.score}%
            </Badge>
          </div>
          <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-border/60">
            <div
              className={cn("h-full rounded-full", readinessProgressClass(readiness.tone))}
              style={{ width: `${readiness.score}%` }}
            />
          </div>
          <div className="mt-2 grid gap-1.5">
            {readiness.items.map((item) => (
              <RepairOsBusinessCard
                key={item.key}
                leading={
                  <span
                    className={cn(
                      "grid size-4 place-items-center rounded-full text-[10px]",
                      item.completed
                        ? "bg-status-success text-status-success-foreground"
                        : "bg-status-warn text-status-warn-foreground",
                    )}
                  >
                    {item.completed ? <Check className="size-3" /> : "!"}
                  </span>
                }
                className="grid-cols-[auto_minmax(0,1fr)] gap-2 rounded-md border-0 bg-card px-2 py-1.5 shadow-none"
                leadingClassName="mt-0.5"
              >
                <span className="min-w-0">
                  <span className="block truncate text-xs font-medium">{item.label}</span>
                  <span className="block truncate text-[11px] text-muted-foreground">
                    {item.hint}
                  </span>
                </span>
              </RepairOsBusinessCard>
            ))}
          </div>
          {readiness.missingLabels.length ? (
            <p className="mt-2 text-[11px] text-status-warn-foreground">
              建议补齐：{readiness.missingLabels.join("、")}
            </p>
          ) : null}
        </div>

        <div className="grid min-w-0 gap-2 sm:grid-cols-2 xl:grid-cols-1 2xl:grid-cols-2">
          <PreviewPanel title="客户消息预览" icon={MessageSquare} value={messagePreview} />
          <PreviewPanel title="打印页脚预览" icon={Printer} value={printPreview} />
        </div>
      </div>
    </section>
  );
}

function PreviewPanel({
  title,
  icon: Icon,
  value,
}: {
  title: string;
  icon: typeof Store;
  value: string;
}) {
  return (
    <div className="min-w-0 rounded-lg border border-[var(--border-panel)] bg-card p-2.5">
      <div className="mb-2 flex items-center gap-1.5 text-xs font-semibold">
        <Icon className="size-3.5 text-primary" />
        {title}
      </div>
      <pre className="max-h-40 min-w-0 whitespace-pre-wrap break-words rounded-md bg-[var(--surface-panel-muted)] p-2 text-[11px] leading-4 text-muted-foreground [overflow-wrap:anywhere]">
        {value}
      </pre>
    </div>
  );
}

function readinessBadgeClass(tone: StoreSettingsReadiness["tone"]) {
  if (tone === "ready") return "border-status-success-foreground/30 text-status-success-foreground";
  if (tone === "warning") return "border-status-warn-foreground/30 text-status-warn-foreground";
  return "border-status-danger-foreground/30 text-status-danger-foreground";
}

function readinessProgressClass(tone: StoreSettingsReadiness["tone"]) {
  if (tone === "ready") return "bg-status-success-foreground";
  if (tone === "warning") return "bg-status-warn-foreground";
  return "bg-status-danger-foreground";
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
    <section className={repairOs.adminSection}>
      <RepairOsSectionHeader icon={GitBranch} iconFrame={false} title="工单状态流" />
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
          <div className="grid gap-2 rounded-md border border-border/60 bg-surface-muted/30 p-2 lg:grid-cols-[9rem_minmax(0,1fr)_7rem_8rem_6rem_auto]">
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
              <div key={status.id}>
                <details className="rounded-lg border border-[var(--border-panel)] bg-card p-2 lg:hidden">
                  <summary className="flex min-w-0 cursor-pointer list-none items-center justify-between gap-2 [&::-webkit-details-marker]:hidden">
                    <span className="min-w-0">
                      <span className="block truncate text-sm font-semibold">{status.label}</span>
                      <span className="block truncate font-mono text-[10px] text-muted-foreground">
                        {status.code}
                      </span>
                    </span>
                    <span className="flex shrink-0 items-center gap-1">
                      <Badge variant="outline" className="text-[10px]">
                        {getOrderWorkflowBucketLabel(status.bucket)}
                      </Badge>
                      {status.is_system ? (
                        <Badge variant="outline" className="text-[10px]">
                          系统
                        </Badge>
                      ) : null}
                    </span>
                  </summary>
                  <div className="mt-2 grid gap-2">
                    <WorkflowStatusFields
                      status={status}
                      index={index}
                      total={statuses.length}
                      isSaving={isSaving}
                      onMove={moveStatus}
                      onUpdateStatus={onUpdateStatus}
                    />
                  </div>
                </details>
                <div className="hidden gap-2 rounded-md border border-border/60 bg-surface/60 p-2 lg:grid lg:grid-cols-[auto_minmax(7rem,1fr)_4.5rem_minmax(6.5rem,0.85fr)_5rem] xl:grid-cols-[auto_8.5rem_5.5rem_7.5rem_6rem_repeat(4,auto)_auto]">
                  <WorkflowStatusFields
                    status={status}
                    index={index}
                    total={statuses.length}
                    isSaving={isSaving}
                    onMove={moveStatus}
                    onUpdateStatus={onUpdateStatus}
                  />
                </div>
              </div>
            ))}
          </div>

          <div
            data-ui="settings-workflow-transitions"
            className="rounded-md border border-border/60 bg-surface-muted/30 p-3"
          >
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
                    <RepairOsBusinessCard
                      as="div"
                      key={status.code}
                      leading={
                        <Checkbox
                          checked={enabled}
                          disabled={isSaving}
                          onCheckedChange={(checked) =>
                            updateTransitionTarget(status.code, { enabled: Boolean(checked) })
                          }
                        />
                      }
                      trailing={
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
                      }
                      className="items-center rounded-md border-border/60 bg-surface px-2 py-1.5 shadow-none hover:bg-surface"
                      leadingClassName="self-center"
                      bodyClassName="self-center"
                      trailingClassName="shrink-0 self-center"
                    >
                      <span className="block truncate text-xs">{status.label}</span>
                    </RepairOsBusinessCard>
                  );
                })}
            </div>
          </div>
        </div>
      )}
    </section>
  );
}

type WorkflowStatusItem = ReturnType<typeof getWorkflowStatuses>[number];

function WorkflowStatusFields({
  status,
  index,
  total,
  isSaving,
  onMove,
  onUpdateStatus,
}: {
  status: WorkflowStatusItem;
  index: number;
  total: number;
  isSaving: boolean;
  onMove: (index: number, direction: -1 | 1) => void;
  onUpdateStatus: (id: string, input: Parameters<typeof updateOrderWorkflowStatus>[1]) => void;
}) {
  return (
    <>
      <div className="flex items-center gap-1">
        <Button
          type="button"
          variant="ghost"
          size="icon"
          className="size-7"
          disabled={isSaving || index === 0}
          onClick={() => onMove(index, -1)}
          aria-label="上移状态"
        >
          <ArrowUp className="size-3.5" />
        </Button>
        <Button
          type="button"
          variant="ghost"
          size="icon"
          className="size-7"
          disabled={isSaving || index === total - 1}
          onClick={() => onMove(index, 1)}
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
          if (shortLabel !== status.short_label) {
            onUpdateStatus(status.id, { short_label: shortLabel });
          }
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
        onValueChange={(tone) => onUpdateStatus(status.id, { tone: tone as OrderWorkflowTone })}
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
        onChange={(checked) => onUpdateStatus(status.id, { show_in_order_filters: checked })}
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
    </>
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
  inviteLinks,
  accessRequests,
  isLoading,
  isAccessRequestsLoading,
  inviteDraft,
  inviteLinkDraft,
  latestInviteCode,
  isInviting,
  isCreatingInviteLink,
  isRevokingInvitation,
  isRevokingInviteLink,
  isReviewingAccessRequest,
  onInviteDraftChange,
  onInviteLinkDraftChange,
  onInvite,
  onCreateInviteLink,
  onRevokeInvitation,
  onRevokeInviteLink,
  onCopyInviteCode,
  onApproveAccessRequest,
  onRejectAccessRequest,
}: {
  members: {
    id: string;
    email: string;
    display_name?: string;
    role: string;
    status: string;
  }[];
  invitations: { id: string; email: string; role: string; expires_at: string }[];
  inviteLinks: {
    id: string;
    label?: string;
    role: string;
    expires_at: string;
    max_uses?: number;
    used_count: number;
  }[];
  accessRequests: OnboardingRequest[];
  isLoading: boolean;
  isAccessRequestsLoading: boolean;
  inviteDraft: StoreInviteInput;
  inviteLinkDraft: StoreInviteLinkCreateInput;
  latestInviteCode: string;
  isInviting: boolean;
  isCreatingInviteLink: boolean;
  isRevokingInvitation: boolean;
  isRevokingInviteLink: boolean;
  isReviewingAccessRequest: boolean;
  onInviteDraftChange: React.Dispatch<React.SetStateAction<StoreInviteInput>>;
  onInviteLinkDraftChange: React.Dispatch<React.SetStateAction<StoreInviteLinkCreateInput>>;
  onInvite: () => void;
  onCreateInviteLink: () => void;
  onRevokeInvitation: (id: string) => void;
  onRevokeInviteLink: (id: string) => void;
  onCopyInviteCode: () => void;
  onApproveAccessRequest: (id: string) => void;
  onRejectAccessRequest: (id: string) => void;
}) {
  return (
    <section id="settings-members" className={cn(repairOs.adminSection, "p-2.5 sm:p-3")}>
      <RepairOsSectionHeader icon={Users} iconFrame={false} title="成员权限" />
      {isLoading ? (
        <div className="space-y-3">
          <Skeleton className="h-10 w-full" />
          <Skeleton className="h-20 w-full" />
        </div>
      ) : (
        <div className="space-y-3">
          {isAccessRequestsLoading ? (
            <div className="space-y-2">
              <Skeleton className="h-16 w-full" />
            </div>
          ) : accessRequests.length ? (
            <div className="space-y-2">
              <div className="flex items-center justify-between gap-2">
                <p className="text-xs font-medium text-muted-foreground">加入申请</p>
                <Badge variant="outline" className="text-[10px]">
                  {accessRequests.length} 条待处理
                </Badge>
              </div>
              {accessRequests.map((request) => (
                <RepairOsBusinessCard
                  key={request.id}
                  className="grid-cols-1 gap-2 border-primary/20 bg-primary/5 px-2.5 py-2 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-center"
                  trailing={
                    <div className="grid grid-cols-2 gap-1.5">
                      <Button
                        type="button"
                        size="sm"
                        className="h-8 gap-1"
                        disabled={isReviewingAccessRequest}
                        onClick={() => onApproveAccessRequest(request.id)}
                      >
                        <Check className="size-3.5" />
                        批准
                      </Button>
                      <Button
                        type="button"
                        size="sm"
                        variant="outline"
                        className="h-8"
                        disabled={isReviewingAccessRequest}
                        onClick={() => onRejectAccessRequest(request.id)}
                      >
                        拒绝
                      </Button>
                    </div>
                  }
                  trailingClassName="sm:justify-self-end"
                >
                  <div className="min-w-0 space-y-1">
                    <div className="flex min-w-0 flex-wrap items-center gap-1.5">
                      <p className="truncate text-sm font-medium">
                        {request.display_name || request.email}
                      </p>
                      <Badge variant="secondary" className="text-[10px]">
                        {roleLabels[request.requested_role] ?? request.requested_role}
                      </Badge>
                    </div>
                    <p className="truncate text-xs text-muted-foreground">{request.email}</p>
                    <p className="truncate text-[11px] leading-4 text-muted-foreground">
                      目标负责人：{request.target_owner_email || request.target_store_name || "-"}
                    </p>
                    {request.request_note ? (
                      <p className="line-clamp-2 text-[11px] leading-4 text-muted-foreground">
                        {request.request_note}
                      </p>
                    ) : null}
                  </div>
                </RepairOsBusinessCard>
              ))}
            </div>
          ) : null}

          <div className="grid gap-2 md:grid-cols-[minmax(0,1fr)_12rem_auto]">
            <Field label="员工邮箱" htmlFor="invite-email">
              <Input
                id="invite-email"
                type="email"
                className={compactControlClass}
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
                <SelectTrigger id="invite-role" className={compactControlClass}>
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
                size="sm"
                className="h-8 gap-1.5"
                disabled={isInviting || inviteDraft.email.trim().length < 3}
                onClick={onInvite}
              >
                <UserPlus className="mr-1.5 size-3.5" /> 邀请
              </Button>
            </div>
          </div>

          <div className="rounded-lg border border-dashed border-primary/30 bg-primary/5 p-2.5">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div>
                <p className="text-xs font-medium text-muted-foreground">邀请码</p>
                <p className="text-[11px] leading-4 text-muted-foreground">
                  兑换后生成待接受邀请，不会直接开通权限。
                </p>
              </div>
              <Badge variant="outline" className="text-[10px]">
                {inviteLinks.length} 个有效
              </Badge>
            </div>
            <div className="mt-2 grid gap-2 md:grid-cols-[minmax(0,1fr)_9rem_6rem_6rem_auto]">
              <Input
                className={compactControlClass}
                value={inviteLinkDraft.label ?? ""}
                onChange={(event) =>
                  onInviteLinkDraftChange((current) => ({
                    ...current,
                    label: event.target.value,
                  }))
                }
                placeholder="备注，例如 临时员工"
              />
              <Select
                value={inviteLinkDraft.role}
                onValueChange={(role) =>
                  onInviteLinkDraftChange((current) => ({
                    ...current,
                    role: role as StoreInviteLinkCreateInput["role"],
                  }))
                }
              >
                <SelectTrigger className={compactControlClass}>
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
              <Input
                type="number"
                min={1}
                max={30}
                className={compactControlClass}
                value={inviteLinkDraft.expires_in_days ?? 7}
                onChange={(event) =>
                  onInviteLinkDraftChange((current) => ({
                    ...current,
                    expires_in_days: Number(event.target.value) || 7,
                  }))
                }
                aria-label="有效天数"
              />
              <Input
                type="number"
                min={1}
                max={50}
                className={compactControlClass}
                value={inviteLinkDraft.max_uses ?? 1}
                onChange={(event) =>
                  onInviteLinkDraftChange((current) => ({
                    ...current,
                    max_uses: Number(event.target.value) || 1,
                  }))
                }
                aria-label="可用次数"
              />
              <Button
                type="button"
                size="sm"
                className="h-8 gap-1.5"
                disabled={isCreatingInviteLink}
                onClick={onCreateInviteLink}
              >
                <Plus className="size-3.5" />
                生成
              </Button>
            </div>
            {latestInviteCode ? (
              <div className="mt-2 grid gap-2 rounded-md border border-primary/20 bg-card px-2.5 py-2 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-center">
                <p className="truncate font-mono text-xs font-semibold">{latestInviteCode}</p>
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  className="h-7"
                  onClick={onCopyInviteCode}
                >
                  复制
                </Button>
              </div>
            ) : null}
            {inviteLinks.length ? (
              <div className="mt-2 grid gap-2">
                {inviteLinks.map((link) => (
                  <RepairOsBusinessCard
                    key={link.id}
                    className="grid-cols-1 gap-1.5 px-2.5 py-2 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-center"
                    trailing={
                      <>
                        <Badge variant="outline" className="text-[10px]">
                          {roleLabels[link.role] ?? link.role}
                        </Badge>
                        <span className="text-xs text-muted-foreground">
                          {link.used_count}/{link.max_uses ?? "不限"}
                        </span>
                        <Button
                          type="button"
                          size="sm"
                          variant="outline"
                          className="h-7 px-2 text-xs"
                          disabled={isRevokingInviteLink}
                          onClick={() => onRevokeInviteLink(link.id)}
                        >
                          撤销
                        </Button>
                      </>
                    }
                    trailingClassName="flex flex-wrap items-center gap-2"
                  >
                    <div className="min-w-0">
                      <p className="truncate text-sm">{link.label || "未命名邀请码"}</p>
                      <p className="truncate text-xs text-muted-foreground">
                        到期：{formatDate(link.expires_at)}
                      </p>
                    </div>
                  </RepairOsBusinessCard>
                ))}
              </div>
            ) : null}
          </div>

          <div className="grid gap-2">
            {members.map((member) => (
              <RepairOsBusinessCard
                key={member.id}
                className="grid-cols-1 gap-1.5 px-2.5 py-2 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-center"
                trailing={
                  <Badge
                    variant={member.role === "owner" ? "default" : "outline"}
                    className="text-[10px]"
                  >
                    {roleLabels[member.role] ?? member.role}
                  </Badge>
                }
                trailingClassName="shrink-0"
              >
                <div className="min-w-0">
                  <p className="truncate text-sm font-medium">
                    {member.display_name || member.email}
                  </p>
                  <p className="truncate text-xs text-muted-foreground">{member.email}</p>
                </div>
              </RepairOsBusinessCard>
            ))}
          </div>

          {invitations.length ? (
            <div className="grid gap-2">
              {invitations.map((invitation) => (
                <RepairOsBusinessCard
                  key={invitation.id}
                  className="grid-cols-1 gap-1.5 border-dashed px-2.5 py-2 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-center sm:justify-between"
                  trailing={
                    <>
                      <Badge variant="outline">
                        {roleLabels[invitation.role] ?? invitation.role}
                      </Badge>
                      <span className="text-xs text-muted-foreground">
                        {formatDate(invitation.expires_at)}
                      </span>
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        className="h-7 px-2 text-xs"
                        disabled={isRevokingInvitation}
                        onClick={() => onRevokeInvitation(invitation.id)}
                      >
                        撤销
                      </Button>
                    </>
                  }
                  trailingClassName="flex flex-wrap items-center gap-2"
                >
                  <p className="truncate text-sm">{invitation.email}</p>
                </RepairOsBusinessCard>
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
    <section className={cn(repairOs.adminSection, "p-2.5 sm:p-3")}>
      <RepairOsSectionHeader icon={Store} iconFrame={false} title="店铺管理" />
      {isLoading ? (
        <div className="grid gap-3 md:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
          <Skeleton className="h-10 w-full" />
          <Skeleton className="h-10 w-full" />
        </div>
      ) : (
        <div className="grid gap-2 md:grid-cols-[minmax(0,1.1fr)_minmax(0,0.9fr)]">
          <Field label="当前店铺" htmlFor="active-store">
            <Select
              value={activeStoreId}
              onValueChange={onSwitchStore}
              disabled={isSwitching || stores.length === 0}
            >
              <SelectTrigger id="active-store" className={compactControlClass}>
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
                className={compactControlClass}
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
                size="sm"
                className="h-8 gap-1.5"
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
    <RepairOsListScaffold
      title="设置"
      subtitle="正在读取配置"
      eyebrow="系统 / 设置"
      chips={[
        { key: "stores", label: "店铺", shortLabel: "店", count: "-" },
        { key: "members", label: "成员", shortLabel: "员", count: "-" },
        { key: "workflow", label: "状态流", shortLabel: "流", count: "-" },
      ]}
      className="pb-28"
    >
      <div className="mt-3 space-y-2.5 sm:space-y-3">
        <Skeleton className="h-32 w-full rounded-lg" />
        <Skeleton className="h-28 w-full rounded-lg" />
        <Skeleton className="h-40 w-full rounded-lg" />
      </div>
    </RepairOsListScaffold>
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
