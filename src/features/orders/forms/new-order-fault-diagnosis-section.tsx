"use client";

import type { Dispatch, SetStateAction } from "react";
import { Wrench } from "lucide-react";

import { FaultDiagnosisPicker } from "@/components/orders/fault-diagnosis-picker";
import { Textarea } from "@/components/ui/textarea";
import { FormItem, SectionHeading } from "@/features/orders/forms/new-order-fields";
import type { NewOrderFormState } from "@/features/orders/model/new-order-form";
import { detailWorkspace, repairOs } from "@/lib/ui-patterns";
import { cn } from "@/lib/utils";

export function NewOrderFaultDiagnosisSection({
  form,
  setForm,
  surface = "page",
}: {
  form: NewOrderFormState;
  setForm: Dispatch<SetStateAction<NewOrderFormState>>;
  surface?: "page" | "dialog";
}) {
  const shellClass = cn(
    "h-fit min-w-0 p-2 sm:p-3",
    surface === "dialog" ? detailWorkspace.flatPanel : repairOs.mobileInfoCard,
  );
  const Shell = "section";
  const issueLength = form.issue.length;

  return (
    <Shell className={shellClass}>
      <SectionHeading icon={Wrench} title="故障诊断" className="mb-1.5" />
      <div className="mb-1 flex min-w-0 items-center justify-between gap-2 px-0.5">
        <span className="truncate text-[10px] font-medium leading-3 text-muted-foreground">
          常见部件
        </span>
        <span className="shrink-0 text-[10px] font-medium leading-3 text-primary">自定义问题</span>
      </div>
      <div className="rounded-xl border border-[var(--border-panel)] bg-[var(--surface-panel-muted)]/70 p-1">
        <FaultDiagnosisPicker
          selected={form.faults}
          onChange={(faults) => setForm({ ...form, faults })}
          className="gap-1 sm:gap-1.5"
          density="compact"
          appearance="quiet"
        />
      </div>
      <div className="mt-1.5">
        <FormItem label="故障备注 / 其他问题" className="space-y-1">
          <div className="relative">
            <Textarea
              value={form.issue}
              onChange={(event) => setForm({ ...form, issue: event.target.value })}
              rows={2}
              maxLength={200}
              className="min-h-[60px] resize-none rounded-xl border-0 bg-[var(--surface-panel-muted)] px-2.5 pb-5 pt-2 text-base leading-5 shadow-none placeholder:text-[13px] placeholder:text-muted-foreground/45 focus-visible:ring-1 md:text-[13px]"
              placeholder="补充故障现象、客户备注..."
            />
            <span className="pointer-events-none absolute bottom-1.5 right-2 text-[9px] leading-3 text-muted-foreground">
              {issueLength}/200
            </span>
          </div>
        </FormItem>
      </div>
    </Shell>
  );
}
