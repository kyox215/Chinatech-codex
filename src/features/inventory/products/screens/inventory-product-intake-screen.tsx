"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import {
  ArrowLeft,
  ChevronDown,
  Gamepad2,
  Laptop,
  Loader2,
  PackageOpen,
  Smartphone,
  Tablet,
  X,
} from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { ImeiScannerField } from "@/components/imei-scanner-field";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { useStoreShellContext } from "@/features/stores/api/use-store-shell-context";
import { COMPACT_WORKSPACE_BREAKPOINT } from "@/hooks/use-mobile";
import { createInventoryProduct } from "@/lib/repairdesk/api";
import type { CreateInventoryProductInput, InventoryProductCategory } from "@/lib/repairdesk/types";
import { repairOs, surfaces } from "@/lib/ui-patterns";
import { cn } from "@/lib/utils";

import { inventoryProductKeys } from "../api/query-keys";
import {
  deviceBrandSuggestions,
  isValidGtin,
  validateProductIdentifiers,
} from "../model/device-data";

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
  identifier_sources: Record<"imei1" | "imei2" | "serial" | "eid", "manual" | "scan">;
  list_price: string;
  cost_amount: string;
  location: string;
  warranty_months: string;
  notes: string;
};

type ValidationError = { message: string; fieldId?: string };

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

const categories = [
  { value: "phone", label: "手机", icon: Smartphone },
  { value: "tablet", label: "平板", icon: Tablet },
  { value: "computer", label: "电脑", icon: Laptop },
  { value: "game_console", label: "游戏机", icon: Gamepad2 },
  { value: "other", label: "其他", icon: PackageOpen },
] satisfies Array<{ value: InventoryProductCategory; label: string; icon: typeof Smartphone }>;

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
    identifier_sources: { imei1: "manual", imei2: "manual", serial: "manual", eid: "manual" },
    list_price: "",
    cost_amount: "",
    location: "",
    warranty_months: "",
    notes: "",
  };
}

function isDraftDirty(draft: Draft) {
  return (
    draft.category !== "phone" ||
    [
      draft.brand,
      draft.model,
      draft.color,
      draft.ram_capacity,
      draft.storage_capacity,
      draft.gtin,
      draft.condition,
      draft.imei1,
      draft.imei2,
      draft.serial,
      draft.eid,
      draft.list_price,
      draft.cost_amount,
      draft.location,
      draft.warranty_months,
      draft.notes,
      ...Object.values(draft.specifications),
    ].some((value) => value.trim().length > 0)
  );
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
  const [moreOpen, setMoreOpen] = useState(false);
  const [pendingCategory, setPendingCategory] = useState<InventoryProductCategory>();
  const [error, setError] = useState<ValidationError>();
  const [idempotencyKey, setIdempotencyKey] = useState(() => crypto.randomUUID());
  const authorityRef = useRef<string | undefined>(undefined);
  const authorityGenerationRef = useRef(0);
  const submitLockRef = useRef(false);
  const onStateChangeRef = useRef(onStateChange);
  const onAuthorityInvalidatedRef = useRef(onAuthorityInvalidated);
  const lastReportedStateRef = useRef<InventoryProductIntakeState | undefined>(undefined);
  const canEnterCost = shell.permissions?.canAllocateInventoryCosts === true;

  const mutation = useMutation({
    mutationFn: (input: CreateInventoryProductInput) => createInventoryProduct(input),
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
    setMoreOpen(false);
    setPendingCategory(undefined);
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
        setMoreOpen(true);
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
        setMoreOpen(false);
        setError(undefined);
        document
          .getElementById(draft.category === "phone" ? "product-imei1" : "product-serial")
          ?.focus();
      } else {
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
            gtin: "",
            specifications: {},
          }),
    }));
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
          ? categories.length - 1
          : delta
            ? (index + delta + categories.length) % categories.length
            : undefined;
    if (nextIndex === undefined) return;
    event.preventDefault();
    const next = categories[nextIndex].value;
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
            "mx-auto w-full max-w-[430px] px-2 pb-28 pt-[var(--repair-os-mobile-floating-offset,5.25rem)] lg:max-w-3xl lg:px-0 lg:pb-8 lg:pt-0",
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
        <section className={cn(repairOs.mobileInfoCard, "space-y-2 p-2.5 md:p-4")}>
          <fieldset>
            <legend className="mb-1.5 text-xs font-semibold">
              类别 <span className="text-destructive">*</span>
            </legend>
            <div className="grid grid-cols-5 gap-1.5" role="radiogroup" aria-label="商品类别">
              {categories.map(({ value, label, icon: Icon }, index) => (
                <button
                  id={`product-category-${value}`}
                  key={value}
                  type="button"
                  role="radio"
                  aria-checked={draft.category === value}
                  tabIndex={draft.category === value ? 0 : -1}
                  className={cn(
                    "flex min-h-8 min-w-0 flex-col items-center justify-center gap-0.5 rounded-lg border px-1 text-[10px] font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring lg:text-xs lg:leading-4",
                    draft.category === value
                      ? "border-primary bg-primary/10 text-primary"
                      : "border-border bg-card",
                  )}
                  onClick={() => selectCategory(value)}
                  onKeyDown={(event) => handleCategoryKeyDown(event, index)}
                >
                  <Icon className="size-3.5" aria-hidden="true" />
                  {label}
                </button>
              ))}
            </div>
            {pendingCategory ? (
              <div
                data-ui="inventory-product-category-confirm"
                className="mt-2 grid gap-2 rounded-lg border border-status-warn-foreground/20 bg-status-warn px-2.5 py-2 text-status-warn-foreground sm:grid-cols-[minmax(0,1fr)_auto] sm:items-center"
                role="status"
                aria-live="polite"
              >
                <p className="text-[11px] leading-4 sm:text-xs">
                  切换到“{categories.find((item) => item.value === pendingCategory)?.label}
                  ”会清除当前品牌、型号、规格和设备标识。
                </p>
                <div className="grid grid-cols-2 gap-1.5">
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    className="min-h-9"
                    autoFocus
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
            ) : null}
          </fieldset>

          <div className="grid grid-cols-[minmax(0,0.85fr)_minmax(0,1.15fr)] gap-1.5">
            <Field
              id="product-brand"
              label="品牌"
              required
              autoFocus={shouldAutoFocusBrand(surface)}
              value={draft.brand}
              placeholder="例如 Apple、Samsung"
              list="product-brand-suggestions"
              invalid={error?.fieldId === "product-brand"}
              onChange={(brand) => setDraft((current) => ({ ...current, brand }))}
            />
            <datalist id="product-brand-suggestions">
              {deviceBrandSuggestions[draft.category].map((brand) => (
                <option key={brand} value={brand} />
              ))}
            </datalist>
            <Field
              id="product-model"
              label="型号 / 商品名称"
              required
              value={draft.model}
              placeholder="例如 iPhone 13"
              invalid={error?.fieldId === "product-model"}
              onChange={(model) => setDraft((current) => ({ ...current, model }))}
            />
          </div>
        </section>

        <section className={cn(repairOs.mobileInfoCard, "grid grid-cols-2 gap-2 p-2.5 md:p-4")}>
          {draft.category !== "other" ? (
            <Field
              id="product-storage"
              label={draft.category === "computer" ? "硬盘 / 存储容量" : "存储容量"}
              value={draft.storage_capacity}
              placeholder={draft.category === "computer" ? "例如 512 GB" : "例如 128 GB"}
              onChange={(storage_capacity) =>
                setDraft((current) => ({ ...current, storage_capacity }))
              }
            />
          ) : null}
          {["phone", "tablet", "computer"].includes(draft.category) ? (
            <Field
              id="product-ram"
              label="内存（RAM）"
              value={draft.ram_capacity}
              placeholder="例如 8 GB"
              onChange={(ram_capacity) => setDraft((current) => ({ ...current, ram_capacity }))}
            />
          ) : null}
          <Field
            id="product-color"
            label="设备颜色"
            value={draft.color}
            placeholder="例如 蓝色"
            onChange={(color) => setDraft((current) => ({ ...current, color }))}
          />
          {draft.category === "game_console" ? (
            <Field
              id="product-spec-edition"
              label="版本"
              value={draft.specifications.edition ?? ""}
              placeholder="例如 Slim、OLED"
              onChange={(edition) =>
                setDraft((current) => ({
                  ...current,
                  specifications: { ...current.specifications, edition },
                }))
              }
            />
          ) : null}
        </section>

        <section className={cn(repairOs.mobileInfoCard, "space-y-2 p-2.5 md:p-4")}>
          <div>
            <h2 className="text-sm font-semibold">设备标识</h2>
            <p className="mt-0.5 text-[10px] leading-4 text-muted-foreground lg:text-xs lg:leading-4">
              {surface === "dialog"
                ? "弹窗内可粘贴或手工输入；完整页面仍保留摄像头扫码与本机图片识别。"
                : "可用摄像头扫码、照片识别、粘贴或手工输入；原图仅在本机处理。"}
            </p>
          </div>
          {draft.category === "phone" ? (
            <IdentifierField
              id="product-imei1"
              label="IMEI 1"
              value={draft.imei1}
              invalid={error?.fieldId === "product-imei1"}
              showScanner={surface === "page"}
              onChange={(imei1) => setDraft((current) => ({ ...current, imei1 }))}
              onSource={(source) =>
                setDraft((current) => ({
                  ...current,
                  identifier_sources: { ...current.identifier_sources, imei1: source },
                }))
              }
            />
          ) : (
            <IdentifierField
              id="product-serial"
              label="序列号"
              value={draft.serial}
              invalid={error?.fieldId === "product-serial"}
              showScanner={surface === "page"}
              onChange={(serial) => setDraft((current) => ({ ...current, serial }))}
              onSource={(source) =>
                setDraft((current) => ({
                  ...current,
                  identifier_sources: { ...current.identifier_sources, serial: source },
                }))
              }
            />
          )}
        </section>

        <section className={cn(repairOs.mobileInfoCard, "overflow-hidden p-0")}>
          <button
            type="button"
            className="flex min-h-9 w-full items-center justify-between px-3 text-left text-xs font-semibold focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring"
            aria-expanded={moreOpen}
            onClick={() => setMoreOpen((open) => !open)}
          >
            <span>
              <span className="block">更多信息</span>
              <span className="text-[10px] font-normal leading-4 text-muted-foreground lg:text-[11px] lg:leading-4">
                标识、规格、售价、库位等均可稍后补充
              </span>
            </span>
            <ChevronDown className={cn("size-4 transition-transform", moreOpen && "rotate-180")} />
          </button>
          {moreOpen ? (
            <div className="grid grid-cols-2 gap-2 border-t border-border p-2.5 md:p-4">
              <Field
                id="product-condition"
                label="成色"
                value={draft.condition}
                placeholder="例如 全新、良好、有使用痕迹"
                onChange={(condition) => setDraft((current) => ({ ...current, condition }))}
              />
              {draft.category === "phone" ? (
                <IdentifierField
                  id="product-imei2"
                  label="IMEI 2"
                  value={draft.imei2}
                  invalid={error?.fieldId === "product-imei2"}
                  showScanner={surface === "page"}
                  onChange={(imei2) => setDraft((current) => ({ ...current, imei2 }))}
                  onSource={(source) => setIdentifierSource(setDraft, "imei2", source)}
                />
              ) : null}
              {draft.category === "phone" ? (
                <IdentifierField
                  id="product-eid"
                  label="EID"
                  value={draft.eid}
                  invalid={error?.fieldId === "product-eid"}
                  showScanner={surface === "page"}
                  onChange={(eid) => setDraft((current) => ({ ...current, eid }))}
                  onSource={(source) => setIdentifierSource(setDraft, "eid", source)}
                />
              ) : null}
              <Field
                id="product-gtin"
                label="EAN / GTIN（同款条码）"
                value={draft.gtin}
                inputMode="numeric"
                placeholder="8、13 或 14 位商品条码"
                invalid={error?.fieldId === "product-gtin"}
                onChange={(gtin) => setDraft((current) => ({ ...current, gtin }))}
              />
              {categorySpecificationFields(draft.category)
                .filter((field) => !(draft.category === "game_console" && field.key === "edition"))
                .map((field) => (
                  <Field
                    key={field.key}
                    id={`product-spec-${field.key}`}
                    label={field.label}
                    value={draft.specifications[field.key] ?? ""}
                    placeholder={field.placeholder}
                    onChange={(value) =>
                      setDraft((current) => ({
                        ...current,
                        specifications: { ...current.specifications, [field.key]: value },
                      }))
                    }
                  />
                ))}
              <Field
                id="product-price"
                label="计划售价"
                inputMode="decimal"
                value={draft.list_price}
                placeholder="未填写"
                invalid={error?.fieldId === "product-price"}
                onChange={(list_price) => setDraft((current) => ({ ...current, list_price }))}
              />
              {canEnterCost ? (
                <Field
                  id="product-cost"
                  label="入库成本"
                  inputMode="decimal"
                  value={draft.cost_amount}
                  placeholder="未填写"
                  invalid={error?.fieldId === "product-cost"}
                  onChange={(cost_amount) => setDraft((current) => ({ ...current, cost_amount }))}
                />
              ) : null}
              <Field
                id="product-location"
                label="库位"
                value={draft.location}
                placeholder="例如 A-02"
                onChange={(location) => setDraft((current) => ({ ...current, location }))}
              />
              <Field
                id="product-warranty"
                label="保修（月）"
                inputMode="numeric"
                value={draft.warranty_months}
                placeholder="未填写"
                invalid={error?.fieldId === "product-warranty"}
                onChange={(warranty_months) =>
                  setDraft((current) => ({ ...current, warranty_months }))
                }
              />
              <div className="col-span-2 space-y-1.5">
                <Label htmlFor="product-notes">内部备注</Label>
                <Textarea
                  id="product-notes"
                  value={draft.notes}
                  maxLength={2000}
                  className="min-h-20 resize-y text-base lg:text-sm"
                  placeholder="可选"
                  onChange={(event) =>
                    setDraft((current) => ({ ...current, notes: event.target.value }))
                  }
                />
              </div>
            </div>
          ) : null}
        </section>

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
            className="min-h-9"
            disabled={mutation.isPending}
            onClick={() => void save(true)}
          >
            {mutation.isPending ? <Loader2 className="mr-2 size-4 animate-spin" /> : null}
            保存并继续录入
          </Button>
          <Button type="submit" className="min-h-10" disabled={mutation.isPending}>
            {mutation.isPending ? <Loader2 className="mr-2 size-4 animate-spin" /> : null}
            保存并查看商品
          </Button>
        </div>
      </form>
    </IntakeRoot>
  );
}

function Field({
  id,
  label,
  value,
  onChange,
  required,
  placeholder,
  inputMode,
  invalid,
  list,
  autoFocus,
}: {
  id: string;
  label: string;
  value: string;
  onChange: (value: string) => void;
  required?: boolean;
  placeholder?: string;
  inputMode?: React.HTMLAttributes<HTMLInputElement>["inputMode"];
  invalid?: boolean;
  list?: string;
  autoFocus?: boolean;
}) {
  return (
    <div className="min-w-0 space-y-1">
      <Label htmlFor={id} className="text-xs">
        {label}
        {required ? <span className="text-destructive"> *</span> : null}
      </Label>
      <Input
        id={id}
        autoFocus={autoFocus}
        value={value}
        required={required}
        maxLength={160}
        inputMode={inputMode}
        list={list}
        placeholder={placeholder}
        aria-invalid={invalid || undefined}
        aria-describedby={invalid ? "product-form-error" : undefined}
        className="h-[38px] min-w-0 text-base lg:h-9 lg:text-sm"
        onChange={(event) => onChange(event.target.value)}
      />
    </div>
  );
}

function shouldAutoFocusBrand(surface: "page" | "dialog") {
  return (
    surface === "dialog" &&
    typeof window !== "undefined" &&
    window.innerWidth >= COMPACT_WORKSPACE_BREAKPOINT
  );
}

function IdentifierField({
  id,
  label,
  value,
  onChange,
  onSource,
  invalid,
  showScanner = true,
}: {
  id: string;
  label: string;
  value: string;
  onChange: (value: string) => void;
  onSource: (source: "manual" | "scan") => void;
  invalid?: boolean;
  showScanner?: boolean;
}) {
  return (
    <div className="col-span-2 min-w-0 space-y-1">
      <Label htmlFor={id} className="text-xs">
        {label}
      </Label>
      <ImeiScannerField
        inputId={id}
        inputAriaLabel={label}
        identifierLabel={label}
        inputMode={id.includes("serial") ? "text" : "numeric"}
        ariaInvalid={invalid}
        ariaDescribedBy={invalid ? `${id}-error` : undefined}
        value={value}
        onChange={onChange}
        onCommitSource={onSource}
        placeholder={`扫描或输入${label}`}
        density="compact"
        showScanner={showScanner}
      />
      {invalid ? (
        <p id={`${id}-error`} className="text-xs text-destructive">
          请检查{label}格式
        </p>
      ) : null}
    </div>
  );
}

function toInput(
  draft: Draft,
  idempotency_key: string,
  canEnterCost: boolean,
): CreateInventoryProductInput {
  const identifiers = (["imei1", "imei2", "serial", "eid"] as const)
    .filter((kind) => draft[kind].trim())
    .map((kind, index) => ({
      kind,
      value: draft[kind].trim(),
      source: draft.identifier_sources[kind],
      primary: index === 0,
    }));
  return {
    idempotency_key,
    category: draft.category,
    brand: draft.brand.trim(),
    model: draft.model.trim(),
    color: optional(draft.color),
    ram_capacity: optional(draft.ram_capacity),
    storage_capacity: optional(draft.storage_capacity),
    gtin: optional(draft.gtin),
    condition: optional(draft.condition),
    specifications: cleanedRecord(draft.specifications),
    identifiers,
    list_price: parseOptionalMoney(draft.list_price),
    ...(canEnterCost ? { cost_amount: parseOptionalMoney(draft.cost_amount) } : {}),
    location: optional(draft.location),
    warranty_months: draft.warranty_months.trim() ? Number(draft.warranty_months) : undefined,
    notes: optional(draft.notes),
  };
}

function validateDraft(draft: Draft, canEnterCost: boolean) {
  if (!draft.brand.trim()) return { message: "请填写品牌", fieldId: "product-brand" };
  if (!draft.model.trim()) return { message: "请填写型号或商品名称", fieldId: "product-model" };
  if (draft.imei2.trim() && !draft.imei1.trim()) {
    return { message: "请先填写 IMEI 1，再填写 IMEI 2", fieldId: "product-imei1" };
  }
  for (const [label, value, fieldId] of [
    ["计划售价", draft.list_price, "product-price"],
    ...(canEnterCost ? [["入库成本", draft.cost_amount, "product-cost"]] : []),
  ] as string[][]) {
    if (value.trim() && parseOptionalMoney(value) === undefined)
      return { message: `${label}格式无效，最多两位小数`, fieldId };
  }
  if (
    draft.warranty_months.trim() &&
    (!/^\d+$/.test(draft.warranty_months) || Number(draft.warranty_months) > 120)
  )
    return {
      message: "保修月数必须是 0 到 120 的整数",
      fieldId: "product-warranty",
    };
  const identifiers = (["imei1", "imei2", "serial", "eid"] as const)
    .filter((kind) => draft[kind].trim())
    .map((kind, index) => ({
      kind,
      value: draft[kind],
      source: draft.identifier_sources[kind],
      primary: index === 0,
    }));
  const identifierError = validateProductIdentifiers(identifiers);
  if (identifierError) {
    const failingKind = (["imei1", "imei2", "serial", "eid"] as const).find((kind) =>
      identifierError.includes(kind === "serial" ? "序列号" : kind.toUpperCase()),
    );
    return { message: identifierError, fieldId: `product-${failingKind ?? "imei1"}` };
  }
  if (draft.gtin.trim() && !isValidGtin(draft.gtin)) {
    return { message: "EAN / GTIN 校验位不正确", fieldId: "product-gtin" };
  }
  return undefined;
}

function parseOptionalMoney(value: string) {
  const text = value.trim();
  if (!text) return undefined;
  if (!/^\d+(?:[.,]\d{1,2})?$/.test(text)) return undefined;
  return Number(text.replace(",", "."));
}
function optional(value: string) {
  const text = value.trim();
  return text || undefined;
}
function cleanedRecord(value: Record<string, string>) {
  return Object.fromEntries(
    Object.entries(value)
      .map(([key, item]) => [key, item.trim()])
      .filter(([, item]) => item),
  );
}
function categorySpecificationFields(category: InventoryProductCategory) {
  if (category === "computer")
    return [
      { key: "processor", label: "处理器", placeholder: "例如 Apple M3、Intel i5" },
      { key: "disk_type", label: "硬盘类型", placeholder: "例如 SSD" },
      { key: "graphics", label: "显卡", placeholder: "例如 RTX 4060" },
    ];
  if (category === "game_console")
    return [
      { key: "edition", label: "版本", placeholder: "例如 Slim、OLED" },
      { key: "region", label: "区域版本", placeholder: "例如 EU" },
      { key: "included_controller_count", label: "手柄数量", placeholder: "例如 2" },
    ];
  if (category === "phone")
    return [{ key: "network_variant", label: "网络版本", placeholder: "例如 EU、双卡" }];
  if (category === "tablet")
    return [
      { key: "connectivity", label: "联网版本", placeholder: "例如 Wi‑Fi、5G" },
      { key: "screen_size_inches", label: "屏幕尺寸", placeholder: "例如 11 英寸" },
    ];
  return [{ key: "short_specification", label: "简短规格", placeholder: "例如 蓝牙音箱 60W" }];
}

function sameProductDraft(draft: Draft): Draft {
  return {
    ...draft,
    imei1: "",
    imei2: "",
    serial: "",
    eid: "",
    identifier_sources: { imei1: "manual", imei2: "manual", serial: "manual", eid: "manual" },
    list_price: "",
    cost_amount: "",
    warranty_months: "",
    notes: "",
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
