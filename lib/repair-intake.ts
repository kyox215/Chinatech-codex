export type IntakeCustomer = { id: string; name: string; phone: string; email: string };

// M1: independently identified, fictional customer directory; never imported from the old site.
export const intakeCustomers: IntakeCustomer[] = [
  { id: "DEMO-C01", name: "周先生", phone: "+39 320 000 1029", email: "zhou@example.com" },
  { id: "DEMO-C02", name: "Elena R.", phone: "+39 320 000 1027", email: "elena@example.com" },
  { id: "DEMO-C03", name: "Marco B.", phone: "+39 320 000 1024", email: "" },
  { id: "DEMO-C04", name: "林女士", phone: "+39 320 000 1021", email: "" },
  { id: "DEMO-C05", name: "Andrea P.", phone: "+39 320 000 1018", email: "" },
  { id: "DEMO-C06", name: "Sofia M.", phone: "+39 320 000 1016", email: "" },
];

export function phoneDigits(value: string): string {
  const digits = value.replace(/\D/g, "");
  return value.trim().startsWith("00") ? digits.slice(2) : digits;
}
export function customerPhoneMatches(query: string, customers: readonly IntakeCustomer[]): IntakeCustomer[] {
  const digits = phoneDigits(query);
  if (digits.length < 3) return [];
  return customers.filter(customer => phoneDigits(customer.phone).includes(digits));
}
export function validIntakePhone(value: string): boolean {
  return /^[+\d\s().-]+$/.test(value.trim()) && /^[0-9]{7,15}$/.test(phoneDigits(value));
}

// Category labels remain local; all brand/model candidates come from the shared catalog API.
export const deviceCatalog: Record<string, Record<string, readonly string[]>> = { 手机: {}, 电脑: {}, 平板: {}, 游戏机: {}, 其他: {} };
export const intakeColors = ["黑色", "白色", "银色", "灰色", "蓝色", "深蓝色", "绿色", "紫色", "粉色", "红色", "金色", "原色钛金属", "黑色钛金属", "白色钛金属", "蓝色钛金属"];
export function modelsFor(category: string, brand: string): readonly string[] {
  const brands = deviceCatalog[category] ?? {};
  const key = Object.keys(brands).find(key => key.toLowerCase() === brand.trim().toLowerCase());
  return key ? brands[key] : [];
}

type HistoryRepair = { id: string; createdAt: string; device: { brand: string; model: string; serial: string } };
const normalizedIdentity = (value: string) => value.trim().toUpperCase().replace(/\s/g, "");
export function intakeDeviceHistory<T extends HistoryRepair>(serial: string, brand: string, model: string, orders: readonly T[]): { exact: T[]; related: T[] } {
  const identifier = normalizedIdentity(serial);
  const brandKey = brand.trim().toLowerCase();
  const modelKey = model.trim().toLowerCase();
  const exact = identifier ? orders.filter(order => normalizedIdentity(order.device.serial) === identifier && (/^\d{15}$/.test(identifier) || !brandKey || order.device.brand.toLowerCase() === brandKey)) : [];
  const related = brandKey && modelKey ? orders.filter(order => !exact.includes(order) && order.device.brand.toLowerCase() === brandKey && order.device.model.toLowerCase() === modelKey) : [];
  return { exact: [...exact].sort((a,b) => b.createdAt.localeCompare(a.createdAt)), related: [...related].sort((a,b) => b.createdAt.localeCompare(a.createdAt)) };
}

export function intakeIssueText(faults: readonly string[], detail: string): string {
  return [faults.join("、"), detail.trim()].filter(Boolean).join("；");
}
export function intakePhotoError(file: { type: string; size: number }): string {
  if (file.size <= 0) return "照片文件为空，请重新选择。";
  if (!["image/jpeg", "image/png", "image/webp", "image/heic", "image/heif"].includes(file.type)) return "请选择 JPG、PNG、WebP 或 HEIC 照片。";
  if (file.size > 12 * 1024 * 1024) return "单张照片不能超过 12 MB。";
  return "";
}
