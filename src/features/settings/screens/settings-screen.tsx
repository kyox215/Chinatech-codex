"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  Archive,
  ArrowLeft,
  ChevronDown,
  FileSpreadsheet,
  MessageSquare,
  PackageSearch,
  Phone,
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

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { Textarea } from "@/components/ui/textarea";
import { customersKeys } from "@/features/customers/api/query-keys";
import { aiAssistantUsageQueryOptions } from "@/features/ai-assistant/api/query-options";
import { kioskKeys } from "@/features/kiosk/api/query-keys";
import { messageSettingsKeys } from "@/features/messages/api/query-keys";
import { OrderDataSection } from "@/features/settings/components/order-data-section";
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
import { AiUsageSettingsSection } from "@/features/settings/sections/ai-usage-settings-section";
import { NotificationsSettingsSection } from "@/features/settings/sections/notifications-settings-section";
import { OrderWorkflowSettingsSection } from "@/features/settings/sections/order-workflow-settings-section";
import { RulesSettingsSection } from "@/features/settings/sections/rules-settings-section";
import { StoreSettingsSectionContent } from "@/features/settings/sections/store-settings-section";
import { MembersSettingsSection } from "@/features/settings/sections/members-settings-section";
import { SuppliersSettingsSection } from "@/features/settings/sections/suppliers-settings-section";
import {
  KioskSettingsSection,
  type KioskPairingDisplay,
} from "@/features/settings/sections/kiosk-settings-section";
import {
  areKioskReturnDraftsEqual,
  kioskReturnDraftKey,
  readKioskReturnDrafts,
  writeKioskReturnDrafts,
} from "@/features/settings/model/kiosk-return-draft";
import type { MemberEditorDraft } from "@/features/settings/model/member-settings-editor";
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
  getSettingsSectionGroups,
  parseSettingsView,
} from "@/features/settings/model/settings-section-registry";
import {
  acceptStoreBoundTransientValue,
  valueForActiveStore,
  type StoreBoundTransientValue,
} from "@/features/settings/model/store-bound-transient-state";
import { storesKeys } from "@/features/stores/api/query-keys";
import { RepairOsBusinessCard, RepairOsListScaffold, RepairOsSectionHeader } from "@/shared/ui";
import { useLocale } from "@/shared/i18n/locale-provider";
import { translateSettingsOperations, type MessageKey } from "@/shared/i18n/messages";
import type { OrderDataAccessCode } from "@/lib/repairdesk/types";
import {
  acceptKioskSession,
  createStore,
  createStoreLifecyclePreflight,
  approveStoreAccessRequest,
  archiveSupplier,
  createSupplier,
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
  updateSupplier,
  updateStoreMemberPermissions,
  updateStoreMemberRole,
  updateAccountProfile,
  updateStoreSettings,
  createKioskDevicePairing,
  RepairDeskApiError,
  type KioskDevice,
  type KioskSession,
  type OnboardingRequest,
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
import { formLayout, repairOs } from "@/lib/ui-patterns";
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

interface StoreBoundKioskReturnDrafts {
  storeId?: string;
  drafts: Record<string, string>;
}

const emptyKioskReturnDrafts: StoreBoundKioskReturnDrafts = { drafts: {} };

const orderDataAccessPresentationKeys: Record<
  OrderDataAccessCode,
  { summary: MessageKey; description: MessageKey }
> = {
  available: {
    summary: "settings.orderDataAccess.summary.available",
    description: "settings.orderDataAccess.summary.available",
  },
  available_export_only: {
    summary: "settings.orderDataAccess.summary.availableExportOnly",
    description: "settings.orderDataAccess.summary.availableExportOnly",
  },
  feature_disabled: {
    summary: "settings.orderDataAccess.summary.featureDisabled",
    description: "settings.orderDataAccess.description.featureDisabled",
  },
  store_context_required: {
    summary: "settings.orderDataAccess.summary.storeContextRequired",
    description: "settings.orderDataAccess.description.storeContextRequired",
  },
  owner_role_required: {
    summary: "settings.orderDataAccess.summary.ownerRoleRequired",
    description: "settings.orderDataAccess.description.ownerRoleRequired",
  },
  primary_owner_required: {
    summary: "settings.orderDataAccess.summary.primaryOwnerRequired",
    description: "settings.orderDataAccess.description.primaryOwnerRequired",
  },
  store_unavailable: {
    summary: "settings.orderDataAccess.summary.storeUnavailable",
    description: "settings.orderDataAccess.description.storeUnavailable",
  },
};

const unavailableOrderDataAccessPresentationKeys = {
  summary: "settings.orderDataAccess.summary.unavailable",
  description: "settings.orderDataAccess.description.unavailable",
} as const satisfies { summary: MessageKey; description: MessageKey };

function getOrderDataAccessPresentationKeys(code: OrderDataAccessCode | undefined) {
  return code ? orderDataAccessPresentationKeys[code] : unavailableOrderDataAccessPresentationKeys;
}

function canSaveDraftInSection(section: SettingsSectionKey) {
  return section === "store" || section === "notifications" || section === "rules";
}

function isStoreSettingsDraftSection(
  section: SettingsSectionKey | null,
): section is StoreSettingsSection {
  return section === "store" || section === "notifications" || section === "rules";
}

const SETTINGS_FIELDS_BY_SECTION: Record<StoreSettingsSection, ReadonlySet<string>> = {
  store: new Set([
    "input.store_name",
    "input.store_address",
    "input.store_phone",
    "input.store_whatsapp",
    "input.store_email",
    "input.public_base_url",
  ]),
  notifications: new Set(["input.message_signature", "input.print_footer"]),
  rules: new Set([
    "input.default_order_warranty_months",
    "input.default_inventory_warranty_months",
    "input.new_order_entry_mode",
  ]),
};

function sanitizeSettingsFieldErrors(
  errors: Record<string, string[]>,
  section: StoreSettingsSection,
  safeMessage: string,
) {
  return Object.fromEntries(
    Object.keys(errors)
      .filter((field) => SETTINGS_FIELDS_BY_SECTION[section].has(field))
      .map((field) => [field, [safeMessage]]),
  );
}

export function SettingsScreen() {
  const { locale, t } = useLocale();
  const operationsCopy = (
    source: Parameters<typeof translateSettingsOperations>[1],
    values?: Record<string, string | number>,
  ) => translateSettingsOperations(locale, source, values);
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
  const canManageOrderCosts = settingsCapabilities?.can_manage_order_costs === true;
  const canAllocatePartsCosts = settingsCapabilities?.canAllocatePartsCosts === true;
  const canReadCostCurrencies = settingsCapabilities?.canReadCostCurrencies === true;
  const canManageCostCurrencies = settingsCapabilities?.canManageCostCurrencies === true;
  const canPreviewCostBackfill = settingsCapabilities?.canPreviewCostBackfill === true;
  const canApplyCostBackfill = settingsCapabilities?.canApplyCostBackfill === true;
  const canReadStoreSettings = settingsCapabilities?.canReadStoreSettings === true;
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
    enabled: queryActivation.account || view.kind === "overview",
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
  const aiUsageQuery = useQuery({
    ...aiAssistantUsageQueryOptions(activeStoreId),
    enabled: Boolean(activeStoreId && queryActivation.aiUsage),
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
  const accountNameSaveLockRef = useRef(false);
  const [newStoreName, setNewStoreName] = useState("");
  const [newStoreAddress, setNewStoreAddress] = useState("");
  const [supplierActionError, setSupplierActionError] = useState("");
  const [memberActionError, setMemberActionError] = useState("");
  const [memberSaveError, setMemberSaveError] = useState("");
  const [memberSectionDirty, setMemberSectionDirty] = useState(false);
  const [supplierSectionDirty, setSupplierSectionDirty] = useState(false);
  const [workflowSectionDirty, setWorkflowSectionDirty] = useState(false);
  const [orderDataSectionDirty, setOrderDataSectionDirty] = useState(false);
  const [latestInviteCodeState, setLatestInviteCodeState] =
    useState<StoreBoundTransientValue<string> | null>(null);
  const [memberActionId, setMemberActionId] = useState("");
  const [latestKioskPairingCodeState, setLatestKioskPairingCodeState] =
    useState<StoreBoundTransientValue<KioskPairingDisplay> | null>(null);
  const [kioskReturnDraftState, setKioskReturnDraftState] =
    useState<StoreBoundKioskReturnDrafts>(emptyKioskReturnDrafts);
  const kioskReturnDraftStateRef = useRef<StoreBoundKioskReturnDrafts>(emptyKioskReturnDrafts);
  const [persistedKioskReturnDraftState, setPersistedKioskReturnDraftState] =
    useState<StoreBoundKioskReturnDrafts>(emptyKioskReturnDrafts);
  const persistedKioskReturnDraftStateRef =
    useRef<StoreBoundKioskReturnDrafts>(emptyKioskReturnDrafts);
  const activeStoreScopeRef = useRef({ storeId: activeStoreId, epoch: 0 });
  const settingsSaveAuthorityRef = useRef({
    storeId: activeStoreId,
    canRead: canReadStoreSettings,
    canUpdate: canUpdateStoreSettings,
    epoch: 0,
  });
  const currentSettingsSaveAuthority = settingsSaveAuthorityRef.current;
  if (
    currentSettingsSaveAuthority.storeId !== activeStoreId ||
    currentSettingsSaveAuthority.canRead !== canReadStoreSettings ||
    currentSettingsSaveAuthority.canUpdate !== canUpdateStoreSettings
  ) {
    settingsSaveAuthorityRef.current = {
      storeId: activeStoreId,
      canRead: canReadStoreSettings,
      canUpdate: canUpdateStoreSettings,
      epoch: currentSettingsSaveAuthority.epoch + 1,
    };
  }
  const inviteCodeRequestEpochRef = useRef(0);
  const kioskPairingRequestEpochRef = useRef(0);
  const createStoreSubmittingRef = useRef(false);
  const createStoreAttemptRef = useRef<{ fingerprint: string; requestId: string } | null>(null);
  const lifecyclePreflightSubmittingRef = useRef(false);

  useEffect(() => {
    const currentScope = activeStoreScopeRef.current;
    if (currentScope.storeId === activeStoreId) return;
    activeStoreScopeRef.current = {
      storeId: activeStoreId,
      epoch: currentScope.epoch + 1,
    };
    inviteCodeRequestEpochRef.current += 1;
    kioskPairingRequestEpochRef.current += 1;
    createStoreSubmittingRef.current = false;
    createStoreAttemptRef.current = null;
    lifecyclePreflightSubmittingRef.current = false;
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
    setWorkflowSectionDirty(false);
    setOrderDataSectionDirty(false);
  }, [activeStoreId]);

  useEffect(() => {
    if (!settingsCapabilities || canUpdateStoreSettings) return;
    createStoreSubmittingRef.current = false;
    createStoreAttemptRef.current = null;
    lifecyclePreflightSubmittingRef.current = false;
  }, [canUpdateStoreSettings, settingsCapabilities]);

  useEffect(() => {
    if (!settingsCapabilities || (canReadStoreSettings && canUpdateStoreSettings)) return;
    saveInFlightRef.current = false;
    const next =
      canReadStoreSettings && settingsData && settingsData.store_id === activeStoreId
        ? createStoreSettingsDrafts(settingsData)
        : null;
    settingsDraftsRef.current = next;
    setSettingsDrafts(next);
    setSaveStatusBySection(initialSaveStatus);
    setSettingsFieldErrors({});
  }, [
    activeStoreId,
    canReadStoreSettings,
    canUpdateStoreSettings,
    settingsCapabilities,
    settingsData,
  ]);

  useEffect(() => {
    if (!settingsCapabilities || canManageKioskDevices) return;
    kioskPairingRequestEpochRef.current += 1;
    setLatestKioskPairingCodeState(null);
  }, [canManageKioskDevices, settingsCapabilities]);

  useEffect(() => {
    const next =
      activeStoreId && canReviewKioskSessions
        ? {
            storeId: activeStoreId,
            drafts: readKioskReturnDrafts(window.sessionStorage, activeStoreId),
          }
        : emptyKioskReturnDrafts;
    kioskReturnDraftStateRef.current = next;
    persistedKioskReturnDraftStateRef.current = next;
    setKioskReturnDraftState(next);
    setPersistedKioskReturnDraftState(next);
  }, [activeStoreId, canReviewKioskSessions]);

  useEffect(() => {
    if (!settingsCapabilities || canReviewKioskSessions || !activeStoreId) return;
    const next = { storeId: activeStoreId, drafts: {} };
    kioskReturnDraftStateRef.current = next;
    persistedKioskReturnDraftStateRef.current = next;
    setKioskReturnDraftState(next);
    setPersistedKioskReturnDraftState(next);
    try {
      writeKioskReturnDrafts(window.sessionStorage, activeStoreId, {});
    } catch {
      // Permission loss still clears in-memory customer content; storage cleanup is best-effort.
    }
  }, [activeStoreId, canReviewKioskSessions, settingsCapabilities]);

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
  const latestKioskPairing =
    valueForActiveStore(latestKioskPairingCodeState, activeStoreId) ?? undefined;
  const kioskReturnDrafts =
    kioskReturnDraftState.storeId === activeStoreId ? kioskReturnDraftState.drafts : {};
  const persistedKioskReturnDrafts =
    persistedKioskReturnDraftState.storeId === activeStoreId
      ? persistedKioskReturnDraftState.drafts
      : {};
  const kioskReturnDraftDirty = !areKioskReturnDraftsEqual(
    kioskReturnDrafts,
    persistedKioskReturnDrafts,
  );
  const sectionDirtyState = useMemo<Record<SettingsSectionKey, boolean>>(() => {
    const base = {
      account: accountNameDirty,
      store: false,
      members: memberSectionDirty,
      suppliers: supplierSectionDirty,
      kiosk: kioskReturnDraftDirty,
      notifications: false,
      rules: false,
      workflow: workflowSectionDirty,
      "ai-usage": false,
      "order-data": orderDataSectionDirty,
    };
    return {
      ...base,
      store: isStoreSettingsSectionDirty(activeDrafts, "store"),
      notifications: isStoreSettingsSectionDirty(activeDrafts, "notifications"),
      rules: isStoreSettingsSectionDirty(activeDrafts, "rules"),
    };
  }, [
    accountNameDirty,
    activeDrafts,
    kioskReturnDraftDirty,
    memberSectionDirty,
    supplierSectionDirty,
    orderDataSectionDirty,
    workflowSectionDirty,
  ]);

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
      authorityEpoch,
    }: {
      section: StoreSettingsSection;
      request: StoreSettingsSectionUpdateRequest;
      authorityEpoch: number;
    }) => {
      const authority = settingsSaveAuthorityRef.current;
      if (
        !authority.storeId ||
        authority.storeId !== request.expectedStoreId ||
        authority.epoch !== authorityEpoch ||
        !authority.canRead ||
        !authority.canUpdate
      ) {
        throw new Error("settings_store_update_forbidden");
      }
      const settings = await updateStoreSettings(request);
      return {
        settings,
        requestedStoreId: request.expectedStoreId,
        requestAuthorityEpoch: authorityEpoch,
        section,
      };
    },
    onSuccess: ({ settings, requestedStoreId, requestAuthorityEpoch, section }) => {
      const currentContext = queryClient.getQueryData<Awaited<ReturnType<typeof getStoreContext>>>(
        storesKeys.context,
      );
      const authority = settingsSaveAuthorityRef.current;
      if (
        settings.store_id !== requestedStoreId ||
        currentContext?.activeStore?.id !== requestedStoreId ||
        currentContext.permissions?.canReadStoreSettings !== true ||
        currentContext.permissions?.canUpdateStoreSettings !== true ||
        authority.storeId !== requestedStoreId ||
        authority.epoch !== requestAuthorityEpoch ||
        !authority.canRead ||
        !authority.canUpdate
      ) {
        return;
      }
      toast.success(
        section === "rules"
          ? operationsCopy("设置已保存；接单模式将在下次打开快速接单时生效")
          : operationsCopy("设置已保存"),
      );
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
      const currentContext = queryClient.getQueryData<Awaited<ReturnType<typeof getStoreContext>>>(
        storesKeys.context,
      );
      const authority = settingsSaveAuthorityRef.current;
      if (
        currentContext?.activeStore?.id !== variables.request.expectedStoreId ||
        currentContext.permissions?.canReadStoreSettings !== true ||
        currentContext.permissions?.canUpdateStoreSettings !== true ||
        authority.storeId !== variables.request.expectedStoreId ||
        authority.epoch !== variables.authorityEpoch ||
        !authority.canRead ||
        !authority.canUpdate
      ) {
        return;
      }
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
        const safeFieldErrors = sanitizeSettingsFieldErrors(
          error.fieldErrors,
          variables.section,
          t("settings.save.status.validation"),
        );
        setSettingsFieldErrors(safeFieldErrors);
        queueMicrotask(() => focusFirstSettingsError(safeFieldErrors));
      }
      if (
        error instanceof RepairDeskApiError &&
        (error.code === SETTINGS_ERROR_CODES.versionConflict ||
          error.code === SETTINGS_ERROR_CODES.contextChanged)
      ) {
        void settingsQuery.refetch();
      }
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
      const authority = settingsSaveAuthorityRef.current;
      if (
        authority.storeId !== validation.data.expectedStoreId ||
        !authority.canRead ||
        !authority.canUpdate
      ) {
        return { status: "blocked" };
      }
      await saveMutation.mutateAsync({
        section,
        request: validation.data,
        authorityEpoch: authority.epoch,
      });
      return { status: "resolved" };
    } catch (error) {
      const fieldErrors =
        error instanceof RepairDeskApiError && error.fieldErrors
          ? sanitizeSettingsFieldErrors(
              error.fieldErrors,
              section,
              t("settings.save.status.validation"),
            )
          : undefined;
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
      toast.success(t("settings.accountSection.saved"));
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
    onError: () => toast.error(t("settings.accountSection.saveErrorShort")),
  });
  const updateAccountNameOnce = async () => {
    if (accountNameSaveLockRef.current) return false;
    accountNameSaveLockRef.current = true;
    try {
      await updateAccountMutation.mutateAsync();
      return true;
    } finally {
      accountNameSaveLockRef.current = false;
    }
  };
  const saveAccountNameDraft = async (): Promise<NavigationGuardResolution> => {
    if (!accountNameDirty) return { status: "resolved" };
    if (!accountName) {
      return {
        status: "blocked",
        focus: () => document.getElementById("account-display-name")?.focus(),
      };
    }
    try {
      if (!(await updateAccountNameOnce())) {
        return {
          status: "blocked",
          focus: () => document.getElementById("account-display-name")?.focus(),
        };
      }
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
  const focusKioskReturnDraft = () =>
    document.querySelector<HTMLTextAreaElement>('textarea[id^="kiosk-return-"]')?.focus();
  const isKioskReturnDraftDirty = () => {
    const storeId = activeStoreScopeRef.current.storeId;
    const current = kioskReturnDraftStateRef.current;
    const persisted = persistedKioskReturnDraftStateRef.current;
    if (!storeId || current.storeId !== storeId || persisted.storeId !== storeId) return false;
    return !areKioskReturnDraftsEqual(current.drafts, persisted.drafts);
  };
  const updateKioskReturnDraft = (session: KioskSession, value: string) => {
    const storeId = activeStoreScopeRef.current.storeId;
    const current = kioskReturnDraftStateRef.current;
    if (!storeId || current.storeId !== storeId || session.store_id !== storeId) return;
    const key = kioskReturnDraftKey(session);
    const drafts = { ...current.drafts };
    if (value.length > 0) drafts[key] = value.slice(0, 240);
    else delete drafts[key];
    const next = { storeId, drafts };
    kioskReturnDraftStateRef.current = next;
    setKioskReturnDraftState(next);
  };
  const consumeKioskReturnDraft = (session: KioskSession) => {
    const storeId = activeStoreScopeRef.current.storeId;
    const current = kioskReturnDraftStateRef.current;
    const persisted = persistedKioskReturnDraftStateRef.current;
    if (!storeId || current.storeId !== storeId || session.store_id !== storeId) return;
    const key = kioskReturnDraftKey(session);
    const currentDrafts = { ...current.drafts };
    delete currentDrafts[key];
    const nextCurrent = { storeId, drafts: currentDrafts };
    kioskReturnDraftStateRef.current = nextCurrent;
    setKioskReturnDraftState(nextCurrent);
    if (persisted.storeId !== storeId) return;
    const persistedDrafts = { ...persisted.drafts };
    delete persistedDrafts[key];
    const nextPersisted = { storeId, drafts: persistedDrafts };
    persistedKioskReturnDraftStateRef.current = nextPersisted;
    setPersistedKioskReturnDraftState(nextPersisted);
    try {
      writeKioskReturnDrafts(window.sessionStorage, storeId, persistedDrafts);
    } catch {
      toast.warning(operationsCopy("审核已完成，但本机退回原因草稿清理失败"));
    }
  };
  const saveKioskReturnDrafts = async (): Promise<NavigationGuardResolution> => {
    const storeId = activeStoreScopeRef.current.storeId;
    const current = kioskReturnDraftStateRef.current;
    if (!storeId || current.storeId !== storeId) {
      return { status: "blocked", focus: focusKioskReturnDraft };
    }
    try {
      writeKioskReturnDrafts(window.sessionStorage, storeId, current.drafts);
      const next = { storeId, drafts: { ...current.drafts } };
      persistedKioskReturnDraftStateRef.current = next;
      setPersistedKioskReturnDraftState(next);
      return { status: "resolved" };
    } catch {
      return { status: "blocked", focus: focusKioskReturnDraft };
    }
  };
  const discardKioskReturnDrafts = (): NavigationGuardResolution => {
    const storeId = activeStoreScopeRef.current.storeId;
    const persisted = persistedKioskReturnDraftStateRef.current;
    if (!storeId || persisted.storeId !== storeId) {
      return { status: "blocked", focus: focusKioskReturnDraft };
    }
    const next = { storeId, drafts: { ...persisted.drafts } };
    kioskReturnDraftStateRef.current = next;
    setKioskReturnDraftState(next);
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
      toast.success(request.id ? operationsCopy("供应商已保存") : operationsCopy("供应商已添加"));
    },
    onError: (_error, request) => {
      if (!isCurrentStoreRequest(request)) return;
      const message = operationsCopy("保存供应商失败，请重试");
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
      toast.success(operationsCopy("供应商已归档"));
    },
    onError: (_error, request) => {
      if (!isCurrentStoreRequest(request)) return;
      const message = operationsCopy("归档供应商失败，请重试");
      setSupplierActionError(message);
      toast.error(message);
    },
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
      toast.success(
        operationsCopy("已创建 {store}", {
          store: context.activeStore?.name ?? operationsCopy("新店铺"),
        }),
      );
      createStoreAttemptRef.current = null;
      setNewStoreName("");
      setNewStoreAddress("");
      await queryClient.invalidateQueries();
    },
    onError: () => toast.error(operationsCopy("创建店铺失败，请重试")),
  });
  const lifecyclePreflightMutation = useMutation({
    mutationFn: (request: { requestedStoreId: string; requestEpoch: number }) =>
      createStoreLifecyclePreflight(request.requestedStoreId),
    onSuccess: (_preflight, request) => {
      if (!isCurrentStoreRequest(request)) return;
      toast.success(operationsCopy("店铺安全预检已完成"));
    },
    onError: (_error, request) => {
      if (!isCurrentStoreRequest(request)) return;
      toast.error(operationsCopy("店铺安全预检失败，请重试"));
    },
  });
  const createKioskPairingMutation = useMutation({
    mutationFn: ({
      input,
    }: {
      input: Parameters<typeof createKioskDevicePairing>[0];
      requestedStoreId: string;
      requestEpoch: number;
      storeName: string;
    }) => createKioskDevicePairing(input),
    onSuccess: async (result, request) => {
      const nextValue = acceptStoreBoundTransientValue({
        requestedStoreId: request.requestedStoreId,
        responseStoreId: result.device.store_id,
        currentStoreId: activeStoreScopeRef.current.storeId,
        requestEpoch: request.requestEpoch,
        currentEpoch: kioskPairingRequestEpochRef.current,
        value: {
          code: result.pairing_code,
          expiresAt: result.expires_at,
          deviceLabel: result.device.label,
          storeName: request.storeName,
        },
        expiresAt: result.expires_at,
      });
      if (nextValue) {
        setLatestKioskPairingCodeState(nextValue);
        toast.success(operationsCopy("iPad 配对码已生成"));
      } else {
        toast.error(operationsCopy("店铺上下文已变化，旧配对码未显示，请重新生成"));
      }
      await queryClient.invalidateQueries({
        queryKey: kioskKeys.devices(request.requestedStoreId),
      });
    },
    onError: (_error, request) => {
      if (!isCurrentStoreRequest(request)) return;
      toast.error(operationsCopy("生成配对码失败，请重试"));
    },
  });
  const revokeKioskDeviceMutation = useMutation({
    mutationFn: (request: { id: string; requestedStoreId?: string; requestEpoch: number }) =>
      revokeKioskDevice(request.id),
    onSuccess: async (_result, request) => {
      await queryClient.invalidateQueries({
        queryKey: kioskKeys.devices(request.requestedStoreId),
      });
      if (!isCurrentStoreRequest(request)) return;
      toast.success(operationsCopy("客户 iPad 已撤销"));
    },
    onError: (_error, request) => {
      if (!isCurrentStoreRequest(request)) return;
      toast.error(operationsCopy("撤销 iPad 失败，请重试"));
    },
  });
  const acceptKioskSessionMutation = useMutation({
    mutationFn: (request: {
      id: string;
      expectedSubmissionVersion: number;
      requestedStoreId?: string;
      requestEpoch: number;
    }) =>
      acceptKioskSession({
        id: request.id,
        expected_submission_version: request.expectedSubmissionVersion,
      }),
    onSuccess: async (_result, request) => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: kioskKeys.sessions(request.requestedStoreId) }),
        queryClient.invalidateQueries({ queryKey: ordersKeys.all }),
        queryClient.invalidateQueries({ queryKey: customersKeys.all }),
      ]);
      if (!isCurrentStoreRequest(request)) return;
      toast.success(operationsCopy("客户提交已接受"));
    },
    onError: (_error, request) => {
      if (!isCurrentStoreRequest(request)) return;
      toast.error(operationsCopy("接受 iPad 提交失败，请重试"));
    },
  });
  const returnKioskSessionMutation = useMutation({
    mutationFn: (request: {
      id: string;
      expectedSubmissionVersion: number;
      reason: string;
      requestedStoreId?: string;
      requestEpoch: number;
    }) =>
      returnKioskSession({
        id: request.id,
        expected_submission_version: request.expectedSubmissionVersion,
        reason: request.reason,
      }),
    onSuccess: async (_result, request) => {
      await queryClient.invalidateQueries({
        queryKey: kioskKeys.sessions(request.requestedStoreId),
      });
      if (!isCurrentStoreRequest(request)) return;
      toast.success(operationsCopy("已退回给客户重填"));
    },
    onError: (_error, request) => {
      if (!isCurrentStoreRequest(request)) return;
      toast.error(operationsCopy("退回 iPad 提交失败，请重试"));
    },
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
      const normalizedEmail = request.input.email.trim().toLowerCase();
      const invitation = result.invitations.find(
        (item) => item.email.trim().toLowerCase() === normalizedEmail,
      );
      if (invitation?.email_delivery_status === "sent") {
        toast.success(t("settings.members.toast.invitationSent"));
      } else if (invitation?.email_delivery_status === "failed") {
        toast.warning(t("settings.members.toast.invitationDeliveryFailed"));
      } else {
        toast.info(t("settings.members.toast.invitationPending"));
      }
      await queryClient.invalidateQueries({
        queryKey: storesKeys.membersScoped(request.requestedStoreId),
      });
    },
    onError: (_error, request) => {
      if (!isCurrentStoreRequest(request)) return;
      const message = t("settings.members.toast.invitationError");
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
        toast.success(t("settings.members.toast.codeCreated"));
      } else if (isLatestRequest) {
        toast.error(t("settings.members.toast.codeContextChanged"));
      }
      await queryClient.invalidateQueries({
        queryKey: storesKeys.membersScoped(request.requestedStoreId),
      });
    },
    onError: (_error, request) => {
      if (
        request.requestedStoreId !== activeStoreScopeRef.current.storeId ||
        request.requestEpoch !== inviteCodeRequestEpochRef.current
      ) {
        return;
      }
      const message = t("settings.members.toast.codeCreateError");
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
      toast.success(t("settings.members.toast.codeRevoked"));
      await queryClient.invalidateQueries({
        queryKey: storesKeys.membersScoped(request.requestedStoreId),
      });
    },
    onError: (_error, request) => {
      if (!isCurrentStoreRequest(request)) return;
      const message = t("settings.members.toast.codeRevokeError");
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
      toast.success(t("settings.members.toast.invitationRevoked"));
      await queryClient.invalidateQueries({
        queryKey: storesKeys.membersScoped(request.requestedStoreId),
      });
    },
    onError: (_error, request) => {
      if (!isCurrentStoreRequest(request)) return;
      const message = t("settings.members.toast.invitationRevokeError");
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
        kind === "role"
          ? t("settings.members.toast.roleSaved")
          : t("settings.members.toast.permissionsSaved"),
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
    onError: (_error, request) => {
      if (!isCurrentStoreRequest(request)) return;
      const message = t("settings.members.saveError");
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
      toast.success(t("settings.members.toast.disabled"));
      await Promise.all([
        queryClient.invalidateQueries({
          queryKey: storesKeys.membersScoped(request.requestedStoreId),
        }),
        queryClient.invalidateQueries({ queryKey: storesKeys.context }),
      ]);
    },
    onError: (_error, request) => {
      if (!isCurrentStoreRequest(request)) return;
      const message = t("settings.members.toast.disableError");
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
      toast.success(t("settings.members.toast.restored"));
      await Promise.all([
        queryClient.invalidateQueries({
          queryKey: storesKeys.membersScoped(request.requestedStoreId),
        }),
        queryClient.invalidateQueries({ queryKey: storesKeys.context }),
      ]);
    },
    onError: (_error, request) => {
      if (!isCurrentStoreRequest(request)) return;
      const message = t("settings.members.toast.restoreError");
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
      toast.success(t("settings.members.toast.requestApproved"));
      await Promise.all([
        queryClient.invalidateQueries({
          queryKey: storesKeys.membersScoped(request.requestedStoreId),
        }),
        queryClient.invalidateQueries({ queryKey: platformKeys.onboardingStatus }),
      ]);
    },
    onError: (_error, request) => {
      if (!isCurrentStoreRequest(request)) return;
      const message = t("settings.members.toast.requestApproveError");
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
      toast.success(t("settings.members.toast.requestRejected"));
    },
    onError: (_error, request) => {
      if (!isCurrentStoreRequest(request)) return;
      const message = t("settings.members.toast.requestRejectError");
      setMemberActionError(message);
      toast.error(message);
    },
  });
  if (
    storeContextQuery.isError ||
    (storeContextQuery.isSuccess &&
      !storeContextQuery.data.activeStore &&
      (storeContextQuery.data.recoveryStores?.length ?? 0) === 0)
  ) {
    return (
      <RepairOsListScaffold
        title={t("settings.title")}
        subtitle={t("page.readFailed")}
        eyebrow={t("page.systemSettings")}
      >
        <RepairOsBusinessCard
          as="div"
          data-ui="settings-context-error"
          role="alert"
          className="mx-auto grid w-full max-w-4xl grid-cols-[auto_minmax(0,1fr)] items-center gap-3 rounded-xl border-status-danger-foreground/25 bg-status-danger/10 px-4 py-3 text-status-danger-foreground shadow-[var(--shadow-card)] hover:bg-status-danger/10 sm:grid-cols-[auto_minmax(0,1fr)_auto]"
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
              className="min-h-11 bg-card px-3"
              onClick={() => storeContextQuery.refetch()}
            >
              {t("settings.context.reload")}
            </Button>
          }
          leadingClassName="self-center"
          trailingClassName="col-span-2 justify-self-start sm:col-span-1 sm:justify-self-end"
        >
          <span className="block text-sm font-semibold">{t("settings.context.errorTitle")}</span>
          <span className="mt-0.5 block text-[11px] leading-4 text-status-danger-foreground/80 lg:text-xs lg:leading-[18px] lg:text-status-danger-foreground">
            {t("settings.context.errorDescription")}
          </span>
        </RepairOsBusinessCard>
      </RepairOsListScaffold>
    );
  }

  if (
    storeContextQuery.isSuccess &&
    !storeContextQuery.data.activeStore &&
    (storeContextQuery.data.recoveryStores?.length ?? 0) > 0
  ) {
    return (
      <RepairOsListScaffold
        title={t("settings.title")}
        subtitle={t("settings.noOpenStore")}
        eyebrow={t("page.systemSettings")}
      >
        <RepairOsBusinessCard
          as="div"
          className="mx-auto w-full max-w-4xl p-4"
          leading={
            <span className="grid size-9 place-items-center rounded-lg bg-status-warn/15 text-status-warn-foreground">
              <Archive className="size-4" />
            </span>
          }
        >
          <span className="block text-sm font-semibold">{t("settings.recovery.title")}</span>
          <span className="mt-1 block text-xs leading-5 text-muted-foreground">
            {t("settings.recovery.description")}
          </span>
          <Button asChild type="button" className="mt-3 min-h-10">
            <Link href="/settings/closed-stores">{t("settings.recovery.action")}</Link>
          </Button>
        </RepairOsBusinessCard>
      </RepairOsListScaffold>
    );
  }

  if (storeContextQuery.isLoading) {
    return <SettingsLoading />;
  }

  const supplierRows = suppliersQuery.data ?? [];
  const accountSummary = buildAccountSettingsSummary(accountQuery.data, locale);
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
  const orderDataAccessPresentation = getOrderDataAccessPresentationKeys(
    storeContextQuery.data?.orderDataAccess?.code,
  );
  const activeSection = selectedSection ? getSettingsSection(selectedSection, locale) : null;
  const navigationGroups: readonly SettingsNavigationGroup[] = getSettingsSectionGroups(locale).map(
    (group) => ({
      key: group.key,
      label: group.label,
      items: group.sections.map((section) => {
        const access = resolveSettingsSectionAccess(section.key, settingsCapabilities);
        return {
          ...section,
          access,
          dirty: sectionDirtyState[section.key],
          summary:
            section.key === "order-data" && (access === "blocked" || access === "unavailable")
              ? t(orderDataAccessPresentation.summary)
              : access === "readonly"
                ? t("settings.navigation.readonly")
                : undefined,
        };
      }),
    }),
  );
  const accessibleSectionCount = navigationGroups
    .flatMap((group) => group.items)
    .filter((item) => item.access === "editable" || item.access === "readonly").length;
  const totalSectionCount = navigationGroups.flatMap((group) => group.items).length;
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
      title={activeSection?.label ?? t("settings.title")}
      subtitle={
        activeSection
          ? (storeContextQuery.data?.activeStore?.name ?? t("settings.currentStore"))
          : t("settings.common")
      }
      eyebrow={t("page.systemSettings")}
      mobileLeading={
        activeSection ? (
          <Link
            href="/settings"
            aria-label={t("settings.backOverview")}
            className="grid size-11 place-items-center rounded-lg border border-[var(--border-panel)] bg-card text-foreground sm:size-9"
          >
            <ArrowLeft className="size-4" />
          </Link>
        ) : undefined
      }
      className={cn(
        "pb-8",
        '[&_[data-ui="repair-os-list-header-card"]>header]:!grid-cols-[44px_minmax(0,1fr)_auto]',
      )}
    >
      <UnsavedSettingsGuard
        id="settings-store-draft"
        dirty={guardDirty}
        isDirty={() => hasDirtyStoreSettingsDraft(settingsDraftsRef.current)}
        busy={saveMutation.isPending}
        label={
          guardSections.length > 1
            ? t("settings.guard.groups", { count: guardSections.length })
            : guardSection
              ? t("settings.guard.section", {
                  section: getSettingsSection(guardSection, locale).label,
                })
              : t("settings.guard.current")
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
        label={t("settings.guard.accountName")}
        onSave={saveAccountNameDraft}
        onDiscard={discardAccountNameDraft}
        onFocusFallback={() => document.getElementById("account-display-name")?.focus()}
      />
      <UnsavedSettingsGuard
        id="settings-kiosk-return-drafts"
        dirty={kioskReturnDraftDirty}
        isDirty={isKioskReturnDraftDirty}
        busy={false}
        label={t("settings.guard.kioskReturnDraft")}
        onSave={saveKioskReturnDrafts}
        onDiscard={discardKioskReturnDrafts}
        onFocusFallback={focusKioskReturnDraft}
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
            isPlatformAdmin={accountQuery.data?.isPlatformAdmin === true}
            activeStoreName={storeContextQuery.data?.activeStore?.name}
            accessibleSectionCount={accessibleSectionCount}
            totalSectionCount={totalSectionCount}
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
                description={
                  selectedSection === "order-data"
                    ? t(orderDataAccessPresentation.description)
                    : undefined
                }
              />
            ) : selectedSectionAccess === "readonly" ? (
              <div
                data-ui="settings-section-readonly"
                className="rounded-xl border border-[var(--border-panel)] bg-[var(--surface-panel-muted)] px-3 py-2 text-xs text-muted-foreground"
              >
                {selectedSection === "store"
                  ? t("settings.section.readonlyStore")
                  : selectedSection === "ai-usage"
                    ? t("settings.section.readonlyAiUsage")
                    : t("settings.section.readonlyGeneric")}
              </div>
            ) : null}

            {canRenderSelectedSection && selectedSection === "account" && accountQuery.isError ? (
              <SettingsSectionDataState
                label={getSettingsSection("account", locale).label}
                error
                onRetry={() => void accountQuery.refetch()}
              />
            ) : null}

            {canRenderSelectedSection &&
            canSaveDraftInSection(selectedSection) &&
            (settingsQuery.isLoading || (!activeDraft && !settingsQuery.isError)) ? (
              <SettingsSectionDataState label={getSettingsSection("store", locale).label} />
            ) : null}

            {canRenderSelectedSection &&
            canSaveDraftInSection(selectedSection) &&
            settingsQuery.isError ? (
              <SettingsSectionDataState
                label={getSettingsSection("store", locale).label}
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
                        ? t("settings.accountSection.saveErrorShort")
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
                      void updateAccountNameOnce().catch(() => undefined);
                    }}
                  />
                ) : null}
                {canRenderSelectedSection && selectedSection === "store" ? (
                  <StoreSettingsSectionContent
                    activeStoreId={storeContextQuery.data?.activeStore?.id}
                    activeStoreExplicit={storeContextQuery.data?.activeStoreExplicit}
                    stores={storeContextQuery.data?.stores ?? []}
                    isCreating={createStoreMutation.isPending}
                    createError={
                      createStoreMutation.isError
                        ? operationsCopy("创建店铺失败，请重试")
                        : undefined
                    }
                    newStoreName={newStoreName}
                    newStoreAddress={newStoreAddress}
                    onNewStoreNameChange={(value) => {
                      createStoreMutation.reset();
                      setNewStoreName(value);
                    }}
                    onNewStoreAddressChange={(value) => {
                      createStoreMutation.reset();
                      setNewStoreAddress(value);
                    }}
                    onCreateStore={() => {
                      const name = newStoreName.trim();
                      const address = newStoreAddress.trim() || undefined;
                      if (name.length < 2 || createStoreSubmittingRef.current) return;
                      const fingerprint = JSON.stringify({ name, address });
                      if (createStoreAttemptRef.current?.fingerprint !== fingerprint) {
                        createStoreAttemptRef.current = {
                          fingerprint,
                          requestId: crypto.randomUUID(),
                        };
                      }
                      const requestId = createStoreAttemptRef.current.requestId;
                      createStoreSubmittingRef.current = true;
                      void runGuardedTransition({
                        kind: "store-create",
                        label: operationsCopy("创建独立店铺"),
                        run: () =>
                          createStoreMutation.mutateAsync({
                            request_id: requestId,
                            name,
                            address,
                          }),
                      }).finally(() => {
                        createStoreSubmittingRef.current = false;
                      });
                    }}
                    lifecyclePreflight={
                      lifecyclePreflightMutation.variables?.requestedStoreId === activeStoreId &&
                      lifecyclePreflightMutation.isSuccess
                        ? lifecyclePreflightMutation.data
                        : undefined
                    }
                    isLifecyclePreflighting={
                      lifecyclePreflightMutation.isPending &&
                      lifecyclePreflightMutation.variables?.requestedStoreId === activeStoreId
                    }
                    lifecyclePreflightError={
                      lifecyclePreflightMutation.isError &&
                      lifecyclePreflightMutation.variables?.requestedStoreId === activeStoreId
                        ? operationsCopy("店铺安全预检失败，请重试")
                        : undefined
                    }
                    canRunLifecyclePreflight={
                      storeContextQuery.data?.lifecycleAccess?.check.allowed === true
                    }
                    lifecycleAccess={storeContextQuery.data?.lifecycleAccess}
                    onRunLifecyclePreflight={() => {
                      const request = currentStoreRequestScope();
                      if (!request.requestedStoreId || lifecyclePreflightSubmittingRef.current)
                        return;
                      lifecyclePreflightSubmittingRef.current = true;
                      void lifecyclePreflightMutation
                        .mutateAsync({
                          requestedStoreId: request.requestedStoreId,
                          requestEpoch: request.requestEpoch,
                        })
                        .catch(() => undefined)
                        .finally(() => {
                          lifecyclePreflightSubmittingRef.current = false;
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
                    orderCostsEnabled={
                      storeContextQuery.data?.permissions?.can_manage_order_costs === true
                    }
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
                        return Promise.reject(
                          new Error(t("settings.members.toast.codeNotAllowed")),
                        );
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
                      void copySensitiveCode(
                        currentCode,
                        t("settings.members.toast.codeCopied"),
                        t("settings.members.toast.codeCopyError"),
                      );
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
                  <KioskSettingsSection
                    key={activeStoreId}
                    storeName={
                      storeContextQuery.data?.activeStore?.name ?? operationsCopy("当前店铺")
                    }
                    devices={kioskDevicesQuery.data ?? []}
                    sessions={kioskSessionsQuery.data ?? []}
                    pairing={latestKioskPairing}
                    canManageDevices={canManageKioskDevices}
                    canReviewSessions={canReviewKioskSessions}
                    devicesLoading={kioskDevicesQuery.isLoading}
                    devicesError={kioskDevicesQuery.isError}
                    sessionsLoading={kioskSessionsQuery.isLoading}
                    sessionsError={kioskSessionsQuery.isError}
                    returnReasons={kioskReturnDrafts}
                    onRetryDevices={() => void kioskDevicesQuery.refetch()}
                    onRetrySessions={() => void kioskSessionsQuery.refetch()}
                    onReturnReasonChange={updateKioskReturnDraft}
                    onReturnReasonConsumed={consumeKioskReturnDraft}
                    onCreatePairing={(label) => {
                      const requestedStoreId = activeStoreScopeRef.current.storeId;
                      if (!requestedStoreId || !canManageKioskDevices) {
                        return Promise.reject(
                          new Error(operationsCopy("当前账号没有管理客户 iPad 的权限")),
                        );
                      }
                      const requestEpoch = kioskPairingRequestEpochRef.current + 1;
                      kioskPairingRequestEpochRef.current = requestEpoch;
                      setLatestKioskPairingCodeState(null);
                      return createKioskPairingMutation
                        .mutateAsync({
                          input: { label },
                          requestedStoreId,
                          requestEpoch,
                          storeName:
                            storeContextQuery.data?.activeStore?.name ?? operationsCopy("当前店铺"),
                        })
                        .then(() => undefined);
                    }}
                    onRevoke={(id) => {
                      if (!canManageKioskDevices) {
                        return Promise.reject(
                          new Error(operationsCopy("当前账号没有管理客户 iPad 的权限")),
                        );
                      }
                      return revokeKioskDeviceMutation
                        .mutateAsync({ ...currentStoreRequestScope(), id })
                        .then(() => undefined);
                    }}
                    onAcceptSession={(session) => {
                      if (!canReviewKioskSessions) {
                        return Promise.reject(
                          new Error(operationsCopy("当前账号没有审核客户提交的权限")),
                        );
                      }
                      return acceptKioskSessionMutation
                        .mutateAsync({
                          ...currentStoreRequestScope(),
                          id: session.id,
                          expectedSubmissionVersion: session.submission_version,
                        })
                        .then(() => undefined);
                    }}
                    onReturnSession={(session, reason) => {
                      if (!canReviewKioskSessions) {
                        return Promise.reject(
                          new Error(operationsCopy("当前账号没有审核客户提交的权限")),
                        );
                      }
                      return returnKioskSessionMutation
                        .mutateAsync({
                          ...currentStoreRequestScope(),
                          id: session.id,
                          expectedSubmissionVersion: session.submission_version,
                          reason,
                        })
                        .then(() => undefined);
                    }}
                    onCopyCode={() => {
                      const currentPairing = valueForActiveStore(
                        latestKioskPairingCodeState,
                        activeStoreScopeRef.current.storeId,
                      );
                      if (!currentPairing) return;
                      void copySensitiveCode(
                        currentPairing.code,
                        operationsCopy("iPad 配对码已复制"),
                        t("settings.members.toast.codeCopyError"),
                      );
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
                    activeStoreId={
                      canManageOrderCosts ||
                      canAllocatePartsCosts ||
                      canManageCostCurrencies ||
                      canPreviewCostBackfill
                        ? activeStoreId
                        : undefined
                    }
                    canManageOrderCosts={canManageOrderCosts}
                    canAllocatePartsCosts={canAllocatePartsCosts}
                    canReadCostCurrencies={canReadCostCurrencies}
                    canManageCostCurrencies={canManageCostCurrencies}
                    canPreviewCostBackfill={canPreviewCostBackfill}
                    canApplyCostBackfill={canApplyCostBackfill}
                    fieldErrors={settingsFieldErrors}
                    onDraftChange={(patch) => updateSettingsField("rules", patch)}
                  />
                ) : null}
                {canRenderSelectedSection && selectedSection === "order-data" && activeStoreId ? (
                  <OrderDataSection
                    key={activeStoreId}
                    storeId={activeStoreId}
                    storeName={
                      storeContextQuery.data?.activeStore?.name ?? operationsCopy("当前店铺")
                    }
                    applyEnabled={canApplyOrderData}
                    onDirtyChange={setOrderDataSectionDirty}
                  />
                ) : null}
                {canRenderSelectedSection && selectedSection === "ai-usage" ? (
                  <AiUsageSettingsSection
                    usage={aiUsageQuery.data}
                    isLoading={aiUsageQuery.isLoading}
                    isError={aiUsageQuery.isError}
                    onRetry={() => void aiUsageQuery.refetch()}
                  />
                ) : null}
              </div>
            </div>

            {canRenderSelectedSection && selectedSection === "workflow" && activeStoreId ? (
              <OrderWorkflowSettingsSection
                key={activeStoreId}
                storeId={activeStoreId}
                workflow={workflowQuery.data}
                isLoading={workflowQuery.isLoading}
                isError={workflowQuery.isError}
                onRetry={() => void workflowQuery.refetch()}
                canEdit={canConfigureWorkflow}
                onDirtyChange={setWorkflowSectionDirty}
              />
            ) : null}

            {canRenderDraftSection && canUpdateStoreSettings && selectedDraftSection ? (
              selectedSaveStatus === "validation-error" ||
              selectedSaveStatus === "conflict" ||
              selectedSaveStatus === "offline" ||
              selectedSaveStatus === "error" ? (
                <SettingsStateCard
                  status={selectedSaveStatus}
                  fieldErrors={settingsFieldErrors}
                  onDiscard={() => discardStoreSettingsSection(selectedDraftSection)}
                  onRetry={() => void saveStoreSettingsSection(selectedDraftSection)}
                  onRebase={() => rebaseStoreSettingsSection(selectedDraftSection)}
                />
              ) : (
                <SettingsSaveBar
                  label={activeSection?.label ?? t("settings.section.current")}
                  status={selectedSaveStatus}
                  dirty={hasChanges}
                  disabled={saveMutation.isPending}
                  onSave={() => void saveStoreSettingsSection(selectedDraftSection)}
                  onDiscard={() => discardStoreSettingsSection(selectedDraftSection)}
                />
              )
            ) : null}
          </form>
        )}
      </SettingsLayout>
    </RepairOsListScaffold>
  );
}

function SettingsLoading() {
  const { t } = useLocale();
  return (
    <RepairOsListScaffold
      title={t("settings.title")}
      subtitle={t("settings.loading")}
      eyebrow={t("page.systemSettings")}
      className="pb-28"
    >
      <div data-ui="settings-loading" className={repairOs.listModuleStack}>
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
  const { t } = useLocale();
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
          <Button
            type="button"
            size="sm"
            variant="outline"
            className="min-h-11 px-3"
            onClick={onRetry}
          >
            {t("settings.section.dataReload")}
          </Button>
        ) : null
      }
    >
      <span className="block text-sm font-semibold">
        {t("settings.section.dataErrorTitle", { label })}
      </span>
      <span className="mt-0.5 block text-[11px] leading-4 lg:text-xs lg:leading-4">
        {t("settings.section.dataErrorDescription")}
      </span>
    </RepairOsBusinessCard>
  );
}

function SettingsSectionAccessState({
  section,
  unavailable,
  description,
}: {
  section: SettingsSectionKey;
  unavailable: boolean;
  description?: string;
}) {
  const { locale, t } = useLocale();
  const sectionLabel = getSettingsSection(section, locale).label;
  return (
    <section
      data-ui={
        unavailable ? "settings-permission-unavailable" : `settings-${section}-no-permission`
      }
      aria-label={t("settings.section.accessAria", { section: sectionLabel })}
      className="rounded-xl border border-[var(--border-panel)] bg-card px-4 py-4 shadow-[var(--shadow-card)]"
    >
      <div className="flex items-start gap-3">
        <span className="grid size-9 shrink-0 place-items-center rounded-lg bg-muted text-muted-foreground">
          <ShieldCheck className="size-4" />
        </span>
        <div className="min-w-0">
          <h2 className="text-sm font-semibold">
            {unavailable
              ? t("settings.section.accessUnavailableTitle", { section: sectionLabel })
              : t("settings.section.accessBlockedTitle", { section: sectionLabel })}
          </h2>
          <p className="mt-1 text-xs leading-5 text-muted-foreground">
            {description ??
              (unavailable
                ? t("settings.section.accessUnavailableDescription")
                : t("settings.section.accessBlockedDescription"))}
          </p>
          <Button asChild type="button" size="sm" variant="outline" className="mt-3 min-h-9">
            <Link href="/settings">{t("settings.backOverview")}</Link>
          </Button>
        </div>
      </div>
    </section>
  );
}

async function copySensitiveCode(value: string, successMessage: string, failureMessage: string) {
  try {
    if (!navigator.clipboard?.writeText) throw new Error("clipboard_unavailable");
    await navigator.clipboard.writeText(value);
    toast.success(successMessage);
  } catch {
    toast.error(failureMessage);
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
        public_base_url: "public-base-url",
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
