import type { StoreSettings } from "@/lib/repairdesk/types";

export type StoreSettingsReadinessInput = Pick<
  StoreSettings,
  | "store_name"
  | "store_address"
  | "store_phone"
  | "store_whatsapp"
  | "store_email"
  | "default_inventory_warranty_months"
  | "print_footer"
  | "message_signature"
>;

export interface StoreSettingsReadinessItem {
  key: keyof StoreSettingsReadinessInput | "contact";
  label: string;
  completed: boolean;
  hint: string;
}

export interface StoreSettingsReadiness {
  items: StoreSettingsReadinessItem[];
  completedCount: number;
  totalCount: number;
  score: number;
  tone: "ready" | "warning" | "danger";
  missingLabels: string[];
}

export function getStoreSettingsReadiness(
  settings: StoreSettingsReadinessInput,
): StoreSettingsReadiness {
  const items: StoreSettingsReadinessItem[] = [
    {
      key: "store_name",
      label: "店铺名",
      completed: hasText(settings.store_name),
      hint: "用于客户消息、打印抬头和系统显示。",
    },
    {
      key: "contact",
      label: "客户联系方式",
      completed: hasText(settings.store_whatsapp) || hasText(settings.store_phone),
      hint: "WhatsApp 或电话至少填写一个，方便客户回拨。",
    },
    {
      key: "store_address",
      label: "门店地址",
      completed: hasText(settings.store_address),
      hint: "用于客户到店、打印页脚和报价说明。",
    },
    {
      key: "message_signature",
      label: "消息签名",
      completed: hasText(settings.message_signature),
      hint: "自动追加到 WhatsApp / SMS 模板里。",
    },
    {
      key: "print_footer",
      label: "打印页脚",
      completed: hasText(settings.print_footer),
      hint: "用于收据、报价单和取机凭证底部说明。",
    },
    {
      key: "default_inventory_warranty_months",
      label: "二手保修",
      completed: Number(settings.default_inventory_warranty_months) >= 0,
      hint: "用于二手/回收库存售出时的默认保修。",
    },
  ];
  const completedCount = items.filter((item) => item.completed).length;
  const score = Math.round((completedCount / items.length) * 100);

  return {
    items,
    completedCount,
    totalCount: items.length,
    score,
    tone: score === 100 ? "ready" : score >= 67 ? "warning" : "danger",
    missingLabels: items.filter((item) => !item.completed).map((item) => item.label),
  };
}

export function buildStoreMessagePreview(settings: StoreSettingsReadinessInput) {
  const storeName = cleanText(settings.store_name) || "未填写店铺名";
  const contact = cleanText(settings.store_whatsapp) || cleanText(settings.store_phone);
  const address = cleanText(settings.store_address);
  const signature = cleanText(settings.message_signature);

  return [
    `Gentile Mario Rossi,`,
    `la contattiamo da ${storeName}.`,
    contact ? `Contatto: ${contact}` : "Contatto: 未填写 WhatsApp / 电话",
    address ? `Indirizzo: ${address}` : "Indirizzo: 未填写门店地址",
    "",
    signature || "未填写客户消息签名",
  ].join("\n");
}

export function buildStorePrintPreview(settings: StoreSettingsReadinessInput) {
  const storeName = cleanText(settings.store_name) || "未填写店铺名";
  const footer = cleanText(settings.print_footer);
  const warrantyMonths = Number(settings.default_inventory_warranty_months);

  return [
    storeName,
    `Garanzia usato: ${Number.isFinite(warrantyMonths) ? warrantyMonths : 0} mesi`,
    footer || "未填写打印页脚",
  ].join("\n");
}

function hasText(value: string | undefined) {
  return cleanText(value).length > 0;
}

function cleanText(value: string | undefined) {
  return String(value ?? "").trim();
}
