import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ArrowLeft, Check, Plus, Trash2, UserSearch } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Card } from "@/components/ui/card";
import { toast } from "sonner";
import {
  createOrder,
  getCustomerDevices,
  getRepairDeskOptions,
  searchCustomers,
} from "@/lib/repairdesk/api";
import { repairOrderType, statusMeta } from "@/lib/mock/enums";
import { ORDER_STATUS_ALLOWED_FOR_CREATE, normalizeInitialOrderStatus } from "@/lib/mock/workflow";
import type { Customer, FaultPriceItem } from "@/lib/repairdesk/api";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/orders/new")({
  head: () => ({
    meta: [
      { title: "新建工单 — RepairDesk" },
      { name: "description", content: "录入新工单：客户、设备、故障与报价" },
    ],
  }),
  component: NewOrderPage,
});

interface FormState {
  type: "quick_repair" | "dropoff_repair";
  status: ReturnType<typeof normalizeInitialOrderStatus>;
  customerId?: string;
  customerName: string;
  customerPhone: string;
  deviceId?: string;
  brand: string;
  model: string;
  imei: string;
  deviceNotes: string;
  issue: string;
  technician: string;
  internalTag: string;
  deposit: number;
  faults: FaultPriceItem[];
}

const initialForm: FormState = {
  type: "quick_repair",
  status: "new",
  customerName: "",
  customerPhone: "",
  brand: "",
  model: "",
  imei: "",
  deviceNotes: "",
  issue: "",
  technician: "",
  internalTag: "",
  deposit: 0,
  faults: [{ name: "", price: 0 }],
};

const fallbackTechnicians = ["陈师傅", "李工", "王师傅", "周工", "黄师傅"];

function NewOrderPage() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [form, setForm] = useState<FormState>(initialForm);
  const { data: options = { suppliers: [], technicians: [] } } = useQuery({
    queryKey: ["repairdesk-options"],
    queryFn: () => getRepairDeskOptions(),
  });
  const technicianOptions = options.technicians.length ? options.technicians : fallbackTechnicians;

  const total = useMemo(
    () => form.faults.reduce((s, f) => s + (Number(f.price) || 0), 0),
    [form.faults],
  );

  useEffect(() => {
    if (!form.technician && technicianOptions[0]) {
      setForm((current) =>
        current.technician ? current : { ...current, technician: technicianOptions[0] },
      );
    }
  }, [form.technician, technicianOptions]);

  const create = useMutation({
    mutationFn: () =>
      createOrder({
        order_type: form.type,
        status: form.status,
        customer_id: form.customerId,
        customer_name: form.customerName,
        customer_phone: form.customerPhone,
        device_id: form.deviceId,
        device_brand: form.brand,
        device_model: form.model,
        device_imei: form.imei,
        device_notes: form.deviceNotes || undefined,
        issue_description: form.issue,
        technician_name: form.technician,
        internal_tag: form.internalTag || undefined,
        fault_prices: form.faults.filter((f) => f.name && f.price > 0),
        deposit_amount: form.deposit,
      }),
    onSuccess: ({ id }) => {
      queryClient.invalidateQueries({ queryKey: ["orders"] });
      queryClient.invalidateQueries({ queryKey: ["order-stats"] });
      queryClient.invalidateQueries({ queryKey: ["repairdesk-options"] });
      toast.success("工单已创建");
      navigate({ to: "/orders/$id", params: { id } });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const valid =
    form.customerName.trim() &&
    form.customerPhone.trim() &&
    form.brand.trim() &&
    form.model.trim() &&
    form.issue.trim() &&
    form.technician.trim();

  return (
    <div className="mx-auto max-w-3xl px-3 py-4 sm:px-6">
      <div className="mb-4 flex items-center gap-2">
        <Button variant="ghost" size="sm" className="gap-1.5" asChild>
          <Link to="/orders">
            <ArrowLeft className="size-4" /> 返回
          </Link>
        </Button>
        <h1 className="text-lg font-semibold">新建工单</h1>
      </div>

      <form
        onSubmit={(e) => {
          e.preventDefault();
          if (!valid) {
            toast.error("请填写必填字段");
            return;
          }
          create.mutate();
        }}
        className="space-y-4 pb-24"
      >
        <Section title="客户信息" hint="可搜索已有客户自动带入设备">
          <CustomerSearch
            onPick={async (c) => {
              const devs = await getCustomerDevices(c.id);
              const d = devs[0];
              setForm((f) => ({
                ...f,
                customerId: c.id,
                customerName: c.name,
                customerPhone: c.phone_e164,
                deviceId: d?.id,
                brand: d?.brand ?? f.brand,
                model: d?.model ?? f.model,
                imei: d?.serial_or_imei ?? f.imei,
                deviceNotes: d?.device_notes ?? f.deviceNotes,
              }));
              toast.success(
                d ? `已带入 ${c.name} 的设备：${d.brand} ${d.model}` : `已选择客户 ${c.name}`,
              );
            }}
          />
          <Grid>
            <FormItem label="客户姓名" required>
              <Input
                value={form.customerName}
                onChange={(e) =>
                  setForm({ ...form, customerName: e.target.value, customerId: undefined })
                }
                placeholder="姓名"
                required
              />
            </FormItem>
            <FormItem label="手机号" required>
              <Input
                value={form.customerPhone}
                onChange={(e) =>
                  setForm({ ...form, customerPhone: e.target.value, customerId: undefined })
                }
                placeholder="+86 138 0000 0000"
                required
                className="font-mono"
              />
            </FormItem>
          </Grid>
        </Section>

        <Section title="设备信息">
          <Grid>
            <FormItem label="品牌" required>
              <Input
                value={form.brand}
                onChange={(e) => setForm({ ...form, brand: e.target.value, deviceId: undefined })}
                placeholder="例如 Apple"
                required
              />
            </FormItem>
            <FormItem label="型号" required>
              <Input
                value={form.model}
                onChange={(e) => setForm({ ...form, model: e.target.value, deviceId: undefined })}
                placeholder="例如 iPhone 15 Pro"
                required
              />
            </FormItem>
            <FormItem label="IMEI / 序列号">
              <Input
                value={form.imei}
                onChange={(e) => setForm({ ...form, imei: e.target.value })}
                placeholder="可选"
                className="font-mono"
              />
            </FormItem>
            <FormItem label="设备备注">
              <Input
                value={form.deviceNotes}
                onChange={(e) => setForm({ ...form, deviceNotes: e.target.value })}
                placeholder="外观、配件等"
              />
            </FormItem>
          </Grid>
        </Section>

        <Section title="故障与服务">
          <Grid>
            <FormItem label="工单类型" required>
              <div className="flex gap-2">
                {repairOrderType.map((t) => (
                  <button
                    key={t}
                    type="button"
                    onClick={() => setForm({ ...form, type: t })}
                    className={cn(
                      "flex-1 rounded-md border px-3 py-1.5 text-sm transition-colors",
                      form.type === t
                        ? "border-primary bg-primary/10 text-primary"
                        : "bg-surface hover:bg-accent",
                    )}
                  >
                    {t === "quick_repair" ? "快修" : "送修"}
                  </button>
                ))}
              </div>
            </FormItem>
            <FormItem label="初始状态" required>
              <Select
                value={form.status}
                onValueChange={(v) => setForm({ ...form, status: normalizeInitialOrderStatus(v) })}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {ORDER_STATUS_ALLOWED_FOR_CREATE.map((s) => (
                    <SelectItem key={s} value={s}>
                      {statusMeta[s].label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </FormItem>
          </Grid>
          <FormItem label="故障描述" required>
            <Textarea
              value={form.issue}
              onChange={(e) => setForm({ ...form, issue: e.target.value })}
              required
              rows={3}
              placeholder="客户描述的故障现象"
            />
          </FormItem>
          <Grid>
            <FormItem label="技师" required>
              <Select
                value={form.technician}
                onValueChange={(v) => setForm({ ...form, technician: v })}
              >
                <SelectTrigger>
                  <SelectValue placeholder="选择技师" />
                </SelectTrigger>
                <SelectContent>
                  {technicianOptions.map((t) => (
                    <SelectItem key={t} value={t}>
                      {t}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </FormItem>
            <FormItem label="内部标签">
              <Input
                value={form.internalTag}
                onChange={(e) => setForm({ ...form, internalTag: e.target.value })}
                placeholder="VIP / 加急 等"
              />
            </FormItem>
          </Grid>
        </Section>

        <Section title="报价明细" hint={`合计 ¥${total.toLocaleString("zh-CN")}`}>
          <div className="space-y-2">
            {form.faults.map((f, i) => (
              <div key={i} className="flex items-end gap-2">
                <div className="flex-1">
                  <Label className="text-[10px] uppercase text-muted-foreground">项目</Label>
                  <Input
                    value={f.name}
                    onChange={(e) => {
                      const arr = [...form.faults];
                      arr[i] = { ...arr[i], name: e.target.value };
                      setForm({ ...form, faults: arr });
                    }}
                    placeholder="例如 屏幕总成"
                  />
                </div>
                <div className="w-32">
                  <Label className="text-[10px] uppercase text-muted-foreground">金额</Label>
                  <Input
                    type="number"
                    min={0}
                    value={f.price}
                    onChange={(e) => {
                      const arr = [...form.faults];
                      arr[i] = { ...arr[i], price: Number(e.target.value) };
                      setForm({ ...form, faults: arr });
                    }}
                    className="font-mono"
                  />
                </div>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  className="size-9"
                  disabled={form.faults.length === 1}
                  onClick={() =>
                    setForm({
                      ...form,
                      faults: form.faults.filter((_, idx) => idx !== i),
                    })
                  }
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
              onClick={() => setForm({ ...form, faults: [...form.faults, { name: "", price: 0 }] })}
            >
              <Plus className="size-3.5" /> 添加项目
            </Button>
          </div>
          <Grid>
            <FormItem label="押金">
              <Input
                type="number"
                min={0}
                value={form.deposit}
                onChange={(e) => setForm({ ...form, deposit: Number(e.target.value) })}
                className="font-mono"
              />
            </FormItem>
            <FormItem label="尾款（自动）">
              <Input
                value={Math.max(0, total - form.deposit).toString()}
                readOnly
                className="font-mono bg-surface-muted"
              />
            </FormItem>
          </Grid>
        </Section>

        <div className="sticky bottom-0 -mx-3 flex flex-col-reverse gap-2 border-t bg-background/80 px-3 py-3 backdrop-blur sm:-mx-6 sm:flex-row sm:justify-between sm:px-6">
          <div className="text-xs text-muted-foreground">
            合计{" "}
            <span className="font-display text-base font-semibold text-foreground">
              ¥{total.toLocaleString("zh-CN")}
            </span>
            <span className="ml-2">押金 ¥{form.deposit.toLocaleString("zh-CN")}</span>
          </div>
          <div className="flex gap-2 sm:justify-end">
            <Button variant="ghost" type="button" asChild>
              <Link to="/orders">取消</Link>
            </Button>
            <Button type="submit" disabled={!valid || create.isPending}>
              {create.isPending ? "创建中…" : "创建工单"}
            </Button>
          </div>
        </div>
      </form>
    </div>
  );
}

function CustomerSearch({ onPick }: { onPick: (c: Customer) => void }) {
  const [q, setQ] = useState("");
  const [open, setOpen] = useState(false);
  const { data = [] } = useQuery({
    queryKey: ["customer-suggest", q],
    queryFn: () => searchCustomers(q),
    enabled: q.trim().length > 0,
    staleTime: 30_000,
  });

  useEffect(() => {
    setOpen(q.trim().length > 0 && data.length > 0);
  }, [q, data.length]);

  return (
    <div className="relative mb-2">
      <div className="relative">
        <UserSearch className="pointer-events-none absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="按姓名或手机号搜索已有客户"
          className="pl-8"
          onBlur={() => setTimeout(() => setOpen(false), 150)}
          onFocus={() => q && data.length > 0 && setOpen(true)}
        />
      </div>
      {open && (
        <ul className="absolute z-10 mt-1 max-h-64 w-full overflow-auto rounded-md border border-border/60 bg-popover p-1 shadow-elevated">
          {data.map((c) => (
            <li key={c.id}>
              <button
                type="button"
                className="flex w-full items-center justify-between gap-2 rounded px-2 py-1.5 text-left text-sm hover:bg-accent"
                onMouseDown={(e) => e.preventDefault()}
                onClick={() => {
                  onPick(c);
                  setQ("");
                  setOpen(false);
                }}
              >
                <span className="font-medium">{c.name}</span>
                <span className="font-mono text-xs text-muted-foreground">{c.phone_e164}</span>
                <Check className="size-3.5 text-primary opacity-0 group-hover:opacity-100" />
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function Section({
  title,
  hint,
  children,
}: {
  title: string;
  hint?: string;
  children: React.ReactNode;
}) {
  return (
    <Card className="p-4">
      <div className="mb-3 flex items-center justify-between">
        <h2 className="text-sm font-semibold">{title}</h2>
        {hint && <span className="text-xs text-muted-foreground">{hint}</span>}
      </div>
      <div className="space-y-3">{children}</div>
    </Card>
  );
}

function Grid({ children }: { children: React.ReactNode }) {
  return <div className="grid gap-3 sm:grid-cols-2">{children}</div>;
}

function FormItem({
  label,
  required,
  children,
}: {
  label: string;
  required?: boolean;
  children: React.ReactNode;
}) {
  return (
    <div className="space-y-1.5">
      <Label className="text-xs">
        {label} {required && <span className="text-destructive">*</span>}
      </Label>
      {children}
    </div>
  );
}
