"use client";

import { useEffect, useMemo, useState } from "react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import {
  emptyStatusEditorValue,
  getStatusEditorError,
  OrderWorkflowStatusForm,
  statusEditorValueFromStatus,
  type StatusEditorValue,
} from "@/features/settings/components/order-workflow-status-form";
import type {
  OrderWorkflowStatus,
  OrderWorkflowStatusCreateInput,
  OrderWorkflowStatusUpdateInput,
} from "@/lib/repairdesk/types";

export interface OrderWorkflowStatusSheetProps {
  open: boolean;
  status?: OrderWorkflowStatus;
  existingCodes: readonly string[];
  onOpenChange: (open: boolean) => void;
  onRestoreFocus: () => void;
  onCreate: (input: OrderWorkflowStatusCreateInput) => void;
  onUpdate: (id: string, input: OrderWorkflowStatusUpdateInput) => void;
}

export function OrderWorkflowStatusSheet({
  open,
  status,
  existingCodes,
  onOpenChange,
  onRestoreFocus,
  onCreate,
  onUpdate,
}: OrderWorkflowStatusSheetProps) {
  const [value, setValue] = useState<StatusEditorValue>(emptyStatusEditorValue);
  const isNew = !status;

  useEffect(() => {
    if (!open) return;
    setValue(status ? statusEditorValueFromStatus(status) : emptyStatusEditorValue);
  }, [open, status]);

  const fieldError = useMemo(
    () => getStatusEditorError(value, isNew, existingCodes),
    [existingCodes, isNew, value],
  );

  const commit = () => {
    if (fieldError) return;
    if (status) {
      onUpdate(status.id, {
        label: value.label.trim(),
        short_label: value.shortLabel.trim(),
        tone: value.tone,
        bucket: status.is_system ? status.bucket : value.bucket,
        enabled: status.is_system || value.isDefault ? true : value.enabled,
        show_in_order_filters: value.showInFilters,
        allowed_for_create: value.isDefault ? true : value.allowedForCreate,
        is_default_create_status: value.isDefault,
      });
    } else {
      onCreate({
        code: value.code.trim(),
        label: value.label.trim(),
        short_label: value.shortLabel.trim(),
        tone: value.tone,
        bucket: value.bucket,
        enabled: value.isDefault ? true : value.enabled,
        show_in_order_filters: value.showInFilters,
        allowed_for_create: value.isDefault ? true : value.allowedForCreate,
        is_default_create_status: value.isDefault,
      });
    }
    onOpenChange(false);
  };

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        side="right"
        className="flex h-full w-[min(30rem,calc(100vw-12px))] max-w-none flex-col p-0 sm:w-[min(30rem,calc(100vw-24px))]"
        onCloseAutoFocus={(event) => {
          event.preventDefault();
          onRestoreFocus();
        }}
      >
        <SheetHeader className="border-b border-[var(--border-panel)] px-4 pb-4 pt-5 pr-16 text-left sm:px-5">
          <div className="flex flex-wrap items-center gap-2">
            <SheetTitle>{isNew ? "新增状态草稿" : `编辑「${status.label}」`}</SheetTitle>
            {status?.is_system ? <Badge variant="outline">系统状态</Badge> : null}
          </div>
          <SheetDescription>
            修改只保存在当前店铺的本地草稿中，关闭编辑器不会发送网络请求。
          </SheetDescription>
        </SheetHeader>

        <div className="min-h-0 flex-1 space-y-5 overflow-y-auto px-4 py-5 sm:px-5">
          <OrderWorkflowStatusForm
            value={value}
            setValue={setValue}
            status={status}
            isNew={isNew}
            fieldError={fieldError}
          />
        </div>

        <SheetFooter className="gap-2 border-t border-[var(--border-panel)] bg-card px-4 py-4 sm:px-5">
          <Button
            type="button"
            variant="outline"
            className="min-h-11"
            onClick={() => onOpenChange(false)}
          >
            取消
          </Button>
          <Button
            type="button"
            className="min-h-11"
            disabled={Boolean(fieldError)}
            onClick={commit}
          >
            {isNew ? "加入本地草稿" : "完成编辑"}
          </Button>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  );
}
