"use client";

import type { Dispatch, ReactNode, SetStateAction } from "react";

import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  orderWorkflowBucketOptions,
  orderWorkflowToneOptions,
} from "@/features/settings/model/order-workflow-draft-review";
import type {
  OrderWorkflowBucket,
  OrderWorkflowStatus,
  OrderWorkflowTone,
} from "@/lib/repairdesk/types";

export type StatusEditorValue = {
  code: string;
  label: string;
  shortLabel: string;
  tone: OrderWorkflowTone;
  bucket: OrderWorkflowBucket;
  enabled: boolean;
  showInFilters: boolean;
  allowedForCreate: boolean;
  isDefault: boolean;
};

export const emptyStatusEditorValue: StatusEditorValue = {
  code: "",
  label: "",
  shortLabel: "",
  tone: "neutral",
  bucket: "custom",
  enabled: true,
  showInFilters: true,
  allowedForCreate: false,
  isDefault: false,
};

const statusCodePattern = /^[a-z][a-z0-9_]{1,47}$/;

export function getStatusEditorError(
  value: StatusEditorValue,
  isNew: boolean,
  existingCodes: readonly string[] = [],
) {
  if (!value.label.trim()) return "请填写状态名称";
  if (value.label.trim().length > 24) return "状态名称不能超过 24 个字符";
  if (value.shortLabel.trim().length > 8) return "短标签不能超过 8 个字符";
  if (isNew && !statusCodePattern.test(value.code.trim())) {
    return "代码需以小写字母开头，只能包含小写字母、数字和下划线（2–48 位）";
  }
  if (isNew && existingCodes.includes(value.code.trim())) return "状态代码已存在";
  return "";
}

export function statusEditorValueFromStatus(status: OrderWorkflowStatus): StatusEditorValue {
  return {
    code: status.code,
    label: status.label,
    shortLabel: status.short_label,
    tone: status.tone,
    bucket: status.bucket,
    enabled: status.enabled,
    showInFilters: status.show_in_order_filters,
    allowedForCreate: status.allowed_for_create,
    isDefault: status.is_default_create_status,
  };
}

export function OrderWorkflowStatusForm({
  value,
  setValue,
  status,
  isNew,
  fieldError,
}: {
  value: StatusEditorValue;
  setValue: Dispatch<SetStateAction<StatusEditorValue>>;
  status?: OrderWorkflowStatus;
  isNew: boolean;
  fieldError: string;
}) {
  return (
    <>
      {isNew ? (
        <div className="rounded-lg border border-status-warn-foreground/25 bg-status-warn px-3 py-2 text-xs leading-5 text-status-warn-foreground">
          自定义状态尚未绑定主流程语义，本阶段可加入草稿进行设计，但不能应用到真实工单。
        </div>
      ) : null}

      <div className="grid gap-4 sm:grid-cols-2">
        {isNew ? (
          <EditorField label="状态代码" htmlFor="workflow-status-code" className="sm:col-span-2">
            <Input
              id="workflow-status-code"
              autoCapitalize="none"
              autoCorrect="off"
              maxLength={48}
              className="h-[38px] min-h-11 font-mono text-base sm:min-h-10 sm:text-sm"
              value={value.code}
              onChange={(event) =>
                setValue((current) => ({
                  ...current,
                  code: event.target.value.toLowerCase().replace(/[^a-z0-9_]/g, ""),
                }))
              }
              placeholder="waiting_vendor"
            />
          </EditorField>
        ) : (
          <div className="sm:col-span-2">
            <p className="text-xs font-medium text-muted-foreground">状态代码</p>
            <code className="mt-1.5 block rounded-lg bg-surface-muted px-3 py-2 text-sm">
              {status?.code}
            </code>
          </div>
        )}

        <EditorField label="状态名称" htmlFor="workflow-status-label">
          <Input
            id="workflow-status-label"
            maxLength={24}
            className="h-[38px] min-h-11 text-base sm:min-h-10 sm:text-sm"
            value={value.label}
            onChange={(event) => setValue((current) => ({ ...current, label: event.target.value }))}
            placeholder="等待供应商"
          />
        </EditorField>
        <EditorField label="短标签" htmlFor="workflow-status-short-label">
          <Input
            id="workflow-status-short-label"
            maxLength={8}
            className="h-[38px] min-h-11 text-base sm:min-h-10 sm:text-sm"
            value={value.shortLabel}
            onChange={(event) =>
              setValue((current) => ({ ...current, shortLabel: event.target.value }))
            }
            placeholder="等供货"
          />
        </EditorField>

        <EditorField label="主流程分组" htmlFor="workflow-status-bucket">
          {status?.is_system ? (
            <div className="flex min-h-[38px] items-center rounded-md border border-input bg-surface-muted px-3 text-sm text-muted-foreground">
              {orderWorkflowBucketOptions.find((item) => item.value === status.bucket)?.label}
            </div>
          ) : (
            <Select
              value={value.bucket}
              onValueChange={(bucket) =>
                setValue((current) => ({ ...current, bucket: bucket as OrderWorkflowBucket }))
              }
            >
              <SelectTrigger
                id="workflow-status-bucket"
                className="h-[38px] min-h-11 text-base sm:min-h-10 sm:text-sm"
              >
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {orderWorkflowBucketOptions.map((option) => (
                  <SelectItem key={option.value} value={option.value}>
                    {option.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}
        </EditorField>
        <EditorField label="语义色" htmlFor="workflow-status-tone">
          <Select
            value={value.tone}
            onValueChange={(tone) =>
              setValue((current) => ({ ...current, tone: tone as OrderWorkflowTone }))
            }
          >
            <SelectTrigger
              id="workflow-status-tone"
              className="h-[38px] min-h-11 text-base sm:min-h-10 sm:text-sm"
            >
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {orderWorkflowToneOptions.map((option) => (
                <SelectItem key={option.value} value={option.value}>
                  {option.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </EditorField>
      </div>

      <div className="space-y-2" aria-label="状态可用范围">
        <BooleanRow
          label="启用状态"
          description={
            status?.is_system
              ? "系统状态在当前安全阶段保持启用。"
              : "停用后不应再作为工单目标状态。"
          }
          checked={status?.is_system ? true : value.enabled}
          disabled={Boolean(status?.is_system || value.isDefault)}
          onChange={(checked) => setValue((current) => ({ ...current, enabled: checked }))}
        />
        <BooleanRow
          label="显示在列表筛选"
          description="控制工单列表中的状态筛选入口。"
          checked={value.showInFilters}
          onChange={(checked) => setValue((current) => ({ ...current, showInFilters: checked }))}
        />
        <BooleanRow
          label="允许用于新建工单"
          description="默认状态会自动保持此项开启。"
          checked={value.isDefault ? true : value.allowedForCreate}
          disabled={value.isDefault}
          onChange={(checked) => setValue((current) => ({ ...current, allowedForCreate: checked }))}
        />
        <BooleanRow
          label="设为默认新建状态"
          description="每个店铺必须且只能有一个默认状态。"
          checked={value.isDefault}
          onChange={(checked) =>
            setValue((current) => ({
              ...current,
              isDefault: checked,
              enabled: checked ? true : current.enabled,
              allowedForCreate: checked ? true : current.allowedForCreate,
            }))
          }
        />
      </div>

      {fieldError ? (
        <p role="alert" className="text-sm text-status-danger-foreground">
          {fieldError}
        </p>
      ) : null}
    </>
  );
}

function EditorField({
  label,
  htmlFor,
  className,
  children,
}: {
  label: string;
  htmlFor: string;
  className?: string;
  children: ReactNode;
}) {
  return (
    <div className={className}>
      <Label htmlFor={htmlFor} className="mb-1.5 block text-xs">
        {label}
      </Label>
      {children}
    </div>
  );
}

function BooleanRow({
  label,
  description,
  checked,
  disabled,
  onChange,
}: {
  label: string;
  description: string;
  checked: boolean;
  disabled?: boolean;
  onChange: (checked: boolean) => void;
}) {
  return (
    <label className="flex min-h-14 cursor-pointer items-start gap-3 rounded-lg border border-[var(--border-panel)] bg-card px-3 py-3 has-[:disabled]:cursor-default">
      <Checkbox
        checked={checked}
        disabled={disabled}
        className="mt-0.5 size-5"
        onCheckedChange={(next) => onChange(Boolean(next))}
      />
      <span className="min-w-0">
        <span className="block text-sm font-medium">{label}</span>
        <span className="mt-0.5 block text-xs leading-5 text-muted-foreground">{description}</span>
      </span>
    </label>
  );
}
