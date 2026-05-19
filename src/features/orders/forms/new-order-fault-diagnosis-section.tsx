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
    <Card className="h-fit border-border/70 p-4 shadow-sm">
      <div className="mb-4 flex items-center gap-3">
        <Search className="size-5 text-muted-foreground" />
        <h2 className="text-xl font-semibold">故障诊断</h2>
      </div>
      <FaultDiagnosisPicker
        selected={form.faults}
        onChange={(faults) => setForm({ ...form, faults })}
      />
      <div className="mt-6">
        <FormItem label="故障备注 / 其他问题">
          <Textarea
            value={form.issue}
            onChange={(event) => setForm({ ...form, issue: event.target.value })}
            rows={4}
            placeholder="详细描述故障情况..."
          />
        </FormItem>
      </div>
    </Card>
  );
}
