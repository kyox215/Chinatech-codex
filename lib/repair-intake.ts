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

export const deviceCatalog: Record<string, Record<string, readonly string[]>> = {
  手机: {
    Apple: ["iPhone 16", "iPhone 16 Pro", "iPhone 15", "iPhone 15 Pro", "iPhone 14", "iPhone 13", "iPhone 12", "iPhone 11", "iPhone SE"],
    Samsung: ["Galaxy S24 Ultra", "Galaxy S24", "Galaxy S23", "Galaxy A55", "Galaxy A54", "Galaxy A34", "Galaxy A13"],
    Xiaomi: ["Xiaomi 14", "Xiaomi 13", "Mi 11 Lite"], Redmi: ["Redmi Note 14 Pro", "Redmi Note 13", "Redmi Note 12", "Redmi 9T"],
    Huawei: ["P30", "P40", "Y6 2018"], OPPO: ["Reno 11", "A78"], Honor: ["Magic6 Lite", "90"], Motorola: ["Moto G84", "Edge 40"], Google: ["Pixel 8", "Pixel 7"],
  },
  电脑: { Apple: ["MacBook Air M2", "MacBook Air M1", "MacBook Pro 14", "MacBook Pro 13"], Lenovo: ["ThinkPad X1 Carbon", "ThinkPad T14", "IdeaPad 3"], HP: ["Pavilion 15", "EliteBook 840"], Dell: ["XPS 13", "Latitude 5420"], ASUS: ["VivoBook 15", "ZenBook 14"], Acer: ["Aspire 5"] },
  平板: { Apple: ["iPad Air 5", "iPad 10", "iPad 9", "iPad Pro 11", "iPad mini 6"], Samsung: ["Galaxy Tab S9", "Galaxy Tab A9"], Lenovo: ["Tab M10", "Tab P11"], Huawei: ["MatePad 11"] },
  游戏机: { Nintendo: ["Switch OLED", "Switch", "Switch Lite"], Sony: ["PlayStation 5", "PlayStation 4"], Microsoft: ["Xbox Series X", "Xbox Series S"] },
  其他: {},
};
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
