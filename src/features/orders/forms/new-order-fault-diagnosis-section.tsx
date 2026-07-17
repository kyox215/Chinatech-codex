"use client";

import { useState, type Dispatch, type SetStateAction } from "react";
import { PencilLine, Wrench } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { OrderWorkspaceSectionHeader } from "@/features/orders/components/order-workspace-primitives";
import type { NewOrderFormState } from "@/features/orders/model/new-order-form";
import type { IssueCaptureMode } from "@/features/orders/model/order-diagnosis-quote";
import { useIsMobile } from "@/hooks/use-mobile";
import { componentOverlay } from "@/lib/component-patterns";
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
  const [editorOpen, setEditorOpen] = useState(false);
  const isMobile = useIsMobile();
  const shellClass = cn(
    "h-fit min-w-0 p-2 sm:p-3",
    surface === "dialog"
      ? detailWorkspace.flatPanel
      : cn(
          repairOs.mobileInfoCard,
          "md:rounded-[var(--radius-lg)] md:bg-[var(--surface-panel)] md:shadow-none",
        ),
  );
  const summary =
    form.issueCaptureMode === "unknown"
      ? "客户暂时无法确认具体故障，需检测"
      : form.issue.trim() || "尚未填写客户描述";
  const updateMode = (issueCaptureMode: IssueCaptureMode) => {
    setForm((current) => ({ ...current, issueCaptureMode }));
  };

  const editor = (
    <CustomerReportEditor
      form={form}
      setForm={setForm}
      onModeChange={updateMode}
      onDone={() => setEditorOpen(false)}
    />
  );

  return (
    <>
      <section data-new-order-section="fault-diagnosis" className={cn(shellClass, "space-y-1.5")}>
        <OrderWorkspaceSectionHeader
          icon={Wrench}
          title="客户报障"
          description="客户原话与待检测标记"
          className="mb-0.5"
          action={
            <span className="rounded-full bg-primary/5 px-1.5 py-0.5 text-[9px] font-semibold leading-3 text-primary">
              {form.issueCaptureMode === "unknown" ? "待检测" : "问题明确"}
            </span>
          }
        />

        <IssueModeControl value={form.issueCaptureMode} onChange={updateMode} />

        <div className="grid min-h-9 min-w-0 grid-cols-[minmax(0,1fr)_auto] items-center gap-1.5 rounded-lg border border-[var(--border-panel)] bg-card px-2 py-1">
          <p
            data-new-order-customer-report-summary="true"
            className={cn(
              "min-w-0 truncate text-[10px] leading-4",
              form.issueCaptureMode === "reported" && !form.issue.trim()
                ? "text-status-warn-foreground"
                : "text-muted-foreground",
            )}
            title={summary}
          >
            {summary}
          </p>
          <Button
            data-new-order-field="customer-report-edit"
            type="button"
            variant="ghost"
            size="sm"
            className="h-7 shrink-0 gap-1 rounded-md px-2 text-[10px] font-semibold text-primary"
            onClick={() => setEditorOpen(true)}
            aria-label="编辑客户报障"
          >
            <PencilLine className="size-3" />
            编辑
          </Button>
        </div>
      </section>

      {isMobile ? (
        <Sheet open={editorOpen} onOpenChange={setEditorOpen}>
          <SheetContent
            data-new-order-customer-report-editor="true"
            side="bottom"
            className={cn(
              componentOverlay.bottomSheet,
              "flex h-[min(30rem,calc(100svh-16px))] flex-col",
            )}
          >
            <SheetHeader>
              <SheetTitle>编辑客户报障</SheetTitle>
              <SheetDescription>记录客户原话；问题不明确时直接标记待检测。</SheetDescription>
            </SheetHeader>
            {editor}
          </SheetContent>
        </Sheet>
      ) : (
        <Dialog open={editorOpen} onOpenChange={setEditorOpen}>
          <DialogContent
            data-new-order-customer-report-editor="true"
            className={cn(componentOverlay.modalSm, "gap-3")}
          >
            <DialogHeader>
              <DialogTitle>编辑客户报障</DialogTitle>
              <DialogDescription>记录客户原话；问题不明确时直接标记待检测。</DialogDescription>
            </DialogHeader>
            {editor}
          </DialogContent>
        </Dialog>
      )}
    </>
  );
}

function IssueModeControl({
  value,
  onChange,
}: {
  value: IssueCaptureMode;
  onChange: (value: IssueCaptureMode) => void;
}) {
  return (
    <div
      className="grid grid-cols-2 gap-1 rounded-lg bg-[var(--surface-panel-muted)] p-1"
      role="group"
      aria-label="客户问题是否明确"
    >
      <Button
        type="button"
        size="sm"
        variant={value === "reported" ? "default" : "ghost"}
        className="h-8 rounded-md text-[11px]"
        aria-pressed={value === "reported"}
        onClick={() => onChange("reported")}
      >
        问题明确
      </Button>
      <Button
        type="button"
        size="sm"
        variant={value === "unknown" ? "default" : "ghost"}
        className="h-8 rounded-md text-[11px]"
        aria-pressed={value === "unknown"}
        onClick={() => onChange("unknown")}
      >
        问题未知，需检测
      </Button>
    </div>
  );
}

function CustomerReportEditor({
  form,
  setForm,
  onModeChange,
  onDone,
}: {
  form: NewOrderFormState;
  setForm: Dispatch<SetStateAction<NewOrderFormState>>;
  onModeChange: (value: IssueCaptureMode) => void;
  onDone: () => void;
}) {
  const issueLength = form.issue.length;

  return (
    <div className="grid min-h-0 min-w-0 flex-1 content-start gap-3 overflow-y-auto pt-3">
      <IssueModeControl value={form.issueCaptureMode} onChange={onModeChange} />

      <div className="h-[132px] min-h-0">
        {form.issueCaptureMode === "unknown" ? (
          <div className="grid h-full content-center rounded-xl border border-primary/15 bg-primary/5 px-3 py-3 text-xs leading-5 text-foreground">
            工单会记录“客户暂时无法确认具体故障，需检测”。已经填写的客户描述和报价草稿会保留，切回“问题明确”后可继续编辑。
          </div>
        ) : (
          <div className="min-w-0 space-y-1">
            <Label
              htmlFor="new-order-customer-report-description"
              className="text-[10.5px] font-semibold leading-4 text-muted-foreground sm:text-[11px]"
            >
              客户描述的故障现象
            </Label>
            <div className="relative">
              <Textarea
                id="new-order-customer-report-description"
                data-new-order-field="issue-description"
                value={form.issue}
                onChange={(event) =>
                  setForm((current) => ({ ...current, issue: event.target.value }))
                }
                rows={4}
                maxLength={200}
                className="min-h-[108px] resize-none rounded-xl bg-[var(--surface-panel-muted)] px-2.5 pb-5 pt-2 text-base leading-5 placeholder:text-[13px] placeholder:text-muted-foreground/45 md:text-sm"
                placeholder="例如：掉电很快、屏幕不显示、无法充电..."
                aria-describedby="new-order-customer-report-count"
                autoFocus
              />
              <span
                id="new-order-customer-report-count"
                className="pointer-events-none absolute bottom-1.5 right-2 text-[9px] leading-3 text-muted-foreground"
              >
                {issueLength}/200
              </span>
            </div>
          </div>
        )}
      </div>

      <DialogFooter className="hidden sm:flex">
        <Button type="button" onClick={onDone}>
          完成
        </Button>
      </DialogFooter>
      <SheetFooter className="sm:hidden">
        <Button type="button" className="w-full" onClick={onDone}>
          完成
        </Button>
      </SheetFooter>
    </div>
  );
}
