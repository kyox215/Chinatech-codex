"use client";

import type { Dispatch, SetStateAction } from "react";
import { Plus, ReceiptText, Trash2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { FormItem, MoneyRow } from "@/features/orders/forms/new-order-fields";
import { warrantyOptions, type NewOrderFormState } from "@/features/orders/model/new-order-form";
import { repairOrderType, statusMeta } from "@/lib/mock/enums";
import { ORDER_STATUS_ALLOWED_FOR_CREATE, normalizeInitialOrderStatus } from "@/lib/mock/workflow";
import type { FaultPriceItem } from "@/lib/repairdesk/api";
import { cn } from "@/lib/utils";

export function NewOrderQuotationSection({
  form,
  setForm,
  total,
  balance,
  technicianOptions,
  onPatchFault,
  onAddCustomFault,
}: {
  form: NewOrderFormState;
  setForm: Dispatch<SetStateAction<NewOrderFormState>>;
  total: number;
  balance: number;
  technicianOptions: string[];
  onPatchFault: (index: number, patch: Partial<FaultPriceItem>) => void;
  onAddCustomFault: () => void;
}) {
  return (
    <Card className="h-fit border-border/70 p-4 shadow-sm">
      <div className="mb-4 flex items-center gap-3">
        <ReceiptText className="size-5 text-muted-foreground" />
        <h2 className="text-xl font-semibold">报价 & 服务</h2>
      </div>

      <div>
        <div className="mb-3 text-sm font-medium text-muted-foreground">按项报价</div>
        <div className="space-y-3">
          {form.faults.length === 0 ? (
            <div className="rounded-lg border border-dashed border-border/70 bg-surface-muted/40 p-5 text-sm text-muted-foreground">
              从左侧故障诊断选择项目后，可在这里输入价格。
            </div>
          ) : (
            form.faults.map((item, index) => (
              <div key={item.key} className="grid gap-2 rounded-lg border p-3">
                <div className="flex items-center justify-between gap-2">
                  {item.categoryKey === "custom" ? (
                    <Input
                      value={item.name}
                      onChange={(event) => onPatchFault(index, { name: event.target.value })}
                      placeholder="自定义项目名称"
                    />
                  ) : (
                    <div className="min-w-0">
                      <div className="truncate text-sm font-medium">{item.name}</div>
                      <div className="truncate text-xs text-muted-foreground">{item.note}</div>
                    </div>
                  )}
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    className="size-8 shrink-0"
                    onClick={() =>
                      setForm({
                        ...form,
                        faults: form.faults.filter((_, faultIndex) => faultIndex !== index),
                      })
                    }
                    aria-label="删除报价项目"
                  >
                    <Trash2 className="size-4 text-muted-foreground" />
                  </Button>
                </div>
                <div className="relative">
                  <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-sm text-muted-foreground">
                    €
                  </span>
                  <Input
                    type="number"
                    min={0}
                    step="0.01"
                    value={item.price}
                    onChange={(event) => onPatchFault(index, { price: Number(event.target.value) })}
                    className="pl-8 font-mono"
                    placeholder="0"
                  />
                </div>
              </div>
            ))
          )}
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="gap-1.5"
            onClick={onAddCustomFault}
          >
            <Plus className="size-3.5" /> 添加自定义项目
          </Button>
        </div>
      </div>

      <div className="my-5 border-t border-border/70" />

      <div className="space-y-4">
        <MoneyRow label="订单总金额" value={total} strong />
        <FormItem label="定金">
          <div className="relative">
            <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-sm text-muted-foreground">
              €
            </span>
            <Input
              type="number"
              min={0}
              step="0.01"
              value={form.deposit}
              onChange={(event) => setForm({ ...form, deposit: Number(event.target.value) })}
              className="pl-8 font-mono"
            />
          </div>
        </FormItem>
        <MoneyRow label="应收金额" value={balance} strong />
        <p className="text-xs text-muted-foreground">保存时由服务端按总金额与定金自动写入余额。</p>

        <div className="grid gap-3 sm:grid-cols-2">
          <FormItem label="技术员" required>
            <Select
              value={form.technician}
              onValueChange={(technician) => setForm({ ...form, technician })}
            >
              <SelectTrigger>
                <SelectValue placeholder="可选" />
              </SelectTrigger>
              <SelectContent>
                {technicianOptions.map((technician) => (
                  <SelectItem key={technician} value={technician}>
                    {technician}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </FormItem>
          <FormItem label="保修">
            <Select
              value={form.warrantyText}
              onValueChange={(warrantyText) => setForm({ ...form, warrantyText })}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {warrantyOptions.map((warranty) => (
                  <SelectItem key={warranty} value={warranty}>
                    {warranty}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </FormItem>
        </div>

        <div className="grid gap-3 sm:grid-cols-2">
          <FormItem label="优先标签">
            <Select
              value={form.internalTag || "none"}
              onValueChange={(internalTag) =>
                setForm({ ...form, internalTag: internalTag === "none" ? "" : internalTag })
              }
            >
              <SelectTrigger>
                <SelectValue placeholder="无" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="none">无</SelectItem>
                <SelectItem value="VIP">VIP</SelectItem>
                <SelectItem value="加急">加急</SelectItem>
              </SelectContent>
            </Select>
          </FormItem>
          <FormItem label="客户留存备注">
            <Input
              value={form.accessoryNotes}
              onChange={(event) => setForm({ ...form, accessoryNotes: event.target.value })}
              placeholder="如：SIM卡托、手机壳、充电器"
            />
          </FormItem>
        </div>

        <div className="grid gap-2">
          <div className="text-xs font-medium text-muted-foreground">工单类型</div>
          <div className="grid grid-cols-2 gap-2">
            {repairOrderType.map((type) => (
              <button
                key={type}
                type="button"
                onClick={() => setForm({ ...form, type })}
                className={cn(
                  "rounded-lg border px-3 py-2 text-sm transition-colors",
                  form.type === type
                    ? "border-primary bg-primary/10 text-primary"
                    : "bg-surface hover:bg-accent",
                )}
              >
                {type === "quick_repair" ? "快修" : "送修"}
              </button>
            ))}
          </div>
        </div>

        <FormItem label="初始状态">
          <Select
            value={form.status}
            onValueChange={(value) =>
              setForm({ ...form, status: normalizeInitialOrderStatus(value) })
            }
          >
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {ORDER_STATUS_ALLOWED_FOR_CREATE.map((status) => (
                <SelectItem key={status} value={status}>
                  {statusMeta[status].label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </FormItem>
      </div>
    </Card>
  );
}
