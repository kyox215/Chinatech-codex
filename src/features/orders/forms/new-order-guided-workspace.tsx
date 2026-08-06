"use client";

import { useEffect, useRef, type ReactNode } from "react";
import { ArrowLeft, ArrowRight, Check, ClipboardCheck } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import type { NewOrderFormState } from "@/features/orders/model/new-order-form";
import { deviceCustodyLabel, hasUnlockValue } from "@/features/orders/model/device-custody";
import { repairOs } from "@/lib/ui-patterns";
import { cn } from "@/lib/utils";

const steps = ["客户资料", "设备与交接", "维修与报价", "确认创建"] as const;

export function NewOrderGuidedWorkspace({
  step,
  form,
  total,
  statusLabel,
  diagnosisDeferred,
  pending,
  customer,
  device,
  unlock,
  quotation,
  onStepChange,
  onNext,
  onCancel,
}: {
  step: number;
  form: NewOrderFormState;
  total: number;
  statusLabel: string;
  diagnosisDeferred: boolean;
  pending: boolean;
  customer: ReactNode;
  device: ReactNode;
  unlock: ReactNode;
  quotation: ReactNode;
  onStepChange: (step: number) => void;
  onNext: () => void;
  onCancel?: () => void;
}) {
  const headingRef = useRef<HTMLHeadingElement>(null);

  useEffect(() => {
    headingRef.current?.scrollIntoView?.({ behavior: "auto", block: "start" });
    headingRef.current?.focus({ preventScroll: true });
  }, [step]);

  return (
    <div data-new-order-guided-workspace="true" className="mx-auto grid w-full max-w-[760px] gap-3">
      <section
        className={cn(repairOs.mobileInfoCard, "p-3 md:rounded-[var(--radius-lg)] md:shadow-none")}
      >
        <nav aria-label="接单步骤">
          <div className="flex items-center justify-between gap-3">
            <div>
              <p className="text-[11px] font-medium text-muted-foreground lg:text-xs lg:leading-4">
                步骤 {step + 1}/4
              </p>
              <h2 ref={headingRef} tabIndex={-1} className="text-base font-semibold outline-none">
                {steps[step]}
              </h2>
            </div>
            <span className="text-xs font-semibold text-primary">
              {Math.round(((step + 1) / 4) * 100)}%
            </span>
          </div>
          <Progress value={((step + 1) / 4) * 100} className="mt-2 h-1.5" />
          <ol className="mt-3 hidden grid-cols-4 gap-2 md:grid">
            {steps.map((label, index) => (
              <li key={label}>
                <button
                  type="button"
                  disabled={index > step}
                  aria-current={index === step ? "step" : undefined}
                  onClick={() => onStepChange(index)}
                  className={cn(
                    "flex min-h-8 w-full items-center justify-center gap-1 rounded-lg border px-2 text-[11px] font-semibold lg:text-xs lg:leading-4",
                    index === step
                      ? "border-primary bg-primary/5 text-primary"
                      : index < step
                        ? "border-status-success-foreground/20 bg-status-success/20 text-status-success-foreground"
                        : "border-[var(--border-panel)] text-muted-foreground",
                  )}
                >
                  {index < step ? <Check className="size-3.5" /> : null}
                  {label}
                </button>
              </li>
            ))}
          </ol>
        </nav>
      </section>

      <div data-new-order-guided-step={step + 1} className="grid min-w-0 gap-3">
        {step === 0 ? customer : null}
        {step === 1 ? (
          <>
            {device}
            {unlock}
          </>
        ) : null}
        {step === 2 ? quotation : null}
        {step === 3 ? (
          <NewOrderReview
            form={form}
            total={total}
            statusLabel={statusLabel}
            diagnosisDeferred={diagnosisDeferred}
            onEdit={onStepChange}
          />
        ) : null}
      </div>

      <div
        className={cn(
          repairOs.mobileInfoCard,
          "sticky bottom-2 z-20 flex min-h-16 items-center justify-between gap-2 p-2.5 md:rounded-[var(--radius-lg)] md:shadow-[var(--shadow-overlay)]",
        )}
      >
        <div className="flex gap-2">
          {step === 0 ? (
            onCancel ? (
              <Button type="button" variant="outline" className="min-h-9" onClick={onCancel}>
                取消
              </Button>
            ) : null
          ) : (
            <Button
              type="button"
              variant="outline"
              className="min-h-9"
              disabled={pending}
              onClick={() => onStepChange(step - 1)}
            >
              <ArrowLeft className="size-4" /> 上一步
            </Button>
          )}
        </div>
        {step < 3 ? (
          <Button type="button" className="min-h-10" disabled={pending} onClick={onNext}>
            下一步 <ArrowRight className="size-4" />
          </Button>
        ) : (
          <Button type="submit" className="min-h-10" disabled={pending} aria-busy={pending}>
            <ClipboardCheck className="size-4" />
            {pending ? "正在创建…" : "确认并创建工单"}
          </Button>
        )}
      </div>
    </div>
  );
}

function NewOrderReview({
  form,
  total,
  statusLabel,
  diagnosisDeferred,
  onEdit,
}: {
  form: NewOrderFormState;
  total: number;
  statusLabel: string;
  diagnosisDeferred: boolean;
  onEdit: (step: number) => void;
}) {
  const rows = [
    {
      title: "客户资料",
      step: 0,
      lines: [form.customerName.trim() || "未填写姓名", form.customerPhone.trim() || "未填写电话"],
    },
    {
      title: "设备与交接",
      step: 1,
      lines: [
        `${form.brand || "未填写品牌"} ${form.model || "未填写型号"}`,
        deviceCustodyLabel(form.deviceCustodyStatus),
        `解锁信息：${hasUnlockValue(form.deviceUnlock) ? "已记录（不显示内容）" : "未记录"}`,
      ],
    },
    {
      title: "维修与报价",
      step: 2,
      lines: [
        form.faults.some((fault) => fault.name.trim())
          ? form.faults
              .filter((fault) => fault.name.trim())
              .map((fault) => fault.name)
              .join("、")
          : diagnosisDeferred
            ? "检测后补充"
            : "未选择维修项目",
        `报价 €${total.toFixed(2)} · 定金 €${form.deposit.toFixed(2)}`,
        `初始状态：${statusLabel}`,
      ],
    },
  ];
  return (
    <section
      className={cn(
        repairOs.mobileInfoCard,
        "grid gap-3 p-3 md:rounded-[var(--radius-lg)] md:shadow-none",
      )}
    >
      {rows.map((group) => (
        <div
          key={group.title}
          className="rounded-xl border border-[var(--border-panel)] bg-[var(--surface-panel-muted)] p-3"
        >
          <div className="flex items-center justify-between gap-2">
            <h3 className="text-xs font-semibold">{group.title}</h3>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="min-h-9"
              onClick={() => onEdit(group.step)}
            >
              修改
            </Button>
          </div>
          <div className="grid gap-1 text-xs text-muted-foreground">
            {group.lines.map((line) => (
              <p key={line}>{line}</p>
            ))}
          </div>
        </div>
      ))}
    </section>
  );
}
