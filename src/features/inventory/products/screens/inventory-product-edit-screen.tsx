"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ArrowLeft, Loader2, RefreshCw } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { useStoreShellContext } from "@/features/stores/api/use-store-shell-context";
import { updateInventoryProduct } from "@/lib/repairdesk/api";
import type {
  InventoryProductCategory,
  InventoryProductEditData,
  InventoryProductIdentifierKind,
  UpdateInventoryProductInput,
} from "@/lib/repairdesk/types";
import { repairOs, surfaces } from "@/lib/ui-patterns";
import { cn } from "@/lib/utils";

import { inventoryProductKeys } from "../api/query-keys";
import { inventoryProductEditQueryOptions } from "../api/query-options";
import {
  InventoryProductIdentifierSection,
  InventoryProductForm,
  InventoryProductFormDetails,
  inventoryProductFormCategories,
} from "../components/inventory-product-form";
import {
  clearInventoryProductFormDependencies,
  inventoryProductFormToUpdateInput,
  mergeInventoryProductFormDraft,
  validateInventoryProductFormDraft,
  type InventoryProductFormDraft,
} from "../model/inventory-product-form";
import { useInventoryProductLeaveGuard } from "../model/use-inventory-product-leave-guard";

type EditDraft = {
  category: InventoryProductCategory;
  brand: string;
  model: string;
  ram_capacity: string;
  storage_capacity: string;
  color: string;
  condition: string;
  gtin: string;
  identifiers: Record<InventoryProductIdentifierKind, string>;
  sources: Record<InventoryProductIdentifierKind, "manual" | "scan" | "ai_confirmed">;
  primary_identifier_kind?: InventoryProductIdentifierKind;
  specifications: Record<string, string>;
  list_price: string;
  cost_amount: string;
  location: string;
  warranty_months: string;
  notes: string;
  inspection_battery_health: string;
  inspection_face_id_status: InventoryProductFormDraft["inspection_face_id_status"];
  inspection_touched: boolean;
};

type EditFieldErrorKey =
  | "brand"
  | "model"
  | "condition"
  | "gtin"
  | "list_price"
  | "cost_amount"
  | "warranty_months"
  | "inspection_battery_health";

export function InventoryProductEditScreen({ id }: { id: string }) {
  const shell = useStoreShellContext({ monitorAuthority: true });
  return <InventoryProductEditContent key={shell.authorityFingerprint} id={id} shell={shell} />;
}

function InventoryProductEditContent({
  id,
  shell,
}: {
  id: string;
  shell: ReturnType<typeof useStoreShellContext>;
}) {
  const router = useRouter();
  const queryClient = useQueryClient();
  const storeId = shell.activeStore?.id;
  const query = useQuery({
    ...inventoryProductEditQueryOptions(id, storeId),
    enabled: Boolean(
      storeId &&
      shell.permissions?.canReadInventory &&
      shell.permissions?.canUpdateInventory &&
      shell.permissions.inventoryProductsUiEnabled,
    ),
  });
  const [draft, setDraft] = useState<EditDraft>();
  const [baseDraft, setBaseDraft] = useState<EditDraft>();
  const [version, setVersion] = useState(1);
  const [error, setError] = useState("");
  const [fieldErrors, setFieldErrors] = useState<Partial<Record<EditFieldErrorKey, string>>>({});
  const commandRef = useRef<{ fingerprint: string; idempotencyKey: string } | undefined>(undefined);
  const canEnterCost = shell.permissions?.canAllocateInventoryCosts === true;
  const inspectionEnabled =
    shell.permissions?.inventoryProductInspectionEnabled === true &&
    shell.permissions?.canInspectInventory === true;
  const mutation = useMutation({
    mutationFn: (input: UpdateInventoryProductInput) => updateInventoryProduct(id, input),
  });
  const editDirty = Boolean(
    draft &&
    baseDraft &&
    JSON.stringify(toFormDraft(draft)) !== JSON.stringify(toFormDraft(baseDraft)),
  );
  const leaveGuard = useInventoryProductLeaveGuard({
    enabled: Boolean(draft && baseDraft),
    isDirty: editDirty,
    isPending: mutation.isPending,
    onBlocked: (reason) =>
      setError(
        reason === "pending"
          ? "正在保存商品，请等待结果后再离开。"
          : "当前商品资料尚未保存，继续编辑或确认离开。",
      ),
  });

  useEffect(() => {
    if (!query.data || draft) return;
    const nextDraft = toDraft(query.data);
    setDraft(nextDraft);
    setBaseDraft(nextDraft);
    setVersion(query.data.version);
  }, [draft, query.data]);

  useEffect(() => {
    document.body.dataset.mobileWorkspaceActive = "true";
    return () => {
      delete document.body.dataset.mobileWorkspaceActive;
    };
  }, []);

  const closeEdit = () => {
    if (!leaveGuard.requestLeave()) return;
    router.push(`/inventory/${id}`);
  };

  if (shell.isLoading) {
    return <EditMessage title="正在加载商品资料" body="请稍候…" />;
  }
  if (
    !storeId ||
    !shell.permissions?.canReadInventory ||
    !shell.permissions?.canUpdateInventory ||
    !shell.permissions.inventoryProductsUiEnabled
  ) {
    return <EditMessage title="无法编辑商品" body="当前账号没有商品编辑权限。" />;
  }
  if (query.isLoading || (!draft && !query.isError)) {
    return <EditMessage title="正在加载商品资料" body="请稍候…" />;
  }
  if (query.isError || !draft) {
    return (
      <EditMessage
        title="商品资料加载失败"
        body="商品可能不存在，或网络暂时不可用。"
        action={
          <Button onClick={() => void query.refetch()}>
            <RefreshCw className="mr-2 size-4" />
            重试
          </Button>
        }
      />
    );
  }

  const save = async () => {
    setError("");
    setFieldErrors({});
    const validation = validateInventoryProductFormDraft(toFormDraft(draft), {
      canEnterCost,
    });
    if (validation) {
      setError(validation.message);
      const editFieldId = validation.fieldId
        ? editFieldIdForValidation(validation.fieldId)
        : undefined;
      const fieldKey = validation.fieldId
        ? editFieldKeyForValidation(validation.fieldId)
        : undefined;
      if (fieldKey) setFieldErrors({ [fieldKey]: validation.message });
      if (editFieldId) document.getElementById(editFieldId)?.focus();
      return;
    }
    try {
      const command = inventoryProductFormToUpdateInput(
        toFormDraft(draft),
        "00000000-0000-4000-8000-000000000000",
        version,
        { canEnterCost },
      );
      const { idempotency_key: _unusedIdempotencyKey, ...commandWithoutIdempotency } = command;
      const fingerprint = JSON.stringify(commandWithoutIdempotency);
      const idempotencyKey =
        commandRef.current?.fingerprint === fingerprint
          ? commandRef.current.idempotencyKey
          : crypto.randomUUID();
      commandRef.current = { fingerprint, idempotencyKey };
      const result = await mutation.mutateAsync({
        idempotency_key: idempotencyKey,
        ...commandWithoutIdempotency,
      });
      await queryClient.invalidateQueries({ queryKey: inventoryProductKeys.all });
      toast.success("商品资料已更新");
      leaveGuard.markSaved();
      router.push(`/inventory/${result.id}`);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "商品更新失败，请重试");
    }
  };

  return (
    <main
      className={cn(
        repairOs.mobileFloatingPage,
        "mx-auto w-full max-w-[430px] px-2 pb-28 pt-[var(--repair-os-mobile-floating-offset,5.25rem)] lg:max-w-4xl lg:px-0 lg:pb-8 lg:pt-0",
      )}
    >
      <div className={cn(repairOs.mobileFloatingHeaderShell, "lg:static lg:mb-4")}>
        <section className={repairOs.mobileFloatingHeaderCard}>
          <header className={repairOs.mobileFloatingHeaderNav}>
            <Button
              variant="ghost"
              size="icon"
              className="size-9 rounded-lg"
              aria-label="返回商品详情"
              onClick={closeEdit}
            >
              <ArrowLeft className="size-5" />
            </Button>
            <div className="min-w-0 text-center">
              <h1 className="truncate text-sm font-semibold">
                编辑 {draft.brand} {draft.model}
              </h1>
              <p className="text-[10px] text-muted-foreground lg:text-[11px] lg:leading-4">
                保存时会检查是否有其他设备已修改
              </p>
            </div>
            <span className="size-9" aria-hidden />
          </header>
        </section>
      </div>

      <header className="hidden items-center justify-between gap-4 pb-3 lg:flex">
        <div className="min-w-0">
          <h1 className="truncate text-xl font-semibold">
            编辑 {draft.brand} {draft.model}
          </h1>
          <p className="text-sm text-muted-foreground">保存时会检查是否有其他设备已修改</p>
        </div>
        <Button type="button" variant="outline" onClick={closeEdit}>
          <ArrowLeft className="mr-2 size-4" />
          返回详情
        </Button>
      </header>

      <form
        className="space-y-1.5"
        aria-busy={mutation.isPending}
        noValidate
        onSubmit={(event) => {
          event.preventDefault();
          void save();
        }}
      >
        <InventoryProductForm
          draft={toFormDraft(draft)}
          categories={inventoryProductFormCategories}
          idPrefix="product"
          brandInvalid={Boolean(fieldErrors.brand)}
          modelInvalid={Boolean(fieldErrors.model)}
          inspectionBatteryInvalid={Boolean(fieldErrors.inspection_battery_health)}
          onCategoryChange={(category) =>
            setDraft({
              ...draft,
              category,
              brand: "",
              model: "",
              ram_capacity: "",
              storage_capacity: "",
              color: "",
              specifications: {},
              inspection_battery_health: "",
              inspection_face_id_status: "not_tested",
              inspection_touched: false,
            })
          }
          onBrandChange={(brand) => {
            setFieldErrors((current) => ({ ...current, brand: undefined }));
            setDraft((current) => {
              if (!current || current.brand === brand) return current;
              return editDraftFromForm({
                ...clearInventoryProductFormDependencies(toFormDraft(current), "brand"),
                brand,
              });
            });
          }}
          onModelChange={(model) => {
            setFieldErrors((current) => ({ ...current, model: undefined }));
            setDraft((current) => {
              if (!current || current.model === model) return current;
              return editDraftFromForm({
                ...clearInventoryProductFormDependencies(toFormDraft(current), "model"),
                model,
              });
            });
          }}
          onRamChange={(ram_capacity) => setDraft({ ...draft, ram_capacity })}
          onStorageChange={(storage_capacity) => setDraft({ ...draft, storage_capacity })}
          onColorChange={(color) => setDraft({ ...draft, color })}
          inspectionEnabled={inspectionEnabled}
          onInspectionBatteryHealthChange={(inspection_battery_health) =>
            setDraft((current) =>
              current
                ? { ...current, inspection_battery_health, inspection_touched: true }
                : current,
            )
          }
          onInspectionFaceIdStatusChange={(inspection_face_id_status) =>
            setDraft((current) =>
              current
                ? { ...current, inspection_face_id_status, inspection_touched: true }
                : current,
            )
          }
        />
        <InventoryProductFormDetails
          draft={toFormDraft(draft)}
          idPrefix="product"
          canEnterCost={canEnterCost}
          conditionInvalid={Boolean(fieldErrors.condition)}
          gtinInvalid={Boolean(fieldErrors.gtin)}
          listPriceInvalid={Boolean(fieldErrors.list_price)}
          costInvalid={Boolean(fieldErrors.cost_amount)}
          warrantyInvalid={Boolean(fieldErrors.warranty_months)}
          identifierSection={
            <InventoryProductIdentifierSection
              draft={toFormDraft(draft)}
              idPrefix="product"
              description="修改或清空后保存；历史值会停用，不会物理删除。"
              allowPrimarySelection
              onIdentifierChange={(kind, value) =>
                setDraft((current) =>
                  current
                    ? { ...current, identifiers: { ...current.identifiers, [kind]: value } }
                    : current,
                )
              }
              onIdentifierSource={(kind, source) =>
                setDraft((current) =>
                  current
                    ? { ...current, sources: { ...current.sources, [kind]: source } }
                    : current,
                )
              }
              onPrimaryIdentifierChange={(kind) =>
                setDraft((current) =>
                  current ? { ...current, primary_identifier_kind: kind } : current,
                )
              }
            />
          }
          onConditionChange={(condition) => setDraft({ ...draft, condition })}
          onGtinChange={(gtin) => {
            setFieldErrors((current) => ({ ...current, gtin: undefined }));
            setDraft({ ...draft, gtin });
          }}
          onSpecificationChange={(key, value) =>
            setDraft({ ...draft, specifications: { ...draft.specifications, [key]: value } })
          }
          onListPriceChange={(list_price) => {
            setFieldErrors((current) => ({ ...current, list_price: undefined }));
            setDraft({ ...draft, list_price });
          }}
          onCostChange={(cost_amount) => {
            setFieldErrors((current) => ({ ...current, cost_amount: undefined }));
            setDraft({ ...draft, cost_amount });
          }}
          onLocationChange={(location) => setDraft({ ...draft, location })}
          onWarrantyChange={(warranty_months) => {
            setFieldErrors((current) => ({ ...current, warranty_months: undefined }));
            setDraft({ ...draft, warranty_months });
          }}
          onNotesChange={(notes) => setDraft({ ...draft, notes })}
        />

        {error ? (
          <div
            role="alert"
            className="rounded-xl border border-destructive/30 bg-destructive/5 px-4 py-3 text-sm text-destructive"
          >
            {error}
            {error.includes("其他设备") ? (
              <Button
                type="button"
                variant="link"
                className="ml-2 h-auto p-0"
                onClick={() =>
                  void query.refetch().then((result) => {
                    if (!result.data) return;
                    const latest = toDraft(result.data);
                    setDraft((current) =>
                      mergeEditDraft(baseDraft ?? current ?? latest, current ?? latest, latest),
                    );
                    setBaseDraft(latest);
                    setVersion(result.data.version);
                    setError(
                      "已合并最新资料：你的修改已保留，未修改的字段已更新。请检查后再次保存。",
                    );
                  })
                }
              >
                合并最新版本并保留我的修改
              </Button>
            ) : null}
          </div>
        ) : null}
        <div
          data-ui="inventory-product-actions"
          className={cn(
            surfaces.stickyActions,
            "fixed bottom-[calc(env(safe-area-inset-bottom)+0.5rem)] left-1/2 z-30 mx-0 grid w-[calc(100%_-_1rem)] max-w-[414px] -translate-x-1/2 grid-cols-2 gap-1.5 rounded-xl border border-border bg-background/95 px-2 py-2 shadow-[var(--shadow-card)] sm:mx-0 lg:sticky lg:bottom-0 lg:left-auto lg:w-auto lg:max-w-none lg:translate-x-0 lg:px-0 lg:pb-0",
          )}
        >
          <Button type="button" variant="outline" className="min-h-11" onClick={closeEdit}>
            取消
          </Button>
          <Button type="submit" className="min-h-11" disabled={mutation.isPending}>
            {mutation.isPending ? <Loader2 className="mr-2 size-4 animate-spin" /> : null}保存修改
          </Button>
        </div>
      </form>
    </main>
  );
}

function toDraft(data: InventoryProductEditData): EditDraft {
  const identifiers = { imei1: "", imei2: "", serial: "", eid: "" };
  const sources: EditDraft["sources"] = {
    imei1: "manual",
    imei2: "manual",
    serial: "manual",
    eid: "manual",
  };
  for (const identifier of data.identifiers) {
    identifiers[identifier.kind] = identifier.value;
    sources[identifier.kind] = identifier.source;
  }
  const primary = data.identifiers.find((identifier) => identifier.primary)?.kind;
  return {
    category: data.category,
    brand: data.brand,
    model: data.model,
    ram_capacity: data.ram_capacity ?? "",
    storage_capacity: data.storage_capacity ?? "",
    color: data.color ?? "",
    condition: data.condition ?? "",
    gtin: data.gtin ?? "",
    identifiers,
    sources,
    primary_identifier_kind: primary,
    specifications: data.specifications ?? {},
    list_price: data.list_price?.toString() ?? "",
    cost_amount: data.cost_amount?.toString() ?? "",
    location: data.location ?? "",
    warranty_months: data.warranty_months?.toString() ?? "",
    notes: data.notes ?? "",
    inspection_battery_health:
      data.inspection?.battery_health === null || data.inspection?.battery_health === undefined
        ? ""
        : String(data.inspection.battery_health),
    inspection_face_id_status: data.inspection?.face_id_status ?? "not_tested",
    inspection_touched: false,
  };
}

function toFormDraft(draft: EditDraft): InventoryProductFormDraft {
  return {
    category: draft.category,
    brand: draft.brand,
    model: draft.model,
    color: draft.color,
    ram_capacity: draft.ram_capacity,
    storage_capacity: draft.storage_capacity,
    gtin: draft.gtin,
    condition: draft.condition,
    identifiers: draft.identifiers,
    identifier_sources: draft.sources,
    primary_identifier_kind: draft.primary_identifier_kind,
    specifications: draft.specifications,
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

function mergeEditDraft(base: EditDraft, local: EditDraft, latest: EditDraft): EditDraft {
  return editDraftFromForm(
    mergeInventoryProductFormDraft(toFormDraft(base), toFormDraft(local), toFormDraft(latest)),
  );
}

function editDraftFromForm(draft: InventoryProductFormDraft): EditDraft {
  return {
    category: draft.category,
    brand: draft.brand,
    model: draft.model,
    ram_capacity: draft.ram_capacity,
    storage_capacity: draft.storage_capacity,
    color: draft.color,
    condition: draft.condition,
    gtin: draft.gtin,
    identifiers: draft.identifiers,
    sources: draft.identifier_sources,
    primary_identifier_kind: draft.primary_identifier_kind,
    specifications: draft.specifications,
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

const editValidationFieldIds: Record<string, string> = {
  "product-brand": "product-brand",
  "product-model": "product-model",
  "product-condition": "product-condition",
  "product-gtin": "product-gtin",
  "product-price": "product-price",
  "product-cost": "product-cost",
  "product-warranty": "product-warranty",
  "product-notes": "product-notes",
  "product-battery-health": "product-battery-health",
};

const editValidationFieldKeys: Record<string, EditFieldErrorKey> = {
  "product-brand": "brand",
  "product-model": "model",
  "product-condition": "condition",
  "product-gtin": "gtin",
  "product-price": "list_price",
  "product-cost": "cost_amount",
  "product-warranty": "warranty_months",
  "product-battery-health": "inspection_battery_health",
};

function editFieldIdForValidation(fieldId: string) {
  return editValidationFieldIds[fieldId] ?? fieldId;
}

function editFieldKeyForValidation(fieldId: string) {
  return editValidationFieldKeys[fieldId];
}

function EditMessage({
  title,
  body,
  action,
}: {
  title: string;
  body: string;
  action?: React.ReactNode;
}) {
  return (
    <main className={cn(repairOs.mobileFloatingPage, "grid min-h-[55dvh] place-items-center p-4")}>
      <section className={cn(repairOs.mobileInfoCard, "max-w-sm p-6 text-center")}>
        <h1 className="font-semibold">{title}</h1>
        <p className="mt-2 text-sm text-muted-foreground">{body}</p>
        {action ? <div className="mt-4">{action}</div> : null}
      </section>
    </main>
  );
}
