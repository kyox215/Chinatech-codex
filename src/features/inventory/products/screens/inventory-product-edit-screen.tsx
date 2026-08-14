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

import { inventoryCatalogKeys, inventoryProductKeys } from "../api/query-keys";
import {
  inventoryCatalogQueryOptions,
  inventoryProductEditQueryOptions,
} from "../api/query-options";
import { InventoryProductFormWorkspace } from "../components/inventory-product-form-workspace";
import { InventoryProductIdentifierField } from "../components/inventory-product-identifier-field";
import { InventoryConsequenceDialog } from "../../components/inventory-consequence-dialog";
import {
  getInventoryConflictDetails,
  InventoryConflictPanel,
  type InventoryConflictDetails,
} from "../../components/inventory-conflict-panel";
import {
  InventorySyncStatusPanel,
  type InventorySyncStatus,
} from "../../components/inventory-sync-status-panel";
import { InventoryProductPageFrame } from "../components/inventory-product-page-frame";
import {
  clearInventoryProductFormDependencies,
  inventoryProductFormToUpdateInput,
  mergeInventoryProductFormDraft,
  validateInventoryProductFormDraft,
  type InventoryProductFormDraft,
} from "../model/inventory-product-form";
import { useInventoryProductLeaveGuard } from "../model/use-inventory-product-leave-guard";
import { inventorySafeOperationMessage } from "../../model/inventory-operation-error";

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
  const [recoveryMessage, setRecoveryMessage] = useState("");
  const [conflict, setConflict] = useState<InventoryConflictDetails | null>(null);
  const [isRecoveringConflict, setIsRecoveringConflict] = useState(false);
  const [syncStatus, setSyncStatus] = useState<InventorySyncStatus>();
  const [syncTargetId, setSyncTargetId] = useState<string>();
  const [fieldErrors, setFieldErrors] = useState<Partial<Record<EditFieldErrorKey, string>>>({});
  const catalogQuery = useQuery({
    ...inventoryCatalogQueryOptions(
      { category: draft?.category ?? "phone", brand: draft?.brand || undefined, limit: 100 },
      storeId,
    ),
    enabled: Boolean(
      storeId &&
      draft?.category &&
      shell.permissions?.canReadInventory &&
      shell.permissions.inventoryProductsUiEnabled,
    ),
  });
  const commandRef = useRef<{ fingerprint: string; idempotencyKey: string } | undefined>(undefined);
  const leaveTriggerRef = useRef<HTMLElement | null>(null);
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
  const syncBlocked = Boolean(syncStatus && syncStatus !== "recovered");
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

  const closeEdit = (event?: React.MouseEvent<HTMLButtonElement>) => {
    leaveTriggerRef.current = event?.currentTarget ?? leaveTriggerRef.current;
    leaveGuard.requestLeave(() => router.push(`/inventory/${id}`), leaveTriggerRef.current);
  };

  const retryCommittedSync = async () => {
    if (!syncTargetId) return;
    setSyncStatus("committed-refreshing");
    try {
      await queryClient.invalidateQueries({
        queryKey: inventoryProductKeys.listsForStore(storeId),
      });
      await queryClient.invalidateQueries({
        queryKey: inventoryCatalogKeys.catalogsForStore(storeId),
      });
      const result = await query.refetch();
      if (!result.isSuccess || !result.data) throw new Error("无法读取最新商品资料");
      await Promise.resolve(router.push(`/inventory/${syncTargetId}`));
      setSyncStatus("recovered");
    } catch {
      setSyncStatus("committed-refresh-failed");
    }
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
    if (syncBlocked) return;
    setError("");
    setRecoveryMessage("");
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
    let result: Awaited<ReturnType<typeof mutation.mutateAsync>>;
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
      result = await mutation.mutateAsync({
        idempotency_key: idempotencyKey,
        ...commandWithoutIdempotency,
      });
    } catch (cause) {
      const nextConflict = getInventoryConflictDetails(cause);
      if (nextConflict) {
        setConflict(nextConflict);
        setError("");
        setRecoveryMessage("");
        if (nextConflict.kind === "idempotency") commandRef.current = undefined;
      } else {
        setConflict(null);
        setRecoveryMessage("");
        setError(inventorySafeOperationMessage(cause, "商品更新失败，请重试"));
      }
      return;
    }

    // The mutation has committed. Keep post-commit synchronization separate so
    // cache or navigation failures never look like a failed write.
    commandRef.current = undefined;
    setSyncTargetId(result.id);
    setSyncStatus("committed-refreshing");
    setConflict(null);
    setRecoveryMessage("");
    setError("");
    leaveGuard.markSaved();
    toast.success("商品资料已更新");
    try {
      await queryClient.invalidateQueries({
        queryKey: inventoryProductKeys.listsForStore(storeId),
      });
      await queryClient.invalidateQueries({
        queryKey: inventoryCatalogKeys.catalogsForStore(storeId),
      });
      const latest = await query.refetch();
      if (!latest.isSuccess || !latest.data) throw new Error("无法读取最新商品资料");
      await Promise.resolve(router.push(`/inventory/${result.id}`));
      setSyncStatus("recovered");
    } catch {
      setSyncStatus("committed-refresh-failed");
    }
  };

  const recoverConflict = async () => {
    if (isRecoveringConflict) return;
    setIsRecoveringConflict(true);
    const shouldRotateIdempotency = conflict?.kind === "idempotency";
    try {
      const result = await query.refetch();
      if (!result.isSuccess || !result.data) {
        throw new Error("无法读取最新商品资料");
      }
      const latest = toDraft(result.data);
      setDraft((current) =>
        mergeEditDraft(baseDraft ?? current ?? latest, current ?? latest, latest),
      );
      setBaseDraft(latest);
      setVersion(result.data.version);
      if (shouldRotateIdempotency) commandRef.current = undefined;
      setConflict(null);
      setRecoveryMessage("已读取最新资料：你的改动已保留，但尚未自动保存。请检查后再次保存。");
    } finally {
      setIsRecoveringConflict(false);
    }
  };

  return (
    <InventoryProductPageFrame
      mode="edit"
      title={`编辑 ${draft.brand} ${draft.model}`.trim()}
      subtitle="保存时会检查是否有其他设备已修改"
      mobileSubtitle="保存时会检查是否有其他设备已修改"
      mutationPending={mutation.isPending}
      syncBlocked={syncBlocked}
      syncStatus={syncStatus}
      onRetrySync={retryCommittedSync}
      onOpenCommitted={
        syncStatus === "committed-refresh-failed" && syncTargetId
          ? () => router.push(`/inventory/${syncTargetId}`)
          : undefined
      }
      conflict={
        conflict ? (
          <InventoryConflictPanel
            conflict={conflict}
            onRecover={recoverConflict}
            pending={isRecoveringConflict}
            preserveDraft
          />
        ) : null
      }
      recoveryMessage={recoveryMessage}
      error={error}
      onBack={closeEdit}
      leaveGuard={leaveGuard}
      primaryLabel="保存修改"
      onSubmit={(event) => {
        event.preventDefault();
        void save();
      }}
      secondaryLabel="取消"
      onSecondary={closeEdit}
    >
      <InventoryProductFormWorkspace
        draft={toFormDraft(draft)}
        idPrefix="product"
        learnedCatalogOptions={catalogQuery.data?.items}
        catalogNotice={
          catalogQuery.isError ? (
            <p className="text-[11px] leading-4 text-muted-foreground">
              店铺目录暂时不可用，仍可使用常用选项或手动填写。
            </p>
          ) : null
        }
        brandInvalid={Boolean(fieldErrors.brand)}
        modelInvalid={Boolean(fieldErrors.model)}
        inspectionBatteryInvalid={Boolean(fieldErrors.inspection_battery_health)}
        conditionInvalid={Boolean(fieldErrors.condition)}
        gtinInvalid={Boolean(fieldErrors.gtin)}
        listPriceInvalid={Boolean(fieldErrors.list_price)}
        costInvalid={Boolean(fieldErrors.cost_amount)}
        warrantyInvalid={Boolean(fieldErrors.warranty_months)}
        canEnterCost={canEnterCost}
        inspectionEnabled={inspectionEnabled}
        identifierDescription="修改或清空后保存；历史值会停用，不会物理删除。"
        showScanner
        identifierField={InventoryProductIdentifierField}
        allowPrimarySelection
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
        onInspectionBatteryHealthChange={(inspection_battery_health) =>
          setDraft((current) =>
            current ? { ...current, inspection_battery_health, inspection_touched: true } : current,
          )
        }
        onInspectionFaceIdStatusChange={(inspection_face_id_status) =>
          setDraft((current) =>
            current ? { ...current, inspection_face_id_status, inspection_touched: true } : current,
          )
        }
        onIdentifierChange={(kind, value) =>
          setDraft((current) =>
            current
              ? { ...current, identifiers: { ...current.identifiers, [kind]: value } }
              : current,
          )
        }
        onIdentifierSource={(kind, source) =>
          setDraft((current) =>
            current ? { ...current, sources: { ...current.sources, [kind]: source } } : current,
          )
        }
        onPrimaryIdentifierChange={(kind) =>
          setDraft((current) => (current ? { ...current, primary_identifier_kind: kind } : current))
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
    </InventoryProductPageFrame>
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
    <div className={cn(repairOs.mobileFloatingPage, "grid min-h-[55dvh] place-items-center p-4")}>
      <section className={cn(repairOs.mobileInfoCard, "max-w-sm p-6 text-center")}>
        <h1 className="font-semibold">{title}</h1>
        <p className="mt-2 text-sm text-muted-foreground">{body}</p>
        {action ? <div className="mt-4">{action}</div> : null}
      </section>
    </div>
  );
}
