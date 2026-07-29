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
} from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { useStoreShellContext } from "@/features/stores/api/use-store-shell-context";
import { createInventoryProduct } from "@/lib/repairdesk/api";
import type { CreateInventoryProductInput, InventoryProductCategory } from "@/lib/repairdesk/types";
import { repairOs } from "@/lib/ui-patterns";
import { cn } from "@/lib/utils";

import { inventoryProductKeys } from "../api/query-keys";

type Draft = {
  category: InventoryProductCategory;
  brand: string;
  model: string;
  color: string;
  storage_capacity: string;
  identifier_kind: "imei1" | "serial";
  serial_or_imei: string;
  list_price: string;
  cost_amount: string;
  location: string;
  warranty_months: string;
  notes: string;
};

type ValidationError = { message: string; fieldId?: string };

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
    storage_capacity: "",
    identifier_kind: category === "phone" ? "imei1" : "serial",
    serial_or_imei: "",
    list_price: "",
    cost_amount: "",
    location: "",
    warranty_months: "",
    notes: "",
  };
}

export function InventoryProductIntakeScreen() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const shell = useStoreShellContext({ monitorAuthority: true });
  const [draft, setDraft] = useState<Draft>(() => initialDraft());
  const [moreOpen, setMoreOpen] = useState(false);
  const [error, setError] = useState<ValidationError>();
  const [idempotencyKey, setIdempotencyKey] = useState(() => crypto.randomUUID());
  const authorityRef = useRef<string | undefined>(undefined);
  const canEnterCost = shell.permissions?.canAllocateInventoryCosts === true;

  const mutation = useMutation({
    mutationFn: (input: CreateInventoryProductInput) => createInventoryProduct(input),
  });

  useEffect(() => {
    if (shell.isLoading) return;
    if (!authorityRef.current) {
      authorityRef.current = shell.authorityFingerprint;
      return;
    }
    if (authorityRef.current === shell.authorityFingerprint) return;
    authorityRef.current = shell.authorityFingerprint;
    setDraft(initialDraft());
    setIdempotencyKey(crypto.randomUUID());
    setMoreOpen(false);
    mutation.reset();
    setError({ message: "门店或权限已变化，旧草稿已清除，请重新录入。" });
  }, [mutation, shell.authorityFingerprint, shell.isLoading]);

  if (
    !shell.isLoading &&
    (!shell.activeStore ||
      !shell.permissions?.canCreateInventory ||
      !shell.permissions.inventoryProductsUiEnabled ||
      !shell.permissions.inventoryProductQuickCreateEnabled)
  ) {
    return (
      <IntakeMessage
        title="无法录入商品"
        body={
          shell.permissions?.canCreateInventory
            ? "当前门店尚未启用商品快速录入。"
            : "当前账号没有商品录入权限。"
        }
        onBack={() => router.push("/inventory")}
      />
    );
  }

  const save = async (continueEntry: boolean) => {
    setError(undefined);
    const validation = validateDraft(draft, canEnterCost);
    if (validation) {
      setError(validation);
      const fieldId = validation.fieldId ?? "product-category-phone";
      if (
        ["product-price", "product-cost", "product-warranty", "product-identifier"].includes(
          fieldId,
        )
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

    try {
      const result = await mutation.mutateAsync(toInput(draft, idempotencyKey, canEnterCost));
      await queryClient.invalidateQueries({ queryKey: inventoryProductKeys.all });
      toast.success(`商品 ${result.sku} 已录入`);
      if (continueEntry) {
        const retainedCategory = draft.category;
        setDraft(initialDraft(retainedCategory));
        setIdempotencyKey(crypto.randomUUID());
        setMoreOpen(false);
        setError(undefined);
        document.getElementById("product-brand")?.focus();
      } else {
        router.push(`/inventory/${result.id}`);
      }
    } catch (cause) {
      setError({ message: cause instanceof Error ? cause.message : "商品保存失败，请重试" });
    }
  };

  const selectCategory = (category: InventoryProductCategory) => {
    setDraft((current) => ({
      ...current,
      category,
      identifier_kind: category === "phone" ? "imei1" : "serial",
      serial_or_imei: current.category === category ? current.serial_or_imei : "",
    }));
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
    selectCategory(next);
    document.getElementById(`product-category-${next}`)?.focus();
  };

  return (
    <main
      className={cn(
        repairOs.mobileFloatingPage,
        "mx-auto w-full max-w-3xl pb-28 pt-[5.25rem] md:pb-8 md:pt-0",
      )}
    >
      <div className={cn(repairOs.mobileFloatingHeaderShell, "md:static md:mb-4")}>
        <section className={repairOs.mobileFloatingHeaderCard}>
          <header className={repairOs.mobileFloatingHeaderNav}>
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className="size-11 rounded-xl"
              aria-label="返回商品库存"
              onClick={() => router.push("/inventory")}
            >
              <ArrowLeft className="size-5" />
            </Button>
            <div className="min-w-0 text-center">
              <h1 className="text-sm font-semibold">快速录入商品</h1>
              <p className="text-[10px] text-muted-foreground">三个字段即可保存</p>
            </div>
            <span className="size-11" aria-hidden />
          </header>
        </section>
      </div>

      <form
        className="space-y-3"
        onSubmit={(event) => {
          event.preventDefault();
          void save(false);
        }}
      >
        <section className={cn(repairOs.mobileInfoCard, "space-y-4 p-4 md:p-5")}>
          <fieldset>
            <legend className="mb-2 text-sm font-semibold">
              类别 <span className="text-destructive">*</span>
            </legend>
            <div
              className="grid grid-cols-2 gap-2 sm:grid-cols-5"
              role="radiogroup"
              aria-label="商品类别"
            >
              {categories.map(({ value, label, icon: Icon }, index) => (
                <button
                  id={`product-category-${value}`}
                  key={value}
                  type="button"
                  role="radio"
                  aria-checked={draft.category === value}
                  tabIndex={draft.category === value ? 0 : -1}
                  className={cn(
                    "flex min-h-14 items-center justify-center gap-2 rounded-xl border px-3 text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                    draft.category === value
                      ? "border-primary bg-primary/10 text-primary"
                      : "border-border bg-card",
                  )}
                  onClick={() => selectCategory(value)}
                  onKeyDown={(event) => handleCategoryKeyDown(event, index)}
                >
                  <Icon className="size-4" />
                  {label}
                </button>
              ))}
            </div>
          </fieldset>

          <div className="grid gap-4 sm:grid-cols-2">
            <Field
              id="product-brand"
              label="品牌"
              required
              value={draft.brand}
              placeholder="例如 Apple、Samsung"
              invalid={error?.fieldId === "product-brand"}
              onChange={(brand) => setDraft((current) => ({ ...current, brand }))}
            />
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

        <section className={cn(repairOs.mobileInfoCard, "overflow-hidden p-0")}>
          <button
            type="button"
            className="flex min-h-14 w-full items-center justify-between px-4 text-left text-sm font-semibold focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring"
            aria-expanded={moreOpen}
            onClick={() => setMoreOpen((open) => !open)}
          >
            <span>
              <span className="block">更多信息</span>
              <span className="text-xs font-normal text-muted-foreground">
                标识、规格、售价、库位等均可稍后补充
              </span>
            </span>
            <ChevronDown className={cn("size-4 transition-transform", moreOpen && "rotate-180")} />
          </button>
          {moreOpen ? (
            <div className="grid gap-4 border-t border-border p-4 sm:grid-cols-2">
              <Field
                id="product-storage"
                label={draft.category === "computer" ? "存储 / 配置" : "容量 / 版本"}
                value={draft.storage_capacity}
                placeholder={draft.category === "computer" ? "例如 16 GB / 512 GB" : "例如 128 GB"}
                onChange={(storage_capacity) =>
                  setDraft((current) => ({ ...current, storage_capacity }))
                }
              />
              <Field
                id="product-color"
                label="颜色 / 成色"
                value={draft.color}
                placeholder="例如 蓝色、良好"
                onChange={(color) => setDraft((current) => ({ ...current, color }))}
              />
              <div className="space-y-1.5">
                <Label htmlFor="product-identifier-kind">标识类型</Label>
                <Select
                  value={draft.identifier_kind}
                  onValueChange={(identifier_kind: "imei1" | "serial") =>
                    setDraft((current) => ({ ...current, identifier_kind }))
                  }
                >
                  <SelectTrigger id="product-identifier-kind" className="h-11">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="imei1">IMEI</SelectItem>
                    <SelectItem value="serial">序列号 / 条码</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <Field
                id="product-identifier"
                label={draft.identifier_kind === "imei1" ? "IMEI（可选）" : "序列号 / 条码（可选）"}
                value={draft.serial_or_imei}
                placeholder="不填写也可保存"
                invalid={error?.fieldId === "product-identifier"}
                onChange={(serial_or_imei) =>
                  setDraft((current) => ({ ...current, serial_or_imei }))
                }
              />
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
              <div className="space-y-1.5 sm:col-span-2">
                <Label htmlFor="product-notes">内部备注</Label>
                <Textarea
                  id="product-notes"
                  value={draft.notes}
                  maxLength={2000}
                  className="min-h-24 resize-y"
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

        <div className="grid gap-2 sm:grid-cols-2">
          <Button
            type="button"
            variant="outline"
            className="min-h-11"
            disabled={mutation.isPending}
            onClick={() => void save(true)}
          >
            {mutation.isPending ? <Loader2 className="mr-2 size-4 animate-spin" /> : null}
            保存并继续录入
          </Button>
          <Button type="submit" className="min-h-11" disabled={mutation.isPending}>
            {mutation.isPending ? <Loader2 className="mr-2 size-4 animate-spin" /> : null}
            保存并查看商品
          </Button>
        </div>
      </form>
    </main>
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
}: {
  id: string;
  label: string;
  value: string;
  onChange: (value: string) => void;
  required?: boolean;
  placeholder?: string;
  inputMode?: React.HTMLAttributes<HTMLInputElement>["inputMode"];
  invalid?: boolean;
}) {
  return (
    <div className="space-y-1.5">
      <Label htmlFor={id}>
        {label}
        {required ? <span className="text-destructive"> *</span> : null}
      </Label>
      <Input
        id={id}
        value={value}
        required={required}
        maxLength={160}
        inputMode={inputMode}
        placeholder={placeholder}
        aria-invalid={invalid || undefined}
        aria-describedby={invalid ? "product-form-error" : undefined}
        className="h-11 text-base"
        onChange={(event) => onChange(event.target.value)}
      />
    </div>
  );
}

function toInput(
  draft: Draft,
  idempotency_key: string,
  canEnterCost: boolean,
): CreateInventoryProductInput {
  const identifier = draft.serial_or_imei.trim();
  return {
    idempotency_key,
    category: draft.category,
    brand: draft.brand.trim(),
    model: draft.model.trim(),
    color: optional(draft.color),
    storage_capacity: optional(draft.storage_capacity),
    ...(identifier ? { identifier_kind: draft.identifier_kind, serial_or_imei: identifier } : {}),
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
  if (draft.serial_or_imei.trim().length > 0 && draft.serial_or_imei.trim().length < 3)
    return { message: "IMEI 或序列号至少 3 个字符", fieldId: "product-identifier" };
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
function IntakeMessage({
  title,
  body,
  onBack,
}: {
  title: string;
  body: string;
  onBack: () => void;
}) {
  return (
    <main className={cn(repairOs.mobileFloatingPage, "grid min-h-[55dvh] place-items-center p-4")}>
      <section className={cn(repairOs.mobileInfoCard, "max-w-sm p-6 text-center")}>
        <h1 className="font-semibold">{title}</h1>
        <p className="mt-2 text-sm text-muted-foreground">{body}</p>
        <Button type="button" variant="outline" className="mt-4" onClick={onBack}>
          返回商品库存
        </Button>
      </section>
    </main>
  );
}
