"use client";

import { motion } from "framer-motion";
import { CheckCircle2, CreditCard, Pencil, Phone, Send, Signature } from "lucide-react";

import { ApprovalBadge, MoneyText, PhoneText } from "@/components/orders/badges";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { fadeUp } from "@/lib/motion";
import type { Customer, OrderDetail, Supplier } from "@/lib/repairdesk/types";
import { cn } from "@/lib/utils";

export function OrderOverviewTab({
  order,
  customer,
  supplier,
  deviceLabel,
  deviceImei,
  deviceNotes,
  accessoryNotes,
  onEdit,
  onApproval,
  onPay,
}: {
  order: OrderDetail["order"];
  customer?: Customer;
  supplier?: Supplier;
  deviceLabel: string;
  deviceImei: string;
  deviceNotes?: string;
  accessoryNotes?: string;
  onEdit: () => void;
  onApproval: () => void;
  onPay: () => void;
}) {
  return (
    <>
      <motion.div variants={fadeUp}>
        <Card className="p-5">
          <div className="mb-3 flex items-center justify-between">
            <h3 className="text-sm font-semibold">客户与设备</h3>
            <Button
              variant="ghost"
              size="sm"
              className="h-7 gap-1 text-xs"
              onClick={() => onEdit()}
            >
              <Pencil className="size-3" /> 编辑
            </Button>
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <div className="text-xs text-muted-foreground">客户</div>
              <div className="mt-1 text-sm font-medium">{customer?.name}</div>
              <div className="mt-1 flex items-center gap-1.5 text-muted-foreground">
                <Phone className="size-3" />
                <PhoneText value={customer?.phone_e164 ?? ""} />
              </div>
              {!!order.contact_phones.length && (
                <div className="mt-2 flex flex-wrap gap-1">
                  {order.contact_phones.map((p) => (
                    <span
                      key={p}
                      className="rounded border bg-surface-muted px-1.5 py-0.5 font-mono text-[11px]"
                    >
                      {p}
                    </span>
                  ))}
                </div>
              )}
            </div>
            <div>
              <div className="text-xs text-muted-foreground">设备</div>
              <div className="mt-1 text-sm font-medium">{deviceLabel}</div>
              <div className="mt-1 font-mono text-xs text-muted-foreground">
                IMEI {deviceImei || "-"}
              </div>
              {deviceNotes && (
                <div className="mt-1 text-xs text-muted-foreground">设备备注：{deviceNotes}</div>
              )}
              {accessoryNotes && (
                <div className="mt-1 text-xs text-muted-foreground">留存备注：{accessoryNotes}</div>
              )}
            </div>
          </div>
        </Card>
      </motion.div>

      <motion.div variants={fadeUp}>
        <Card className="p-5">
          <div className="mb-3 flex items-center justify-between">
            <h3 className="text-sm font-semibold">故障与诊断</h3>
            <Button
              variant="ghost"
              size="sm"
              className="h-7 gap-1 text-xs"
              onClick={() => onEdit()}
            >
              <Pencil className="size-3" /> 编辑
            </Button>
          </div>
          <div className="space-y-3 text-sm">
            <Field label="故障描述">{order.issue_description}</Field>
            <Field label="诊断结果">
              {order.diagnosis_result ?? <span className="text-muted-foreground">尚未填写</span>}
            </Field>
            <div className="flex flex-wrap gap-4 text-xs">
              {order.internal_tag && <Field label="优先标签">{order.internal_tag}</Field>}
              {order.warranty_text && <Field label="质保">{order.warranty_text}</Field>}
            </div>
          </div>
        </Card>
      </motion.div>

      <motion.div variants={fadeUp}>
        <Card className="p-5">
          <div className="mb-3 flex items-center justify-between">
            <h3 className="text-sm font-semibold">报价与财务</h3>
            <ApprovalBadge status={order.approval_status} />
          </div>
          <table className="w-full text-sm">
            <thead className="text-xs text-muted-foreground">
              <tr className="border-b border-border/40">
                <th className="py-2 text-left font-medium">项目</th>
                <th className="py-2 text-right font-medium">金额</th>
                <th className="py-2 text-left font-medium">备注</th>
              </tr>
            </thead>
            <tbody>
              {order.fault_prices.map((f, i) => (
                <tr key={i} className="border-b border-border/30 last:border-0">
                  <td className="py-2">{f.name}</td>
                  <td className="py-2 text-right">
                    <MoneyText amount={f.price} />
                  </td>
                  <td className="py-2 text-xs text-muted-foreground">{f.note}</td>
                </tr>
              ))}
            </tbody>
          </table>
          <Separator className="my-3" />
          <div className="grid grid-cols-2 gap-3 text-sm sm:grid-cols-4">
            <Field label="总报价">
              <MoneyText amount={order.quotation_amount} className="font-semibold" />
            </Field>
            <Field label="押金">
              <MoneyText amount={order.deposit_amount} />
            </Field>
            <Field label="尾款">
              <MoneyText amount={order.balance_amount} />
            </Field>
            <Field label="结清状态">
              {order.is_paid ? (
                <span className="inline-flex items-center gap-1 text-status-success-foreground">
                  <CheckCircle2 className="size-3.5" /> 已结清
                </span>
              ) : (
                <span className="text-muted-foreground">未结清</span>
              )}
            </Field>
          </div>
          <div className="mt-4 flex flex-wrap gap-2">
            <Button size="sm" variant="outline" className="gap-1.5" onClick={() => onApproval()}>
              <Send className="size-3.5" /> 发送审批
            </Button>
            <Button
              size="sm"
              variant="outline"
              className="gap-1.5"
              disabled={order.is_paid || order.balance_amount <= 0}
              onClick={() => onPay()}
            >
              <CreditCard className="size-3.5" /> 收款
            </Button>
          </div>
        </Card>
      </motion.div>

      <motion.div variants={fadeUp}>
        <Card className="p-5">
          <div className="mb-3 flex items-center justify-between">
            <h3 className="text-sm font-semibold">客户签名</h3>
            <Button variant="outline" size="sm" className="h-7 gap-1 text-xs">
              <Signature className="size-3" />
              {order.customer_signature ? "重新签名" : "请客户签名"}
            </Button>
          </div>
          <div
            className={cn(
              "flex h-32 items-center justify-center rounded-md border border-dashed text-xs text-muted-foreground",
              order.customer_signature && "bg-surface-muted",
            )}
          >
            {order.customer_signature ? "签名已采集" : "尚未签名"}
          </div>
        </Card>
      </motion.div>

      <motion.div variants={fadeUp}>
        <Card className="p-5">
          <h3 className="mb-3 text-sm font-semibold">关键信息</h3>
          <dl className="grid gap-2 text-xs sm:grid-cols-2">
            <Row label="创建时间" value={new Date(order.created_at).toLocaleString("zh-CN")} />
            <Row
              label="完成时间"
              value={
                order.completed_at ? new Date(order.completed_at).toLocaleString("zh-CN") : "—"
              }
            />
            <Row
              label="交付时间"
              value={
                order.delivered_at ? new Date(order.delivered_at).toLocaleString("zh-CN") : "—"
              }
            />
            <Row label="技师" value={order.technician_name} />
            {supplier && (
              <Row
                label="外修供应商"
                value={
                  <span className="inline-flex items-center gap-1.5">
                    <span className="size-2 rounded-full" style={{ background: supplier.color }} />
                    {supplier.name}
                  </span>
                }
              />
            )}
            {order.cancel_reason && <Row label="取消原因" value={order.cancel_reason} />}
          </dl>
        </Card>
      </motion.div>
    </>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <div className="text-xs text-muted-foreground">{label}</div>
      <div className="mt-0.5 text-sm">{children}</div>
    </div>
  );
}

function Row({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between gap-2 rounded-md bg-surface-muted/30 px-2 py-1.5">
      <dt className="text-muted-foreground">{label}</dt>
      <dd className="text-right text-foreground">{value}</dd>
    </div>
  );
}
