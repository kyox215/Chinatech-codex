"use client";

import type * as React from "react";
import { useMemo, useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import {
  AlertTriangle,
  CalendarClock,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  FileText,
  History,
  MessageCircle,
  ShieldCheck,
  Smartphone,
  Sparkles,
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
  buildWhatsappQuoteMessage,
  buybackQuoteSteps,
  calculateBuybackQuote,
  defaultBuybackQuoteDraft,
  normalizeWhatsappPhone,
  type BuybackQuoteDraft,
} from "@/features/buyback/model/buyback-quote";
import { createInventoryIntake, transitionInventoryItem } from "@/lib/repairdesk/api";
import { componentOverlay } from "@/lib/component-patterns";
import { brandGradientStyle, controls, repairOs } from "@/lib/ui-patterns";
import { cn } from "@/lib/utils";

interface BuybackQuoteWorkspaceProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

type DraftKey = keyof BuybackQuoteDraft;

export function BuybackQuoteWorkspace({ open, onOpenChange }: BuybackQuoteWorkspaceProps) {
  const queryClient = useQueryClient();
  const [stepIndex, setStepIndex] = useState(0);
  const [draft, setDraft] = useState<BuybackQuoteDraft>(defaultBuybackQuoteDraft);
  const result = useMemo(() => calculateBuybackQuote(draft), [draft]);
  const currentStep = buybackQuoteSteps[stepIndex];
  const phone = normalizeWhatsappPhone(draft.customer_phone);

  const saveMutation = useMutation({
    mutationFn: async () => {
      const input = buildBuybackQuoteCreateInput(draft, result);
      const { id } = await createInventoryIntake(input);
      await transitionInventoryItem(id, "evaluating", { reason: "回收报价检测完成" });
      if (!result.hardBlock) {
        await transitionInventoryItem(id, "offer_made", {
          reason: `回收报价 €${result.finalOffer.toFixed(2)}`,
        });
      }
      return { id };
    },
    onSuccess: async () => {
      toast.success(result.hardBlock ? "已保存风险待处理报价" : "回收报价已保存");
      await queryClient.invalidateQueries({ queryKey: inventoryKeys.all });
      onOpenChange(false);
      setStepIndex(0);
      setDraft(defaultBuybackQuoteDraft);
    },
    onError: (error) => toast.error(error instanceof Error ? error.message : "保存报价失败"),
  });

  function updateDraft<K extends DraftKey>(key: K, value: BuybackQuoteDraft[K]) {
    setDraft((current) => ({ ...current, [key]: value }));
  }

  function openWhatsappQuote() {
    if (!phone) {
      toast.error("请先填写可用的客户 WhatsApp 电话");
      return;
    }
    const message = buildWhatsappQuoteMessage(draft, result);
    window.open(`https://wa.me/${phone}?text=${encodeURIComponent(message)}`, "_blank", "noopener");
  }

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        side="bottom"
        className={cn(
          componentOverlay.bottomSheet,
          "h-[calc(100svh-2rem)] max-h-[calc(100svh-2rem)] p-0",
        )}
      >
        <div className="flex h-full min-h-0 flex-col bg-background">
          <SheetHeader className="border-b border-[var(--border-panel)] px-3 py-3 text-left">
            <div className="flex items-center justify-between gap-2">
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="size-9 shrink-0"
                onClick={() => onOpenChange(false)}
                aria-label="关闭回收报价"
              >
                <ChevronLeft className="size-5" />
              </Button>
              <div className="min-w-0 text-center">
                <SheetTitle className="truncate text-lg font-semibold">回收报价</SheetTitle>
                <SheetDescription className="sr-only">
                  按设备信息、检测结果和风险规则生成回收报价。
                </SheetDescription>
              </div>
              <Button type="button" variant="outline" size="sm" className="h-8 shrink-0 gap-1.5">
                <History className="size-3.5" />
                历史
              </Button>
            </div>
          </SheetHeader>

          <QuoteStepper activeIndex={stepIndex} />

          <div className="min-h-0 flex-1 overflow-y-auto px-3 py-3">
            {currentStep.key === "basic" ? (
              <BasicStep draft={draft} updateDraft={updateDraft} />
            ) : null}
            {currentStep.key === "appearance" ? (
              <AppearanceStep draft={draft} updateDraft={updateDraft} />
            ) : null}
            {currentStep.key === "function" ? (
              <FunctionStep draft={draft} updateDraft={updateDraft} />
            ) : null}
            {currentStep.key === "result" ? (
              <ResultStep draft={draft} result={result} onWhatsapp={openWhatsappQuote} />
            ) : null}
          </div>

          <div className="border-t border-[var(--border-panel)] bg-background/95 px-3 py-2 pb-[calc(env(safe-area-inset-bottom)+0.5rem)]">
            <div className="flex min-w-0 items-center justify-between gap-2">
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="h-9 gap-1.5"
                disabled={stepIndex === 0}
                onClick={() => setStepIndex((current) => Math.max(0, current - 1))}
              >
                <ChevronLeft className="size-3.5" />
                上一步
              </Button>
              <div className="min-w-0 text-center text-[11px] text-muted-foreground">
                {result.hardBlock
                  ? "风险待处理"
                  : `建议 €${result.suggestedLow}-${result.suggestedHigh}`}
              </div>
              {stepIndex < buybackQuoteSteps.length - 1 ? (
                <Button
                  type="button"
                  size="sm"
                  className={cn("h-9 gap-1.5", controls.brandButton)}
                  style={brandGradientStyle}
                  onClick={() =>
                    setStepIndex((current) => Math.min(buybackQuoteSteps.length - 1, current + 1))
                  }
                >
                  下一步
                  <ChevronRight className="size-3.5" />
                </Button>
              ) : (
                <Button
                  type="button"
                  size="sm"
                  className={cn("h-9 gap-1.5", controls.brandButton)}
                  style={brandGradientStyle}
                  disabled={saveMutation.isPending || !draft.model.trim()}
                  onClick={() => saveMutation.mutate()}
                >
                  <FileText className="size-3.5" />
                  保存报价
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
    <div className="border-b border-[var(--border-panel)] px-4 py-3">
      <div className="grid grid-cols-4 gap-1">
        {buybackQuoteSteps.map((step, index) => {
          const active = index === activeIndex;
          const complete = index < activeIndex;
          return (
            <div key={step.key} className="relative min-w-0 text-center">
              {index > 0 ? (
                <div className="absolute right-1/2 top-3 h-px w-full bg-primary/35" />
              ) : null}
              <span
                className={cn(
                  "relative z-10 mx-auto grid size-6 place-items-center rounded-full border text-xs font-semibold",
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
                  "mt-1 truncate text-[11px]",
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

function BasicStep({
  draft,
  updateDraft,
}: {
  draft: BuybackQuoteDraft;
  updateDraft: <K extends DraftKey>(key: K, value: BuybackQuoteDraft[K]) => void;
}) {
  return (
    <div className="space-y-3">
      <section className={repairOs.adminSection}>
        <SectionTitle
          icon={Smartphone}
          title="客户与设备"
          subtitle="初步估价可匿名，成交前补全客户资料。"
        />
        <div className="mt-3 grid grid-cols-2 gap-2">
          <TextField
            label="客户姓名"
            value={draft.customer_name}
            onChange={(value) => updateDraft("customer_name", value)}
            placeholder="Mario Rossi"
          />
          <TextField
            label="WhatsApp"
            value={draft.customer_phone}
            onChange={(value) => updateDraft("customer_phone", value)}
            placeholder="+39 333..."
            inputMode="tel"
          />
          <TextField
            label="品牌"
            value={draft.brand}
            onChange={(value) => updateDraft("brand", value)}
          />
          <TextField
            label="型号"
            value={draft.model}
            onChange={(value) => updateDraft("model", value)}
          />
          <TextField
            label="容量"
            value={draft.storage_capacity}
            onChange={(value) => updateDraft("storage_capacity", value)}
          />
          <TextField
            label="颜色"
            value={draft.color}
            onChange={(value) => updateDraft("color", value)}
          />
          <TextField
            label="IMEI / SN"
            value={draft.serial_or_imei}
            onChange={(value) => updateDraft("serial_or_imei", value)}
            className="col-span-2"
          />
        </div>
      </section>

      <section className={repairOs.adminSection}>
        <SectionTitle
          icon={Sparkles}
          title="行情与目标"
          subtitle="系统用参考售价减去扣减、维修成本和目标利润。"
        />
        <div className="mt-3 grid grid-cols-3 gap-2">
          <TextField
            label="市场参考"
            value={draft.market_price}
            onChange={(value) => updateDraft("market_price", value)}
            inputMode="decimal"
            prefix="€"
          />
          <TextField
            label="维修成本"
            value={draft.estimated_repair_cost}
            onChange={(value) => updateDraft("estimated_repair_cost", value)}
            inputMode="decimal"
            prefix="€"
          />
          <TextField
            label="目标利润"
            value={draft.target_profit}
            onChange={(value) => updateDraft("target_profit", value)}
            inputMode="decimal"
            prefix="€"
          />
          <TextField
            label="购买地区"
            value={draft.purchase_region}
            onChange={(value) => updateDraft("purchase_region", value)}
          />
          <TextField
            label="保修状态"
            value={draft.warranty_status}
            onChange={(value) => updateDraft("warranty_status", value)}
          />
          <TextField
            label="有效天数"
            value={draft.quote_valid_days}
            onChange={(value) => updateDraft("quote_valid_days", value)}
            inputMode="numeric"
          />
        </div>
      </section>
    </div>
  );
}

function AppearanceStep({
  draft,
  updateDraft,
}: {
  draft: BuybackQuoteDraft;
  updateDraft: <K extends DraftKey>(key: K, value: BuybackQuoteDraft[K]) => void;
}) {
  return (
    <div className="space-y-3">
      <section className={repairOs.adminSection}>
        <SectionTitle
          icon={ShieldCheck}
          title="来源与风险"
          subtitle="锁未解除或无法解锁时，只能保存风险待处理。"
        />
        <div className="mt-3 grid gap-2">
          <ToggleRow
            label="客户可解锁设备"
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
      </section>

      <section className={repairOs.adminSection}>
        <SectionTitle
          icon={CheckCircle2}
          title="外观检测"
          subtitle="成色、屏幕和机身会自动生成扣减明细。"
        />
        <div className="mt-3 space-y-3">
          <ChoiceGroup
            label="成色等级"
            value={draft.cosmetic_grade}
            onChange={(value) => updateDraft("cosmetic_grade", value)}
            options={[
              ["s", "S"],
              ["a_plus", "A+"],
              ["a", "A"],
              ["b", "B"],
              ["c", "C"],
              ["d", "D"],
            ]}
          />
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
        </div>
      </section>
    </div>
  );
}

function FunctionStep({
  draft,
  updateDraft,
}: {
  draft: BuybackQuoteDraft;
  updateDraft: <K extends DraftKey>(key: K, value: BuybackQuoteDraft[K]) => void;
}) {
  return (
    <div className="space-y-3">
      <section className={repairOs.adminSection}>
        <SectionTitle
          icon={CheckCircle2}
          title="功能检测"
          subtitle="必检项会进入报价说明，方便给客户解释。"
        />
        <div className="mt-3 space-y-3">
          <TextField
            label="电池健康"
            value={draft.battery_health}
            onChange={(value) => updateDraft("battery_health", value)}
            inputMode="numeric"
            suffix="%"
          />
          <ChoiceGroup
            label="Face ID / Touch ID"
            value={draft.face_id_status}
            onChange={(value) => updateDraft("face_id_status", value)}
            options={[
              ["pass", "正常"],
              ["fail", "异常"],
              ["not_applicable", "不适用"],
            ]}
          />
          <ChoiceGroup
            label="相机功能"
            value={draft.camera_status}
            onChange={(value) => updateDraft("camera_status", value)}
            options={[
              ["pass", "正常"],
              ["fail", "异常"],
              ["unchecked", "未测"],
            ]}
          />
          <ChoiceGroup
            label="充电功能"
            value={draft.charging_status}
            onChange={(value) => updateDraft("charging_status", value)}
            options={[
              ["pass", "正常"],
              ["fail", "异常"],
              ["unchecked", "未测"],
            ]}
          />
          <div className={repairOs.adminSection}>
            <Label className="text-xs">人工最终报价</Label>
            <div className="mt-2 grid grid-cols-[120px_minmax(0,1fr)] gap-2">
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
                className="min-h-9 resize-none text-xs"
              />
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}

function ResultStep({
  draft,
  result,
  onWhatsapp,
}: {
  draft: BuybackQuoteDraft;
  result: ReturnType<typeof calculateBuybackQuote>;
  onWhatsapp: () => void;
}) {
  return (
    <div className="space-y-3">
      <section className={cn(repairOs.adminSection, "grid grid-cols-[84px_minmax(0,1fr)] gap-3")}>
        <div className="grid aspect-[3/4] place-items-center rounded-lg bg-primary/10 text-primary">
          <Smartphone className="size-10" />
        </div>
        <div className="min-w-0">
          <h2 className="truncate text-lg font-semibold">
            {[draft.brand, draft.model].filter(Boolean).join(" ") || "待填写设备"}
          </h2>
          <div className="mt-2 flex flex-wrap gap-1.5">
            {[draft.storage_capacity, draft.color].filter(Boolean).map((item) => (
              <Badge key={item} variant="secondary" className="text-[11px]">
                {item}
              </Badge>
            ))}
          </div>
          <InfoLine label="IMEI" value={draft.serial_or_imei || "未填写"} />
          <InfoLine label="购买地区" value={draft.purchase_region || "-"} />
          <InfoLine label="保修状态" value={draft.warranty_status || "-"} />
        </div>
      </section>

      <section className={repairOs.adminSection}>
        <div className="mb-3 flex items-center gap-2">
          <h3 className="text-sm font-semibold">检测结果总览</h3>
          <Badge variant="secondary" className="text-[11px]">
            {result.inspectionItems.length} 项检测
          </Badge>
        </div>
        <div className="grid grid-cols-2 gap-2">
          {result.inspectionItems.map((item) => (
            <div
              key={item.label}
              className="flex min-w-0 items-center justify-between gap-2 rounded-lg border border-[var(--border-panel)] bg-card px-2.5 py-2"
            >
              <span className="truncate text-xs font-medium">{item.label}</span>
              <Badge className={inspectionToneClass(item.tone)}>{item.value}</Badge>
            </div>
          ))}
        </div>
      </section>

      <section className="rounded-lg border border-primary/25 bg-primary/5 p-3 shadow-[var(--shadow-card)]">
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0">
            <div className="flex items-center gap-1.5 text-sm font-semibold">
              最终报价
              <ShieldCheck className="size-4 text-primary" />
            </div>
            <MoneyText
              amount={result.finalOffer}
              className="mt-1 block text-5xl font-semibold text-primary"
            />
          </div>
          <Badge variant={result.hardBlock ? "destructive" : "outline"} className="gap-1.5">
            {result.hardBlock ? (
              <AlertTriangle className="size-3.5" />
            ) : (
              <Sparkles className="size-3.5" />
            )}
            {result.hardBlock ? "风险待处理" : "建议接受"}
          </Badge>
        </div>
        <div className="mt-2 grid grid-cols-2 gap-2 text-xs">
          <div>
            <p className="text-muted-foreground">市场参考范围</p>
            <p className="mt-0.5 font-mono">
              € {result.marketMin} - € {result.marketMax}
            </p>
          </div>
          <div className="text-right">
            <p className="text-muted-foreground">报价有效期</p>
            <p className="mt-0.5 font-mono">{result.validDays} 天</p>
          </div>
        </div>
        <div className="my-3 h-px bg-primary/15" />
        <div className="grid gap-3 sm:grid-cols-2">
          <div className="min-w-0">
            <p className="mb-1 text-xs font-semibold">扣减明细</p>
            <div className="space-y-1">
              {result.deductions.slice(0, 5).map((item) => (
                <div key={item.key} className="flex items-center justify-between gap-2 text-xs">
                  <span className="min-w-0 truncate text-muted-foreground">{item.label}</span>
                  <span className="font-mono">- €{item.amount}</span>
                </div>
              ))}
            </div>
          </div>
          <div className="min-w-0 border-t border-primary/15 pt-3 sm:border-l sm:border-t-0 sm:pl-3 sm:pt-0">
            <p className="mb-1 flex items-center gap-1.5 text-xs font-semibold">
              <AlertTriangle className="size-3.5 text-status-warn-foreground" />
              风险提示
            </p>
            <p className="text-xs leading-5 text-muted-foreground">
              {result.riskNotes.length ? result.riskNotes.join("；") : "账号已退出，核心风险正常。"}
            </p>
            {result.approvalReasons.length ? (
              <p className="mt-1 text-xs leading-5 text-status-warn-foreground">
                需复核：{result.approvalReasons.join("；")}
              </p>
            ) : null}
          </div>
        </div>
      </section>

      <div className="grid gap-2">
        <Button
          type="button"
          className={cn("h-11 gap-2", controls.brandButton)}
          style={brandGradientStyle}
          disabled={result.hardBlock}
          onClick={onWhatsapp}
        >
          <MessageCircle className="size-4" />
          发送报价到 WhatsApp
        </Button>
        <Button type="button" variant="outline" className="h-10 gap-2">
          <FileText className="size-4" />
          生成报价单
        </Button>
        <p className="flex items-center justify-center gap-1.5 text-[11px] text-muted-foreground">
          <CalendarClock className="size-3.5" />
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
    <div className="flex min-w-0 items-center gap-2">
      <span className="grid size-8 shrink-0 place-items-center rounded-md bg-primary/10 text-primary">
        <Icon className="size-4" />
      </span>
      <div className="min-w-0">
        <h3 className="truncate text-sm font-semibold">{title}</h3>
        <p className="truncate text-[11px] text-muted-foreground">{subtitle}</p>
      </div>
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
    <div className={cn("min-w-0 space-y-1", className)}>
      {!hideLabel ? <Label className="text-[11px] text-muted-foreground">{label}</Label> : null}
      <div className="relative">
        {prefix ? (
          <span className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 text-xs text-muted-foreground">
            {prefix}
          </span>
        ) : null}
        <Input
          value={value}
          onChange={(event) => onChange(event.target.value)}
          placeholder={placeholder}
          inputMode={inputMode}
          className={cn("h-9 text-sm", prefix && "pl-6", suffix && "pr-8")}
        />
        {suffix ? (
          <span className="pointer-events-none absolute right-2.5 top-1/2 -translate-y-1/2 text-xs text-muted-foreground">
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
        "flex min-w-0 items-center justify-between gap-2 rounded-lg border px-3 py-2 text-left text-sm",
        checked
          ? "border-primary/30 bg-primary/10 text-primary"
          : "border-[var(--border-panel)] bg-card text-foreground",
      )}
      onClick={() => onChange(!checked)}
    >
      <span className="truncate">{label}</span>
      <span className="grid size-5 shrink-0 place-items-center rounded-full border border-current">
        {checked ? <CheckCircle2 className="size-3.5" /> : null}
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
    <div className="space-y-1.5">
      <Label className="text-[11px] text-muted-foreground">{label}</Label>
      <div className="flex min-w-0 flex-wrap gap-1.5">
        {options.map(([option, text]) => (
          <button
            key={option}
            type="button"
            className={cn(repairOs.chip, value === option && repairOs.chipActive)}
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
    <div className="mt-2 flex min-w-0 items-center justify-between gap-2 border-b border-border/40 pb-1.5 text-xs last:border-0">
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
