"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  Archive,
  AlertTriangle,
  ArrowDown,
  ArrowUp,
  Check,
  ChevronDown,
  GitBranch,
  FileSpreadsheet,
  KeyRound,
  Mail,
  MessageSquare,
  PackageSearch,
  Phone,
  Pencil,
  Plus,
  Printer,
  RotateCcw,
  Search,
  Settings2,
  ShieldCheck,
  Store,
  TabletSmartphone,
  UserMinus,
  UserRound,
  UserPlus,
  Users,
} from "lucide-react";
import { toast } from "sonner";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
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
import { kioskKeys } from "@/features/kiosk/api/query-keys";
import { messageSettingsKeys } from "@/features/messages/api/query-keys";
import { OrderDataSection } from "@/features/settings/components/order-data-section";
import { ordersKeys } from "@/features/orders/api/query-keys";
import { platformKeys } from "@/features/platform/api/query-keys";
import { suppliersKeys } from "@/features/suppliers/api/query-keys";
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
import {
  normalizeSettingsSection,
  resolveSettingsSectionAccess,
  type SettingsSectionKey,
} from "@/features/settings/model/settings-section-access";
import {
  acceptStoreBoundTransientValue,
  valueForActiveStore,
  type StoreBoundTransientValue,
} from "@/features/settings/model/store-bound-transient-state";
import { storesKeys } from "@/features/stores/api/query-keys";
import {
  applySwitchedStoreContext,
  refreshStoreContextQueries,
} from "@/features/stores/api/tenant-cache";
import { RepairOsBusinessCard, RepairOsListScaffold, RepairOsSectionHeader } from "@/shared/ui";
import {
  acceptKioskSession,
  createStore,
  approveStoreAccessRequest,
  archiveSupplier,
  createSupplier,
  createOrderWorkflowStatus,
  createStoreInviteLink,
  disableStoreMember,
  getOnboardingStatus,
  getStoreMembers,
  getStoreContext,
  getStoreSettings,
  inviteStoreMember,
  listKioskDevices,
  listKioskSessions,
  listSuppliers,
  listStoreAccessRequests,
  listOrderWorkflow,
  rejectStoreAccessRequest,
  returnKioskSession,
  revokeKioskDevice,
  restoreStoreMember,
  revokeStoreInviteLink,
  revokeStoreInvitation,
  reorderOrderWorkflowStatuses,
  switchStore,
  updateSupplier,
  updateStoreMemberPermissions,
  updateStoreMemberRole,
  updateAccountProfile,
  updateOrderWorkflowStatus,
  updateOrderWorkflowTransitions,
  updateStoreSettings,
  createKioskDevicePairing,
  type KioskDevice,
  type KioskSession,
  type OnboardingStatus,
  type OnboardingRequest,
  type OrderWorkflow,
  type OrderWorkflowBucket,
  type OrderWorkflowStatusCreateInput,
  type OrderWorkflowTone,
  type OrderWorkflowTransitionsUpdateInput,
  type StoreInviteLinkCreateInput,
  type StoreInviteInput,
  type StoreMember,
  type StorePermissionAction,
  type ApprovedStoreRole,
  type StoreSettings,
  type StoreRole,
  type Supplier,
  type SupplierInput,
} from "@/lib/repairdesk/api";
import { CACHE_TIMES } from "@/lib/query-performance";
import { cn } from "@/lib/utils";
import { brandGradientStyle, formLayout, repairOs } from "@/lib/ui-patterns";
import {
  canRoleReceiveStorePermissionGrant,
  normalizeStorePermissionGrants,
} from "@/entities/staff/model/store-permission-policy";

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

const settingsSections: {
  key: SettingsSectionKey;
  label: string;
  shortLabel: string;
  description: string;
  icon: typeof Store;
}[] = [
  { key: "account", label: "账号", shortLabel: "账号", description: "名称与身份", icon: UserRound },
  { key: "store", label: "店铺", shortLabel: "店铺", description: "资料与切换", icon: Store },
  {
    key: "suppliers",
    label: "供应商",
    shortLabel: "供应商",
    description: "配件与外修来源",
    icon: PackageSearch,
  },
  { key: "members", label: "员工", shortLabel: "员工", description: "成员与邀请", icon: Users },
  {
    key: "kiosk",
    label: "客户 iPad",
    shortLabel: "iPad",
    description: "客户填写与签名",
    icon: TabletSmartphone,
  },
  {
    key: "notifications",
    label: "通知与打印",
    shortLabel: "通知",
    description: "签名与预览",
    icon: MessageSquare,
  },
  { key: "rules", label: "默认规则", shortLabel: "规则", description: "质保规则", icon: Settings2 },
  {
    key: "workflow",
    label: "状态流",
    shortLabel: "状态",
    description: "工单流转",
    icon: GitBranch,
  },
  {
    key: "order-data",
    label: "工单数据",
    shortLabel: "数据",
    description: "模板与批量整理",
    icon: FileSpreadsheet,
  },
];

const draftSectionFields: Record<"store" | "notifications" | "rules", (keyof SettingsDraft)[]> = {
  store: ["store_name", "store_email", "store_phone", "store_whatsapp", "store_address"],
  notifications: ["print_footer", "message_signature"],
  rules: [
    "default_order_warranty_text",
    "default_order_warranty_months",
    "default_inventory_warranty_months",
  ],
};

function canSaveDraftInSection(section: SettingsSectionKey) {
  return section === "store" || section === "notifications" || section === "rules";
}

export function SettingsScreen() {
  const router = useRouter();
  const pathname = usePathname() ?? "/settings";
  const searchParams = useSearchParams();
  const queryClient = useQueryClient();
  const storeContextQuery = useQuery({
    queryKey: storesKeys.context,
    queryFn: ({ signal }) => getStoreContext({ signal }),
    staleTime: CACHE_TIMES.shell,
  });
  const activeStoreId = storeContextQuery.data?.activeStore?.id;
  const settingsCapabilities = storeContextQuery.data?.permissions;
  const canReadSuppliers = settingsCapabilities?.canReadSuppliers === true;
  const canManageSuppliers = settingsCapabilities?.canManageSuppliers === true;
  const canManageOrderData = settingsCapabilities?.canManageOrderData === true;
  const canApplyOrderData = settingsCapabilities?.canApplyOrderData === true;
  const canUpdateStoreSettings = settingsCapabilities?.canUpdateStoreSettings === true;
  const canConfigureWorkflow = settingsCapabilities?.canConfigureWorkflow === true;
  const canListMembers = settingsCapabilities?.canListMembers === true;
  const canInviteMembers = settingsCapabilities?.canInviteMembers === true;
  const canManageMembers = settingsCapabilities?.canManageMembers === true;
  const canRevokeMembers = settingsCapabilities?.canRevokeMembers === true;
  const canGrantManager = settingsCapabilities?.canGrantManager === true;
  const canReviewAccessRequests = settingsCapabilities?.canReviewAccessRequests === true;
  const canManageKioskDevices = settingsCapabilities?.canManageKioskDevices === true;
  const canReviewKioskSessions = settingsCapabilities?.canReviewKioskSessions === true;
  const settingsQuery = useQuery({
    queryKey: messageSettingsKeys.storeScoped(activeStoreId),
    queryFn: ({ signal }) => getStoreSettings({ signal }),
    staleTime: CACHE_TIMES.settings,
    enabled: Boolean(activeStoreId),
  });
  const storeMembersQuery = useQuery({
    queryKey: storesKeys.membersScoped(activeStoreId),
    queryFn: ({ signal }) => getStoreMembers({ signal }),
    staleTime: CACHE_TIMES.settings,
    enabled: Boolean(activeStoreId && canListMembers),
  });
  const storeAccessRequestsQuery = useQuery({
    queryKey: storesKeys.accessRequestsScoped(activeStoreId),
    queryFn: ({ signal }) => listStoreAccessRequests({ signal }),
    staleTime: CACHE_TIMES.settings,
    enabled: Boolean(activeStoreId && canReviewAccessRequests),
  });
  const workflowQuery = useQuery({
    queryKey: ordersKeys.workflow(activeStoreId),
    queryFn: ({ signal }) => listOrderWorkflow({ signal }),
    staleTime: CACHE_TIMES.workflow,
    enabled: Boolean(activeStoreId),
  });
  const accountQuery = useQuery({
    queryKey: platformKeys.onboardingStatus,
    queryFn: ({ signal }) => getOnboardingStatus({ signal }),
    staleTime: CACHE_TIMES.shell,
    retry: false,
  });
  const kioskDevicesQuery = useQuery({
    queryKey: kioskKeys.devices(activeStoreId),
    queryFn: ({ signal }) => listKioskDevices({ signal }),
    staleTime: CACHE_TIMES.settings,
    enabled: Boolean(activeStoreId && canManageKioskDevices),
  });
  const kioskSessionsQuery = useQuery({
    queryKey: kioskKeys.sessions(activeStoreId),
    queryFn: ({ signal }) => listKioskSessions({ signal }),
    staleTime: CACHE_TIMES.settings,
    enabled: Boolean(activeStoreId && canReviewKioskSessions),
  });
  const suppliersQuery = useQuery({
    queryKey: suppliersKeys.storeScoped(activeStoreId),
    queryFn: ({ signal }) => listSuppliers({ signal }),
    staleTime: CACHE_TIMES.settings,
    enabled: Boolean(activeStoreId && canReadSuppliers),
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
  const [supplierEditorId, setSupplierEditorId] = useState<string | "new" | null>(null);
  const [supplierDraft, setSupplierDraft] = useState<SupplierInput>(() => defaultSupplierDraft());
  const [accessRequestRoles, setAccessRequestRoles] = useState<Record<string, ApprovedStoreRole>>(
    {},
  );
  const [latestInviteCodeState, setLatestInviteCodeState] =
    useState<StoreBoundTransientValue<string> | null>(null);
  const [memberSearch, setMemberSearch] = useState("");
  const [memberStatusFilter, setMemberStatusFilter] = useState<"all" | "active" | "inactive">(
    "all",
  );
  const [memberRoleDrafts, setMemberRoleDrafts] = useState<Record<string, ApprovedStoreRole>>({});
  const [memberActionId, setMemberActionId] = useState("");
  const [kioskDeviceLabel, setKioskDeviceLabel] = useState("前台 iPad");
  const [latestKioskPairingCodeState, setLatestKioskPairingCodeState] =
    useState<StoreBoundTransientValue<string> | null>(null);
  const activeStoreScopeRef = useRef({ storeId: activeStoreId, epoch: 0 });
  const inviteCodeRequestEpochRef = useRef(0);
  const kioskPairingRequestEpochRef = useRef(0);

  useEffect(() => {
    const currentScope = activeStoreScopeRef.current;
    if (currentScope.storeId === activeStoreId) return;
    activeStoreScopeRef.current = {
      storeId: activeStoreId,
      epoch: currentScope.epoch + 1,
    };
    inviteCodeRequestEpochRef.current += 1;
    kioskPairingRequestEpochRef.current += 1;
    setLatestInviteCodeState(null);
    setLatestKioskPairingCodeState(null);
    setDraft(null);
    setInviteDraft({ email: "", role: "technician" });
    setInviteLinkDraft({
      label: "",
      role: "technician",
      expires_in_days: 7,
      max_uses: 1,
    });
    setSupplierEditorId(null);
    setSupplierDraft(defaultSupplierDraft());
    setAccessRequestRoles({});
    setMemberRoleDrafts({});
    setMemberSearch("");
    setMemberStatusFilter("all");
    setKioskDeviceLabel("前台 iPad");
  }, [activeStoreId]);

  useEffect(() => {
    if (!latestInviteCodeState?.expiresAt) return;
    const remaining = new Date(latestInviteCodeState.expiresAt).getTime() - Date.now();
    if (remaining <= 0) {
      setLatestInviteCodeState(null);
      return;
    }
    const timeout = window.setTimeout(
      () => setLatestInviteCodeState(null),
      Math.min(remaining, 2_147_483_647),
    );
    return () => window.clearTimeout(timeout);
  }, [latestInviteCodeState]);

  useEffect(() => {
    if (!latestKioskPairingCodeState?.expiresAt) return;
    const remaining = new Date(latestKioskPairingCodeState.expiresAt).getTime() - Date.now();
    if (remaining <= 0) {
      setLatestKioskPairingCodeState(null);
      return;
    }
    const timeout = window.setTimeout(
      () => setLatestKioskPairingCodeState(null),
      Math.min(remaining, 2_147_483_647),
    );
    return () => window.clearTimeout(timeout);
  }, [latestKioskPairingCodeState]);

  useEffect(() => {
    if (!settingsData) return;
    setDraft(toDraft(settingsData));
  }, [settingsData]);

  useEffect(() => {
    if (!accountQuery.data) return;
    setAccountNameDraft(accountQuery.data.displayName);
  }, [accountQuery.data]);

  useEffect(() => {
    setMemberRoleDrafts((current) => {
      const next: Record<string, ApprovedStoreRole> = {};
      for (const member of storeMembersQuery.data?.members ?? []) {
        next[member.id] = toApprovedRole(current[member.id] ?? member.role);
      }
      return next;
    });
  }, [storeMembersQuery.data?.members]);

  useEffect(() => {
    setAccessRequestRoles((current) => {
      const next: Record<string, ApprovedStoreRole> = {};
      for (const request of storeAccessRequestsQuery.data ?? []) {
        next[request.id] = toApprovedRole(current[request.id] ?? request.requested_role);
      }
      return next;
    });
  }, [storeAccessRequestsQuery.data]);

  const hasChanges = useMemo(() => {
    if (!draft || !settingsData) return false;
    const current = toDraft(settingsData);
    return JSON.stringify(current) !== JSON.stringify(draft);
  }, [draft, settingsData]);
  const accountName = accountNameDraft.trim().replace(/\s+/g, " ");
  const hasAccountNameChange = Boolean(
    accountQuery.data && accountName && accountName !== accountQuery.data.displayName,
  );
  const requestedSection = normalizeSettingsSection(searchParams.get("section"));
  const selectedSection = requestedSection;
  const selectedSectionAccess = resolveSettingsSectionAccess(selectedSection, settingsCapabilities);
  const canRenderSelectedSection =
    selectedSectionAccess === "editable" || selectedSectionAccess === "readonly";
  const latestInviteCode = valueForActiveStore(latestInviteCodeState, activeStoreId) ?? "";
  const latestKioskPairingCode =
    valueForActiveStore(latestKioskPairingCodeState, activeStoreId) ?? "";
  const sectionDirtyState = useMemo<Record<SettingsSectionKey, boolean>>(() => {
    const base = {
      account: hasAccountNameChange,
      store: false,
      members: false,
      suppliers: false,
      kiosk: false,
      notifications: false,
      rules: false,
      workflow: false,
      "order-data": false,
    };
    if (!draft || !settingsData) return base;
    const current = toDraft(settingsData);
    return {
      ...base,
      store: draftSectionFields.store.some((field) => draft[field] !== current[field]),
      notifications: draftSectionFields.notifications.some(
        (field) => draft[field] !== current[field],
      ),
      rules: draftSectionFields.rules.some((field) => draft[field] !== current[field]),
    };
  }, [draft, hasAccountNameChange, settingsData]);

  const saveMutation = useMutation({
    mutationFn: async () => {
      if (!draft) throw new Error("设置未加载");
      if (!canUpdateStoreSettings) throw new Error("当前账号没有修改店铺设置的权限");
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
  const invalidateSupplierCaches = () => {
    void queryClient.invalidateQueries({ queryKey: suppliersKeys.storeScoped(activeStoreId) });
    void queryClient.invalidateQueries({ queryKey: ordersKeys.options(activeStoreId) });
    void queryClient.invalidateQueries({ queryKey: ordersKeys.all });
  };
  const saveSupplierMutation = useMutation({
    mutationFn: async () => {
      if (supplierEditorId && supplierEditorId !== "new") {
        return updateSupplier(supplierEditorId, supplierDraft);
      }
      return createSupplier(supplierDraft);
    },
    onSuccess: () => {
      toast.success(supplierEditorId === "new" ? "供应商已添加" : "供应商已保存");
      setSupplierEditorId(null);
      setSupplierDraft(defaultSupplierDraft());
      invalidateSupplierCaches();
    },
    onError: (error) => {
      toast.error(error instanceof Error ? error.message : "保存供应商失败");
    },
  });
  const archiveSupplierMutation = useMutation({
    mutationFn: archiveSupplier,
    onSuccess: () => {
      toast.success("供应商已归档");
      invalidateSupplierCaches();
    },
    onError: (error) => {
      toast.error(error instanceof Error ? error.message : "归档供应商失败");
    },
  });
  const switchStoreMutation = useMutation({
    mutationFn: switchStore,
    onMutate: () => {
      inviteCodeRequestEpochRef.current += 1;
      kioskPairingRequestEpochRef.current += 1;
      setLatestInviteCodeState(null);
      setLatestKioskPairingCodeState(null);
    },
    onSuccess: async (context) => {
      toast.success(`已切换到 ${context.activeStore?.name ?? "店铺"}`);
      await applySwitchedStoreContext(queryClient, context);
      await refreshStoreContextQueries(queryClient);
    },
    onError: (error) => toast.error(error instanceof Error ? error.message : "切换店铺失败"),
  });
  const createStoreMutation = useMutation({
    mutationFn: createStore,
    onMutate: () => {
      inviteCodeRequestEpochRef.current += 1;
      kioskPairingRequestEpochRef.current += 1;
      setLatestInviteCodeState(null);
      setLatestKioskPairingCodeState(null);
    },
    onSuccess: async (context) => {
      toast.success(`已创建 ${context.activeStore?.name ?? "新店铺"}`);
      setNewStoreName("");
      await queryClient.invalidateQueries();
    },
    onError: (error) => toast.error(error instanceof Error ? error.message : "创建店铺失败"),
  });
  const createKioskPairingMutation = useMutation({
    mutationFn: ({
      input,
    }: {
      input: Parameters<typeof createKioskDevicePairing>[0];
      requestedStoreId: string;
      requestEpoch: number;
    }) => createKioskDevicePairing(input),
    onSuccess: async (result, request) => {
      const nextValue = acceptStoreBoundTransientValue({
        requestedStoreId: request.requestedStoreId,
        responseStoreId: result.device.store_id,
        currentStoreId: activeStoreScopeRef.current.storeId,
        requestEpoch: request.requestEpoch,
        currentEpoch: kioskPairingRequestEpochRef.current,
        value: result.pairing_code,
        expiresAt: result.expires_at,
      });
      if (nextValue) {
        setLatestKioskPairingCodeState(nextValue);
        toast.success("iPad 配对码已生成");
      } else {
        toast.error("店铺上下文已变化，旧配对码未显示，请重新生成");
      }
      await queryClient.invalidateQueries({
        queryKey: kioskKeys.devices(request.requestedStoreId),
      });
    },
    onError: (error) => toast.error(error instanceof Error ? error.message : "生成配对码失败"),
  });
  const revokeKioskDeviceMutation = useMutation({
    mutationFn: revokeKioskDevice,
    onSuccess: async () => {
      toast.success("客户 iPad 已撤销");
      await queryClient.invalidateQueries({ queryKey: kioskKeys.devices(activeStoreId) });
    },
    onError: (error) => toast.error(error instanceof Error ? error.message : "撤销 iPad 失败"),
  });
  const acceptKioskSessionMutation = useMutation({
    mutationFn: acceptKioskSession,
    onSuccess: async () => {
      toast.success("客户提交已接受");
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: kioskKeys.sessions(activeStoreId) }),
        queryClient.invalidateQueries({ queryKey: ordersKeys.all }),
        queryClient.invalidateQueries({ queryKey: customersKeys.all }),
      ]);
    },
    onError: (error) => toast.error(error instanceof Error ? error.message : "接受 iPad 提交失败"),
  });
  const returnKioskSessionMutation = useMutation({
    mutationFn: returnKioskSession,
    onSuccess: async () => {
      toast.success("已退回给客户重填");
      await queryClient.invalidateQueries({ queryKey: kioskKeys.sessions(activeStoreId) });
    },
    onError: (error) => toast.error(error instanceof Error ? error.message : "退回 iPad 提交失败"),
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
    mutationFn: ({
      input,
    }: {
      input: StoreInviteLinkCreateInput;
      requestedStoreId: string;
      requestEpoch: number;
    }) => createStoreInviteLink(input),
    onSuccess: async (result, request) => {
      const nextValue = acceptStoreBoundTransientValue({
        requestedStoreId: request.requestedStoreId,
        responseStoreId: result.link.store_id,
        currentStoreId: activeStoreScopeRef.current.storeId,
        requestEpoch: request.requestEpoch,
        currentEpoch: inviteCodeRequestEpochRef.current,
        value: result.code,
        expiresAt: result.link.expires_at,
      });
      if (nextValue) {
        setLatestInviteCodeState(nextValue);
        toast.success("邀请码已生成，请复制保存");
      } else {
        toast.error("店铺上下文已变化，旧邀请码未显示，请重新生成");
      }
      setInviteLinkDraft((current) => ({ ...current, label: "" }));
      await queryClient.invalidateQueries({
        queryKey: storesKeys.membersScoped(request.requestedStoreId),
      });
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
  const updateMemberRoleMutation = useMutation({
    mutationFn: updateStoreMemberRole,
    onMutate: (input) => {
      setMemberActionId(input.id);
    },
    onSuccess: async () => {
      toast.success("员工角色已保存");
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: storesKeys.members }),
        queryClient.invalidateQueries({ queryKey: storesKeys.context }),
        queryClient.invalidateQueries({ queryKey: platformKeys.onboardingStatus }),
      ]);
    },
    onError: (error) => toast.error(error instanceof Error ? error.message : "保存员工角色失败"),
    onSettled: () => setMemberActionId(""),
  });
  const updateMemberPermissionsMutation = useMutation({
    mutationFn: updateStoreMemberPermissions,
    onMutate: (input) => {
      setMemberActionId(input.id);
    },
    onSuccess: async () => {
      toast.success("供应商权限已保存");
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: storesKeys.members }),
        queryClient.invalidateQueries({ queryKey: storesKeys.context }),
        queryClient.invalidateQueries({ queryKey: ordersKeys.options() }),
        queryClient.invalidateQueries({ queryKey: ordersKeys.lists() }),
      ]);
    },
    onError: (error) => toast.error(error instanceof Error ? error.message : "保存供应商权限失败"),
    onSettled: () => setMemberActionId(""),
  });
  const disableMemberMutation = useMutation({
    mutationFn: disableStoreMember,
    onMutate: (input) => {
      setMemberActionId(input.id);
    },
    onSuccess: async () => {
      toast.success("员工已停用");
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: storesKeys.members }),
        queryClient.invalidateQueries({ queryKey: storesKeys.context }),
      ]);
    },
    onError: (error) => toast.error(error instanceof Error ? error.message : "停用员工失败"),
    onSettled: () => setMemberActionId(""),
  });
  const restoreMemberMutation = useMutation({
    mutationFn: restoreStoreMember,
    onMutate: (input) => {
      setMemberActionId(input.id);
    },
    onSuccess: async () => {
      toast.success("员工已恢复");
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: storesKeys.members }),
        queryClient.invalidateQueries({ queryKey: storesKeys.context }),
      ]);
    },
    onError: (error) => toast.error(error instanceof Error ? error.message : "恢复员工失败"),
    onSettled: () => setMemberActionId(""),
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

  if (
    storeContextQuery.isError ||
    (storeContextQuery.isSuccess && !storeContextQuery.data.activeStore)
  ) {
    return (
      <RepairOsListScaffold title="设置" subtitle="读取失败" eyebrow="系统 / 设置">
        <RepairOsBusinessCard
          as="div"
          data-ui="settings-context-error"
          role="alert"
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
              onClick={() => storeContextQuery.refetch()}
            >
              重新加载
            </Button>
          }
          leadingClassName="self-center"
          trailingClassName="col-span-2 justify-self-start sm:col-span-1 sm:justify-self-end"
        >
          <span className="block text-sm font-semibold">无法读取店铺与权限信息</span>
          <span className="mt-0.5 block text-[11px] leading-4 text-status-danger-foreground/80">
            请重新加载当前店铺上下文后继续使用设置。
          </span>
        </RepairOsBusinessCard>
      </RepairOsListScaffold>
    );
  }

  if (settingsQuery.isError) {
    return (
      <RepairOsListScaffold title="设置" subtitle="读取失败" eyebrow="系统 / 设置">
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

  if (storeContextQuery.isLoading || settingsQuery.isLoading || !draft) {
    return <SettingsLoading />;
  }

  const storeCount = storeContextQuery.data?.stores.length ?? 0;
  const memberCount = storeMembersQuery.data?.members.length ?? 0;
  const supplierRows = suppliersQuery.data ?? [];
  const activeSupplierCount = supplierRows.filter((supplier) => !supplier.archived_at).length;
  const kioskDeviceCount =
    kioskDevicesQuery.data?.filter((device) => device.status === "active").length ?? 0;
  const workflowStatusCount = getWorkflowStatuses(workflowQuery.data).length;
  const storeReadiness = getStoreSettingsReadiness(draft);
  const messagePreview = buildStoreMessagePreview(draft);
  const printPreview = buildStorePrintPreview(draft);
  const invitationCount = storeMembersQuery.data?.invitations.length ?? 0;
  const inviteLinkCount = storeMembersQuery.data?.invite_links?.length ?? 0;
  const accessRequestCount = storeAccessRequestsQuery.data?.length ?? 0;
  const pendingMemberWorkCount = accessRequestCount + invitationCount + inviteLinkCount;
  const activeSection = settingsSections.find((section) => section.key === selectedSection);
  const sectionNavItems = settingsSections
    .filter((section) => {
      if (section.key === "order-data") return canManageOrderData;
      if (section.key === "members") return canListMembers;
      if (section.key === "kiosk") return canManageKioskDevices || canReviewKioskSessions;
      return true;
    })
    .map((section) => {
      const status =
        section.key === "store"
          ? `${storeCount} 店铺`
          : section.key === "suppliers"
            ? canManageSuppliers
              ? `${activeSupplierCount} 可选`
              : canReadSuppliers
                ? "只读"
                : "无读取权限"
            : section.key === "members"
              ? pendingMemberWorkCount > 0
                ? `${memberCount} 成员 · ${pendingMemberWorkCount} 待处理`
                : `${memberCount} 成员`
              : section.key === "kiosk"
                ? `${kioskDeviceCount} 台可用`
                : section.key === "notifications"
                  ? `${storeReadiness.score}% 完整`
                  : section.key === "workflow"
                    ? `${workflowStatusCount} 状态`
                    : section.key === "order-data"
                      ? "仅店铺创建者"
                      : section.description;
      const count =
        section.key === "members"
          ? memberCount
          : section.key === "store"
            ? storeCount
            : section.key === "suppliers"
              ? activeSupplierCount
              : section.key === "kiosk"
                ? kioskDeviceCount
                : section.key === "workflow"
                  ? workflowStatusCount
                  : undefined;
      return {
        ...section,
        status,
        count,
        dirty: sectionDirtyState[section.key],
      };
    });
  const handleSectionChange = (section: SettingsSectionKey) => {
    const nextParams = new URLSearchParams(searchParams.toString());
    nextParams.set("section", section);
    router.replace(`${pathname}?${nextParams.toString()}`, { scroll: false });
  };

  return (
    <RepairOsListScaffold
      title="设置"
      subtitle={`${storeCount} 店铺 · ${memberCount} 成员`}
      eyebrow="系统 / 设置"
      action={
        canSaveDraftInSection(selectedSection) && canUpdateStoreSettings ? (
          <Button
            type="button"
            size="sm"
            className="h-7 gap-1 rounded-lg border-0 px-2 text-xs text-primary-foreground shadow-[var(--shadow-action)]"
            style={brandGradientStyle}
            aria-label="保存设置"
            disabled={!hasChanges || saveMutation.isPending}
            onClick={() => saveMutation.mutate()}
          >
            <Check className="size-3.5" />
            保存
          </Button>
        ) : undefined
      }
      desktopAction={
        canSaveDraftInSection(selectedSection) && canUpdateStoreSettings ? (
          <Button
            size="sm"
            className="h-8 shrink-0 gap-1.5 border-0 text-primary-foreground sm:h-9"
            style={brandGradientStyle}
            disabled={!hasChanges || saveMutation.isPending}
            onClick={() => saveMutation.mutate()}
          >
            <Check className="size-3.5" /> 保存
          </Button>
        ) : undefined
      }
      className="pb-8"
    >
      <form
        className="mt-3 space-y-3 pb-8 sm:mt-4"
        onSubmit={(event) => {
          event.preventDefault();
          if (hasChanges && canUpdateStoreSettings && !saveMutation.isPending) {
            saveMutation.mutate();
          }
        }}
      >
        <SettingsSectionNav
          items={sectionNavItems}
          selectedSection={selectedSection}
          onSelect={handleSectionChange}
        />

        {selectedSectionAccess === "blocked" || selectedSectionAccess === "unavailable" ? (
          <SettingsSectionAccessState
            section={selectedSection}
            unavailable={selectedSectionAccess === "unavailable"}
          />
        ) : selectedSectionAccess === "readonly" ? (
          <div
            data-ui="settings-section-readonly"
            className="rounded-xl border border-[var(--border-panel)] bg-[var(--surface-panel-muted)] px-3 py-2 text-xs text-muted-foreground"
          >
            当前账号可查看此分组，但不能修改配置。
          </div>
        ) : null}

        <div
          className={cn(
            "grid min-w-0 gap-3 xl:items-start",
            selectedSection === "workflow" && "hidden",
            selectedSection === "store" || selectedSection === "notifications"
              ? "xl:grid-cols-[minmax(0,0.95fr)_minmax(0,1.05fr)]"
              : "xl:grid-cols-1",
          )}
        >
          <div
            className={cn(
              "min-w-0 space-y-3",
              selectedSection === "rules" && "hidden",
              selectedSection === "store" || selectedSection === "notifications"
                ? ""
                : "xl:max-w-none",
            )}
          >
            {canRenderSelectedSection && selectedSection === "account" ? (
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
            ) : null}
            {canRenderSelectedSection && selectedSection === "store" ? (
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
            ) : null}
            {canRenderSelectedSection && selectedSection === "suppliers" ? (
              <SupplierManagementSection
                key={activeStoreId}
                suppliers={supplierRows}
                canRead={canReadSuppliers}
                canManage={canManageSuppliers}
                isLoading={canReadSuppliers && suppliersQuery.isLoading}
                isError={suppliersQuery.isError}
                draft={supplierDraft}
                editorId={supplierEditorId}
                isSaving={saveSupplierMutation.isPending}
                archivePendingId={
                  archiveSupplierMutation.isPending ? archiveSupplierMutation.variables : undefined
                }
                onDraftChange={setSupplierDraft}
                onCreate={() => {
                  setSupplierEditorId("new");
                  setSupplierDraft(defaultSupplierDraft());
                }}
                onEdit={(supplier) => {
                  setSupplierEditorId(supplier.id);
                  setSupplierDraft(supplierToInput(supplier));
                }}
                onCancel={() => {
                  setSupplierEditorId(null);
                  setSupplierDraft(defaultSupplierDraft());
                }}
                onSave={() => saveSupplierMutation.mutate()}
                onArchive={(id) => archiveSupplierMutation.mutate(id)}
              />
            ) : null}
            {canRenderSelectedSection && selectedSection === "members" ? (
              <StoreMembersSection
                key={activeStoreId}
                members={storeMembersQuery.data?.members ?? []}
                invitations={storeMembersQuery.data?.invitations ?? []}
                inviteLinks={storeMembersQuery.data?.invite_links ?? []}
                accessRequests={storeAccessRequestsQuery.data ?? []}
                activeStoreRole={storeContextQuery.data?.activeStore?.role}
                currentUserId={accountQuery.data?.userId}
                canInviteMembers={canInviteMembers}
                canManageMembers={canManageMembers}
                canRevokeMembers={canRevokeMembers}
                canReviewAccessRequests={canReviewAccessRequests}
                canManageMemberPermissions={canGrantManager}
                isLoading={storeMembersQuery.isLoading}
                isError={storeMembersQuery.isError}
                isAccessRequestsLoading={storeAccessRequestsQuery.isLoading}
                inviteDraft={inviteDraft}
                inviteLinkDraft={inviteLinkDraft}
                memberSearch={memberSearch}
                memberStatusFilter={memberStatusFilter}
                memberRoleDrafts={memberRoleDrafts}
                accessRequestRoles={accessRequestRoles}
                latestInviteCode={latestInviteCode}
                isInviting={inviteMemberMutation.isPending}
                isCreatingInviteLink={createInviteLinkMutation.isPending}
                isRevokingInvitation={revokeInvitationMutation.isPending}
                isRevokingInviteLink={revokeInviteLinkMutation.isPending}
                isUpdatingMember={
                  updateMemberRoleMutation.isPending ||
                  updateMemberPermissionsMutation.isPending ||
                  disableMemberMutation.isPending ||
                  restoreMemberMutation.isPending
                }
                memberActionId={memberActionId}
                isReviewingAccessRequest={
                  approveAccessRequestMutation.isPending || rejectAccessRequestMutation.isPending
                }
                onInviteDraftChange={setInviteDraft}
                onInviteLinkDraftChange={setInviteLinkDraft}
                onMemberSearchChange={setMemberSearch}
                onMemberStatusFilterChange={setMemberStatusFilter}
                onMemberRoleDraftChange={(id, role) =>
                  setMemberRoleDrafts((current) => ({ ...current, [id]: role }))
                }
                onUpdateMemberPermissions={(id, permissions) =>
                  canGrantManager && updateMemberPermissionsMutation.mutate({ id, permissions })
                }
                onAccessRequestRoleChange={(id, role) =>
                  setAccessRequestRoles((current) => ({ ...current, [id]: role }))
                }
                onUpdateMemberRole={(id, role) =>
                  canManageMembers && updateMemberRoleMutation.mutate({ id, role })
                }
                onDisableMember={(id) => canManageMembers && disableMemberMutation.mutate({ id })}
                onRestoreMember={(id) => canManageMembers && restoreMemberMutation.mutate({ id })}
                onInvite={() => {
                  const email = inviteDraft.email.trim();
                  if (!email || !canInviteMembers) return;
                  inviteMemberMutation.mutate({ ...inviteDraft, email });
                }}
                onCreateInviteLink={() => {
                  const requestedStoreId = activeStoreScopeRef.current.storeId;
                  if (!requestedStoreId || !canInviteMembers) return;
                  const requestEpoch = inviteCodeRequestEpochRef.current + 1;
                  inviteCodeRequestEpochRef.current = requestEpoch;
                  setLatestInviteCodeState(null);
                  createInviteLinkMutation.mutate({
                    input: {
                      ...inviteLinkDraft,
                      label: inviteLinkDraft.label?.trim() || undefined,
                    },
                    requestedStoreId,
                    requestEpoch,
                  });
                }}
                onRevokeInvitation={(id) =>
                  canRevokeMembers && revokeInvitationMutation.mutate({ id })
                }
                onRevokeInviteLink={(id) =>
                  canRevokeMembers && revokeInviteLinkMutation.mutate({ id })
                }
                onCopyInviteCode={() => {
                  const currentCode = valueForActiveStore(
                    latestInviteCodeState,
                    activeStoreScopeRef.current.storeId,
                  );
                  if (!currentCode) return;
                  void copySensitiveCode(currentCode, "邀请码已复制");
                }}
                onApproveAccessRequest={(id, approvedRole) =>
                  canReviewAccessRequests &&
                  approveAccessRequestMutation.mutate({ id, approved_role: approvedRole })
                }
                onRejectAccessRequest={(id) =>
                  canReviewAccessRequests &&
                  rejectAccessRequestMutation.mutate({ id, note: "店铺负责人拒绝加入申请" })
                }
              />
            ) : null}
            {canRenderSelectedSection && selectedSection === "kiosk" ? (
              <KioskDevicesSection
                key={activeStoreId}
                devices={kioskDevicesQuery.data ?? []}
                sessions={kioskSessionsQuery.data ?? []}
                canManageDevices={canManageKioskDevices}
                canReviewSessions={canReviewKioskSessions}
                isLoading={kioskDevicesQuery.isLoading || kioskSessionsQuery.isLoading}
                deviceLabel={kioskDeviceLabel}
                pairingCode={latestKioskPairingCode}
                isCreating={createKioskPairingMutation.isPending}
                isRevoking={revokeKioskDeviceMutation.isPending}
                isReviewing={
                  acceptKioskSessionMutation.isPending || returnKioskSessionMutation.isPending
                }
                onDeviceLabelChange={setKioskDeviceLabel}
                onCreatePairing={() => {
                  const label = kioskDeviceLabel.trim() || "客户 iPad";
                  const requestedStoreId = activeStoreScopeRef.current.storeId;
                  if (!requestedStoreId || !canManageKioskDevices) return;
                  const requestEpoch = kioskPairingRequestEpochRef.current + 1;
                  kioskPairingRequestEpochRef.current = requestEpoch;
                  setLatestKioskPairingCodeState(null);
                  createKioskPairingMutation.mutate({
                    input: { label },
                    requestedStoreId,
                    requestEpoch,
                  });
                }}
                onRevoke={(id) => canManageKioskDevices && revokeKioskDeviceMutation.mutate(id)}
                onAcceptSession={(id) =>
                  canReviewKioskSessions && acceptKioskSessionMutation.mutate(id)
                }
                onReturnSession={(id, reason) =>
                  canReviewKioskSessions && returnKioskSessionMutation.mutate({ id, reason })
                }
                onCopyCode={() => {
                  const currentCode = valueForActiveStore(
                    latestKioskPairingCodeState,
                    activeStoreScopeRef.current.storeId,
                  );
                  if (!currentCode) return;
                  void copySensitiveCode(currentCode, "iPad 配对码已复制");
                }}
              />
            ) : null}
            {canRenderSelectedSection && selectedSection === "notifications" ? (
              <StoreReadinessSection
                readiness={storeReadiness}
                messagePreview={messagePreview}
                printPreview={printPreview}
              />
            ) : null}
            {canRenderSelectedSection && selectedSection === "order-data" && activeStoreId ? (
              <OrderDataSection
                key={activeStoreId}
                storeId={activeStoreId}
                applyEnabled={canApplyOrderData}
              />
            ) : null}
          </div>

          <div
            className={cn(
              "min-w-0 space-y-3",
              selectedSection === "store" ||
                selectedSection === "notifications" ||
                selectedSection === "rules"
                ? ""
                : "hidden",
            )}
          >
            {canRenderSelectedSection && selectedSection === "store" ? (
              <section className={repairOs.adminSection}>
                <RepairOsSectionHeader icon={Store} iconFrame={false} title="店铺资料" />
                <div className={formLayout.grid}>
                  <Field label="店铺名" htmlFor="store-name">
                    <Input
                      id="store-name"
                      className={compactControlClass}
                      value={draft.store_name}
                      disabled={!canUpdateStoreSettings}
                      onChange={(event) =>
                        setDraftField(setDraft, "store_name", event.target.value)
                      }
                    />
                  </Field>
                  <Field label="邮箱" htmlFor="store-email" icon={Mail}>
                    <Input
                      id="store-email"
                      type="email"
                      className={compactControlClass}
                      value={draft.store_email}
                      disabled={!canUpdateStoreSettings}
                      onChange={(event) =>
                        setDraftField(setDraft, "store_email", event.target.value)
                      }
                    />
                  </Field>
                  <Field label="电话" htmlFor="store-phone" icon={Phone}>
                    <Input
                      id="store-phone"
                      className={compactControlClass}
                      value={draft.store_phone}
                      disabled={!canUpdateStoreSettings}
                      onChange={(event) =>
                        setDraftField(setDraft, "store_phone", event.target.value)
                      }
                    />
                  </Field>
                  <Field label="WhatsApp" htmlFor="store-whatsapp" icon={MessageSquare}>
                    <Input
                      id="store-whatsapp"
                      className={compactControlClass}
                      value={draft.store_whatsapp}
                      disabled={!canUpdateStoreSettings}
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
                    disabled={!canUpdateStoreSettings}
                    onChange={(event) =>
                      setDraftField(setDraft, "store_address", event.target.value)
                    }
                  />
                </Field>
              </section>
            ) : null}

            {canRenderSelectedSection && selectedSection === "rules" ? (
              <section className={repairOs.adminSection}>
                <RepairOsSectionHeader icon={Settings2} iconFrame={false} title="默认规则" />
                <div className={formLayout.grid}>
                  <Field label="维修默认质保" htmlFor="order-warranty">
                    <Select
                      value={String(draft.default_order_warranty_months)}
                      disabled={!canUpdateStoreSettings}
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
                      disabled={!canUpdateStoreSettings}
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
            ) : null}

            {canRenderSelectedSection && selectedSection === "notifications" ? (
              <section className={repairOs.adminSection}>
                <RepairOsSectionHeader icon={Printer} iconFrame={false} title="输出配置" />
                <div className="space-y-3">
                  <Field label="打印页脚" htmlFor="print-footer">
                    <Textarea
                      id="print-footer"
                      rows={3}
                      className={compactTextareaClass}
                      value={draft.print_footer}
                      disabled={!canUpdateStoreSettings}
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
                      disabled={!canUpdateStoreSettings}
                      onChange={(event) =>
                        setDraftField(setDraft, "message_signature", event.target.value)
                      }
                    />
                  </Field>
                </div>
              </section>
            ) : null}
          </div>
        </div>

        {canRenderSelectedSection && selectedSection === "workflow" ? (
          <OrderWorkflowSection
            key={activeStoreId}
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
            onCreateStatus={(input) =>
              canConfigureWorkflow && createWorkflowStatusMutation.mutate(input)
            }
            onUpdateStatus={(id, input) =>
              canConfigureWorkflow && updateWorkflowStatusMutation.mutate({ id, input })
            }
            onReorder={(items) =>
              canConfigureWorkflow && reorderWorkflowStatusesMutation.mutate({ items })
            }
            onUpdateTransitions={(input) =>
              canConfigureWorkflow && updateWorkflowTransitionsMutation.mutate(input)
            }
            canEdit={canConfigureWorkflow}
          />
        ) : null}

        {canSaveDraftInSection(selectedSection) && canUpdateStoreSettings ? (
          <div className={repairOs.adminSection}>
            <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
              <div className="min-w-0">
                <p className="truncate text-xs font-medium text-foreground">
                  {activeSection?.label ?? "当前分组"}
                </p>
                <p className="text-[11px] leading-4 text-muted-foreground">
                  {sectionDirtyState[selectedSection]
                    ? "当前分组有未保存修改，保存后会立即影响对应资料和预览。"
                    : "当前分组没有未保存修改。"}
                </p>
              </div>
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
        ) : null}
      </form>
    </RepairOsListScaffold>
  );
}

const roleLabels: Record<string, string> = {
  owner: "店主",
  manager: "经理",
  technician: "技师",
  sales: "前台",
  viewer: "只读",
};

const memberPermissionOptions: {
  action: StorePermissionAction;
  label: string;
  group: "历史与财务" | "供应商";
}[] = [
  { action: "order:archive_browse", label: "浏览历史归档", group: "历史与财务" },
  { action: "finance:aggregate_read", label: "查看业绩汇总", group: "历史与财务" },
  { action: "finance:profit_read", label: "查看成本利润", group: "历史与财务" },
  { action: "supplier:read", label: "查看供应商", group: "供应商" },
  { action: "supplier:assign", label: "选择供应商", group: "供应商" },
  { action: "supplier:manage", label: "管理供应商", group: "供应商" },
];

const memberStatusLabels: Record<string, string> = {
  active: "正常",
  inactive: "已停用",
  invited: "待接受",
};

function memberStatusLabel(status: string) {
  return memberStatusLabels[status] ?? status;
}

const accountRoleLabels: Record<string, string> = {
  owner: "最高管理员",
  manager: "管理员",
  technician: "技师",
  sales: "前台",
  viewer: "只读账号",
};

const approvedRoleOptions: ApprovedStoreRole[] = ["manager", "technician", "sales", "viewer"];
const basicRoleOptions: ApprovedStoreRole[] = ["technician", "sales", "viewer"];

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

function SettingsSectionNav({
  items,
  selectedSection,
  onSelect,
}: {
  items: ((typeof settingsSections)[number] & {
    status: string;
    count?: number;
    dirty: boolean;
  })[];
  selectedSection: SettingsSectionKey;
  onSelect: (section: SettingsSectionKey) => void;
}) {
  return (
    <nav
      aria-label="设置分组"
      className="min-w-0 rounded-xl border border-[var(--border-panel)] bg-card p-0.5 shadow-[var(--shadow-card)] md:p-1"
    >
      <div className="grid min-w-0 grid-cols-2 gap-1 sm:grid-cols-4 lg:grid-cols-5 xl:grid-cols-9">
        {items.map((item) => {
          const Icon = item.icon;
          const isActive = item.key === selectedSection;
          return (
            <button
              key={item.key}
              type="button"
              aria-pressed={isActive}
              onClick={() => onSelect(item.key)}
              className={cn(
                "relative flex min-h-11 min-w-0 items-center gap-1.5 rounded-lg border px-2 py-1.5 text-left transition-colors md:min-h-12 md:px-2.5",
                isActive
                  ? "border-primary bg-primary/10 text-primary shadow-[var(--shadow-card)]"
                  : "border-[var(--border-panel)] bg-[var(--surface-panel-muted)] text-foreground hover:bg-accent",
              )}
            >
              <span
                className={cn(
                  "grid size-5 shrink-0 place-items-center rounded-md border md:size-6 md:rounded-lg",
                  isActive
                    ? "border-primary bg-primary text-primary-foreground"
                    : "border-[var(--border-panel)] bg-card",
                )}
              >
                <Icon className="size-3 md:size-3.5" />
              </span>
              <span className="min-w-0 flex-1">
                <span className="flex min-w-0 items-center gap-1">
                  <span className="truncate text-xs font-semibold md:hidden">
                    {item.shortLabel}
                  </span>
                  <span className="hidden truncate text-[11px] font-semibold md:inline lg:text-xs">
                    {item.label}
                  </span>
                  {item.dirty ? (
                    <span
                      className={cn(
                        "size-1.5 shrink-0 rounded-full",
                        isActive ? "bg-primary" : "bg-status-warn-foreground",
                      )}
                      aria-label="有未保存修改"
                    />
                  ) : null}
                </span>
                <span
                  className={cn(
                    "mt-0.5 block truncate text-[10px] leading-3",
                    isActive ? "text-primary/80" : "text-muted-foreground",
                  )}
                >
                  {item.status}
                </span>
              </span>
              {typeof item.count === "number" ? (
                <Badge
                  variant={isActive ? "secondary" : "outline"}
                  className="h-5 shrink-0 px-1.5 text-[10px]"
                >
                  {item.count}
                </Badge>
              ) : null}
            </button>
          );
        })}
      </div>
    </nav>
  );
}

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
          <div className="flex min-w-0 flex-col gap-2 rounded-lg border border-[var(--border-panel)] bg-[var(--surface-panel-muted)] px-3 py-2 sm:flex-row sm:items-center sm:justify-between">
            <div className="min-w-0">
              <p className="text-xs font-semibold">邮箱与密码</p>
              <p className="mt-0.5 text-[11px] leading-4 text-muted-foreground">
                邮箱验证、邮箱换绑、联系手机号和密码修改统一在个人中心维护。
              </p>
            </div>
            <Button asChild type="button" variant="outline" size="sm" className="shrink-0 gap-1.5">
              <Link href="/account">
                <KeyRound className="size-3.5" />
                打开个人中心
              </Link>
            </Button>
          </div>
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
  canEdit,
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
  canEdit: boolean;
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
    if (!canEdit) return;
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
    if (!canEdit) return;
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
    <section className={cn(repairOs.adminSection, "p-2 sm:p-3")}>
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
        <div className="space-y-2">
          {canEdit ? (
            <div className="grid grid-cols-2 gap-1.5 rounded-md border border-border/60 bg-surface-muted/30 p-1.5 sm:grid-cols-[9rem_minmax(0,1fr)_7rem_8rem_6rem_auto] sm:p-2">
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
                className="h-8 text-xs"
                disabled={isSaving || !newStatus.code.trim() || !newStatus.label.trim()}
                onClick={() => {
                  onCreateStatus(newStatus);
                  setNewStatus(defaultNewStatusDraft());
                }}
              >
                <Plus className="mr-1.5 size-3.5" /> 新增状态
              </Button>
            </div>
          ) : null}

          <div className="grid min-w-0 gap-2 lg:grid-cols-[minmax(0,1fr)_minmax(18rem,0.42fr)] lg:items-start">
            <div className="grid min-w-0 grid-cols-2 gap-1.5 sm:grid-cols-3 lg:block lg:space-y-1.5">
              {statuses.map((status, index) => (
                <div key={status.id} className="min-w-0">
                  <details className="rounded-lg border border-[var(--border-panel)] bg-card p-1.5 lg:hidden">
                    <summary className="flex min-w-0 cursor-pointer list-none items-center justify-between gap-2 [&::-webkit-details-marker]:hidden">
                      <span className="min-w-0">
                        <span className="block truncate text-xs font-semibold">{status.label}</span>
                        <span className="block truncate font-mono text-[10px] text-muted-foreground">
                          {status.code}
                        </span>
                      </span>
                      <span className="flex shrink-0 items-center gap-1">
                        <Badge variant="outline" className="text-[10px]">
                          {getOrderWorkflowBucketLabel(status.bucket)}
                        </Badge>
                        {status.is_system ? (
                          <Badge variant="outline" className="hidden text-[10px] sm:inline-flex">
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
                        canEdit={canEdit}
                        onMove={moveStatus}
                        onUpdateStatus={onUpdateStatus}
                      />
                    </div>
                  </details>
                  <div className="hidden min-w-0 gap-1.5 rounded-md border border-border/60 bg-surface/60 p-1.5 lg:grid lg:grid-cols-[auto_minmax(5.75rem,1fr)_4.25rem_minmax(5.5rem,0.78fr)_4.75rem] 2xl:grid-cols-[auto_minmax(5.75rem,1fr)_4.25rem_minmax(5.5rem,0.78fr)_4.75rem_repeat(4,auto)_auto]">
                    <WorkflowStatusFields
                      status={status}
                      index={index}
                      total={statuses.length}
                      isSaving={isSaving}
                      canEdit={canEdit}
                      onMove={moveStatus}
                      onUpdateStatus={onUpdateStatus}
                    />
                  </div>
                </div>
              ))}
            </div>

            <WorkflowTransitionsPanel
              statuses={statuses}
              transitions={transitions}
              fromStatusCode={fromStatusCode}
              isSaving={isSaving}
              canEdit={canEdit}
              onFromStatusChange={setFromStatusCode}
              onUpdateTransition={updateTransitionTarget}
            />
          </div>
        </div>
      )}
    </section>
  );
}

type WorkflowStatusItem = ReturnType<typeof getWorkflowStatuses>[number];

function WorkflowTransitionsPanel({
  statuses,
  transitions,
  fromStatusCode,
  isSaving,
  canEdit,
  onFromStatusChange,
  onUpdateTransition,
}: {
  statuses: WorkflowStatusItem[];
  transitions: OrderWorkflow["transitions"];
  fromStatusCode: string;
  isSaving: boolean;
  canEdit: boolean;
  onFromStatusChange: (code: string) => void;
  onUpdateTransition: (
    toStatusCode: string,
    patch: { enabled?: boolean; is_primary?: boolean },
  ) => void;
}) {
  const renderContent = (fieldId: string) => (
    <>
      <div className="mb-2 grid gap-1.5 sm:grid-cols-[12rem_minmax(0,1fr)] sm:items-center">
        <Field label="来源状态" htmlFor={fieldId}>
          <Select value={fromStatusCode} onValueChange={onFromStatusChange}>
            <SelectTrigger id={fieldId} className="h-8 text-xs">
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
        <p className="text-[11px] leading-4 text-muted-foreground">
          勾选允许目标状态；“主”会成为推荐下一步。
        </p>
      </div>
      <div className="grid grid-cols-2 gap-1.5 lg:grid-cols-1 2xl:grid-cols-2">
        {statuses
          .filter((status) => status.code !== fromStatusCode)
          .map((status) => {
            const transition = transitions.find(
              (item) =>
                item.from_status_code === fromStatusCode && item.to_status_code === status.code,
            );
            const enabled = Boolean(transition?.enabled);
            return (
              <RepairOsBusinessCard
                as="div"
                key={status.code}
                leading={
                  <Checkbox
                    checked={enabled}
                    disabled={!canEdit || isSaving}
                    aria-label={`允许流转到 ${status.label}`}
                    onCheckedChange={(checked) =>
                      onUpdateTransition(status.code, { enabled: Boolean(checked) })
                    }
                  />
                }
                trailing={
                  <Button
                    type="button"
                    variant={transition?.is_primary ? "default" : "outline"}
                    size="sm"
                    className="h-6 px-1.5 text-[10px]"
                    disabled={!canEdit || isSaving || !enabled}
                    aria-label={`设为推荐流转到 ${status.label}`}
                    onClick={() =>
                      onUpdateTransition(status.code, {
                        enabled: true,
                        is_primary: true,
                      })
                    }
                  >
                    主
                  </Button>
                }
                className="items-center rounded-md border-border/60 bg-surface px-1.5 py-1 shadow-none hover:bg-surface"
                leadingClassName="self-center"
                bodyClassName="self-center"
                trailingClassName="shrink-0 self-center"
              >
                <span className="block truncate text-[11px]">{status.label}</span>
              </RepairOsBusinessCard>
            );
          })}
      </div>
    </>
  );

  return (
    <>
      <details
        data-ui="settings-workflow-transitions"
        className="rounded-md border border-border/60 bg-surface-muted/30 p-2 lg:hidden"
      >
        <summary className="flex cursor-pointer list-none items-center justify-between gap-2 text-xs font-semibold [&::-webkit-details-marker]:hidden">
          <span>流转规则</span>
          <Badge variant="outline" className="text-[10px]">
            {Math.max(0, statuses.length - 1)} 项
          </Badge>
        </summary>
        <div className="mt-2">{renderContent("workflow-from-status-mobile")}</div>
      </details>
      <div
        data-ui="settings-workflow-transitions"
        className="hidden rounded-md border border-border/60 bg-surface-muted/30 p-2 lg:block"
      >
        {renderContent("workflow-from-status-desktop")}
      </div>
    </>
  );
}

function WorkflowStatusFields({
  status,
  index,
  total,
  isSaving,
  canEdit,
  onMove,
  onUpdateStatus,
}: {
  status: WorkflowStatusItem;
  index: number;
  total: number;
  isSaving: boolean;
  canEdit: boolean;
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
          disabled={!canEdit || isSaving || index === 0}
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
          disabled={!canEdit || isSaving || index === total - 1}
          onClick={() => onMove(index, 1)}
          aria-label="下移状态"
        >
          <ArrowDown className="size-3.5" />
        </Button>
      </div>
      <Input
        defaultValue={status.label}
        className="h-8 text-xs"
        disabled={!canEdit}
        onBlur={(event) => {
          const label = event.target.value.trim();
          if (label && label !== status.label) onUpdateStatus(status.id, { label });
        }}
      />
      <Input
        defaultValue={status.short_label}
        className="h-8 text-xs"
        disabled={!canEdit}
        onBlur={(event) => {
          const shortLabel = event.target.value.trim();
          if (shortLabel !== status.short_label) {
            onUpdateStatus(status.id, { short_label: shortLabel });
          }
        }}
      />
      <Select
        value={status.bucket}
        disabled={!canEdit}
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
        disabled={!canEdit}
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
        disabled={!canEdit || isSaving || status.is_default_create_status}
        onChange={(checked) => onUpdateStatus(status.id, { enabled: checked })}
      />
      <WorkflowCheck
        label="列表"
        checked={status.show_in_order_filters}
        disabled={!canEdit || isSaving}
        onChange={(checked) => onUpdateStatus(status.id, { show_in_order_filters: checked })}
      />
      <WorkflowCheck
        label="新建"
        checked={status.allowed_for_create}
        disabled={!canEdit || isSaving || status.is_default_create_status}
        onChange={(checked) => onUpdateStatus(status.id, { allowed_for_create: checked })}
      />
      <WorkflowCheck
        label="默认"
        checked={status.is_default_create_status}
        disabled={!canEdit || isSaving || status.is_default_create_status || !status.enabled}
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

function CompactActionPanel({
  open,
  onOpenChange,
  title,
  summary,
  icon: Icon,
  children,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  summary: string;
  icon: typeof Store;
  children: React.ReactNode;
}) {
  return (
    <Collapsible
      open={open}
      onOpenChange={onOpenChange}
      className="min-w-0 rounded-lg border border-[var(--border-panel)] bg-[var(--surface-panel-muted)]"
    >
      <CollapsibleTrigger asChild>
        <button
          type="button"
          className="flex h-9 w-full min-w-0 items-center gap-2 px-2.5 text-left"
        >
          <span className="grid size-6 shrink-0 place-items-center rounded-md border border-[var(--border-panel)] bg-card">
            <Icon className="size-3.5 text-primary" />
          </span>
          <span className="min-w-0 flex-1">
            <span className="block truncate text-xs font-semibold">{title}</span>
            <span className="block truncate text-[10px] leading-3 text-muted-foreground">
              {summary}
            </span>
          </span>
          <ChevronDown
            className={cn(
              "size-3.5 shrink-0 text-muted-foreground transition-transform",
              open && "rotate-180",
            )}
          />
        </button>
      </CollapsibleTrigger>
      <CollapsibleContent className="border-t border-[var(--border-panel)] px-2.5 py-2">
        {children}
      </CollapsibleContent>
    </Collapsible>
  );
}

function StoreMembersSection({
  members,
  invitations,
  inviteLinks,
  accessRequests,
  activeStoreRole,
  currentUserId,
  canInviteMembers,
  canManageMembers,
  canRevokeMembers,
  canReviewAccessRequests,
  canManageMemberPermissions,
  isLoading,
  isError,
  isAccessRequestsLoading,
  inviteDraft,
  inviteLinkDraft,
  memberSearch,
  memberStatusFilter,
  memberRoleDrafts,
  accessRequestRoles,
  latestInviteCode,
  isInviting,
  isCreatingInviteLink,
  isRevokingInvitation,
  isRevokingInviteLink,
  isUpdatingMember,
  memberActionId,
  isReviewingAccessRequest,
  onInviteDraftChange,
  onInviteLinkDraftChange,
  onMemberSearchChange,
  onMemberStatusFilterChange,
  onMemberRoleDraftChange,
  onUpdateMemberPermissions,
  onAccessRequestRoleChange,
  onUpdateMemberRole,
  onDisableMember,
  onRestoreMember,
  onInvite,
  onCreateInviteLink,
  onRevokeInvitation,
  onRevokeInviteLink,
  onCopyInviteCode,
  onApproveAccessRequest,
  onRejectAccessRequest,
}: {
  members: StoreMember[];
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
  activeStoreRole?: StoreRole;
  currentUserId?: string;
  canInviteMembers: boolean;
  canManageMembers: boolean;
  canRevokeMembers: boolean;
  canReviewAccessRequests: boolean;
  canManageMemberPermissions: boolean;
  isLoading: boolean;
  isError: boolean;
  isAccessRequestsLoading: boolean;
  inviteDraft: StoreInviteInput;
  inviteLinkDraft: StoreInviteLinkCreateInput;
  memberSearch: string;
  memberStatusFilter: "all" | "active" | "inactive";
  memberRoleDrafts: Record<string, ApprovedStoreRole>;
  accessRequestRoles: Record<string, ApprovedStoreRole>;
  latestInviteCode: string;
  isInviting: boolean;
  isCreatingInviteLink: boolean;
  isRevokingInvitation: boolean;
  isRevokingInviteLink: boolean;
  isUpdatingMember: boolean;
  memberActionId: string;
  isReviewingAccessRequest: boolean;
  onInviteDraftChange: React.Dispatch<React.SetStateAction<StoreInviteInput>>;
  onInviteLinkDraftChange: React.Dispatch<React.SetStateAction<StoreInviteLinkCreateInput>>;
  onMemberSearchChange: (value: string) => void;
  onMemberStatusFilterChange: (value: "all" | "active" | "inactive") => void;
  onMemberRoleDraftChange: (id: string, role: ApprovedStoreRole) => void;
  onUpdateMemberPermissions: (id: string, permissions: StorePermissionAction[]) => void;
  onAccessRequestRoleChange: (id: string, role: ApprovedStoreRole) => void;
  onUpdateMemberRole: (id: string, role: ApprovedStoreRole) => void;
  onDisableMember: (id: string) => void;
  onRestoreMember: (id: string) => void;
  onInvite: () => void;
  onCreateInviteLink: () => void;
  onRevokeInvitation: (id: string) => void;
  onRevokeInviteLink: (id: string) => void;
  onCopyInviteCode: () => void;
  onApproveAccessRequest: (id: string, approvedRole: ApprovedStoreRole) => void;
  onRejectAccessRequest: (id: string) => void;
}) {
  const roleOptions = getRoleOptionsForActor(activeStoreRole);
  const [roleFilter, setRoleFilter] = useState<StoreRole | "all">("all");
  const [invitePanelOpen, setInvitePanelOpen] = useState(false);
  const [inviteCodePanelOpen, setInviteCodePanelOpen] = useState(false);
  const searchTerm = memberSearch.trim().toLowerCase();
  const activeCount = members.filter((member) => member.status === "active").length;
  const inactiveCount = members.filter((member) => member.status === "inactive").length;
  const filteredMembers = members.filter((member) => {
    const matchesRole = roleFilter === "all" ? true : member.role === roleFilter;
    if (!matchesRole) return false;
    const matchesStatus =
      memberStatusFilter === "all" ? true : member.status === memberStatusFilter;
    if (!matchesStatus) return false;
    if (!searchTerm) return true;
    const display = `${member.display_name ?? ""} ${member.email}`.toLowerCase();
    return display.includes(searchTerm);
  });
  const renderMemberControls = (member: StoreMember, density: "table" | "card") => {
    const draftRole = memberRoleDrafts[member.id] ?? toApprovedRole(member.role);
    const canEditRole =
      canManageMembers &&
      member.status === "active" &&
      canManageMemberRole(activeStoreRole, member, currentUserId, draftRole);
    const canChangeStatus =
      canManageMembers && canManageMemberStatus(activeStoreRole, member, currentUserId);
    const hasRoleChange = member.role !== "owner" && draftRole !== member.role;
    const isRowPending = isUpdatingMember && memberActionId === member.id;
    const memberRoleOptions = getRoleOptionsForMember(activeStoreRole, member);
    const memberPermissionValues = normalizeStorePermissionGrants(
      member.permission_grants ?? [],
      member.role,
    );
    const visiblePermissionOptions = memberPermissionOptions.filter((option) =>
      canRoleReceiveStorePermissionGrant(member.role, option.action),
    );
    const canEditMemberPermissions =
      canManageMemberPermissions && member.status === "active" && member.role !== "owner";
    const memberPermissionControls =
      canManageMemberPermissions && member.role !== "owner" && visiblePermissionOptions.length ? (
        <div
          className={cn(
            "grid min-w-0 gap-1 rounded-md border border-[var(--border-panel)] bg-[var(--surface-panel-muted)] px-1.5 py-1",
            density === "table" ? "grid-cols-3" : "grid-cols-1 sm:grid-cols-2",
          )}
        >
          {visiblePermissionOptions.map((option) => (
            <label
              key={option.action}
              className="flex min-w-0 cursor-pointer items-center gap-1.5 text-[10px] leading-3 text-muted-foreground"
            >
              <Checkbox
                className="size-3.5 rounded"
                checked={memberPermissionValues.includes(option.action)}
                disabled={!canEditMemberPermissions || isRowPending}
                onCheckedChange={(checked) =>
                  onUpdateMemberPermissions(
                    member.id,
                    nextMemberPermissions(
                      memberPermissionValues,
                      option.action,
                      Boolean(checked),
                      member.role,
                    ),
                  )
                }
              />
              <span className="min-w-0 truncate" title={`${option.group} · ${option.label}`}>
                {option.label}
              </span>
            </label>
          ))}
        </div>
      ) : null;

    if (member.role === "owner") {
      if (density === "card") return null;
      return (
        <Badge variant="default" className="w-fit text-[10px]">
          店主
        </Badge>
      );
    }

    return (
      <div className="grid min-w-0 gap-1.5">
        <div
          className={cn(
            "grid min-w-0 gap-1.5",
            density === "table"
              ? "grid-cols-[minmax(7rem,1fr)_auto_auto] items-center"
              : "grid-cols-[minmax(6.5rem,1fr)_3.5rem_4.5rem] items-center justify-end",
          )}
        >
          <Select
            value={draftRole}
            disabled={!canEditRole || !memberRoleOptions.length || isUpdatingMember}
            onValueChange={(role) => onMemberRoleDraftChange(member.id, role as ApprovedStoreRole)}
          >
            <SelectTrigger className={cn(compactControlClass, density === "table" && "h-7")}>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {memberRoleOptions.map((role) => (
                <SelectItem key={role} value={role}>
                  {roleLabels[role]}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Button
            type="button"
            size="sm"
            variant="outline"
            className={cn(
              "whitespace-nowrap px-2",
              density === "table" ? "h-7 text-xs" : "h-8 text-xs",
            )}
            disabled={!canEditRole || !hasRoleChange || isUpdatingMember}
            onClick={() => onUpdateMemberRole(member.id, draftRole)}
          >
            保存
          </Button>
          {member.status === "inactive" ? (
            <Button
              type="button"
              size="sm"
              variant="outline"
              className={cn(
                "justify-center gap-1 whitespace-nowrap px-2",
                density === "table" ? "h-7 text-xs" : "h-8 text-xs",
              )}
              disabled={!canChangeStatus || isUpdatingMember}
              onClick={() => onRestoreMember(member.id)}
            >
              <RotateCcw className="size-3.5" />
              {isRowPending ? "恢复中" : "恢复"}
            </Button>
          ) : (
            <Button
              type="button"
              size="sm"
              variant="outline"
              className={cn(
                "justify-center gap-1 whitespace-nowrap px-2 text-destructive hover:text-destructive",
                density === "table" ? "h-7 text-xs" : "h-8 text-xs",
              )}
              disabled={!canChangeStatus || isUpdatingMember}
              onClick={() => {
                if (window.confirm(`停用 ${member.display_name || member.email}？`)) {
                  onDisableMember(member.id);
                }
              }}
            >
              <UserMinus className="size-3.5" />
              {isRowPending ? "停用中" : "停用"}
            </Button>
          )}
        </div>
        {memberPermissionControls}
      </div>
    );
  };

  return (
    <section id="settings-members" className={cn(repairOs.adminSection, "p-2 sm:p-3")}>
      <RepairOsSectionHeader
        icon={Users}
        iconFrame={false}
        title="员工管理"
        className="mb-2"
        titleClassName="text-base"
      />
      {isLoading ? (
        <div className="space-y-3">
          <Skeleton className="h-10 w-full" />
          <Skeleton className="h-20 w-full" />
        </div>
      ) : isError ? (
        <div className="rounded-lg border border-dashed border-amber-300/70 bg-amber-50 px-3 py-2 text-sm text-amber-900">
          <div className="flex items-start gap-2">
            <AlertTriangle className="mt-0.5 size-4 shrink-0" />
            <div className="min-w-0">
              <p className="font-medium">无法读取员工管理</p>
              <p className="mt-0.5 text-xs leading-5 text-amber-800">
                当前账号可能没有员工管理权限，或店铺成员数据暂时读取失败。
              </p>
            </div>
          </div>
        </div>
      ) : (
        <div className="space-y-2">
          <div className="grid grid-cols-3 gap-1.5 lg:grid-cols-6">
            {[
              { label: "成员", value: members.length, hint: "已加入" },
              { label: "正常", value: activeCount, hint: "可用" },
              { label: "停用", value: inactiveCount, hint: "不可用" },
              { label: "邀请", value: invitations.length, hint: "待接受" },
              { label: "邀请码", value: inviteLinks.length, hint: "有效" },
              { label: "申请", value: accessRequests.length, hint: "待批" },
            ].map((metric) => (
              <div
                key={metric.label}
                className="grid min-h-11 min-w-0 grid-cols-[minmax(0,1fr)_auto] items-center gap-1 rounded-lg border border-[var(--border-panel)] bg-[var(--surface-panel-muted)] px-2 py-1.5"
              >
                <div className="min-w-0">
                  <div className="truncate text-[10px] font-medium leading-3 text-muted-foreground">
                    {metric.label}
                  </div>
                  <div className="truncate text-[9px] leading-3 text-muted-foreground">
                    {metric.hint}
                  </div>
                </div>
                <span className="font-mono text-base font-semibold tabular-nums leading-none">
                  {metric.value}
                </span>
              </div>
            ))}
          </div>

          <div className="grid grid-cols-[minmax(0,1fr)_6.5rem_6.5rem] gap-1.5 lg:grid-cols-[minmax(0,1fr)_10rem_10rem]">
            <div className="relative min-w-0">
              <Search className="pointer-events-none absolute left-2.5 top-1/2 size-3.5 -translate-y-1/2 text-muted-foreground" />
              <Input
                aria-label="搜索员工"
                className={cn(compactControlClass, "pl-8")}
                placeholder="搜索员工"
                value={memberSearch}
                onChange={(event) => onMemberSearchChange(event.target.value)}
              />
            </div>
            <Select
              value={roleFilter}
              onValueChange={(role) => setRoleFilter(role as StoreRole | "all")}
            >
              <SelectTrigger
                className={cn(compactControlClass, "px-2")}
                aria-label="按角色筛选员工"
              >
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">全部角色</SelectItem>
                {(["owner", "manager", "technician", "sales", "viewer"] as const).map((role) => (
                  <SelectItem key={role} value={role}>
                    {roleLabels[role]}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select
              value={memberStatusFilter}
              onValueChange={(status) =>
                onMemberStatusFilterChange(status as "all" | "active" | "inactive")
              }
            >
              <SelectTrigger
                className={cn(compactControlClass, "px-2")}
                aria-label="按状态筛选员工"
              >
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">全部状态</SelectItem>
                {(["active", "inactive"] as const).map((status) => (
                  <SelectItem key={status} value={status}>
                    {memberStatusLabel(status)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {canReviewAccessRequests && isAccessRequestsLoading ? (
            <div className="space-y-2">
              <Skeleton className="h-16 w-full" />
            </div>
          ) : canReviewAccessRequests && accessRequests.length ? (
            <div className="space-y-2">
              <div className="flex items-center justify-between gap-2">
                <p className="text-xs font-medium text-muted-foreground">加入申请</p>
                <Badge variant="outline" className="text-[10px]">
                  {accessRequests.length} 条待处理
                </Badge>
              </div>
              {accessRequests.map((request) =>
                (() => {
                  const approvedRole =
                    accessRequestRoles[request.id] ?? toApprovedRole(request.requested_role);
                  return (
                    <RepairOsBusinessCard
                      key={request.id}
                      className="grid-cols-1 gap-2 border-primary/20 bg-primary/5 px-2.5 py-2 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-center"
                      trailing={
                        <div className="grid min-w-0 gap-1.5 sm:w-56">
                          <Select
                            value={approvedRole}
                            disabled={isReviewingAccessRequest}
                            onValueChange={(role) =>
                              onAccessRequestRoleChange(request.id, role as ApprovedStoreRole)
                            }
                          >
                            <SelectTrigger className={compactControlClass}>
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              {approvedRoleOptions.map((role) => (
                                <SelectItem key={role} value={role}>
                                  {roleLabels[role]}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                          <div className="grid grid-cols-2 gap-1.5">
                            <Button
                              type="button"
                              size="sm"
                              className="h-8 gap-1"
                              disabled={isReviewingAccessRequest}
                              onClick={() => onApproveAccessRequest(request.id, approvedRole)}
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
                          目标负责人：
                          {request.target_owner_email || request.target_store_name || "-"}
                        </p>
                        {request.request_note ? (
                          <p className="line-clamp-2 text-[11px] leading-4 text-muted-foreground">
                            {request.request_note}
                          </p>
                        ) : null}
                      </div>
                    </RepairOsBusinessCard>
                  );
                })(),
              )}
            </div>
          ) : null}

          <div className="grid gap-1.5 lg:grid-cols-2">
            {canInviteMembers ? (
              <CompactActionPanel
                open={invitePanelOpen}
                onOpenChange={setInvitePanelOpen}
                title="邀请员工"
                summary={`${invitations.length} 个待接受`}
                icon={UserPlus}
              >
                <div className="grid gap-2 md:grid-cols-[minmax(0,1fr)_10rem_auto]">
                  <Field label="员工邮箱" htmlFor="invite-email">
                    <Input
                      id="invite-email"
                      type="email"
                      className={compactControlClass}
                      value={inviteDraft.email}
                      onChange={(event) =>
                        onInviteDraftChange((current) => ({
                          ...current,
                          email: event.target.value,
                        }))
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
                      disabled={!roleOptions.length}
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
                        {roleOptions.map((role) => (
                          <SelectItem key={role} value={role}>
                            {roleLabels[role]}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </Field>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    className="h-8 gap-1.5 self-end"
                    disabled={
                      isInviting || !roleOptions.length || inviteDraft.email.trim().length < 3
                    }
                    onClick={onInvite}
                  >
                    <UserPlus className="size-3.5" /> 邀请
                  </Button>
                </div>
              </CompactActionPanel>
            ) : null}

            {canInviteMembers || canRevokeMembers ? (
              <CompactActionPanel
                open={inviteCodePanelOpen}
                onOpenChange={setInviteCodePanelOpen}
                title="邀请码"
                summary={`${inviteLinks.length} 个有效`}
                icon={Plus}
              >
                <div className="grid gap-2 md:grid-cols-[minmax(0,1fr)_8rem_5rem_5rem_auto]">
                  <Field label="备注" htmlFor="invite-code-label">
                    <Input
                      id="invite-code-label"
                      className={compactControlClass}
                      value={inviteLinkDraft.label ?? ""}
                      disabled={!canInviteMembers}
                      onChange={(event) =>
                        onInviteLinkDraftChange((current) => ({
                          ...current,
                          label: event.target.value,
                        }))
                      }
                      placeholder="例如 临时员工"
                    />
                  </Field>
                  <Field label="角色" htmlFor="invite-code-role">
                    <Select
                      value={inviteLinkDraft.role}
                      disabled={!canInviteMembers || !roleOptions.length}
                      onValueChange={(role) =>
                        onInviteLinkDraftChange((current) => ({
                          ...current,
                          role: role as StoreInviteLinkCreateInput["role"],
                        }))
                      }
                    >
                      <SelectTrigger id="invite-code-role" className={compactControlClass}>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {roleOptions.map((role) => (
                          <SelectItem key={role} value={role}>
                            {roleLabels[role]}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </Field>
                  <Field label="天数" htmlFor="invite-code-days">
                    <Input
                      id="invite-code-days"
                      type="number"
                      min={1}
                      max={30}
                      className={compactControlClass}
                      value={inviteLinkDraft.expires_in_days ?? 7}
                      disabled={!canInviteMembers}
                      onChange={(event) =>
                        onInviteLinkDraftChange((current) => ({
                          ...current,
                          expires_in_days: Number(event.target.value) || 7,
                        }))
                      }
                    />
                  </Field>
                  <Field label="次数" htmlFor="invite-code-uses">
                    <Input
                      id="invite-code-uses"
                      type="number"
                      min={1}
                      max={50}
                      className={compactControlClass}
                      value={inviteLinkDraft.max_uses ?? 1}
                      disabled={!canInviteMembers}
                      onChange={(event) =>
                        onInviteLinkDraftChange((current) => ({
                          ...current,
                          max_uses: Number(event.target.value) || 1,
                        }))
                      }
                    />
                  </Field>
                  <Button
                    type="button"
                    size="sm"
                    className="h-8 gap-1.5 self-end"
                    disabled={!canInviteMembers || isCreatingInviteLink || !roleOptions.length}
                    onClick={onCreateInviteLink}
                  >
                    <Plus className="size-3.5" />
                    生成
                  </Button>
                </div>
                {latestInviteCode ? (
                  <div className="mt-2 grid gap-2 rounded-md border border-primary/20 bg-card px-2.5 py-1.5 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-center">
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
                  <div className="mt-2 grid gap-1.5">
                    {inviteLinks.map((link) => (
                      <RepairOsBusinessCard
                        key={link.id}
                        className="grid-cols-1 gap-1.5 px-2 py-1.5 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-center"
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
                              disabled={!canRevokeMembers || isRevokingInviteLink}
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
              </CompactActionPanel>
            ) : null}
          </div>

          {filteredMembers.length ? (
            <>
              <div className="hidden min-w-0 overflow-hidden rounded-lg border border-[var(--border-panel)] lg:block">
                <table className="w-full min-w-0 text-left text-xs">
                  <thead className="border-b border-[var(--border-panel)] bg-[var(--surface-panel-muted)] text-[10px] uppercase tracking-wide text-muted-foreground">
                    <tr>
                      <th className="px-2.5 py-2 font-medium">员工</th>
                      <th className="w-28 px-2.5 py-2 font-medium">角色</th>
                      <th className="w-24 px-2.5 py-2 font-medium">状态</th>
                      <th className="w-20 px-2.5 py-2 font-medium">更新</th>
                      <th className="w-[25rem] px-2.5 py-2 font-medium">操作</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredMembers.map((member) => (
                      <tr
                        key={member.id}
                        className="border-b border-[var(--border-panel)]/60 last:border-b-0 hover:bg-accent/40"
                      >
                        <td className="min-w-0 px-2.5 py-2">
                          <div className="min-w-0">
                            <p className="truncate text-xs font-medium">
                              {member.display_name || member.email}
                            </p>
                            <p
                              className="truncate text-[11px] text-muted-foreground"
                              title={member.email}
                            >
                              {member.email}
                            </p>
                          </div>
                        </td>
                        <td className="px-2.5 py-2">
                          <Badge
                            variant={member.role === "owner" ? "default" : "outline"}
                            className="text-[10px]"
                          >
                            {roleLabels[member.role] ?? member.role}
                          </Badge>
                        </td>
                        <td className="px-2.5 py-2">
                          <Badge
                            variant={member.status === "active" ? "secondary" : "outline"}
                            className="text-[10px]"
                          >
                            {memberStatusLabel(member.status)}
                          </Badge>
                        </td>
                        <td className="px-2.5 py-2 text-[11px] text-muted-foreground">
                          {formatDate(member.updated_at)}
                        </td>
                        <td className="px-2.5 py-2">{renderMemberControls(member, "table")}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              <div className="grid gap-1.5 lg:hidden">
                {filteredMembers.map((member) => (
                  <RepairOsBusinessCard
                    key={member.id}
                    className={cn(
                      "grid-cols-[minmax(0,1fr)_auto] gap-2 px-2 py-1.5 sm:grid-cols-[minmax(0,1fr)_minmax(16rem,auto)] sm:items-center",
                      member.status === "inactive" && "bg-muted/30 opacity-80",
                    )}
                    trailing={
                      <div className="grid min-w-0 gap-1.5">
                        <div className="flex flex-wrap items-center gap-1.5 sm:justify-end">
                          <Badge
                            variant={member.role === "owner" ? "default" : "outline"}
                            className="text-[10px]"
                          >
                            {roleLabels[member.role] ?? member.role}
                          </Badge>
                          <Badge
                            variant={member.status === "active" ? "secondary" : "outline"}
                            className="text-[10px]"
                          >
                            {memberStatusLabel(member.status)}
                          </Badge>
                        </div>
                        {renderMemberControls(member, "card")}
                      </div>
                    }
                    trailingClassName="min-w-0"
                  >
                    <div className="min-w-0 space-y-1">
                      <p className="truncate text-sm font-medium">
                        {member.display_name || member.email}
                      </p>
                      <p className="truncate text-xs text-muted-foreground" title={member.email}>
                        {member.email}
                      </p>
                      <div className="flex min-w-0 items-center gap-1.5">
                        <span className="truncate text-[10px] text-muted-foreground">
                          更新 {formatDate(member.updated_at)}
                        </span>
                        {member.user_id === currentUserId ? (
                          <Badge variant="outline" className="h-4 px-1 text-[9px]">
                            当前
                          </Badge>
                        ) : null}
                      </div>
                    </div>
                  </RepairOsBusinessCard>
                ))}
              </div>
            </>
          ) : (
            <div className="rounded-lg border border-[var(--border-panel)] bg-[var(--surface-panel-muted)] px-3 py-4 text-center text-xs text-muted-foreground">
              没有匹配的员工。请调整搜索或筛选条件。
            </div>
          )}

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
                        disabled={!canRevokeMembers || isRevokingInvitation}
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

const supplierColorOptions = ["#2563eb", "#16a34a", "#f59e0b", "#dc2626", "#7c3aed", "#0891b2"];

function SupplierManagementSection({
  suppliers,
  canRead,
  canManage,
  isLoading,
  isError,
  draft,
  editorId,
  isSaving,
  archivePendingId,
  onDraftChange,
  onCreate,
  onEdit,
  onCancel,
  onSave,
  onArchive,
}: {
  suppliers: Supplier[];
  canRead: boolean;
  canManage: boolean;
  isLoading: boolean;
  isError: boolean;
  draft: SupplierInput;
  editorId: string | "new" | null;
  isSaving: boolean;
  archivePendingId?: string;
  onDraftChange: (draft: SupplierInput) => void;
  onCreate: () => void;
  onEdit: (supplier: Supplier) => void;
  onCancel: () => void;
  onSave: () => void;
  onArchive: (id: string) => void;
}) {
  const activeSuppliers = suppliers.filter((supplier) => !supplier.archived_at);
  const archivedSuppliers = suppliers.filter((supplier) => supplier.archived_at);
  const isEditing = Boolean(editorId);

  return (
    <section className={cn(repairOs.adminSection, "p-2.5 sm:p-3")}>
      <RepairOsSectionHeader
        icon={PackageSearch}
        iconFrame={false}
        title="供应商"
        description={`${activeSuppliers.length} 个可选`}
        action={
          canManage ? (
            <Button
              type="button"
              size="sm"
              variant="outline"
              className="h-8 gap-1.5"
              onClick={onCreate}
            >
              <Plus className="size-3.5" /> 添加
            </Button>
          ) : null
        }
      />

      {!canRead ? (
        <div className="rounded-lg border border-[var(--border-panel)] bg-card px-3 py-3 text-xs text-muted-foreground">
          当前账号没有供应商查看权限。只有店主或被单独授权的员工可以查看供应商列表。
        </div>
      ) : !canManage ? (
        <div className="rounded-lg border border-[var(--border-panel)] bg-card px-3 py-3 text-xs text-muted-foreground">
          当前账号可以查看供应商，但不能新增、编辑或归档。管理权限需要店主在员工权限中单独授权。
        </div>
      ) : null}

      {canManage && isEditing ? (
        <div
          className="mb-3 grid gap-2 rounded-lg border border-primary/25 bg-card p-2.5 shadow-[var(--shadow-card)] md:grid-cols-2"
          onKeyDown={(event) => {
            if (event.key === "Enter") {
              event.preventDefault();
              if (draft.name.trim()) onSave();
            }
          }}
        >
          <Field label="名称" htmlFor="supplier-name">
            <Input
              id="supplier-name"
              className={compactControlClass}
              value={draft.name}
              onChange={(event) => onDraftChange({ ...draft, name: event.target.value })}
              placeholder="例如 MOBILAX"
            />
          </Field>
          <Field label="简称" htmlFor="supplier-short-name">
            <Input
              id="supplier-short-name"
              className={compactControlClass}
              value={draft.short_name ?? ""}
              onChange={(event) => onDraftChange({ ...draft, short_name: event.target.value })}
              placeholder="列表中显示"
            />
          </Field>
          <Field label="联系人" htmlFor="supplier-contact">
            <Input
              id="supplier-contact"
              className={compactControlClass}
              value={draft.contact_name ?? ""}
              onChange={(event) => onDraftChange({ ...draft, contact_name: event.target.value })}
            />
          </Field>
          <Field label="电话" htmlFor="supplier-phone">
            <Input
              id="supplier-phone"
              className={compactControlClass}
              value={draft.phone ?? ""}
              onChange={(event) => onDraftChange({ ...draft, phone: event.target.value })}
            />
          </Field>
          <Field label="邮箱" htmlFor="supplier-email">
            <Input
              id="supplier-email"
              className={compactControlClass}
              value={draft.email ?? ""}
              onChange={(event) => onDraftChange({ ...draft, email: event.target.value })}
            />
          </Field>
          <Field label="网站" htmlFor="supplier-website">
            <Input
              id="supplier-website"
              className={compactControlClass}
              value={draft.website ?? ""}
              onChange={(event) => onDraftChange({ ...draft, website: event.target.value })}
            />
          </Field>
          <div className="md:col-span-2">
            <Label className="text-[10px] font-medium text-muted-foreground">颜色</Label>
            <div className="mt-1 flex flex-wrap gap-1.5">
              {supplierColorOptions.map((color) => (
                <button
                  key={color}
                  type="button"
                  aria-label={`选择颜色 ${color}`}
                  className={cn(
                    "size-7 rounded-lg border shadow-sm",
                    draft.color === color
                      ? "border-primary ring-2 ring-primary/25"
                      : "border-border",
                  )}
                  style={{ backgroundColor: color }}
                  onClick={() => onDraftChange({ ...draft, color })}
                />
              ))}
            </div>
          </div>
          <Field label="备注" htmlFor="supplier-notes" className="md:col-span-2">
            <Textarea
              id="supplier-notes"
              className="min-h-20 text-sm"
              value={draft.notes ?? ""}
              onChange={(event) => onDraftChange({ ...draft, notes: event.target.value })}
              placeholder="内部备注，只属于当前店铺"
            />
          </Field>
          <div className="flex flex-wrap justify-end gap-2 md:col-span-2">
            <Button type="button" variant="ghost" size="sm" className="h-8" onClick={onCancel}>
              取消
            </Button>
            <Button
              type="button"
              size="sm"
              className="h-8"
              disabled={isSaving || !draft.name.trim()}
              onClick={onSave}
            >
              <Check className="mr-1.5 size-3.5" /> 保存供应商
            </Button>
          </div>
        </div>
      ) : null}

      {!canRead ? null : isLoading ? (
        <div className="grid gap-2">
          <Skeleton className="h-16 w-full" />
          <Skeleton className="h-16 w-full" />
        </div>
      ) : isError ? (
        <div className="rounded-lg border border-status-danger-foreground/25 bg-status-danger/10 px-3 py-2 text-xs text-status-danger-foreground">
          供应商读取失败，请刷新后重试。
        </div>
      ) : activeSuppliers.length === 0 ? (
        <div className="rounded-lg border border-dashed border-[var(--border-panel)] bg-card px-3 py-5 text-center">
          <PackageSearch className="mx-auto size-5 text-muted-foreground" />
          <p className="mt-2 text-sm font-semibold">暂无供应商</p>
          <p className="mt-1 text-xs text-muted-foreground">
            新店铺不会带入 Chinatech 的供应商，请按当前店铺实际合作方添加。
          </p>
        </div>
      ) : (
        <div className="grid gap-2 md:grid-cols-2 xl:grid-cols-3">
          {activeSuppliers.map((supplier) => (
            <RepairOsBusinessCard
              key={supplier.id}
              as="div"
              className="grid grid-cols-[auto_minmax(0,1fr)_auto] gap-2 rounded-lg border border-[var(--border-panel)] bg-card px-3 py-2"
              leading={
                <span
                  className="mt-1 size-3 rounded-full"
                  style={{ backgroundColor: supplier.color }}
                  aria-hidden
                />
              }
              trailing={
                canManage ? (
                  <div className="flex gap-1">
                    <Button
                      type="button"
                      size="icon"
                      variant="ghost"
                      className="size-7"
                      aria-label={`编辑 ${supplier.name}`}
                      onClick={() => onEdit(supplier)}
                    >
                      <Pencil className="size-3.5" />
                    </Button>
                    <Button
                      type="button"
                      size="icon"
                      variant="ghost"
                      className="size-7 text-muted-foreground"
                      disabled={archivePendingId === supplier.id}
                      aria-label={`归档 ${supplier.name}`}
                      onClick={() => {
                        if (window.confirm("归档后历史订单仍会显示该供应商，新订单不再可选。")) {
                          onArchive(supplier.id);
                        }
                      }}
                    >
                      <Archive className="size-3.5" />
                    </Button>
                  </div>
                ) : null
              }
            >
              <div className="min-w-0">
                <p className="truncate text-sm font-semibold">{supplier.name}</p>
                <p className="truncate text-[11px] text-muted-foreground">
                  {supplier.short_name}
                  {supplier.phone ? ` · ${supplier.phone}` : ""}
                </p>
                {supplier.notes ? (
                  <p className="mt-1 line-clamp-2 text-[10px] leading-4 text-muted-foreground">
                    {supplier.notes}
                  </p>
                ) : null}
              </div>
            </RepairOsBusinessCard>
          ))}
        </div>
      )}

      {archivedSuppliers.length ? (
        <details className="mt-3 rounded-lg border border-[var(--border-panel)] bg-card px-3 py-2 text-xs">
          <summary className="cursor-pointer font-semibold text-muted-foreground">
            已归档供应商 {archivedSuppliers.length}
          </summary>
          <div className="mt-2 grid gap-1.5">
            {archivedSuppliers.map((supplier) => (
              <div
                key={supplier.id}
                className="flex min-w-0 items-center gap-2 rounded-md bg-[var(--surface-panel-muted)] px-2 py-1.5"
              >
                <span
                  className="size-2 rounded-full opacity-60"
                  style={{ backgroundColor: supplier.color }}
                  aria-hidden
                />
                <span className="min-w-0 flex-1 truncate">{supplier.name}</span>
                <span className="shrink-0 text-[10px] text-muted-foreground">历史保留</span>
              </div>
            ))}
          </div>
        </details>
      ) : null}
    </section>
  );
}

function KioskDevicesSection({
  devices,
  sessions,
  canManageDevices,
  canReviewSessions,
  isLoading,
  deviceLabel,
  pairingCode,
  isCreating,
  isRevoking,
  isReviewing,
  onDeviceLabelChange,
  onCreatePairing,
  onRevoke,
  onAcceptSession,
  onReturnSession,
  onCopyCode,
}: {
  devices: KioskDevice[];
  sessions: KioskSession[];
  canManageDevices: boolean;
  canReviewSessions: boolean;
  isLoading: boolean;
  deviceLabel: string;
  pairingCode: string;
  isCreating: boolean;
  isRevoking: boolean;
  isReviewing: boolean;
  onDeviceLabelChange: (value: string) => void;
  onCreatePairing: () => void;
  onRevoke: (id: string) => void;
  onAcceptSession: (id: string) => void;
  onReturnSession: (id: string, reason: string) => void;
  onCopyCode: () => void;
}) {
  const activeDevices = devices.filter((device) => device.status === "active");
  const submittedSessions = sessions.filter((session) => session.status === "submitted");
  const recentSessions = sessions.slice(0, 5);
  const [returnReasons, setReturnReasons] = useState<Record<string, string>>({});

  return (
    <section className={cn(repairOs.adminSection, "p-2.5 sm:p-3")}>
      <RepairOsSectionHeader icon={TabletSmartphone} iconFrame={false} title="客户 iPad" />
      {isLoading ? (
        <div className="grid gap-2 md:grid-cols-2">
          <Skeleton className="h-24 w-full" />
          <Skeleton className="h-24 w-full" />
        </div>
      ) : (
        <div className="grid gap-3 xl:grid-cols-[minmax(0,0.9fr)_minmax(0,1.1fr)]">
          <div className="space-y-3">
            <div className="rounded-lg border border-[var(--border-panel)] bg-[var(--surface-panel-muted)] p-3">
              <Field label="新 iPad 名称" htmlFor="kiosk-device-label" icon={TabletSmartphone}>
                <div className="flex flex-col gap-2 sm:flex-row">
                  <Input
                    id="kiosk-device-label"
                    className={compactControlClass}
                    value={deviceLabel}
                    placeholder="前台 iPad"
                    maxLength={80}
                    disabled={!canManageDevices}
                    onChange={(event) => onDeviceLabelChange(event.target.value)}
                    onKeyDown={(event) => {
                      if (event.key === "Enter") {
                        event.preventDefault();
                        onCreatePairing();
                      }
                    }}
                  />
                  <Button
                    type="button"
                    size="sm"
                    className="h-8 gap-1.5"
                    disabled={!canManageDevices || isCreating}
                    onClick={onCreatePairing}
                  >
                    <Plus className="size-3.5" />
                    生成配对码
                  </Button>
                </div>
              </Field>
              <p className="mt-2 text-[11px] leading-4 text-muted-foreground">
                在 iPad 打开 /kiosk，输入配对码后会固定为客户填写模式。
              </p>
            </div>

            {pairingCode ? (
              <div className="rounded-lg border border-primary/25 bg-primary/5 p-3">
                <div className="flex min-w-0 items-center justify-between gap-2">
                  <div className="min-w-0">
                    <p className="text-[11px] font-medium text-primary">当前配对码</p>
                    <p className="mt-1 font-mono text-2xl font-semibold tracking-[0.18em]">
                      {pairingCode}
                    </p>
                  </div>
                  <Button type="button" variant="outline" size="sm" onClick={onCopyCode}>
                    复制
                  </Button>
                </div>
                <p className="mt-2 text-[11px] leading-4 text-muted-foreground">
                  配对码只显示一次，过期后请重新生成。
                </p>
              </div>
            ) : null}

            <div className="rounded-lg border border-[var(--border-panel)] bg-card p-3">
              <div className="flex items-center justify-between gap-2">
                <span className="text-xs font-semibold text-foreground">当前可用</span>
                <Badge variant="outline">{activeDevices.length} 台</Badge>
              </div>
              <p className="mt-1 text-[11px] leading-4 text-muted-foreground">
                订单页会优先发送到第一台 active iPad；多台分配规则可在下一阶段细化。
              </p>
            </div>
          </div>

          <div className="grid gap-3 lg:grid-cols-2 xl:grid-cols-1">
            <div className="space-y-2 lg:col-span-2 xl:col-span-1">
              <div className="flex items-center justify-between gap-2">
                <p className="text-xs font-semibold text-muted-foreground">待员工审核</p>
                <Badge variant={submittedSessions.length ? "default" : "outline"}>
                  {submittedSessions.length}
                </Badge>
              </div>
              {submittedSessions.length ? (
                <div className="grid gap-2">
                  {submittedSessions.map((session) => {
                    const reason = returnReasons[session.id] ?? "";
                    return (
                      <KioskReviewCard
                        key={session.id}
                        session={session}
                        reason={reason}
                        isReviewing={!canReviewSessions || isReviewing}
                        onReasonChange={(value) =>
                          setReturnReasons((current) => ({
                            ...current,
                            [session.id]: value,
                          }))
                        }
                        onAccept={() => onAcceptSession(session.id)}
                        onReturn={() => onReturnSession(session.id, reason)}
                      />
                    );
                  })}
                </div>
              ) : (
                <EmptyKioskBlock label="暂无待审核提交" />
              )}
            </div>

            <div className="space-y-2">
              <div className="flex items-center justify-between gap-2">
                <p className="text-xs font-semibold text-muted-foreground">设备列表</p>
                <Badge variant="outline">{devices.length}</Badge>
              </div>
              {devices.length ? (
                <div className="grid gap-2">
                  {devices.map((device) => (
                    <RepairOsBusinessCard
                      key={device.id}
                      as="div"
                      className="grid grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-2 rounded-lg border border-[var(--border-panel)] bg-card px-3 py-2"
                      leading={
                        <span className="grid size-8 place-items-center rounded-lg bg-primary/10 text-primary">
                          <TabletSmartphone className="size-4" />
                        </span>
                      }
                      trailing={
                        <Button
                          type="button"
                          size="sm"
                          variant="outline"
                          className="h-7 px-2 text-[11px]"
                          disabled={!canManageDevices || device.status === "revoked" || isRevoking}
                          onClick={() => onRevoke(device.id)}
                        >
                          撤销
                        </Button>
                      }
                      leadingClassName="self-center"
                      trailingClassName="justify-self-end"
                    >
                      <div className="min-w-0">
                        <div className="flex min-w-0 items-center gap-2">
                          <p className="truncate text-sm font-semibold">{device.label}</p>
                          <Badge variant={device.status === "active" ? "default" : "outline"}>
                            {kioskDeviceStatusLabel(device.status)}
                          </Badge>
                        </div>
                        <p className="mt-0.5 truncate text-[11px] text-muted-foreground">
                          {device.last_seen_at
                            ? `最后在线 ${formatDateTime(device.last_seen_at)}`
                            : device.paired_at
                              ? `已配对 ${formatDateTime(device.paired_at)}`
                              : "等待配对"}
                        </p>
                      </div>
                    </RepairOsBusinessCard>
                  ))}
                </div>
              ) : (
                <EmptyKioskBlock label="暂无 iPad 设备" />
              )}
            </div>

            <div className="space-y-2">
              <div className="flex items-center justify-between gap-2">
                <p className="text-xs font-semibold text-muted-foreground">最近任务</p>
                <Badge variant="outline">{recentSessions.length}</Badge>
              </div>
              {recentSessions.length ? (
                <div className="grid gap-2">
                  {recentSessions.map((session) => (
                    <div
                      key={session.id}
                      className="rounded-lg border border-[var(--border-panel)] bg-[var(--surface-panel-muted)] px-3 py-2"
                    >
                      <div className="flex min-w-0 items-center justify-between gap-2">
                        <span className="truncate text-xs font-semibold">
                          {kioskSessionTypeLabel(session.session_type)}
                        </span>
                        <Badge variant="outline">{kioskSessionStatusLabel(session.status)}</Badge>
                      </div>
                      <p className="mt-1 truncate text-[11px] text-muted-foreground">
                        {session.device?.label ?? "客户 iPad"} · 到期{" "}
                        {formatDateTime(session.expires_at)}
                      </p>
                    </div>
                  ))}
                </div>
              ) : (
                <EmptyKioskBlock label="暂无 iPad 任务" />
              )}
            </div>
          </div>
        </div>
      )}
    </section>
  );
}

function KioskReviewCard({
  session,
  reason,
  isReviewing,
  onReasonChange,
  onAccept,
  onReturn,
}: {
  session: KioskSession;
  reason: string;
  isReviewing: boolean;
  onReasonChange: (value: string) => void;
  onAccept: () => void;
  onReturn: () => void;
}) {
  const returnReason = reason.trim();
  const orderNo = kioskPayloadText(session.request_payload, "order_public_no");
  const deviceLabel = kioskPayloadText(session.request_payload, "device_label");
  const customerName = kioskPayloadText(session.submission_payload, "customer_name");
  const customerPhone = kioskPayloadText(session.submission_payload, "customer_phone");
  const backupPhone = kioskPayloadText(session.submission_payload, "backup_phone");
  const note = kioskPayloadText(session.submission_payload, "note");
  const hasSignature = Boolean(kioskPayloadText(session.submission_payload, "signature_data_url"));
  const confirmed = session.submission_payload?.confirmation_checked === true;

  return (
    <div className="rounded-lg border border-primary/20 bg-card px-3 py-3 shadow-[var(--shadow-card)]">
      <div className="flex min-w-0 items-start justify-between gap-2">
        <div className="min-w-0">
          <div className="flex min-w-0 flex-wrap items-center gap-2">
            <p className="truncate text-sm font-semibold">
              {kioskSessionTypeLabel(session.session_type)}
            </p>
            <Badge variant="default">待审核</Badge>
          </div>
          <p className="mt-1 truncate text-[11px] text-muted-foreground">
            {session.device?.label ?? "客户 iPad"}
            {orderNo ? ` · 工单 ${orderNo}` : ""}
            {deviceLabel ? ` · ${deviceLabel}` : ""}
          </p>
        </div>
        <p className="shrink-0 text-[11px] text-muted-foreground">
          {session.submitted_at ? formatDateTime(session.submitted_at) : "刚提交"}
        </p>
      </div>

      <div className="mt-3 grid gap-2 sm:grid-cols-2">
        <KioskReviewField label="姓名" value={customerName} />
        <KioskReviewField label="电话" value={customerPhone} icon={Phone} />
        <KioskReviewField label="备用电话" value={backupPhone} />
        <KioskReviewField label="客户确认" value={confirmed ? "已勾选" : "未勾选"} />
        <KioskReviewField label="签名" value={hasSignature ? "已签名" : "未签名"} />
        <KioskReviewField label="备注" value={note} icon={MessageSquare} />
      </div>

      <div className="mt-3 grid gap-2">
        <Label htmlFor={`kiosk-return-${session.id}`} className="text-[11px] font-medium">
          退回原因
        </Label>
        <Textarea
          id={`kiosk-return-${session.id}`}
          className="min-h-16 text-xs"
          value={reason}
          maxLength={240}
          placeholder="例如：电话号码不清楚，请客户重新填写"
          onChange={(event) => onReasonChange(event.target.value)}
        />
      </div>

      <div className="mt-3 flex flex-col gap-2 sm:flex-row sm:justify-end">
        <Button
          type="button"
          size="sm"
          variant="outline"
          className="h-8 gap-1.5"
          disabled={isReviewing || !returnReason}
          onClick={onReturn}
        >
          <RotateCcw className="size-3.5" />
          退回重填
        </Button>
        <Button
          type="button"
          size="sm"
          className="h-8 gap-1.5"
          disabled={isReviewing}
          onClick={onAccept}
        >
          <Check className="size-3.5" />
          接受并更新
        </Button>
      </div>
    </div>
  );
}

function KioskReviewField({
  label,
  value,
  icon: Icon,
}: {
  label: string;
  value?: string;
  icon?: typeof Store;
}) {
  return (
    <div className="min-w-0 rounded-md border border-[var(--border-panel)] bg-[var(--surface-panel-muted)] px-2 py-1.5">
      <p className="flex items-center gap-1 text-[10px] font-medium text-muted-foreground">
        {Icon ? <Icon className="size-3" /> : null}
        {label}
      </p>
      <p className="mt-0.5 truncate text-xs font-medium">{value || "未填写"}</p>
    </div>
  );
}

function EmptyKioskBlock({ label }: { label: string }) {
  return (
    <div className="grid min-h-20 place-items-center rounded-lg border border-dashed border-[var(--border-panel)] bg-[var(--surface-panel-muted)] px-3 py-4 text-center text-xs text-muted-foreground">
      {label}
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
    <RepairOsListScaffold
      title="设置"
      subtitle="正在读取配置"
      eyebrow="系统 / 设置"
      className="pb-28"
    >
      <div data-ui="settings-loading" className="mt-3 space-y-2.5 sm:space-y-3">
        <Skeleton className="h-32 w-full rounded-lg" />
        <Skeleton className="h-28 w-full rounded-lg" />
        <Skeleton className="h-40 w-full rounded-lg" />
      </div>
    </RepairOsListScaffold>
  );
}

function SettingsSectionAccessState({
  section,
  unavailable,
}: {
  section: SettingsSectionKey;
  unavailable: boolean;
}) {
  const sectionLabel = settingsSections.find((item) => item.key === section)?.label ?? "此设置";
  return (
    <section
      data-ui={
        unavailable ? "settings-permission-unavailable" : `settings-${section}-no-permission`
      }
      aria-label={`${sectionLabel}访问状态`}
      className="rounded-xl border border-[var(--border-panel)] bg-card px-4 py-4 shadow-[var(--shadow-card)]"
    >
      <div className="flex items-start gap-3">
        <span className="grid size-9 shrink-0 place-items-center rounded-lg bg-muted text-muted-foreground">
          <ShieldCheck className="size-4" />
        </span>
        <div className="min-w-0">
          <h2 className="text-sm font-semibold">
            {unavailable ? `无法确认${sectionLabel}权限` : `无法打开${sectionLabel}`}
          </h2>
          <p className="mt-1 text-xs leading-5 text-muted-foreground">
            {unavailable
              ? "当前店铺的权限状态不可用，请重新加载页面后再试。"
              : "当前账号不具备此分组所需的店铺权限。页面未读取或显示相关业务数据。"}
          </p>
          <Button asChild type="button" size="sm" variant="outline" className="mt-3 h-8">
            <Link href="/settings?section=account">返回账号设置</Link>
          </Button>
        </div>
      </div>
    </section>
  );
}

async function copySensitiveCode(value: string, successMessage: string) {
  try {
    if (!navigator.clipboard?.writeText) throw new Error("clipboard_unavailable");
    await navigator.clipboard.writeText(value);
    toast.success(successMessage);
  } catch {
    toast.error("复制失败，请长按或手动选择代码复制");
  }
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

function defaultSupplierDraft(): SupplierInput {
  return {
    name: "",
    short_name: "",
    color: supplierColorOptions[0],
    contact_name: "",
    phone: "",
    email: "",
    website: "",
    notes: "",
  };
}

function supplierToInput(supplier: Supplier): SupplierInput {
  return {
    name: supplier.name,
    short_name: supplier.short_name,
    color: supplier.color,
    contact_name: supplier.contact_name ?? "",
    phone: supplier.phone ?? "",
    email: supplier.email ?? "",
    website: supplier.website ?? "",
    notes: supplier.notes ?? "",
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

function formatDateTime(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  return new Intl.DateTimeFormat("zh-CN", {
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  }).format(date);
}

function kioskPayloadText(payload: Record<string, unknown> | undefined, key: string) {
  const value = payload?.[key];
  return typeof value === "string" && value.trim() ? value.trim() : "";
}

function kioskDeviceStatusLabel(status: KioskDevice["status"]) {
  const labels: Record<KioskDevice["status"], string> = {
    pairing: "配对中",
    active: "可用",
    suspended: "暂停",
    revoked: "已撤销",
  };
  return labels[status] ?? status;
}

function kioskSessionTypeLabel(type: KioskSession["session_type"]) {
  const labels: Record<KioskSession["session_type"], string> = {
    intake_contact: "客户资料",
    order_contact_signature: "工单资料",
    pickup_signature: "取机确认",
  };
  return labels[type] ?? type;
}

function kioskSessionStatusLabel(status: KioskSession["status"]) {
  const labels: Record<KioskSession["status"], string> = {
    queued: "等待",
    active: "填写中",
    submitted: "已提交",
    accepted: "已接受",
    returned: "已退回",
    cancelled: "已取消",
    expired: "已过期",
  };
  return labels[status] ?? status;
}

function toApprovedRole(role?: StoreRole): ApprovedStoreRole {
  return role && role !== "owner" ? role : "viewer";
}

function nextMemberPermissions(
  current: readonly StorePermissionAction[],
  action: StorePermissionAction,
  checked: boolean,
  role: StoreRole,
) {
  const next = new Set(normalizeStorePermissionGrants(current, role));
  if (checked) {
    next.add(action);
  } else {
    next.delete(action);
    if (action === "supplier:read") {
      next.delete("supplier:assign");
      next.delete("supplier:manage");
    }
    if (action === "supplier:assign") next.delete("supplier:manage");
    if (action === "finance:aggregate_read") next.delete("finance:profit_read");
  }
  return normalizeStorePermissionGrants(Array.from(next), role);
}

function getRoleOptionsForActor(role?: StoreRole): ApprovedStoreRole[] {
  if (role === "owner") return approvedRoleOptions;
  if (role === "manager") return basicRoleOptions;
  return [];
}

function getRoleOptionsForMember(actorRole: StoreRole | undefined, member: StoreMember) {
  if (member.role === "owner") return [];
  if (actorRole === "owner") return approvedRoleOptions;
  if (actorRole === "manager" && member.role !== "manager") return basicRoleOptions;
  return [];
}

function canManageMemberRole(
  actorRole: StoreRole | undefined,
  member: StoreMember,
  currentUserId: string | undefined,
  nextRole: ApprovedStoreRole,
) {
  if (member.role === "owner" || member.user_id === currentUserId) return false;
  if (actorRole === "owner") return true;
  if (actorRole !== "manager") return false;
  return member.role !== "manager" && nextRole !== "manager";
}

function canManageMemberStatus(
  actorRole: StoreRole | undefined,
  member: StoreMember,
  currentUserId: string | undefined,
) {
  if (member.role === "owner" || member.user_id === currentUserId) return false;
  if (actorRole === "owner") return true;
  return actorRole === "manager" && member.role !== "manager";
}
