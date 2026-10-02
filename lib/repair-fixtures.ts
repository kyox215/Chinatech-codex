export type RepairStatus =
  | "diagnosis"
  | "awaiting_quote"
  | "awaiting_parts"
  | "repairing"
  | "testing"
  | "ready"
  | "awaiting_reply"
  | "collected_unpaid"
  | "outsourced"
  | "ready_notified"
  | "completed"
  | "cancelled";

export type RepairTone = "warning" | "info" | "progress" | "success";

export type RepairTimelineItem = {
  title: string;
  detail: string;
  time: string;
  actor: string;
  tone: RepairTone;
};

export type RepairOrder = {
  id: string;
  status: RepairStatus;
  statusLabel: string;
  tone: RepairTone;
  priority: "普通" | "优先" | "紧急";
  customer: { name: string; phone: string };
  device: {
    category: string;
    brand: string;
    model: string;
    color: string;
    serial: string;
  };
  issue: string;
  accessories: string[];
  createdAt: string;
  updatedAt: string;
  receivedAt: string;
  promisedAt: string;
  technician: string;
  waitingFor: string;
  quote: {
    version: number;
    parts: number;
    labor: number;
    total: number;
    state: string;
  };
  timeline: RepairTimelineItem[];
};

export const repairStatusOptions: Array<{ value: RepairStatus; label: string }> = [
  { value: "awaiting_reply", label: "久等 未答复" },
  { value: "collected_unpaid", label: "欠款 已拿走" },
  { value: "outsourced", label: "寄修" },
  { value: "diagnosis", label: "待检测" },
  { value: "awaiting_quote", label: "待确认" },
  { value: "awaiting_parts", label: "待配件" },
  { value: "repairing", label: "维修中" },
  { value: "testing", label: "待测试" },
  { value: "ready", label: "待取机" },
  { value: "ready_notified", label: "修好已通知" },
  { value: "completed", label: "维修结束" },
  { value: "cancelled", label: "作废" },
];

export const repairOrders: RepairOrder[] = [
  {
    id: "CT-2026-0929",
    status: "awaiting_quote",
    statusLabel: "等待报价确认",
    tone: "warning",
    priority: "优先",
    customer: { name: "周先生", phone: "+39 320 000 1029" },
    device: { category: "手机", brand: "Apple", model: "iPhone 15 Pro", color: "原色钛金属", serial: "DEMO-15P-0929" },
    issue: "无法充电，连接数据线后偶发重启。客户说明设备未进水。",
    accessories: ["透明保护壳", "SIM 卡托"],
    createdAt: "2026-09-29 09:16",
    updatedAt: "2026-09-30 08:52:00",
    receivedAt: "2026-09-29 09:16",
    promisedAt: "待客户确认后安排",
    technician: "Luca",
    waitingFor: "客户确认报价 v2",
    quote: { version: 2, parts: 86, labor: 55, total: 141, state: "已发送，等待确认" },
    timeline: [
      { title: "报价 v2 已发送", detail: "更正尾插排线采购价，旧报价 v1 保留。", time: "09月29日 15:42", actor: "塔赫桑", tone: "warning" },
      { title: "完成初步检测", detail: "无线充电正常；尾插接口电流不稳定。", time: "09月29日 11:08", actor: "Luca", tone: "progress" },
      { title: "设备已接收", detail: "已核对保护壳与 SIM 卡托，外观照片为演示占位。", time: "09月29日 09:16", actor: "塔赫桑", tone: "success" },
    ],
  },
  {
    id: "CT-2026-0927",
    status: "awaiting_parts",
    statusLabel: "等待配件到货",
    tone: "info",
    priority: "普通",
    customer: { name: "Elena R.", phone: "+39 320 000 1027" },
    device: { category: "电脑", brand: "Apple", model: "MacBook Air M2", color: "午夜色", serial: "DEMO-MBA-0927" },
    issue: "电池健康异常，满电后两小时内关机。",
    accessories: ["原装充电器"],
    createdAt: "2026-09-27 14:20",
    updatedAt: "2026-09-28 10:32:00",
    receivedAt: "2026-09-27 14:20",
    promisedAt: "2026-10-03",
    technician: "Luca",
    waitingFor: "电池到货",
    quote: { version: 1, parts: 129, labor: 65, total: 194, state: "客户已确认" },
    timeline: [
      { title: "供应商已确认订单", detail: "预计 10月3日到货。", time: "09月28日 10:32", actor: "塔赫桑", tone: "info" },
      { title: "客户确认报价 v1", detail: "确认金额 €194.00。", time: "09月27日 17:40", actor: "Elena R.", tone: "success" },
    ],
  },
  {
    id: "CT-2026-0924",
    status: "repairing",
    statusLabel: "维修中",
    tone: "progress",
    priority: "普通",
    customer: { name: "Marco B.", phone: "+39 320 000 1024" },
    device: { category: "游戏机", brand: "Nintendo", model: "Switch OLED", color: "白色", serial: "DEMO-NSW-0924" },
    issue: "左侧摇杆漂移，校准后仍复现。",
    accessories: ["左右 Joy-Con", "收纳包"],
    createdAt: "2026-09-24 16:05",
    updatedAt: "2026-09-30 09:10:00",
    receivedAt: "2026-09-24 16:05",
    promisedAt: "2026-10-01",
    technician: "Giulia",
    waitingFor: "维修完成后进入功能测试",
    quote: { version: 1, parts: 18, labor: 42, total: 60, state: "客户已确认" },
    timeline: [{ title: "开始更换摇杆模组", detail: "到货数量已核对，不形成配件库存。", time: "09月30日 09:10", actor: "Giulia", tone: "progress" }],
  },
  {
    id: "CT-2026-0921",
    status: "ready",
    statusLabel: "待取机",
    tone: "success",
    priority: "普通",
    customer: { name: "林女士", phone: "+39 320 000 1021" },
    device: { category: "手机", brand: "Samsung", model: "Galaxy S24 Ultra", color: "钛灰", serial: "DEMO-S24-0921" },
    issue: "屏幕破裂，触控右侧区域失灵。",
    accessories: ["保护壳"],
    createdAt: "2026-09-21 10:14",
    updatedAt: "2026-09-29 09:18:00",
    receivedAt: "2026-09-21 10:14",
    promisedAt: "已完成，可取机",
    technician: "Luca",
    waitingFor: "客户取机并核对随件",
    quote: { version: 1, parts: 168, labor: 70, total: 238, state: "客户已确认" },
    timeline: [{ title: "完成最终测试", detail: "触控、相机、充电与通话测试通过。", time: "09月29日 09:18", actor: "Luca", tone: "success" }],
  },
  {
    id: "CT-2026-0918",
    status: "testing",
    statusLabel: "待最终测试",
    tone: "info",
    priority: "紧急",
    customer: { name: "Andrea P.", phone: "+39 320 000 1018" },
    device: { category: "电脑", brand: "Lenovo", model: "ThinkPad X1 Carbon", color: "黑色", serial: "DEMO-X1-0918" },
    issue: "开机无显示，外接显示器正常。",
    accessories: ["65W USB-C 充电器"],
    createdAt: "2026-09-18 11:35",
    updatedAt: "2026-09-30 08:44:00",
    receivedAt: "2026-09-18 11:35",
    promisedAt: "2026-09-30",
    technician: "Giulia",
    waitingFor: "完成 2 小时稳定性测试",
    quote: { version: 3, parts: 94, labor: 85, total: 179, state: "客户已确认" },
    timeline: [{ title: "维修完成，进入测试", detail: "报价 v3 与维修记录均已锁定保留。", time: "09月30日 08:44", actor: "Giulia", tone: "info" }],
  },
  {
    id: "CT-2026-0916",
    status: "diagnosis",
    statusLabel: "待检测",
    tone: "warning",
    priority: "普通",
    customer: { name: "Sofia M.", phone: "+39 320 000 1016" },
    device: { category: "平板", brand: "Apple", model: "iPad Air 5", color: "蓝色", serial: "DEMO-IPAD-0916" },
    issue: "无法开机，客户不确定是否曾接触液体。",
    accessories: [],
    createdAt: "2026-09-30 09:02",
    updatedAt: "2026-09-30 09:02:00",
    receivedAt: "2026-09-30 09:02",
    promisedAt: "待检测后确认",
    technician: "未分配",
    waitingFor: "分配技术员并完成外观检测",
    quote: { version: 0, parts: 0, labor: 0, total: 0, state: "尚未报价" },
    timeline: [{ title: "设备已接收", detail: "尚未检测，不把未知故障或费用填写为零值事实。", time: "09月30日 09:02", actor: "塔赫桑", tone: "warning" }],
  },
];

export function getRepairOrder(id: string) {
  return repairOrders.find((repair) => repair.id === id);
}
