"use client";

import type * as React from "react";
import { useMemo, useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import {
  AlertTriangle,
  Box,
  CalendarClock,
  Camera,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  ClipboardCheck,
  FileText,
  History,
  MessageCircle,
  ReceiptText,
  ShieldCheck,
  Smartphone,
  Sparkles,
  TrendingUp,
  UserRound,
} from "lucide-react";
import { toast } from "sonner";

import { MoneyText } from "@/components/orders/badges";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { Textarea } from "@/components/ui/textarea";
import { inventoryKeys } from "@/features/inventory/api/query-keys";
import {
  buildBuybackQuoteCreateInput,
  buildBuybackQuoteDraftInput,
  buildBuybackQualityCheckInput,
  buybackFunctionTestGroups,
  buybackFunctionTestItems,
  buildWhatsappQuoteMessage,
  buybackQuoteSteps,
  calculateBuybackQuote,
  defaultBuybackQuoteDraft,
  normalizeWhatsappPhone,
  validateBuybackIntake,
  type BuybackAttachmentKind,
  type BuybackInspectionStatus,
  type BuybackQuoteDraft,
} from "@/features/buyback/model/buyback-quote";
import {
  createInventoryIntake,
  recordInventoryCheck,
  transitionInventoryItem,
  uploadInventoryAttachment,
} from "@/lib/repairdesk/api";
import { componentOverlay } from "@/lib/component-patterns";
import { brandGradientStyle, controls, repairOs } from "@/lib/ui-patterns";
import { cn } from "@/lib/utils";
import {
  estimateAppleMarketPricing,
  getAppleIPhoneModels,
  getAppleIPhoneSeriesGroups,
  getAppleIPhoneStorageChoices,
  getAppleIPhoneStorageHint,
} from "@/features/buyback/model/apple-price-guide";

interface BuybackQuoteWorkspaceProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

type DraftKey = keyof BuybackQuoteDraft;
type StepKey = (typeof buybackQuoteSteps)[number]["key"];
type AttachmentDraft = Partial<Record<BuybackAttachmentKind, File>>;

const quoteCardClass = cn(repairOs.mobileInfoCard, "space-y-2");

export function BuybackQuoteWorkspace({ open, onOpenChange }: BuybackQuoteWorkspaceProps) {
  const queryClient = useQueryClient();
  const [stepIndex, setStepIndex] = useState(0);
  const [draft, setDraft] = useState<BuybackQuoteDraft>(defaultBuybackQuoteDraft);
  const [attachments, setAttachments] = useState<AttachmentDraft>({});
  const result = useMemo(() => calculateBuybackQuote(draft), [draft]);
  const intakeValidation = useMemo(() => validateBuybackIntake(draft, result), [draft, result]);
  const currentStep = buybackQuoteSteps[stepIndex];
  const estimateGateMessage = getEstimateGateMessage(draft);
  const functionGateMessage = useMemo(() => getFunctionGateMessage(draft, result), [draft, result]);
  const phone = normalizeWhatsappPhone(draft.customer_phone);
  const footerHint = getCurrentFooterHint(
    currentStep.key,
    result,
    intakeValidation,
    estimateGateMessage,
    functionGateMessage,
  );

  function resetWorkspace() {
    setStepIndex(0);
    setDraft(defaultBuybackQuoteDraft);
    setAttachments({});
  }

  const saveMutation = useMutation({
    mutationFn: async () => {
      const validation = validateBuybackIntake(draft, result);
      if (!validation.canSave) {
        throw new Error(
          [...validation.missing, ...validation.hardBlockReasons].slice(0, 3).join("、") ||
            "成交资料未完成",
        );
      }
      const input = buildBuybackQuoteCreateInput(draft, result);
      const { id } = await createInventoryIntake(input);
      await recordInventoryCheck(id, buildBuybackQualityCheckInput(draft));
      await uploadBuybackAttachments(id, attachments);
      await transitionInventoryItem(id, "evaluating", {
        reason: "简易估价后客户同意，已进入检测与资料登记",
      });
      if (!result.hardBlock) {
        await transitionInventoryItem(id, "offer_made", {
          reason: `检测后建议报价 €${result.finalOffer.toFixed(2)}`,
        });
        await transitionInventoryItem(id, "purchased", {
          reason: `客户已签名并提交证件/设备照片，回收成交 €${result.finalOffer.toFixed(2)}`,
        });
      }
      return { id };
    },
    onSuccess: async () => {
      toast.success("回收成交单已保存");
      await queryClient.invalidateQueries({ queryKey: inventoryKeys.all });
      onOpenChange(false);
      resetWorkspace();
    },
    onError: (error) => toast.error(error instanceof Error ? error.message : "保存报价失败"),
  });

  const deferMutation = useMutation({
    mutationFn: async () => {
      const input = buildBuybackQuoteDraftInput(draft, result, "deferred");
      const { id } = await createInventoryIntake(input);
      await transitionInventoryItem(id, "offer_made", {
        reason: `客户考虑中，初步报价 €${result.finalOffer.toFixed(2)}`,
      });
      return { id };
    },
    onSuccess: async () => {
      toast.success("已保存为客户考虑中的回收报价");
      await queryClient.invalidateQueries({ queryKey: inventoryKeys.all });
      onOpenChange(false);
      resetWorkspace();
    },
    onError: (error) => toast.error(error instanceof Error ? error.message : "保存考虑中报价失败"),
  });

  function updateDraft<K extends DraftKey>(key: K, value: BuybackQuoteDraft[K]) {
    setDraft((current) => ({ ...current, [key]: value }));
  }

  function updateAttachment(kind: BuybackAttachmentKind, file?: File) {
    setAttachments((current) => {
      const next = { ...current };
      if (file) next[kind] = file;
      else delete next[kind];
      return next;
    });
    const capturedKey = attachmentCapturedKey(kind);
    if (capturedKey) {
      updateDraft(capturedKey, Boolean(file) as BuybackQuoteDraft[typeof capturedKey]);
    }
  }

  function openWhatsappQuote() {
    if (!phone) {
      toast.error("请先填写可用的客户 WhatsApp 电话");
      return;
    }
    const message = buildWhatsappQuoteMessage(draft, result);
    window.open(`https://wa.me/${phone}?text=${encodeURIComponent(message)}`, "_blank", "noopener");
  }

  function rejectQuoteAndClose() {
    toast.info("客户未接受报价，本次未保存库存记录");
    onOpenChange(false);
    resetWorkspace();
  }

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        side="bottom"
        className={cn(
          componentOverlay.bottomSheet,
          "left-1/2 right-auto h-[calc(100svh-0.5rem)] max-h-[calc(100svh-0.5rem)] w-[min(430px,calc(100vw-0.5rem))] -translate-x-1/2 rounded-t-xl p-0 [&>button.absolute]:hidden",
        )}
      >
        <div className="flex h-full min-h-0 flex-col bg-[var(--surface-workspace)]">
          <SheetHeader className="px-2 pb-1.5 pt-2 text-left">
            <section className={cn(repairOs.mobileFloatingHeaderCard, "px-2.5 pb-2")}>
              <header className={repairOs.mobileFloatingHeaderNav}>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  className="size-8 shrink-0 rounded-lg"
                  onClick={() => onOpenChange(false)}
                  aria-label="关闭回收报价"
                >
                  <ChevronLeft className="size-4" />
                </Button>
                <div className="min-w-0 text-center">
                  <SheetTitle className="truncate text-xs font-semibold leading-4">
                    回收报价
                  </SheetTitle>
                  <p className="truncate text-[9px] leading-3 text-muted-foreground">
                    {currentStep.label} · {stepSubtitle(currentStep.key, result)}
                  </p>
                  <SheetDescription className="sr-only">
                    按设备信息、检测结果和风险规则生成回收报价。
                  </SheetDescription>
                </div>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="h-8 shrink-0 gap-1 rounded-lg px-2 text-[11px]"
                  onClick={() => toast.info("保存成交后，可在库存详情里查看历史记录和附件凭证")}
                >
                  <History className="size-3.5" />
                  历史
                </Button>
              </header>
              <div className={repairOs.mobileFloatingHeaderBody}>
                <div className="flex min-w-0 items-start justify-between gap-2">
                  <div className="min-w-0">
                    <p className="truncate font-mono text-[12px] font-semibold leading-4 text-primary">
                      {[draft.brand, draft.model].filter(Boolean).join(" ") || "待填写设备"}
                    </p>
                    <p className="truncate text-[9px] leading-3 text-muted-foreground">
                      {stepHelper(currentStep.key, result)}
                    </p>
                  </div>
                  <Badge
                    variant={result.hardBlock ? "destructive" : "outline"}
                    className="scale-90 text-[10px]"
                  >
                    {stepBadgeLabel(currentStep.key, result)}
                  </Badge>
                </div>
                <QuoteStepper activeIndex={stepIndex} />
              </div>
            </section>
          </SheetHeader>

          <div className="min-h-0 flex-1 overflow-y-auto px-2 py-1.5">
            <div className="mx-auto w-full max-w-[430px]">
              {currentStep.key === "estimate" ? (
                <QuickEstimateStep draft={draft} result={result} updateDraft={updateDraft} />
              ) : null}
              {currentStep.key === "intent" ? (
                <IntentStep
                  result={result}
                  onDefer={() => deferMutation.mutate()}
                  onReject={rejectQuoteAndClose}
                  isDeferring={deferMutation.isPending}
                />
              ) : null}
              {currentStep.key === "function" ? (
                <FunctionStep draft={draft} result={result} updateDraft={updateDraft} />
              ) : null}
              {currentStep.key === "intake" ? (
                <CustomerIntakeStep
                  draft={draft}
                  result={result}
                  updateDraft={updateDraft}
                  attachments={attachments}
                  updateAttachment={updateAttachment}
                  validation={intakeValidation}
                  onWhatsapp={openWhatsappQuote}
                />
              ) : null}
            </div>
          </div>

          <div className="border-t border-[var(--border-panel)] bg-card/95 px-2 py-1.5 pb-[calc(env(safe-area-inset-bottom)+0.4rem)]">
            <div className="mx-auto flex w-full max-w-[430px] min-w-0 items-center justify-between gap-2">
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="h-9 shrink-0 rounded-lg px-2 text-xs"
                disabled={stepIndex === 0}
                onClick={() => setStepIndex((current) => Math.max(0, current - 1))}
              >
                <ChevronLeft className="size-3.5" />
                上一步
              </Button>
              <div className="line-clamp-2 min-w-0 text-center text-[10px] leading-3 text-muted-foreground">
                {footerHint}
              </div>
              {stepIndex < buybackQuoteSteps.length - 1 ? (
                <Button
                  type="button"
                  size="sm"
                  className={cn("h-9 shrink-0 rounded-lg px-3 text-xs", controls.brandButton)}
                  style={brandGradientStyle}
                  disabled={
                    (currentStep.key === "estimate" && Boolean(estimateGateMessage)) ||
                    (currentStep.key === "function" && Boolean(functionGateMessage))
                  }
                  onClick={() => {
                    if (currentStep.key === "intent") {
                      updateDraft("customer_intent_outcome", "accepted");
                      updateDraft("customer_intent_confirmed", true);
                    }
                    setStepIndex((current) => Math.min(buybackQuoteSteps.length - 1, current + 1));
                  }}
                >
                  {nextButtonLabel(currentStep.key)}
                  <ChevronRight className="size-3.5" />
                </Button>
              ) : (
                <Button
                  type="button"
                  size="sm"
                  className={cn("h-9 shrink-0 rounded-lg px-3 text-xs", controls.brandButton)}
                  style={brandGradientStyle}
                  disabled={
                    saveMutation.isPending || !draft.model.trim() || !intakeValidation.canSave
                  }
                  onClick={() => saveMutation.mutate()}
                >
                  <FileText className="size-3.5" />
                  保存资料
                </Button>
              )}
            </div>
          </div>
        </div>
      </SheetContent>
    </Sheet>
  );
}

function QuoteStepper({ activeIndex }: { activeIndex: number }) {
  return (
    <div className="mt-1.5">
      <div className="grid grid-cols-4 gap-1">
        {buybackQuoteSteps.map((step, index) => {
          const active = index === activeIndex;
          const complete = index < activeIndex;
          return (
            <div key={step.key} className="relative min-w-0 text-center">
              {index > 0 ? (
                <div className="absolute right-1/2 top-2.5 h-px w-full bg-primary/25" />
              ) : null}
              <span
                className={cn(
                  "relative z-10 mx-auto grid size-5 place-items-center rounded-full border text-[10px] font-semibold",
                  active
                    ? "border-primary bg-primary text-primary-foreground shadow-[var(--shadow-action)]"
                    : complete
                      ? "border-primary bg-primary/10 text-primary"
                      : "border-primary/40 bg-card text-primary",
                )}
              >
                {index + 1}
              </span>
              <p
                className={cn(
                  "mt-0.5 truncate text-[9px] leading-3",
                  active ? "font-medium text-primary" : "text-muted-foreground",
                )}
              >
                {step.label}
              </p>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function stepSubtitle(step: StepKey, result: ReturnType<typeof calculateBuybackQuote>) {
  if (step === "estimate") return `先估 €${result.suggestedLow}-${result.suggestedHigh}`;
  if (step === "intent") return "客户同意后再检测";
  if (step === "function") return "检测账号锁与功能";
  return "登记证件与签名";
}

function stepHelper(step: StepKey, result: ReturnType<typeof calculateBuybackQuote>) {
  if (step === "estimate") return "无需客户资料 · 先给口头区间";
  if (step === "intent") return `简易估价 €${result.finalOffer.toFixed(0)} · 等客户确认`;
  if (step === "function") return "客户已同意 · 开始正式检测";
  return "资料齐全后保存回收单";
}

function stepBadgeLabel(step: StepKey, result: ReturnType<typeof calculateBuybackQuote>) {
  if (result.hardBlock) return "风险";
  if (step === "estimate") return "简易";
  if (step === "intent") return "待确认";
  if (step === "function") return "检测中";
  return "待保存";
}

function stepFooterHint(step: StepKey, result: ReturnType<typeof calculateBuybackQuote>) {
  if (result.hardBlock) return "风险待处理";
  if (step === "estimate") return `建议 €${result.suggestedLow}-${result.suggestedHigh}`;
  if (step === "intent") return "客户同意后继续";
  if (step === "function") return `最终 €${result.finalOffer.toFixed(0)}`;
  return "资料齐全可保存";
}

function getCurrentFooterHint(
  step: StepKey,
  result: ReturnType<typeof calculateBuybackQuote>,
  validation: ReturnType<typeof validateBuybackIntake>,
  estimateGateMessage: string,
  functionGateMessage: string,
) {
  if (step === "intake" && !validation.canSave) {
    return [...validation.missing, ...validation.hardBlockReasons][0] ?? "需补齐资料";
  }
  if (step === "estimate" && estimateGateMessage) return estimateGateMessage;
  if (step === "function" && functionGateMessage) return functionGateMessage;
  return stepFooterHint(step, result);
}

function getEstimateGateMessage(draft: BuybackQuoteDraft) {
  if (!draft.model.trim()) return "先选择 iPhone 型号";
  if (!draft.storage_capacity.trim()) return "请选择容量";
  return "";
}

function getFunctionGateMessage(
  draft: BuybackQuoteDraft,
  result: ReturnType<typeof calculateBuybackQuote>,
) {
  if (result.hardBlock) {
    return (
      result.riskNotes.find((note) => /锁|IMEI|抹除|解锁/.test(note)) ?? "存在硬阻断，不能继续成交"
    );
  }
  const missingRequiredItem = buybackFunctionTestItems.find((item) => {
    if (!item.required) return false;
    const status = draft[item.key];
    return status === "unchecked" || status === "not_applicable";
  });
  if (!missingRequiredItem) return "";
  if (draft[missingRequiredItem.key] === "not_applicable") {
    return `${missingRequiredItem.label}不能跳过`;
  }
  return `${missingRequiredItem.label}还未检测`;
}

function nextButtonLabel(step: StepKey) {
  if (step === "estimate") return "查看估价";
  if (step === "intent") return "客户同意，检测";
  if (step === "function") return "登记资料";
  return "下一步";
}

async function uploadBuybackAttachments(id: string, attachments: AttachmentDraft) {
  for (const [kind, file] of Object.entries(attachments) as [BuybackAttachmentKind, File][]) {
    if (!file) continue;
    const dataBase64 = await fileToBase64(file);
    const mimeType = file.type || mimeTypeFromFileName(file.name) || "image/jpeg";
    await uploadInventoryAttachment(id, {
      kind,
      file_name: file.name || `${kind}.jpg`,
      mime_type: mimeType,
      file_size: file.size,
      data_base64: dataBase64,
      note: buybackAttachmentLabel(kind),
    }).catch((error) => {
      throw new Error(
        `${buybackAttachmentLabel(kind)}上传失败：${
          error instanceof Error ? error.message : "未知错误"
        }`,
      );
    });
  }
}

function fileToBase64(file: File) {
  return new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const value = String(reader.result ?? "");
      resolve(value.includes(",") ? (value.split(",").pop() ?? "") : value);
    };
    reader.onerror = () => reject(new Error("读取文件失败"));
    reader.readAsDataURL(file);
  });
}

function mimeTypeFromFileName(fileName: string) {
  const extension = fileName.split(".").pop()?.toLowerCase();
  if (extension === "jpg" || extension === "jpeg") return "image/jpeg";
  if (extension === "png") return "image/png";
  if (extension === "webp") return "image/webp";
  if (extension === "heic") return "image/heic";
  if (extension === "heif") return "image/heif";
  if (extension === "pdf") return "application/pdf";
  return undefined;
}

function attachmentCapturedKey(kind: BuybackAttachmentKind) {
  const map = {
    device_photo: "device_photo_captured",
    id_front: "id_front_captured",
    id_back: "id_back_captured",
    signature: "signature_captured",
    invoice_photo: "invoice_photo_captured",
    box_photo: "box_photo_captured",
  } as const;
  return map[kind as keyof typeof map];
}

function buybackAttachmentLabel(kind: BuybackAttachmentKind) {
  if (kind === "device_photo") return "设备照片";
  if (kind === "id_front") return "证件正面";
  if (kind === "id_back") return "证件反面";
  if (kind === "signature") return "客户签名";
  if (kind === "invoice_photo") return "发票/无票确认";
  if (kind === "box_photo") return "原装盒/无盒确认";
  return "附件";
}

function QuickEstimateStep({
  draft,
  result,
  updateDraft,
}: {
  draft: BuybackQuoteDraft;
  result: ReturnType<typeof calculateBuybackQuote>;
  updateDraft: <K extends DraftKey>(key: K, value: BuybackQuoteDraft[K]) => void;
}) {
  const modelGroups = getAppleIPhoneSeriesGroups();
  const allModels = getAppleIPhoneModels();
  const initialSeries =
    modelGroups.find((group) => group.models.some((model) => model.model === draft.model))?.key ??
    modelGroups[0]?.key ??
    "iphone17";
  const [selectedSeries, setSelectedSeries] = useState(initialSeries);
  const visibleModels =
    modelGroups.find((group) => group.key === selectedSeries)?.models ?? allModels.slice(0, 6);
  const storageChoices = getAppleIPhoneStorageChoices(draft.model);
  const applyMarketSuggestion = (model: string, storageCapacity: string) => {
    const suggestion = estimateAppleMarketPricing({
      brand: "Apple",
      model,
      storageCapacity,
    });
    if (!suggestion) return;
    updateDraft("market_price", String(suggestion.resaleReference));
    updateDraft("target_profit", String(suggestion.targetProfit));
  };

  return (
    <div className="space-y-1.5">
      <section className={quoteCardClass}>
        <SectionTitle
          icon={Smartphone}
          title="选择 iPhone"
          subtitle="先选型号和容量，不需要客户资料。"
        />
        <ChoiceGroup
          label="系列"
          value={selectedSeries}
          onChange={(value) => setSelectedSeries(value)}
          options={modelGroups.map((group) => [group.key, group.label])}
        />
        <div className="grid grid-cols-2 gap-1.5 sm:grid-cols-3">
          {visibleModels.map((model) => {
            const selected = draft.model === model.model;
            return (
              <button
                key={model.model}
                type="button"
                className={cn(
                  "min-w-0 rounded-lg border border-[var(--border-panel)] bg-card px-2 py-1.5 text-left shadow-[var(--shadow-card)] transition-colors",
                  selected && "border-primary/50 bg-primary/10 text-primary",
                )}
                onClick={() => {
                  const baseStorage = `${model.baseStorageGb}GB`;
                  updateDraft("brand", "Apple");
                  updateDraft("model", model.model);
                  updateDraft("storage_capacity", baseStorage);
                  applyMarketSuggestion(model.model, baseStorage);
                }}
              >
                <p className="truncate text-[11px] font-semibold leading-4">{model.model}</p>
                <p className="truncate text-[9px] leading-3 text-muted-foreground">
                  {model.releaseYear} · 起 {model.baseStorageGb}GB
                </p>
              </button>
            );
          })}
        </div>
      </section>

      <section className={quoteCardClass}>
        <SectionTitle
          icon={Sparkles}
          title="简易状态"
          subtitle="只记录会影响口头估价的关键条件。"
        />
        <MarketGuidePanel
          result={result}
          onApplyMarket={() => {
            if (!result.marketSuggestion) return;
            updateDraft("market_price", String(result.marketSuggestion.resaleReference));
          }}
          onApplyTargetProfit={() => {
            if (!result.marketSuggestion) return;
            updateDraft("target_profit", String(result.marketSuggestion.targetProfit));
          }}
        />
        <ChoiceGroup
          label="容量"
          value={draft.storage_capacity}
          onChange={(value) => {
            updateDraft("storage_capacity", value);
            applyMarketSuggestion(draft.model, value);
          }}
          options={storageChoices.map(
            (storage) => [`${storage.valueGb}GB`, storage.label] as [string, string],
          )}
        />
        <p className="rounded-lg bg-[var(--surface-panel-muted)] px-2 py-1.5 text-[10px] leading-4 text-muted-foreground">
          {getAppleIPhoneStorageHint(draft.model)}
        </p>
        <div className="grid grid-cols-2 gap-1.5">
          <TextField
            label="颜色"
            value={draft.color}
            onChange={(value) => updateDraft("color", value)}
            placeholder="可选"
          />
          <TextField
            label="电池健康"
            value={draft.battery_health}
            onChange={(value) => updateDraft("battery_health", value)}
            inputMode="numeric"
            suffix="%"
          />
        </div>
        <div className="space-y-2 rounded-lg bg-[var(--surface-panel-muted)] p-2">
          <AutoCosmeticAssessmentCard result={result} />
          <ChoiceGroup
            label="屏幕"
            value={draft.screen_condition}
            onChange={(value) => updateDraft("screen_condition", value)}
            options={[
              ["normal", "正常"],
              ["light_scratches", "轻微划痕"],
              ["deep_scratches", "明显划痕"],
              ["cracked", "裂屏"],
              ["display_issue", "显示异常"],
            ]}
          />
          <ChoiceGroup
            label="机身"
            value={draft.body_condition}
            onChange={(value) => updateDraft("body_condition", value)}
            options={[
              ["normal", "正常"],
              ["light_wear", "轻微磨损"],
              ["heavy_wear", "明显磨损"],
              ["bent", "变形"],
            ]}
          />
          <div className="grid grid-cols-2 gap-1.5">
            <ToggleRow
              label="带原装盒"
              checked={draft.box_included}
              onChange={(value) => updateDraft("box_included", value)}
            />
            <ToggleRow
              label="有发票/凭证"
              checked={draft.purchase_proof}
              onChange={(value) => updateDraft("purchase_proof", value)}
            />
          </div>
          <details className="rounded-lg bg-card px-2 py-1.5 text-[10px] leading-4 text-muted-foreground">
            <summary className="cursor-pointer text-[11px] font-medium text-foreground">
              高级价格参数
            </summary>
            <div className="mt-2 grid grid-cols-3 gap-1.5">
              <TextField
                label="市场"
                value={draft.market_price}
                onChange={(value) => updateDraft("market_price", value)}
                inputMode="decimal"
                prefix="€"
              />
              <TextField
                label="成本"
                value={draft.estimated_repair_cost}
                onChange={(value) => updateDraft("estimated_repair_cost", value)}
                inputMode="decimal"
                prefix="€"
              />
              <TextField
                label="利润"
                value={draft.target_profit}
                onChange={(value) => updateDraft("target_profit", value)}
                inputMode="decimal"
                prefix="€"
              />
            </div>
          </details>
        </div>
      </section>
    </div>
  );
}

function MarketGuidePanel({
  result,
  onApplyMarket,
  onApplyTargetProfit,
}: {
  result: ReturnType<typeof calculateBuybackQuote>;
  onApplyMarket: () => void;
  onApplyTargetProfit: () => void;
}) {
  const suggestion = result.marketSuggestion;
  if (!suggestion) {
    return (
      <div className="rounded-lg bg-[var(--surface-panel-muted)] px-2 py-1.5 text-[10px] leading-4 text-muted-foreground">
        Apple 行情库暂未匹配该型号。可以手动输入市场参考价，后续再补入价格规则。
      </div>
    );
  }

  return (
    <div className="rounded-lg bg-[var(--surface-panel-muted)] p-2">
      <div className="flex min-w-0 items-start justify-between gap-2">
        <div className="min-w-0">
          <div className="flex items-center gap-1 text-[11px] font-semibold leading-4 text-primary">
            <TrendingUp className="size-3" />
            Apple 行情建议
          </div>
          <p className="truncate text-[9px] leading-3 text-muted-foreground">
            {suggestion.matched.model}
            {suggestion.requestedStorageGb ? ` ${suggestion.requestedStorageGb}GB` : ""} ·{" "}
            {suggestion.matched.sourceLabel} {suggestion.matched.observedAt}
          </p>
        </div>
        <Badge variant="outline" className="shrink-0 text-[10px]">
          {suggestion.confidence === "high"
            ? "高可信"
            : suggestion.confidence === "medium"
              ? "中可信"
              : "低可信"}
        </Badge>
      </div>
      <div className="mt-1.5 grid grid-cols-3 divide-x divide-[var(--border-panel)] rounded-lg bg-card px-1.5 py-1 text-[10px]">
        <div className="min-w-0 px-1">
          <p className="truncate text-[9px] text-muted-foreground">参考售价</p>
          <MoneyText amount={suggestion.resaleReference} className="font-semibold leading-4" />
        </div>
        <div className="min-w-0 px-1">
          <p className="truncate text-[9px] text-muted-foreground">建议利润</p>
          <MoneyText amount={suggestion.targetProfit} className="font-semibold leading-4" />
        </div>
        <div className="min-w-0 px-1">
          <p className="truncate text-[9px] text-muted-foreground">预检上限</p>
          <MoneyText amount={suggestion.preInspectionCeiling} className="font-semibold leading-4" />
        </div>
      </div>
      <div className="mt-1.5 grid grid-cols-2 gap-1.5">
        <Button
          type="button"
          variant="outline"
          size="sm"
          className="h-8 rounded-lg text-[11px]"
          onClick={onApplyMarket}
        >
          套用售价
        </Button>
        <Button
          type="button"
          variant="outline"
          size="sm"
          className="h-8 rounded-lg text-[11px]"
          onClick={onApplyTargetProfit}
        >
          套用利润
        </Button>
      </div>
      <p className="mt-1 truncate text-[9px] leading-3 text-muted-foreground">
        下次建议刷新：{suggestion.nextRefreshAt}。成交前以到店复检和本店库存周转为准。
      </p>
    </div>
  );
}

function AutoCosmeticAssessmentCard({
  result,
}: {
  result: ReturnType<typeof calculateBuybackQuote>;
}) {
  const assessment = result.cosmeticAssessment;
  return (
    <div className="rounded-lg bg-card p-2 shadow-[var(--shadow-card)]">
      <div className="flex min-w-0 items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="truncate text-[11px] font-semibold leading-4">系统评估成色</p>
          <p className="line-clamp-2 text-[9px] leading-3 text-muted-foreground">
            根据屏幕、机身、电池、拆修/进水和功能检测自动生成，不需要手动选择等级。
          </p>
        </div>
        <Badge variant="outline" className="shrink-0 text-[10px]">
          {assessment.label}
        </Badge>
      </div>
      <div className="mt-1.5 grid grid-cols-[72px_minmax(0,1fr)] gap-1.5">
        <div className="rounded-lg bg-[var(--surface-panel-muted)] px-2 py-1.5">
          <p className="truncate text-[9px] leading-3 text-muted-foreground">评分</p>
          <p className="font-mono text-[12px] font-semibold leading-4 text-primary">
            {assessment.score}/100
          </p>
        </div>
        <div className="min-w-0 rounded-lg bg-[var(--surface-panel-muted)] px-2 py-1.5">
          <p className="truncate text-[9px] leading-3 text-muted-foreground">依据</p>
          <p className="line-clamp-2 text-[10px] font-medium leading-4">{assessment.summary}</p>
        </div>
      </div>
    </div>
  );
}

function IntentStep({
  result,
  onDefer,
  onReject,
  isDeferring,
}: {
  result: ReturnType<typeof calculateBuybackQuote>;
  onDefer: () => void;
  onReject: () => void;
  isDeferring: boolean;
}) {
  return (
    <div className="space-y-1.5">
      <QuoteSummaryCard
        title="简易估价"
        result={result}
        badgeLabel={result.hardBlock ? "风险待处理" : "可继续"}
      >
        <p className="mt-1 text-[10px] leading-4 text-muted-foreground">
          这是给客户看的初步口头估价。客户同意后，再进入账号锁、功能检测、实名资料和签名登记。
        </p>
      </QuoteSummaryCard>

      <section className={quoteCardClass}>
        <SectionTitle
          icon={CheckCircle2}
          title="下一步流程"
          subtitle="避免一开始就收集敏感资料，先确认客户意向。"
        />
        <div className="grid gap-1.5">
          <ProcessRow index="1" title="客户接受简易报价" detail="确认愿意继续检测和登记资料。" />
          <ProcessRow
            index="2"
            title="检测手机功能"
            detail="账号锁、Face ID、相机、充电、电池等。"
          />
          <ProcessRow
            index="3"
            title="登记成交资料"
            detail="姓名、电话、证件、签名，保存为回收单。"
          />
        </div>
        <div className="grid grid-cols-2 gap-1.5 border-t border-[var(--border-panel)] pt-2">
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="h-9 rounded-lg text-xs"
            disabled={isDeferring}
            onClick={onDefer}
          >
            {isDeferring ? "保存中" : "保存考虑中"}
          </Button>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="h-9 rounded-lg text-xs text-status-danger-foreground hover:text-status-danger-foreground"
            disabled={isDeferring}
            onClick={onReject}
          >
            客户不接受
          </Button>
        </div>
        <p className="text-[10px] leading-4 text-muted-foreground">
          “考虑中”只保存报价草稿，不计入回收成本；“不接受”不会写入库存记录。
        </p>
      </section>
    </div>
  );
}

function ProcessRow({ index, title, detail }: { index: string; title: string; detail: string }) {
  return (
    <div className="grid min-w-0 grid-cols-[24px_minmax(0,1fr)] gap-2 rounded-lg bg-[var(--surface-panel-muted)] px-2 py-1.5">
      <span className="grid size-5 shrink-0 place-items-center rounded-full bg-primary/10 text-[10px] font-semibold text-primary">
        {index}
      </span>
      <div className="min-w-0">
        <p className="truncate text-[11px] font-semibold leading-4">{title}</p>
        <p className="truncate text-[10px] leading-3 text-muted-foreground">{detail}</p>
      </div>
    </div>
  );
}

function FunctionChecklist({
  draft,
  result,
  updateDraft,
}: {
  draft: BuybackQuoteDraft;
  result: ReturnType<typeof calculateBuybackQuote>;
  updateDraft: <K extends DraftKey>(key: K, value: BuybackQuoteDraft[K]) => void;
}) {
  const requiredItems = buybackFunctionTestItems.filter((item) => item.required);
  const requiredDone = requiredItems.filter(
    (item) => draft[item.key] !== "unchecked" && draft[item.key] !== "not_applicable",
  ).length;
  const uncheckedCount = buybackFunctionTestItems.filter(
    (item) => draft[item.key] === "unchecked",
  ).length;
  const hardBlockText = result.hardBlock
    ? (result.riskNotes.find((note) => /锁|IMEI|抹除|解锁/.test(note)) ?? "风险待处理")
    : "可继续";

  return (
    <div className="space-y-1.5 rounded-lg bg-[var(--surface-panel-muted)] p-2">
      <div className="flex items-center justify-between gap-2">
        <Label className="text-[10px] font-medium text-muted-foreground">功能检测清单</Label>
        <Badge variant="secondary" className="text-[10px]">
          {buybackFunctionTestItems.length} 项
        </Badge>
      </div>
      <div className="grid grid-cols-3 gap-1.5">
        <MetricPill label="必检完成" value={`${requiredDone}/${requiredItems.length}`} />
        <MetricPill label="未测项目" value={String(uncheckedCount)} />
        <MetricPill
          label="成交状态"
          value={hardBlockText}
          tone={result.hardBlock ? "danger" : "success"}
        />
      </div>
      {buybackFunctionTestGroups.map((group) => {
        const items = group.itemKeys
          .map((key) => buybackFunctionTestItems.find((item) => item.key === key))
          .filter((item): item is (typeof buybackFunctionTestItems)[number] => Boolean(item));
        const done = items.filter(
          (item) => draft[item.key] !== "unchecked" && draft[item.key] !== "not_applicable",
        ).length;
        return (
          <div key={group.key} className="rounded-lg bg-card p-1.5 shadow-[var(--shadow-card)]">
            <div className="mb-1.5 flex min-w-0 items-start justify-between gap-2">
              <div className="min-w-0">
                <p className="truncate text-[11px] font-semibold leading-4">{group.label}</p>
                <p className="truncate text-[9px] leading-3 text-muted-foreground">{group.hint}</p>
              </div>
              <Badge variant="outline" className="shrink-0 text-[10px]">
                {done}/{items.length}
              </Badge>
            </div>
            <div className="grid gap-1.5 sm:grid-cols-2">
              {items.map((item) => (
                <InspectionStatusRow
                  key={item.key}
                  label={item.label}
                  required={item.required}
                  value={draft[item.key] as BuybackInspectionStatus}
                  onChange={(value) =>
                    updateDraft(item.key, value as BuybackQuoteDraft[typeof item.key])
                  }
                />
              ))}
            </div>
          </div>
        );
      })}
    </div>
  );
}

function MetricPill({
  label,
  value,
  tone = "neutral",
}: {
  label: string;
  value: string;
  tone?: "neutral" | "success" | "danger";
}) {
  return (
    <div
      className={cn(
        "min-w-0 rounded-lg bg-card px-2 py-1 shadow-[var(--shadow-card)]",
        tone === "success" && "bg-status-success/15 text-status-success-foreground",
        tone === "danger" && "bg-status-danger/15 text-status-danger-foreground",
      )}
    >
      <p className="truncate text-[9px] leading-3 text-muted-foreground">{label}</p>
      <p className="truncate text-[11px] font-semibold leading-4">{value}</p>
    </div>
  );
}

function InspectionStatusRow({
  label,
  required,
  value,
  onChange,
}: {
  label: string;
  required: boolean;
  value: BuybackInspectionStatus;
  onChange: (value: BuybackInspectionStatus) => void;
}) {
  const options: [BuybackInspectionStatus, string][] = required
    ? [
        ["pass", "正常"],
        ["fail", "异常"],
        ["unchecked", "未测"],
      ]
    : [
        ["pass", "正常"],
        ["fail", "异常"],
        ["not_applicable", "不适用"],
        ["unchecked", "未测"],
      ];
  return (
    <div className="min-w-0 rounded-lg border border-[var(--border-panel)] bg-card p-1.5">
      <div className="mb-1 flex min-w-0 items-center justify-between gap-1.5">
        <span className="truncate text-[11px] font-medium leading-4">{label}</span>
        {required ? (
          <span className="shrink-0 rounded-full bg-primary/10 px-1.5 py-0.5 text-[9px] text-primary">
            必检
          </span>
        ) : null}
      </div>
      <div className={cn("grid gap-1", required ? "grid-cols-3" : "grid-cols-4")}>
        {options.map(([option, text]) => (
          <button
            key={option}
            type="button"
            className={cn(
              "h-8 min-w-0 rounded-md border border-[var(--border-panel)] px-1 text-[10px] font-medium text-muted-foreground transition-colors",
              value === option && "border-primary/40 bg-primary/10 text-primary",
              value === "fail" && option === "fail" && "border-status-danger-foreground/40",
            )}
            onClick={() => onChange(option)}
          >
            {text}
          </button>
        ))}
      </div>
    </div>
  );
}

function DeviceSummaryCard({
  draft,
  result,
  showDeviceMeta,
}: {
  draft: BuybackQuoteDraft;
  result: ReturnType<typeof calculateBuybackQuote>;
  showDeviceMeta?: boolean;
}) {
  return (
    <section className={cn(repairOs.mobileInfoCard, "grid grid-cols-[56px_minmax(0,1fr)] gap-2")}>
      <div className="grid aspect-[3/4] place-items-center rounded-lg bg-[var(--surface-panel-muted)] text-primary">
        <Smartphone className="size-6" />
      </div>
      <div className="min-w-0">
        <h2 className="truncate text-[13px] font-semibold leading-5">
          {[draft.brand, draft.model].filter(Boolean).join(" ") || "待填写设备"}
        </h2>
        <div className="mt-0.5 flex min-w-0 flex-wrap gap-1">
          {[draft.storage_capacity, draft.color].filter(Boolean).map((item) => (
            <Badge key={item} variant="secondary" className="h-5 text-[10px]">
              {item}
            </Badge>
          ))}
        </div>
        {showDeviceMeta ? (
          <>
            <InfoLine label="IMEI" value={draft.serial_or_imei || "未填写"} />
            <InfoLine label="购买地区" value={draft.purchase_region || "-"} />
            <InfoLine label="保修状态" value={draft.warranty_status || "-"} />
          </>
        ) : (
          <>
            <InfoLine label="市场范围" value={`€ ${result.marketMin} - € ${result.marketMax}`} />
            <InfoLine label="有效期" value={`${result.validDays} 天`} />
          </>
        )}
      </div>
    </section>
  );
}

function QuoteSummaryCard({
  title,
  result,
  badgeLabel,
  children,
}: {
  title: string;
  result: ReturnType<typeof calculateBuybackQuote>;
  badgeLabel: string;
  children?: React.ReactNode;
}) {
  return (
    <section className={quoteCardClass}>
      <div className="flex min-w-0 items-start justify-between gap-2">
        <div className="min-w-0">
          <div className="flex items-center gap-1 text-[11px] font-semibold leading-4">
            {title}
            <ShieldCheck className="size-3 text-primary" />
          </div>
          <MoneyText
            amount={result.finalOffer}
            className="mt-0.5 block text-xl font-semibold leading-6 text-primary"
          />
        </div>
        <Badge
          variant={result.hardBlock ? "destructive" : "outline"}
          className="shrink-0 gap-1 text-[10px]"
        >
          {result.hardBlock ? (
            <AlertTriangle className="size-3" />
          ) : (
            <Sparkles className="size-3" />
          )}
          {badgeLabel}
        </Badge>
      </div>
      <div className="grid grid-cols-2 gap-1.5 rounded-lg bg-[var(--surface-panel-muted)] px-2 py-1.5 text-[10px] leading-4">
        <div className="min-w-0">
          <p className="truncate text-muted-foreground">建议回收区间</p>
          <p className="truncate font-mono">
            € {result.suggestedLow} - € {result.suggestedHigh}
          </p>
        </div>
        <div className="min-w-0 text-right">
          <p className="truncate text-muted-foreground">报价有效期</p>
          <p className="truncate font-mono">{result.validDays} 天</p>
        </div>
      </div>
      {children}
    </section>
  );
}

function FunctionStep({
  draft,
  result,
  updateDraft,
}: {
  draft: BuybackQuoteDraft;
  result: ReturnType<typeof calculateBuybackQuote>;
  updateDraft: <K extends DraftKey>(key: K, value: BuybackQuoteDraft[K]) => void;
}) {
  return (
    <div className="space-y-1.5">
      <section className={quoteCardClass}>
        <SectionTitle
          icon={ClipboardCheck}
          title="功能检测"
          subtitle="逐项引导测试，必检项不能遗漏。"
        />
        <div className="space-y-2">
          <TextField
            label="IMEI / 序列号"
            value={draft.serial_or_imei}
            onChange={(value) => updateDraft("serial_or_imei", value)}
            placeholder="扫描或输入 IMEI / SN"
            inputMode="numeric"
          />
          <div className="grid gap-1.5 rounded-lg bg-[var(--surface-panel-muted)] p-2">
            <ToggleRow
              label="客户可现场解锁设备"
              checked={draft.account_unlocked}
              onChange={(value) => updateDraft("account_unlocked", value)}
            />
            <ToggleRow
              label="Find My / FRP / 账号锁已关闭"
              checked={draft.activation_lock_off}
              onChange={(value) => updateDraft("activation_lock_off", value)}
            />
            <ToggleRow
              label="有购买凭证或来源说明"
              checked={draft.purchase_proof}
              onChange={(value) => updateDraft("purchase_proof", value)}
            />
            <ToggleRow
              label="有盒子/主要配件"
              checked={draft.box_included}
              onChange={(value) => updateDraft("box_included", value)}
            />
          </div>
          <FunctionChecklist draft={draft} result={result} updateDraft={updateDraft} />
          <div className="rounded-lg bg-[var(--surface-panel-muted)] p-2">
            <Label className="text-[10px] text-muted-foreground">人工最终报价</Label>
            <div className="mt-1.5 grid grid-cols-[104px_minmax(0,1fr)] gap-1.5">
              <TextField
                label="金额"
                value={draft.manual_offer}
                onChange={(value) => updateDraft("manual_offer", value)}
                inputMode="decimal"
                prefix="€"
                hideLabel
              />
              <Textarea
                value={draft.manual_reason}
                onChange={(event) => updateDraft("manual_reason", event.target.value)}
                placeholder="超过系统建议或特殊换购时填写原因"
                className="min-h-8 resize-none rounded-lg text-base md:text-xs"
              />
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}

function CustomerIntakeStep({
  draft,
  result,
  updateDraft,
  attachments,
  updateAttachment,
  validation,
  onWhatsapp,
}: {
  draft: BuybackQuoteDraft;
  result: ReturnType<typeof calculateBuybackQuote>;
  updateDraft: <K extends DraftKey>(key: K, value: BuybackQuoteDraft[K]) => void;
  attachments: AttachmentDraft;
  updateAttachment: (kind: BuybackAttachmentKind, file?: File) => void;
  validation: ReturnType<typeof validateBuybackIntake>;
  onWhatsapp: () => void;
}) {
  return (
    <div className="space-y-1.5">
      <DeviceSummaryCard draft={draft} result={result} showDeviceMeta />

      <section className={quoteCardClass}>
        <div className="flex items-center gap-2">
          <h3 className="text-[11px] font-semibold leading-4">检测结果总览</h3>
          <Badge variant="secondary" className="text-[11px]">
            {result.inspectionItems.length} 项检测
          </Badge>
        </div>
        <div className="grid grid-cols-2 gap-1.5">
          {result.inspectionItems.map((item) => (
            <div
              key={item.label}
              className="flex min-w-0 items-center justify-between gap-1.5 rounded-lg border border-[var(--border-panel)] bg-card px-2 py-1.5"
            >
              <span className="truncate text-[11px] font-medium leading-4">{item.label}</span>
              <Badge className={cn("shrink-0 text-[10px]", inspectionToneClass(item.tone))}>
                {item.value}
              </Badge>
            </div>
          ))}
        </div>
      </section>

      <QuoteSummaryCard
        title="最终报价"
        result={result}
        badgeLabel={result.hardBlock ? "风险待处理" : "建议接受"}
      >
        <div className="grid gap-2 sm:grid-cols-2">
          <div className="min-w-0">
            <p className="mb-1 text-[11px] font-semibold leading-4">扣减明细</p>
            <div className="space-y-1">
              {result.deductions.slice(0, 5).map((item) => (
                <div
                  key={item.key}
                  className="flex items-center justify-between gap-2 text-[10px] leading-4"
                >
                  <span className="min-w-0 truncate text-muted-foreground">{item.label}</span>
                  <span className="font-mono">- €{item.amount}</span>
                </div>
              ))}
            </div>
          </div>
          <div className="min-w-0 border-t border-primary/15 pt-2 sm:border-l sm:border-t-0 sm:pl-2 sm:pt-0">
            <p className="mb-1 flex items-center gap-1 text-[11px] font-semibold leading-4">
              <AlertTriangle className="size-3 text-status-warn-foreground" />
              风险提示
            </p>
            <p className="text-[10px] leading-4 text-muted-foreground">
              {result.riskNotes.length ? result.riskNotes.join("；") : "账号已退出，核心风险正常。"}
            </p>
            {result.approvalReasons.length ? (
              <p className="mt-1 text-[10px] leading-4 text-status-warn-foreground">
                需复核：{result.approvalReasons.join("；")}
              </p>
            ) : null}
          </div>
        </div>
      </QuoteSummaryCard>

      <section className={quoteCardClass}>
        <SectionTitle
          icon={UserRound}
          title="成交资料"
          subtitle="客户同意后再登记姓名、电话、证件和签名。"
        />
        <div className="grid grid-cols-2 gap-1.5">
          <TextField
            label="客户姓名"
            value={draft.customer_name}
            onChange={(value) => updateDraft("customer_name", value)}
            placeholder="Mario Rossi"
          />
          <TextField
            label="WhatsApp / 电话"
            value={draft.customer_phone}
            onChange={(value) => updateDraft("customer_phone", value)}
            placeholder="+39 333..."
            inputMode="tel"
          />
          <div className="col-span-2 space-y-1 rounded-lg bg-[var(--surface-panel-muted)] p-2">
            <ChoiceGroup
              label="证件类型"
              value={draft.customer_document_type}
              onChange={(value) => updateDraft("customer_document_type", value)}
              options={[
                ["id_card", "身份证"],
                ["passport", "护照"],
                ["residence_permit", "居留"],
                ["driver_license", "驾照"],
                ["other", "其他"],
              ]}
            />
            <TextField
              label="证件号码"
              value={draft.customer_document_no}
              onChange={(value) => updateDraft("customer_document_no", value)}
              placeholder="证件号码 / Document ID"
            />
          </div>
          <div className="col-span-2 space-y-1 rounded-lg bg-[var(--surface-panel-muted)] p-2">
            <ChoiceGroup
              label="客户签名"
              value={draft.customer_signature_status}
              onChange={(value) => updateDraft("customer_signature_status", value)}
              options={[
                ["pending", "待签名"],
                ["signed", "已签名"],
              ]}
            />
            <Textarea
              value={draft.customer_signature_note}
              onChange={(event) => updateDraft("customer_signature_note", event.target.value)}
              placeholder="来源说明、证件核验备注或门店确认说明"
              className="min-h-16 resize-none rounded-lg text-base"
            />
          </div>
        </div>
      </section>

      <section className={quoteCardClass}>
        <SectionTitle
          icon={Camera}
          title="成交凭证"
          subtitle="拍照记录会保存到私有附件，后续可追溯。"
        />
        <div className="grid grid-cols-2 gap-1.5">
          <AttachmentCaptureButton
            kind="device_photo"
            icon={Smartphone}
            label="设备照片"
            file={attachments.device_photo}
            required
            onChange={updateAttachment}
          />
          <AttachmentCaptureButton
            kind="signature"
            icon={FileText}
            label="客户签名"
            file={attachments.signature}
            required
            onChange={(kind, file) => {
              updateAttachment(kind, file);
              updateDraft("customer_signature_status", file ? "signed" : "pending");
            }}
          />
          <AttachmentCaptureButton
            kind="id_front"
            icon={UserRound}
            label="证件正面"
            file={attachments.id_front}
            required
            onChange={updateAttachment}
          />
          <AttachmentCaptureButton
            kind="id_back"
            icon={UserRound}
            label="证件反面"
            file={attachments.id_back}
            required
            onChange={updateAttachment}
          />
          <AttachmentCaptureButton
            kind="invoice_photo"
            icon={ReceiptText}
            label={draft.purchase_proof ? "发票/凭证" : "无票确认"}
            file={attachments.invoice_photo}
            required={!draft.purchase_proof}
            onChange={updateAttachment}
          />
          <AttachmentCaptureButton
            kind="box_photo"
            icon={Box}
            label={draft.box_included ? "原装盒照片" : "无盒确认"}
            file={attachments.box_photo}
            required={!draft.box_included}
            onChange={updateAttachment}
          />
        </div>
        {!validation.canSave ? (
          <div className="rounded-lg bg-status-warn/15 px-2 py-1.5 text-[10px] leading-4 text-status-warn-foreground">
            待补齐：{[...validation.missing, ...validation.hardBlockReasons].slice(0, 4).join("、")}
          </div>
        ) : (
          <div className="rounded-lg bg-status-success/15 px-2 py-1.5 text-[10px] leading-4 text-status-success-foreground">
            资料和凭证已齐全，可以保存成交回收单。
          </div>
        )}
      </section>

      <div className="grid gap-2">
        <Button
          type="button"
          className={cn("h-9 gap-1.5 rounded-lg text-xs", controls.brandButton)}
          style={brandGradientStyle}
          disabled={result.hardBlock}
          onClick={onWhatsapp}
        >
          <MessageCircle className="size-3.5" />
          发送报价到 WhatsApp
        </Button>
        <Button
          type="button"
          variant="outline"
          className="h-9 gap-1.5 rounded-lg text-xs"
          onClick={() =>
            toast.info("报价单导出会在后续接入 PDF 模板；当前成交资料会先保存到库存详情")
          }
        >
          <FileText className="size-3.5" />
          生成报价单
        </Button>
        <p className="flex items-center justify-center gap-1 text-[10px] leading-3 text-muted-foreground">
          <CalendarClock className="size-3" />
          报价基于当前检测结果，最终以到店复检为准
        </p>
      </div>
    </div>
  );
}

function SectionTitle({
  icon: Icon,
  title,
  subtitle,
}: {
  icon: React.ComponentType<{ className?: string }>;
  title: string;
  subtitle: string;
}) {
  return (
    <div className="flex min-w-0 items-center gap-1.5">
      <span className="grid size-6 shrink-0 place-items-center rounded-md bg-primary/10 text-primary">
        <Icon className="size-3.5" />
      </span>
      <div className="min-w-0">
        <h3 className="truncate text-[11px] font-semibold leading-4">{title}</h3>
        <p className="truncate text-[9px] leading-3 text-muted-foreground">{subtitle}</p>
      </div>
    </div>
  );
}

function AttachmentCaptureButton({
  kind,
  icon: Icon,
  label,
  file,
  required,
  onChange,
}: {
  kind: BuybackAttachmentKind;
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  file?: File;
  required?: boolean;
  onChange: (kind: BuybackAttachmentKind, file?: File) => void;
}) {
  const inputId = `buyback-${kind}`;
  return (
    <div className="min-w-0 rounded-lg border border-[var(--border-panel)] bg-card p-1.5 shadow-[var(--shadow-card)]">
      <label htmlFor={inputId} className="block cursor-pointer">
        <div className="flex min-w-0 items-center gap-1.5">
          <span className="grid size-7 shrink-0 place-items-center rounded-lg bg-primary/10 text-primary">
            <Icon className="size-3.5" />
          </span>
          <div className="min-w-0">
            <p className="truncate text-[11px] font-semibold leading-4">
              {label}
              {required ? <span className="ml-0.5 text-status-danger-foreground">*</span> : null}
            </p>
            <p className="truncate text-[9px] leading-3 text-muted-foreground">
              {file ? file.name : "点击拍照/选择"}
            </p>
          </div>
        </div>
      </label>
      <input
        id={inputId}
        type="file"
        accept="image/*,application/pdf"
        capture="environment"
        className="sr-only"
        onChange={(event) => onChange(kind, event.currentTarget.files?.[0])}
      />
      {file ? (
        <button
          type="button"
          className="mt-1 text-[10px] leading-3 text-muted-foreground"
          onClick={() => onChange(kind, undefined)}
        >
          重新选择
        </button>
      ) : null}
    </div>
  );
}

function TextField({
  label,
  value,
  onChange,
  placeholder,
  inputMode,
  prefix,
  suffix,
  className,
  hideLabel,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  inputMode?: React.HTMLAttributes<HTMLInputElement>["inputMode"];
  prefix?: string;
  suffix?: string;
  className?: string;
  hideLabel?: boolean;
}) {
  return (
    <div className={cn("min-w-0 space-y-0.5", className)}>
      {!hideLabel ? <Label className="text-[10px] text-muted-foreground">{label}</Label> : null}
      <div className="relative">
        {prefix ? (
          <span className="pointer-events-none absolute left-2 top-1/2 -translate-y-1/2 text-[10px] text-muted-foreground">
            {prefix}
          </span>
        ) : null}
        <Input
          value={value}
          onChange={(event) => onChange(event.target.value)}
          placeholder={placeholder}
          inputMode={inputMode}
          className={cn(
            "h-8 rounded-lg px-2 text-base md:text-sm",
            prefix && "pl-5",
            suffix && "pr-7",
          )}
        />
        {suffix ? (
          <span className="pointer-events-none absolute right-2 top-1/2 -translate-y-1/2 text-[10px] text-muted-foreground">
            {suffix}
          </span>
        ) : null}
      </div>
    </div>
  );
}

function ToggleRow({
  label,
  checked,
  onChange,
}: {
  label: string;
  checked: boolean;
  onChange: (value: boolean) => void;
}) {
  return (
    <button
      type="button"
      className={cn(
        "flex min-h-8 min-w-0 items-center justify-between gap-2 rounded-lg border px-2 py-1.5 text-left text-[11px] leading-4",
        checked
          ? "border-primary/30 bg-primary/10 text-primary"
          : "border-[var(--border-panel)] bg-card text-foreground",
      )}
      onClick={() => onChange(!checked)}
    >
      <span className="truncate">{label}</span>
      <span className="grid size-4 shrink-0 place-items-center rounded-full border border-current">
        {checked ? <CheckCircle2 className="size-3" /> : null}
      </span>
    </button>
  );
}

function ChoiceGroup<T extends string>({
  label,
  value,
  onChange,
  options,
}: {
  label: string;
  value: T;
  onChange: (value: T) => void;
  options: [T, string][];
}) {
  return (
    <div className="space-y-1">
      <Label className="text-[10px] text-muted-foreground">{label}</Label>
      <div className="flex min-w-0 flex-wrap gap-1">
        {options.map(([option, text]) => (
          <button
            key={option}
            type="button"
            className={cn(
              "inline-flex h-7 shrink-0 items-center rounded-lg border border-[var(--border-panel)] bg-card px-2 text-[11px] font-medium text-muted-foreground shadow-[var(--shadow-card)] transition-colors",
              value === option && "border-primary/40 bg-primary/10 text-primary",
            )}
            onClick={() => onChange(option)}
          >
            {text}
          </button>
        ))}
      </div>
    </div>
  );
}

function InfoLine({ label, value }: { label: string; value: string }) {
  return (
    <div className="mt-1 flex min-w-0 items-center justify-between gap-2 border-b border-border/40 pb-1 text-[10px] leading-4 last:border-0">
      <span className="text-muted-foreground">{label}</span>
      <span className="min-w-0 truncate text-right font-medium">{value}</span>
    </div>
  );
}

function inspectionToneClass(tone: "success" | "warn" | "danger" | "neutral") {
  if (tone === "success") return "bg-status-success text-status-success-foreground";
  if (tone === "warn") return "bg-status-warn text-status-warn-foreground";
  if (tone === "danger") return "bg-status-danger text-status-danger-foreground";
  return "bg-status-neutral text-status-neutral-foreground";
}
