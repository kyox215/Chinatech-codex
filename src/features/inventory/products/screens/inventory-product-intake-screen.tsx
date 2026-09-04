"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ArrowLeft, Loader2, X } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { useStoreShellContext } from "@/features/stores/api/use-store-shell-context";
import { COMPACT_WORKSPACE_BREAKPOINT } from "@/hooks/use-mobile";
import { createInventoryProduct } from "@/lib/repairdesk/api";
import type { CreateInventoryProductInput, InventoryProductCategory } from "@/lib/repairdesk/types";
import { repairOs, surfaces } from "@/lib/ui-patterns";
import { cn } from "@/lib/utils";
import { useLocale } from "@/shared/i18n/locale-provider";

import { inventoryCatalogKeys, inventoryProductKeys } from "../api/query-keys";
import { inventoryCatalogQueryOptions } from "../api/query-options";
import { inventoryProductFormCategories } from "../components/inventory-product-form";
import { InventoryProductFormWorkspace } from "../components/inventory-product-form-workspace";
import { InventoryProductIdentifierField } from "../components/inventory-product-identifier-field";
import { InventoryConsequenceDialog } from "../../components/inventory-consequence-dialog";
import {
  InventorySyncStatusPanel,
  type InventorySyncStatus,
} from "../../components/inventory-sync-status-panel";
import {
  InventoryProductPageFrame,
  type InventoryProductPageLeaveGuard,
} from "../components/inventory-product-page-frame";
import {
  clearInventoryProductFormDependencies,
  inventoryProductFormToCreateInput,
  isInventoryProductFormDraftDirty,
  validateInventoryProductFormDraft,
  type InventoryProductFormDraft,
} from "../model/inventory-product-form";
import { useInventoryProductLeaveGuard } from "../model/use-inventory-product-leave-guard";
import {
  getInventoryQuickEntryErrorMessage,
  localizeInventoryProductCategory,
  localizeInventoryValidation,
} from "../model/inventory-product-i18n";

type Draft = {
  category: InventoryProductCategory;
  brand: string;
  model: string;
  color: string;
  ram_capacity: string;
  storage_capacity: string;
  gtin: string;
  condition: string;
  specifications: Record<string, string>;
  imei1: string;
  imei2: string;
  serial: string;
  eid: string;
  primary_identifier_kind?: "imei1" | "imei2" | "serial" | "eid";
  identifier_sources: Record<"imei1" | "imei2" | "serial" | "eid", "manual" | "scan">;
  list_price: string;
  cost_amount: string;
  location: string;
  warranty_months: string;
  notes: string;
  inspection_battery_health: string;
  inspection_face_id_status: InventoryProductFormDraft["inspection_face_id_status"];
  inspection_touched: boolean;
};

type ValidationError = { message: string; fieldId?: string };

type CatalogDraftSnapshot = Pick<
  Draft,
  | "brand"
  | "model"
  | "ram_capacity"
  | "storage_capacity"
  | "color"
  | "specifications"
  | "inspection_battery_health"
  | "inspection_face_id_status"
  | "inspection_touched"
>;

type PendingCatalogTransition = {
  kind: "brand" | "model";
  nextValue: string;
  snapshot: CatalogDraftSnapshot;
};

export type InventoryProductIntakeState = {
  isDirty: boolean;
  isPending: boolean;
};

export type InventoryProductIntakeScreenProps = {
  surface?: "page" | "dialog";
  onCancel?: () => void;
  onCreated?: (id: string) => void | Promise<void>;
  onStateChange?: (state: InventoryProductIntakeState) => void;
  onAuthorityInvalidated?: () => void;
};

function initialDraft(category: InventoryProductCategory = "phone"): Draft {
  return {
    category,
    brand: "",
    model: "",
    color: "",
    ram_capacity: "",
    storage_capacity: "",
    gtin: "",
    condition: "",
    specifications: {},
    imei1: "",
    imei2: "",
    serial: "",
    eid: "",
    primary_identifier_kind: undefined,
    identifier_sources: { imei1: "manual", imei2: "manual", serial: "manual", eid: "manual" },
    list_price: "",
    cost_amount: "",
    location: "",
    warranty_months: "",
    notes: "",
    inspection_battery_health: "",
    inspection_face_id_status: "not_tested",
    inspection_touched: false,
  };
}

function isDraftDirty(draft: Draft) {
  return isInventoryProductFormDraftDirty(toFormDraft(draft));
}

function catalogSnapshot(draft: Draft): CatalogDraftSnapshot {
  return {
    brand: draft.brand,
    model: draft.model,
    ram_capacity: draft.ram_capacity,
    storage_capacity: draft.storage_capacity,
    color: draft.color,
    specifications: { ...draft.specifications },
    inspection_battery_health: draft.inspection_battery_health,
    inspection_face_id_status: draft.inspection_face_id_status,
    inspection_touched: draft.inspection_touched,
  };
}

function hasModelDependentValues(draft: Draft) {
  return Boolean(
    draft.ram_capacity.trim() ||
    draft.storage_capacity.trim() ||
    draft.color.trim() ||
    draft.inspection_battery_health.trim() ||
    draft.inspection_face_id_status !== "not_tested" ||
    draft.inspection_touched ||
    Object.values(draft.specifications).some((value) => value.trim()),
  );
}

function hasBrandDependentValues(draft: Draft) {
  return Boolean(draft.model.trim() || hasModelDependentValues(draft));
}

function focusCatalogTransitionConfirmation() {
  requestAnimationFrame(() => {
    document
      .querySelector<HTMLElement>('[data-ui="inventory-product-catalog-transition-confirm"] button')
      ?.focus({ preventScroll: true });
  });
}

function focusCategoryConfirmation() {
  requestAnimationFrame(() => {
    document
      .querySelector<HTMLElement>('[data-ui="inventory-product-category-confirm"] button')
      ?.focus({ preventScroll: true });
  });
}

function clearCatalogDependentValues(draft: Draft, kind: "brand" | "model", nextValue: string) {
  const cleared = clearInventoryProductFormDependencies(toFormDraft(draft), kind);
  return {
    ...draft,
    ...(kind === "brand" ? { brand: nextValue } : { model: nextValue }),
    model: kind === "brand" ? "" : nextValue,
    ram_capacity: cleared.ram_capacity,
    storage_capacity: cleared.storage_capacity,
    color: cleared.color,
    specifications: cleared.specifications,
    inspection_battery_health: cleared.inspection_battery_health,
    inspection_face_id_status: cleared.inspection_face_id_status,
    inspection_touched: cleared.inspection_touched,
  };
}

export function InventoryProductIntakeScreen({
  surface = "page",
  onCancel,
  onCreated,
  onStateChange,
  onAuthorityInvalidated,
}: InventoryProductIntakeScreenProps = {}) {
  const { t } = useLocale();
  const router = useRouter();
  const queryClient = useQueryClient();
  const shell = useStoreShellContext({ monitorAuthority: true });
  const [draft, setDraft] = useState<Draft>(() => initialDraft());
  const [pendingCategory, setPendingCategory] = useState<InventoryProductCategory>();
  const [pendingCatalogTransition, setPendingCatalogTransition] =
    useState<PendingCatalogTransition>();
  const [error, setError] = useState<ValidationError>();
  const [syncStatus, setSyncStatus] = useState<InventorySyncStatus>();
  const [createdId, setCreatedId] = useState<string>();
  const [idempotencyKey, setIdempotencyKey] = useState(() => crypto.randomUUID());
  const authorityRef = useRef<string | undefined>(undefined);
  const authorityGenerationRef = useRef(0);
  const submitLockRef = useRef(false);
  const createdContinueRef = useRef(false);
  const leaveTriggerRef = useRef<HTMLElement | null>(null);
  const onStateChangeRef = useRef(onStateChange);
  const onAuthorityInvalidatedRef = useRef(onAuthorityInvalidated);
  const lastReportedStateRef = useRef<InventoryProductIntakeState | undefined>(undefined);
  const canEnterCost = shell.permissions?.canAllocateInventoryCosts === true;
  const inspectionEnabled =
    shell.permissions?.inventoryProductInspectionEnabled === true &&
    shell.permissions?.canInspectInventory === true;
  const syncBlocked = Boolean(syncStatus && syncStatus !== "recovered");

  const catalogQuery = useQuery({
    ...inventoryCatalogQueryOptions(
      { category: draft.category, brand: draft.brand || undefined, limit: 100 },
      shell.activeStore?.id,
    ),
    enabled: Boolean(
      shell.activeStore?.id &&
      shell.permissions?.canReadInventory &&
      shell.permissions.inventoryProductsUiEnabled,
    ),
  });

  const mutation = useMutation({
    mutationFn: (input: CreateInventoryProductInput) => createInventoryProduct(input),
  });

  const leaveGuard = useInventoryProductLeaveGuard({
    enabled: surface === "page" && !shell.isLoading,
    isDirty: isDraftDirty(draft),
    isPending: mutation.isPending,
    onBlocked: (reason) =>
      setError({
        message:
          reason === "pending"
            ? t("inventory2b4.quick.screen.pendingLeave")
            : t("inventory2b4.quick.screen.unsavedCreate"),
      }),
  });

  useEffect(() => {
    onStateChangeRef.current = onStateChange;
  }, [onStateChange]);

  useEffect(() => {
    onAuthorityInvalidatedRef.current = onAuthorityInvalidated;
  }, [onAuthorityInvalidated]);

  useEffect(() => {
    if (shell.isLoading) return;
    if (!authorityRef.current) {
      authorityRef.current = shell.authorityFingerprint;
      return;
    }
    if (authorityRef.current === shell.authorityFingerprint) return;
    authorityRef.current = shell.authorityFingerprint;
    authorityGenerationRef.current += 1;
    setDraft(initialDraft());
    setIdempotencyKey(crypto.randomUUID());
    setPendingCategory(undefined);
    setPendingCatalogTransition(undefined);
    setSyncStatus(undefined);
    setCreatedId(undefined);
    createdContinueRef.current = false;
    submitLockRef.current = false;
    mutation.reset();
    setError({ message: t("inventory2b4.quick.screen.authorityChanged") });
    onAuthorityInvalidatedRef.current?.();
  }, [mutation, shell.authorityFingerprint, shell.isLoading, t]);

  useEffect(() => {
    const nextState = {
      isDirty: isDraftDirty(draft),
      isPending: mutation.isPending,
    };
    const previousState = lastReportedStateRef.current;
    if (
      previousState?.isDirty === nextState.isDirty &&
      previousState.isPending === nextState.isPending
    )
      return;
    lastReportedStateRef.current = nextState;
    onStateChangeRef.current?.(nextState);
  }, [draft, mutation.isPending]);

  useEffect(() => {
    document.body.dataset.mobileWorkspaceActive = "true";
    return () => {
      delete document.body.dataset.mobileWorkspaceActive;
    };
  }, []);

  useEffect(() => {
    if (!shouldAutoFocusBrand(surface)) return;
    const frame = requestAnimationFrame(() => {
      document.getElementById("product-brand")?.focus({ preventScroll: true });
    });
    return () => cancelAnimationFrame(frame);
  }, [surface]);

  const closeIntake = (event?: React.MouseEvent<HTMLButtonElement>) => {
    const leave = () => {
      if (onCancel) {
        onCancel();
        return;
      }
      router.push("/inventory");
    };
    if (surface === "page") {
      leaveTriggerRef.current = event?.currentTarget ?? leaveTriggerRef.current;
      leaveGuard.requestLeave(leave, leaveTriggerRef.current);
      return;
    }
    leave();
  };

  if (shell.isLoading) {
    return (
      <IntakeMessage
        title={t("inventory2b4.quick.screen.loadingPermission")}
        body={t("inventory2b4.quick.screen.loadingPermissionBody")}
        onBack={closeIntake}
        surface={surface}
      />
    );
  }

  if (
    !shell.activeStore ||
    !shell.permissions?.canCreateInventory ||
    !shell.permissions.inventoryProductsUiEnabled ||
    !shell.permissions.inventoryProductQuickCreateEnabled
  ) {
    return (
      <IntakeMessage
        title={t("inventory2b4.quick.screen.cannotCreate")}
        body={
          shell.permissions?.canCreateInventory
            ? t("inventory2b4.quick.screen.featureOff")
            : t("inventory2b4.quick.screen.noCreatePermission")
        }
        onBack={closeIntake}
        surface={surface}
      />
    );
  }

  const activeStoreId = shell.activeStore.id;

  const retryCreatedSync = async () => {
    if (!createdId) return;
    setSyncStatus("committed-refreshing");
    try {
      await queryClient.invalidateQueries({
        queryKey: inventoryProductKeys.listsForStore(activeStoreId),
      });
      await queryClient.invalidateQueries({
        queryKey: inventoryCatalogKeys.catalogsForStore(activeStoreId),
      });
      if (!createdContinueRef.current) {
        if (onCreated) await onCreated(createdId);
        else await Promise.resolve(router.push(`/inventory/${createdId}`));
      }
      setSyncStatus("recovered");
    } catch {
      setSyncStatus("committed-refresh-failed");
    }
  };

  const syncCreatedAfterCommit = async (id: string, continueEntry: boolean) => {
    setSyncStatus("committed-refreshing");
    try {
      await queryClient.invalidateQueries({
        queryKey: inventoryProductKeys.listsForStore(activeStoreId),
      });
      await queryClient.invalidateQueries({
        queryKey: inventoryCatalogKeys.catalogsForStore(activeStoreId),
      });
      if (!continueEntry) {
        if (onCreated) await onCreated(id);
        else await Promise.resolve(router.push(`/inventory/${id}`));
      }
      setSyncStatus("recovered");
    } catch {
      setSyncStatus("committed-refresh-failed");
    } finally {
      submitLockRef.current = false;
    }
  };

  const save = async (continueEntry: boolean) => {
    if (submitLockRef.current || syncBlocked) return;
    if (pendingCatalogTransition) {
      setError({ message: t("inventory2b4.quick.screen.confirmCatalogFirst") });
      focusCatalogTransitionConfirmation();
      return;
    }
    if (pendingCategory) {
      setError({ message: t("inventory2b4.quick.screen.confirmCategoryFirst") });
      focusCategoryConfirmation();
      return;
    }
    setError(undefined);
    const validation = validateDraft(draft, canEnterCost);
    if (validation) {
      setError({
        ...validation,
        message: localizeInventoryValidation(validation.code, validation.message, t),
      });
      const fieldId = validation.fieldId ?? "product-category-phone";
      if (
        [
          "product-price",
          "product-cost",
          "product-warranty",
          "product-imei1",
          "product-imei2",
          "product-serial",
          "product-eid",
          "product-gtin",
          "product-color",
        ].includes(fieldId)
      ) {
        requestAnimationFrame(() => document.getElementById(fieldId)?.focus());
      } else {
        document.getElementById(fieldId)?.focus();
      }
      return;
    }
    if (typeof navigator !== "undefined" && !navigator.onLine) {
      setError({ message: t("inventory2b4.quick.screen.offline") });
      return;
    }

    submitLockRef.current = true;
    const submitAuthorityGeneration = authorityGenerationRef.current;
    let result: Awaited<ReturnType<typeof mutation.mutateAsync>>;
    try {
      result = await mutation.mutateAsync(toInput(draft, idempotencyKey, canEnterCost));
    } catch (cause) {
      submitLockRef.current = false;
      setError({ message: getInventoryQuickEntryErrorMessage(cause, "create", t) });
      return;
    }

    // The create is committed. Rotate the key and mark the draft saved before
    // invalidation, callbacks, or navigation can fail.
    setCreatedId(result.id);
    createdContinueRef.current = continueEntry;
    setIdempotencyKey(crypto.randomUUID());
    setError(undefined);
    leaveGuard.markSaved();
    if (submitAuthorityGeneration !== authorityGenerationRef.current) {
      // Authority changed while the server accepted the create. Do not navigate
      // into another store; keep the original save path blocked and expose only
      // a read/sync recovery surface.
      setCreatedId(undefined);
      createdContinueRef.current = false;
      setSyncStatus("committed-context-stale");
      submitLockRef.current = false;
      return;
    }
    toast.success(t("inventory2b4.quick.screen.created", { sku: result.sku }));
    if (continueEntry) {
      setDraft(sameProductDraft(draft));
      requestAnimationFrame(() =>
        document
          .getElementById(draft.category === "phone" ? "product-imei1" : "product-serial")
          ?.focus(),
      );
    }
    void syncCreatedAfterCommit(result.id, continueEntry);
  };

  const applyCategory = (category: InventoryProductCategory) => {
    setPendingCategory(undefined);
    setPendingCatalogTransition(undefined);
    setDraft((current) => ({
      ...current,
      category,
      ...(current.category === category
        ? {}
        : {
            brand: "",
            model: "",
            ram_capacity: "",
            storage_capacity: "",
            color: "",
            condition: "",
            imei1: "",
            imei2: "",
            serial: "",
            eid: "",
            primary_identifier_kind: undefined,
            gtin: "",
            specifications: {},
            inspection_battery_health: "",
            inspection_face_id_status: "not_tested",
            inspection_touched: false,
          }),
    }));
  };

  const clearCatalogValidationError = (fieldId: "product-brand" | "product-model") => {
    setError((current) =>
      current?.fieldId === fieldId ||
      current?.fieldId === "product-brand" ||
      current?.fieldId === "product-model"
        ? undefined
        : current,
    );
  };

  const requestBrandChange = (nextValue: string) => {
    clearCatalogValidationError("product-brand");
    const current = draft;
    if (pendingCatalogTransition?.kind === "brand") {
      setPendingCatalogTransition((pending) => (pending ? { ...pending, nextValue } : pending));
      setDraft((previous) => ({ ...previous, brand: nextValue }));
      return;
    }
    if (nextValue === current.brand) return;
    if (hasBrandDependentValues(current)) {
      setPendingCatalogTransition({
        kind: "brand",
        nextValue,
        snapshot: catalogSnapshot(current),
      });
      setDraft((previous) => ({ ...previous, brand: nextValue }));
      return;
    }
    setDraft((previous) => clearCatalogDependentValues(previous, "brand", nextValue));
  };

  const requestModelChange = (nextValue: string) => {
    clearCatalogValidationError("product-model");
    const current = draft;
    if (pendingCatalogTransition?.kind === "model") {
      setPendingCatalogTransition((pending) => (pending ? { ...pending, nextValue } : pending));
      setDraft((previous) => ({ ...previous, model: nextValue }));
      return;
    }
    if (nextValue === current.model) return;
    if (hasModelDependentValues(current)) {
      setPendingCatalogTransition({
        kind: "model",
        nextValue,
        snapshot: catalogSnapshot(current),
      });
      setDraft((previous) => ({ ...previous, model: nextValue }));
      return;
    }
    setDraft((previous) => ({ ...previous, model: nextValue }));
  };

  const cancelCatalogTransition = () => {
    const pending = pendingCatalogTransition;
    if (!pending) return;
    setDraft((current) => ({ ...current, ...pending.snapshot }));
    setPendingCatalogTransition(undefined);
  };

  const confirmCatalogTransition = () => {
    const pending = pendingCatalogTransition;
    if (!pending) return;
    setDraft((current) => clearCatalogDependentValues(current, pending.kind, pending.nextValue));
    setPendingCatalogTransition(undefined);
  };

  const selectCategory = (category: InventoryProductCategory) => {
    if (
      draft.category !== category &&
      [
        draft.brand,
        draft.model,
        draft.ram_capacity,
        draft.storage_capacity,
        draft.color,
        draft.condition,
        draft.imei1,
        draft.imei2,
        draft.serial,
        draft.eid,
        draft.gtin,
        draft.inspection_battery_health,
        draft.inspection_face_id_status === "not_tested" ? "" : draft.inspection_face_id_status,
        draft.inspection_touched ? "inspection-touched" : "",
        ...Object.values(draft.specifications),
      ].some((value) => value.trim())
    ) {
      setPendingCategory(category);
      return false;
    }
    applyCategory(category);
    return true;
  };

  const handleCategoryKeyDown = (event: React.KeyboardEvent<HTMLButtonElement>, index: number) => {
    const keyMoves: Record<string, number> = {
      ArrowRight: 1,
      ArrowDown: 1,
      ArrowLeft: -1,
      ArrowUp: -1,
    };
    const delta = keyMoves[event.key];
    const nextIndex =
      event.key === "Home"
        ? 0
        : event.key === "End"
          ? inventoryProductFormCategories.length - 1
          : delta
            ? (index + delta + inventoryProductFormCategories.length) %
              inventoryProductFormCategories.length
            : undefined;
    if (nextIndex === undefined) return;
    event.preventDefault();
    const next = inventoryProductFormCategories[nextIndex].value;
    if (selectCategory(next)) document.getElementById(`product-category-${next}`)?.focus();
  };

  return (
    <InventoryProductPageFrame
      mode="intake"
      surface={surface}
      title={t("inventory2b4.quick.dialog.title")}
      subtitle={t("inventory2b4.quick.screen.subtitle")}
      mobileSubtitle={t("inventory2b4.quick.screen.mobileSubtitle")}
      mutationPending={mutation.isPending}
      syncBlocked={syncBlocked}
      error={error?.message}
      syncStatus={syncStatus}
      syncPrivacyRedacted={surface === "dialog" || syncStatus === "committed-context-stale"}
      onRetrySync={retryCreatedSync}
      onOpenCommitted={
        syncStatus === "committed-refresh-failed" && createdId
          ? () => {
              if (onCreated) return onCreated(createdId);
              return router.push(`/inventory/${createdId}`);
            }
          : undefined
      }
      onBack={closeIntake}
      leaveGuard={surface === "page" ? (leaveGuard as InventoryProductPageLeaveGuard) : undefined}
      onContinue={() => void save(true)}
      primaryLabel={t("inventory2b4.quick.screen.saveAndView")}
      onSubmit={(event) => {
        event.preventDefault();
        void save(false);
      }}
      primaryDisabled={Boolean(pendingCategory || pendingCatalogTransition)}
      secondaryDisabled={Boolean(pendingCategory || pendingCatalogTransition)}
    >
      <InventoryProductFormWorkspace
        draft={toFormDraft(draft)}
        surface={surface === "dialog" ? "dialog" : "page"}
        categoryDisabled={Boolean(pendingCategory || pendingCatalogTransition)}
        catalogDisabled={Boolean(pendingCategory || pendingCatalogTransition)}
        learnedCatalogOptions={catalogQuery.data?.items}
        autoFocusBrand={shouldAutoFocusBrand(surface)}
        brandInvalid={error?.fieldId === "product-brand"}
        modelInvalid={error?.fieldId === "product-model"}
        inspectionBatteryInvalid={error?.fieldId === "product-battery-health"}
        conditionInvalid={error?.fieldId === "product-condition"}
        gtinInvalid={error?.fieldId === "product-gtin"}
        listPriceInvalid={error?.fieldId === "product-price"}
        costInvalid={error?.fieldId === "product-cost"}
        warrantyInvalid={error?.fieldId === "product-warranty"}
        colorInvalid={error?.fieldId === "product-color"}
        canEnterCost={canEnterCost}
        inspectionEnabled={inspectionEnabled}
        identifierDescription={
          surface === "dialog"
            ? t("inventory2b4.quick.screen.identifierDialogHint")
            : t("inventory2b4.quick.screen.identifierPageHint")
        }
        showScanner={surface === "page"}
        identifierField={InventoryProductIdentifierField}
        invalidKinds={{
          imei1: error?.fieldId === "product-imei1",
          imei2: error?.fieldId === "product-imei2",
          serial: error?.fieldId === "product-serial",
          eid: error?.fieldId === "product-eid",
        }}
        requiredIdentifierKinds={{ imei1: draft.category === "phone" }}
        categoryNotice={
          pendingCategory ? (
            <div
              data-ui="inventory-product-category-confirm"
              className="mt-2 grid gap-2 rounded-lg border border-status-warn-foreground/20 bg-status-warn px-2.5 py-2 text-status-warn-foreground sm:grid-cols-[minmax(0,1fr)_auto] sm:items-center"
              role="status"
              aria-live="polite"
            >
              <p className="text-[11px] leading-4 sm:text-xs">
                {t("inventory2b4.quick.screen.categoryChangeWarning", {
                  category: localizeInventoryProductCategory(
                    pendingCategory,
                    inventoryProductFormCategories.find((item) => item.value === pendingCategory)
                      ?.label ?? pendingCategory,
                    t,
                  ),
                })}
              </p>
              <div className="grid grid-cols-2 gap-1.5">
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="min-h-11"
                  onClick={() => setPendingCategory(undefined)}
                >
                  {t("inventory2b4.quick.frame.continueEdit")}
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="min-h-11 bg-background"
                  onClick={() => {
                    const category = pendingCategory;
                    applyCategory(category);
                    requestAnimationFrame(() =>
                      document.getElementById(`product-category-${category}`)?.focus(),
                    );
                  }}
                >
                  {t("inventory2b4.quick.screen.clearAndSwitch")}
                </Button>
              </div>
            </div>
          ) : null
        }
        catalogNotice={
          <>
            {pendingCatalogTransition ? (
              <CatalogTransitionConfirm
                kind={pendingCatalogTransition.kind}
                onCancel={cancelCatalogTransition}
                onConfirm={confirmCatalogTransition}
              />
            ) : null}
            {catalogQuery.isError ? (
              <p className="text-[11px] leading-4 text-muted-foreground">
                {t("inventory2b4.quick.screen.catalogUnavailable")}
              </p>
            ) : null}
          </>
        }
        onCategoryChange={selectCategory}
        onCategoryKeyDown={handleCategoryKeyDown}
        onBrandChange={requestBrandChange}
        onModelChange={requestModelChange}
        onRamChange={(ram_capacity) => setDraft((current) => ({ ...current, ram_capacity }))}
        onStorageChange={(storage_capacity) =>
          setDraft((current) => ({ ...current, storage_capacity }))
        }
        onColorChange={(color) => setDraft((current) => ({ ...current, color }))}
        onInspectionBatteryHealthChange={(inspection_battery_health) =>
          setDraft((current) => ({
            ...current,
            inspection_battery_health,
            inspection_touched: true,
          }))
        }
        onInspectionFaceIdStatusChange={(inspection_face_id_status) =>
          setDraft((current) => ({
            ...current,
            inspection_face_id_status,
            inspection_touched: true,
          }))
        }
        onIdentifierChange={(kind, value) => setDraft((current) => ({ ...current, [kind]: value }))}
        onIdentifierSource={(kind, source) => setIdentifierSource(setDraft, kind, source)}
        onPrimaryIdentifierChange={(kind) =>
          setDraft((current) => ({ ...current, primary_identifier_kind: kind }))
        }
        onConditionChange={(condition) => setDraft((current) => ({ ...current, condition }))}
        onGtinChange={(gtin) => setDraft((current) => ({ ...current, gtin }))}
        onSpecificationChange={(key, value) =>
          setDraft((current) => ({
            ...current,
            specifications: { ...current.specifications, [key]: value },
          }))
        }
        onListPriceChange={(list_price) => setDraft((current) => ({ ...current, list_price }))}
        onCostChange={(cost_amount) => setDraft((current) => ({ ...current, cost_amount }))}
        onLocationChange={(location) => setDraft((current) => ({ ...current, location }))}
        onWarrantyChange={(warranty_months) =>
          setDraft((current) => ({ ...current, warranty_months }))
        }
        onNotesChange={(notes) => setDraft((current) => ({ ...current, notes }))}
      />
    </InventoryProductPageFrame>
  );
}

function shouldAutoFocusBrand(surface: "page" | "dialog") {
  return (
    surface === "dialog" &&
    typeof window !== "undefined" &&
    window.innerWidth >= COMPACT_WORKSPACE_BREAKPOINT
  );
}

function toInput(
  draft: Draft,
  idempotency_key: string,
  canEnterCost: boolean,
): CreateInventoryProductInput {
  return inventoryProductFormToCreateInput(toFormDraft(draft), idempotency_key, {
    canEnterCost,
    requireImei1: draft.category === "phone",
  });
}

function validateDraft(draft: Draft, canEnterCost: boolean) {
  return validateInventoryProductFormDraft(toFormDraft(draft), {
    canEnterCost,
    requireImei1: draft.category === "phone",
  });
}

function toFormDraft(draft: Draft): InventoryProductFormDraft {
  return {
    category: draft.category,
    brand: draft.brand,
    model: draft.model,
    color: draft.color,
    ram_capacity: draft.ram_capacity,
    storage_capacity: draft.storage_capacity,
    gtin: draft.gtin,
    condition: draft.condition,
    specifications: draft.specifications,
    identifiers: { imei1: draft.imei1, imei2: draft.imei2, serial: draft.serial, eid: draft.eid },
    identifier_sources: draft.identifier_sources,
    primary_identifier_kind: draft.primary_identifier_kind,
    list_price: draft.list_price,
    cost_amount: draft.cost_amount,
    location: draft.location,
    warranty_months: draft.warranty_months,
    notes: draft.notes,
    inspection_battery_health: draft.inspection_battery_health,
    inspection_face_id_status: draft.inspection_face_id_status,
    inspection_touched: draft.inspection_touched,
  };
}

function sameProductDraft(draft: Draft): Draft {
  return {
    ...draft,
    imei1: "",
    imei2: "",
    serial: "",
    eid: "",
    primary_identifier_kind: undefined,
    identifier_sources: { imei1: "manual", imei2: "manual", serial: "manual", eid: "manual" },
    list_price: "",
    cost_amount: "",
    warranty_months: "",
    notes: "",
    inspection_battery_health: "",
    inspection_face_id_status: "not_tested",
    inspection_touched: false,
  };
}

function setIdentifierSource(
  setDraft: React.Dispatch<React.SetStateAction<Draft>>,
  kind: "imei1" | "imei2" | "serial" | "eid",
  source: "manual" | "scan",
) {
  setDraft((current) => ({
    ...current,
    identifier_sources: { ...current.identifier_sources, [kind]: source },
  }));
}

function CatalogTransitionConfirm({
  kind,
  onCancel,
  onConfirm,
}: {
  kind: "brand" | "model";
  onCancel: () => void;
  onConfirm: () => void;
}) {
  const { t } = useLocale();
  const label =
    kind === "brand" ? t("inventory2b4.quick.screen.brand") : t("inventory2b4.quick.screen.model");
  const clearSummary =
    kind === "brand"
      ? t("inventory2b4.quick.screen.brandDependents")
      : t("inventory2b4.quick.screen.modelDependents");
  return (
    <div
      data-ui="inventory-product-catalog-transition-confirm"
      className="grid gap-2 rounded-lg border border-status-warn-foreground/20 bg-status-warn px-2.5 py-2 text-status-warn-foreground sm:grid-cols-[minmax(0,1fr)_auto] sm:items-center"
      role="status"
      aria-live="polite"
    >
      <p className="text-[11px] leading-4 sm:text-xs">
        {t("inventory2b4.quick.screen.catalogChangeWarning", { label, summary: clearSummary })}
      </p>
      <div className="grid grid-cols-2 gap-1.5">
        <Button type="button" variant="ghost" size="sm" className="min-h-11" onClick={onCancel}>
          {t("inventory2b4.quick.screen.keepOriginal")}
        </Button>
        <Button
          type="button"
          variant="outline"
          size="sm"
          className="min-h-11 bg-background"
          onClick={onConfirm}
        >
          {t("inventory2b4.quick.screen.clearCatalogAndSwitch")}
        </Button>
      </div>
    </div>
  );
}

function IntakeMessage({
  title,
  body,
  onBack,
  surface = "page",
}: {
  title: string;
  body: string;
  onBack: () => void;
  surface?: "page" | "dialog";
}) {
  const { t } = useLocale();
  const Root = surface === "page" ? "main" : "div";
  return (
    <Root
      data-inventory-product-intake-message={surface}
      className={cn(
        surface === "page" && repairOs.mobileFloatingPage,
        "grid place-items-center p-4",
        surface === "page" ? "min-h-[55dvh]" : "h-full min-h-[18rem]",
      )}
    >
      <section className={cn(repairOs.mobileInfoCard, "max-w-sm p-6 text-center")}>
        <h1 className="font-semibold">{title}</h1>
        <p className="mt-2 text-sm text-muted-foreground">{body}</p>
        <Button type="button" variant="outline" className="mt-4" onClick={onBack}>
          {t("inventory2b4.quick.frame.backInventory")}
        </Button>
      </section>
    </Root>
  );
}
