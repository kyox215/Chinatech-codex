export type AccountProvider = "google" | "apple";
export type AccountOverview = {
  sessionId: string;
  account: {
    id: string; email: string; emailVerified: boolean; pendingEmail: string;
    phone: string; phoneVerified: boolean; pendingPhone: string;
    providers: Record<AccountProvider, { linked: boolean; email: string }>;
  };
  availability: Record<AccountProvider | "phone", boolean>;
};

export const COUNTRY_DIAL_CODES = [
  { code: "+39", label: "意大利" }, { code: "+86", label: "中国大陆" },
  { code: "+33", label: "法国" }, { code: "+49", label: "德国" },
  { code: "+34", label: "西班牙" }, { code: "+44", label: "英国" },
  { code: "+41", label: "瑞士" }, { code: "+43", label: "奥地利" },
  { code: "+31", label: "荷兰" }, { code: "+32", label: "比利时" },
  { code: "+351", label: "葡萄牙" }, { code: "+353", label: "爱尔兰" },
  { code: "+30", label: "希腊" }, { code: "+48", label: "波兰" },
  { code: "+40", label: "罗马尼亚" }, { code: "+46", label: "瑞典" },
  { code: "+45", label: "丹麦" }, { code: "+47", label: "挪威" },
  { code: "+358", label: "芬兰" }, { code: "+420", label: "捷克" },
  { code: "+852", label: "中国香港" }, { code: "+853", label: "中国澳门" },
  { code: "+886", label: "中国台湾" }, { code: "+1", label: "美国／加拿大" },
  { code: "+61", label: "澳大利亚" }, { code: "+64", label: "新西兰" },
  { code: "+81", label: "日本" }, { code: "+82", label: "韩国" },
  { code: "+65", label: "新加坡" }, { code: "+60", label: "马来西亚" },
  { code: "+66", label: "泰国" }, { code: "+84", label: "越南" },
  { code: "+91", label: "印度" }, { code: "+63", label: "菲律宾" },
] as const;

export function normalizeAccountPhone(countryCode: unknown, number: unknown): string {
  if (typeof countryCode !== "string" || !/^\+[1-9]\d{0,2}$/.test(countryCode)) throw new Error("请选择有效区号，或输入 + 开头的 1–3 位区号。");
  if (typeof number !== "string" || number.length > 40 || !/^[\d ()-]+$/.test(number)) throw new Error("请填写本地号码，不要重复填写 + 区号。");
  const digits = number.replace(/[ ()-]/g, "");
  if (!/^\d{4,14}$/.test(digits) || !/^\+[1-9]\d{5,14}$/.test(countryCode + digits)) throw new Error("请填写有效号码，含区号最多 15 位数字。");
  return countryCode + digits;
}
