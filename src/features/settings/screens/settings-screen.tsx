"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  Archive,
  AlertTriangle,
  ArrowLeft,
  ArrowDown,
  ArrowUp,
  Check,
  ChevronDown,
  GitBranch,
  FileSpreadsheet,
  MessageSquare,
  PackageSearch,
  Phone,
  Pencil,
  Plus,
  RotateCcw,
  Search,
  Settings2,
  ShieldCheck,
  Store,
  TabletSmartphone,
  UserMinus,
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
import { SettingsField as Field } from "@/features/settings/components/settings-field";
import { SettingsLayout } from "@/features/settings/components/settings-layout";
import {
  SettingsNavigation,
  type SettingsNavigationGroup,
} from "@/features/settings/components/settings-navigation";
import { getSettingsQueryActivation } from "@/features/settings/api/query-options";
import { ordersKeys } from "@/features/orders/api/query-keys";
import { platformKeys } from "@/features/platform/api/query-keys";
import { suppliersKeys } from "@/features/suppliers/api/query-keys";
import { resolveStoreOutputIdentity } from "@/entities/store/model/store-output-identity";
import { buildAccountSettingsSummary } from "@/features/settings/model/account-settings-summary";
import {
  getSettingsFieldError as fieldError,
  getSettingsFieldErrorId as fieldErrorId,
} from "@/features/settings/model/settings-field-errors";
import { AccountSettingsSection } from "@/features/settings/sections/account-settings-section";
import { NotificationsSettingsSection } from "@/features/settings/sections/notifications-settings-section";
import { RulesSettingsSection } from "@/features/settings/sections/rules-settings-section";
import { StoreSettingsSectionContent } from "@/features/settings/sections/store-settings-section";
import { MembersSettingsSection } from "@/features/settings/sections/members-settings-section";
import { SuppliersSettingsSection } from "@/features/settings/sections/suppliers-settings-section";
import type { MemberEditorDraft } from "@/features/settings/model/member-settings-editor";
import {
  getOrderWorkflowBucketLabel,
  getWorkflowStatuses,
} from "@/features/orders/model/order-workflow";
import {
  buildStoreMessagePreview,
  buildStorePrintPreview,
  getStoreSettingsReadiness,
} from "@/features/settings/model/store-settings-readiness";
import {
  resolveSettingsSectionAccess,
  type SettingsSectionKey,
} from "@/features/settings/model/settings-section-access";
import {
  getSettingsSection,
  parseSettingsView,
  SETTINGS_SECTION_GROUPS,
} from "@/features/settings/model/settings-section-registry";
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
  RepairDeskApiError,
  type KioskDevice,
  type KioskSession,
  type OnboardingRequest,
  type OrderWorkflow,
  type OrderWorkflowBucket,
  type OrderWorkflowStatusCreateInput,
  type OrderWorkflowTone,
  type OrderWorkflowTransitionsUpdateInput,
  type StoreInviteLinkCreateInput,
  type StoreInviteInput,
  type StoreMember,
  type StoreMembersResult,
  type ApprovedStoreRole,
  type StoreSettingsSection,
  type StoreSettingsSectionUpdateRequest,
  type Supplier,
  type SupplierInput,
} from "@/lib/repairdesk/api";
import { CACHE_TIMES } from "@/lib/query-performance";
import { cn } from "@/lib/utils";
import { brandGradientStyle, formLayout, repairOs } from "@/lib/ui-patterns";
import { SettingsOverviewScreen } from "@/features/settings/screens/settings-overview-screen";
import {
  acceptStoreSettingsSaveResult,
  buildStoreSettingsSectionUpdateRequest,
  createStoreSettingsDrafts,
  discardStoreSettingsSectionDraft,
  getDirtyStoreSettingsSections,
  hasDirtyStoreSettingsDraft,
  isStoreSettingsSectionDirty,
  materializeStoreSettingsDraft,
  rebaseStoreSettingsSectionDraft,
  reconcileIncomingStoreSettings,
  updateStoreSettingsDraft,
  type StoreSettingsDrafts,
  type StoreSettingsDraftValues,
} from "@/features/settings/model/store-settings-draft";
import { SETTINGS_ERROR_CODES } from "@/features/settings/model/store-settings-errors";
import { validateStoreSettingsSectionUpdateRequest } from "@/features/settings/model/store-settings-update-contract";
import {
  SettingsSaveBar,
  type SettingsSaveStatus,
} from "@/features/settings/components/settings-save-bar";
import { SettingsStateCard } from "@/features/settings/components/settings-state-card";
import { UnsavedSettingsGuard } from "@/features/settings/components/unsaved-settings-guard";
import {
  useNavigationGuard,
  type NavigationGuardResolution,
} from "@/components/navigation-guard-provider";

const initialSaveStatus: Record<StoreSettingsSection, SettingsSaveStatus> = {
  store: "clean",
  notifications: "clean",
  rules: "clean",
};

function canSaveDraftInSection(section: SettingsSectionKey) {
  return section === "store" || section === "notifications" || section === "rules";
}

function isStoreSettingsDraftSection(
  section: SettingsSectionKey | null,
): section is StoreSettingsSection {
  return section === "store" || section === "notifications" || section === "rules";
}

export function SettingsScreen() {
  const searchParams = useSearchParams();
  const queryClient = useQueryClient();
  const { runGuardedTransition } = useNavigationGuard();
  const storeContextQuery = useQuery({
    queryKey: storesKeys.context,
    queryFn: ({ signal }) => getStoreContext({ signal }),
    staleTime: CACHE_TIMES.shell,
  });
  const activeStoreId = storeContextQuery.data?.activeStore?.id;
  const settingsCapabilities = storeContextQuery.data?.permissions;
  const view = parseSettingsView(searchParams.get("section"));
  const selectedSection = view.kind === "section" ? view.section : null;
  const selectedDraftSection = isStoreSettingsDraftSection(selectedSection)
    ? selectedSection
    : null;
  const selectedSectionAccess = selectedSection
    ? resolveSettingsSectionAccess(selectedSection, settingsCapabilities)
    : null;
  const canRenderSelectedSection =
    selectedSectionAccess === "editable" || selectedSectionAccess === "readonly";
  const queryActivation = getSettingsQueryActivation(view, settingsCapabilities);
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
  const canReadMessageTemplates = settingsCapabilities?.canReadMessageTemplates === true;
  const settingsQuery = useQuery({
    queryKey: messageSettingsKeys.storeScoped(activeStoreId),
    queryFn: ({ signal }) => getStoreSettings({ signal }),
    staleTime: CACHE_TIMES.settings,
    enabled: Boolean(activeStoreId && queryActivation.storeSettings),
  });
  const storeMembersQuery = useQuery({
    queryKey: storesKeys.membersScoped(activeStoreId),
    queryFn: ({ signal }) => getStoreMembers({ signal }),
    staleTime: CACHE_TIMES.settings,
    enabled: Boolean(activeStoreId && queryActivation.members),
  });
  const storeAccessRequestsQuery = useQuery({
    queryKey: storesKeys.accessRequestsScoped(activeStoreId),
    queryFn: ({ signal }) => listStoreAccessRequests({ signal }),
    staleTime: CACHE_TIMES.settings,
    enabled: Boolean(activeStoreId && queryActivation.accessRequests),
  });
  const workflowQuery = useQuery({
    queryKey: ordersKeys.workflow(activeStoreId),
    queryFn: ({ signal }) => listOrderWorkflow({ signal }),
    staleTime: CACHE_TIMES.workflow,
    enabled: Boolean(activeStoreId && queryActivation.workflow),
  });
  const accountQuery = useQuery({
    queryKey: platformKeys.onboardingStatus,
    queryFn: ({ signal }) => getOnboardingStatus({ signal }),
    staleTime: CACHE_TIMES.shell,
    retry: false,
    enabled: queryActivation.account,
  });
  const kioskDevicesQuery = useQuery({
    queryKey: kioskKeys.devices(activeStoreId),
    queryFn: ({ signal }) => listKioskDevices({ signal }),
    staleTime: CACHE_TIMES.settings,
    enabled: Boolean(activeStoreId && queryActivation.kioskDevices),
  });
  const kioskSessionsQuery = useQuery({
    queryKey: kioskKeys.sessions(activeStoreId),
    queryFn: ({ signal }) => listKioskSessions({ signal }),
    staleTime: CACHE_TIMES.settings,
    enabled: Boolean(activeStoreId && queryActivation.kioskSessions),
  });
  const suppliersQuery = useQuery({
    queryKey: suppliersKeys.storeScoped(activeStoreId),
    queryFn: ({ signal }) => listSuppliers({ signal }),
    staleTime: CACHE_TIMES.settings,
    enabled: Boolean(activeStoreId && queryActivation.suppliers),
  });
  const settingsData = settingsQuery.data;
  const [settingsDrafts, setSettingsDrafts] = useState<StoreSettingsDrafts | null>(null);
  const settingsDraftsRef = useRef<StoreSettingsDrafts | null>(null);
  const saveInFlightRef = useRef(false);
  const [saveStatusBySection, setSaveStatusBySection] =
    useState<Record<StoreSettingsSection, SettingsSaveStatus>>(initialSaveStatus);
  const [settingsFieldErrors, setSettingsFieldErrors] = useState<Record<string, string[]>>({});
  const [settingsSearch, setSettingsSearch] = useState("");
  const [accountNameDraft, setAccountNameDraft] = useState("");
  const accountNameDraftRef = useRef("");
  const accountNameBaseRef = useRef("");
  const [newStoreName, setNewStoreName] = useState("");
  const [supplierActionError, setSupplierActionError] = useState("");
  const [memberActionError, setMemberActionError] = useState("");
  const [memberSaveError, setMemberSaveError] = useState("");
  const [memberSectionDirty, setMemberSectionDirty] = useState(false);
  const [supplierSectionDirty, setSupplierSectionDirty] = useState(false);
  const [latestInviteCodeState, setLatestInviteCodeState] =
    useState<StoreBoundTransientValue<string> | null>(null);
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
    settingsDraftsRef.current = null;
    setSettingsDrafts(null);
    setSaveStatusBySection(initialSaveStatus);
    setSettingsFieldErrors({});
    setSupplierActionError("");
    setMemberActionError("");
    setMemberSaveError("");
    setMemberActionId("");
    setMemberSectionDirty(false);
    setSupplierSectionDirty(false);
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
    if (!activeStoreId || !settingsData || settingsData.store_id !== activeStoreId) return;
    setSettingsDrafts((current) => {
      const next =
        current?.storeId === activeStoreId
          ? reconcileIncomingStoreSettings(current, settingsData)
          : createStoreSettingsDrafts(settingsData);
      settingsDraftsRef.current = next;
      return next;
    });
  }, [activeStoreId, settingsData]);

  useEffect(() => {
    if (!accountQuery.data) return;
    const wasDirty = isAccountNameDraftDirty(
      accountNameDraftRef.current,
      accountNameBaseRef.current,
    );
    accountNameBaseRef.current = accountQuery.data.displayName;
    if (wasDirty) return;
    accountNameDraftRef.current = accountQuery.data.displayName;
    setAccountNameDraft(accountQuery.data.displayName);
  }, [accountQuery.data]);

  const activeDrafts =
    settingsDrafts?.storeId === activeStoreId && settingsData?.store_id === activeStoreId
      ? settingsDrafts
      : null;
  const activeDraft = activeDrafts ? materializeStoreSettingsDraft(activeDrafts) : null;
  const hasChanges = selectedDraftSection
    ? isStoreSettingsSectionDirty(activeDrafts, selectedDraftSection)
    : false;
  const accountName = normalizeAccountDisplayName(accountNameDraft);
  const accountNameDirty = Boolean(
    accountQuery.data && accountName !== normalizeAccountDisplayName(accountQuery.data.displayName),
  );
  const hasAccountNameChange = Boolean(accountName && accountNameDirty);
  const latestInviteCode = valueForActiveStore(latestInviteCodeState, activeStoreId) ?? "";
  const latestKioskPairingCode =
    valueForActiveStore(latestKioskPairingCodeState, activeStoreId) ?? "";
  const sectionDirtyState = useMemo<Record<SettingsSectionKey, boolean>>(() => {
    const base = {
      account: accountNameDirty,
      store: false,
      members: memberSectionDirty,
      suppliers: supplierSectionDirty,
      kiosk: false,
      notifications: false,
      rules: false,
      workflow: false,
      "order-data": false,
    };
    return {
      ...base,
      store: isStoreSettingsSectionDirty(activeDrafts, "store"),
      notifications: isStoreSettingsSectionDirty(activeDrafts, "notifications"),
      rules: isStoreSettingsSectionDirty(activeDrafts, "rules"),
    };
  }, [accountNameDirty, activeDrafts, memberSectionDirty, supplierSectionDirty]);

  const updateSettingsField = <S extends StoreSettingsSection>(
    section: S,
    patch: Partial<StoreSettingsDraftValues[S]>,
  ) => {
    const current = settingsDraftsRef.current;
    if (!current || current.storeId !== activeStoreId) return;
    const next = updateStoreSettingsDraft(current, section, patch);
    settingsDraftsRef.current = next;
    setSettingsDrafts(next);
    setSaveStatusBySection((statuses) => ({ ...statuses, [section]: "dirty" }));
    const clearedFields = new Set(Object.keys(patch).map((field) => `input.${field}`));
    setSettingsFieldErrors((errors) =>
      Object.fromEntries(Object.entries(errors).filter(([field]) => !clearedFields.has(field))),
    );
  };

  const saveMutation = useMutation({
    mutationFn: async ({
      section,
      request,
    }: {
      section: StoreSettingsSection;
      request: StoreSettingsSectionUpdateRequest;
    }) => {
      if (!activeStoreId) throw new Error("设置未加载或店铺已切换");
      if (!canUpdateStoreSettings) throw new Error("当前账号没有修改店铺设置的权限");
      const settings = await updateStoreSettings(request);
      return { settings, requestedStoreId: activeStoreId, section };
    },
    onSuccess: ({ settings, requestedStoreId, section }) => {
      const currentStoreId = queryClient.getQueryData<{
        activeStore?: { id: string };
      }>(storesKeys.context)?.activeStore?.id;
      if (
        settings.store_id !== requestedStoreId ||
        currentStoreId !== requestedStoreId ||
        activeStoreScopeRef.current.storeId !== requestedStoreId
      ) {
        settingsDraftsRef.current = null;
        setSettingsDrafts(null);
        toast.error("店铺上下文已变化，旧设置响应未应用，请重新加载当前店铺");
        return;
      }
      toast.success("设置已保存");
      const current = settingsDraftsRef.current;
      if (current?.storeId === requestedStoreId) {
        const next = acceptStoreSettingsSaveResult(current, section, settings);
        settingsDraftsRef.current = next;
        setSettingsDrafts(next);
      }
      setSettingsFieldErrors({});
      setSaveStatusBySection((statuses) => ({ ...statuses, [section]: "saved" }));
      queryClient.setQueryData(messageSettingsKeys.storeScoped(requestedStoreId), settings);
      queryClient.invalidateQueries({ queryKey: messageSettingsKeys.store });
      queryClient.invalidateQueries({ queryKey: messageSettingsKeys.templates });
    },
    onError: (error, variables) => {
      const status: SettingsSaveStatus =
        error instanceof RepairDeskApiError && error.code === SETTINGS_ERROR_CODES.versionConflict
          ? "conflict"
          : error instanceof RepairDeskApiError &&
              error.code === SETTINGS_ERROR_CODES.validationFailed
            ? "validation-error"
            : typeof navigator !== "undefined" && navigator.onLine === false
              ? "offline"
              : "error";
      setSaveStatusBySection((statuses) => ({ ...statuses, [variables.section]: status }));
      if (error instanceof RepairDeskApiError && error.fieldErrors) {
        setSettingsFieldErrors(error.fieldErrors);
        queueMicrotask(() => focusFirstSettingsError(error.fieldErrors));
      }
      if (
        error instanceof RepairDeskApiError &&
        (error.code === SETTINGS_ERROR_CODES.versionConflict ||
          error.code === SETTINGS_ERROR_CODES.contextChanged)
      ) {
        void settingsQuery.refetch();
      }
      toast.error(error instanceof Error ? error.message : "保存失败");
    },
  });

  const saveStoreSettingsSection = async (
    section: StoreSettingsSection,
  ): Promise<NavigationGuardResolution> => {
    const current = settingsDraftsRef.current;
    if (!current || current.storeId !== activeStoreId) return { status: "blocked" };
    if (!isStoreSettingsSectionDirty(current, section)) return { status: "resolved" };
    if (saveMutation.isPending || saveInFlightRef.current) return { status: "blocked" };
    saveInFlightRef.current = true;
    try {
      const request = buildStoreSettingsSectionUpdateRequest(current, section);
      const validation = validateStoreSettingsSectionUpdateRequest(request);
      if (!validation.success) {
        setSettingsFieldErrors(validation.fieldErrors);
        setSaveStatusBySection((statuses) => ({
          ...statuses,
          [section]: "validation-error",
        }));
        queueMicrotask(() => focusFirstSettingsError(validation.fieldErrors));
        return {
          status: "blocked",
          focus: () => focusFirstSettingsError(validation.fieldErrors),
        };
      }
      await saveMutation.mutateAsync({ section, request: validation.data });
      return { status: "resolved" };
    } catch (error) {
      const fieldErrors = error instanceof RepairDeskApiError ? error.fieldErrors : undefined;
      return {
        status: "blocked",
        focus: fieldErrors ? () => focusFirstSettingsError(fieldErrors) : focusSettingsSaveState,
      };
    } finally {
      saveInFlightRef.current = false;
    }
  };

  const discardStoreSettingsSection = (section: StoreSettingsSection) => {
    const current = settingsDraftsRef.current;
    if (!current || current.storeId !== activeStoreId) return { status: "blocked" } as const;
    const next = discardStoreSettingsSectionDraft(current, section);
    settingsDraftsRef.current = next;
    setSettingsDrafts(next);
    setSettingsFieldErrors({});
    setSaveStatusBySection((statuses) => ({ ...statuses, [section]: "clean" }));
    return { status: "resolved" } as const;
  };

  const rebaseStoreSettingsSection = (section: StoreSettingsSection) => {
    const current = settingsDraftsRef.current;
    if (!current || current.storeId !== activeStoreId) return;
    const next = rebaseStoreSettingsSectionDraft(current, section);
    settingsDraftsRef.current = next;
    setSettingsDrafts(next);
    setSaveStatusBySection((statuses) => ({ ...statuses, [section]: "dirty" }));
  };

  const guardSections = getDirtyStoreSettingsSections(activeDrafts, selectedDraftSection);
  const guardSection = guardSections[0];
  const guardDirty = hasDirtyStoreSettingsDraft(activeDrafts);
  const saveAllDirtyStoreSettingsSections = async (): Promise<NavigationGuardResolution> => {
    const sections = getDirtyStoreSettingsSections(settingsDraftsRef.current, selectedDraftSection);
    for (const section of sections) {
      const resolution = await saveStoreSettingsSection(section);
      if (resolution.status === "blocked") return resolution;
    }
    return hasDirtyStoreSettingsDraft(settingsDraftsRef.current)
      ? { status: "blocked", focus: focusSettingsSaveState }
      : { status: "resolved" };
  };
  const discardAllDirtyStoreSettingsSections = (): NavigationGuardResolution => {
    const sections = getDirtyStoreSettingsSections(settingsDraftsRef.current, selectedDraftSection);
    for (const section of sections) discardStoreSettingsSection(section);
    return hasDirtyStoreSettingsDraft(settingsDraftsRef.current)
      ? { status: "blocked", focus: focusSettingsSaveState }
      : { status: "resolved" };
  };
  const updateAccountMutation = useMutation({
    mutationFn: async () => updateAccountProfile({ display_name: accountName }),
    onSuccess: async (status) => {
      toast.success("账号名称已保存");
      accountNameDraftRef.current = status.displayName;
      accountNameBaseRef.current = status.displayName;
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
  const saveAccountNameDraft = async (): Promise<NavigationGuardResolution> => {
    if (!accountNameDirty) return { status: "resolved" };
    if (!accountName) {
      return {
        status: "blocked",
        focus: () => document.getElementById("account-display-name")?.focus(),
      };
    }
    try {
      await updateAccountMutation.mutateAsync();
      return { status: "resolved" };
    } catch {
      return {
        status: "blocked",
        focus: () => document.getElementById("account-display-name")?.focus(),
      };
    }
  };
  const discardAccountNameDraft = (): NavigationGuardResolution => {
    const baseName = accountQuery.data?.displayName ?? "";
    accountNameDraftRef.current = baseName;
    accountNameBaseRef.current = baseName;
    setAccountNameDraft(baseName);
    return { status: "resolved" };
  };
  const currentStoreRequestScope = () => ({
    requestedStoreId: activeStoreScopeRef.current.storeId,
    requestEpoch: activeStoreScopeRef.current.epoch,
  });
  const isCurrentStoreRequest = (request: { requestedStoreId?: string; requestEpoch: number }) =>
    request.requestedStoreId === activeStoreScopeRef.current.storeId &&
    request.requestEpoch === activeStoreScopeRef.current.epoch;
  const reconcileMemberMutationResult = (
    request: { requestedStoreId?: string; requestEpoch: number },
    result: StoreMembersResult,
  ) => {
    const queryKey = storesKeys.membersScoped(request.requestedStoreId);
    if (!isCurrentStoreRequest(request)) {
      void queryClient.invalidateQueries({ queryKey });
      return false;
    }
    queryClient.setQueryData(queryKey, result);
    return true;
  };
  const invalidateSupplierCaches = (storeId?: string) => {
    void queryClient.invalidateQueries({ queryKey: suppliersKeys.storeScoped(storeId) });
    void queryClient.invalidateQueries({ queryKey: ordersKeys.options(storeId) });
    void queryClient.invalidateQueries({ queryKey: ordersKeys.all });
  };
  const saveSupplierMutation = useMutation({
    mutationFn: async (request: {
      input: SupplierInput;
      id?: string;
      requestedStoreId?: string;
      requestEpoch: number;
    }) => {
      if (request.id) return updateSupplier(request.id, request.input);
      return createSupplier(request.input);
    },
    onMutate: () => setSupplierActionError(""),
    onSuccess: (_supplier, request) => {
      invalidateSupplierCaches(request.requestedStoreId);
      if (!isCurrentStoreRequest(request)) return;
      setSupplierActionError("");
      toast.success(request.id ? "供应商已保存" : "供应商已添加");
    },
    onError: (error, request) => {
      if (!isCurrentStoreRequest(request)) return;
      const message = error instanceof Error ? error.message : "保存供应商失败";
      setSupplierActionError(message);
      toast.error(message);
    },
  });
  const archiveSupplierMutation = useMutation({
    mutationFn: (request: { id: string; requestedStoreId?: string; requestEpoch: number }) =>
      archiveSupplier(request.id),
    onMutate: () => setSupplierActionError(""),
    onSuccess: (_supplier, request) => {
      invalidateSupplierCaches(request.requestedStoreId);
      if (!isCurrentStoreRequest(request)) return;
      setSupplierActionError("");
      toast.success("供应商已归档");
    },
    onError: (error, request) => {
      if (!isCurrentStoreRequest(request)) return;
      const message = error instanceof Error ? error.message : "归档供应商失败";
      setSupplierActionError(message);
      toast.error(message);
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
    mutationFn: (request: {
      input: StoreInviteInput;
      requestedStoreId?: string;
      requestEpoch: number;
    }) => inviteStoreMember(request.input),
    onMutate: () => setMemberActionError(""),
    onSuccess: async (result, request) => {
      if (!reconcileMemberMutationResult(request, result)) return;
      toast.success("邀请已保存");
      await queryClient.invalidateQueries({
        queryKey: storesKeys.membersScoped(request.requestedStoreId),
      });
    },
    onError: (error, request) => {
      if (!isCurrentStoreRequest(request)) return;
      const message = error instanceof Error ? error.message : "邀请失败";
      setMemberActionError(message);
      toast.error(message);
    },
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
      const isLatestRequest =
        request.requestedStoreId === activeStoreScopeRef.current.storeId &&
        request.requestEpoch === inviteCodeRequestEpochRef.current;
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
        setMemberActionError("");
        toast.success("邀请码已生成，请复制保存");
      } else if (isLatestRequest) {
        toast.error("店铺上下文已变化，旧邀请码未显示，请重新生成");
      }
      await queryClient.invalidateQueries({
        queryKey: storesKeys.membersScoped(request.requestedStoreId),
      });
    },
    onError: (error, request) => {
      if (
        request.requestedStoreId !== activeStoreScopeRef.current.storeId ||
        request.requestEpoch !== inviteCodeRequestEpochRef.current
      ) {
        return;
      }
      const message = error instanceof Error ? error.message : "生成邀请码失败";
      setMemberActionError(message);
      toast.error(message);
    },
  });
  const revokeInviteLinkMutation = useMutation({
    mutationFn: (request: { id: string; requestedStoreId?: string; requestEpoch: number }) =>
      revokeStoreInviteLink({ id: request.id }),
    onSuccess: async (result, request) => {
      if (!reconcileMemberMutationResult(request, result)) return;
      setMemberActionError("");
      toast.success("邀请码已撤销");
      await queryClient.invalidateQueries({
        queryKey: storesKeys.membersScoped(request.requestedStoreId),
      });
    },
    onError: (error, request) => {
      if (!isCurrentStoreRequest(request)) return;
      const message = error instanceof Error ? error.message : "撤销邀请码失败";
      setMemberActionError(message);
      toast.error(message);
    },
  });
  const revokeInvitationMutation = useMutation({
    mutationFn: (request: { id: string; requestedStoreId?: string; requestEpoch: number }) =>
      revokeStoreInvitation({ id: request.id }),
    onSuccess: async (result, request) => {
      if (!reconcileMemberMutationResult(request, result)) return;
      setMemberActionError("");
      toast.success("邀请已撤销");
      await queryClient.invalidateQueries({
        queryKey: storesKeys.membersScoped(request.requestedStoreId),
      });
    },
    onError: (error, request) => {
      if (!isCurrentStoreRequest(request)) return;
      const message = error instanceof Error ? error.message : "撤销邀请失败";
      setMemberActionError(message);
      toast.error(message);
    },
  });
  const saveMemberMutation = useMutation({
    mutationFn: async (request: {
      member: StoreMember;
      draft: MemberEditorDraft;
      requestedStoreId?: string;
      requestEpoch: number;
    }) => {
      if (request.member.role !== request.draft.role) {
        return {
          kind: "role" as const,
          result: await updateStoreMemberRole({ id: request.member.id, role: request.draft.role }),
        };
      }
      return {
        kind: "permissions" as const,
        result: await updateStoreMemberPermissions({
          id: request.member.id,
          permissions: request.draft.permissions,
        }),
      };
    },
    onMutate: (request) => {
      setMemberActionId(request.member.id);
      setMemberSaveError("");
    },
    onSuccess: async ({ kind, result }, request) => {
      if (!reconcileMemberMutationResult(request, result)) return;
      toast.success(
        kind === "role" ? "员工角色已保存，请重新打开后配置额外授权" : "员工额外权限已保存",
      );
      await Promise.all([
        queryClient.invalidateQueries({
          queryKey: storesKeys.membersScoped(request.requestedStoreId),
        }),
        queryClient.invalidateQueries({ queryKey: storesKeys.context }),
        queryClient.invalidateQueries({ queryKey: platformKeys.onboardingStatus }),
        queryClient.invalidateQueries({ queryKey: ordersKeys.options(request.requestedStoreId) }),
        queryClient.invalidateQueries({ queryKey: ordersKeys.lists() }),
      ]);
    },
    onError: (error, request) => {
      if (!isCurrentStoreRequest(request)) return;
      const message = error instanceof Error ? error.message : "保存员工变更失败";
      setMemberSaveError(message);
      toast.error(message);
    },
    onSettled: (_data, _error, request) => {
      if (!isCurrentStoreRequest(request)) return;
      setMemberActionId((current) => (current === request.member.id ? "" : current));
    },
  });
  const disableMemberMutation = useMutation({
    mutationFn: (request: { id: string; requestedStoreId?: string; requestEpoch: number }) =>
      disableStoreMember({ id: request.id }),
    onMutate: (request) => {
      setMemberActionId(request.id);
      setMemberActionError("");
    },
    onSuccess: async (result, request) => {
      if (!reconcileMemberMutationResult(request, result)) return;
      toast.success("员工已停用");
      await Promise.all([
        queryClient.invalidateQueries({
          queryKey: storesKeys.membersScoped(request.requestedStoreId),
        }),
        queryClient.invalidateQueries({ queryKey: storesKeys.context }),
      ]);
    },
    onError: (error, request) => {
      if (!isCurrentStoreRequest(request)) return;
      const message = error instanceof Error ? error.message : "停用员工失败";
      setMemberActionError(message);
      toast.error(message);
    },
    onSettled: (_data, _error, request) => {
      if (!isCurrentStoreRequest(request)) return;
      setMemberActionId((current) => (current === request.id ? "" : current));
    },
  });
  const restoreMemberMutation = useMutation({
    mutationFn: (request: { id: string; requestedStoreId?: string; requestEpoch: number }) =>
      restoreStoreMember({ id: request.id }),
    onMutate: (request) => {
      setMemberActionId(request.id);
      setMemberActionError("");
    },
    onSuccess: async (result, request) => {
      if (!reconcileMemberMutationResult(request, result)) return;
      toast.success("员工已恢复");
      await Promise.all([
        queryClient.invalidateQueries({
          queryKey: storesKeys.membersScoped(request.requestedStoreId),
        }),
        queryClient.invalidateQueries({ queryKey: storesKeys.context }),
      ]);
    },
    onError: (error, request) => {
      if (!isCurrentStoreRequest(request)) return;
      const message = error instanceof Error ? error.message : "恢复员工失败";
      setMemberActionError(message);
      toast.error(message);
    },
    onSettled: (_data, _error, request) => {
      if (!isCurrentStoreRequest(request)) return;
      setMemberActionId((current) => (current === request.id ? "" : current));
    },
  });
  const approveAccessRequestMutation = useMutation({
    mutationFn: (request: {
      id: string;
      approved_role: ApprovedStoreRole;
      requestedStoreId?: string;
      requestEpoch: number;
    }) => approveStoreAccessRequest({ id: request.id, approved_role: request.approved_role }),
    onSuccess: async (result, request) => {
      if (!isCurrentStoreRequest(request)) {
        void queryClient.invalidateQueries({
          queryKey: storesKeys.accessRequestsScoped(request.requestedStoreId),
        });
        return;
      }
      queryClient.setQueryData<OnboardingRequest[]>(
        storesKeys.accessRequestsScoped(request.requestedStoreId),
        (current) => current?.filter((item) => item.id !== result.id) ?? [],
      );
      setMemberActionError("");
      toast.success("加入申请已批准");
      await Promise.all([
        queryClient.invalidateQueries({
          queryKey: storesKeys.membersScoped(request.requestedStoreId),
        }),
        queryClient.invalidateQueries({ queryKey: platformKeys.onboardingStatus }),
      ]);
    },
    onError: (error, request) => {
      if (!isCurrentStoreRequest(request)) return;
      const message = error instanceof Error ? error.message : "批准失败";
      setMemberActionError(message);
      toast.error(message);
    },
  });
  const rejectAccessRequestMutation = useMutation({
    mutationFn: (request: { id: string; requestedStoreId?: string; requestEpoch: number }) =>
      rejectStoreAccessRequest({ id: request.id, note: "店铺负责人拒绝加入申请" }),
    onSuccess: async (result, request) => {
      if (!isCurrentStoreRequest(request)) {
        void queryClient.invalidateQueries({
          queryKey: storesKeys.accessRequestsScoped(request.requestedStoreId),
        });
        return;
      }
      queryClient.setQueryData<OnboardingRequest[]>(
        storesKeys.accessRequestsScoped(request.requestedStoreId),
        (current) => current?.filter((item) => item.id !== result.id) ?? [],
      );
      setMemberActionError("");
      toast.success("加入申请已拒绝");
    },
    onError: (error, request) => {
      if (!isCurrentStoreRequest(request)) return;
      const message = error instanceof Error ? error.message : "拒绝失败";
      setMemberActionError(message);
      toast.error(message);
    },
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

  if (storeContextQuery.isLoading) {
    return <SettingsLoading />;
  }

  const supplierRows = suppliersQuery.data ?? [];
  const accountSummary = buildAccountSettingsSummary(accountQuery.data);
  const savedStoreSettings = settingsData?.store_id === activeStoreId ? settingsData : null;
  const savedStoreReadiness = savedStoreSettings
    ? getStoreSettingsReadiness(savedStoreSettings)
    : null;
  const storeSectionDraftSettings =
    savedStoreSettings && activeDrafts
      ? { ...savedStoreSettings, ...activeDrafts.sections.store.value }
      : null;
  const notificationSectionDraftSettings =
    savedStoreSettings && activeDrafts
      ? { ...savedStoreSettings, ...activeDrafts.sections.notifications.value }
      : null;
  const storeReadiness = storeSectionDraftSettings
    ? getStoreSettingsReadiness(storeSectionDraftSettings)
    : null;
  const savedStoreOutputIdentity = savedStoreSettings
    ? resolveStoreOutputIdentity({
        activeStore: storeContextQuery.data?.activeStore,
        settings: savedStoreSettings,
      })
    : null;
  const draftStoreOutputIdentity = storeSectionDraftSettings
    ? resolveStoreOutputIdentity({
        activeStore: storeContextQuery.data?.activeStore,
        settings: storeSectionDraftSettings,
      })
    : null;
  const draftNotificationOutputIdentity = notificationSectionDraftSettings
    ? resolveStoreOutputIdentity({
        activeStore: storeContextQuery.data?.activeStore,
        settings: notificationSectionDraftSettings,
      })
    : null;
  const messagePreview = notificationSectionDraftSettings
    ? buildStoreMessagePreview(notificationSectionDraftSettings)
    : "";
  const printPreview = notificationSectionDraftSettings
    ? buildStorePrintPreview(notificationSectionDraftSettings)
    : "";
  const activeSection = selectedSection ? getSettingsSection(selectedSection) : null;
  const navigationGroups: readonly SettingsNavigationGroup[] = SETTINGS_SECTION_GROUPS.map(
    (group) => ({
      key: group.key,
      label: group.label,
      items: group.sections.map((section) => {
        const access = resolveSettingsSectionAccess(section.key, settingsCapabilities);
        return {
          ...section,
          access,
          dirty: sectionDirtyState[section.key],
          summary: access === "readonly" ? "只读" : undefined,
        };
      }),
    }),
  );
  const accessibleSectionCount = navigationGroups
    .flatMap((group) => group.items)
    .filter((item) => item.access === "editable" || item.access === "readonly").length;
  const overviewReadiness =
    settingsCapabilities?.canReadStoreSettings !== true
      ? ({ state: "unavailable" } as const)
      : settingsQuery.isLoading
        ? ({ state: "loading" } as const)
        : settingsQuery.isError
          ? ({ state: "error" } as const)
          : storeReadiness
            ? ({ state: "ready", score: storeReadiness.score } as const)
            : ({ state: "unavailable" } as const);
  const canRenderDraftSection =
    canRenderSelectedSection &&
    selectedSection !== null &&
    canSaveDraftInSection(selectedSection) &&
    !settingsQuery.isLoading &&
    !settingsQuery.isError &&
    activeDraft !== null;
  const selectedSaveStatus: SettingsSaveStatus = selectedDraftSection
    ? activeDrafts?.sections[selectedDraftSection].conflict
      ? "conflict"
      : saveMutation.isPending && saveMutation.variables?.section === selectedDraftSection
        ? "saving"
        : hasChanges
          ? saveStatusBySection[selectedDraftSection] === "clean" ||
            saveStatusBySection[selectedDraftSection] === "saved"
            ? "dirty"
            : saveStatusBySection[selectedDraftSection]
          : saveStatusBySection[selectedDraftSection] === "dirty"
            ? "clean"
            : saveStatusBySection[selectedDraftSection]
    : "clean";

  return (
    <RepairOsListScaffold
      title={activeSection?.label ?? "设置"}
      subtitle={storeContextQuery.data?.activeStore?.name ?? "当前店铺"}
      eyebrow="系统 / 设置"
      mobileLeading={
        activeSection ? (
          <Link
            href="/settings"
            aria-label="返回设置总览"
            className="grid size-11 place-items-center rounded-xl border border-[var(--border-panel)] bg-card text-foreground"
          >
            <ArrowLeft className="size-4" />
          </Link>
        ) : undefined
      }
      action={
        selectedSection &&
        canSaveDraftInSection(selectedSection) &&
        canUpdateStoreSettings &&
        activeDraft ? (
          <Button
            type="button"
            size="sm"
            className="min-h-11 gap-1 rounded-lg border-0 px-3 text-xs text-primary-foreground shadow-[var(--shadow-action)]"
            style={brandGradientStyle}
            aria-label="保存设置"
            disabled={!hasChanges || saveMutation.isPending || selectedSaveStatus === "conflict"}
            onClick={() =>
              selectedDraftSection && void saveStoreSettingsSection(selectedDraftSection)
            }
          >
            <Check className="size-3.5" />
            保存
          </Button>
        ) : undefined
      }
      desktopAction={
        selectedSection &&
        canSaveDraftInSection(selectedSection) &&
        canUpdateStoreSettings &&
        activeDraft ? (
          <Button
            size="sm"
            className="h-8 shrink-0 gap-1.5 border-0 text-primary-foreground sm:h-9"
            style={brandGradientStyle}
            disabled={!hasChanges || saveMutation.isPending || selectedSaveStatus === "conflict"}
            onClick={() =>
              selectedDraftSection && void saveStoreSettingsSection(selectedDraftSection)
            }
          >
            <Check className="size-3.5" /> 保存
          </Button>
        ) : undefined
      }
      className="pb-8"
    >
      <UnsavedSettingsGuard
        id="settings-store-draft"
        dirty={guardDirty}
        isDirty={() => hasDirtyStoreSettingsDraft(settingsDraftsRef.current)}
        busy={saveMutation.isPending}
        label={
          guardSections.length > 1
            ? `${guardSections.length} 个设置分组`
            : guardSection
              ? `${getSettingsSection(guardSection).label}分组`
              : "当前设置分组"
        }
        onSave={saveAllDirtyStoreSettingsSections}
        onDiscard={discardAllDirtyStoreSettingsSections}
        onFocusFallback={focusSettingsSaveState}
      />
      <UnsavedSettingsGuard
        id="settings-account-name-draft"
        dirty={accountNameDirty}
        isDirty={() =>
          isAccountNameDraftDirty(accountNameDraftRef.current, accountNameBaseRef.current)
        }
        busy={updateAccountMutation.isPending}
        label="账号显示名称"
        onSave={saveAccountNameDraft}
        onDiscard={discardAccountNameDraft}
        onFocusFallback={() => document.getElementById("account-display-name")?.focus()}
      />
      <SettingsLayout
        activeSection={activeSection}
        rail={
          <SettingsNavigation
            groups={navigationGroups}
            activeSection={selectedSection}
            searchValue={settingsSearch}
            onSearchValueChange={setSettingsSearch}
          />
        }
      >
        {selectedSection === null ? (
          <SettingsOverviewScreen
            groups={navigationGroups}
            activeStoreName={storeContextQuery.data?.activeStore?.name}
            accessibleSectionCount={accessibleSectionCount}
            readiness={overviewReadiness}
            searchValue={settingsSearch}
            onSearchValueChange={setSettingsSearch}
          />
        ) : (
          <form
            className="space-y-3 pb-8"
            onSubmit={(event) => {
              event.preventDefault();
              if (
                selectedDraftSection &&
                hasChanges &&
                canUpdateStoreSettings &&
                !saveMutation.isPending
              ) {
                void saveStoreSettingsSection(selectedDraftSection);
              }
            }}
          >
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
                {selectedSection === "store"
                  ? "当前账号不能修改当前店铺资料，但仍可按账号资格创建新的独立店铺。"
                  : "当前账号可查看此分组，但不能修改配置。"}
              </div>
            ) : null}

            {canRenderSelectedSection && selectedSection === "account" && accountQuery.isError ? (
              <SettingsSectionDataState
                label="账号资料"
                error
                onRetry={() => void accountQuery.refetch()}
              />
            ) : null}

            {canRenderSelectedSection &&
            canSaveDraftInSection(selectedSection) &&
            (settingsQuery.isLoading || (!activeDraft && !settingsQuery.isError)) ? (
              <SettingsSectionDataState label="店铺设置" />
            ) : null}

            {canRenderSelectedSection &&
            canSaveDraftInSection(selectedSection) &&
            settingsQuery.isError ? (
              <SettingsSectionDataState
                label="店铺设置"
                error
                onRetry={() => void settingsQuery.refetch()}
              />
            ) : null}

            <div
              className={cn(
                "grid min-w-0 gap-3 xl:grid-cols-1 xl:items-start",
                selectedSection === "workflow" && "hidden",
              )}
            >
              <div className="min-w-0 space-y-3 xl:max-w-none">
                {canRenderSelectedSection &&
                selectedSection === "account" &&
                !accountQuery.isError ? (
                  <AccountSettingsSection
                    summary={accountSummary}
                    isLoading={accountQuery.isLoading}
                    nameDraft={accountNameDraft}
                    hasNameChange={hasAccountNameChange}
                    isSaving={updateAccountMutation.isPending}
                    saveError={
                      updateAccountMutation.isError
                        ? updateAccountMutation.error instanceof Error
                          ? updateAccountMutation.error.message
                          : "账号名称保存失败"
                        : undefined
                    }
                    hasSaved={updateAccountMutation.isSuccess && !hasAccountNameChange}
                    onNameDraftChange={(value) => {
                      updateAccountMutation.reset();
                      accountNameDraftRef.current = value;
                      setAccountNameDraft(value);
                    }}
                    onSave={() => {
                      if (!hasAccountNameChange || updateAccountMutation.isPending) return;
                      updateAccountMutation.mutate();
                    }}
                  />
                ) : null}
                {canRenderSelectedSection && selectedSection === "store" ? (
                  <StoreSettingsSectionContent
                    activeStoreId={storeContextQuery.data?.activeStore?.id}
                    stores={storeContextQuery.data?.stores ?? []}
                    isContextLoading={storeContextQuery.isLoading}
                    isSwitching={switchStoreMutation.isPending}
                    isCreating={createStoreMutation.isPending}
                    switchError={
                      switchStoreMutation.isError
                        ? switchStoreMutation.error instanceof Error
                          ? switchStoreMutation.error.message
                          : "切换店铺失败"
                        : undefined
                    }
                    createError={
                      createStoreMutation.isError
                        ? createStoreMutation.error instanceof Error
                          ? createStoreMutation.error.message
                          : "创建店铺失败"
                        : undefined
                    }
                    newStoreName={newStoreName}
                    onNewStoreNameChange={(value) => {
                      createStoreMutation.reset();
                      setNewStoreName(value);
                    }}
                    onSwitchStore={(storeId) => {
                      if (!storeId || storeId === storeContextQuery.data?.activeStore?.id) return;
                      const targetStore = storeContextQuery.data?.stores.find(
                        (store) => store.id === storeId,
                      );
                      runGuardedTransition({
                        kind: "store-switch",
                        label: `切换到 ${targetStore?.name ?? "其他店铺"}`,
                        run: () => switchStoreMutation.mutateAsync(storeId),
                      });
                    }}
                    onCreateStore={() => {
                      const name = newStoreName.trim();
                      if (name.length < 2) return;
                      runGuardedTransition({
                        kind: "store-create",
                        label: `创建店铺 ${name}`,
                        run: () => createStoreMutation.mutateAsync({ name }),
                      });
                    }}
                    draft={activeDrafts?.sections.store.value}
                    savedReadiness={savedStoreReadiness ?? undefined}
                    draftReadiness={storeReadiness ?? undefined}
                    savedOutputIdentity={savedStoreOutputIdentity ?? undefined}
                    draftOutputIdentity={draftStoreOutputIdentity ?? undefined}
                    isDraftDirty={sectionDirtyState.store}
                    canUpdateSettings={canUpdateStoreSettings}
                    fieldErrors={settingsFieldErrors}
                    onDraftChange={(patch) => updateSettingsField("store", patch)}
                  />
                ) : null}
                {canRenderSelectedSection && selectedSection === "suppliers" ? (
                  <SuppliersSettingsSection
                    key={activeStoreId}
                    suppliers={supplierRows}
                    canRead={canReadSuppliers}
                    canManage={canManageSuppliers}
                    isLoading={canReadSuppliers && suppliersQuery.isLoading}
                    isError={suppliersQuery.isError}
                    isSaving={saveSupplierMutation.isPending}
                    archivePendingId={
                      archiveSupplierMutation.isPending
                        ? archiveSupplierMutation.variables?.id
                        : undefined
                    }
                    actionError={supplierActionError}
                    onRetry={() => void suppliersQuery.refetch()}
                    onDirtyChange={setSupplierSectionDirty}
                    onSave={(input, id) =>
                      saveSupplierMutation
                        .mutateAsync({ ...currentStoreRequestScope(), input, id })
                        .then(() => undefined)
                    }
                    onArchive={(id) =>
                      archiveSupplierMutation
                        .mutateAsync({ ...currentStoreRequestScope(), id })
                        .then(() => undefined)
                    }
                  />
                ) : null}
                {canRenderSelectedSection && selectedSection === "members" ? (
                  <MembersSettingsSection
                    key={activeStoreId}
                    members={storeMembersQuery.data?.members ?? []}
                    invitations={storeMembersQuery.data?.invitations ?? []}
                    inviteLinks={storeMembersQuery.data?.invite_links ?? []}
                    accessRequests={storeAccessRequestsQuery.data ?? []}
                    currentMembershipId={storeContextQuery.data?.activeStore?.membershipId}
                    inviteRoleOptions={settingsCapabilities?.memberInviteRoles ?? []}
                    canInviteMembers={canInviteMembers}
                    canRevokeMembers={canRevokeMembers}
                    canReviewAccessRequests={canReviewAccessRequests}
                    isLoading={storeMembersQuery.isLoading}
                    isError={storeMembersQuery.isError}
                    isAccessRequestsLoading={storeAccessRequestsQuery.isLoading}
                    isAccessRequestsError={storeAccessRequestsQuery.isError}
                    latestInviteCode={latestInviteCode}
                    isInviting={inviteMemberMutation.isPending}
                    isCreatingInviteLink={createInviteLinkMutation.isPending}
                    isRevokingInvitation={revokeInvitationMutation.isPending}
                    isRevokingInviteLink={revokeInviteLinkMutation.isPending}
                    isSavingMember={saveMemberMutation.isPending}
                    pendingMemberId={memberActionId}
                    isReviewingAccessRequest={
                      approveAccessRequestMutation.isPending ||
                      rejectAccessRequestMutation.isPending
                    }
                    actionError={memberActionError}
                    memberSaveError={memberSaveError}
                    onDirtyChange={setMemberSectionDirty}
                    onRetryMembers={() => void storeMembersQuery.refetch()}
                    onRetryAccessRequests={() => void storeAccessRequestsQuery.refetch()}
                    onSaveMember={(member, draft) =>
                      saveMemberMutation
                        .mutateAsync({ ...currentStoreRequestScope(), member, draft })
                        .then(() => undefined)
                    }
                    onDisableMember={(id) =>
                      disableMemberMutation
                        .mutateAsync({ ...currentStoreRequestScope(), id })
                        .then(() => undefined)
                    }
                    onRestoreMember={(id) =>
                      restoreMemberMutation
                        .mutateAsync({ ...currentStoreRequestScope(), id })
                        .then(() => undefined)
                    }
                    onInvite={(input) =>
                      inviteMemberMutation
                        .mutateAsync({ ...currentStoreRequestScope(), input })
                        .then(() => undefined)
                    }
                    onCreateInviteLink={(input) => {
                      const requestedStoreId = activeStoreScopeRef.current.storeId;
                      if (!requestedStoreId || !canInviteMembers) {
                        return Promise.reject(new Error("当前账号不能生成邀请码"));
                      }
                      const requestEpoch = inviteCodeRequestEpochRef.current + 1;
                      inviteCodeRequestEpochRef.current = requestEpoch;
                      setLatestInviteCodeState(null);
                      return createInviteLinkMutation
                        .mutateAsync({ input, requestedStoreId, requestEpoch })
                        .then(() => undefined);
                    }}
                    onRevokeInvitation={(id) =>
                      revokeInvitationMutation
                        .mutateAsync({ ...currentStoreRequestScope(), id })
                        .then(() => undefined)
                    }
                    onRevokeInviteLink={(id) =>
                      revokeInviteLinkMutation
                        .mutateAsync({ ...currentStoreRequestScope(), id })
                        .then(() => undefined)
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
                      approveAccessRequestMutation
                        .mutateAsync({
                          ...currentStoreRequestScope(),
                          id,
                          approved_role: approvedRole,
                        })
                        .then(() => undefined)
                    }
                    onRejectAccessRequest={(id) =>
                      rejectAccessRequestMutation
                        .mutateAsync({ ...currentStoreRequestScope(), id })
                        .then(() => undefined)
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
                {canRenderDraftSection &&
                selectedSection === "notifications" &&
                activeDrafts &&
                savedStoreOutputIdentity &&
                draftNotificationOutputIdentity ? (
                  <NotificationsSettingsSection
                    draft={activeDrafts.sections.notifications.value}
                    savedOutputIdentity={savedStoreOutputIdentity}
                    draftOutputIdentity={draftNotificationOutputIdentity}
                    isDraftDirty={sectionDirtyState.notifications}
                    canUpdateSettings={canUpdateStoreSettings}
                    canReadMessageTemplates={canReadMessageTemplates}
                    fieldErrors={settingsFieldErrors}
                    messagePreview={messagePreview}
                    printPreview={printPreview}
                    onDraftChange={(patch) => updateSettingsField("notifications", patch)}
                  />
                ) : null}
                {canRenderDraftSection && selectedSection === "rules" && activeDrafts ? (
                  <RulesSettingsSection
                    draft={activeDrafts.sections.rules.value}
                    isDraftDirty={sectionDirtyState.rules}
                    canUpdateSettings={canUpdateStoreSettings}
                    fieldErrors={settingsFieldErrors}
                    onDraftChange={(patch) => updateSettingsField("rules", patch)}
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

            {canRenderDraftSection && canUpdateStoreSettings && selectedDraftSection ? (
              <>
                <SettingsStateCard
                  status={selectedSaveStatus}
                  fieldErrors={settingsFieldErrors}
                  onDiscard={() => discardStoreSettingsSection(selectedDraftSection)}
                  onRebase={() => rebaseStoreSettingsSection(selectedDraftSection)}
                />
                <SettingsSaveBar
                  label={activeSection?.label ?? "当前分组"}
                  status={selectedSaveStatus}
                  dirty={hasChanges}
                  disabled={saveMutation.isPending}
                  onSave={() => void saveStoreSettingsSection(selectedDraftSection)}
                  onDiscard={() => discardStoreSettingsSection(selectedDraftSection)}
                />
              </>
            ) : null}
          </form>
        )}
      </SettingsLayout>
    </RepairOsListScaffold>
  );
}

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

function SettingsSectionDataState({
  label,
  error = false,
  onRetry,
}: {
  label: string;
  error?: boolean;
  onRetry?: () => void;
}) {
  if (!error) {
    return (
      <div data-ui="settings-section-loading" className="space-y-2" aria-busy="true">
        <Skeleton className="h-20 w-full rounded-xl" />
        <Skeleton className="h-28 w-full rounded-xl" />
      </div>
    );
  }

  return (
    <RepairOsBusinessCard
      as="div"
      data-ui="settings-section-load-error"
      role="alert"
      className="grid-cols-[auto_minmax(0,1fr)_auto] border-status-danger-foreground/25 bg-status-danger/10 text-status-danger-foreground hover:bg-status-danger/10"
      leading={
        <span className="grid size-8 place-items-center rounded-lg bg-status-danger/10">
          <Settings2 className="size-4" />
        </span>
      }
      trailing={
        onRetry ? (
          <Button type="button" size="sm" variant="outline" className="h-8" onClick={onRetry}>
            重新加载
          </Button>
        ) : null
      }
    >
      <span className="block text-sm font-semibold">读取{label}失败</span>
      <span className="mt-0.5 block text-[11px] leading-4">其他设置不受影响，请重试当前分组。</span>
    </RepairOsBusinessCard>
  );
}

function SettingsSectionAccessState({
  section,
  unavailable,
}: {
  section: SettingsSectionKey;
  unavailable: boolean;
}) {
  const sectionLabel = getSettingsSection(section).label;
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
            <Link href="/settings">返回设置总览</Link>
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

function focusFirstSettingsError(fieldErrors?: Record<string, string[]>) {
  const field = Object.keys(fieldErrors ?? {})[0]?.replace(/^input\./, "");
  const controlId = field
    ? {
        store_name: "store-name",
        store_address: "store-address",
        store_phone: "store-phone",
        store_whatsapp: "store-whatsapp",
        store_email: "store-email",
        default_order_warranty_months: "order-warranty",
        default_inventory_warranty_months: "inventory-warranty",
        print_footer: "print-footer",
        message_signature: "message-signature",
      }[field]
    : undefined;
  requestAnimationFrame(() => {
    const control = controlId ? document.getElementById(controlId) : null;
    if (control) control.focus();
    else focusSettingsSaveState();
  });
}

function focusSettingsSaveState() {
  document
    .querySelector<HTMLElement>("[data-settings-save-state], [data-settings-save-bar]")
    ?.focus();
}

function normalizeAccountDisplayName(value: string) {
  return value.trim().replace(/\s+/g, " ");
}

function isAccountNameDraftDirty(value: string, base: string) {
  return normalizeAccountDisplayName(value) !== normalizeAccountDisplayName(base);
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
