"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  ArrowLeft,
  Banknote,
  Battery,
  Camera,
  Check,
  ChevronDown,
  Cpu,
  Droplets,
  Mic,
  Plus,
  ReceiptText,
  ScanLine,
  Search,
  Settings,
  Smartphone,
  Trash2,
  Volume2,
  X,
  Zap,
} from "lucide-react";

import { ImeiScannerField } from "@/components/imei-scanner-field";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";

import {
  createOrder,
  getCustomerDevices,
  getRepairDeskOptions,
  searchCustomers,
} from "@/lib/repairdesk/api";
import type { Customer, FaultPriceItem } from "@/lib/repairdesk/api";
import { repairOrderType, statusMeta } from "@/lib/mock/enums";
import { ORDER_STATUS_ALLOWED_FOR_CREATE, normalizeInitialOrderStatus } from "@/lib/mock/workflow";
import { cn } from "@/lib/utils";

interface SelectedFault extends FaultPriceItem {
  key: string;
  categoryKey: string;
  categoryLabel: string;
}

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
  warrantyText: string;
  deposit: number;
  faults: SelectedFault[];
}

type FaultOption = {
  key: string;
  label: string;
  italian: string;
  price: number;
};

type FaultGroup = {
  key: string;
  label: string;
  italian: string;
  icon: React.ComponentType<{ className?: string }>;
  options: FaultOption[];
};

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
  warrantyText: "6个月",
  deposit: 0,
  faults: [],
};

const fallbackTechnicians = ["陈师傅", "李工", "王师傅", "周工", "黄师傅"];
const brandSuggestions = ["Apple", "Samsung", "Huawei", "Xiaomi", "OPPO", "Vivo", "Honor"];
const warrantyOptions = ["无保修", "3个月", "6个月", "12个月"];

const faultGroups: FaultGroup[] = [
  {
    key: "display",
    label: "屏幕",
    italian: "Display",
    icon: Smartphone,
    options: [
      { key: "unspecified", label: "不细分", italian: "Display", price: 0 },
      { key: "glass", label: "外屏碎裂", italian: "Vetro esterno rotto", price: 0 },
      { key: "lcd", label: "内屏漏液", italian: "LCD danneggiato", price: 0 },
      { key: "touch", label: "触摸失灵", italian: "Touch non funzionante", price: 0 },
    ],
  },
  {
    key: "battery",
    label: "电池",
    italian: "Batteria",
    icon: Battery,
    options: [
      { key: "unspecified", label: "不细分", italian: "Batteria", price: 0 },
      { key: "health", label: "健康度低", italian: "Salute batteria bassa", price: 0 },
      { key: "drain", label: "耗电快", italian: "Consumo rapido", price: 0 },
      { key: "swollen", label: "鼓包", italian: "Batteria gonfia", price: 0 },
    ],
  },
  {
    key: "charging",
    label: "尾插",
    italian: "Connettore di ricarica",
    icon: Zap,
    options: [
      { key: "unspecified", label: "不细分", italian: "Connettore di ricarica", price: 0 },
      { key: "loose", label: "接口松动", italian: "Porta allentata", price: 0 },
      { key: "no-charge", label: "无法充电", italian: "Non carica", price: 0 },
      { key: "clean", label: "清洁尾插", italian: "Pulizia connettore", price: 0 },
    ],
  },
  {
    key: "camera",
    label: "摄像头",
    italian: "Fotocamera",
    icon: Camera,
    options: [
      { key: "unspecified", label: "不细分", italian: "Fotocamera", price: 0 },
      { key: "front", label: "前摄异常", italian: "Fotocamera frontale", price: 0 },
      { key: "rear", label: "后摄异常", italian: "Fotocamera posteriore", price: 0 },
      { key: "lens", label: "镜头破损", italian: "Lente danneggiata", price: 0 },
    ],
  },
  {
    key: "liquid",
    label: "进水",
    italian: "Danni da liquido",
    icon: Droplets,
    options: [
      { key: "unspecified", label: "不细分", italian: "Danni da liquido", price: 0 },
      { key: "cleaning", label: "清洁检测", italian: "Pulizia e diagnosi", price: 0 },
      { key: "corrosion", label: "主板腐蚀", italian: "Ossidazione scheda", price: 0 },
    ],
  },
  {
    key: "mainboard",
    label: "主板",
    italian: "Scheda madre",
    icon: Cpu,
    options: [
      { key: "unspecified", label: "不细分", italian: "Scheda madre", price: 0 },
      { key: "no-power", label: "不开机", italian: "Non si accende", price: 0 },
      { key: "baseband", label: "无服务", italian: "Nessun servizio", price: 0 },
      { key: "short", label: "短路", italian: "Corto circuito", price: 0 },
    ],
  },
  {
    key: "system",
    label: "系统",
    italian: "Sistema",
    icon: Settings,
    options: [
      { key: "unspecified", label: "不细分", italian: "Sistema", price: 0 },
      { key: "restore", label: "刷机恢复", italian: "Ripristino software", price: 0 },
      { key: "data", label: "资料迁移", italian: "Trasferimento dati", price: 0 },
      { key: "account", label: "账户问题", italian: "Problema account", price: 0 },
    ],
  },
  {
    key: "back-cover",
    label: "后盖",
    italian: "Cover posteriore",
    icon: Smartphone,
    options: [
      { key: "unspecified", label: "不细分", italian: "Cover posteriore", price: 0 },
      { key: "glass", label: "玻璃破裂", italian: "Vetro posteriore rotto", price: 0 },
      { key: "frame", label: "中框变形", italian: "Telaio deformato", price: 0 },
    ],
  },
  {
    key: "face",
    label: "面容/指纹",
    italian: "Face ID / Impronta",
    icon: ScanLine,
    options: [
      { key: "unspecified", label: "不细分", italian: "Face ID / Impronta", price: 0 },
      { key: "face-id", label: "面容异常", italian: "Face ID non funzionante", price: 0 },
      { key: "fingerprint", label: "指纹异常", italian: "Impronta non funzionante", price: 0 },
    ],
  },
  {
    key: "speaker",
    label: "扬声器",
    italian: "Altoparlante",
    icon: Volume2,
    options: [
      { key: "unspecified", label: "不细分", italian: "Altoparlante", price: 0 },
      { key: "low", label: "声音小", italian: "Volume basso", price: 0 },
      { key: "noise", label: "杂音", italian: "Rumore", price: 0 },
    ],
  },
  {
    key: "microphone",
    label: "麦克风",
    italian: "Microfono",
    icon: Mic,
    options: [
      { key: "unspecified", label: "不细分", italian: "Microfono", price: 0 },
      { key: "no-sound", label: "无声", italian: "Audio assente", price: 0 },
      { key: "noise", label: "通话杂音", italian: "Rumore in chiamata", price: 0 },
    ],
  },
  {
    key: "button",
    label: "按键",
    italian: "Tasti",
    icon: Smartphone,
    options: [
      { key: "unspecified", label: "不细分", italian: "Tasti", price: 0 },
      { key: "power", label: "电源键", italian: "Tasto accensione", price: 0 },
      { key: "volume", label: "音量键", italian: "Tasti volume", price: 0 },
      { key: "silent", label: "静音键", italian: "Tasto silenzioso", price: 0 },
    ],
  },
];

export default function NewOrderPage() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const [form, setForm] = useState<FormState>(initialForm);
  const { data: options = { suppliers: [], technicians: [] } } = useQuery({
    queryKey: ["repairdesk-options"],
    queryFn: () => getRepairDeskOptions(),
  });
  const technicianOptions = options.technicians.length ? options.technicians : fallbackTechnicians;

  const total = useMemo(
    () => form.faults.reduce((sum, item) => sum + (Number(item.price) || 0), 0),
    [form.faults],
  );
  const balance = Math.max(0, total - form.deposit);
  const faultSummary = form.faults.map((item) => item.name).join("，");
  const issueDescription =
    form.issue.trim() || faultSummary || "客户未补充故障描述，按所选故障项目检测。";

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
        customer_name: form.customerName.trim() || `客户 ${form.customerPhone.trim()}`,
        customer_phone: form.customerPhone,
        device_id: form.deviceId,
        device_brand: form.brand,
        device_model: form.model,
        device_imei: form.imei,
        device_notes: form.deviceNotes || undefined,
        issue_description: issueDescription,
        technician_name: form.technician,
        internal_tag: form.internalTag || undefined,
        warranty_text: form.warrantyText || undefined,
        fault_prices: form.faults
          .filter((item) => item.name.trim())
          .map(({ name, price, note }) => ({
            name: name.trim(),
            price: Number(price) || 0,
            ...(note?.trim() ? { note: note.trim() } : {}),
          })),
        deposit_amount: form.deposit,
      }),
    onSuccess: ({ id }) => {
      queryClient.invalidateQueries({ queryKey: ["orders"] });
      queryClient.invalidateQueries({ queryKey: ["order-stats"] });
      queryClient.invalidateQueries({ queryKey: ["repairdesk-options"] });
      toast.success("工单已创建");
      router.push(`/orders/${id}`);
    },
    onError: (error: Error) => toast.error(error.message),
  });

  const valid =
    form.customerPhone.trim() &&
    form.brand.trim() &&
    form.model.trim() &&
    form.technician.trim() &&
    (form.faults.length > 0 || form.issue.trim()) &&
    form.deposit <= total;

  const toggleFault = (group: FaultGroup, option: FaultOption) => {
    const key = `${group.key}:${option.key}`;
    const exists = form.faults.some((item) => item.key === key);
    if (exists) {
      setForm({ ...form, faults: form.faults.filter((item) => item.key !== key) });
      return;
    }

    const name = option.key === "unspecified" ? group.label : `${group.label} - ${option.label}`;
    setForm({
      ...form,
      faults: [
        ...form.faults,
        {
          key,
          categoryKey: group.key,
          categoryLabel: group.label,
          name,
          price: option.price,
          note: option.italian,
        },
      ],
    });
  };

  const patchFault = (index: number, patch: Partial<FaultPriceItem>) => {
    const next = [...form.faults];
    next[index] = { ...next[index], ...patch };
    setForm({ ...form, faults: next });
  };

  const addCustomFault = () => {
    setForm({
      ...form,
      faults: [
        ...form.faults,
        {
          key: `custom:${Date.now()}`,
          categoryKey: "custom",
          categoryLabel: "自定义",
          name: "",
          price: 0,
          note: "Intervento personalizzato",
        },
      ],
    });
  };

  return (
    <div className="mx-auto max-w-7xl px-3 py-4 sm:px-6">
      <form
        onSubmit={(event) => {
          event.preventDefault();
          if (!valid) {
            toast.error(form.deposit > total ? "定金不能超过订单总金额" : "请补全必填字段");
            return;
          }
          create.mutate();
        }}
        className="pb-24"
      >
        <div className="mb-5 flex items-start justify-between gap-4 border-b border-border/60 pb-4">
          <div>
            <h1 className="text-2xl font-semibold tracking-tight">新建维修订单</h1>
            <p className="mt-1 text-sm text-muted-foreground">填写客户和设备信息以创建新工单</p>
          </div>
          <Button variant="outline" size="icon" className="size-11 rounded-full" asChild>
            <Link href="/orders" aria-label="关闭">
              <X className="size-5" />
            </Link>
          </Button>
        </div>

        <div className="grid gap-5 xl:grid-cols-[minmax(280px,0.95fr)_minmax(430px,1.2fr)_minmax(320px,0.95fr)]">
          <Card className="h-fit border-border/70 p-4 shadow-sm">
            <SectionHeading title="客户信息" />
            <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-1 2xl:grid-cols-2">
              <FormItem label="电话" required>
                <CustomerPhoneLookup
                  value={form.customerPhone}
                  onChange={(customerPhone) =>
                    setForm({ ...form, customerPhone, customerId: undefined })
                  }
                  onPick={async (customer) => {
                    const devices = await getCustomerDevices(customer.id);
                    const device = devices[0];
                    setForm((current) => ({
                      ...current,
                      customerId: customer.id,
                      customerName: customer.name,
                      customerPhone: customer.phone_e164,
                      deviceId: device?.id,
                      brand: device?.brand ?? current.brand,
                      model: device?.model ?? current.model,
                      imei: device?.serial_or_imei ?? current.imei,
                      deviceNotes: device?.device_notes ?? current.deviceNotes,
                    }));
                    toast.success(
                      device
                        ? `已带入 ${customer.name} 的设备：${device.brand} ${device.model}`
                        : `已选择客户 ${customer.name}`,
                    );
                  }}
                />
              </FormItem>
              <FormItem label="姓名">
                <Input
                  value={form.customerName}
                  onChange={(event) =>
                    setForm({ ...form, customerName: event.target.value, customerId: undefined })
                  }
                  placeholder="客户姓名（可选）"
                />
              </FormItem>
            </div>

            <SectionHeading title="设备信息" className="mt-7" />
            <datalist id="repair-brand-suggestions">
              {brandSuggestions.map((brand) => (
                <option key={brand} value={brand} />
              ))}
            </datalist>
            <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-1 2xl:grid-cols-2">
              <FormItem label="品牌" required>
                <Input
                  list="repair-brand-suggestions"
                  value={form.brand}
                  onChange={(event) =>
                    setForm({ ...form, brand: event.target.value, deviceId: undefined })
                  }
                  placeholder="选择品牌"
                />
              </FormItem>
              <FormItem label="型号" required>
                <Input
                  value={form.model}
                  onChange={(event) =>
                    setForm({ ...form, model: event.target.value, deviceId: undefined })
                  }
                  placeholder="例如：iPhone 13"
                />
              </FormItem>
            </div>
            <div className="mt-3">
              <FormItem label="IMEI / 序列号">
                <ImeiScannerField
                  value={form.imei}
                  onChange={(imei) => setForm({ ...form, imei })}
                  placeholder="可选"
                />
              </FormItem>
            </div>
            <div className="mt-3">
              <FormItem label="设备备注">
                <Input
                  value={form.deviceNotes}
                  onChange={(event) => setForm({ ...form, deviceNotes: event.target.value })}
                  placeholder="外观、随机器材、缺失说明"
                />
              </FormItem>
            </div>
          </Card>

          <Card className="h-fit border-border/70 p-4 shadow-sm">
            <div className="mb-4 flex items-center gap-3">
              <Search className="size-5 text-muted-foreground" />
              <h2 className="text-xl font-semibold">故障诊断</h2>
            </div>
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {faultGroups.map((group) => (
                <FaultCategoryButton
                  key={group.key}
                  group={group}
                  selected={form.faults}
                  onToggle={toggleFault}
                  onClear={() =>
                    setForm({
                      ...form,
                      faults: form.faults.filter((item) => item.categoryKey !== group.key),
                    })
                  }
                />
              ))}
            </div>
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
                            onChange={(event) => patchFault(index, { name: event.target.value })}
                            placeholder="自定义项目名称"
                          />
                        ) : (
                          <div className="min-w-0">
                            <div className="truncate text-sm font-medium">{item.name}</div>
                            <div className="truncate text-xs text-muted-foreground">
                              {item.note}
                            </div>
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
                          onChange={(event) =>
                            patchFault(index, { price: Number(event.target.value) })
                          }
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
                  onClick={addCustomFault}
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
              <p className="text-xs text-muted-foreground">
                保存时由服务端按总金额与定金自动写入余额。
              </p>

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

              <FormItem label="配件标签">
                <Input
                  value={form.internalTag}
                  onChange={(event) => setForm({ ...form, internalTag: event.target.value })}
                  placeholder="如：SIM卡，手机壳"
                />
              </FormItem>

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
        </div>

        <div className="sticky bottom-0 -mx-3 mt-5 flex flex-col-reverse gap-3 border-t bg-background/90 px-3 py-3 backdrop-blur sm:-mx-6 sm:flex-row sm:items-center sm:justify-between sm:px-6">
          <Button variant="ghost" type="button" className="gap-1.5" asChild>
            <Link href="/orders">
              <ArrowLeft className="size-4" /> 返回工单
            </Link>
          </Button>
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
            <div className="text-sm text-muted-foreground">
              合计{" "}
              <span className="font-display text-lg font-semibold text-foreground">
                €{total.toFixed(2)}
              </span>
              <span className="ml-2">定金 €{form.deposit.toFixed(2)}</span>
            </div>
            <Button type="submit" disabled={!valid || create.isPending} className="gap-1.5">
              <Banknote className="size-4" />
              {create.isPending ? "创建中…" : "创建维修订单"}
            </Button>
          </div>
        </div>
      </form>
    </div>
  );
}

function CustomerPhoneLookup({
  value,
  onChange,
  onPick,
}: {
  value: string;
  onChange: (value: string) => void;
  onPick: (customer: Customer) => void | Promise<void>;
}) {
  const [open, setOpen] = useState(false);
  const { data = [] } = useQuery({
    queryKey: ["customer-suggest", value],
    queryFn: () => searchCustomers(value),
    enabled: value.trim().length > 0,
    staleTime: 30_000,
  });

  useEffect(() => {
    setOpen(value.trim().length > 0 && data.length > 0);
  }, [data.length, value]);

  return (
    <div className="relative">
      <Input
        value={value}
        onChange={(event) => onChange(event.target.value)}
        placeholder="输入电话搜索客户"
        className="font-mono"
        onBlur={() => setTimeout(() => setOpen(false), 150)}
        onFocus={() => value && data.length > 0 && setOpen(true)}
      />
      {open && (
        <ul className="absolute z-20 mt-1 max-h-64 w-full overflow-auto rounded-lg border border-border/70 bg-popover p-1 shadow-elevated">
          {data.map((customer) => (
            <li key={customer.id}>
              <button
                type="button"
                className="flex w-full items-center justify-between gap-2 rounded-md px-2 py-2 text-left text-sm hover:bg-accent"
                onMouseDown={(event) => event.preventDefault()}
                onClick={() => {
                  void onPick(customer);
                  setOpen(false);
                }}
              >
                <span className="font-medium">{customer.name}</span>
                <span className="font-mono text-xs text-muted-foreground">
                  {customer.phone_e164}
                </span>
                <Check className="size-3.5 text-primary" />
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function FaultCategoryButton({
  group,
  selected,
  onToggle,
  onClear,
}: {
  group: FaultGroup;
  selected: SelectedFault[];
  onToggle: (group: FaultGroup, option: FaultOption) => void;
  onClear: () => void;
}) {
  const active = selected.filter((item) => item.categoryKey === group.key);
  const Icon = group.icon;

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button
          type="button"
          className={cn(
            "flex min-h-16 items-center justify-between gap-3 rounded-xl border px-4 py-3 text-left transition-colors",
            active.length
              ? "border-primary bg-primary/10 text-primary"
              : "border-border/70 bg-surface hover:bg-accent",
          )}
        >
          <span className="flex min-w-0 items-center gap-3">
            <Icon className="size-5 shrink-0" />
            <span className="truncate text-base font-medium">{group.label}</span>
          </span>
          <ChevronDown className="size-4 shrink-0 text-muted-foreground" />
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" className="w-72">
        <DropdownMenuLabel>
          <span>{group.label}</span>
          <span className="ml-2 text-xs font-normal text-muted-foreground">{group.italian}</span>
        </DropdownMenuLabel>
        <DropdownMenuSeparator />
        {group.options.map((option) => {
          const key = `${group.key}:${option.key}`;
          const checked = selected.some((item) => item.key === key);
          return (
            <DropdownMenuCheckboxItem
              key={option.key}
              checked={checked}
              onSelect={(event) => event.preventDefault()}
              onCheckedChange={() => onToggle(group, option)}
              className="gap-2"
            >
              <span className="min-w-0 flex-1">
                <span className="block truncate">{option.label}</span>
                <span className="block truncate text-xs text-muted-foreground">
                  {option.italian}
                </span>
              </span>
            </DropdownMenuCheckboxItem>
          );
        })}
        {active.length > 0 && (
          <>
            <DropdownMenuSeparator />
            <DropdownMenuItem
              className="text-destructive focus:text-destructive"
              onSelect={(event) => {
                event.preventDefault();
                onClear();
              }}
            >
              取消选择
            </DropdownMenuItem>
          </>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

function SectionHeading({ title, className }: { title: string; className?: string }) {
  return (
    <h2 className={cn("mb-3 text-sm font-semibold text-muted-foreground", className)}>{title}</h2>
  );
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
      <Label className="text-sm text-muted-foreground">
        {label} {required && <span className="text-destructive">*</span>}
      </Label>
      {children}
    </div>
  );
}

function MoneyRow({ label, value, strong }: { label: string; value: number; strong?: boolean }) {
  return (
    <div className="flex items-center justify-between gap-4">
      <span className="text-sm font-medium text-muted-foreground">{label}</span>
      <span
        className={cn(
          "font-mono text-lg tabular-nums",
          strong && "font-display text-2xl font-semibold text-foreground",
        )}
      >
        €{value.toFixed(2)}
      </span>
    </div>
  );
}
