"use client";

import type { Dispatch, SetStateAction } from "react";
import { Wrench } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { OrderWorkspaceSectionHeader } from "@/features/orders/components/order-workspace-primitives";
import { FormItem } from "@/features/orders/forms/new-order-fields";
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
    surface === "dialog"
      ? detailWorkspace.flatPanel
      : cn(
          repairOs.mobileInfoCard,
          "md:rounded-[var(--radius-lg)] md:bg-[var(--surface-panel)] md:shadow-none",
        ),
  );
  const Shell = "section";
  const issueLength = form.issue.length;

  return (
    <Shell data-new-order-section="fault-diagnosis" className={cn(shellClass, "space-y-2")}>
      <OrderWorkspaceSectionHeader
        icon={Wrench}
        title="客户报障"
        description="记录客户原话；不知道问题时先标记待检测"
        className="mb-1"
        action={
          <span className="rounded-full bg-primary/5 px-1.5 py-0.5 text-[9px] font-semibold leading-3 text-primary">
            {form.issueCaptureMode === "unknown" ? "待检测" : "问题明确"}
          </span>
        }
      />
      <div
        className="grid grid-cols-2 gap-1 rounded-xl bg-[var(--surface-panel-muted)] p-1"
        role="group"
        aria-label="客户问题是否明确"
      >
        <Button
          type="button"
          size="sm"
          variant={form.issueCaptureMode === "reported" ? "default" : "ghost"}
          className="h-8 rounded-lg text-xs"
          aria-pressed={form.issueCaptureMode === "reported"}
          onClick={() => setForm({ ...form, issueCaptureMode: "reported" })}
        >
          问题明确
        </Button>
        <Button
          type="button"
          size="sm"
          variant={form.issueCaptureMode === "unknown" ? "default" : "ghost"}
          className="h-8 rounded-lg text-xs"
          aria-pressed={form.issueCaptureMode === "unknown"}
          onClick={() =>
            setForm({ ...form, issueCaptureMode: "unknown", issue: "", faults: [], deposit: 0 })
          }
        >
          问题未知，需检测
        </Button>
      </div>
      <div className="mt-1.5">
        {form.issueCaptureMode === "unknown" ? (
          <div className="rounded-xl border border-primary/15 bg-primary/5 px-3 py-2 text-xs leading-5 text-foreground">
            工单会记录“客户暂时无法确认具体故障，需检测”，不会自动生成 €0
            报价项目。技师可在检测后补充结论。
          </div>
        ) : (
          <FormItem label="客户描述的故障现象" className="space-y-1">
            <div className="relative">
              <Textarea
                value={form.issue}
                onChange={(event) => setForm({ ...form, issue: event.target.value })}
                rows={2}
                maxLength={200}
                className="min-h-[60px] resize-none rounded-xl border-0 bg-[var(--surface-panel-muted)] px-2.5 pb-5 pt-2 text-base leading-5 shadow-none placeholder:text-[13px] placeholder:text-muted-foreground/45 focus-visible:ring-1 md:text-[13px]"
                placeholder="例如：掉电很快、屏幕不显示、无法充电..."
              />
              <span className="pointer-events-none absolute bottom-1.5 right-2 text-[9px] leading-3 text-muted-foreground">
                {issueLength}/200
              </span>
            </div>
          </FormItem>
        )}
      </div>
    </Shell>
  );
}
