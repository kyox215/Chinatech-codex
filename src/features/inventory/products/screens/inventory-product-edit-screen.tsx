"use client";

import { useEffect, useId, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ArrowLeft, Loader2, RefreshCw } from "lucide-react";
import { toast } from "sonner";

import { ImeiScannerField } from "@/components/imei-scanner-field";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
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
import { isValidGtin, validateProductIdentifiers } from "../model/device-data";

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
  specifications: Record<string, string>;
  list_price: string;
  cost_amount: string;
  location: string;
  warranty_months: string;
  notes: string;
};

type EditFieldErrorKey =
  | "brand"
  | "model"
  | "gtin"
  | "list_price"
  | "cost_amount"
  | "warranty_months";

const identifierOrder = ["imei1", "imei2", "serial", "eid"] as const;
const identifierNames = { imei1: "IMEI 1", imei2: "IMEI 2", serial: "序列号", eid: "EID" };

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
  const mutation = useMutation({
    mutationFn: (input: UpdateInventoryProductInput) => updateInventoryProduct(id, input),
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
    const rejectField = (field: EditFieldErrorKey, message: string) => {
      setError(message);
      setFieldErrors({ [field]: message });
      document.getElementById(`edit-${field.replace("_", "-")}`)?.focus();
    };
    if (!draft.brand.trim()) {
      rejectField("brand", "请填写品牌");
      return;
    }
    if (!draft.model.trim()) {
      rejectField("model", "请填写型号或商品名称");
      return;
    }
    for (const [field, label, value] of [
      ["list_price", "计划售价", draft.list_price],
      ...(canEnterCost ? [["cost_amount", "入库成本", draft.cost_amount]] : []),
    ]) {
      if (value.trim() && optionalMoney(value) === undefined) {
        rejectField(field as EditFieldErrorKey, `${label}格式无效，最多两位小数`);
        return;
      }
    }
    if (
      draft.warranty_months.trim() &&
      (!/^\d+$/.test(draft.warranty_months) || Number(draft.warranty_months) > 120)
    ) {
      rejectField("warranty_months", "保修月数必须是 0 到 120 的整数");
      return;
    }
    const identifiers = identifierOrder
      .filter((kind) => draft.identifiers[kind].trim())
      .map((kind, index) => ({
        kind,
        value: draft.identifiers[kind].trim(),
        source: draft.sources[kind],
        primary: index === 0,
      }));
    const identifierError = validateProductIdentifiers(identifiers);
    if (identifierError) return setError(identifierError);
    if (draft.gtin.trim() && !isValidGtin(draft.gtin)) {
      rejectField("gtin", "EAN / GTIN 校验位不正确");
      return;
    }
    try {
      const command = {
        expected_version: version,
        category: draft.category,
        brand: draft.brand.trim(),
        model: draft.model.trim(),
        ram_capacity: optional(draft.ram_capacity),
        storage_capacity: optional(draft.storage_capacity),
        color: optional(draft.color),
        gtin: optional(draft.gtin),
        condition: optional(draft.condition),
        specifications: cleanedRecord(draft.specifications),
        identifiers,
        list_price: optionalMoney(draft.list_price),
        ...(canEnterCost ? { cost_amount: optionalMoney(draft.cost_amount) } : {}),
        location: optional(draft.location),
        warranty_months: draft.warranty_months.trim() ? Number(draft.warranty_months) : undefined,
        notes: optional(draft.notes),
      };
      const fingerprint = JSON.stringify(command);
      const idempotencyKey =
        commandRef.current?.fingerprint === fingerprint
          ? commandRef.current.idempotencyKey
          : crypto.randomUUID();
      commandRef.current = { fingerprint, idempotencyKey };
      const result = await mutation.mutateAsync({
        idempotency_key: idempotencyKey,
        ...command,
      });
      await queryClient.invalidateQueries({ queryKey: inventoryProductKeys.all });
      toast.success("商品资料已更新");
      router.push(`/inventory/${result.id}`);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "商品更新失败，请重试");
    }
  };

  const specFields = categorySpecificationFields(draft.category);

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
              onClick={() => router.push(`/inventory/${id}`)}
            >
              <ArrowLeft className="size-5" />
            </Button>
            <div className="min-w-0 text-center">
              <h1 className="truncate text-sm font-semibold">
                编辑 {draft.brand} {draft.model}
              </h1>
              <p className="text-[10px] text-muted-foreground">保存时会检查是否有其他设备已修改</p>
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
        <Button type="button" variant="outline" onClick={() => router.push(`/inventory/${id}`)}>
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
        <section
          className={cn(repairOs.mobileInfoCard, "grid min-w-0 grid-cols-2 gap-2 p-2.5 md:p-4")}
        >
          <EditField
            id="edit-brand"
            label="品牌"
            required
            value={draft.brand}
            error={fieldErrors.brand}
            onChange={(brand) => {
              setFieldErrors((current) => ({ ...current, brand: undefined }));
              setDraft({ ...draft, brand });
            }}
          />
          <EditField
            id="edit-model"
            label="型号 / 商品名称"
            required
            value={draft.model}
            error={fieldErrors.model}
            onChange={(model) => {
              setFieldErrors((current) => ({ ...current, model: undefined }));
              setDraft({ ...draft, model });
            }}
          />
          <EditField
            label="内存（RAM）"
            value={draft.ram_capacity}
            onChange={(ram_capacity) => setDraft({ ...draft, ram_capacity })}
          />
          <EditField
            label="硬盘 / 存储容量"
            value={draft.storage_capacity}
            onChange={(storage_capacity) => setDraft({ ...draft, storage_capacity })}
          />
          <EditField
            label="设备颜色"
            value={draft.color}
            onChange={(color) => setDraft({ ...draft, color })}
          />
          <EditField
            label="成色"
            value={draft.condition}
            onChange={(condition) => setDraft({ ...draft, condition })}
          />
          <EditField
            id="edit-gtin"
            label="EAN / GTIN（同款条码）"
            value={draft.gtin}
            inputMode="numeric"
            error={fieldErrors.gtin}
            onChange={(gtin) => {
              setFieldErrors((current) => ({ ...current, gtin: undefined }));
              setDraft({ ...draft, gtin });
            }}
          />
          {specFields.map((field) => (
            <EditField
              key={field.key}
              label={field.label}
              value={draft.specifications[field.key] ?? ""}
              onChange={(value) =>
                setDraft({
                  ...draft,
                  specifications: { ...draft.specifications, [field.key]: value },
                })
              }
            />
          ))}
        </section>

        <section className={cn(repairOs.mobileInfoCard, "space-y-2 p-2.5 md:p-4")}>
          <div>
            <h2 className="text-sm font-semibold">设备标识</h2>
            <p className="mt-0.5 text-[10px] leading-4 text-muted-foreground">
              修改或清空后保存；历史值会停用，不会物理删除。
            </p>
          </div>
          <div className="grid min-w-0 gap-2 sm:grid-cols-2">
            {identifierOrder.map((kind) => (
              <div key={kind} className="min-w-0 space-y-1.5 sm:col-span-2">
                <Label htmlFor={`edit-${kind}`}>{identifierNames[kind]}</Label>
                <ImeiScannerField
                  inputId={`edit-${kind}`}
                  inputAriaLabel={identifierNames[kind]}
                  identifierLabel={identifierNames[kind]}
                  inputMode={kind === "serial" ? "text" : "numeric"}
                  value={draft.identifiers[kind]}
                  onChange={(value) =>
                    setDraft({ ...draft, identifiers: { ...draft.identifiers, [kind]: value } })
                  }
                  onCommitSource={(source) =>
                    setDraft((current) =>
                      current
                        ? { ...current, sources: { ...current.sources, [kind]: source } }
                        : current,
                    )
                  }
                  density="compact"
                />
              </div>
            ))}
          </div>
        </section>

        <section
          className={cn(repairOs.mobileInfoCard, "grid min-w-0 grid-cols-2 gap-2 p-2.5 md:p-4")}
        >
          <EditField
            id="edit-list-price"
            label="计划售价"
            value={draft.list_price}
            inputMode="decimal"
            error={fieldErrors.list_price}
            onChange={(list_price) => {
              setFieldErrors((current) => ({ ...current, list_price: undefined }));
              setDraft({ ...draft, list_price });
            }}
          />
          {canEnterCost ? (
            <EditField
              id="edit-cost-amount"
              label="入库成本"
              value={draft.cost_amount}
              inputMode="decimal"
              error={fieldErrors.cost_amount}
              onChange={(cost_amount) => {
                setFieldErrors((current) => ({ ...current, cost_amount: undefined }));
                setDraft({ ...draft, cost_amount });
              }}
            />
          ) : null}
          <EditField
            label="库位"
            value={draft.location}
            onChange={(location) => setDraft({ ...draft, location })}
          />
          <EditField
            id="edit-warranty-months"
            label="保修（月）"
            value={draft.warranty_months}
            inputMode="numeric"
            error={fieldErrors.warranty_months}
            onChange={(warranty_months) => {
              setFieldErrors((current) => ({ ...current, warranty_months: undefined }));
              setDraft({ ...draft, warranty_months });
            }}
          />
          <div className="col-span-2 space-y-1">
            <Label htmlFor="edit-notes" className="text-xs">
              内部备注
            </Label>
            <Textarea
              id="edit-notes"
              className="min-h-20 resize-y text-base lg:text-sm"
              value={draft.notes}
              onChange={(event) => setDraft({ ...draft, notes: event.target.value })}
            />
          </div>
        </section>

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
          <Button
            type="button"
            variant="outline"
            className="min-h-9"
            onClick={() => router.push(`/inventory/${id}`)}
          >
            取消
          </Button>
          <Button type="submit" className="min-h-10" disabled={mutation.isPending}>
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
    specifications: data.specifications ?? {},
    list_price: data.list_price?.toString() ?? "",
    cost_amount: data.cost_amount?.toString() ?? "",
    location: data.location ?? "",
    warranty_months: data.warranty_months?.toString() ?? "",
    notes: data.notes ?? "",
  };
}

function EditField({
  id,
  label,
  value,
  onChange,
  inputMode,
  error,
  required,
}: {
  id?: string;
  label: string;
  value: string;
  onChange: (value: string) => void;
  inputMode?: React.HTMLAttributes<HTMLInputElement>["inputMode"];
  error?: string;
  required?: boolean;
}) {
  const generatedId = useId();
  const inputId = id ?? generatedId;
  const errorId = `${inputId}-error`;
  return (
    <div className="min-w-0 space-y-1">
      <Label htmlFor={inputId} className="text-xs">
        {label}
        {required ? <span className="text-destructive"> *</span> : null}
      </Label>
      <Input
        id={inputId}
        className="h-[38px] min-w-0 text-base lg:h-9 lg:text-sm"
        value={value}
        required={required}
        inputMode={inputMode}
        aria-invalid={Boolean(error)}
        aria-describedby={error ? errorId : undefined}
        onChange={(event) => onChange(event.target.value)}
      />
      {error ? (
        <p id={errorId} className="text-xs text-destructive">
          {error}
        </p>
      ) : null}
    </div>
  );
}

function categorySpecificationFields(category: InventoryProductCategory) {
  if (category === "computer")
    return [
      { key: "processor", label: "处理器" },
      { key: "disk_type", label: "硬盘类型" },
      { key: "graphics", label: "显卡" },
    ];
  if (category === "game_console")
    return [
      { key: "edition", label: "版本" },
      { key: "region", label: "区域" },
      { key: "included_controller_count", label: "手柄数" },
    ];
  if (category === "phone") return [{ key: "network_variant", label: "网络版本" }];
  if (category === "tablet")
    return [
      { key: "connectivity", label: "联网版本" },
      { key: "screen_size_inches", label: "屏幕尺寸" },
    ];
  return [{ key: "short_specification", label: "简短规格" }];
}
function optional(value: string) {
  return value.trim() || undefined;
}
function optionalMoney(value: string) {
  const text = value.trim().replace(",", ".");
  return text && /^\d+(?:\.\d{1,2})?$/.test(text) ? Number(text) : undefined;
}
function cleanedRecord(value: Record<string, string>) {
  return Object.fromEntries(
    Object.entries(value)
      .map(([key, item]) => [key, item.trim()])
      .filter(([, item]) => item),
  );
}

function mergeEditDraft(base: EditDraft, local: EditDraft, latest: EditDraft): EditDraft {
  const merged = { ...latest } as EditDraft;
  for (const key of Object.keys(local) as Array<keyof EditDraft>) {
    if (["identifiers", "sources", "specifications"].includes(key)) continue;
    const localValue = local[key];
    const baseValue = base[key];
    if (JSON.stringify(localValue) !== JSON.stringify(baseValue)) {
      Object.assign(merged, { [key]: localValue });
    }
  }
  merged.identifiers = mergeRecord(base.identifiers, local.identifiers, latest.identifiers);
  merged.sources = mergeRecord(base.sources, local.sources, latest.sources);
  merged.specifications = mergeRecord(
    base.specifications,
    local.specifications,
    latest.specifications,
  );
  return merged;
}

function mergeRecord<T extends Record<string, string>>(base: T, local: T, latest: T): T {
  const merged = { ...latest } as T;
  for (const key of new Set([
    ...Object.keys(base),
    ...Object.keys(local),
    ...Object.keys(latest),
  ])) {
    if (local[key] !== base[key]) merged[key as keyof T] = local[key] as T[keyof T];
  }
  return merged;
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
