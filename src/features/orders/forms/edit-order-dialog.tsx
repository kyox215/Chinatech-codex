"use client";

import { useEffect, useMemo, useState } from "react";
import { Plus, Trash2 } from "lucide-react";

import { ImeiScannerField } from "@/components/imei-scanner-field";
import {
  FaultDiagnosisPicker,
  normalizeFaultPrices,
  toFaultPriceItems,
} from "@/components/orders/fault-diagnosis-picker";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { EditField } from "@/features/orders/forms/edit-field";
import { buildEditForm, inferOrderPaidAmount } from "@/features/orders/model/edit-order-form";
import { formatMoney } from "@/lib/money";
import type { FaultPriceItem, OrderDetail, UpdateOrderInput } from "@/lib/repairdesk/api";

export function EditOrderDialog({
  open,
  onOpenChange,
  data,
  busy,
  onSave,
}: {
  open: boolean;
  onOpenChange: (value: boolean) => void;
  data: OrderDetail;
  busy: boolean;
  onSave: (input: UpdateOrderInput) => Promise<unknown>;
}) {
  const [form, setForm] = useState<UpdateOrderInput>(() => buildEditForm(data));

  useEffect(() => {
    if (open) setForm(buildEditForm(data));
  }, [data, open]);

  const quotation = useMemo(
    () => form.fault_prices.reduce((sum, item) => sum + (Number(item.price) || 0), 0),
    [form.fault_prices],
  );
  const selectedFaults = useMemo(
    () => normalizeFaultPrices(form.fault_prices),
    [form.fault_prices],
  );
  const paidAmount = inferOrderPaidAmount(data.order);
  const nextBalance = Math.max(0, quotation - Number(form.deposit_amount ?? 0) - paidAmount);
  const canSave =
    form.customer_name.trim() &&
    form.customer_phone.trim() &&
    form.device_brand.trim() &&
    form.device_model.trim() &&
    form.issue_description.trim() &&
    form.technician_name.trim() &&
    Number(form.deposit_amount ?? 0) <= quotation;

  const patchFault = (index: number, patch: Partial<FaultPriceItem>) => {
    const next = [...form.fault_prices];
    next[index] = { ...next[index], ...patch };
    setForm({ ...form, fault_prices: next });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] max-w-3xl overflow-y-auto">
        <DialogHeader>
          <DialogTitle>编辑工单</DialogTitle>
          <DialogDescription>
            编辑客户档案和当前工单快照；设备档案请在客户详情页维护。
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="rounded-md border p-3">
            <h4 className="mb-3 text-sm font-semibold">客户信息</h4>
            <div className="grid gap-3 sm:grid-cols-2">
              <EditField label="客户姓名" required>
                <Input
                  value={form.customer_name}
                  onChange={(event) => setForm({ ...form, customer_name: event.target.value })}
                />
              </EditField>
              <EditField label="手机号" required>
                <Input
                  value={form.customer_phone}
                  onChange={(event) => setForm({ ...form, customer_phone: event.target.value })}
                  className="font-mono"
                />
              </EditField>
            </div>
          </div>

          <div className="rounded-md border p-3">
            <h4 className="mb-3 text-sm font-semibold">设备信息</h4>
            <div className="grid gap-3 sm:grid-cols-2">
              <EditField label="品牌" required>
                <Input
                  value={form.device_brand}
                  onChange={(event) => setForm({ ...form, device_brand: event.target.value })}
                />
              </EditField>
              <EditField label="型号" required>
                <Input
                  value={form.device_model}
                  onChange={(event) => setForm({ ...form, device_model: event.target.value })}
                />
              </EditField>
              <EditField label="IMEI / 序列号">
                <ImeiScannerField
                  value={form.device_imei ?? ""}
                  onChange={(device_imei) => setForm({ ...form, device_imei })}
                  placeholder="支持摄像头扫码"
                />
              </EditField>
              <EditField label="设备备注">
                <Input
                  value={form.device_notes ?? ""}
                  onChange={(event) => setForm({ ...form, device_notes: event.target.value })}
                />
              </EditField>
            </div>
          </div>

          <div className="rounded-md border p-3">
            <h4 className="mb-3 text-sm font-semibold">故障与诊断</h4>
            <div className="space-y-3">
              <div>
                <div className="mb-2 text-xs text-muted-foreground">维修故障选项</div>
                <FaultDiagnosisPicker
                  selected={selectedFaults}
                  onChange={(faults) =>
                    setForm({ ...form, fault_prices: toFaultPriceItems(faults) })
                  }
                />
              </div>
              <EditField label="故障描述" required>
                <Textarea
                  rows={3}
                  value={form.issue_description}
                  onChange={(event) => setForm({ ...form, issue_description: event.target.value })}
                />
              </EditField>
              <EditField label="诊断结果">
                <Textarea
                  rows={3}
                  value={form.diagnosis_result ?? ""}
                  onChange={(event) => setForm({ ...form, diagnosis_result: event.target.value })}
                />
              </EditField>
              <div className="grid gap-3 sm:grid-cols-3">
                <EditField label="技师" required>
                  <Input
                    value={form.technician_name}
                    onChange={(event) => setForm({ ...form, technician_name: event.target.value })}
                  />
                </EditField>
                <EditField label="内部标签">
                  <Input
                    value={form.internal_tag ?? ""}
                    onChange={(event) => setForm({ ...form, internal_tag: event.target.value })}
                  />
                </EditField>
                <EditField label="质保">
                  <Input
                    value={form.warranty_text ?? ""}
                    onChange={(event) => setForm({ ...form, warranty_text: event.target.value })}
                  />
                </EditField>
              </div>
            </div>
          </div>

          <div className="rounded-md border p-3">
            <div className="mb-3 flex items-center justify-between gap-3">
              <h4 className="text-sm font-semibold">报价与押金</h4>
              <span className="text-xs text-muted-foreground">报价 {formatMoney(quotation)}</span>
            </div>
            <div className="space-y-2">
              {form.fault_prices.map((item, index) => (
                <div
                  key={index}
                  className="grid gap-2 sm:grid-cols-[minmax(0,1fr)_120px_minmax(0,1fr)_36px]"
                >
                  <Input
                    value={item.name}
                    onChange={(event) => patchFault(index, { name: event.target.value })}
                    placeholder="项目"
                  />
                  <Input
                    type="number"
                    min={0}
                    value={item.price}
                    onChange={(event) => patchFault(index, { price: Number(event.target.value) })}
                    className="font-mono"
                    placeholder="金额"
                  />
                  <Input
                    value={item.note ?? ""}
                    onChange={(event) => patchFault(index, { note: event.target.value })}
                    placeholder="备注"
                  />
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    disabled={form.fault_prices.length === 1}
                    onClick={() =>
                      setForm({
                        ...form,
                        fault_prices: form.fault_prices.filter(
                          (_, itemIndex) => itemIndex !== index,
                        ),
                      })
                    }
                    aria-label="删除报价项目"
                  >
                    <Trash2 className="size-4 text-muted-foreground" />
                  </Button>
                </div>
              ))}
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="gap-1.5"
                onClick={() =>
                  setForm({
                    ...form,
                    fault_prices: [...form.fault_prices, { name: "", price: 0 }],
                  })
                }
              >
                <Plus className="size-3.5" /> 添加项目
              </Button>
            </div>
            <div className="mt-3 grid gap-3 sm:grid-cols-3">
              <EditField label="押金">
                <Input
                  type="number"
                  min={0}
                  value={form.deposit_amount ?? 0}
                  onChange={(event) =>
                    setForm({ ...form, deposit_amount: Number(event.target.value) })
                  }
                  className="font-mono"
                />
              </EditField>
              <EditField label="已付金额">
                <Input
                  value={paidAmount.toString()}
                  readOnly
                  className="bg-surface-muted font-mono"
                />
              </EditField>
              <EditField label="新尾款">
                <Input
                  value={nextBalance.toString()}
                  readOnly
                  className="bg-surface-muted font-mono"
                />
              </EditField>
            </div>
            {Number(form.deposit_amount ?? 0) > quotation && (
              <p className="mt-2 text-xs text-destructive">押金不能超过总报价。</p>
            )}
          </div>
        </div>

        <DialogFooter>
          <Button variant="ghost" onClick={() => onOpenChange(false)}>
            取消
          </Button>
          <Button
            disabled={busy || !canSave}
            onClick={() =>
              onSave({
                ...form,
                fault_prices: form.fault_prices.filter(
                  (item) => item.name.trim() && Number(item.price) > 0,
                ),
              })
            }
          >
            {busy ? "保存中…" : "保存修改"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
