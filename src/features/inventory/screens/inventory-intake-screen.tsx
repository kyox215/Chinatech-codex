"use client";

import Link from "next/link";
import { useDeferredValue, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  ArrowLeft,
  ArrowRight,
  Building2,
  Check,
  CheckCircle2,
  CircleAlert,
  Loader2,
  PackageCheck,
  Plus,
  RotateCcw,
  ScanLine,
  ShieldCheck,
  Smartphone,
  Sparkles,
  Trash2,
  UserRound,
} from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { ImeiScannerField } from "@/components/imei-scanner-field";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { SidebarTrigger } from "@/components/ui/sidebar";
import { Textarea } from "@/components/ui/textarea";
import { useAiAssistantWorkspace } from "@/features/ai-assistant";
import { inventoryKeys } from "@/features/inventory/api/query-keys";
import {
  InventoryV2VisionDraftCard,
  type InventoryV2VisionDraft,
} from "@/features/inventory/components/inventory-v2-vision-draft";
import { resolveInventoryIntakeRoute } from "@/features/inventory/model/inventory-intake-route";
import { createInventoryUnitV2InputSchema } from "@/features/inventory/model/inventory-v2-intake-contract";
import {
  mergeVisionIdentifiersWithoutOverwrite,
  preferExistingInventoryValue,
} from "@/features/inventory/model/inventory-v2-vision-merge";
import { useStoreShellContext } from "@/features/stores/api/use-store-shell-context";
import { StoreShellUnavailableState } from "@/features/stores/components/store-shell-unavailable-state";
import { createInventoryUnitV2, listSuppliers, searchCustomers } from "@/lib/repairdesk/api";
import type {
  CreateInventoryUnitV2Input,
  InventoryV2IdentifierInput,
  InventoryV2IdentifierKind,
  InventoryV2IntakeSource,
} from "@/lib/repairdesk/types";
import { brandGradientStyle, controls, repairOs } from "@/lib/ui-patterns";
import { cn } from "@/lib/utils";

const steps = ["来源", "识别", "型号", "关联方", "价格质保", "复核"] as const;
const sourceOptions: Array<{
  value: InventoryV2IntakeSource;
  title: string;
  description: string;
}> = [
  {
    value: "supplier_purchase",
    title: "供应商采购",
    description: "从供应商采购的新机、配件或商品",
  },
  { value: "repair_resale", title: "维修转售", description: "客户设备完成维修、翻新后转为库存" },
  { value: "manual_stock", title: "其他入库", description: "盘点发现、历史库存或其他可解释来源" },
];
const identifierKinds: Array<{ value: InventoryV2IdentifierKind; label: string }> = [
  { value: "imei1", label: "IMEI 1" },
  { value: "imei2", label: "IMEI 2" },
  { value: "serial", label: "序列号" },
  { value: "eid", label: "EID" },
  { value: "ean", label: "EAN" },
  { value: "sku", label: "SKU" },
];
const inputClass = "h-11 min-w-0 text-base sm:h-10 sm:text-sm";
const selectClass =
  "h-11 min-w-0 rounded-md border border-[var(--border-panel)] bg-background px-3 text-base text-foreground sm:h-10 sm:text-sm";

type Draft = Omit<CreateInventoryUnitV2Input, "cost_amount" | "list_price" | "warranty_months"> & {
  cost_amount: string;
  list_price: string;
  warranty_months: string;
};

function newDraft(): Draft {
  return {
    idempotency_key: crypto.randomUUID(),
    source_type: "supplier_purchase",
    category: "手机",
    brand: "",
    model: "",
    identifiers: [{ kind: "imei1", value: "", source: "manual", primary: true }],
    cost_amount: "0",
    list_price: "0",
    warranty_months: "12",
    standardization_status: "unstandardized",
    created_at: new Date().toISOString(),
  };
}

export function InventoryIntakeScreen() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const shell = useStoreShellContext();
  const aiAssistant = useAiAssistantWorkspace();
  const [step, setStep] = useState(0);
  const [draft, setDraft] = useState<Draft>(newDraft);
  const [customerSearch, setCustomerSearch] = useState("");
  const deferredCustomerSearch = useDeferredValue(customerSearch.trim());
  const v2Available =
    shell.permissions?.inventoryV2UiEnabled === true &&
    shell.permissions?.inventoryV2CommandsEnabled === true;
  const authorityReady =
    shell.status === "ready" &&
    Boolean(shell.activeStore?.id) &&
    !shell.isLoading &&
    !shell.isRefreshing;
  const intakeRoute = resolveInventoryIntakeRoute({
    requested: true,
    authorityReady,
    inventoryV2Available: v2Available,
  });

  useEffect(() => {
    if (intakeRoute === "legacy") router.replace("/inventory?new=1");
  }, [intakeRoute, router]);

  const suppliersQuery = useQuery({
    queryKey: ["inventory-v2", "suppliers", shell.activeStore?.id],
    queryFn: ({ signal }) => listSuppliers({ signal }),
    enabled: intakeRoute === "v2" && shell.permissions?.canReadSuppliers === true,
  });
  const customersQuery = useQuery({
    queryKey: ["inventory-v2", "customers", shell.activeStore?.id, deferredCustomerSearch],
    queryFn: () => searchCustomers(deferredCustomerSearch, 8),
    enabled: intakeRoute === "v2" && deferredCustomerSearch.length >= 2,
  });

  const input = useMemo<CreateInventoryUnitV2Input>(
    () => ({
      ...draft,
      brand: draft.brand.trim(),
      model: draft.model.trim(),
      identifiers: draft.identifiers.map((identifier) => ({
        ...identifier,
        value: identifier.value.trim(),
      })),
      cost_amount: Number(draft.cost_amount),
      list_price: Number(draft.list_price),
      warranty_months: Number(draft.warranty_months),
      customer_id: draft.customer_id || undefined,
      supplier_id: draft.supplier_id || undefined,
      color: draft.color?.trim() || undefined,
      ram_capacity: draft.ram_capacity?.trim() || undefined,
      storage_capacity: draft.storage_capacity?.trim() || undefined,
      location: draft.location?.trim() || undefined,
      notes: draft.notes?.trim() || undefined,
    }),
    [draft],
  );
  const parsed = useMemo(() => createInventoryUnitV2InputSchema.safeParse(input), [input]);
  const stepValid = getStepValid(step, input, parsed.success);

  const mutation = useMutation({
    mutationFn: () => createInventoryUnitV2(input),
    onSuccess: (result) => {
      queryClient.invalidateQueries({ queryKey: inventoryKeys.all });
      toast.success(
        result.code === "idempotent_replay" ? "已恢复之前完成的入库" : "库存商品已入库",
      );
      router.replace(`/inventory?item=${encodeURIComponent(result.item_id)}`);
    },
    onError: (error) => toast.error(error instanceof Error ? error.message : "入库失败，请重试"),
  });

  if (shell.status !== "ready" || intakeRoute === "wait") {
    if (shell.status === "loading" || shell.isLoading || shell.isRefreshing) {
      return <div className="p-6 text-sm text-muted-foreground">正在读取门店权限…</div>;
    }
    return <StoreShellUnavailableState shell={shell} onRetry={shell.retry} />;
  }
  if (intakeRoute === "legacy") {
    return <div className="p-6 text-sm text-muted-foreground">正在返回兼容入库流程…</div>;
  }
  if (!shell.permissions?.canCreateInventory) {
    return (
      <InventoryAccessDenied
        title="没有入库权限"
        description="请让店主或店长为当前员工开放库存录入权限。"
      />
    );
  }

  function update<K extends keyof Draft>(key: K, value: Draft[K]) {
    setDraft((current) => ({ ...current, [key]: value }));
  }

  function selectSource(sourceType: InventoryV2IntakeSource) {
    setDraft((current) => ({
      ...current,
      source_type: sourceType,
      customer_id: undefined,
      supplier_id: undefined,
    }));
  }

  function applyVision(vision: InventoryV2VisionDraft) {
    setDraft((current) => ({
      ...current,
      brand: preferExistingInventoryValue(current.brand, vision.brand),
      model: preferExistingInventoryValue(current.model, vision.model),
      color: preferExistingInventoryValue(current.color, vision.color),
      ram_capacity: preferExistingInventoryValue(current.ram_capacity, vision.ram_capacity),
      storage_capacity: preferExistingInventoryValue(
        current.storage_capacity,
        vision.storage_capacity,
      ),
      identifiers: mergeVisionIdentifiersWithoutOverwrite(current.identifiers, vision.identifiers),
      standardization_status: "needs_review",
    }));
    toast.success("已合并确认候选；已有手工内容未被覆盖");
  }

  function addIdentifier() {
    setDraft((current) => ({
      ...current,
      identifiers: [
        ...current.identifiers,
        { kind: "serial", value: "", source: "manual", primary: false },
      ],
    }));
  }

  function updateIdentifier(index: number, patch: Partial<InventoryV2IdentifierInput>) {
    setDraft((current) => ({
      ...current,
      identifiers: current.identifiers.map((identifier, itemIndex) =>
        itemIndex === index ? { ...identifier, ...patch } : identifier,
      ),
    }));
  }

  function setPrimaryIdentifier(index: number) {
    setDraft((current) => ({
      ...current,
      identifiers: current.identifiers.map((identifier, itemIndex) => ({
        ...identifier,
        primary: itemIndex === index,
      })),
    }));
  }

  function removeIdentifier(index: number) {
    setDraft((current) => {
      if (current.identifiers.length === 1) return current;
      const next = current.identifiers.filter((_, itemIndex) => itemIndex !== index);
      if (!next.some((identifier) => identifier.primary)) next[0] = { ...next[0], primary: true };
      return { ...current, identifiers: next };
    });
  }

  return (
    <main
      className={cn(
        repairOs.mobileFloatingPage,
        "mx-auto min-h-full w-full max-w-5xl pb-28 md:px-4 md:pb-12 md:pt-4",
      )}
    >
      <div className={cn(repairOs.mobileFloatingHeaderShell, "md:static md:mb-4")}>
        <section
          className={cn(
            repairOs.mobileFloatingHeaderCard,
            "px-2.5 pb-2 md:rounded-2xl md:px-4 md:py-3",
          )}
        >
          <header className={repairOs.mobileFloatingHeaderNav}>
            <SidebarTrigger className="size-8 rounded-lg border border-[var(--border-panel)] bg-card shadow-none md:hidden" />
            <Button asChild variant="ghost" size="sm" className="hidden h-9 gap-2 md:flex">
              <Link href="/inventory">
                <ArrowLeft className="size-4" /> 返回库存
              </Link>
            </Button>
            <div className="min-w-0 text-center md:text-left">
              <p className="truncate text-sm font-semibold">库存入库</p>
              <p className="truncate text-[10px] text-muted-foreground">一次只完成一个步骤</p>
            </div>
            <Button asChild variant="ghost" size="icon" className="size-8 rounded-lg md:hidden">
              <Link href="/inventory" aria-label="返回库存">
                <ArrowLeft className="size-4" />
              </Link>
            </Button>
            <span className="hidden rounded-full bg-primary/10 px-2.5 py-1 text-xs font-semibold text-primary md:inline-flex">
              {step + 1} / {steps.length}
            </span>
          </header>
          <div className={cn(repairOs.mobileFloatingHeaderBody, "mt-2 pt-2")}>
            <div className="grid grid-cols-6 gap-1" aria-label="入库进度">
              {steps.map((label, index) => (
                <button
                  key={label}
                  type="button"
                  className="min-w-0 text-center"
                  onClick={() => index <= step && setStep(index)}
                  disabled={index > step}
                >
                  <span
                    className={cn(
                      "mx-auto grid size-6 place-items-center rounded-full text-[10px] font-bold",
                      index < step
                        ? "bg-status-success text-status-success-foreground"
                        : index === step
                          ? "bg-primary text-primary-foreground"
                          : "bg-[var(--surface-panel-muted)] text-muted-foreground",
                    )}
                  >
                    {index < step ? <Check className="size-3" /> : index + 1}
                  </span>
                  <span className="mt-1 hidden truncate text-[9px] text-muted-foreground sm:block">
                    {label}
                  </span>
                </button>
              ))}
            </div>
          </div>
        </section>
      </div>

      <section className={cn(repairOs.mobileInfoCard, "mb-4 hidden p-4 md:block")}>
        <div className="flex items-start justify-between gap-4">
          <div>
            <p className="text-xs font-medium text-primary">库存商品 / 新建</p>
            <h1 className="mt-1 text-xl font-semibold">库存入库</h1>
            <p className="mt-1 text-sm text-muted-foreground">
              第 {step + 1} 步：{stepTitle(step)}
            </p>
          </div>
          <Button asChild variant="outline" size="sm">
            <Link href="/inventory">
              <ArrowLeft className="mr-1 size-4" /> 返回库存
            </Link>
          </Button>
        </div>
        <div className="mt-4 grid grid-cols-6 gap-2" aria-label="桌面入库进度">
          {steps.map((label, index) => (
            <div key={label} className="min-w-0">
              <div
                className={cn(
                  "h-1.5 rounded-full",
                  index < step
                    ? "bg-status-success-foreground"
                    : index === step
                      ? "bg-primary"
                      : "bg-[var(--surface-panel-muted)]",
                )}
              />
              <p
                className={cn(
                  "mt-1.5 truncate text-xs",
                  index === step ? "font-semibold text-foreground" : "text-muted-foreground",
                )}
              >
                {index + 1}. {label}
              </p>
            </div>
          ))}
        </div>
      </section>

      <div className="space-y-3 px-2 pt-2 md:px-0 md:pt-0">
        <section className={cn(repairOs.mobileInfoCard, "p-3 sm:p-4")}>
          <div className="mb-4 flex items-start gap-3">
            <span className="grid size-9 shrink-0 place-items-center rounded-xl bg-primary/10 text-primary">
              {stepIcon(step)}
            </span>
            <div>
              <h1 className="text-base font-semibold">{stepTitle(step)}</h1>
              <p className="mt-0.5 text-xs leading-5 text-muted-foreground">
                {stepDescription(step)}
              </p>
            </div>
          </div>

          {step === 0 ? (
            <div className="grid gap-2 sm:grid-cols-3">
              {sourceOptions.map((option) => (
                <button
                  key={option.value}
                  type="button"
                  onClick={() => selectSource(option.value)}
                  className={cn(
                    "min-h-24 rounded-xl border p-3 text-left transition-colors",
                    draft.source_type === option.value
                      ? "border-primary bg-primary/5"
                      : "border-[var(--border-panel)] hover:bg-muted/40",
                  )}
                >
                  <span className="flex items-center justify-between text-sm font-semibold">
                    {option.title}
                    {draft.source_type === option.value ? (
                      <CheckCircle2 className="size-4 text-primary" />
                    ) : null}
                  </span>
                  <span className="mt-1 block text-xs leading-5 text-muted-foreground">
                    {option.description}
                  </span>
                </button>
              ))}
              <Button
                asChild
                variant="outline"
                className="h-auto min-h-20 justify-start whitespace-normal p-3 text-left sm:col-span-3"
              >
                <Link href="/buyback?new=1">
                  <RotateCcw className="mr-2 size-4 shrink-0" />
                  <span>
                    <strong>客户旧机回收</strong>
                    <span className="mt-1 block text-xs font-normal text-muted-foreground">
                      回收必须走检测、估价与客户确认流程
                    </span>
                  </span>
                </Link>
              </Button>
            </div>
          ) : null}

          {step === 1 ? (
            <div className="space-y-3">
              <InventoryV2VisionDraftCard
                enabled={
                  aiAssistant.capabilities?.canUseVisionIntake === true &&
                  aiAssistant.capabilities?.canApplyInventoryDraft === true
                }
                onApply={applyVision}
              />
              <div className="rounded-xl border border-dashed border-[var(--border-panel)] p-3 text-xs leading-5 text-muted-foreground">
                <ScanLine className="mr-1 inline size-4 text-primary" /> 也可以跳过
                AI，在下一步直接扫描或输入 IMEI、序列号、EAN、SKU。
              </div>
            </div>
          ) : null}

          {step === 2 ? (
            <div className="space-y-4">
              <div className="grid gap-3 sm:grid-cols-2">
                <Field label="类别">
                  <Input
                    className={inputClass}
                    value={draft.category}
                    onChange={(event) => update("category", event.target.value)}
                    placeholder="手机、平板、配件"
                  />
                </Field>
                <Field label="品牌 *">
                  <Input
                    className={inputClass}
                    value={draft.brand}
                    onChange={(event) => update("brand", event.target.value)}
                    placeholder="Apple"
                  />
                </Field>
                <Field label="型号 *">
                  <Input
                    className={inputClass}
                    value={draft.model}
                    onChange={(event) => update("model", event.target.value)}
                    placeholder="iPhone 15 Pro"
                  />
                </Field>
                <Field label="颜色">
                  <Input
                    className={inputClass}
                    value={draft.color ?? ""}
                    onChange={(event) => update("color", event.target.value)}
                    placeholder="钛金属"
                  />
                </Field>
                <Field label="内存">
                  <Input
                    className={inputClass}
                    value={draft.ram_capacity ?? ""}
                    onChange={(event) => update("ram_capacity", event.target.value)}
                    placeholder="8 GB"
                  />
                </Field>
                <Field label="容量">
                  <Input
                    className={inputClass}
                    value={draft.storage_capacity ?? ""}
                    onChange={(event) => update("storage_capacity", event.target.value)}
                    placeholder="256 GB"
                  />
                </Field>
              </div>
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <Label>唯一标识 *</Label>
                  <Button type="button" variant="outline" size="sm" onClick={addIdentifier}>
                    <Plus className="mr-1 size-3.5" />
                    添加
                  </Button>
                </div>
                {draft.identifiers.map((identifier, index) => (
                  <div
                    key={index}
                    className="grid gap-2 rounded-xl border border-[var(--border-panel)] p-2 sm:grid-cols-[130px_minmax(0,1fr)_auto_auto] sm:items-center"
                  >
                    <select
                      className={selectClass}
                      value={identifier.kind}
                      onChange={(event) =>
                        updateIdentifier(index, {
                          kind: event.target.value as InventoryV2IdentifierKind,
                        })
                      }
                    >
                      {identifierKinds.map((kind) => (
                        <option key={kind.value} value={kind.value}>
                          {kind.label}
                        </option>
                      ))}
                    </select>
                    <ImeiScannerField
                      value={identifier.value}
                      onChange={(value) => updateIdentifier(index, { value, source: "manual" })}
                      placeholder="扫描或输入"
                      density="compact"
                    />
                    <Button
                      type="button"
                      variant={identifier.primary ? "default" : "outline"}
                      size="sm"
                      onClick={() => setPrimaryIdentifier(index)}
                    >
                      {identifier.primary ? "主要" : "设为主要"}
                    </Button>
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      onClick={() => removeIdentifier(index)}
                      disabled={draft.identifiers.length === 1}
                      aria-label="删除标识"
                    >
                      <Trash2 className="size-4" />
                    </Button>
                  </div>
                ))}
              </div>
            </div>
          ) : null}

          {step === 3 ? (
            <div className="space-y-3">
              {draft.source_type === "supplier_purchase" ? (
                <Field label="供应商 *">
                  <select
                    className={cn(selectClass, "w-full")}
                    value={draft.supplier_id ?? ""}
                    onChange={(event) => update("supplier_id", event.target.value || undefined)}
                  >
                    <option value="">请选择供应商</option>
                    {(suppliersQuery.data ?? [])
                      .filter((supplier) => !supplier.archived_at)
                      .map((supplier) => (
                        <option key={supplier.id} value={supplier.id}>
                          {supplier.name}
                        </option>
                      ))}
                  </select>
                  {suppliersQuery.isError ? (
                    <p className="text-xs text-destructive">供应商加载失败，请返回重试。</p>
                  ) : null}
                </Field>
              ) : null}
              {draft.source_type === "repair_resale" ? (
                <div className="space-y-2">
                  <Field label="搜索客户 *">
                    <Input
                      className={inputClass}
                      value={customerSearch}
                      onChange={(event) => setCustomerSearch(event.target.value)}
                      placeholder="输入姓名或电话（至少 2 个字符）"
                    />
                  </Field>
                  <div className="space-y-2">
                    {(customersQuery.data ?? []).map((customer) => (
                      <button
                        key={customer.id}
                        type="button"
                        onClick={() => update("customer_id", customer.id)}
                        className={cn(
                          "flex min-h-12 w-full items-center gap-3 rounded-xl border px-3 py-2 text-left",
                          draft.customer_id === customer.id
                            ? "border-primary bg-primary/5"
                            : "border-[var(--border-panel)]",
                        )}
                      >
                        <UserRound className="size-4 shrink-0 text-primary" />
                        <span className="min-w-0 flex-1">
                          <span className="block truncate text-sm font-medium">
                            {customer.name}
                          </span>
                          <span className="block truncate text-xs text-muted-foreground">
                            {customer.phone_raw}
                          </span>
                        </span>
                        {draft.customer_id === customer.id ? (
                          <Check className="size-4 text-primary" />
                        ) : null}
                      </button>
                    ))}
                  </div>
                </div>
              ) : null}
              {draft.source_type === "manual_stock" ? (
                <Field label="来源说明 *">
                  <Textarea
                    value={draft.notes ?? ""}
                    onChange={(event) => update("notes", event.target.value)}
                    placeholder="说明为什么手工入库，便于日后审计"
                    className="min-h-28 text-base sm:text-sm"
                  />
                </Field>
              ) : null}
              <div className="rounded-xl bg-[var(--surface-panel-muted)] p-3 text-xs leading-5 text-muted-foreground">
                <ShieldCheck className="mr-1 inline size-4 text-primary" />{" "}
                供应商或客户只能选择当前门店已有记录，系统会在保存时再次校验。
              </div>
            </div>
          ) : null}

          {step === 4 ? (
            <div className="grid gap-3 sm:grid-cols-2">
              <Field label="成本（€） *">
                <Input
                  className={inputClass}
                  inputMode="decimal"
                  value={draft.cost_amount}
                  onChange={(event) => update("cost_amount", event.target.value)}
                />
              </Field>
              <Field label="建议售价（€） *">
                <Input
                  className={inputClass}
                  inputMode="decimal"
                  value={draft.list_price}
                  onChange={(event) => update("list_price", event.target.value)}
                />
              </Field>
              <Field label="质保月数 *">
                <Input
                  className={inputClass}
                  inputMode="numeric"
                  value={draft.warranty_months}
                  onChange={(event) => update("warranty_months", event.target.value)}
                />
              </Field>
              <Field label="库位">
                <Input
                  className={inputClass}
                  value={draft.location ?? ""}
                  onChange={(event) => update("location", event.target.value)}
                  placeholder="展示柜 A1"
                />
              </Field>
              <Field label="备注" className="sm:col-span-2">
                <Textarea
                  value={draft.notes ?? ""}
                  onChange={(event) => update("notes", event.target.value)}
                  placeholder="成色、随附配件或需要复核的事项"
                  className="min-h-24 text-base sm:text-sm"
                />
              </Field>
            </div>
          ) : null}

          {step === 5 ? (
            <div className="space-y-3">
              <ReviewRow
                label="来源"
                value={
                  sourceOptions.find((option) => option.value === draft.source_type)?.title ??
                  draft.source_type
                }
              />
              <ReviewRow
                label="商品"
                value={`${draft.brand} ${draft.model}${draft.storage_capacity ? ` · ${draft.storage_capacity}` : ""}${draft.color ? ` · ${draft.color}` : ""}`}
              />
              <ReviewRow
                label="主要标识"
                value={
                  draft.identifiers.find((identifier) => identifier.primary)?.value || "未填写"
                }
              />
              <ReviewRow
                label="价格"
                value={`成本 €${Number(draft.cost_amount || 0).toFixed(2)} · 售价 €${Number(draft.list_price || 0).toFixed(2)}`}
              />
              <ReviewRow label="质保" value={`${draft.warranty_months || 0} 个月`} />
              {!parsed.success ? (
                <div className="rounded-xl bg-destructive/10 p-3 text-xs leading-5 text-destructive">
                  <CircleAlert className="mr-1 inline size-4" />
                  {parsed.error.issues[0]?.message ?? "请返回补全信息"}
                </div>
              ) : (
                <div className="rounded-xl bg-status-success p-3 text-xs leading-5 text-status-success-foreground">
                  <CheckCircle2 className="mr-1 inline size-4" />
                  资料完整。保存后先进入“待检测/入库”状态，不会自动上架售卖。
                </div>
              )}
              <Button
                type="button"
                className={cn("h-12 w-full gap-2", controls.brandButton)}
                style={brandGradientStyle}
                disabled={!parsed.success || mutation.isPending}
                onClick={() => mutation.mutate()}
              >
                {mutation.isPending ? (
                  <Loader2 className="size-4 animate-spin" />
                ) : (
                  <PackageCheck className="size-4" />
                )}
                {mutation.isPending ? "正在原子入库…" : "确认入库"}
              </Button>
            </div>
          ) : null}
        </section>
      </div>

      <div className="fixed inset-x-0 bottom-0 z-30 border-t border-[var(--border-panel)] bg-background/95 px-3 pb-[calc(env(safe-area-inset-bottom)+10px)] pt-2 backdrop-blur md:static md:mt-4 md:border-0 md:bg-transparent md:px-0 md:pb-0 md:pt-0">
        <div className="mx-auto flex max-w-5xl gap-2">
          <Button
            type="button"
            variant="outline"
            className="h-11 flex-1"
            disabled={step === 0 || mutation.isPending}
            onClick={() => setStep((current) => Math.max(0, current - 1))}
          >
            <ArrowLeft className="mr-1 size-4" />
            上一步
          </Button>
          {step < steps.length - 1 ? (
            <Button
              type="button"
              className="h-11 flex-1"
              disabled={!stepValid}
              onClick={() => setStep((current) => Math.min(steps.length - 1, current + 1))}
            >
              下一步
              <ArrowRight className="ml-1 size-4" />
            </Button>
          ) : null}
        </div>
      </div>
    </main>
  );
}

function Field({
  label,
  children,
  className,
}: {
  label: string;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("min-w-0 space-y-1.5", className)}>
      <Label>{label}</Label>
      {children}
    </div>
  );
}

function ReviewRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex gap-3 rounded-xl border border-[var(--border-panel)] px-3 py-2.5 text-sm">
      <span className="w-20 shrink-0 text-muted-foreground">{label}</span>
      <span className="min-w-0 flex-1 break-words font-medium">{value}</span>
    </div>
  );
}

function InventoryAccessDenied({ title, description }: { title: string; description: string }) {
  return (
    <main className={cn(repairOs.mobileFloatingPage, "grid min-h-[55dvh] place-items-center p-3")}>
      <section className={cn(repairOs.mobileInfoCard, "max-w-md p-5 text-center")}>
        <ShieldCheck className="mx-auto size-8 text-primary" />
        <h1 className="mt-3 font-semibold">{title}</h1>
        <p className="mt-1 text-xs leading-5 text-muted-foreground">{description}</p>
        <Button asChild variant="outline" className="mt-4">
          <Link href="/inventory">返回库存</Link>
        </Button>
      </section>
    </main>
  );
}

function getStepValid(step: number, input: CreateInventoryUnitV2Input, finalValid: boolean) {
  if (step <= 1) return true;
  if (step === 2)
    return Boolean(
      input.category &&
      input.brand &&
      input.model &&
      input.identifiers.length &&
      input.identifiers.every((identifier) => identifier.value),
    );
  if (step === 3)
    return input.source_type === "supplier_purchase"
      ? Boolean(input.supplier_id)
      : input.source_type === "repair_resale"
        ? Boolean(input.customer_id)
        : Boolean(input.notes);
  if (step === 4)
    return (
      Number.isFinite(input.cost_amount) &&
      input.cost_amount >= 0 &&
      Number.isFinite(input.list_price) &&
      input.list_price >= 0 &&
      Number.isInteger(input.warranty_months) &&
      input.warranty_months >= 0
    );
  return finalValid;
}

function stepIcon(step: number) {
  const Icon =
    [Building2, Sparkles, Smartphone, UserRound, ShieldCheck, PackageCheck][step] ?? PackageCheck;
  return <Icon className="size-4" />;
}

function stepTitle(step: number) {
  return [
    "选择商品来源",
    "拍照或扫描",
    "填写型号与唯一标识",
    "关联供应商或客户",
    "填写价格、质保与库位",
    "最后复核并保存",
  ][step];
}

function stepDescription(step: number) {
  return [
    "来源决定后续需要关联的业务记录。",
    "AI 是可选助手，识别候选必须由你确认。",
    "至少填写品牌、型号和一个主要标识。",
    "只允许关联当前门店已有的供应商或客户。",
    "金额不会由 AI 自动填写；商品保存后不会自动上架。",
    "系统会一次性写入商品、标识、入库流水和审计记录。",
  ][step];
}
