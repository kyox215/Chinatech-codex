export const retailCategories = { phone: "手机", tablet: "平板", laptop: "笔记本", desktop: "台式电脑", console: "游戏机", other: "其他商品" };
export type RetailCategory = keyof typeof retailCategories;
export type RetailStatus = "inspecting" | "available" | "reserved" | "hold" | "sold";
export const retailStatuses: Record<RetailStatus, { label: string; tone: string }> = {
  inspecting: { label: "待检测", tone: "warning" }, available: { label: "可售", tone: "success" }, reserved: { label: "已预留", tone: "progress" }, hold: { label: "暂停销售", tone: "warning" }, sold: { label: "已售出", tone: "info" },
};
export type Capacity = { capacity: number | null; unit: "GB" | "TB" };
export type RetailDisk = Capacity & { type: "SSD" | "HDD" | "NVMe SSD" };
export type Inspection = { functional: boolean; ownership: boolean; data: boolean };
export type RetailActor = { actorId?: string; actorName?: string };
export type RetailEvent = RetailActor & { id: string; title: string; detail: string; time: string; sensitive?: "financial" };
export const retailWarrantyTermsVersion = "retail-2026-10-v1" as const;
export type RetailWarrantySnapshot = { months: number | null; termsVersion: typeof retailWarrantyTermsVersion; shopName: string; address: string; phone: string };
export type RetailPaymentMethod = "cash" | "card" | "transfer" | "other";
export type RetailVoid = RetailActor & { reason: string; eventId: string; time: string };
export type RetailMoneyEntry = RetailActor & { id: string; amountCents: number; date: string; method: RetailPaymentMethod; note: string; eventId: string; void?: RetailVoid };
export type RetailProductSnapshot = Pick<RetailUnit, "id" | "code" | "category" | "brand" | "model" | "serial" | "imei1" | "imei2" | "productCode" | "color" | "ramGb" | "bodyStorage" | "disks" | "cpu" | "gpu" | "keyboard" | "edition" | "controllers" | "condition" | "grade" | "batteryPercent" | "accessories" | "knownIssues" | "photos">;
export type RetailAfterSale = {
  id: string; date: string; issue: string; custody: "left" | "not_left"; eventId: string;
  actorId?: string; actorName?: string; coverage: "pending" | "commercial" | "statutory" | "paid";
  assessmentReason?: string; assessmentEventId?: string; repairId?: string; linkEventId?: string;
  assessments?: (RetailActor & { coverage: RetailAfterSale["coverage"]; reason: string; eventId: string; time: string })[];
  closed?: RetailActor & { date: string; resolution: string; returned: true; eventId: string };
  cancelled?: RetailActor & { reason: string; eventId: string; time: string };
};
export type RetailDebtDelivery = { reason: string; owner: string; followUp: string };
export type RetailSale = {
  id: string; time: string; priceCents: number; paidCents: number | null; delivered: boolean; note: string;
  customerPhone?: string; customerName?: string; customerEmail?: string; customerAddress?: string; customerNote?: string;
  costCents?: number | null; refurbCents?: number | null; warranty?: RetailWarrantySnapshot; deliveryDate?: string; deliveryEventId?: string;
  product?: RetailProductSnapshot; paymentOpeningCents?: number | null; payments?: RetailMoneyEntry[]; refunds?: RetailMoneyEntry[];
  paymentUnreceived?: boolean;
  paymentReconciliation?: RetailActor & { paidCents: number; reason: string; eventId: string; time: string };
  returned?: RetailActor & { date: string; reason: string; received: true; eventId: string };
  debtDelivery?: RetailDebtDelivery; afterSales?: RetailAfterSale[];
};
export type RetailUnit = {
  historyOrigin?: { recordId: string; sourceSnapshot: string };
  id: string; code: string; category: RetailCategory; brand: string; model: string;
  serial: string; imei1: string; imei2: string; productCode: string; color: string;
  ramGb: number | null; bodyStorage: Capacity | null; disks: RetailDisk[];
  cpu: string; gpu: string; keyboard: string; edition: string; controllers: number | null;
  condition: "新机" | "翻新机"; warrantyMonths: number | null; grade: "S" | "A" | "B" | "C" | "待评估";
  batteryPercent: number | null; accessories: string; knownIssues: string; photos: string[];
  costCents: number | null; refurbCents: number | null; priceCents: number | null;
  source: string; location: string; intakeDate: string; storeOwned: boolean;
  status: RetailStatus; version: number; inspection: Inspection; events: RetailEvent[];
  reservation: { name: string; until: string; phone?: string; note?: string; eventId?: string } | null;
  currentSaleId?: string;
  sales: RetailSale[];
};

export const retailFieldLabels = {
  code: "单机编号", category: "商品类型", brand: "品牌", model: "型号 / 商品名称",
  serial: "SN", imei1: "IMEI 1", imei2: "IMEI 2", productCode: "包装条码", color: "颜色",
  ramGb: "RAM", bodyStorage: "机身存储", disks: "逐块 SSD / HDD", cpu: "CPU", gpu: "GPU",
  keyboard: "键盘布局", edition: "版本 / 网络", controllers: "随附手柄数量",
  condition: "商品分类", warrantyMonths: "商家保修", grade: "外观等级", batteryPercent: "电池健康", accessories: "随附物品",
  knownIssues: "已知问题", costCents: "入库成本", refurbCents: "整备成本", priceCents: "售价",
  source: "来源", location: "存放位置", intakeDate: "入库日期",
} as const;
export type RetailEditableField = keyof typeof retailFieldLabels;
export type RetailFieldValue = RetailUnit[RetailEditableField];
export type RetailFieldEdit = { field: RetailEditableField; value: RetailFieldValue };

const verificationFields = new Set<RetailEditableField>([
  "category", "brand", "model", "serial", "imei1", "imei2", "productCode", "color", "ramGb",
  "bodyStorage", "disks", "cpu", "gpu", "keyboard", "edition", "controllers", "condition", "grade",
  "batteryPercent", "knownIssues",
]);
export function isRetailVerificationField(field: string): boolean { return verificationFields.has(field as RetailEditableField); }
function applicableRetailField(category: RetailCategory, field: RetailEditableField) {
  switch (field) {
    case "imei1": case "imei2": return category === "phone" || category === "tablet";
    case "ramGb": return category === "phone" || category === "tablet" || isComputer(category);
    case "bodyStorage": return ["phone", "tablet", "console"].includes(category);
    case "disks": case "cpu": case "gpu": return isComputer(category);
    case "keyboard": return category === "laptop";
    case "edition": return category === "phone" || category === "tablet" || category === "console";
    case "controllers": return category === "console";
    case "batteryPercent": return hasBattery(category);
    default: return true;
  }
}
function emptyRetailField(value: RetailFieldValue) { return value === null || value === "" || Array.isArray(value) && value.length === 0; }
export function canEditRetailField(unit: RetailUnit, field: RetailEditableField) {
  return field !== "code" && Object.hasOwn(retailFieldLabels, field) && ["inspecting", "hold", "available"].includes(unit.status)
    && (applicableRetailField(unit.category, field) || !emptyRetailField(unit[field]));
}

function checkedCapacity(value: unknown, disk = false): Capacity | RetailDisk {
  if (!storedObject(value) || Object.keys(value).length !== (disk ? 3 : 2)
    || !Object.hasOwn(value, "capacity") || !Object.hasOwn(value, "unit")
    || !["GB", "TB"].includes(String(value.unit)) || typeof value.unit !== "string") throw new Error("存储资料须包含有效容量和 GB / TB 单位。");
  if (value.capacity !== null && (typeof value.capacity !== "number" || !Number.isFinite(value.capacity)
    || value.capacity <= 0 || value.capacity > (value.unit === "TB" ? 1024 : 1048576))) throw new Error("存储容量须为有效正数，未知请留空。");
  const capacity: Capacity = { capacity: value.capacity as number | null, unit: value.unit as Capacity["unit"] };
  if (!disk) return capacity;
  if (typeof value.type !== "string" || !["SSD", "HDD", "NVMe SSD"].includes(value.type)) throw new Error("请选择有效的 SSD / HDD 类型。");
  return { ...capacity, type: value.type as RetailDisk["type"] };
}

function checkedRetailFieldValue(field: RetailEditableField, value: unknown): RetailFieldValue {
  if (field === "warrantyMonths") return validateRetailWarrantyMonths(value);
  if (field === "bodyStorage") return value === null ? null : checkedCapacity(value);
  if (field === "disks") {
    if (!Array.isArray(value) || value.length > 16) throw new Error("逐块存储须为列表，最多登记 16 块。");
    return value.map((disk) => checkedCapacity(disk, true) as RetailDisk);
  }
  if (["ramGb", "batteryPercent", "controllers", "costCents", "refurbCents", "priceCents"].includes(field)) {
    if (value === null) return null;
    if (typeof value !== "number" || !Number.isSafeInteger(value)) throw new Error(`${retailFieldLabels[field]}须为整数，未知请留空。`);
    if (field === "ramGb" && (value <= 0 || value > 8192)) throw new Error("RAM 须为 1–8192 GB 的正整数，未知请留空。");
    if (field === "batteryPercent" && (value < 0 || value > 100)) throw new Error("电池健康须为 0–100 的整数，未知请留空。");
    if (field === "controllers" && (value < 0 || value > 100)) throw new Error("手柄数量须为 0–100 的整数，未知请留空。");
    if (["costCents", "refurbCents", "priceCents"].includes(field) && (value < 0 || value > 100000000)) throw new Error("金额须为有效整数分，未知请留空。");
    return value;
  }
  if (typeof value !== "string" || value.length > 5000) throw new Error(`${retailFieldLabels[field]}须为文字，最多 5000 字。`);
  const text = value.trim();
  if (field === "category" && !Object.hasOwn(retailCategories, text)) throw new Error("请选择有效商品类型。");
  if (field === "condition" && !["新机", "翻新机"].includes(text)) throw new Error("请选择新机或翻新机。");
  if (field === "grade" && !["S", "A", "B", "C", "待评估"].includes(text)) throw new Error("请选择有效外观等级。");
  if ((field === "code" || field === "model") && !text) throw new Error(`请填写${retailFieldLabels[field]}。`);
  if (field === "imei1" || field === "imei2") {
    const imei = normalizeImei(text);
    if (imei && !/^\d{15}$/.test(imei)) throw new Error("IMEI 必须为 15 位数字；格式有效不表示已核实真伪或所有权。");
    return imei;
  }
  if (field === "intakeDate" && text) {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(text)) throw new Error("入库日期须为有效的年-月-日，未知请留空。");
    const [year, month, day] = text.split("-").map(Number);
    const date = new Date(`${text}T00:00:00Z`);
    if (year < 1 || !Number.isFinite(date.getTime()) || date.getUTCFullYear() !== year || date.getUTCMonth() + 1 !== month || date.getUTCDate() !== day) throw new Error("入库日期不存在，请重新核对。");
  }
  return text;
}

function sameRetailFieldValue(first: unknown, second: unknown): boolean {
  if (first === second) return true;
  if (Array.isArray(first) && Array.isArray(second)) return first.length === second.length && first.every((value, index) => sameRetailFieldValue(value, second[index]));
  if (storedObject(first) && storedObject(second)) return Object.keys(first).length === Object.keys(second).length
    && Object.keys(first).every((key) => Object.hasOwn(second, key) && sameRetailFieldValue(first[key], second[key]));
  return false;
}
export function validateRetailFieldEdit(unit: RetailUnit, change: RetailFieldEdit, others: RetailUnit[] = []): RetailUnit {
  if (!storedObject(change) || Object.keys(change).length !== 2 || !Object.hasOwn(change, "field") || !Object.hasOwn(change, "value")
    || typeof change.field !== "string" || !Object.hasOwn(retailFieldLabels, change.field)) throw new Error("该单机字段不可直接编辑。");
  const field = change.field as RetailEditableField;
  if (field === "code") throw new Error("单机编号由系统自动生成，不可普通编辑。");
  if (!["inspecting", "hold", "available"].includes(unit.status)) throw new Error("预留或已售单机禁止普通资料编辑，请先处理占用或销售事实。");
  const value = checkedRetailFieldValue(field, change.value);
  if (!applicableRetailField(unit.category, field) && !emptyRetailField(value)) throw new Error(`${retailFieldLabels[field]}不适用于当前商品类型；只能清理已有资料。`);
  const candidate = { ...unit, [field]: value };
  if (field === "category") {
    for (const key of Object.keys(retailFieldLabels) as RetailEditableField[]) {
      if (!applicableRetailField(candidate.category, key) && !emptyRetailField(candidate[key])) throw new Error(`新商品类型不适用${retailFieldLabels[key]}，请先独立清理该字段再更正类型。`);
    }
  }
  validateRetailUnit(candidate, others);
  if (unit.status === "available" && (candidate.priceCents === null || candidate.priceCents <= 0)) throw new Error("可售单机须保留有效正售价，未知或零售价不能保存。");
  if (sameRetailFieldValue(unit[field], candidate[field])) return unit;
  if (unit.status === "available" && isRetailVerificationField(field)) {
    candidate.status = "inspecting";
    candidate.inspection = { functional: false, ownership: false, data: false };
  }
  return candidate;
}

export function emptyRetailUnit(): RetailUnit {
  return { id: "", code: "", category: "phone", brand: "", model: "", serial: "", imei1: "", imei2: "", productCode: "", color: "", ramGb: null, bodyStorage: null, disks: [], cpu: "", gpu: "", keyboard: "", edition: "", controllers: null, condition: "翻新机", warrantyMonths: 12, grade: "待评估", batteryPercent: null, accessories: "", knownIssues: "", photos: [], costCents: null, refurbCents: null, priceCents: null, source: "", location: "", intakeDate: "", storeOwned: false, status: "inspecting", version: 1, inspection: { functional: false, ownership: false, data: false }, events: [], reservation: null, sales: [] };
}

export function copyRetailModel(unit: RetailUnit): RetailUnit {
  const { category, brand, model, color, ramGb, bodyStorage, disks, cpu, gpu, keyboard, edition, productCode } = unit;
  const copied = { ...emptyRetailUnit(), category, brand, model, color, ramGb, bodyStorage: bodyStorage ? { ...bodyStorage } : null, disks: disks.map((disk) => ({ ...disk })), cpu, gpu, keyboard, edition, productCode };
  for (const field of ["ramGb", "bodyStorage", "disks", "cpu", "gpu", "keyboard", "edition"] as const) {
    if (!applicableRetailField(category, field)) Object.assign(copied, { [field]: emptyRetailUnit()[field] });
  }
  return copied;
}

export const normalizeIdentifier = (value: string) => value.normalize("NFKC").replace(/\s+/g, "").toUpperCase();
export const normalizeImei = (value: string) => value.replace(/[\s-]/g, "");
export const isComputer = (category: RetailCategory) => category === "laptop" || category === "desktop";
// The console category includes handhelds; health remains an optional measured fact.
export const hasBattery = (category: RetailCategory) => ["phone", "tablet", "laptop", "console"].includes(category);
export function retailMoney(cents: number | null) { return cents === null ? "待确认" : `€${(cents / 100).toFixed(2)}`; }
export function parseRetailMoney(value: string) {
  if (!value.trim()) return null;
  const text = value.trim();
  if (!/^\d+(?:[.,]\d{1,2})?$/.test(text)) throw new Error("金额须为非负数，最多两位小数；用小数点或逗号，不使用千位分隔；未知请留空。");
  const [whole, fraction = ""] = text.split(/[.,]/);
  const cents = Number(whole) * 100 + Number(fraction.padEnd(2, "0"));
  if (!Number.isSafeInteger(cents) || cents > 100000000) throw new Error("金额超出本地样板允许范围。");
  return cents;
}
export function retailSpec(unit: RetailUnit) {
  const disks = unit.disks.map((disk) => `${disk.capacity ?? "待确认"} ${disk.unit} ${disk.type}`);
  const body = unit.bodyStorage ? `${unit.bodyStorage.capacity ?? "待确认"} ${unit.bodyStorage.unit} 机身存储` : "";
  return [unit.ramGb === null ? "" : `${unit.ramGb} GB RAM`, isComputer(unit.category) ? disks.join(" + ") : body, unit.edition].filter(Boolean).join(" · ") || "规格待确认";
}

export function identityConflict(unit: RetailUnit, others: RetailUnit[]) {
  const imeis = [unit.imei1, unit.imei2].map(normalizeImei).filter(Boolean);
  if (imeis.length === 2 && imeis[0] === imeis[1]) throw new Error("同一台的 IMEI 1 与 IMEI 2 不能重复。");
  for (const previous of others) {
    if (previous.id === unit.id) continue;
    if (normalizeIdentifier(unit.code) && normalizeIdentifier(unit.code) === normalizeIdentifier(previous.code)) return previous;
    if (unit.serial.trim() && normalizeIdentifier(unit.brand) === normalizeIdentifier(previous.brand) && normalizeIdentifier(unit.serial) === normalizeIdentifier(previous.serial)) return previous;
    if (imeis.some((imei) => [previous.imei1, previous.imei2].map(normalizeImei).includes(imei))) return previous;
  }
  return undefined;
}

export function validateRetailUnit(unit: RetailUnit, others: RetailUnit[] = []) {
  if (unit.historyOrigin !== undefined && (!storedObject(unit.historyOrigin) || Object.keys(unit.historyOrigin).sort().join(",") !== "recordId,sourceSnapshot" || typeof unit.historyOrigin.recordId !== "string" || typeof unit.historyOrigin.sourceSnapshot !== "string" || unit.historyOrigin.recordId !== unit.id || !/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(unit.historyOrigin.recordId) || !/^[0-9a-f]{64}$/.test(unit.historyOrigin.sourceSnapshot))) throw new Error("商品原记录关联无效。");
  if (!["新机", "翻新机"].includes(unit.condition)) throw new Error("请选择新机或翻新机。");
  validateRetailWarrantyMonths(unit.warrantyMonths);
  validateRetailPhotos(unit.photos);
  for (const field of ["ramGb", "controllers", "batteryPercent", "bodyStorage", "disks", "intakeDate", "grade"] as const) checkedRetailFieldValue(field, unit[field]);
  if (!unit.model.trim()) throw new Error("请填写型号或商品名称。");
  if (!unit.storeOwned) throw new Error("请明确确认这是门店自有实物，不能将客户送修设备直接建为商品。");
  if (typeof unit.category !== "string" || !Object.hasOwn(retailCategories, unit.category)) throw new Error("请选择有效商品类型。");
  if (unit.serial.trim() && !unit.brand.trim()) throw new Error("登记 SN 时请填写品牌，以便按制造商范围查重。");
  for (const imei of [unit.imei1, unit.imei2]) if (imei.trim() && !/^\d{15}$/.test(normalizeImei(imei))) throw new Error("IMEI 必须为 15 位数字；格式有效不表示已核实真伪或所有权。");
  if (unit.ramGb !== null && (!Number.isSafeInteger(unit.ramGb) || unit.ramGb <= 0)) throw new Error("RAM 须为正整数，未知请留空。");
  if (unit.batteryPercent !== null && (!Number.isInteger(unit.batteryPercent) || unit.batteryPercent < 0 || unit.batteryPercent > 100)) throw new Error("电池健康须为 0–100 的整数，未知请留空。");
  if (unit.controllers !== null && (!Number.isSafeInteger(unit.controllers) || unit.controllers < 0)) throw new Error("手柄数量须为非负整数，未知请留空。");
  for (const storage of [...unit.disks, ...(unit.bodyStorage ? [unit.bodyStorage] : [])]) {
    if (storage.capacity !== null && (!Number.isFinite(storage.capacity) || storage.capacity <= 0)) throw new Error("存储容量须大于零，未知请留空。");
    if (!["GB", "TB"].includes(storage.unit)) throw new Error("存储单位须为 GB 或 TB。");
  }
  for (const cents of [unit.costCents, unit.refurbCents, unit.priceCents]) if (cents !== null && (!Number.isSafeInteger(cents) || cents < 0 || cents > 100000000)) throw new Error("金额须以整数分保存，未知不能填成零。");
  const conflict = identityConflict(unit, others);
  if (conflict) throw new Error(`身份与已有单机 ${conflict.code} 重复，请打开原档案，不要重复建档。`);
  return unit;
}

export function createRetailUnit(draft: RetailUnit, existing: RetailUnit[], event: RetailEvent): RetailUnit {
  if (draft.historyOrigin !== undefined) throw new Error("已有商品须在原档案核对保存。");
  validateRetailEvent(event);
  if (!draft.id || existing.some((unit) => unit.id === draft.id)) throw new Error("单机编号无效或已存在。");
  const code = nextRetailCode(existing, event.time.slice(0, 10));
  const created = { ...draft, code, currentSaleId: undefined, status: "inspecting" as const, version: 1, inspection: { functional: false, ownership: false, data: false }, photos: [], reservation: null, sales: [], events: [event] };
  validateRetailUnit(created, existing);
  return created;
}

export function nextRetailCode(existing: RetailUnit[], creationDate: string): string {
  if (!isRetailDate(creationDate)) throw new Error("创建日期无效，未分配单机编号。");
  const prefix = `CT-${creationDate.replaceAll("-", "")}-`;
  const numbers = existing.map(unit => normalizeIdentifier(unit.code)).filter(code => code.startsWith(prefix))
    .map(code => code.slice(prefix.length)).filter(value => /^\d+$/.test(value)).map(Number);
  let sequence = Math.max(0, ...numbers) + 1;
  if (!Number.isSafeInteger(sequence)) throw new Error("当日单机编号超出范围。");
  const used = new Set(existing.map(unit => normalizeIdentifier(unit.code)));
  while (used.has(prefix + String(sequence).padStart(4, "0"))) sequence++;
  return prefix + String(sequence).padStart(4, "0");
}

export function changeRetailDraftCategory(draft: RetailUnit, category: RetailCategory): RetailUnit {
  if (draft.category === category) return draft;
  if (draft.id) throw new Error("已保存档案须逐项核对更正，不能清理整份资料。");
  if (!Object.hasOwn(retailCategories, category)) throw new Error("请选择有效商品类型。");
  return { ...draft, category, brand: "", model: "", color: "", serial: "", productCode: "", imei1: "", imei2: "",
    ramGb: null, bodyStorage: null, disks: [], cpu: "", gpu: "", keyboard: "", edition: "", controllers: null, batteryPercent: null };
}

export type RetailCommand =
  | { type: "edit"; change: RetailFieldEdit } | { type: "inspect"; checks: Inspection; note?: string }
  | { type: "price"; priceCents: number | null } | { type: "approve"; note?: string } | { type: "pause"; note?: string } | { type: "reinspect"; note?: string }
  | { type: "sell"; saleId: string; customerPhone: string; customerName: string; customerEmail?: string; customerAddress?: string; customerNote?: string; priceCents: number; warranty: RetailWarrantySnapshot; paymentUnreceived?: boolean }
  | { type: "reserve"; name: string; phone: string; until: string; note: string } | { type: "release_reservation" }
  | { type: "payment" | "refund"; saleId: string; entryId: string; amountCents: number; date: string; method: RetailPaymentMethod; note?: string }
  | { type: "payment_reconcile"; saleId: string; paidCents: number; reason: string }
  | { type: "payment_void" | "refund_void"; saleId: string; entryId: string; reason: string }
  | { type: "deliver"; saleId: string; deliveryDate: string; debt?: RetailDebtDelivery }
  | { type: "return"; saleId: string; date: string; reason: string; received: true }
  | { type: "after_sale"; saleId: string; caseId: string; date: string; issue: string; custody: RetailAfterSale["custody"] }
  | { type: "after_sale_assess"; saleId: string; caseId: string; coverage: RetailAfterSale["coverage"]; reason: string }
  | { type: "after_sale_link"; saleId: string; caseId: string; repairId: string }
  | { type: "after_sale_close"; saleId: string; caseId: string; date: string; resolution: string; returned: true }
  | { type: "after_sale_cancel"; saleId: string; caseId: string; reason: string }
  | { type: "photos"; photos: string[] };

export function currentRetailSale(unit: RetailUnit): RetailSale | undefined {
  return unit.currentSaleId ? unit.sales.find(sale => sale.id === unit.currentSaleId) : unit.sales.at(-1);
}
export function retailPaidCents(sale: RetailSale): number | null {
  if (sale.payments === undefined) return sale.paidCents;
  const opening = sale.paymentOpeningCents;
  if (opening === null || opening === undefined) return null;
  return opening + sale.payments.reduce((sum, item) => sum + (item.void ? 0 : item.amountCents), 0);
}
export function retailRefundedCents(sale: RetailSale): number {
  return (sale.refunds ?? []).reduce((sum, item) => sum + (item.void ? 0 : item.amountCents), 0);
}
export function retailDueCents(sale: RetailSale): number | null {
  const paid = retailPaidCents(sale); return paid === null ? null : sale.priceCents - paid;
}
export function isRetailReturnSettled(sale: RetailSale): boolean {
  const paid = retailPaidCents(sale); return !!sale.returned && paid !== null && paid === retailRefundedCents(sale);
}
export function retailSaleState(sale: RetailSale): "payment_unknown" | "awaiting_payment" | "awaiting_delivery" | "complete" | "partial_refund" | "return_pending_refund" | "returned" {
  if (sale.returned) return isRetailReturnSettled(sale) ? "returned" : "return_pending_refund";
  if (retailRefundedCents(sale) > 0) return "partial_refund";
  const due = retailDueCents(sale);
  return due === null ? "payment_unknown" : due > 0 ? "awaiting_payment" : !sale.delivered ? "awaiting_delivery" : "complete";
}
export function retailGrossProfit(priceCents: number | null | undefined, costCents: number | null | undefined, refurbCents: number | null | undefined): number | null {
  return priceCents == null || costCents == null || refurbCents == null ? null : priceCents - costCents - refurbCents;
}
export function retailSaleGrossProfit(sale: RetailSale): number | null {
  return retailGrossProfit(sale.priceCents - retailRefundedCents(sale), sale.costCents, sale.refurbCents);
}
export function saleProductUnit(unit: RetailUnit, sale: RetailSale): RetailUnit | null {
  if (!sale.product) return null;
  return { ...emptyRetailUnit(), ...structuredClone(sale.product), storeOwned: true, status: "sold", costCents: sale.costCents ?? null, refurbCents: sale.refurbCents ?? null, priceCents: sale.priceCents, warrantyMonths: sale.warranty?.months ?? null, sales: [structuredClone(sale)], currentSaleId: sale.id };
}
function frozenProduct(unit: RetailUnit): RetailProductSnapshot {
  const { id, code, category, brand, model, serial, imei1, imei2, productCode, color, ramGb, bodyStorage, disks, cpu, gpu, keyboard, edition, controllers, condition, grade, batteryPercent, accessories, knownIssues, photos } = unit;
  return structuredClone({ id, code, category, brand, model, serial, imei1, imei2, productCode, color, ramGb, bodyStorage, disks, cpu, gpu, keyboard, edition, controllers, condition, grade, batteryPercent, accessories, knownIssues, photos });
}
function actor(event: RetailEvent): RetailActor {
  return { ...(event.actorId === undefined ? {} : { actorId: event.actorId }), ...(event.actorName === undefined ? {} : { actorName: event.actorName }) };
}
function retailText(value: unknown, label: string, max = 5000, required = false): string {
  if (typeof value !== "string" || value.length > max || required && !value.trim()) throw new Error(`${label}须为${required ? "非空" : "有效"}文字，最多 ${max} 字。`);
  return value.trim();
}
function retailId(value: unknown): string {
  const id = retailText(value, "操作标识", 100, true);
  if (id !== value) throw new Error("操作标识不能包含首尾空格。");
  return id;
}
function retailAmount(value: unknown, label: string, zero = false): number {
  if (typeof value !== "number" || !Number.isSafeInteger(value) || value < (zero ? 0 : 1) || value > 100000000) throw new Error(`${label}须为有效整数分金额。`);
  return value;
}
function checkedBuyer(command: Extract<RetailCommand, { type: "sell" }>) {
  const customerName = retailText(command.customerName, "客户称呼", 80);
  const customerEmail = retailText(command.customerEmail ?? "", "客户邮箱", 160);
  if (customerEmail && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(customerEmail)) throw new Error("请核对客户邮箱格式。");
  return { customerPhone: normalizeCustomerPhone(command.customerPhone), customerName, customerEmail, customerAddress: retailText(command.customerAddress ?? "", "客户地址", 500), customerNote: retailText(command.customerNote ?? "", "客户备注") };
}
function saleDate(sale: RetailSale, date: string, event: RetailEvent, label: string): void {
  if (!isRetailDate(date) || !isRetailDate(sale.time.slice(0, 10)) || !isRetailDate(event.time.slice(0, 10)) || date < sale.time.slice(0, 10) || date > event.time.slice(0, 10)) throw new Error(`${label}日期须为销售登记日至今天之间的真实日期。`);
}
function requireReturnsSettled(unit: RetailUnit): void {
  if (unit.sales.some(sale => sale.returned && !isRetailReturnSettled(sale))) throw new Error("退回销售退款尚未结清，不能重新检测、上架或出售。");
  if (unit.sales.some(sale => sale.afterSales?.some(item => !item.closed && !item.cancelled))) throw new Error("仍有未关闭售后，请先完成关联维修并明确交还，或撤销未送机申请，再重新检测、上架或出售。");
}
function moneyRequest(command: Extract<RetailCommand, { type: "payment" | "refund" }>, sale: RetailSale, event: RetailEvent): RetailMoneyEntry {
  const id = retailId(command.entryId); const amountCents = retailAmount(command.amountCents, command.type === "payment" ? "收款" : "退款");
  saleDate(sale, command.date, event, command.type === "payment" ? "收款" : "退款");
  if (!["cash", "card", "transfer", "other"].includes(command.method)) throw new Error("请核对收退款方式。");
  return { id, amountCents, date: command.date, method: command.method, note: retailText(command.note ?? "", "款项备注", 5000, command.type === "refund"), eventId: event.id, ...actor(event) };
}
function sameMoney(first: RetailMoneyEntry, second: RetailMoneyEntry): boolean {
  return first.id === second.id && first.amountCents === second.amountCents && first.date === second.date && first.method === second.method && first.note === second.note;
}
function replayConflict(): never { throw new Error("操作标识已用于不同资料，请重新核对。"); }
function validateRetailActor(value: Record<string, unknown>): void {
  for (const key of ["actorId", "actorName"]) if (value[key] !== undefined) retailText(value[key], "操作人", 100, true);
}
export function validateRetailPhotos(photos: unknown): string[] {
  if (!Array.isArray(photos) || photos.length > 6) throw new Error("实物照片最多 6 张。");
  return photos.map(photo => {
    if (typeof photo !== "string" || photo.length > 350000) throw new Error("每张照片须为不超过 250 KiB 的 JPEG / PNG / WebP 图片。");
    const match = /^data:image\/(jpeg|png|webp);base64,([A-Za-z0-9+/]+={0,2})$/.exec(photo);
    if (!match || match[2].length % 4 !== 0) throw new Error("照片须为有效的本地 JPEG / PNG / WebP 图片，不能使用外部地址。");
    let bytes: string; try { bytes = atob(match[2]); } catch { throw new Error("照片编码异常。"); }
    const valid = match[1] === "jpeg" ? bytes.startsWith("\xff\xd8\xff") : match[1] === "png" ? bytes.startsWith("\x89PNG\r\n\x1a\n") : bytes.startsWith("RIFF") && bytes.slice(8, 12) === "WEBP";
    if (!valid || btoa(bytes) !== match[2] || bytes.length > 250 * 1024) throw new Error("照片内容或大小无效，请重新上传压缩后的实物照片。");
    return photo;
  });
}
export function applyRetailCommand(unit: RetailUnit, command: RetailCommand, event: RetailEvent, expectedVersion: number, others: RetailUnit[] = []) {
  if (!storedObject(command) || !["edit", "inspect", "price", "approve", "pause", "reinspect", "sell", "reserve", "release_reservation", "payment", "refund", "payment_reconcile", "payment_void", "refund_void", "deliver", "return", "after_sale", "after_sale_assess", "after_sale_link", "after_sale_close", "after_sale_cancel", "photos"].includes(command.type)) throw new Error("未知单机操作。");
  if (["inspect", "approve", "pause", "reinspect"].includes(command.type) && "note" in command && command.note !== undefined) {
    const required = command.type === "pause" || command.type === "reinspect";
    const note = retailText(command.note, "检测说明或状态变更原因", 5000, required);
    if (note) event = { ...event, detail: command.note };
  }
  validateRetailEvent(event);
  const target = "saleId" in command ? unit.sales.find(sale => sale.id === retailId(command.saleId)) : undefined;
  if (command.type !== "sell" && "saleId" in command && !target) throw new Error("请核对销售记录。");
  if (target && event.time.slice(0, 10) < target.time.slice(0, 10)) throw new Error("操作时间不能早于原销售。");
  if (command.type === "sell") {
    if (command.paymentUnreceived !== undefined && typeof command.paymentUnreceived !== "boolean") throw new Error("尚未收款须明确核对。");
    if (target) {
      const buyer = checkedBuyer(command);
      if (Object.entries(buyer).some(([key, value]) => (target[key as keyof RetailSale] ?? "") !== value) || target.priceCents !== command.priceCents || JSON.stringify(target.warranty ? validateRetailWarrantySnapshot(target.warranty) : undefined) !== JSON.stringify(validateRetailWarrantySnapshot(command.warranty)) || (target.paymentUnreceived === true) !== (command.paymentUnreceived === true)) replayConflict();
      return unit;
    }
  }
  if ((command.type === "payment" || command.type === "refund") && target) {
    const requested = moneyRequest(command, target, event);
    const previous = (command.type === "payment" ? target.payments : target.refunds)?.find(item => item.id === requested.id);
    if (previous) { if (!sameMoney(previous, requested)) replayConflict(); return unit; }
  }
  if ((command.type === "payment_void" || command.type === "refund_void") && target) {
    const previous = (command.type === "payment_void" ? target.payments : target.refunds)?.find(item => item.id === command.entryId);
    if (previous?.void) { if (previous.void.reason !== retailText(command.reason, "冲销原因", 5000, true)) replayConflict(); return unit; }
  }
  if (command.type === "payment_reconcile" && target?.paymentReconciliation) {
    if (target.paymentReconciliation.paidCents !== command.paidCents || target.paymentReconciliation.reason !== retailText(command.reason, "核对原因", 5000, true)) replayConflict();
    return unit;
  }
  if (command.type === "deliver" && target?.delivered) {
    if (target.deliveryDate === command.deliveryDate && sameRetailFieldValue(target.debtDelivery, command.debt)) return unit;
    throw new Error("交付已记录，不能覆盖原交付事实。");
  }
  if (command.type === "return" && target?.returned) {
    if (command.received !== true || target.returned.date !== command.date || target.returned.reason !== retailText(command.reason, "退回原因", 5000, true)) replayConflict();
    return unit;
  }
  const previousCase = target && "caseId" in command ? target.afterSales?.find(item => item.id === retailId(command.caseId)) : undefined;
  if (previousCase && event.time.slice(0, 10) < previousCase.date) throw new Error("操作时间不能早于售后接收日。");
  if (command.type === "after_sale" && previousCase) {
    if (previousCase.date !== command.date || previousCase.issue !== retailText(command.issue, "故障与诉求", 3000, true) || previousCase.custody !== command.custody) replayConflict();
    return unit;
  }
  if (command.type === "after_sale_assess" && previousCase) {
    const previous = previousCase.assessments?.find(item => item.eventId === event.id);
    if (previous) {
      if (previous.coverage !== command.coverage || previous.reason !== retailText(command.reason, "人工判断原因", 5000, true)) replayConflict();
      return unit;
    }
  }
  if (command.type === "after_sale_link" && previousCase?.repairId) {
    if (previousCase.repairId !== command.repairId) replayConflict(); return unit;
  }
  if (command.type === "after_sale_close" && previousCase?.closed) {
    if (previousCase.closed.date !== command.date || previousCase.closed.resolution !== retailText(command.resolution, "处理结果", 5000, true) || command.returned !== true) replayConflict(); return unit;
  }
  if (command.type === "after_sale_cancel" && previousCase?.cancelled) {
    if (previousCase.cancelled.reason !== retailText(command.reason, "撤销申请原因", 5000, true)) replayConflict(); return unit;
  }
  if (command.type === "reserve" && unit.reservation?.eventId === event.id) {
    const previous = unit.reservation;
    if (previous.name !== retailText(command.name, "预留称呼", 80) || previous.phone !== normalizeCustomerPhone(command.phone) || previous.until !== command.until || previous.note !== retailText(command.note, "预留备注")) replayConflict(); return unit;
  }
  if (unit.version !== expectedVersion) throw new Error("单机已被其他操作更新，请核对最新状态再提交。");
  if (unit.events.some(previous => previous.id === event.id)) throw new Error("重复操作未追加。");
  if (unit.events.length >= 1000) throw new Error("单机历史已达本地样板上限，现有资料未被覆盖。");
  let next = { ...unit };
  const replaceSale = (sale: RetailSale) => { next.sales = unit.sales.map(item => item.id === sale.id ? sale : item); };
  if (command.type === "edit") {
    next = validateRetailFieldEdit(unit, command.change, others);
    if (next === unit) return unit;
    if (command.change.field === "costCents" || command.change.field === "refurbCents") event = { ...event, sensitive: "financial" };
  } else if (command.type === "deliver" && target) {
    if (unit.status !== "sold" || currentRetailSale(unit)?.id !== target.id || target.returned) throw new Error("请核对当前已售单机与销售记录。");
    saleDate(target, command.deliveryDate, event, "交付");
    const due = retailDueCents(target);
    if (due === null) throw new Error("旧付款尚未核对，不能交付。");
    let debtDelivery: RetailDebtDelivery | undefined;
    if (due > 0) {
      if (!command.debt) throw new Error("尚未结清，须获授权后明确欠款放行。");
      if (!storedObject(command.debt) || Object.keys(command.debt).sort().join(",") !== "followUp,owner,reason") throw new Error("请完整填写欠款原因、责任人与跟进日。");
      debtDelivery = { reason: retailText(command.debt.reason, "欠款原因", 5000, true), owner: retailText(command.debt.owner, "跟进责任人", 100, true), followUp: command.debt.followUp };
      if (!isRetailDate(debtDelivery.followUp) || debtDelivery.followUp < command.deliveryDate) throw new Error("欠款跟进日须为不早于交付日的真实日期。");
    } else if (command.debt !== undefined) throw new Error("已结清销售不需欠款放行。");
    replaceSale({ ...target, delivered: true, deliveryDate: command.deliveryDate, deliveryEventId: event.id, ...(debtDelivery ? { debtDelivery } : {}) });
  } else if (command.type === "sell") {
    requireReturnsSettled(unit);
    if (!["available", "reserved"].includes(unit.status)) throw new Error("只有可售或已核对预留的单机可以登记售出，请先核对检测与状态。");
    if (!unit.storeOwned || !unit.inspection.functional || !unit.inspection.ownership || !unit.inspection.data) throw new Error("请先完成本台所有权及检测核验。");
    if (unit.priceCents === null || unit.priceCents <= 0) throw new Error("请先确认有效售价。");
    retailId(command.saleId); retailAmount(command.priceCents, "成交价");
    if (unit.sales.length >= 1000) throw new Error("销售记录已达本地样板上限。");
    const buyer = checkedBuyer(command);
    if (unit.status === "reserved" && (!unit.reservation?.phone || unit.reservation.phone !== buyer.customerPhone)) throw new Error("预留买家尚未核对，请先解除预留或核对同一买家。");
    const warranty = validateRetailWarrantySnapshot(command.warranty);
    if (warranty.months !== unit.warrantyMonths) throw new Error("商家保修期限已变化，请核对单机最新资料。");
    next.status = "sold"; next.reservation = null; next.currentSaleId = command.saleId;
    const opening = command.paymentUnreceived === true ? 0 : null;
    next.sales = [...unit.sales, { id: command.saleId, time: event.time, ...buyer, priceCents: command.priceCents, paidCents: opening, paymentUnreceived: command.paymentUnreceived === true, paymentOpeningCents: opening, payments: [], refunds: [], afterSales: [], delivered: false, product: frozenProduct(unit), costCents: unit.costCents, refurbCents: unit.refurbCents, warranty, note: command.paymentUnreceived === true ? "本次已明确核对尚未收款；交付未确认。" : "本地售出登记；收款及交付未确认。" }];
  } else if ((command.type === "payment" || command.type === "refund") && target) {
    const paid = retailPaidCents(target);
    if (paid === null) throw new Error("付款未知，请先明确核对旧累计实收。");
    const item = moneyRequest(command, target, event);
    const ledger = command.type === "payment" ? target.payments ?? [] : target.refunds ?? [];
    if (ledger.length >= 1000) throw new Error("款项记录已达本地样板上限。");
    if ((target.payments ?? []).some(entry => entry.id === item.id) || (target.refunds ?? []).some(entry => entry.id === item.id)) replayConflict();
    if (command.type === "payment") {
      if (target.returned) throw new Error("已退回销售不能追加收款。");
      if (paid + item.amountCents > target.priceCents) throw new Error("累计收款不能超过成交价。");
      replaceSale({ ...target, paymentOpeningCents: target.payments === undefined ? paid : target.paymentOpeningCents, payments: [...ledger, item], paidCents: paid + item.amountCents });
    } else {
      if (retailRefundedCents(target) + item.amountCents > paid) throw new Error("累计退款不能超过有效实收。");
      replaceSale({ ...target, refunds: [...ledger, item] });
    }
  } else if (command.type === "payment_reconcile" && target) {
    if (retailPaidCents(target) !== null) throw new Error("累计实收已明确，不能覆盖原收款事实。");
    const paidCents = retailAmount(command.paidCents, "核对累计实收", true);
    if (paidCents > target.priceCents || paidCents < retailRefundedCents(target)) throw new Error("核对实收须不超过成交价且不低于有效退款。");
    const reason = retailText(command.reason, "核对原因", 5000, true);
    replaceSale({ ...target, paidCents, paymentOpeningCents: paidCents, payments: target.payments ?? [], paymentReconciliation: { paidCents, reason, eventId: event.id, time: event.time, ...actor(event) } });
  } else if ((command.type === "payment_void" || command.type === "refund_void") && target) {
    retailId(command.entryId);
    const ledger = command.type === "payment_void" ? target.payments : target.refunds;
    if (!ledger?.some(item => item.id === command.entryId)) throw new Error("找不到原款项记录。");
    const originalEvent = unit.events.find(item => item.id === ledger.find(item => item.id === command.entryId)!.eventId);
    if (!originalEvent || event.time.slice(0, 10) < originalEvent.time.slice(0, 10)) throw new Error("冲销时间不能早于原款项记录。");
    const reason = retailText(command.reason, "冲销原因", 5000, true);
    const changed = ledger.map(item => item.id === command.entryId ? { ...item, void: { reason, eventId: event.id, time: event.time, ...actor(event) } } : item);
    const sale = command.type === "payment_void" ? { ...target, payments: changed } : { ...target, refunds: changed };
    const paid = retailPaidCents(sale);
    if (paid === null || paid < retailRefundedCents(sale)) throw new Error("冲销后有效实收不能低于已退款。");
    sale.paidCents = paid;
    if (target.returned && !isRetailReturnSettled(sale) && (unit.status !== "hold" || currentRetailSale(unit)?.id !== target.id)) throw new Error("单机已重新检测、上架或复售，不能冲销已结清的退回退款。");
    replaceSale(sale);
  } else if (command.type === "return" && target) {
    if (unit.status !== "sold" || currentRetailSale(unit)?.id !== target.id) throw new Error("只能登记当前销售对应的实物退回。");
    if (target.afterSales?.some(item => !item.closed && !item.cancelled)) throw new Error("该销售仍有未关闭售后，请先完成关联维修并明确交还，或撤销未送机申请，再登记实物退回。");
    if (command.received !== true) throw new Error("须明确核对实物已收到，才可登记退回。");
    saleDate(target, command.date, event, "退回");
    if (target.deliveryDate && command.date < target.deliveryDate) throw new Error("退回日期不能早于实际交付日。");
    replaceSale({ ...target, returned: { date: command.date, reason: retailText(command.reason, "退回原因", 5000, true), received: true, eventId: event.id, ...actor(event) } });
    next.status = "hold"; next.inspection = { functional: false, ownership: false, data: false }; next.reservation = null;
  } else if (command.type === "after_sale" && target) {
    if (unit.status !== "sold" || currentRetailSale(unit)?.id !== target.id || target.returned) throw new Error("只能接收当前未退回销售的设备售后；旧售后历史保留供核对。");
    saleDate(target, command.date, event, "售后接收");
    if (!["left", "not_left"].includes(command.custody)) throw new Error("请明确设备是否留下。");
    if ((target.afterSales ?? []).length >= 100) throw new Error("售后记录已达本地样板上限。");
    const afterSale: RetailAfterSale = { id: retailId(command.caseId), date: command.date, issue: retailText(command.issue, "故障与诉求", 3000, true), custody: command.custody, coverage: "pending", eventId: event.id, ...actor(event) };
    replaceSale({ ...target, afterSales: [...target.afterSales ?? [], afterSale] });
  } else if ((command.type === "after_sale_assess" || command.type === "after_sale_link" || command.type === "after_sale_close" || command.type === "after_sale_cancel") && target) {
    if (!previousCase) throw new Error("请核对原售后记录。");
    if (previousCase.closed) throw new Error("售后已明确关闭，不能覆盖原处理事实。");
    if (previousCase.cancelled) throw new Error("售后申请已撤销，不能继续建立维修或覆盖原事实。");
    let updated: RetailAfterSale;
    if (command.type === "after_sale_cancel") {
      if (previousCase.custody !== "not_left" || previousCase.repairId) throw new Error("只能撤销未送机且未关联维修的申请；已收机须完成维修并明确交还。");
      updated = { ...previousCase, cancelled: { reason: retailText(command.reason, "撤销申请原因", 5000, true), eventId: event.id, time: event.time, ...actor(event) } };
    } else if (command.type === "after_sale_assess") {
      if (!["pending", "commercial", "statutory", "paid"].includes(command.coverage)) throw new Error("请核对保修或收费判断。");
      if ((previousCase.assessments ?? []).length >= 100) throw new Error("人工判断记录已达本地样板上限。");
      const reason = retailText(command.reason, "人工判断原因", 5000, true);
      updated = { ...previousCase, coverage: command.coverage, assessmentReason: reason, assessmentEventId: event.id, assessments: [...previousCase.assessments ?? [], { coverage: command.coverage, reason, eventId: event.id, time: event.time, ...actor(event) }] };
    } else if (command.type === "after_sale_link") {
      updated = { ...previousCase, repairId: retailId(command.repairId), linkEventId: event.id };
    } else {
      if (!previousCase.repairId || command.returned !== true) throw new Error("须关联已完成维修并明确交还设备，才能关闭售后。");
      saleDate(target, command.date, event, "售后关闭");
      if (command.date < previousCase.date) throw new Error("关闭日期不能早于售后接收日。");
      updated = { ...previousCase, closed: { date: command.date, resolution: retailText(command.resolution, "处理结果", 5000, true), returned: true, eventId: event.id, ...actor(event) } };
    }
    replaceSale({ ...target, afterSales: target.afterSales!.map(item => item.id === updated.id ? updated : item) });
  } else if (command.type === "reserve") {
    requireReturnsSettled(unit);
    if (unit.status !== "available") throw new Error("只有可售单机可以预留。");
    if (!isRetailDate(command.until) || command.until < event.time.slice(0, 10)) throw new Error("预留截止日须为今天或以后的真实日期。");
    next.reservation = { name: retailText(command.name, "预留称呼", 80), phone: normalizeCustomerPhone(command.phone), until: command.until, note: retailText(command.note, "预留备注"), eventId: event.id }; next.status = "reserved";
  } else if (command.type === "release_reservation") {
    if (unit.status !== "reserved" || !unit.reservation) throw new Error("当前单机没有可解除的预留。");
    requireReturnsSettled(unit); next.reservation = null; next.status = "available";
  } else if (command.type === "photos") {
    if (!["inspecting", "available", "hold"].includes(unit.status)) throw new Error("预留或已售单机照片已锁定。");
    next.photos = validateRetailPhotos(command.photos);
    if (sameRetailFieldValue(next.photos, unit.photos)) return unit;
  } else if (command.type === "price") {
    if (!["inspecting", "hold"].includes(unit.status)) throw new Error("请先暂停或解除占用，再更正待售资料。");
    if (command.priceCents !== null) retailAmount(command.priceCents, "标价", true);
    next.priceCents = command.priceCents;
  } else if (command.type === "inspect") {
    if (unit.status !== "inspecting") throw new Error("仅待检测单机可以记录本轮检测。");
    if (!storedObject(command.checks) || Object.keys(command.checks).sort().join(",") !== "data,functional,ownership" || !Object.values(command.checks).every(value => typeof value === "boolean")) throw new Error("三项检测须明确核对。");
    next.inspection = { ...command.checks };
  } else if (command.type === "approve") {
    requireReturnsSettled(unit);
    if (unit.status !== "inspecting") throw new Error("请从待检测状态明确设为可售。");
    if (!unit.storeOwned || !unit.inspection.functional || !unit.inspection.ownership || !unit.inspection.data) throw new Error("功能、所有权与账号、数据处理三项检查必须全部完成。");
    if (unit.priceCents === null || unit.priceCents <= 0) throw new Error("请先确认有效售价；当前单机不能设为可售。");
    next.status = "available";
  } else if (command.type === "pause") {
    if (!["available", "inspecting"].includes(unit.status)) throw new Error("只有可售或待检测单机可暂停；预留、已售记录不能直接改状态。");
    next.status = "hold";
  } else if (command.type === "reinspect") {
    requireReturnsSettled(unit);
    if (unit.status !== "hold") throw new Error("只有暂停单机可以重新检测。");
    next.status = "inspecting"; next.inspection = { functional: false, ownership: false, data: false };
  } else throw new Error("未知单机操作。");
  return { ...next, version: unit.version + 1, events: [...unit.events, event] };
}

function validateRetailEvent(event: unknown): asserts event is RetailEvent {
  if (!storedObject(event)) throw new Error("操作资料异常。");
  retailId(event.id); retailText(event.title, "操作标题", 200, true); retailText(event.detail, "检测说明或状态变更原因", 5000, true); retailText(event.time, "操作时间", 100, true);
  if (!isRetailDate((event.time as string).slice(0, 10))) throw new Error("操作时间须包含真实日期。");
  validateRetailActor(event);
  if (event.sensitive !== undefined && event.sensitive !== "financial") throw new Error("历史敏感分类异常。");
}

function storedObject(value: unknown): value is Record<string, unknown> { return !!value && typeof value === "object" && !Array.isArray(value); }
function storedMoney(value: unknown) { return value === null || (typeof value === "number" && Number.isSafeInteger(value) && value >= 0 && value <= 100000000); }
const saleKeys = new Set(["id", "time", "priceCents", "paidCents", "delivered", "note", "customerPhone", "customerName", "customerEmail", "customerAddress", "customerNote", "costCents", "refurbCents", "warranty", "deliveryDate", "deliveryEventId", "product", "paymentUnreceived", "paymentOpeningCents", "payments", "refunds", "paymentReconciliation", "returned", "debtDelivery", "afterSales"]);
function objectKeys(value: Record<string, unknown>, required: string[], optional: string[] = []): void {
  if (!required.every(key => Object.hasOwn(value, key)) || Object.keys(value).some(key => !required.includes(key) && !optional.includes(key))) throw new Error("本地销售资料字段异常。");
}
function storedEventFact(value: Record<string, unknown>, events: RetailEvent[], sale: RetailSale, date?: string): RetailEvent {
  const event = events.find(item => item.id === retailId(value.eventId));
  if (!event) throw new Error("本地销售事实缺少对应历史。");
  validateRetailActor(value);
  if (date !== undefined) saleDate(sale, date, event, "销售事实");
  return event;
}
function validateStoredLedger(value: unknown, sale: RetailSale, events: RetailEvent[]): RetailMoneyEntry[] {
  if (!Array.isArray(value) || value.length > 1000) throw new Error("本地款项记录格式或数量异常。");
  for (const entry of value) {
    if (!storedObject(entry)) throw new Error("本地款项记录格式异常。");
    objectKeys(entry, ["id", "amountCents", "date", "method", "note", "eventId"], ["actorId", "actorName", "void"]);
    retailId(entry.id); retailAmount(entry.amountCents, "款项"); retailText(entry.note, "款项备注");
    if (typeof entry.date !== "string" || !["cash", "card", "transfer", "other"].includes(String(entry.method))) throw new Error("本地款项日期或方式异常。");
    const created = storedEventFact(entry, events, sale, entry.date);
    if (entry.void !== undefined) {
      if (!storedObject(entry.void)) throw new Error("本地款项冲销格式异常。");
      objectKeys(entry.void, ["reason", "eventId", "time"], ["actorId", "actorName"]);
      retailText(entry.void.reason, "冲销原因", 5000, true);
      const event = storedEventFact(entry.void, events, sale);
      if (entry.void.time !== event.time || event.time.slice(0, 10) < created.time.slice(0, 10)) throw new Error("本地款项冲销时间异常。");
    }
  }
  if (new Set(value.map(item => item.id)).size !== value.length) throw new Error("本地款项标识重复。");
  return value as RetailMoneyEntry[];
}
function validateStoredSale(value: unknown, unit: RetailUnit): asserts value is RetailSale {
  if (!storedObject(value) || Object.keys(value).some(key => !saleKeys.has(key))) throw new Error("本地销售记录格式异常。");
  retailId(value.id); retailText(value.time, "销售时间", 100, true); retailText(value.note, "销售备注");
  if (!isRetailDate((value.time as string).slice(0, 10)) || typeof value.delivered !== "boolean" || !storedMoney(value.priceCents) || value.priceCents === null || !storedMoney(value.paidCents)) throw new Error("本地销售记录格式异常。");
  const sale = value as RetailSale;
  if (sale.warranty !== undefined) validateRetailWarrantySnapshot(sale.warranty);
  if (sale.deliveryDate !== undefined && (typeof sale.deliveryDate !== "string" || !sale.delivered || !isRetailDate(sale.deliveryDate) || sale.deliveryDate < sale.time.slice(0, 10))) throw new Error("本地销售交付日期异常。");
  if (sale.deliveryEventId !== undefined) {
    if (!sale.delivered || !sale.deliveryDate) throw new Error("本地交付缺少实际日期。");
    storedEventFact({ eventId: sale.deliveryEventId }, unit.events, sale, sale.deliveryDate);
  }
  if (sale.customerPhone !== undefined && (typeof sale.customerPhone !== "string" || normalizeCustomerPhone(sale.customerPhone) !== sale.customerPhone)) throw new Error("本地销售客户手机号格式异常。");
  for (const [key, max] of [["customerName", 80], ["customerEmail", 254], ["customerAddress", 500], ["customerNote", 5000]] as const) if (sale[key] !== undefined) retailText(sale[key], "客户资料", max);
  if (sale.customerEmail && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(sale.customerEmail)) throw new Error("本地销售邮箱格式异常。");
  if (sale.costCents !== undefined && !storedMoney(sale.costCents) || sale.refurbCents !== undefined && !storedMoney(sale.refurbCents)) throw new Error("本地销售成本快照格式异常。");
  if (sale.product !== undefined) {
    if (!storedObject(sale.product)) throw new Error("本地销售商品快照格式异常。");
    const keys = Object.keys(frozenProduct(emptyRetailUnit()));
    objectKeys(sale.product, keys);
    if (sale.product.id !== unit.id) throw new Error("本地商品快照与实物身份不符。");
    const productUnit = { ...emptyRetailUnit(), ...sale.product, storeOwned: true } as RetailUnit;
    for (const key of Object.keys(retailFieldLabels) as RetailEditableField[]) checkedRetailFieldValue(key, productUnit[key]);
    validateRetailUnit(productUnit);
  }
  if (sale.paymentUnreceived !== undefined && (typeof sale.paymentUnreceived !== "boolean" || sale.paymentUnreceived === true && sale.paymentOpeningCents !== 0)) throw new Error("本地未收款确认事实异常。");
  if (sale.payments !== undefined) {
    validateStoredLedger(sale.payments, sale, unit.events);
    if (!storedMoney(sale.paymentOpeningCents)) throw new Error("本地收款起始事实格式异常。");
    if (sale.paymentOpeningCents === null && sale.payments.length > 0) throw new Error("未知旧累计不能追加收款。");
    if (sale.paidCents !== retailPaidCents(sale)) throw new Error("本地累计实收与账本不符。");
  } else if (sale.paymentOpeningCents !== undefined) throw new Error("本地收款起始事实缺少账本。");
  if (sale.refunds !== undefined) validateStoredLedger(sale.refunds, sale, unit.events);
  const paid = retailPaidCents(sale); const refunded = retailRefundedCents(sale);
  if (paid !== null && paid > sale.priceCents || refunded > 0 && (paid === null || refunded > paid)) throw new Error("本地收退款累计异常。");
  const moneyIds = [...sale.payments ?? [], ...sale.refunds ?? []].map(item => item.id);
  if (new Set(moneyIds).size !== moneyIds.length) throw new Error("本地收退款标识重复。");
  if (sale.paymentReconciliation !== undefined) {
    if (!storedObject(sale.paymentReconciliation)) throw new Error("本地款项核对格式异常。");
    objectKeys(sale.paymentReconciliation, ["paidCents", "reason", "eventId", "time"], ["actorId", "actorName"]);
    retailAmount(sale.paymentReconciliation.paidCents, "核对实收", true); retailText(sale.paymentReconciliation.reason, "核对原因", 5000, true);
    const event = storedEventFact(sale.paymentReconciliation, unit.events, sale);
    if (sale.paymentReconciliation.time !== event.time || sale.paymentReconciliation.paidCents !== sale.paymentOpeningCents || event.time.slice(0, 10) < sale.time.slice(0, 10)) throw new Error("本地款项核对事实异常。");
  }
  if (sale.returned !== undefined) {
    if (!storedObject(sale.returned)) throw new Error("本地退回事实格式异常。");
    objectKeys(sale.returned, ["date", "reason", "received", "eventId"], ["actorId", "actorName"]);
    if (sale.returned.received !== true || typeof sale.returned.date !== "string") throw new Error("本地退回实物事实异常。");
    retailText(sale.returned.reason, "退回原因", 5000, true); storedEventFact(sale.returned, unit.events, sale, sale.returned.date);
    if (sale.deliveryDate && sale.returned.date < sale.deliveryDate) throw new Error("本地退回日期异常。");
  }
  if (sale.debtDelivery !== undefined) {
    if (!storedObject(sale.debtDelivery) || !sale.delivered || !sale.deliveryDate) throw new Error("本地欠款交付格式异常。");
    objectKeys(sale.debtDelivery, ["reason", "owner", "followUp"]);
    retailText(sale.debtDelivery.reason, "欠款原因", 5000, true); retailText(sale.debtDelivery.owner, "责任人", 100, true);
    if (!isRetailDate(sale.debtDelivery.followUp) || sale.debtDelivery.followUp < sale.deliveryDate) throw new Error("本地欠款跟进日期异常。");
  }
  if (sale.afterSales !== undefined) {
    if (!Array.isArray(sale.afterSales) || sale.afterSales.length > 100) throw new Error("本地售后格式或数量异常。");
    for (const item of sale.afterSales) {
      if (!storedObject(item)) throw new Error("本地售后格式异常。");
      objectKeys(item, ["id", "date", "issue", "custody", "coverage", "eventId"], ["actorId", "actorName", "assessmentReason", "assessmentEventId", "assessments", "repairId", "linkEventId", "closed", "cancelled"]);
      retailId(item.id); retailText(item.issue, "故障诉求", 5000, true);
      if (typeof item.date !== "string" || !["left", "not_left"].includes(String(item.custody)) || !["pending", "commercial", "statutory", "paid"].includes(String(item.coverage))) throw new Error("本地售后状态异常。");
      storedEventFact(item, unit.events, sale, item.date);
      if (item.assessmentReason !== undefined || item.assessmentEventId !== undefined) {
        retailText(item.assessmentReason, "人工判断原因", 5000, true); storedEventFact({ eventId: item.assessmentEventId }, unit.events, sale);
      } else if (item.coverage !== "pending") throw new Error("本地售后缺少人工判断。");
      if (item.assessments !== undefined) {
        if (!Array.isArray(item.assessments) || item.assessments.length === 0 || item.assessments.length > 100) throw new Error("本地人工判断历史异常。");
        for (const assessment of item.assessments) {
          if (!storedObject(assessment)) throw new Error("本地人工判断格式异常。");
          objectKeys(assessment, ["coverage", "reason", "eventId", "time"], ["actorId", "actorName"]);
          if (!["pending", "commercial", "statutory", "paid"].includes(String(assessment.coverage))) throw new Error("本地人工判断状态异常。");
          retailText(assessment.reason, "判断原因", 5000, true);
          const event = storedEventFact(assessment, unit.events, sale);
          if (assessment.time !== event.time || event.time.slice(0, 10) < item.date) throw new Error("本地人工判断时间异常。");
        }
        const last = item.assessments.at(-1)!;
        if (new Set(item.assessments.map(assessment => assessment.eventId)).size !== item.assessments.length || last.coverage !== item.coverage || last.reason !== item.assessmentReason || last.eventId !== item.assessmentEventId) throw new Error("本地人工判断汇总与历史不符。");
      }
      if (item.repairId !== undefined || item.linkEventId !== undefined) { retailId(item.repairId); storedEventFact({ eventId: item.linkEventId }, unit.events, sale); }
      if (item.closed !== undefined) {
        if (!storedObject(item.closed) || !item.repairId || item.closed.returned !== true || typeof item.closed.date !== "string" || item.closed.date < item.date) throw new Error("本地售后关闭事实异常。");
        objectKeys(item.closed, ["date", "resolution", "returned", "eventId"], ["actorId", "actorName"]);
        retailText(item.closed.resolution, "处理结果", 5000, true); storedEventFact(item.closed, unit.events, sale, item.closed.date);
      }
      if (item.cancelled !== undefined) {
        if (!storedObject(item.cancelled) || item.closed || item.repairId || item.custody !== "not_left") throw new Error("本地售后撤销事实异常。");
        objectKeys(item.cancelled, ["reason", "eventId", "time"], ["actorId", "actorName"]);
        retailText(item.cancelled.reason, "撤销原因", 5000, true);
        const event = storedEventFact(item.cancelled, unit.events, sale);
        if (item.cancelled.time !== event.time || event.time.slice(0, 10) < item.date) throw new Error("本地售后撤销时间异常。");
      }
    }
    if (new Set(sale.afterSales.map(item => item.id)).size !== sale.afterSales.length) throw new Error("本地售后标识重复。");
  }
}
export function parseStoredRetailUnits(raw: string | null, defaults: readonly RetailUnit[]): RetailUnit[] {
  if (raw === null) return [...defaults];
  const data: unknown = JSON.parse(raw);
  if (!storedObject(data) || data.version !== 1 || !Array.isArray(data.units) || data.units.length > 500) throw new Error("本地单机资料格式异常，现有资料未被覆盖。");
  const units = data.units.map((value: unknown) => {
    if (!storedObject(value)) throw new Error("本地单机资料格式异常。");
    for (const [key, initial] of Object.entries(emptyRetailUnit())) if (typeof initial === "string" && (typeof value[key] !== "string" || (value[key] as string).length > 5000)) throw new Error("本地单机资料格式异常。");
    if (!value.id || !value.code || !Number.isSafeInteger(value.version) || Number(value.version) < 1 || !Object.hasOwn(retailStatuses, String(value.status)) || !["新机", "翻新机", "全新", "二手", "整备"].includes(String(value.condition)) || !["S", "A", "B", "C", "待评估"].includes(String(value.grade)) || !storedObject(value.inspection) || Object.keys(value.inspection).sort().join(",") !== "data,functional,ownership" || !Object.values(value.inspection).every(item => typeof item === "boolean") || !Array.isArray(value.events) || value.events.length > 1000 || !Array.isArray(value.sales) || value.sales.length > 1000) throw new Error("本地单机资料格式异常。");
    validateRetailPhotos(value.photos);
    for (const event of value.events) validateRetailEvent(event);
    if (value.reservation !== null) {
      if (!storedObject(value.reservation)) throw new Error("本地单机预留资料格式异常。");
      objectKeys(value.reservation, ["name", "until"], ["phone", "note", "eventId"]);
      retailText(value.reservation.name, "预留称呼", 80);
      if (typeof value.reservation.until !== "string" || !isRetailDate(value.reservation.until)) throw new Error("本地预留日期异常。");
      if (value.reservation.phone !== undefined && (typeof value.reservation.phone !== "string" || normalizeCustomerPhone(value.reservation.phone) !== value.reservation.phone)) throw new Error("本地预留号码格式异常。");
      if (value.reservation.note !== undefined) retailText(value.reservation.note, "预留备注");
      const reservationEventId = value.reservation.eventId;
      if (reservationEventId !== undefined && !value.events.some(event => (event as RetailEvent).id === reservationEventId)) throw new Error("本地预留缺少对应历史。");
    }
    if (new Set(value.sales.map(sale => (sale as RetailSale).id)).size !== value.sales.length || new Set(value.events.map(event => (event as RetailEvent).id)).size !== value.events.length) throw new Error("本地单机历史标识重复。");
    const unit = { ...value, condition: value.condition === "全新" ? "新机" : ["二手", "整备"].includes(String(value.condition)) ? "翻新机" : value.condition, warrantyMonths: value.warrantyMonths === undefined ? 12 : value.warrantyMonths } as RetailUnit;
    for (const key of Object.keys(retailFieldLabels) as RetailEditableField[]) checkedRetailFieldValue(key, unit[key]);
    validateRetailUnit(unit);
    for (const sale of unit.sales) validateStoredSale(sale, unit);
    if (unit.currentSaleId !== undefined && (typeof unit.currentSaleId !== "string" || currentRetailSale(unit)?.id !== unit.sales.at(-1)?.id || !unit.sales.some(sale => sale.id === unit.currentSaleId))) throw new Error("本地当前销售标识异常。");
    if (unit.status !== "hold" && unit.sales.some(sale => sale.returned && !isRetailReturnSettled(sale))) throw new Error("本地退回退款未结清，单机状态异常。");
    if (unit.currentSaleId && unit.status === "sold" && currentRetailSale(unit)?.returned) throw new Error("本地退回单机状态异常。");
    return unit;
  });
  if (new Set(units.map(unit => unit.id)).size !== units.length) throw new Error("本地单机编号重复。");
  const saleIds = units.flatMap(unit => unit.sales.map(sale => sale.id));
  if (new Set(saleIds).size !== saleIds.length) throw new Error("本地销售标识重复。");
  for (const unit of units) validateRetailUnit(unit, units);
  return units;
}

export function validateRetailWarrantyMonths(value: unknown): number | null {
  if (value === null) return null;
  if (typeof value !== "number" || !Number.isSafeInteger(value) || value < 1 || value > 120) throw new Error("商家保修期限须为 1–120 个整数月，或明确不提供额外商家保修。");
  return value;
}
export function retailWarrantyLabel(months: number | null): string {
  return months === null ? "无额外商家保修" : months % 12 === 0 ? String(months / 12) + " 年" : String(months) + " 个月";
}
export function validateRetailWarrantySnapshot(value: unknown): RetailWarrantySnapshot {
  if (!storedObject(value) || Object.keys(value).sort().join(",") !== "address,months,phone,shopName,termsVersion" || value.termsVersion !== retailWarrantyTermsVersion || !["shopName", "address", "phone"].every(key => typeof value[key] === "string" && (value[key] as string).length <= 200) || !(value.shopName as string).trim() || !(value.address as string).trim()) throw new Error("请核对保修条款版本及完整的门店名称、地址。");
  return { months: validateRetailWarrantyMonths(value.months), termsVersion: retailWarrantyTermsVersion, shopName: (value.shopName as string).trim(), address: (value.address as string).trim(), phone: (value.phone as string).trim() };
}
export function isRetailDate(value: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value) || value.slice(0, 4) === "0000") return false;
  const date = new Date(value + "T00:00:00Z");
  return Number.isFinite(date.getTime()) && date.toISOString().slice(0, 10) === value;
}
// The period ends at the calendar anniversary; month-end dates clamp to that month's last day.
export function retailWarrantyExpiry(deliveryDate: string, months: number | null): string | null {
  if (!isRetailDate(deliveryDate)) throw new Error("请核对实际交付日期。");
  if (validateRetailWarrantyMonths(months) === null) return null;
  const start = new Date(deliveryDate + "T00:00:00Z");
  const day = start.getUTCDate(); start.setUTCDate(1); start.setUTCMonth(start.getUTCMonth() + months!);
  const last = new Date(start.getTime()); last.setUTCMonth(last.getUTCMonth() + 1); last.setUTCDate(0);
  start.setUTCDate(Math.min(day, last.getUTCDate()));
  return start.toISOString().slice(0, 10);
}

export type RetailCodeType = "internal" | "serial" | "imei" | "product";
export function lookupRetailCode(units: RetailUnit[], raw: string, type: RetailCodeType) {
  const normalized = type === "imei" ? normalizeImei(raw) : normalizeIdentifier(raw);
  if (!normalized) return [];
  return units.filter((unit) => type === "internal" ? normalizeIdentifier(unit.code) === normalized : type === "serial" ? normalizeIdentifier(unit.serial) === normalized : type === "imei" ? [unit.imei1, unit.imei2].map(normalizeImei).includes(normalized) : normalizeIdentifier(unit.productCode) === normalized);
}
import { normalizeCustomerPhone } from "./customers";
