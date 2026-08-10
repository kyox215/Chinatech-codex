"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { ArrowLeft, Loader2, X } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { useStoreShellContext } from "@/features/stores/api/use-store-shell-context";
import { COMPACT_WORKSPACE_BREAKPOINT } from "@/hooks/use-mobile";
import { createInventoryProduct } from "@/lib/repairdesk/api";
import type { CreateInventoryProductInput, InventoryProductCategory } from "@/lib/repairdesk/types";
import { repairOs, surfaces } from "@/lib/ui-patterns";
import { cn } from "@/lib/utils";

import { inventoryProductKeys } from "../api/query-keys";
import {
  InventoryProductIdentifierSection,
  InventoryProductForm,
  InventoryProductFormDetails,
  inventoryProductFormCategories,
} from "../components/inventory-product-form";
import {
  clearInventoryProductFormDependencies,
  inventoryProductFormToCreateInput,
  isInventoryProductFormDraftDirty,
  validateInventoryProductFormDraft,
  type InventoryProductFormDraft,
} from "../model/inventory-product-form";
import { useInventoryProductLeaveGuard } from "../model/use-inventory-product-leave-guard";

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
  const router = useRouter();
  const queryClient = useQueryClient();
  const shell = useStoreShellContext({ monitorAuthority: true });
  const [draft, setDraft] = useState<Draft>(() => initialDraft());
  const [pendingCategory, setPendingCategory] = useState<InventoryProductCategory>();
  const [pendingCatalogTransition, setPendingCatalogTransition] =
    useState<PendingCatalogTransition>();
  const [error, setError] = useState<ValidationError>();
  const [idempotencyKey, setIdempotencyKey] = useState(() => crypto.randomUUID());
  const authorityRef = useRef<string | undefined>(undefined);
  const authorityGenerationRef = useRef(0);
  const submitLockRef = useRef(false);
  const onStateChangeRef = useRef(onStateChange);
  const onAuthorityInvalidatedRef = useRef(onAuthorityInvalidated);
  const lastReportedStateRef = useRef<InventoryProductIntakeState | undefined>(undefined);
  const canEnterCost = shell.permissions?.canAllocateInventoryCosts === true;
  const inspectionEnabled =
    shell.permissions?.inventoryProductInspectionEnabled === true &&
    shell.permissions?.canInspectInventory === true;

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
            ? "正在保存商品，请等待结果后再离开。"
            : "当前商品资料尚未保存，继续填写或确认离开。",
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
    submitLockRef.current = false;
    mutation.reset();
    setError({ message: "门店或权限已变化，旧草稿已清除，请重新录入。" });
    onAuthorityInvalidatedRef.current?.();
  }, [mutation, shell.authorityFingerprint, shell.isLoading]);

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

  const closeIntake = () => {
    if (surface === "page" && !leaveGuard.requestLeave()) return;
    if (onCancel) {
      onCancel();
      return;
    }
    router.push("/inventory");
  };

  if (shell.isLoading) {
    return (
      <IntakeMessage
        title="正在载入录入权限"
        body="确认当前门店和账号权限后即可开始录入。"
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
        title="无法录入商品"
        body={
          shell.permissions?.canCreateInventory
            ? "当前门店尚未启用商品快速录入。"
            : "当前账号没有商品录入权限。"
        }
        onBack={closeIntake}
        surface={surface}
      />
    );
  }

  const activeStoreId = shell.activeStore.id;

  const save = async (continueEntry: boolean) => {
    if (submitLockRef.current) return;
    if (pendingCatalogTransition) {
      setError({ message: "请先确认品牌或型号切换，再保存商品。" });
      focusCatalogTransitionConfirmation();
      return;
    }
    if (pendingCategory) {
      setError({ message: "请先确认商品类别切换，再保存商品。" });
      focusCategoryConfirmation();
      return;
    }
    setError(undefined);
    const validation = validateDraft(draft, canEnterCost);
    if (validation) {
      setError(validation);
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
        ].includes(fieldId)
      ) {
        requestAnimationFrame(() => document.getElementById(fieldId)?.focus());
      } else {
        document.getElementById(fieldId)?.focus();
      }
      return;
    }
    if (typeof navigator !== "undefined" && !navigator.onLine) {
      setError({ message: "当前离线，恢复联网后再保存；草稿会保留在当前页面。" });
      return;
    }

    submitLockRef.current = true;
    const submitAuthorityGeneration = authorityGenerationRef.current;
    try {
      const result = await mutation.mutateAsync(toInput(draft, idempotencyKey, canEnterCost));
      if (submitAuthorityGeneration !== authorityGenerationRef.current) return;
      toast.success(`商品 ${result.sku} 已录入`);
      if (continueEntry) {
        await queryClient.invalidateQueries({
          queryKey: inventoryProductKeys.listsForStore(activeStoreId),
        });
        setDraft(sameProductDraft(draft));
        setIdempotencyKey(crypto.randomUUID());
        setError(undefined);
        document
          .getElementById(draft.category === "phone" ? "product-imei1" : "product-serial")
          ?.focus();
      } else {
        leaveGuard.markSaved();
        if (onCreated) await onCreated(result.id);
        else {
          await queryClient.invalidateQueries({
            queryKey: inventoryProductKeys.listsForStore(activeStoreId),
          });
          router.push(`/inventory/${result.id}`);
        }
      }
    } catch (cause) {
      setError({ message: cause instanceof Error ? cause.message : "商品保存失败，请重试" });
    } finally {
      submitLockRef.current = false;
    }
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

  const IntakeRoot = surface === "page" ? "main" : "div";

  return (
    <IntakeRoot
      data-inventory-product-intake-surface={surface}
      className={cn(
        surface === "page" &&
          cn(
            repairOs.mobileFloatingPage,
            "mx-auto w-full max-w-[430px] px-2 pb-28 pt-[var(--repair-os-mobile-floating-offset,5.25rem)] lg:max-w-4xl lg:px-0 lg:pb-8 lg:pt-0",
          ),
        surface === "dialog" &&
          "flex h-[calc(100svh-16px)] max-h-[calc(100svh-16px)] min-h-0 w-full flex-col overflow-hidden rounded-[var(--radius-lg)] border border-[var(--border-panel)] bg-[var(--surface-workspace-strong)] p-2 shadow-[var(--shadow-overlay)] sm:h-auto sm:max-h-[calc(100svh-32px)] sm:p-3",
      )}
    >
      {surface === "page" ? (
        <>
          <div className={cn(repairOs.mobileFloatingHeaderShell, "lg:static lg:mb-4")}>
            <section className={repairOs.mobileFloatingHeaderCard}>
              <header className={repairOs.mobileFloatingHeaderNav}>
                <Button
                  type="button"
                  variant="ghost"
                  size="iconDense"
                  className="size-9 rounded-lg"
                  aria-label="返回商品库存"
                  onClick={closeIntake}
                >
                  <ArrowLeft className="size-5" />
                </Button>
                <div className="min-w-0 text-center">
                  <h1 className="text-sm font-semibold">快速录入商品</h1>
                  <p className="text-[10px] text-muted-foreground lg:text-[11px] lg:leading-4">
                    三个字段即可保存
                  </p>
                </div>
                <span className="size-9" aria-hidden />
              </header>
            </section>
          </div>

          <header className="hidden items-center justify-between gap-4 pb-3 lg:flex">
            <div>
              <h1 className="text-xl font-semibold">快速录入商品</h1>
              <p className="text-sm text-muted-foreground">
                品牌、型号与设备标识即可开始，其他资料可随时补充
              </p>
            </div>
            <Button type="button" variant="outline" onClick={closeIntake}>
              <ArrowLeft className="mr-2 size-4" />
              返回库存
            </Button>
          </header>
        </>
      ) : (
        <header className="mb-2 flex min-w-0 shrink-0 items-center gap-2 rounded-[var(--radius-lg)] border border-[var(--border-panel)] bg-[var(--surface-panel)] p-2 sm:px-3 sm:py-2.5">
          <div className="min-w-0 flex-1">
            <p className="text-[9px] font-medium leading-3 text-muted-foreground sm:text-[10px]">
              库存弹窗录入
            </p>
            <h1 className="truncate text-sm font-semibold leading-5 sm:text-base">快速录入商品</h1>
            <p className="truncate text-[10px] leading-4 text-muted-foreground sm:text-xs">
              三个字段即可保存，其他资料可稍后补充
            </p>
          </div>
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="size-11 shrink-0 rounded-lg sm:size-9"
            aria-label="关闭商品录入弹窗"
            onClick={closeIntake}
          >
            <X className="size-4" />
          </Button>
        </header>
      )}

      <form
        className={cn(
          "space-y-1.5",
          surface === "dialog" &&
            "min-h-0 min-w-0 max-w-full flex-1 overflow-x-hidden overflow-y-auto overscroll-contain px-0.5 pb-0.5 scroll-pb-24 sm:max-h-[calc(100svh-9.5rem)] sm:px-1",
        )}
        aria-busy={mutation.isPending}
        onSubmit={(event) => {
          event.preventDefault();
          void save(false);
        }}
      >
        <InventoryProductForm
          draft={toFormDraft(draft)}
          categories={inventoryProductFormCategories}
          surface={surface === "dialog" ? "dialog" : "page"}
          categoryDisabled={Boolean(pendingCategory || pendingCatalogTransition)}
          catalogDisabled={Boolean(pendingCategory || pendingCatalogTransition)}
          autoFocusBrand={shouldAutoFocusBrand(surface)}
          brandInvalid={error?.fieldId === "product-brand"}
          modelInvalid={error?.fieldId === "product-model"}
          inspectionBatteryInvalid={error?.fieldId === "product-battery-health"}
          categoryNotice={
            pendingCategory ? (
              <div
                data-ui="inventory-product-category-confirm"
                className="mt-2 grid gap-2 rounded-lg border border-status-warn-foreground/20 bg-status-warn px-2.5 py-2 text-status-warn-foreground sm:grid-cols-[minmax(0,1fr)_auto] sm:items-center"
                role="status"
                aria-live="polite"
              >
                <p className="text-[11px] leading-4 sm:text-xs">
                  切换到“
                  {
                    inventoryProductFormCategories.find((item) => item.value === pendingCategory)
                      ?.label
                  }
                  ”会清除当前品牌、型号、规格和设备标识。
                </p>
                <div className="grid grid-cols-2 gap-1.5">
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    className="min-h-9"
                    onClick={() => setPendingCategory(undefined)}
                  >
                    继续编辑
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    className="min-h-9 bg-background"
                    onClick={() => {
                      const category = pendingCategory;
                      applyCategory(category);
                      requestAnimationFrame(() =>
                        document.getElementById(`product-category-${category}`)?.focus(),
                      );
                    }}
                  >
                    清空并切换
                  </Button>
                </div>
              </div>
            ) : null
          }
          catalogNotice={
            pendingCatalogTransition ? (
              <CatalogTransitionConfirm
                kind={pendingCatalogTransition.kind}
                onCancel={cancelCatalogTransition}
                onConfirm={confirmCatalogTransition}
              />
            ) : null
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
          inspectionEnabled={inspectionEnabled}
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
        />

        <InventoryProductFormDetails
          draft={toFormDraft(draft)}
          idPrefix="product"
          canEnterCost={canEnterCost}
          conditionInvalid={error?.fieldId === "product-condition"}
          gtinInvalid={error?.fieldId === "product-gtin"}
          listPriceInvalid={error?.fieldId === "product-price"}
          costInvalid={error?.fieldId === "product-cost"}
          warrantyInvalid={error?.fieldId === "product-warranty"}
          identifierSection={
            <InventoryProductIdentifierSection
              draft={toFormDraft(draft)}
              idPrefix="product"
              description={
                surface === "dialog"
                  ? "弹窗内可粘贴或手工输入；完整页面仍保留摄像头扫码与本机图片识别。"
                  : "可用摄像头扫码、照片识别、粘贴或手工输入；原图仅在本机处理。"
              }
              showScanner={surface === "page"}
              allowPrimarySelection
              invalidKinds={{
                imei1: error?.fieldId === "product-imei1",
                imei2: error?.fieldId === "product-imei2",
                serial: error?.fieldId === "product-serial",
                eid: error?.fieldId === "product-eid",
              }}
              onIdentifierChange={(kind, value) =>
                setDraft((current) => ({ ...current, [kind]: value }))
              }
              onIdentifierSource={(kind, source) => setIdentifierSource(setDraft, kind, source)}
              onPrimaryIdentifierChange={(kind) =>
                setDraft((current) => ({ ...current, primary_identifier_kind: kind }))
              }
            />
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

        {error ? (
          <p
            id="product-form-error"
            role="alert"
            className="rounded-xl border border-destructive/30 bg-destructive/5 px-4 py-3 text-sm text-destructive"
          >
            {error.message}
          </p>
        ) : null}

        <div
          data-ui="inventory-product-actions"
          className={cn(
            surfaces.stickyActions,
            surface === "page" &&
              "fixed bottom-[calc(env(safe-area-inset-bottom)+0.5rem)] left-1/2 z-30 mx-0 grid w-[calc(100%_-_1rem)] max-w-[414px] -translate-x-1/2 grid-cols-2 gap-1.5 rounded-xl border border-border bg-background/95 px-2 py-2 shadow-[var(--shadow-card)] sm:mx-0 lg:sticky lg:bottom-0 lg:left-auto lg:w-auto lg:max-w-none lg:translate-x-0 lg:px-0 lg:pb-0",
            surface === "dialog" &&
              "sticky bottom-0 z-20 grid grid-cols-2 gap-1.5 rounded-xl border border-border bg-background/95 px-2 py-2 shadow-[var(--shadow-card)]",
          )}
        >
          <Button
            type="button"
            variant="outline"
            className="min-h-11"
            disabled={mutation.isPending || Boolean(pendingCategory || pendingCatalogTransition)}
            onClick={() => void save(true)}
          >
            {mutation.isPending ? <Loader2 className="mr-2 size-4 animate-spin" /> : null}
            保存并继续录入
          </Button>
          <Button
            type="submit"
            className="min-h-11"
            disabled={mutation.isPending || Boolean(pendingCategory || pendingCatalogTransition)}
          >
            {mutation.isPending ? <Loader2 className="mr-2 size-4 animate-spin" /> : null}
            保存并查看商品
          </Button>
        </div>
      </form>
    </IntakeRoot>
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
  });
}

function validateDraft(draft: Draft, canEnterCost: boolean) {
  return validateInventoryProductFormDraft(toFormDraft(draft), { canEnterCost });
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
  const label = kind === "brand" ? "品牌" : "型号";
  const clearSummary =
    kind === "brand" ? "型号、内存、容量、颜色和型号专属规格" : "内存、容量、颜色和型号专属规格";
  return (
    <div
      data-ui="inventory-product-catalog-transition-confirm"
      className="grid gap-2 rounded-lg border border-status-warn-foreground/20 bg-status-warn px-2.5 py-2 text-status-warn-foreground sm:grid-cols-[minmax(0,1fr)_auto] sm:items-center"
      role="status"
      aria-live="polite"
    >
      <p className="text-[11px] leading-4 sm:text-xs">
        更换{label}会清除{clearSummary}；IMEI / 序列号、售价、成本、库位、保修和备注会保留。
      </p>
      <div className="grid grid-cols-2 gap-1.5">
        <Button type="button" variant="ghost" size="sm" className="min-h-9" onClick={onCancel}>
          保留原资料
        </Button>
        <Button
          type="button"
          variant="outline"
          size="sm"
          className="min-h-9 bg-background"
          onClick={onConfirm}
        >
          清理并切换
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
          返回商品库存
        </Button>
      </section>
    </Root>
  );
}
