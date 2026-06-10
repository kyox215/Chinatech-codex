"use client";

import type { Dispatch, SetStateAction } from "react";
import { Search } from "lucide-react";

import { FaultDiagnosisPicker } from "@/components/orders/fault-diagnosis-picker";
import { Card } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { FormItem } from "@/features/orders/forms/new-order-fields";
import type { NewOrderFormState } from "@/features/orders/model/new-order-form";

export function NewOrderFaultDiagnosisSection({
  form,
  setForm,
}: {
  form: NewOrderFormState;
  setForm: Dispatch<SetStateAction<NewOrderFormState>>;
}) {
  return (
    <Card className="h-fit min-w-0 border-border/70 p-2.5 shadow-sm sm:p-4">
      <div className="mb-2 flex min-w-0 items-center gap-2">
        <Search className="size-3.5 text-muted-foreground sm:size-4" />
        <h2 className="text-sm font-semibold sm:text-base">故障诊断</h2>
      </div>
      <FaultDiagnosisPicker
        selected={form.faults}
        onChange={(faults) => setForm({ ...form, faults })}
        className="gap-1.5 sm:gap-2"
        density="compact"
      />
      <div className="mt-2 sm:mt-4">
        <FormItem label="故障备注 / 其他问题">
          <Textarea
            value={form.issue}
            onChange={(event) => setForm({ ...form, issue: event.target.value })}
            rows={3}
            className="min-h-16 text-[13px] sm:min-h-20 sm:text-sm"
            placeholder="详细描述故障情况..."
          />
        </FormItem>
      </div>
    </Card>
  );
}
