import type { RepairDirectoryEntry } from "./repair-intake-record";
import type { RetailUnit } from "./retail";

/** Italy is the local dialing default. Explicit foreign country codes stay distinct. */
export function normalizeCustomerPhone(raw: string): string {
  const value = raw.normalize("NFKC").trim();
  if (!value || value.length > 40 || !/^(?:\+|00)?[\d\s().-]+$/.test(value)) throw new Error("请填写有效手机号，外国号码须包含区号。");
  const digits = value.replace(/\D/g, "");
  const international = value.startsWith("+") ? digits : value.startsWith("00") ? digits.slice(2) : `39${digits}`;
  if (!/^[1-9]\d{6,14}$/.test(international) || (!value.startsWith("+") && !value.startsWith("00") && digits.length < 7)) throw new Error("请填写有效手机号（7–15 位数字）。");
  return `+${international}`;
}
export function customerId(phone: string) { return `PHONE-${normalizeCustomerPhone(phone).slice(1)}`; }
export function customerName(raw: string) { return ["未填写姓名", "未填写称呼", "未记录"].includes(raw.trim()) ? "" : raw.trim(); }
export type CustomerProfile = { phone: string; name: string; email: string; note: string; version: number; updatedAt: string };
export type CustomerSeed = { phone: string; name: string; email?: string };
export type CustomerSaleRecord = { id: string; unitId: string; unitCode: string; deviceName: string; time: string; priceCents: number; paidCents: number | null; delivered: boolean; note: string; refundedCents?:number; returned?:boolean; afterSaleCount?:number };
export type Customer = CustomerProfile & { id: string; repairs: RepairDirectoryEntry[]; sales: CustomerSaleRecord[]; lastActivity: string };

export function buildCustomerDirectory(repairs: readonly RepairDirectoryEntry[], units: readonly RetailUnit[], profiles: readonly CustomerProfile[] = [], seeds: readonly CustomerSeed[] = []): Customer[] {
  const directory = new Map<string, Customer>();
  function get(phone: string) {
    let normalized: string;
    try { normalized = normalizeCustomerPhone(phone); } catch { return null; }
    let record = directory.get(normalized);
    if (!record) { record = { id: customerId(normalized), phone: normalized, name: "", email: "", note: "", version: 0, updatedAt: "", repairs: [], sales: [], lastActivity: "" }; directory.set(normalized, record); }
    return record;
  }
  for (const seed of seeds) { const record = get(seed.phone); if (record) { if (customerName(seed.name)) record.name = customerName(seed.name); if (seed.email) record.email = seed.email; } }
  for (const repair of [...repairs].sort((a,b) => a.createdAt.localeCompare(b.createdAt))) {
    const record = get(repair.customer.phone); if (!record) continue;
    record.repairs.push(repair);
    if (customerName(repair.customer.name)) record.name = customerName(repair.customer.name);
    record.lastActivity = [record.lastActivity, repair.updatedAt || repair.createdAt].sort().at(-1)!;
  }
  const sales = units.flatMap(unit => unit.sales.map(sale => ({ unit, sale }))).sort((a,b) => a.sale.time.localeCompare(b.sale.time));
  for (const { unit, sale } of sales) {
    if (!sale.customerPhone) continue; // Earlier fixture history has no customer identity.
    const record = get(sale.customerPhone); if (!record) continue;
    if (customerName(sale.customerName || "")) record.name = customerName(sale.customerName || "");
    record.sales.push({ id: sale.id, unitId: unit.id, unitCode: sale.product?.code||unit.code, deviceName: sale.product?`${sale.product.brand} ${sale.product.model}`.trim():`${unit.brand} ${unit.model}`.trim(), time: sale.time, priceCents: sale.priceCents, paidCents: sale.paidCents, delivered: sale.delivered, note: sale.note,refundedCents:(sale.refunds||[]).reduce((sum,entry)=>sum+(entry.void?0:entry.amountCents),0),returned:!!sale.returned,afterSaleCount:sale.afterSales?.length||0 });
    record.lastActivity = [record.lastActivity, sale.time].sort().at(-1)!;
  }
  for (const profile of profiles) { const record = get(profile.phone); if (record) Object.assign(record, profile, { phone: normalizeCustomerPhone(profile.phone) }); }
  for (const record of directory.values()) { record.repairs.sort((a,b) => b.createdAt.localeCompare(a.createdAt)); record.sales.sort((a,b) => b.time.localeCompare(a.time)); }
  return [...directory.values()].sort((a,b) => b.lastActivity.localeCompare(a.lastActivity) || a.phone.localeCompare(b.phone));
}

export function customerCandidates(query: string, customers: readonly Customer[]): Customer[] {
  const value = query.normalize("NFKC").trim();
  const digits = value.replace(/\D/g, "");
  if (digits.length < 3 || !/^(?:\+|00)?[\d\s().-]+$/.test(value)) return [];
  const explicit = value.startsWith("+") || value.startsWith("00");
  const needle = value.startsWith("00") ? digits.slice(2) : digits;
  return customers.filter(customer => explicit ? customer.phone.slice(1).startsWith(needle) : customer.phone.slice(1).includes(needle)).slice(0,12);
}

export function updateCustomerProfile(profiles: readonly CustomerProfile[], draft: Omit<CustomerProfile, "version">, expectedVersion: number): CustomerProfile[] {
  const phone = normalizeCustomerPhone(draft.phone);
  const previous = profiles.find(profile => profile.phone === phone);
  if ((previous?.version ?? 0) !== expectedVersion) throw new Error("客户资料已更新，请重新核对后提交。");
  if (draft.name.length > 80 || draft.email.length > 160 || draft.note.length > 500 || !draft.updatedAt.trim()) throw new Error("客户资料格式无效，请核对后提交。");
  if (draft.email.trim() && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(draft.email.trim())) throw new Error("请核对电子邮件，或留空。");
  const next = { ...draft, phone, name: customerName(draft.name), email: draft.email.trim(), note: draft.note.trim(), version: expectedVersion + 1 };
  if (!previous && profiles.length >= 500) throw new Error("本地客户资料已达到 500 条。");
  return previous ? profiles.map(profile => profile.phone === phone ? next : profile) : [...profiles, next];
}
export function parseCustomerProfiles(raw: string | null): CustomerProfile[] {
  if (!raw) return [];
  const data: unknown = JSON.parse(raw);
  if (!data || typeof data !== "object" || !("version" in data) || data.version !== 1 || !("profiles" in data) || !Array.isArray(data.profiles) || data.profiles.length > 500) throw new Error("本地客户资料格式异常，现有资料未被覆盖。");
  const profiles = data.profiles.map(value => {
    if (!value || typeof value !== "object" || typeof value.phone !== "string" || typeof value.name !== "string" || typeof value.email !== "string" || typeof value.note !== "string" || typeof value.updatedAt !== "string" || !Number.isSafeInteger(value.version) || value.version < 1) throw new Error("本地客户资料格式异常，现有资料未被覆盖。");
    const validated = updateCustomerProfile([], value, 0)[0];
    if (validated.phone !== value.phone) throw new Error("本地客户手机号格式异常。");
    return { ...validated, version: value.version };
  });
  if (new Set(profiles.map(profile => profile.phone)).size !== profiles.length) throw new Error("本地客户手机号重复，现有资料未被覆盖。");
  return profiles;
}
